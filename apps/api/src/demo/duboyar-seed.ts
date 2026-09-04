import {
  LkpMaterialCategory,
  PrismaClient,
  ProductKind,
  ProductionReleaseType,
  StageInputMode,
  StageQuantityBasis,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadNormRowsFromXlsx } from '../production/norms-xlsx-fill';
import {
  DEFAULT_LKP_NORMS,
  buildStage1InputDrafts,
  buildStage4InputDrafts,
  uniqueNormGroupDescriptors,
  parseKeywords,
  type TechCardNormRow,
} from '../production/production-norms';
import * as XLSX from 'xlsx';
import { createReceiptWithLot } from '../warehouse/stock-lots';

export type SeedDb = PrismaClient | Prisma.TransactionClient;

export const DUBOYAR_ORG = {
  name: 'Дубовый Яръ',
  legalName: 'ООО «ПКФ ИМПУЛЬС»',
  brandAddress: 'Россия, г. Майкоп',
  phone: '+7 (995) 799-33-19',
  email: 'info@duboyar.ru',
  inn: '',
  kpp: '',
  ogrn: '',
  legalAddress: 'Россия, г. Майкоп',
  bankName: '',
  bik: '',
  checkingAccount: '',
  correspondentAccount: '',
} as const;

export type DuboyarActors = {
  organizationId: string;
  ownerId: string;
};

type StockRow = { name: string; unit: string; quantity: number; amount: number };
type CounterpartyRow = {
  name: string;
  code: string;
  phone: string;
  email: string;
  actualAddress: string;
  notes: string;
  groups: string;
  contactName: string;
  type: string;
  legalName: string;
  legalAddress: string;
  inn: string;
  kpp: string;
  bankName: string;
  checkingAccount: string;
};
type NormRow = TechCardNormRow;

const IMPORT_DIR = join(__dirname, '../../prisma/import');

function importPath(name: string, envKey: string) {
  const fromEnv = process.env[envKey];
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const local = join(IMPORT_DIR, name);
  if (existsSync(local)) return local;
  throw new Error(`Import file not found: ${name} (set ${envKey} or place in prisma/import/)`);
}

function normalizeUnit(raw: string): string {
  const unit = String(raw ?? '').trim().toLowerCase();
  if (!unit) return 'шт';
  if (unit === 'м2' || unit === 'м²') return 'м²';
  if (unit === 'пог. м' || unit === 'пог.м' || unit === 'пог м') return 'м';
  return unit;
}

const FINISHED_PRODUCTS = [
  {
    name: 'Паркетная доска. Елка (12шт)',
    releaseType: ProductionReleaseType.HERRINGBONE,
    piecesPerM2: 12 / 1.008,
    m2PerPackage: 1.008,
    unit: 'упак',
    price: 0,
  },
  {
    name: 'Паркетная доска палуба (6шт)',
    releaseType: ProductionReleaseType.DECK,
    piecesPerM2: 6 / 1.2067,
    m2PerPackage: 1.2067,
    unit: 'упак',
    price: 0,
  },
] as const;

const WAREHOUSE_CATEGORIES = [
  ['Сырьё и расходники', 0],
  ['Хоз. материалы', 1],
  ['Заготовки', 2],
  ['Готовая продукция', 3],
] as const;

function isHousehold(name: string): boolean {
  return /перчатк|вилка|салфетк|мешок|туалетн|плакат|скотч|пакет для мусора/i.test(name);
}

function isStockFinishedParquet(name: string): boolean {
  return /паркетная доска/i.test(name) && /дубовый яр/i.test(name);
}

function shouldImportCounterparty(row: CounterpartyRow): boolean {
  const groups = row.groups.toLowerCase();
  if (groups.includes('расходы') || groups.includes('сотрудник')) return false;
  if (/^(amocrm|hh\.ru)$/i.test(row.name.trim())) return false;
  return groups.includes('клиент') || groups.includes('поставщик');
}

function classifyStockRow(name: string): { kind: ProductKind; categoryName: string } {
  if (isStockFinishedParquet(name)) {
    return { kind: ProductKind.MATERIAL, categoryName: 'Сырьё и расходники' };
  }
  if (isHousehold(name)) {
    return { kind: ProductKind.CONSUMABLE, categoryName: 'Хоз. материалы' };
  }
  const lower = name.toLowerCase();
  if (/щит|профиль|заготовк|полуфабрикат/i.test(lower)) {
    return { kind: ProductKind.SEMI_FINISHED, categoryName: 'Заготовки' };
  }
  return { kind: ProductKind.MATERIAL, categoryName: 'Сырьё и расходники' };
}

