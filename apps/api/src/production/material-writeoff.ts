import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { allocateGroupFifo, createWriteoffFifo } from '../warehouse/stock-lots';
import { matchesKeywords, parseKeywords } from './production-norms';

type Db = Prisma.TransactionClient;

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
  const members = await findProductsByKeywords(
    tx,
    params.organizationId,
    params.warehouseId,
    params.keywords,
    params.groupId,
  );
  if (!members.length) {
    throw new BadRequestException({ error: 'material_not_found', name: params.label });
  }
  const plan = await allocateGroupFifo(
    tx,
    params.warehouseId,
    members.map((m) => m.id),
    params.quantity,
  );
  if (!plan.ok) {
    throw new BadRequestException({
      error: 'insufficient_stock',
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

export async function writeoffByGroup(
  tx: Db,
  params: {
    organizationId: string;
    warehouseId: string;
    groupId: string;
    groupName: string;
    groupKeywords: unknown;
    quantity: number;
    note: string;
    createdById: string;
    productionJobId: string;
  },
) {
  const members = await tx.product.findMany({
    where: { organizationId: params.organizationId, groupId: params.groupId },
    select: { id: true, name: true },
  });
  const keywords = parseKeywords(params.groupKeywords);
  const filtered =
    keywords.length > 0
      ? members.filter((member) => matchesKeywords(member.name, keywords))
      : members;
  if (!filtered.length) {
    throw new BadRequestException({ error: 'empty_group', name: params.groupName });
  }
  const plan = await allocateGroupFifo(
    tx,
    params.warehouseId,
    filtered.map((m) => m.id),
    params.quantity,
  );
  if (!plan.ok) {
    throw new BadRequestException({
      error: 'insufficient_stock',
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
