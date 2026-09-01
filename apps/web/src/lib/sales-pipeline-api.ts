import { request } from '@/lib/api'
import { DEAL_STATUS_LABEL, type DealStatus } from '@/lib/deal-columns'

export type DealPipelineColumn = {
  status: DealStatus
  label: string
  color: string
  position: number
}

export function fetchDealPipeline() {
  return request<DealPipelineColumn[]>('/v1/sales/pipeline')
}

export function fetchAdminDealPipeline() {
  return request<DealPipelineColumn[]>('/v1/admin/sales/pipeline')
}

export function updateAdminDealPipeline(columns: DealPipelineColumn[]) {
  return request<DealPipelineColumn[]>('/v1/admin/sales/pipeline', {
    method: 'PATCH',
    body: JSON.stringify({ columns }),
  })
}

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
}

export function pipelineLabelMap(columns: DealPipelineColumn[]): Record<DealStatus, string> {
  const map = { ...DEAL_STATUS_LABEL }
  for (const column of columns) map[column.status] = column.label
  return map
}

export function pipelineColorMap(columns: DealPipelineColumn[]): Record<DealStatus, string> {
  const map = { ...DEFAULT_DEAL_STATUS_COLOR }
  for (const column of columns) map[column.status] = column.color
  return map
}
