import { request } from '@/lib/api'
import type { DealChannel, DealStatus } from '@/lib/deal-columns'

export type DealItem = {
  id: string
  productId: string | null
  name: string
  quantity: number
  unit: string
  price: number
  productionStatus: 'NONE' | 'IN_PRODUCTION' | 'IN_WAREHOUSE'
}

export type DealSummary = {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  status: DealStatus
  createdAt: string
  counterparty: {
    id: string
    name: string
    email: string
    telegram: string | null
    phone: string | null
  }
  items: DealItem[]
}

export type DealMessage = {
  id: string
  channel: DealChannel
  direction: 'IN' | 'OUT'
  body: string
  createdAt: string
  author: { id: string; name: string } | null
}

export type DealDocument = {
  id: string
  title: string
  kind: string
  createdAt: string
  sentAt: string | null
}

export type DealEvent = {
  id: string
  text: string
  createdAt: string
}

export type DealDetail = DealSummary & {
  description: string | null
  createdBy: { id: string; name: string }
  counterparty: {
    id: string
    name: string
    legalName: string
    email: string
    telegram: string | null
    phone: string | null
  }
  messages: DealMessage[]
  documents: DealDocument[]
  events: DealEvent[]
}

export function fetchDeals(filters?: DealListFilters) {
  const params = new URLSearchParams()
  if (filters?.q?.trim()) params.set('q', filters.q.trim())
  if (filters?.counterpartyId) params.set('counterpartyId', filters.counterpartyId)
  if (filters?.createdById) params.set('createdById', filters.createdById)
  if (filters?.productId) params.set('productId', filters.productId)
  if (filters?.dueFrom) params.set('dueFrom', filters.dueFrom)
  if (filters?.dueTo) params.set('dueTo', filters.dueTo)
  if (filters?.createdFrom) params.set('createdFrom', filters.createdFrom)
  if (filters?.createdTo) params.set('createdTo', filters.createdTo)
  if (filters?.overdue) params.set('overdue', '1')
  if (filters?.status?.length) params.set('status', filters.status.join(','))
  const q = params.toString()
  return request<DealSummary[]>(`/v1/deals${q ? `?${q}` : ''}`)
}

export type DealListFilters = {
  q?: string
  counterpartyId?: string
  createdById?: string
  productId?: string
  dueFrom?: string
  dueTo?: string
  createdFrom?: string
  createdTo?: string
  overdue?: boolean
  status?: DealStatus[]
}

export function fetchDeal(id: string) {
  return request<DealDetail>(`/v1/deals/${id}`)
}

export function deleteDeal(id: string) {
  return request<void>(`/v1/deals/${id}`, { method: 'DELETE' })
}

export function createDeal(input: {
  counterpartyId: string
  title: string
  description?: string
  dueDate?: string
  items: { productId: string; quantity: number }[]
}) {
  return request<DealDetail>('/v1/deals', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateDealStatus(id: string, status: DealStatus) {
  return request<DealDetail>(`/v1/deals/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function sendDealMessage(id: string, channel: DealChannel, body: string) {
  return request<DealDetail>(`/v1/deals/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ channel, body }),
  })
}

export function createDealInvoice(id: string) {
  return request<DealDetail>(`/v1/deals/${id}/documents/invoice`, { method: 'POST' })
}

export function sendDealDocument(dealId: string, documentId: string, channel: DealChannel) {
  return request<DealDetail>(`/v1/deals/${dealId}/documents/${documentId}/send`, {
    method: 'POST',
    body: JSON.stringify({ channel }),
  })
}

export function deleteDealDocument(dealId: string, documentId: string) {
  return request<DealDetail>(`/v1/deals/${dealId}/documents/${documentId}`, { method: 'DELETE' })
}

export function startDealCall(id: string) {
  return request<DealDetail>(`/v1/deals/${id}/phone/call`, { method: 'POST' })
}

export function sendDealSms(id: string, body: string) {
  return request<DealDetail>(`/v1/deals/${id}/phone/sms`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
}
