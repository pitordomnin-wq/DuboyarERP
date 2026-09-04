import { request } from '@/lib/api'
import type { DealChannel, DealStatus } from '@/lib/deal-columns'

export type DealItem = {
  id: string
  productId: string | null
  name: string
  quantity: number
  unit: string
  price: number
  productionStatus: 'NONE' | 'IN_PRODUCTION' | 'IN_WAREHOUSE' | 'SHIPPED'
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
  mimeType?: string | null
  size?: number | null
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
    inn?: string
    kpp?: string | null
    legalAddress?: string
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
  title?: string
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

export async function shipDeal(
  id: string,
  input?: { itemIds?: string[]; warehouseId?: string; shippedAt?: string },
) {
  const res = await fetch(`/v1/deals/${id}/ship`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input ?? {}),
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string
      name?: string
      message?: string | { error?: string; name?: string }
    }
    const code = typeof payload.message === 'object' ? payload.message?.error : payload.error
    const name =
      typeof payload.message === 'object' ? payload.message?.name : payload.name
    if (code === 'insufficient_stock') {
      throw new Error(`Недостаточно на складе: ${name ?? 'товар'}`)
    }
    if (code === 'nothing_to_ship') {
      throw new Error('Нет позиций для отгрузки')
    }
    throw new Error('request_failed')
  }
  return (await res.json()) as DealDetail
}

export async function createDealUpd(id: string, input?: { shippedAt?: string }) {
  const res = await fetch(`/v1/deals/${id}/documents/upd`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input ?? {}),
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string
      message?: string | { error?: string }
    }
    const code = typeof payload.message === 'object' ? payload.message?.error : payload.error
    if (code === 'nothing_to_ship') {
      throw new Error('Нет отгруженных позиций для УПД')
    }
    throw new Error('request_failed')
  }
  return (await res.json()) as DealDetail
}

export function dealDocumentUrl(dealId: string, documentId: string, opts?: { preview?: boolean }) {
  const q = opts?.preview ? '?preview=1' : ''
  return `/v1/deals/${dealId}/documents/${documentId}/file${q}`
}

export async function fetchDealDocumentBlob(
  dealId: string,
  documentId: string,
  opts?: { preview?: boolean },
) {
  const res = await fetch(dealDocumentUrl(dealId, documentId, opts), { credentials: 'include' })
  if (!res.ok) throw new Error('request_failed')
  const mimeType = res.headers.get('content-type') || 'application/octet-stream'
  const blob = await res.blob()
  return { blob, mimeType }
}

export async function downloadDealDocument(dealId: string, documentId: string, filename: string) {
  const { blob } = await fetchDealDocumentBlob(dealId, documentId)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
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
