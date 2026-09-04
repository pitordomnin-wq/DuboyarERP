import { Prisma, StockMovementType } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

export async function createReceiptWithLot(
  tx: Db,
  data: {
    warehouseId: string;
    productId: string;
    quantity: number;
    note?: string | null;
    createdById: string;
    purchaseId?: string | null;
    productionJobId?: string | null;
    receivedAt?: Date;
  },
) {
  const movement = await tx.stockMovement.create({
    data: {
      warehouseId: data.warehouseId,
      productId: data.productId,
      type: StockMovementType.RECEIPT,
      quantity: data.quantity,
      note: data.note ?? null,
      createdById: data.createdById,
      purchaseId: data.purchaseId ?? null,
      productionJobId: data.productionJobId ?? null,
      createdAt: data.receivedAt,
    },
  });
  await tx.stockLot.create({
    data: {
      warehouseId: data.warehouseId,
      productId: data.productId,
      quantity: data.quantity,
      receivedAt: data.receivedAt ?? movement.createdAt,
      sourceMovementId: movement.id,
    },
  });
  return movement;
}

export async function createWriteoffFifo(
  tx: Db,
  data: {
    warehouseId: string;
    productId: string;
    quantity: number;
    note?: string | null;
    createdById: string;
    purchaseId?: string | null;
    productionJobId?: string | null;
    dealId?: string | null;
  },
) {
  const need = roundQty(data.quantity);
  const lots = await tx.stockLot.findMany({
    where: { warehouseId: data.warehouseId, productId: data.productId, quantity: { gt: 0 } },
    orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
  });
  const available = roundQty(lots.reduce((sum, lot) => sum + lot.quantity, 0));
  if (available + 1e-9 < need) {
    return { ok: false as const, have: available, need };
  }

  const movement = await tx.stockMovement.create({
    data: {
      warehouseId: data.warehouseId,
      productId: data.productId,
      type: StockMovementType.WRITEOFF,
      quantity: need,
      note: data.note ?? null,
      createdById: data.createdById,
      purchaseId: data.purchaseId ?? null,
      productionJobId: data.productionJobId ?? null,
      dealId: data.dealId ?? null,
    },
  });

  let left = need;
  for (const lot of lots) {
    if (left <= 1e-9) break;
    const take = roundQty(Math.min(lot.quantity, left));
    if (take <= 0) continue;
    await tx.stockLot.update({
      where: { id: lot.id },
      data: { quantity: roundQty(lot.quantity - take) },
    });
    await tx.stockMovementAllocation.create({
      data: { movementId: movement.id, lotId: lot.id, quantity: take },
    });
    left = roundQty(left - take);
  }

  return { ok: true as const, movement };
}

/** Reverse stock movements created for a production job stage (by note). */
export async function reverseProductionMovements(
  tx: Db,
  params: { productionJobId: string; note: string },
) {
  const movements = await tx.stockMovement.findMany({
    where: { productionJobId: params.productionJobId, note: params.note },
    include: {
      allocations: true,
      lotsCreated: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  for (const movement of movements) {
    if (movement.type === StockMovementType.WRITEOFF) {
      for (const allocation of movement.allocations) {
        await tx.stockLot.update({
          where: { id: allocation.lotId },
          data: { quantity: { increment: allocation.quantity } },
        });
      }
      await tx.stockMovementAllocation.deleteMany({ where: { movementId: movement.id } });
      await tx.stockMovement.delete({ where: { id: movement.id } });
      continue;
    }

    if (movement.type === StockMovementType.RECEIPT) {
      const lot = movement.lotsCreated[0];
      if (!lot) {
        await tx.stockMovement.delete({ where: { id: movement.id } });
        continue;
      }
      if (roundQty(lot.quantity) + 1e-9 < roundQty(movement.quantity)) {
        throw new Error('receipt_lot_consumed');
      }
      const laterAllocations = await tx.stockMovementAllocation.count({
        where: { lotId: lot.id },
      });
      if (laterAllocations > 0) {
        throw new Error('receipt_lot_consumed');
      }
      await tx.stockLot.delete({ where: { id: lot.id } });
      await tx.stockMovement.delete({ where: { id: movement.id } });
    }
  }
}

/** FIFO across multiple products (group members). Returns per-product writeoff quantities. */
export async function allocateGroupFifo(
  tx: Db,
  warehouseId: string,
  productIds: string[],
  need: number,
): Promise<{ ok: true; lines: { productId: string; quantity: number }[] } | { ok: false; have: number; need: number }> {
  const target = roundQty(need);
  const lots = await tx.stockLot.findMany({
    where: { warehouseId, productId: { in: productIds }, quantity: { gt: 0 } },
    orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
  });
  const available = roundQty(lots.reduce((sum, lot) => sum + lot.quantity, 0));
  if (available + 1e-9 < target) {
    return { ok: false, have: available, need: target };
  }

  const byProduct = new Map<string, number>();
  let left = target;
  for (const lot of lots) {
    if (left <= 1e-9) break;
    const take = roundQty(Math.min(lot.quantity, left));
    if (take <= 0) continue;
    byProduct.set(lot.productId, roundQty((byProduct.get(lot.productId) ?? 0) + take));
    left = roundQty(left - take);
  }

  return {
    ok: true,
    lines: [...byProduct.entries()].map(([productId, quantity]) => ({ productId, quantity })),
  };
}

export function roundQty(value: number) {
  return Math.round(value * 1000) / 1000;
}

export const DEFAULT_CATEGORY_BY_KIND: Record<string, string> = {
  CONSUMABLE: 'Расходники',
  MATERIAL: 'Сырьё',
  SEMI_FINISHED: 'Заготовки',
  FINISHED: 'Готовая продукция',
};

export async function ensureDefaultCategories(tx: Db, organizationId: string) {
  const existing = await tx.warehouseCategory.findMany({ where: { organizationId } });
  if (existing.length > 0) return existing;
  const names = [
    ['Расходники', 0],
    ['Сырьё', 1],
    ['Заготовки', 2],
    ['Готовая продукция', 3],
  ] as const;
  await tx.warehouseCategory.createMany({
    data: names.map(([name, position]) => ({ organizationId, name, position })),
  });
  return tx.warehouseCategory.findMany({ where: { organizationId }, orderBy: { position: 'asc' } });
}

export async function categoryIdForKind(tx: Db, organizationId: string, kind: string) {
  const categories = await ensureDefaultCategories(tx, organizationId);
  const name = DEFAULT_CATEGORY_BY_KIND[kind] ?? 'Сырьё';
  return (categories.find((c) => c.name === name) ?? categories[0]).id;
}
