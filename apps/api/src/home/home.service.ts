import { Injectable } from '@nestjs/common';
import {
  DealStatus,
  MailFolder,
  ProductionJobStatus,
  ProductionStageStatus,
  PurchaseStatus,
  StockMovementType,
  TaskBoard,
  TaskStatus,
} from '@prisma/client';
import type { PageKey } from '../access/pages';
import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { SalesPipelineService } from '../sales/sales-pipeline.service';
import { DEAL_STATUSES, defaultDealPipelineColumns } from '../sales/statuses';

const REVENUE_STATUSES: DealStatus[] = [
  DealStatus.PAID,
  DealStatus.TO_PRODUCTION,
  DealStatus.SHIPPED_TO_WAREHOUSE,
  DealStatus.TO_DELIVERY,
  DealStatus.DELIVERED,
  DealStatus.CLOSED,
];

const PIPELINE_DONE: DealStatus[] = [DealStatus.CLOSED, DealStatus.DELIVERED, DealStatus.RETURNED];

const TASK_LABEL: Record<TaskStatus, string> = {
  NEW: 'Новые',
  APPROVAL: 'На согласовании',
  IN_PROGRESS: 'В работе',
  REVIEW: 'На проверке',
  DONE: 'Выполнено',
};

const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export type ChartRange = 'week' | 'month' | 'year' | 'all';

export function parseChartRange(value?: string): ChartRange {
  if (value === 'week' || value === 'month' || value === 'year' || value === 'all') return value;
  return 'year';
}

