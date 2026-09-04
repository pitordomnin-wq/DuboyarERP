import {
  LayoutMaterialRole,
  LkpMaterialCategory,
  ProductionReleaseType,
  StageInputMode,
  StageQuantityBasis,
} from '@prisma/client';
import { roundQty } from '../warehouse/stock-lots';

export const DEFAULT_LKP_NORMS: { category: LkpMaterialCategory; normPerM2Kg: number; keywords: string[] }[] = [
  { category: 'PASTE', normPerM2Kg: 0.005, keywords: ['паста'] },
  { category: 'LACQUER_OIL', normPerM2Kg: 0.015, keywords: ['лак', 'масло'] },
  { category: 'DYE', normPerM2Kg: 0.005, keywords: ['краситель', 'морилк'] },
  { category: 'PIGMENT', normPerM2Kg: 0.003, keywords: ['пигмент'] },
  { category: 'PRIMER', normPerM2Kg: 0.05, keywords: ['грунт', 'грунтовк', 'изолятор'] },
];

export const LKP_CATEGORY_LABEL: Record<LkpMaterialCategory, string> = {
  PRIMER: 'Грунт',
  LACQUER_OIL: 'Лак / масло',
  PASTE: 'Паста',
  DYE: 'Краситель',
  PIGMENT: 'Пигмент',
};

export const RELEASE_TYPE_LABEL: Record<ProductionReleaseType, string> = {
  DECK: 'Палуба',
  HERRINGBONE: 'Ёлка',
};

const HERRINGBONE_HINTS = ['ёлоч', 'елоч', 'елка', 'herringbone', 'her'];

export function inferReleaseType(productName: string, fallback: ProductionReleaseType = 'DECK'): ProductionReleaseType {
  const lower = productName.toLowerCase();
  return HERRINGBONE_HINTS.some((hint) => lower.includes(hint)) ? 'HERRINGBONE' : fallback;
}

export function parseKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
}

