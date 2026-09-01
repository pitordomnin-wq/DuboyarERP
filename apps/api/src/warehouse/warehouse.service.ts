import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductKind, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import {
  CreateStockItemDto,
  CreateStockMovementDto,
  CreateWarehouseCategoryDto,
  CreateWarehouseDto,
  ReorderWarehouseCategoriesDto,
  UpdateStockItemDto,
  UpdateWarehouseCategoryDto,
} from './dto';
import {
  categoryIdForKind,
  createReceiptWithLot,
  createWriteoffFifo,
  ensureDefaultCategories,
  roundQty,
} from './stock-lots';

const productCardInclude = {
  category: { select: { id: true, name: true, position: true } },
  group: { select: { id: true, name: true } },
} as const;

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  async listWarehouses(user: AuthUser) {
    let items = await this.prisma.warehouse.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: 'asc' },
    });
    if (items.length === 0) {
      const created = await this.prisma.warehouse.create({
        data: {
          organizationId: user.organizationId,
          name: 'Основной склад',
        },
      });
      items = [created];
    }
    await ensureDefaultCategories(this.prisma, user.organizationId);
    return items;
  }

  async createWarehouse(user: AuthUser, dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({
      data: {
        organizationId: user.organizationId,
        name: dto.name.trim(),
        address: dto.address?.trim() || null,
      },
    });
  }

  async listCategories(user: AuthUser) {
    return ensureDefaultCategories(this.prisma, user.organizationId);
  }

  async createCategory(user: AuthUser, dto: CreateWarehouseCategoryDto) {
    await ensureDefaultCategories(this.prisma, user.organizationId);
    const max = await this.prisma.warehouseCategory.aggregate({
      where: { organizationId: user.organizationId },
      _max: { position: true },
    });
    try {
      return await this.prisma.warehouseCategory.create({
        data: {
          organizationId: user.organizationId,
          name: dto.name.trim(),
          position: (max._max.position ?? -1) + 1,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ error: 'category_name_taken' });
      }
      throw error;
    }
  }

  async updateCategory(user: AuthUser, id: string, dto: UpdateWarehouseCategoryDto) {
    await this.ownedCategory(user, id);
    try {
      return await this.prisma.warehouseCategory.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.position !== undefined ? { position: dto.position } : {}),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ error: 'category_name_taken' });
      }
      throw error;
    }
  }

  async reorderCategories(user: AuthUser, dto: ReorderWarehouseCategoriesDto) {
    const existing = await ensureDefaultCategories(this.prisma, user.organizationId);
    if (dto.ids.length !== existing.length || new Set(dto.ids).size !== dto.ids.length) {
      throw new BadRequestException({ error: 'invalid_order' });
    }
    for (const id of dto.ids) {
      if (!existing.some((item) => item.id === id)) {
        throw new BadRequestException({ error: 'invalid_order' });
      }
    }
    await this.prisma.$transaction(
      dto.ids.map((id, position) =>
        this.prisma.warehouseCategory.update({ where: { id }, data: { position } }),
      ),
    );
    return this.listCategories(user);
  }

  async deleteCategory(user: AuthUser, id: string) {
    const category = await this.ownedCategory(user, id);
    const count = await this.prisma.product.count({ where: { categoryId: id } });
    if (count > 0) throw new BadRequestException({ error: 'category_in_use', count });
    const total = await this.prisma.warehouseCategory.count({ where: { organizationId: user.organizationId } });
    if (total <= 1) throw new BadRequestException({ error: 'last_category' });
    await this.prisma.warehouseCategory.delete({ where: { id: category.id } });
  }

  async stock(user: AuthUser, warehouseId: string, categoryId?: string, query?: string) {
    const warehouse = await this.getOwnedWarehouse(user, warehouseId);
    const search = query?.trim();
    const products = await this.prisma.product.findMany({
      where: {
        organizationId: user.organizationId,
        ...(categoryId ? { categoryId } : {}),
        AND: [
          ...(search
            ? [
                {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { sku: { contains: search, mode: 'insensitive' as const } },
                  ],
                },
              ]
            : []),
          {
            OR: [
              { inCatalog: true },
              { movements: { some: { warehouseId: warehouse.id } } },
              {
                inCatalog: false,
                movements: { none: {} },
                purchaseItems: { none: {} },
                stageInputs: { none: {} },
                productionTypes: { none: {} },
              },
            ],
          },
        ],
      },
      orderBy: { name: 'asc' },
      include: productCardInclude,
    });
    if (products.length === 0) return [];
    const sums = await this.prisma.stockMovement.groupBy({
      by: ['productId', 'type'],
      where: { warehouseId: warehouse.id, productId: { in: products.map((item) => item.id) } },
      _sum: { quantity: true },
    });
    const qty = new Map<string, number>();
    for (const row of sums) {
      const signed = row.type === StockMovementType.RECEIPT ? row._sum.quantity ?? 0 : -(row._sum.quantity ?? 0);
      qty.set(row.productId, (qty.get(row.productId) ?? 0) + signed);
    }
    return products.map((product) => ({
      ...product,
      quantity: qty.get(product.id) ?? 0,
    }));
  }

  async item(user: AuthUser, warehouseId: string, productId: string) {
    const warehouse = await this.getOwnedWarehouse(user, warehouseId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: user.organizationId },
      include: {
        ...productCardInclude,
        attributes: { orderBy: { position: 'asc' }, select: { id: true, name: true, value: true } },
      },
    });
    if (!product) throw new NotFoundException();
    const [movements, sums] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: { warehouseId: warehouse.id, productId: product.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { createdBy: { select: { id: true, name: true } } },
      }),
      this.prisma.stockMovement.groupBy({
        by: ['type'],
        where: { warehouseId: warehouse.id, productId: product.id },
        _sum: { quantity: true },
      }),
    ]);
    let receipts = 0;
    let writeoffs = 0;
    for (const row of sums) {
      const qty = roundQty(row._sum.quantity ?? 0);
      if (row.type === StockMovementType.RECEIPT) receipts = qty;
      else writeoffs = qty;
    }
    return {
      warehouse: { id: warehouse.id, name: warehouse.name, address: warehouse.address },
      product,
      quantity: roundQty(receipts - writeoffs),
      stats: { receipts, writeoffs },
      movements,
    };
  }

  async removeItem(user: AuthUser, warehouseId: string, productId: string) {
    const warehouse = await this.getOwnedWarehouse(user, warehouseId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: user.organizationId },
    });
    if (!product) throw new NotFoundException();

    const quantity = roundQty(await this.balance(warehouse.id, product.id));
    if (quantity !== 0) throw new BadRequestException({ error: 'has_stock' });

    await this.prisma.$transaction(async (tx) => {
      await tx.stockLot.deleteMany({ where: { warehouseId: warehouse.id, productId: product.id } });
      await tx.stockMovement.deleteMany({ where: { warehouseId: warehouse.id, productId: product.id } });
    });

    if (product.inCatalog) return;
    const leftover = await this.prisma.stockMovement.count({ where: { productId: product.id } });
    if (leftover > 0) return;

    const [typeJobs, inputJobs, purchases] = await Promise.all([
      this.prisma.productionJob.count({ where: { type: { productId: product.id } } }),
      this.prisma.productionJob.count({
        where: { stage: { inputs: { some: { productId: product.id } } } },
      }),
      this.prisma.purchaseItem.count({ where: { productId: product.id } }),
    ]);
    if (typeJobs > 0 || inputJobs > 0 || purchases > 0) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.productionStageInput.deleteMany({ where: { productId: product.id } });
        await tx.productionType.deleteMany({ where: { productId: product.id } });
        await tx.stockLot.deleteMany({ where: { productId: product.id } });
        await tx.product.delete({ where: { id: product.id } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') return;
      throw error;
    }
  }

  async updateItem(user: AuthUser, warehouseId: string, productId: string, dto: UpdateStockItemDto) {
    await this.getOwnedWarehouse(user, warehouseId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: user.organizationId },
    });
    if (!product) throw new NotFoundException();

    if (dto.categoryId) await this.ownedCategory(user, dto.categoryId);
    const groupId = await this.resolveGroupId(user, dto.groupId, dto.groupName, dto.groupId === null);

    try {
      return await this.prisma.product.update({
        where: { id: product.id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.sku !== undefined ? { sku: dto.sku.trim() } : {}),
          ...(dto.unit !== undefined ? { unit: dto.unit.trim() || 'шт' } : {}),
          ...(dto.price !== undefined ? { price: dto.price } : {}),
          ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(groupId !== undefined ? { groupId } : {}),
        },
        include: productCardInclude,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ error: 'sku_taken' });
      }
      throw error;
    }
  }

  async createItem(user: AuthUser, warehouseId: string, dto: CreateStockItemDto) {
    await this.getOwnedWarehouse(user, warehouseId);
    await this.ownedCategory(user, dto.categoryId);
    const groupId = await this.resolveGroupId(user, dto.groupId, dto.groupName);
    try {
      return await this.prisma.product.create({
        data: {
          organizationId: user.organizationId,
          kind: dto.kind,
          categoryId: dto.categoryId,
          groupId: groupId ?? null,
          name: dto.name.trim(),
          sku: dto.sku.trim(),
          unit: dto.unit?.trim() || 'шт',
          price: dto.price ?? 0,
        },
        include: productCardInclude,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ error: 'sku_taken' });
      }
      throw error;
    }
  }

  async move(user: AuthUser, warehouseId: string, dto: CreateStockMovementDto) {
    const warehouse = await this.getOwnedWarehouse(user, warehouseId);
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, organizationId: user.organizationId },
    });
    if (!product) throw new BadRequestException({ error: 'product_not_found' });

    return this.prisma.$transaction(async (tx) => {
      if (dto.type === StockMovementType.RECEIPT) {
        const movement = await createReceiptWithLot(tx, {
          warehouseId: warehouse.id,
          productId: product.id,
          quantity: dto.quantity,
          note: dto.note?.trim() || null,
          createdById: user.id,
        });
        return tx.stockMovement.findUniqueOrThrow({
          where: { id: movement.id },
          include: { createdBy: { select: { id: true, name: true } } },
        });
      }

      const result = await createWriteoffFifo(tx, {
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: dto.quantity,
        note: dto.note?.trim() || null,
        createdById: user.id,
      });
      if (!result.ok) {
        throw new BadRequestException({ error: 'insufficient_stock', have: result.have, need: result.need });
      }
      return tx.stockMovement.findUniqueOrThrow({
        where: { id: result.movement.id },
        include: { createdBy: { select: { id: true, name: true } } },
      });
    });
  }

  async listGroups(user: AuthUser) {
    return this.prisma.productGroup.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async createGroup(user: AuthUser, name: string, keywords: string[] = []) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException({ error: 'empty_name' });
    const existing = await this.prisma.productGroup.findUnique({
      where: { organizationId_name: { organizationId: user.organizationId, name: trimmed } },
      include: { _count: { select: { products: true } } },
    });
    if (existing) return existing;
    return this.prisma.productGroup.create({
      data: { organizationId: user.organizationId, name: trimmed, keywords },
      include: { _count: { select: { products: true } } },
    });
  }

  async updateGroup(user: AuthUser, id: string, data: { name?: string; keywords?: string[] }) {
    const group = await this.prisma.productGroup.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!group) throw new NotFoundException();
    return this.prisma.productGroup.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.keywords !== undefined ? { keywords: data.keywords } : {}),
      },
      include: { _count: { select: { products: true } } },
    });
  }

  private async resolveGroupId(
    user: AuthUser,
    groupId?: string | null,
    groupName?: string,
    clear = false,
  ): Promise<string | null | undefined> {
    if (clear) return null;
    if (groupName?.trim()) {
      const group = await this.createGroup(user, groupName);
      return group.id;
    }
    if (groupId === undefined) return undefined;
    if (!groupId) return null;
    const group = await this.prisma.productGroup.findFirst({
      where: { id: groupId, organizationId: user.organizationId },
    });
    if (!group) throw new BadRequestException({ error: 'group_not_found' });
    return group.id;
  }

  private async balance(warehouseId: string, productId: string) {
    const rows = await this.prisma.stockMovement.groupBy({
      by: ['type'],
      where: { warehouseId, productId },
      _sum: { quantity: true },
    });
    return rows.reduce((sum, row) => {
      const qty = row._sum.quantity ?? 0;
      return sum + (row.type === StockMovementType.RECEIPT ? qty : -qty);
    }, 0);
  }

  private async getOwnedWarehouse(user: AuthUser, id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!warehouse) throw new NotFoundException();
    return warehouse;
  }

  private async ownedCategory(user: AuthUser, id: string) {
    const item = await this.prisma.warehouseCategory.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!item) throw new NotFoundException();
    return item;
  }
}

export { categoryIdForKind };
