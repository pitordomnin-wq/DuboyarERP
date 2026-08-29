import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductKind, Prisma, PurchaseStatus, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { CreatePurchaseDocumentDto, CreatePurchaseDto } from './dto';
import { buildInvoiceHtml } from '../sales/invoice';

const listInclude = {
  counterparty: { select: { id: true, name: true } },
  warehouse: { select: { id: true, name: true } },
  items: true,
} as const;

const cardInclude = {
  counterparty: { select: { id: true, name: true, inn: true } },
  warehouse: { select: { id: true, name: true, address: true } },
  items: true,
  documents: { orderBy: { createdAt: 'desc' as const } },
  createdBy: { select: { id: true, name: true } },
};

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser, query?: string) {
    const search = query?.trim();
    const items = await this.prisma.purchase.findMany({
      where: {
        organizationId: user.organizationId,
        ...(search
          ? {
              OR: [
                { number: { contains: search, mode: 'insensitive' } },
                { title: { contains: search, mode: 'insensitive' } },
                { counterparty: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: { purchasedAt: 'desc' },
      include: listInclude,
    });
    return items.map((item) => this.toListRow(item));
  }

  async get(user: AuthUser, id: string) {
    return this.toCard(await this.getOwned(user, id));
  }

  async create(user: AuthUser, dto: CreatePurchaseDto) {
    const counterparty = await this.prisma.counterparty.findFirst({
      where: { id: dto.counterpartyId, organizationId: user.organizationId },
    });
    if (!counterparty) throw new BadRequestException({ error: 'counterparty_not_found' });

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, organizationId: user.organizationId },
    });
    if (!warehouse) throw new BadRequestException({ error: 'warehouse_not_found' });

    const lines = await this.resolveLines(user.organizationId, dto.items);
    const created = await this.prisma.purchase.create({
      data: {
        organizationId: user.organizationId,
        number: await this.nextNumber(user.organizationId),
        title: dto.title.trim(),
        counterpartyId: counterparty.id,
        warehouseId: warehouse.id,
        purchasedAt: new Date(/^\d{4}-\d{2}-\d{2}$/.test(dto.purchasedAt) ? `${dto.purchasedAt}T12:00:00` : dto.purchasedAt),
        note: dto.note?.trim() || null,
        createdById: user.id,
        items: { create: lines },
      },
      include: listInclude,
    });
    return this.toListRow(created);
  }

  async post(user: AuthUser, id: string) {
    const purchase = await this.getOwned(user, id);
    if (purchase.status === PurchaseStatus.POSTED) {
      throw new BadRequestException({ error: 'already_posted' });
    }
    if (purchase.items.length === 0) {
      throw new BadRequestException({ error: 'items_required' });
    }

    const posted = await this.prisma.$transaction(async (tx) => {
      await tx.stockMovement.createMany({
        data: purchase.items.map((item) => ({
          warehouseId: purchase.warehouseId,
          productId: item.productId,
          type: StockMovementType.RECEIPT,
          quantity: item.quantity,
          note: `Закупка ${purchase.number}`,
          purchaseId: purchase.id,
          createdById: user.id,
        })),
      });
      return tx.purchase.update({
        where: { id: purchase.id },
        data: { status: PurchaseStatus.POSTED },
        include: cardInclude,
      });
    });
    return this.toCard(posted);
  }

  async addDocument(user: AuthUser, id: string, dto: CreatePurchaseDocumentDto) {
    await this.getOwned(user, id);
    const document = await this.prisma.purchaseDocument.create({
      data: {
        purchaseId: id,
        title: dto.title.trim(),
        number: dto.number?.trim() || null,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
        note: dto.note?.trim() || null,
      },
    });
    return document;
  }

  async documentFile(user: AuthUser, purchaseId: string, documentId: string) {
    const purchase = await this.getOwned(user, purchaseId);
    const document = purchase.documents.find((item) => item.id === documentId);
    if (!document) throw new NotFoundException();
    const [org, counterparty] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } }),
      this.prisma.counterparty.findFirst({
        where: { id: purchase.counterpartyId, organizationId: user.organizationId },
      }),
    ]);
    if (!counterparty) throw new NotFoundException();
    return buildInvoiceHtml({
      number: document.number || purchase.number,
      date: document.issuedAt ?? purchase.purchasedAt,
      seller: {
        name: counterparty.legalName,
        inn: counterparty.inn,
        kpp: counterparty.kpp,
        ogrn: counterparty.ogrn,
        legalAddress: counterparty.legalAddress,
        bankName: counterparty.bankName,
        bik: counterparty.bik,
        checkingAccount: counterparty.checkingAccount,
        correspondentAccount: counterparty.correspondentAccount,
      },
      buyer: {
        legalName: org.name,
        inn: org.inn ?? '',
        kpp: org.kpp,
        legalAddress: org.legalAddress ?? '',
      },
      items: purchase.items,
    });
  }

  async removeDocument(user: AuthUser, purchaseId: string, documentId: string) {
    const purchase = await this.getOwned(user, purchaseId);
    const document = purchase.documents.find((item) => item.id === documentId);
    if (!document) throw new NotFoundException();
    await this.prisma.purchaseDocument.delete({ where: { id: documentId } });
  }

  async remove(user: AuthUser, id: string) {
    const purchase = await this.getOwned(user, id);
    if (purchase.status === PurchaseStatus.POSTED) {
      throw new BadRequestException({ error: 'posted' });
    }
    await this.prisma.purchase.delete({ where: { id } });
  }

  private async resolveLines(organizationId: string, items: CreatePurchaseDto['items']) {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: { organizationId, id: { in: productIds } },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException({ error: 'product_not_found' });
    }
    const byId = new Map(products.map((product) => [product.id, product]));
    const lines = new Map<string, { productId: string; name: string; unit: string; price: number; quantity: number }>();
    for (const item of items) {
      const product = byId.get(item.productId);
      if (!product) throw new BadRequestException({ error: 'product_not_found' });
      if (product.kind === ProductKind.FINISHED) throw new BadRequestException({ error: 'not_supply' });
      const current = lines.get(product.id);
      if (current) {
        current.quantity += item.quantity;
        current.price = item.price;
      } else {
        lines.set(product.id, {
          productId: product.id,
          name: product.name,
          unit: product.unit,
          price: item.price,
          quantity: item.quantity,
        });
      }
    }
    return [...lines.values()];
  }

  private async nextNumber(organizationId: string) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.prisma.purchase.count({ where: { organizationId } });
      const number = `ЗК-${String(count + 1 + attempt).padStart(4, '0')}`;
      const taken = await this.prisma.purchase.findUnique({
        where: { organizationId_number: { organizationId, number } },
      });
      if (!taken) return number;
    }
    throw new BadRequestException({ error: 'number_failed' });
  }

  private async getOwned(user: AuthUser, id: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, organizationId: user.organizationId },
      include: cardInclude,
    });
    if (!purchase) throw new NotFoundException();
    return purchase;
  }

  private toListRow(item: Prisma.PurchaseGetPayload<{ include: typeof listInclude }>) {
    return {
      id: item.id,
      number: item.number,
      title: item.title,
      status: item.status,
      purchasedAt: item.purchasedAt,
      total: item.items.reduce((sum, line) => sum + line.quantity * line.price, 0),
      counterparty: item.counterparty,
      warehouse: item.warehouse,
    };
  }

  private toCard(item: Prisma.PurchaseGetPayload<{ include: typeof cardInclude }>) {
    return {
      ...this.toListRow(item),
      note: item.note,
      createdBy: item.createdBy,
      createdAt: item.createdAt,
      items: item.items,
      documents: item.documents,
      warehouse: item.warehouse,
      counterparty: item.counterparty,
    };
  }
}