@Injectable()
export class HomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: SalesPipelineService,
  ) {}

  async summary(user: AuthUser, range: ChartRange = 'year') {
    const orgId = user.organizationId;
    const can = (page: PageKey) => user.pages.includes(page);
    const monthStart = startOfMonthMoscow();
    const todayStart = startOfTodayMoscow();

    const [deals, purchases, taskRows, personalOpen, jobs, stock, mailUnread, productCount, counterpartyCount] =
      await Promise.all([
        can('sales')
          ? this.prisma.deal.findMany({
              where: { organizationId: orgId },
              select: {
                status: true,
                dueDate: true,
                updatedAt: true,
                items: { select: { quantity: true, price: true } },
              },
            })
          : Promise.resolve(null),
        can('purchases')
          ? this.prisma.purchase.findMany({
              where: { organizationId: orgId },
              select: {
                status: true,
                purchasedAt: true,
                items: { select: { quantity: true, price: true } },
              },
            })
          : Promise.resolve(null),
        can('tasks')
          ? this.prisma.task.groupBy({
              by: ['status'],
              where: { organizationId: orgId, board: TaskBoard.ORGANIZATION },
              _count: { _all: true },
            })
          : Promise.resolve(null),
        can('tasks')
          ? this.prisma.task.count({
              where: {
                organizationId: orgId,
                board: TaskBoard.PERSONAL,
                ownerId: user.id,
                status: { not: TaskStatus.DONE },
              },
            })
          : Promise.resolve(null),
        can('production')
          ? this.prisma.productionJob.groupBy({
              by: ['status', 'stageStatus'],
              where: { organizationId: orgId },
              _count: { _all: true },
            })
          : Promise.resolve(null),
        can('warehouse') ? this.stockSnapshot(orgId) : Promise.resolve(null),
        can('mail')
          ? this.prisma.mailMessage.count({
              where: { userId: user.id, folder: MailFolder.INBOX, readAt: null },
            })
          : Promise.resolve(null),
        can('products')
          ? this.prisma.product.count({ where: { organizationId: orgId } })
          : Promise.resolve(null),
        can('counterparties')
          ? this.prisma.counterparty.count({ where: { organizationId: orgId } })
          : Promise.resolve(null),
      ]);

    const buckets = chartBuckets(range, deals, purchases);
    const chartMap = new Map(buckets.map((item) => [item.key, { revenue: 0, expenses: 0 }]));

    let pipelineCount = 0;
    let pipelineValue = 0;
    let overdueDeals = 0;
    let revenueMonth = 0;
    const byStatus = new Map<DealStatus, { count: number; value: number }>();
    for (const status of DEAL_STATUSES) byStatus.set(status, { count: 0, value: 0 });

    if (deals) {
      for (const deal of deals) {
        const value = lineTotal(deal.items);
        const bucket = byStatus.get(deal.status);
        if (bucket) {
          bucket.count += 1;
          bucket.value += value;
        }
        if (!PIPELINE_DONE.includes(deal.status)) {
          pipelineCount += 1;
          pipelineValue += value;
        }
        if (deal.dueDate && deal.dueDate < todayStart && !PIPELINE_DONE.includes(deal.status)) {
          overdueDeals += 1;
        }
        if (REVENUE_STATUSES.includes(deal.status)) {
          if (deal.updatedAt >= monthStart) revenueMonth += value;
          const row = chartMap.get(chartKeyFromDate(deal.updatedAt, range));
          if (row) row.revenue += value;
        }
      }
    }

    let drafts = 0;
    let postedMonth = 0;
    let postedMonthValue = 0;
    let expensesMonth = 0;
    if (purchases) {
      for (const purchase of purchases) {
        const value = lineTotal(purchase.items);
        if (purchase.status === PurchaseStatus.DRAFT) drafts += 1;
        if (purchase.status === PurchaseStatus.POSTED) {
          if (purchase.purchasedAt >= monthStart) {
            postedMonth += 1;
            postedMonthValue += value;
            expensesMonth += value;
          }
          const row = chartMap.get(chartKeyFromDate(purchase.purchasedAt, range));
          if (row) row.expenses += value;
        }
      }
    }

    const series = buckets.map((item) => {
      const row = chartMap.get(item.key) ?? { revenue: 0, expenses: 0 };
      return {
        key: item.key,
        label: item.label,
        revenue: roundMoney(row.revenue),
        expenses: roundMoney(row.expenses),
        profit: roundMoney(row.revenue - row.expenses),
      };
    });

    const taskByStatus = Object.values(TaskStatus).map((status) => ({
      status,
      label: TASK_LABEL[status],
      count: taskRows?.find((row) => row.status === status)?._count._all ?? 0,
    }));
    const openTasks = taskByStatus.filter((item) => item.status !== TaskStatus.DONE).reduce((sum, item) => sum + item.count, 0);
    const reviewTasks = taskByStatus.find((item) => item.status === TaskStatus.REVIEW)?.count ?? 0;

    let activeJobs = 0;
    let toStart = 0;
    let inProgress = 0;
    let doneJobs = 0;
    if (jobs) {
      for (const row of jobs) {
        if (row.status === ProductionJobStatus.DONE) doneJobs += row._count._all;
        else {
          activeJobs += row._count._all;
          if (row.stageStatus === ProductionStageStatus.TO_START) toStart += row._count._all;
          else inProgress += row._count._all;
        }
      }
    }

    const attention: {
      id: string;
      kind: string;
      title: string;
      hint: string;
      to: string;
      count: number;
    }[] = [];
    if (deals && overdueDeals > 0) {
      attention.push({
        id: 'overdue-deals',
        kind: 'sales',
        title: 'Просроченные сделки',
        hint: 'Срок вышел, сделка ещё в работе',
        to: '/sales',
        count: overdueDeals,
      });
    }
    if (taskRows && reviewTasks > 0) {
      attention.push({
        id: 'tasks-review',
        kind: 'tasks',
        title: 'Задачи на проверке',
        hint: 'Ждут решения на доске организации',
        to: '/tasks',
        count: reviewTasks,
      });
    }
    if (mailUnread && mailUnread > 0) {
      attention.push({
        id: 'unread-mail',
        kind: 'mail',
        title: 'Непрочитанные письма',
        hint: 'Входящие, которые ещё не открывали',
        to: '/mail',
        count: mailUnread,
      });
    }
    if (purchases && drafts > 0) {
      attention.push({
        id: 'purchase-drafts',
        kind: 'purchases',
        title: 'Черновики закупок',
        hint: 'Ещё не проведены на склад',
        to: '/purchases',
        count: drafts,
      });
    }
    if (jobs && toStart > 0) {
      attention.push({
        id: 'production-start',
        kind: 'production',
        title: 'Производство к запуску',
        hint: 'Заказы, которые ещё не начали',
        to: '/production',
        count: toStart,
      });
    }

    return {
      organizationName: user.organization.name,
      kpis: {
        pipelineCount: deals ? pipelineCount : null,
        pipelineValue: deals ? roundMoney(pipelineValue) : null,
        revenueMonth: deals ? roundMoney(revenueMonth) : null,
        expensesMonth: purchases ? roundMoney(expensesMonth) : null,
        profitMonth: deals && purchases ? roundMoney(revenueMonth - expensesMonth) : null,
        openTasks: taskRows ? openTasks : null,
        personalOpen: personalOpen,
        activeJobs: jobs ? activeJobs : null,
        unreadMail: mailUnread,
        stockValue: stock ? stock.stockValue : null,
      },
      months: deals || purchases ? series : null,
      pipeline: deals
        ? await this.buildPipeline(orgId, byStatus)
        : null,
      tasks: taskRows
        ? {
            byStatus: taskByStatus,
            open: openTasks,
            review: reviewTasks,
            personalOpen: personalOpen ?? 0,
          }
        : null,
      production: jobs ? { active: activeJobs, toStart, inProgress, done: doneJobs } : null,
      warehouse: stock,
      purchases: purchases
        ? { drafts, postedMonth, postedMonthValue: roundMoney(postedMonthValue) }
        : null,
      catalog: {
        products: productCount,
        counterparties: counterpartyCount,
      },
      attention,
    };
  }

  private async buildPipeline(
    organizationId: string,
    byStatus: Map<DealStatus, { count: number; value: number }>,
  ) {
    const columns = await this.pipeline.listForOrg(organizationId);
    const order = columns.length ? columns : defaultDealPipelineColumns();

    return order.map((column) => {
      const row = byStatus.get(column.status) ?? { count: 0, value: 0 };
      return {
        status: column.status,
        label: column.label,
        color: column.color,
        count: row.count,
        value: roundMoney(row.value),
      };
    });
  }

  private async stockSnapshot(organizationId: string) {
    const [sums, products, warehouses] = await Promise.all([
      this.prisma.stockMovement.groupBy({
        by: ['productId', 'type'],
        where: { warehouse: { organizationId } },
        _sum: { quantity: true },
      }),
      this.prisma.product.findMany({
        where: { organizationId },
        select: { id: true, price: true },
      }),
      this.prisma.warehouse.count({ where: { organizationId } }),
    ]);
    const qty = new Map<string, number>();
    for (const row of sums) {
      const signed = row.type === StockMovementType.RECEIPT ? (row._sum.quantity ?? 0) : -(row._sum.quantity ?? 0);
      qty.set(row.productId, (qty.get(row.productId) ?? 0) + signed);
    }
    const price = new Map(products.map((item) => [item.id, item.price]));
    let value = 0;
    let skuInStock = 0;
    for (const [productId, quantity] of qty) {
      if (quantity <= 0) continue;
      skuInStock += 1;
      value += quantity * (price.get(productId) ?? 0);
    }
    return {
      stockValue: roundMoney(value),
      skuInStock,
      warehouses,
    };
  }
}