function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const GENERIC_MATCH_TOKENS = new Set([
  'сорт',
  'лист',
  'паста',
  'лак',
  'масло',
  'грунт',
  'шпон',
  'клей',
  'короб',
  'цвет',
  'основа',
  'водный',
  'прозрачный',
  'матовый',
  'паркета',
  'дерева',
  'черная',
  'белая',
  'белый',
  'черный',
]);

/** Score how well a stock product belongs to a fill-color norm group. Higher = better. */
function productGroupMatchScore(
  productName: string,
  descriptor: { name: string; materials: string[] },
): number {
  const product = normalizeMatchText(productName);
  if (!product) return 0;

  let best = 0;
  for (const material of descriptor.materials) {
    const norm = normalizeMatchText(material);
    if (!norm) continue;
    if (product === norm) return 10_000 + norm.length;
    if (product.includes(norm) || norm.includes(product)) {
      best = Math.max(best, 5_000 + Math.min(product.length, norm.length));
      continue;
    }
    const productTokens = new Set(product.split(' ').filter((token) => token.length >= 4));
    const materialTokens = norm
      .split(' ')
      .filter((token) => token.length >= 4 && !GENERIC_MATCH_TOKENS.has(token));
    const overlap = materialTokens.filter((token) =>
      [...productTokens].some(
        (pt) => pt === token || (token.length >= 6 && pt.length >= 6 && (pt.includes(token) || token.includes(pt))),
      ),
    );
    if (overlap.length >= 2 || (overlap.length === 1 && overlap[0].length >= 8)) {
      best = Math.max(best, 1_000 + overlap.join('').length);
    }
  }
  return best;
}

function bestGroupForProduct(
  productName: string,
  descriptors: ReturnType<typeof uniqueNormGroupDescriptors>,
) {
  if (isHousehold(productName) || isStockFinishedParquet(productName)) return null;

  let best: (typeof descriptors)[number] | null = null;
  let bestScore = 0;
  for (const descriptor of descriptors) {
    const score = productGroupMatchScore(productName, descriptor);
    if (score > bestScore) {
      bestScore = score;
      best = descriptor;
    }
  }
  // Require a real material-name match, not a weak token hit.
  return bestScore >= 1000 ? best : null;
}

function parseStockFile(path: string): StockRow[] {
  const workbook = XLSX.readFile(path);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1 });
  const rows: StockRow[] = [];
  for (let i = 6; i < matrix.length; i++) {
    const row = matrix[i];
    const name = String(row?.[0] ?? '').trim();
    if (!name || /итого/i.test(name) || /склад/i.test(name)) continue;
    const unit = normalizeUnit(String(row?.[1] ?? ''));
    const quantity = Number(row?.[2] ?? 0);
    const amount = Number(row?.[3] ?? 0);
    if (!unit) continue;
    rows.push({ name, unit, quantity: Number.isFinite(quantity) ? quantity : 0, amount: Number.isFinite(amount) ? amount : 0 });
  }
  return rows;
}

function parseCounterpartiesFile(path: string): CounterpartyRow[] {
  const workbook = XLSX.readFile(path);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1 });
  const rows: CounterpartyRow[] = [];
  for (let i = 8; i < matrix.length; i++) {
    const row = matrix[i];
    const name = String(row?.[1] ?? '').trim();
    if (!name) continue;
    rows.push({
      name,
      code: String(row?.[2] ?? '').trim(),
      phone: String(row?.[3] ?? '').trim(),
      email: String(row?.[5] ?? '').trim(),
      actualAddress: String(row?.[6] ?? '').trim(),
      notes: String(row?.[7] ?? '').trim(),
      groups: String(row?.[8] ?? '').trim(),
      contactName: String(row?.[9] ?? '').trim(),
      type: String(row?.[10] ?? '').trim(),
      legalName: String(row?.[11] ?? '').trim(),
      legalAddress: String(row?.[12] ?? '').trim(),
      inn: String(row?.[13] ?? '').trim(),
      kpp: String(row?.[14] ?? '').trim(),
      bankName: String(row?.[15] ?? '').trim(),
      checkingAccount: String(row?.[16] ?? '').trim(),
    });
  }
  return rows;
}

function parseNormsFile(path: string): NormRow[] {
  return loadNormRowsFromXlsx(path);
}

