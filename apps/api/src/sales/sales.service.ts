import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DealChannel, DealMessageDirection, DealStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NovofonService, normalizePhone } from '../novofon/novofon.service';
import type { AuthUser } from '../auth/auth-user';
import { DEAL_STATUS_LABEL } from './statuses';
import { CreateDealDto, CreateDealMessageDto, ListDealsQueryDto, SendDocumentDto, SendSmsDto, UpdateDealStatusDto } from './dto';
import { buildInvoiceHtml } from './invoice';

const dealInclude = {
  counterparty: true,
  items: true,
  createdBy: { select: { id: true, name: true } },
  messages: {
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: { id: true, name: true } } },
  },
  documents: {
    orderBy: { createdAt: 'desc' as const },
    select: { id: true, title: true, kind: true, createdAt: true, sentAt: true },
  },
  events: { orderBy: { createdAt: 'desc' as const } },
};

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly novofon: NovofonService,
  ) {}

  list(user: AuthUser, query: ListDealsQueryDto = {}) {
    const search = query.q?.trim();
    const statuses = (query.status ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter((item): item is DealStatus => Object.values(DealStatus).includes(item as DealStatus));
    const due = dateRange(query.dueFrom, query.dueTo);
    const created = dateRange(query.createdFrom, query.createdTo);
    const done: DealStatus[] = [DealStatus.CLOSED, DealStatus.DELIVERED, DealStatus.RETURNED];
    const dueDate: Prisma.DateTimeNullableFilter | undefined = query.overdue
      ? { ...due, lt: startOfToday() }
      : due;
    const statusFilter = query.overdue
      ? statuses.length
        ? { in: statuses.filter((item) => !done.includes(item)) }
        : { notIn: done }
      : statuses.length
        ? { in: statuses }
        : undefined;

    const where: Prisma.DealWhereInput = {
      organizationId: user.organizationId,
      ...(query.counterpartyId ? { counterpartyId: query.counterpartyId } : {}),
      ...(query.createdById ? { createdById: query.createdById } : {}),
      ...(query.productId ? { items: { some: { productId: query.productId } } } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(created ? { createdAt: created } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { counterparty: { name: { contains: search, mode: 'insensitive' } } },
              { counterparty: { legalName: { contains: search, mode: 'insensitive' } } },
              { counterparty: { inn: { contains: search, mode: 'insensitive' } } },
              { counterparty: { email: { contains: search, mode: 'insensitive' } } },
              { counterparty: { phone: { contains: search, mode: 'insensitive' } } },
              { counterparty: { telegram: { contains: search, mode: 'insensitive' } } },
              { counterparty: { contactName: { contains: search, mode: 'insensitive' } } },
              { items: { some: { name: { contains: search, mode: 'insensitive' } } } },
              { items: { some: { product: { sku: { contains: search, mode: 'insensitive' } } } } },
            ],
          }
        : {}),
    };

    return this.prisma.deal.findMany({
      where,
      orderBy: [{ status: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
      include: {
        counterparty: { select: { id: true, name: true, email: true, telegram: true, phone: true } },
        items: true,
      },
    });
  }

  async get(user: AuthUser, id: string) {
    return this.getOwned(user, id);
  }

  async remove(user: AuthUser, id: string) {
    const deal = await this.getOwned(user, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.productionJob.deleteMany({
        where: {
          OR: [{ dealId: deal.id }, { dealItemId: { in: deal.items.map((item) => item.id) } }],
        },
      });
      await tx.deal.delete({ where: { id: deal.id } });
    });
  }

  async create(user: AuthUser, dto: CreateDealDto) {
    if (!dto.items?.length) {
      throw new BadRequestException({ error: 'items_required' });
    }
    const counterparty = await this.prisma.counterparty.findFirst({
      where: { id: dto.counterpartyId, organizationId: user.organizationId },
    });
    if (!counterparty) throw new BadRequestException({ error: 'counterparty_not_found' });

    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: { organizationId: user.organizationId, id: { in: productIds } },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException({ error: 'product_not_found' });
    }
    const byId = new Map(products.map((product) => [product.id, product]));
    const lines = new Map<string, { productId: string; name: string; unit: string; price: number; quantity: number }>();
    for (const item of dto.items) {
      const product = byId.get(item.productId);
      if (!product) throw new BadRequestException({ error: 'product_not_found' });
      if (!product.inCatalog) throw new BadRequestException({ error: 'not_catalog' });
      const current = lines.get(product.id);
      if (current) {
        current.quantity += item.quantity;
      } else {
        lines.set(product.id, {
          productId: product.id,
          name: product.name,
          unit: product.unit,
          price: product.price,
          quantity: item.quantity,
        });
      }
    }

    const last = await this.prisma.deal.findFirst({
      where: { organizationId: user.organizationId, status: DealStatus.NEW },
      orderBy: { position: 'desc' },
    });

    return this.prisma.deal.create({
      data: {
        organizationId: user.organizationId,
        counterpartyId: counterparty.id,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: DealStatus.NEW,
        position: (last?.position ?? 0) + 1000,
        createdById: user.id,
        items: {
          create: [...lines.values()].map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price,
          })),
        },
        events: {
          create: { text: `${user.name} создал сделку` },
        },
      },
      include: dealInclude,
    });
  }

  async updateStatus(user: AuthUser, id: string, dto: UpdateDealStatusDto) {
    const deal = await this.getOwned(user, id);
    if (deal.status === dto.status) return deal;
    return this.prisma.deal.update({
      where: { id: deal.id },
      data: {
        status: dto.status,
        events: {
          create: {
            text: `${user.name} сменил статус: ${DEAL_STATUS_LABEL[deal.status]} → ${DEAL_STATUS_LABEL[dto.status]}`,
          },
        },
      },
      include: dealInclude,
    });
  }

  async addMessage(user: AuthUser, id: string, dto: CreateDealMessageDto) {
    if (dto.channel === DealChannel.PHONE) {
      throw new BadRequestException({ error: 'use_phone_endpoints' });
    }
    const deal = await this.getOwned(user, id);
    this.assertChannel(deal, dto.channel);
    await this.prisma.dealMessage.create({
      data: {
        dealId: deal.id,
        channel: dto.channel,
        direction: DealMessageDirection.OUT,
        body: dto.body.trim(),
        authorId: user.id,
      },
    });
    await this.prisma.dealEvent.create({
      data: { dealId: deal.id, text: `${user.name} отправил сообщение (${labelChannel(dto.channel)})` },
    });
    return this.getOwned(user, id);
  }

  async createInvoice(user: AuthUser, id: string) {
    const deal = await this.getOwned(user, id);
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
    const count = await this.prisma.dealDocument.count({ where: { dealId: deal.id, kind: 'INVOICE' } });
    const number = String(count + 1).padStart(3, '0');
    const title = `Счёт на оплату № ${number}`;
    const html = buildInvoiceHtml({
      number,
      date: new Date(),
      seller: {
        name: org.legalName?.trim() || org.name,
        inn: org.inn,
        kpp: org.kpp,
        ogrn: org.ogrn,
        legalAddress: org.legalAddress,
        bankName: org.bankName,
        bik: org.bik,
        checkingAccount: org.checkingAccount,
        correspondentAccount: org.correspondentAccount,
      },
      buyer: deal.counterparty,
      items: deal.items,
    });
    await this.prisma.dealDocument.create({
      data: { dealId: deal.id, title, kind: 'INVOICE', html },
    });
    await this.prisma.dealEvent.create({
      data: { dealId: deal.id, text: `${user.name} сформировал ${title}` },
    });
    return this.getOwned(user, id);
  }

  async documentFile(user: AuthUser, dealId: string, documentId: string) {
    const deal = await this.getOwned(user, dealId);
    const doc = deal.documents.find((item) => item.id === documentId);
    if (!doc) throw new NotFoundException();
    const full = await this.prisma.dealDocument.findUnique({ where: { id: documentId } });
    if (!full) throw new NotFoundException();
    return full;
  }

  async sendDocument(user: AuthUser, dealId: string, documentId: string, dto: SendDocumentDto) {
    const deal = await this.getOwned(user, dealId);
    this.assertChannel(deal, dto.channel);
    const doc = await this.prisma.dealDocument.findFirst({
      where: { id: documentId, dealId: deal.id },
    });
    if (!doc) throw new NotFoundException();
    await this.prisma.dealDocument.update({
      where: { id: doc.id },
      data: { sentAt: doc.sentAt ?? new Date() },
    });
    await this.prisma.dealMessage.create({
      data: {
        dealId: deal.id,
        channel: dto.channel,
        direction: DealMessageDirection.OUT,
        body: `Документ: ${doc.title}`,
        authorId: user.id,
      },
    });
    await this.prisma.dealEvent.create({
      data: {
        dealId: deal.id,
        text: `${user.name} отправил «${doc.title}» в ${labelChannel(dto.channel)}`,
      },
    });
    return this.getOwned(user, dealId);
  }

  async removeDocument(user: AuthUser, dealId: string, documentId: string) {
    const deal = await this.getOwned(user, dealId);
    const doc = await this.prisma.dealDocument.findFirst({
      where: { id: documentId, dealId: deal.id },
    });
    if (!doc) throw new NotFoundException();
    if (doc.sentAt) {
      throw new BadRequestException({ error: 'already_sent' });
    }
    await this.prisma.dealDocument.delete({ where: { id: doc.id } });
    await this.prisma.dealEvent.create({
      data: { dealId: deal.id, text: `${user.name} удалил «${doc.title}»` },
    });
    return this.getOwned(user, dealId);
  }

  async startCall(user: AuthUser, id: string) {
    const deal = await this.getOwned(user, id);
    const phone = this.requirePhone(deal);
    await this.novofon.startCallback(phone);
    const stub = !this.novofon.isConfigured();
    await this.prisma.dealMessage.create({
      data: {
        dealId: deal.id,
        channel: DealChannel.PHONE,
        direction: DealMessageDirection.OUT,
        body: stub
          ? `Звонок на ${formatPhone(phone)} (Novofon не подключён, записано локально)`
          : `Исходящий звонок на ${formatPhone(phone)}`,
        authorId: user.id,
      },
    });
    await this.prisma.dealEvent.create({
      data: { dealId: deal.id, text: `${user.name} инициировал звонок на ${formatPhone(phone)}` },
    });
    return this.getOwned(user, id);
  }

  async sendSms(user: AuthUser, id: string, dto: SendSmsDto) {
    const deal = await this.getOwned(user, id);
    const phone = this.requirePhone(deal);
    const body = dto.body.trim();
    await this.novofon.sendSms(phone, body);
    const stub = !this.novofon.isConfigured();
    await this.prisma.dealMessage.create({
      data: {
        dealId: deal.id,
        channel: DealChannel.PHONE,
        direction: DealMessageDirection.OUT,
        body: stub ? `SMS на ${formatPhone(phone)}: ${body}` : body,
        authorId: user.id,
      },
    });
    await this.prisma.dealEvent.create({
      data: { dealId: deal.id, text: `${user.name} отправил SMS на ${formatPhone(phone)}` },
    });
    return this.getOwned(user, id);
  }

  private requirePhone(deal: { counterparty: { phone: string | null } }) {
    const phone = deal.counterparty.phone ? normalizePhone(deal.counterparty.phone) : '';
    if (!phone) {
      throw new BadRequestException({ error: 'phone_missing' });
    }
    return phone;
  }

  private assertChannel(
    deal: { counterparty: { telegram: string | null; phone: string | null } },
    channel: DealChannel,
  ) {
    if (channel === DealChannel.TELEGRAM && !deal.counterparty.telegram) {
      throw new BadRequestException({ error: 'telegram_not_connected' });
    }
    if (channel === DealChannel.PHONE && !deal.counterparty.phone) {
      throw new BadRequestException({ error: 'phone_missing' });
    }
  }

  private async getOwned(user: AuthUser, id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, organizationId: user.organizationId },
      include: dealInclude,
    });
    if (!deal) throw new NotFoundException();
    return deal;
  }
}

function labelChannel(channel: DealChannel) {
  if (channel === DealChannel.EMAIL) return 'email';
  if (channel === DealChannel.TELEGRAM) return 'telegram';
  return 'телефон';
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function dateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  const gte = from ? new Date(`${from.slice(0, 10)}T00:00:00`) : undefined;
  const lte = to ? new Date(`${to.slice(0, 10)}T23:59:59.999`) : undefined;
  if (!gte && !lte) return undefined;
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}

function formatPhone(digits: string) {
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
  }
  return `+${digits}`;
}
