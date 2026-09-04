import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { allocateGroupFifo, createWriteoffFifo, roundQty } from '../warehouse/stock-lots';
import { matchesKeywords } from './production-norms';

type Db = Prisma.TransactionClient;

export type StockCandidate = {
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
};

export type WriteoffPlanLine = {
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  groupName?: string;
  groupId?: string | null;
  slotKey?: string;
  label?: string;
  candidates?: StockCandidate[];
};

export type WriteoffPlan = { ok: true; lines: WriteoffPlanLine[] } | { ok: false; have: number; need: number; label: string };

async function stockQtyByProduct(tx: Db, warehouseId: string, productIds: string[]) {
  if (!productIds.length) return new Map<string, number>();
  const lots = await tx.stockLot.findMany({
    where: { warehouseId, productId: { in: productIds }, quantity: { gt: 0 } },
    select: { productId: true, quantity: true },
  });
  const qty = new Map<string, number>();
  for (const lot of lots) {
    qty.set(lot.productId, roundQty((qty.get(lot.productId) ?? 0) + lot.quantity));
  }
  return qty;
}

export async function toStockCandidates(
  tx: Db,
  warehouseId: string,
  products: { id: string; name: string; unit: string }[],
): Promise<StockCandidate[]> {
  const qty = await stockQtyByProduct(
    tx,
    warehouseId,
    products.map((item) => item.id),
  );
  return products
    .map((product) => ({
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      quantity: qty.get(product.id) ?? 0,
    }))
    .filter((item) => item.quantity > 0)
    .sort((a, b) => a.productName.localeCompare(b.productName, 'ru'));
}

export async function listGroupStockCandidates(
  tx: Db,
  organizationId: string,
  warehouseId: string,
  groupId: string,
): Promise<StockCandidate[]> {
  const members = await tx.product.findMany({
    where: { organizationId, groupId },
    select: { id: true, name: true, unit: true },
    orderBy: { name: 'asc' },
  });
  return toStockCandidates(tx, warehouseId, members);
}

export async function listKeywordStockCandidates(
  tx: Db,
  organizationId: string,
  warehouseId: string,
  keywords: string[],
  groupId?: string | null,
): Promise<StockCandidate[]> {
  const products = await tx.product.findMany({
    where: {
      organizationId,
      ...(groupId ? { groupId } : {}),
    },
    select: { id: true, name: true, unit: true },
    orderBy: { name: 'asc' },
  });
  const matched = keywords.length
    ? products.filter((product) => matchesKeywords(product.name, keywords))
    : products;
  return toStockCandidates(tx, warehouseId, matched);
}

export async function listWarehouseStockCandidates(
  tx: Db,
  organizationId: string,
  warehouseId: string,
): Promise<StockCandidate[]> {
  const lots = await tx.stockLot.findMany({
    where: { warehouseId, quantity: { gt: 0 } },
    select: { productId: true, quantity: true },
  });
  if (!lots.length) return [];
  const qty = new Map<string, number>();
  for (const lot of lots) {
    qty.set(lot.productId, roundQty((qty.get(lot.productId) ?? 0) + lot.quantity));
  }
  const products = await tx.product.findMany({
    where: { organizationId, id: { in: [...qty.keys()] } },
    select: { id: true, name: true, unit: true },
    orderBy: { name: 'asc' },
  });
  return products.map((product) => ({
    productId: product.id,
    productName: product.name,
    unit: product.unit,
    quantity: qty.get(product.id) ?? 0,
  }));
}

export async function findProductsByKeywords(
  tx: Db,
  organizationId: string,
  warehouseId: string,
  keywords: string[],
  groupId?: string | null,
) {
  const products = await tx.product.findMany({
    where: {
      organizationId,
      ...(groupId ? { groupId } : {}),
    },
    select: { id: true, name: true },
  });
  const matched = products.filter((product) => matchesKeywords(product.name, keywords));
  if (!matched.length) return [];

  const lots = await tx.stockLot.findMany({
    where: {
      warehouseId,
      productId: { in: matched.map((p) => p.id) },
      quantity: { gt: 0 },
    },
    select: { productId: true },
  });
  const withStock = new Set(lots.map((lot) => lot.productId));
  return matched.filter((product) => withStock.has(product.id));
}