function uniqueInn(inn: string, index: number, used: Set<string>): string {
  const base = inn || `NOINN-${String(index + 1).padStart(5, '0')}`;
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

async function ensureGroup(db: SeedDb, organizationId: string, name: string, keywords: string[]) {
  const existing = await db.productGroup.findUnique({
    where: { organizationId_name: { organizationId, name } },
  });
  if (existing) {
    const merged = [...new Set([...parseKeywords(existing.keywords), ...keywords.map((k) => k.toLowerCase())])];
    if (merged.length !== parseKeywords(existing.keywords).length) {
      return db.productGroup.update({
        where: { id: existing.id },
        data: { keywords: merged },
      });
    }
    return existing;
  }
  return db.productGroup.create({ data: { organizationId, name, keywords } });
}

type StageInputCreate = {
  inputMode: StageInputMode;
  quantity: number;
  quantityBasis: StageQuantityBasis;
  productGroupId?: string;
  keyword?: string;
};

async function resolveInputDrafts(
  db: SeedDb,
  organizationId: string,
  drafts: ReturnType<typeof buildStage1InputDrafts>,
): Promise<StageInputCreate[]> {
  const inputs: StageInputCreate[] = [];
  for (const draft of drafts) {
    if (draft.kind === 'group') {
      const group = await ensureGroup(db, organizationId, draft.groupName, draft.keywords);
      inputs.push({
        inputMode: 'GROUP',
        productGroupId: group.id,
        keyword: draft.filterKeywords?.join(', ') || undefined,
        quantity: draft.quantity,
        quantityBasis: draft.quantityBasis,
      });
    }
  }
  return inputs;
}

async function createTechCard(
  db: SeedDb,
  organizationId: string,
  productId: string,
  warehouseId: string,
  releaseType: ProductionReleaseType,
  normRows: NormRow[],
  packageInfo: { piecesPerM2?: number; m2PerPackage?: number },
) {
  const stage1Rows = normRows.filter((row) => row.stage === 1);
  const stage4Rows = normRows.filter((row) => row.stage === 4);
  const stage1Inputs = await resolveInputDrafts(
    db,
    organizationId,
    buildStage1InputDrafts(stage1Rows, releaseType),
  );
  const stage4Inputs = await resolveInputDrafts(
    db,
    organizationId,
    buildStage4InputDrafts(stage4Rows, releaseType),
  );

  const piecesPerM2 = packageInfo.piecesPerM2 ?? 4.972186492063492;
  const m2PerPackage =
    packageInfo.m2PerPackage ??
    (releaseType === 'HERRINGBONE' ? 1.008 : 1.2067);

  await db.productionType.create({
    data: {
      organizationId,
      name: (await db.product.findUniqueOrThrow({ where: { id: productId } })).name,
      productId,
      warehouseId,
      defaultReleaseType: releaseType,
      piecesPerM2,
      m2PerPackageDeck: releaseType === 'DECK' ? m2PerPackage : 1.2067,
      m2PerPackageHerringbone: releaseType === 'HERRINGBONE' ? m2PerPackage : 1.008,
      stages: {
        create: [
          {
            name: 'Склейка слоев',
            position: 0,
            lossPercent: 0,
            inputs: { create: stage1Inputs },
          },
          {
            name: 'Профилирование',
            position: 1,
            lossPercent: 20,
            inputs: { create: [] },
          },
          {
            name: 'Покраска',
            position: 2,
            lossPercent: 0,
            inputs: {
              create: [{ inputMode: 'LKP_RECIPE', quantity: 0, quantityBasis: 'M2_ORIGINAL' }],
            },
          },
          {
            name: 'Упаковка',
            position: 3,
            lossPercent: 0,
            inputs: { create: stage4Inputs },
            outputs: { create: [{ productId, quantity: 1 }] },
          },
        ],
      },
    },
  });
}

export async function fillDuboyarSeed(db: SeedDb, actors: DuboyarActors) {
  const { organizationId, ownerId } = actors;

  const stockPath = importPath('stock.xlsx', 'STOCK_IMPORT_PATH');
  const counterpartiesPath = importPath('counterparties.xls', 'COUNTERPARTIES_IMPORT_PATH');
  const normsPath = importPath('production-norms.xlsx', 'NORMS_IMPORT_PATH');

  const stockRows = parseStockFile(stockPath);
  const counterpartyRows = parseCounterpartiesFile(counterpartiesPath);
  const normRows = parseNormsFile(normsPath);

  await db.warehouseCategory.createMany({
    data: WAREHOUSE_CATEGORIES.map(([name, position]) => ({ organizationId, name, position })),
  });
  const categories = await db.warehouseCategory.findMany({ where: { organizationId } });
  const categoryByName = Object.fromEntries(categories.map((item) => [item.name, item.id]));

  const warehouse = await db.warehouse.create({
    data: { organizationId, name: 'Основной склад' },
  });

  const groupDescriptors = uniqueNormGroupDescriptors(normRows);
  const groupByName = new Map<string, { id: string; keywords: string[] }>();
  for (const descriptor of groupDescriptors) {
    const group = await ensureGroup(db, organizationId, descriptor.name, descriptor.keywords);
    groupByName.set(descriptor.name, { id: group.id, keywords: descriptor.keywords });
  }

  const stockDate = new Date('2026-08-31T12:00:00.000Z');
  let skuCounter = 1;
  const productsForAssign: { id: string; name: string }[] = [];

  for (const row of stockRows) {
    const { kind, categoryName } = classifyStockRow(row.name);
    const categoryId = categoryByName[categoryName];
    if (!categoryId) continue;
    const price = row.quantity > 0 && row.amount > 0 ? Math.round((row.amount / row.quantity) * 100) / 100 : 0;
    const sku = `DY-${String(skuCounter).padStart(4, '0')}`;
    skuCounter += 1;

    const matched = bestGroupForProduct(row.name, groupDescriptors);
    const groupId = matched ? groupByName.get(matched.name)?.id ?? null : null;

    const product = await db.product.create({
      data: {
        organizationId,
        kind,
        categoryId,
        groupId,
        name: row.name,
        sku,
        unit: row.unit,
        price,
        inCatalog: false,
      },
    });
    productsForAssign.push({ id: product.id, name: product.name });

    if (row.quantity > 0) {
      await createReceiptWithLot(db, {
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: row.quantity,
        note: 'Остаток на 31.08.2026',
        createdById: ownerId,
        receivedAt: stockDate,
      });
    }
  }

  const finishedCategoryId = categoryByName['Готовая продукция'];
  for (const item of FINISHED_PRODUCTS) {
    const stockMatch = stockRows.find((row) => {
      if (item.releaseType === 'HERRINGBONE') return /елка|ёлк/i.test(row.name) && isStockFinishedParquet(row.name);
      return /палуба/i.test(row.name) && isStockFinishedParquet(row.name);
    });
    const price =
      stockMatch && stockMatch.quantity > 0 && stockMatch.amount > 0
        ? Math.round((stockMatch.amount / stockMatch.quantity) * 100) / 100
        : item.price;

    const product = await db.product.create({
      data: {
        organizationId,
        kind: ProductKind.FINISHED,
        categoryId: finishedCategoryId,
        name: item.name,
        sku: `DY-${String(skuCounter).padStart(4, '0')}`,
        unit: item.unit,
        price,
        inCatalog: true,
      },
    });
    skuCounter += 1;

    if (stockMatch && stockMatch.quantity > 0) {
      await createReceiptWithLot(db, {
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: stockMatch.quantity,
        note: 'Остаток на 31.08.2026',
        createdById: ownerId,
        receivedAt: stockDate,
      });
    }

    const categories_lkp: LkpMaterialCategory[] = ['PRIMER', 'LACQUER_OIL', 'PASTE', 'DYE', 'PIGMENT'];
    await db.productCoatingRecipeLine.createMany({
      data: categories_lkp.map((category) => ({ productId: product.id, category, enabled: true })),
    });

    await createTechCard(db, organizationId, product.id, warehouse.id, item.releaseType, normRows, {
      piecesPerM2: item.piecesPerM2,
      m2PerPackage: item.m2PerPackage,
    });
  }

  const usedInns = new Set<string>();
  let importedCounterparties = 0;
  for (let i = 0; i < counterpartyRows.length; i++) {
    const row = counterpartyRows[i];
    if (!shouldImportCounterparty(row)) continue;
    const inn = uniqueInn(row.inn, i, usedInns);
    const legalName = row.legalName || row.name;
    const legalAddress = row.legalAddress || row.actualAddress || '—';
    const email = row.email || `no-email-${inn}@import.local`;
    const notes = [row.notes, row.groups ? `Группы: ${row.groups}` : '', row.type ? `Тип: ${row.type}` : '']
      .filter(Boolean)
      .join('\n');

    await db.counterparty.create({
      data: {
        organizationId,
        name: row.name,
        legalName,
        inn,
        kpp: row.kpp || null,
        legalAddress,
        actualAddress: row.actualAddress || null,
        bankName: row.bankName || null,
        checkingAccount: row.checkingAccount || null,
        email,
        phone: row.phone || null,
        contactName: row.contactName || null,
        notes: notes || null,
      },
    });
    importedCounterparties += 1;
  }

  await db.lkpNorm.createMany({
    data: DEFAULT_LKP_NORMS.map((item) => ({
      organizationId,
      category: item.category,
      normPerM2Kg: item.normPerM2Kg,
      keywords: item.keywords,
    })),
  });

  console.log(
    `Duboyar seed: ${stockRows.length} stock rows, ${importedCounterparties} counterparties, ${groupByName.size} accounting groups, ${FINISHED_PRODUCTS.length} finished products`,
  );
}

export async function restoreDuboyarOrganization(db: SeedDb, organizationId: string) {
  await db.organization.update({
    where: { id: organizationId },
    data: { ...DUBOYAR_ORG },
  });
}