function lineTotal(items: { quantity: number; price: number }[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.price, 0);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function moscowParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function monthKeyFromDate(date: Date) {
  const { year, month } = moscowParts(date);
  return monthKey(year, month);
}

function dayKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dayKeyFromDate(date: Date) {
  const { year, month, day } = moscowParts(date);
  return dayKey(year, month, day);
}

function chartKeyFromDate(date: Date, range: ChartRange) {
  return range === 'week' || range === 'month' ? dayKeyFromDate(date) : monthKeyFromDate(date);
}

function addCalendarDays(parts: { year: number; month: number; day: number }, delta: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + delta));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function weekdayLabel(parts: { year: number; month: number; day: number }) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return WEEKDAY_SHORT[date.getUTCDay()] ?? '';
}

function chartBuckets(
  range: ChartRange,
  deals: { updatedAt: Date }[] | null,
  purchases: { purchasedAt: Date }[] | null,
) {
  const now = moscowParts(new Date());
  if (range === 'week' || range === 'month') {
    const days = range === 'week' ? 7 : 30;
    const out: { key: string; label: string }[] = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const parts = addCalendarDays(now, -i);
      out.push({
        key: dayKey(parts.year, parts.month, parts.day),
        label: range === 'week' ? weekdayLabel(parts) : `${parts.day} ${MONTH_SHORT[parts.month - 1]}`,
      });
    }
    return out;
  }

  if (range === 'year') {
    const out: { key: string; label: string }[] = [];
    for (let i = 11; i >= 0; i -= 1) {
      const date = new Date(Date.UTC(now.year, now.month - 1 - i, 1));
      const y = date.getUTCFullYear();
      const m = date.getUTCMonth() + 1;
      out.push({ key: monthKey(y, m), label: MONTH_SHORT[m - 1] ?? '' });
    }
    return out;
  }

  let earliest = { year: now.year, month: now.month };
  const consider = (date: Date) => {
    const parts = moscowParts(date);
    if (parts.year < earliest.year || (parts.year === earliest.year && parts.month < earliest.month)) {
      earliest = { year: parts.year, month: parts.month };
    }
  };
  for (const deal of deals ?? []) consider(deal.updatedAt);
  for (const purchase of purchases ?? []) consider(purchase.purchasedAt);

  const out: { key: string; label: string }[] = [];
  let y = earliest.year;
  let m = earliest.month;
  const spanYears = y !== now.year;
  while (y < now.year || (y === now.year && m <= now.month)) {
    out.push({
      key: monthKey(y, m),
      label: spanYears ? `${MONTH_SHORT[m - 1]} ${String(y).slice(2)}` : (MONTH_SHORT[m - 1] ?? ''),
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out.length ? out : [{ key: monthKey(now.year, now.month), label: MONTH_SHORT[now.month - 1] ?? '' }];
}

function startOfMonthMoscow() {
  const { year, month } = moscowParts(new Date());
  return new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+03:00`);
}

function startOfTodayMoscow() {
  const { year, month, day } = moscowParts(new Date());
  return new Date(
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+03:00`,
  );
}
