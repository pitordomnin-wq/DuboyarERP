import { request } from '@/lib/api'

export type Counterparty = {
  id: string
  name: string
  legalName: string
  inn: string
  kpp: string | null
  ogrn: string | null
  legalAddress: string
  actualAddress: string | null
  bankName: string | null
  bik: string | null
  checkingAccount: string | null
  correspondentAccount: string | null
  email: string
  phone: string | null
  telegram: string | null
  contactName: string | null
  notes: string | null
}

export type CounterpartyInput = {
  name: string
  legalName: string
  inn: string
  kpp?: string
  ogrn?: string
  legalAddress: string
  actualAddress?: string
  bankName?: string
  bik?: string
  checkingAccount?: string
  correspondentAccount?: string
  email: string
  phone?: string
  telegram?: string
  contactName?: string
  notes?: string
}

export function fetchCounterparties(query?: string) {
  const q = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''
  return request<Counterparty[]>(`/v1/counterparties${q}`)
}

export function fetchCounterparty(id: string) {
  return request<Counterparty>(`/v1/counterparties/${id}`)
}

export function createCounterparty(input: CounterpartyInput) {
  return request<Counterparty>('/v1/counterparties', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateCounterparty(id: string, input: CounterpartyInput) {
  return request<Counterparty>(`/v1/counterparties/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteCounterparty(id: string) {
  return request<void>(`/v1/counterparties/${id}`, { method: 'DELETE' })
}
