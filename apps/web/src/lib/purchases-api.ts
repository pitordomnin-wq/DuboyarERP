import { request } from '@/lib/api'

export type PurchaseStatus = 'DRAFT' | 'POSTED'

export type PurchaseRow = {
  id: string
  number: string
  title: string
  status: PurchaseStatus
  purchasedAt: string
  total: number
  counterparty: { id: string; name: string }
  warehouse: { id: string; name: string }
}

export type PurchaseCard = PurchaseRow & {
  note: string | null
  createdBy: { id: string; name: string }
  createdAt: string
  warehouse: { id: string; name: string; address: string | null }
  counterparty: { id: string; name: string; inn: string }
  items: {
    id: string
    productId: string
    name: string
    quantity: number
    unit: string
    price: number
  }[]
  documents: {
    id: string
    title: string
    number: string | null
    issuedAt: string | null
    note: string | null
    createdAt: string
  }[]
}

export type PurchaseInput = {
  title: string
  counterpartyId: string
  warehouseId: string
  purchasedAt: string
  note?: string
  items: { productId: string; quantity: number; price: number }[]
}

export type PurchaseDocumentInput = {
  title: string
  number?: string
  issuedAt?: string
  note?: string
}

export function fetchPurchases(query?: string) {
  const q = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''
  return request<PurchaseRow[]>(`/v1/purchases${q}`)
}

export function fetchPurchase(id: string) {
  return request<PurchaseCard>(`/v1/purchases/${id}`)
}

export function createPurchase(input: PurchaseInput) {
  return request<PurchaseRow>('/v1/purchases', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function postPurchase(id: string) {
  return request<PurchaseCard>(`/v1/purchases/${id}/post`, { method: 'POST' })
}

export function addPurchaseDocument(id: string, input: PurchaseDocumentInput) {
  return request<PurchaseCard['documents'][number]>(`/v1/purchases/${id}/documents`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deletePurchaseDocument(id: string, documentId: string) {
  return request<void>(`/v1/purchases/${id}/documents/${documentId}`, { method: 'DELETE' })
}

export function purchaseDocumentUrl(purchaseId: string, documentId: string) {
  return `/v1/purchases/${purchaseId}/documents/${documentId}/file`
}

export function deletePurchase(id: string) {
  return request<void>(`/v1/purchases/${id}`, { method: 'DELETE' })
}
