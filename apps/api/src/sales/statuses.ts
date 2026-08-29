import { DealStatus } from '@prisma/client';

export const DEAL_STATUSES: DealStatus[] = [
  DealStatus.NEW,
  DealStatus.IN_PROGRESS,
  DealStatus.INVOICE_ISSUED,
  DealStatus.PAID,
  DealStatus.TO_PRODUCTION,
  DealStatus.SHIPPED_TO_WAREHOUSE,
  DealStatus.TO_DELIVERY,
  DealStatus.DELIVERED,
  DealStatus.RETURNED,
  DealStatus.CLOSED,
];

export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  NEW: 'Новые',
  IN_PROGRESS: 'В работе',
  INVOICE_ISSUED: 'Выставлен счёт',
  PAID: 'Счёт оплачен',
  TO_PRODUCTION: 'Передано на производство',
  SHIPPED_TO_WAREHOUSE: 'Отгружено на склад',
  TO_DELIVERY: 'Передано в доставку',
  DELIVERED: 'Доставлено',
  RETURNED: 'Возврат',
  CLOSED: 'Закрыто',
};
