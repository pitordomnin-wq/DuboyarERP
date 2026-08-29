export const DEAL_STATUSES = [
  'NEW',
  'IN_PROGRESS',
  'INVOICE_ISSUED',
  'PAID',
  'TO_PRODUCTION',
  'SHIPPED_TO_WAREHOUSE',
  'TO_DELIVERY',
  'DELIVERED',
  'RETURNED',
  'CLOSED',
] as const

export type DealStatus = (typeof DEAL_STATUSES)[number]
export type DealChannel = 'EMAIL' | 'TELEGRAM' | 'PHONE'

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
}

export const CHANNEL_LABEL: Record<DealChannel, string> = {
  EMAIL: 'Email',
  TELEGRAM: 'Telegram',
  PHONE: 'Телефон',
}
