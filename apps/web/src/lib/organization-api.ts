import { request } from '@/lib/api'

export type OrganizationProfile = {
  id: string
  name: string
  inn: string | null
  kpp: string | null
  ogrn: string | null
  legalAddress: string | null
  bankName: string | null
  bik: string | null
  checkingAccount: string | null
  correspondentAccount: string | null
  updatedAt: string
}

export type OrganizationInput = Omit<OrganizationProfile, 'id' | 'updatedAt'>

export function fetchOrganization() {
  return request<OrganizationProfile>('/v1/admin/organization')
}

export function updateOrganization(input: OrganizationInput) {
  return request<OrganizationProfile>('/v1/admin/organization', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}
