import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductKind, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { CreateStockItemDto, CreateStockMovementDto, CreateWarehouseDto, UpdateStockItemDto } from './dto';

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

  async stock(user: AuthUser, warehouseId: string, kind?: ProductKind, query?: string) {
    const warehouse = await this.getOwnedWarehouse(user, warehouseId);
    const search = query?.trim();
    const products = await this.prisma.product.findMany({
      where: {
        organizationId: user.organizationId,
        ...(kind ? { kind } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
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
    });
    if (!product) throw new NotFoundException();
    const movements = await this.prisma.stockMovement.findMany({
      where: { warehouseId: warehouse.id, productId: product.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { createdBy: { select: { id: true, name: true } } },
    });
    const quantity = movements.reduce(
      (sum, row) => sum + (row.type === StockMovementType.RECEIPT ? row.quantity : -row.quantity),
      0,
    );
    return { product, quantity, movements };
  }

  async updateItem(user: AuthUser, warehouseId: string, productId: string, dto: UpdateStockItemDto) {
    await this.getOwnedWarehouse(user, warehouseId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: user.organizationId },
    });
    if (!product) throw new NotFoundException();
    try {
      return await this.prisma.product.update({
        where: { id: product.id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.sku !== undefined ? { sku: dto.sku.trim() } : {}),
          ...(dto.unit !== undefined ? { unit: dto.unit.trim() || 'шт' } : {}),
        },
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
    try {
      return await this.prisma.product.create({
        data: {
          organizationId: user.organizationId,
          kind: dto.kind,
          name: dto.name.trim(),
          sku: dto.sku.trim(),
          unit: dto.unit?.trim() || 'шт',
          price: dto.price ?? 0,
        },
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

    if (dto.type === StockMovementType.WRITEOFF) {
      const balance = await this.balance(warehouse.id, product.id);
      if (balance < dto.quantity) {
        throw new BadRequestException({ error: 'insufficient_stock' });
      }
    }

    return this.prisma.stockMovement.create({
      data: {
        warehouseId: warehouse.id,
        productId: product.id,
        type: dto.type,
        quantity: dto.quantity,
        note: dto.note?.trim() || null,
        createdById: user.id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });
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
}