export async function writeoffByKeywords(
  tx: Db,
  params: {
    organizationId: string;
    warehouseId: string;
    keywords: string[];
    groupId?: string | null;
    quantity: number;
    note: string;
    createdById: string;
    productionJobId: string;
    label: string;
  },
) {
  const plan = await planWriteoffByKeywords(tx, params);
  if (!plan.ok) {
    throw new BadRequestException({
      error: plan.have === 0 ? 'material_not_found' : 'insufficient_stock',
      name: params.label,
      need: plan.need,
      have: plan.have,
    });
  }
  for (const line of plan.lines) {
    const result = await createWriteoffFifo(tx, {
      warehouseId: params.warehouseId,
      productId: line.productId,
      quantity: line.quantity,
      note: params.note,
      createdById: params.createdById,
      productionJobId: params.productionJobId,
    });
    if (!result.ok) {
      throw new BadRequestException({
        error: 'insufficient_stock',
        name: params.label,
        need: result.need,
        have: result.have,
      });
    }
  }
}

async function resolveGroupMembers(
  tx: Db,
  organizationId: string,
  groupId: string,
  filterKeywords?: string[],
) {
  const members = await tx.product.findMany({
    where: { organizationId, groupId },
    select: { id: true, name: true, unit: true },
  });
  if (!members.length) return [];
  const keywords = (filterKeywords ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!keywords.length) return members;
  return members.filter((member) => matchesKeywords(member.name, keywords));
}

export async function planWriteoffByGroup(
  tx: Db,
  params: {
    organizationId: string;
    warehouseId: string;
    groupId: string;
    groupName: string;
    quantity: number;
    filterKeywords?: string[];
  },
): Promise<WriteoffPlan> {
  const filtered = await resolveGroupMembers(
    tx,
    params.organizationId,
    params.groupId,
    params.filterKeywords,
  );
  if (!filtered.length) {
    return { ok: false, have: 0, need: roundQty(params.quantity), label: params.groupName };
  }
  const byId = new Map(filtered.map((item) => [item.id, item]));
  const plan = await allocateGroupFifo(
    tx,
    params.warehouseId,
    filtered.map((m) => m.id),
    params.quantity,
  );
  if (!plan.ok) {
    return { ok: false, have: plan.have, need: plan.need, label: params.groupName };
  }
  return {
    ok: true,
    lines: plan.lines.map((line) => {
      const product = byId.get(line.productId)!;
      return {
        productId: line.productId,
        productName: product.name,
        unit: product.unit,
        quantity: line.quantity,
        groupName: params.groupName,
      };
    }),
  };
}

export async function planWriteoffByKeywords(
  tx: Db,
  params: {
    organizationId: string;
    warehouseId: string;
    keywords: string[];
    groupId?: string | null;
    quantity: number;
    label: string;
  },
): Promise<WriteoffPlan> {
  const members = await findProductsByKeywords(
    tx,
    params.organizationId,
    params.warehouseId,
    params.keywords,
    params.groupId,
  );
  if (!members.length) {
    return { ok: false, have: 0, need: roundQty(params.quantity), label: params.label };
  }
  const products = await tx.product.findMany({
    where: { id: { in: members.map((m) => m.id) } },
    select: { id: true, name: true, unit: true },
  });
  const byId = new Map(products.map((item) => [item.id, item]));
  const plan = await allocateGroupFifo(
    tx,
    params.warehouseId,
    members.map((m) => m.id),
    params.quantity,
  );
  if (!plan.ok) {
    return { ok: false, have: plan.have, need: plan.need, label: params.label };
  }
  return {
    ok: true,
    lines: plan.lines.map((line) => {
      const product = byId.get(line.productId)!;
      return {
        productId: line.productId,
        productName: product.name,
        unit: product.unit,
        quantity: line.quantity,
      };
    }),
  };
}

export async function writeoffByGroup(
  tx: Db,
  params: {
    organizationId: string;
    warehouseId: string;
    groupId: string;
    groupName: string;
    quantity: number;
    filterKeywords?: string[];
    note: string;
    createdById: string;
    productionJobId: string;
  },
) {
  const plan = await planWriteoffByGroup(tx, params);
  if (!plan.ok) {
    throw new BadRequestException({
      error: plan.have === 0 ? 'empty_group' : 'insufficient_stock',
      name: params.groupName,
      need: plan.need,
      have: plan.have,
    });
  }
  for (const line of plan.lines) {
    const result = await createWriteoffFifo(tx, {
      warehouseId: params.warehouseId,
      productId: line.productId,
      quantity: line.quantity,
      note: params.note,
      createdById: params.createdById,
      productionJobId: params.productionJobId,
    });
    if (!result.ok) {
      throw new BadRequestException({
        error: 'insufficient_stock',
        name: params.groupName,
        need: result.need,
        have: result.have,
      });
    }
  }
}
