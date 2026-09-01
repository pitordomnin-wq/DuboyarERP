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

export const DEFAULT_DEAL_STATUS_COLOR: Record<DealStatus, string> = {
  NEW: '#2f5a70',
  IN_PROGRESS: '#3d7a96',
  INVOICE_ISSUED: '#e39421',
  PAID: '#5a9fb8',
  TO_PRODUCTION: '#6b8fa3',
  SHIPPED_TO_WAREHOUSE: '#8fb5d8',
  TO_DELIVERY: '#c47a1a',
  DELIVERED: '#2f6b52',
  RETURNED: '#a83232',
  CLOSED: '#8a9aab',
};

export type DealPipelineColumn = {
  status: DealStatus;
  label: string;
  color: string;
  position: number;
};

export function defaultDealPipelineColumns(): DealPipelineColumn[] {
  return DEAL_STATUSES.map((status, index) => ({
    status,
    label: DEAL_STATUS_LABEL[status],
    color: DEFAULT_DEAL_STATUS_COLOR[status],
    position: index,
  }));
}