export function matchesKeywords(name: string, keywords: string[]): boolean {
  if (!keywords.length) return false;
  const lower = name.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

export function computeEffectiveM2(quantityM2: number, lossPercent: number): number {
  return roundQty(quantityM2 * Math.max(0, 1 - lossPercent / 100));
}

export function computePieceCount(quantityM2: number, lossPercent: number, piecesPerM2: number): number {
  const factor = Math.max(0, 1 - lossPercent / 100);
  return roundQty(quantityM2 * factor * piecesPerM2);
}

export function computePackageCount(
  quantityM2: number,
  lossPercent: number,
  releaseType: ProductionReleaseType,
  m2PerPackageDeck: number,
  m2PerPackageHerringbone: number,
): number {
  const factor = Math.max(0, 1 - lossPercent / 100);
  const effectiveM2 = quantityM2 * factor;
  const m2PerPackage = releaseType === 'HERRINGBONE' ? m2PerPackageHerringbone : m2PerPackageDeck;
  if (m2PerPackage <= 0) return 0;
  return Math.max(1, Math.ceil(effectiveM2 / m2PerPackage - 1e-9));
}

export function isAreaUnit(unit: string): boolean {
  const normalized = unit.trim().toLowerCase().replace(/²/g, '2');
  return normalized === 'м2' || normalized === 'м^2' || normalized === 'm2';
}

export function isPackageUnit(unit: string): boolean {
  const normalized = unit.trim().toLowerCase();
  return (
    normalized === 'упак' ||
    normalized === 'уп' ||
    normalized === 'упаковка' ||
    normalized.startsWith('упак') ||
    normalized === 'pack' ||
    normalized === 'pkg'
  );
}

export function m2PerPackageFor(
  releaseType: ProductionReleaseType,
  m2PerPackageDeck: number,
  m2PerPackageHerringbone: number,
): number {
  return releaseType === 'HERRINGBONE' ? m2PerPackageHerringbone : m2PerPackageDeck;
}

export function piecesPerPackage(
  piecesPerM2: number,
  releaseType: ProductionReleaseType,
  m2PerPackageDeck: number,
  m2PerPackageHerringbone: number,
): number {
  const m2 = m2PerPackageFor(releaseType, m2PerPackageDeck, m2PerPackageHerringbone);
  return roundQty(piecesPerM2 * m2);
}

/** Convert piece count into finished packages after packaging stage. */
export function packagesFromPieces(
  pieceCount: number,
  piecesPerM2: number,
  releaseType: ProductionReleaseType,
  m2PerPackageDeck: number,
  m2PerPackageHerringbone: number,
): number {
  const perPackage = piecesPerPackage(piecesPerM2, releaseType, m2PerPackageDeck, m2PerPackageHerringbone);
  if (perPackage <= 0) return 0;
  return Math.max(1, Math.round(pieceCount / perPackage));
}

/** Convert a deal-line quantity into production job quantities (packages-first). */
export function jobQuantitiesFromDealItem(params: {
  quantity: number;
  unit: string;
  releaseType: ProductionReleaseType;
  m2PerPackageDeck: number;
  m2PerPackageHerringbone: number;
}): { quantity: number; quantityM2: number; packageCount: number | null } {
  const m2PerPackage = m2PerPackageFor(
    params.releaseType,
    params.m2PerPackageDeck,
    params.m2PerPackageHerringbone,
  );
  const qty = Math.max(0, params.quantity);

  if (isPackageUnit(params.unit) || (!isAreaUnit(params.unit) && m2PerPackage > 0)) {
    const packageCount = qty;
    return {
      packageCount,
      quantity: packageCount,
      quantityM2: roundQty(packageCount * m2PerPackage),
    };
  }

  if (isAreaUnit(params.unit)) {
    const quantityM2 = qty;
    const packageCount =
      m2PerPackage > 0 ? Math.max(1, Math.ceil(quantityM2 / m2PerPackage - 1e-9)) : null;
    return {
      quantityM2,
      packageCount,
      quantity: packageCount ?? quantityM2,
    };
  }

  return { quantity: qty, quantityM2: qty, packageCount: null };
}

type JobQuantities = {
  quantityM2: number;
  pieceCount: number | null;
  packageCount: number | null;
};

type TypeQuantities = {
  piecesPerM2: number;
  m2PerPackageDeck: number;
  m2PerPackageHerringbone: number;
};

export function resolveBasisQuantity(
  basis: StageQuantityBasis,
  job: JobQuantities,
  profilingLossPercent: number,
  type: TypeQuantities,
  releaseType: ProductionReleaseType,
): number {
  switch (basis) {
    case 'M2_ORIGINAL':
      return computeEffectiveM2(job.quantityM2, profilingLossPercent);
    case 'M2':
      return job.quantityM2;
    case 'PIECE':
      return (
        job.pieceCount ??
        computePieceCount(job.quantityM2, profilingLossPercent, type.piecesPerM2)
      );
    case 'PACKAGE':
      return (
        job.packageCount ??
        computePackageCount(
          job.quantityM2,
          profilingLossPercent,
          releaseType,
          type.m2PerPackageDeck,
          type.m2PerPackageHerringbone,
        )
      );
    default:
      return job.quantityM2;
  }
}

export function defaultQuantityBasis(stagePosition: number, inputMode: StageInputMode): StageQuantityBasis {
  if (inputMode === 'LKP_RECIPE') return 'M2_ORIGINAL';
  if (stagePosition >= 3) return 'PACKAGE';
  if (stagePosition >= 2) return 'PIECE';
  return 'M2';
}

export function layoutKeywords(role: LayoutMaterialRole): string[] {
  switch (role) {
    case 'VENEER_OAK':
      return ['шпон дуб'];
    case 'VENEER_DECK':
      return ['шпон', '1400', '155'];
    case 'VENEER_HERRINGBONE':
      return ['шпон', '690', '130'];
    case 'BOX_DECK':
      return ['короб', 'т24', '1400'];
    case 'BOX_HERRINGBONE':
      return ['короб', 'т23', '700'];
    case 'PACK_UNIVERSAL':
      return ['гофрокартон', 'листовк', 'наклейк'];
    default:
      return [];
  }
}

export function layoutRoleForRelease(role: LayoutMaterialRole, releaseType: ProductionReleaseType): boolean {
  if (role === 'VENEER_OAK' || role === 'PACK_UNIVERSAL') return true;
  if (releaseType === 'DECK') return role === 'VENEER_DECK' || role === 'BOX_DECK';
  return role === 'VENEER_HERRINGBONE' || role === 'BOX_HERRINGBONE';
}

export type TechCardNormRow = {
  materialName: string;
  stage: number;
  normDeckM2?: number;
  normHerringboneM2?: number;
  fillGroupKey?: string;
  fillGroupName?: string;
};

export function normForRelease(row: TechCardNormRow, releaseType: ProductionReleaseType): number {
  if (releaseType === 'HERRINGBONE') {
    return row.normHerringboneM2 ?? row.normDeckM2 ?? 0;
  }
  return row.normDeckM2 ?? row.normHerringboneM2 ?? 0;
}

export function groupNameFromMaterial(materialName: string): string {
  const lower = materialName.toLowerCase();
  if (lower.includes('клей') || lower.includes('смола')) return 'Клеи';
  if (lower.includes('хдф') || lower.includes('hdf')) return 'ХДФ';
  return materialName.slice(0, 40);
}

export function keywordFromMaterial(materialName: string): string {
  const lower = materialName.toLowerCase();
  if (lower.includes('клей') || lower.includes('смола')) return 'клей';
  if (lower.includes('хдф') || lower.includes('hdf')) return 'хдф';
  return lower.split(' ')[0] ?? lower;
}

export type StageInputDraft =
  | {
      kind: 'group';
      groupName: string;
      keywords: string[];
      /** Optional: narrow FIFO write-off inside the fill-color group (e.g. birch size, box T23). */
      filterKeywords?: string[];
      quantity: number;
      quantityBasis: StageQuantityBasis;
    }
  | {
      kind: 'keyword';
      layoutRole: LayoutMaterialRole;
      keyword?: string;
      quantity: number;
      quantityBasis: StageQuantityBasis;
    };

function stage1RowApplies(row: TechCardNormRow, releaseType: ProductionReleaseType): boolean {
  const quantity = normForRelease(row, releaseType);
  if (quantity <= 0) return false;
  const lower = row.materialName.toLowerCase();
  if (lower.includes('690') && lower.includes('шпон') && releaseType !== 'HERRINGBONE') return false;
  if (lower.includes('1400') && lower.includes('155') && releaseType !== 'DECK') return false;
  return true;
}

function stage4RowApplies(row: TechCardNormRow, releaseType: ProductionReleaseType): boolean {
  const lower = row.materialName.toLowerCase();
  // Stage 4: release-specific box + листовка А4 (packing sheet / 150×580 flyer skipped — not in stock).
  if (lower.includes('короб') && lower.includes('т23')) return releaseType === 'HERRINGBONE';
  if (lower.includes('короб') && lower.includes('т24')) return releaseType === 'DECK';
  if (lower.includes('листовк') && lower.includes('а4')) return true;
  return false;
}

/** Distinctive keywords to pick the right product inside a fill-color group (FIFO among matches). */
export function filterKeywordsForNormRow(row: TechCardNormRow): string[] {
  const lower = row.materialName.toLowerCase();
  if (/шпон/.test(lower) && /бер[её]з/.test(lower)) {
    if (lower.includes('690')) return ['690'];
    if (lower.includes('1400')) return ['1400'];
  }
  if (lower.includes('короб') && lower.includes('т23')) return ['т23'];
  if (lower.includes('короб') && lower.includes('т24')) return ['т24'];
  if (lower.includes('листовк') && lower.includes('а4')) return ['листовка а4'];
  return [];
}

/** One write-off line per Excel fill-color group for stage 1 (HDF, veneers, glue). */
export function buildStage1InputDrafts(
  rows: TechCardNormRow[],
  releaseType: ProductionReleaseType,
): StageInputDraft[] {
  const byGroup = new Map<string, TechCardNormRow[]>();
  for (const row of rows.filter((item) => stage1RowApplies(item, releaseType))) {
    const groupName = normAccountingGroupName(row);
    const list = byGroup.get(groupName) ?? [];
    list.push(row);
    byGroup.set(groupName, list);
  }

  return [...byGroup.entries()].map(([groupName, groupRows]) => {
    const representative = groupRows[0];
    const filterKeywords = filterKeywordsForNormRow(representative);
    return {
      kind: 'group' as const,
      groupName,
      keywords: groupKeywords(groupRows.map((row) => row.materialName)),
      filterKeywords: filterKeywords.length ? filterKeywords : undefined,
      quantity: normForRelease(representative, releaseType),
      quantityBasis: 'M2' as StageQuantityBasis,
    };
  });
}

/** Stage 4: box by release type + листовка А4 from the Упаковка fill group. */
export function buildStage4InputDrafts(
  rows: TechCardNormRow[],
  releaseType: ProductionReleaseType,
): StageInputDraft[] {
  return rows
    .filter((row) => stage4RowApplies(row, releaseType))
    .map((row) => {
      const groupName = normAccountingGroupName(row);
      const filterKeywords = filterKeywordsForNormRow(row);
      return {
        kind: 'group' as const,
        groupName,
        keywords: groupKeywords([row.materialName]),
        filterKeywords: filterKeywords.length ? filterKeywords : [keywordFromMaterial(row.materialName)],
        quantity: 1,
        quantityBasis: 'PACKAGE' as StageQuantityBasis,
      };
    });
}

export function uniqueNormMaterialNames(rows: TechCardNormRow[]): string[] {
  return uniqueNormGroupDescriptors(rows).map((item) => item.name);
}

export function normAccountingGroupName(row: TechCardNormRow): string {
  return row.fillGroupName ?? row.materialName;
}

function groupKeywords(materialNames: string[]): string[] {
  const keywords = new Set<string>();
  for (const material of materialNames) {
    keywords.add(keywordFromMaterial(material));
    const tokens = material
      .toLowerCase()
      .split(/[\s,():]+/)
      .map((token) => token.replace(/[^a-zа-яё0-9]/gi, ''))
      .filter((token) => token.length >= 4);
    for (const token of tokens.slice(0, 6)) keywords.add(token);
  }
  return [...keywords].filter((item) => item.length >= 3);
}

export type NormGroupDescriptor = {
  name: string;
  keywords: string[];
  materials: string[];
  stage: number;
};

/** Build accounting groups from Excel fill colors on the material name column. */
export function uniqueNormGroupDescriptors(rows: TechCardNormRow[]): NormGroupDescriptor[] {
  const byName = new Map<string, { materials: string[]; stage: number }>();

  for (const row of rows) {
    if (row.stage !== 1 && row.stage !== 3 && row.stage !== 4) continue;
    const name = normAccountingGroupName(row);
    const entry = byName.get(name) ?? { materials: [], stage: row.stage };
    entry.materials.push(row.materialName);
    byName.set(name, entry);
  }

  return [...byName.entries()]
    .map(([name, data]) => ({
      name,
      keywords: groupKeywords(data.materials),
      materials: data.materials,
      stage: data.stage,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}
