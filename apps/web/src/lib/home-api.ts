import { request } from '@/lib/api'

export type HomeMonth = {
  key: string
  label: string
  revenue: number
  expenses: number
  profit: number
}

export type HomePipelineRow = {
  status: string
  label: string
  count: number
  value: number
}

export type HomeTaskRow = {
  status: string
  label: string
  count: number
}

export type HomeAttention = {
  id: string
  kind: string
  title: string
  hint: string
  to: string
  count: number
}

export type HomeSummary = {
  organizationName: string
  kpis: {
    pipelineCount: number | null
    pipelineValue: number | null
    revenueMonth: number | null
    expensesMonth: number | null
    profitMonth: number | null
    openTasks: number | null
    personalOpen: number | null
    activeJobs: number | null
    unreadMail: number | null
    stockValue: number | null
  }
  months: HomeMonth[] | null
  pipeline: HomePipelineRow[] | null
  tasks: {
    byStatus: HomeTaskRow[]
    open: number
    review: number
    personalOpen: number
  } | null
  production: {
    active: number
    toStart: number
    inProgress: number
    done: number
  } | null
  warehouse: {
    stockValue: number
    skuInStock: number
    warehouses: number
  } | null
  purchases: {
    drafts: number
    postedMonth: number
    postedMonthValue: number
  } | null
  catalog: {
    products: number | null
    counterparties: number | null
  }
  attention: HomeAttention[]
}

export function fetchHome() {
  return request<HomeSummary>('/v1/home')
}

export function compactMoney(value: number) {
  const sign = value < 0 ? '−' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₽`
  }
  if (abs >= 10_000) {
    return `${sign}${Math.round(abs / 1000).toLocaleString('ru-RU')} тыс ₽`
  }
  return `${sign}${Math.round(abs).toLocaleString('ru-RU')} ₽`
}
