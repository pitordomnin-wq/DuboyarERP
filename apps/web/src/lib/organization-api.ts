import { request } from '@/lib/api'

export type OrganizationProfile = {
  id: string
  name: string
  legalName: string | null
  brandAddress: string | null
  phone: string | null
  email: string | null
  hasLogo: boolean
  logoAt: string | null
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

export type OrganizationInput = {
  name: string
  legalName?: string | null
  brandAddress?: string | null
  phone?: string | null
  email?: string | null
  inn?: string | null
  kpp?: string | null
  ogrn?: string | null
  legalAddress?: string | null
  bankName?: string | null
  bik?: string | null
  checkingAccount?: string | null
  correspondentAccount?: string | null
}

export function fetchOrganization() {
  return request<OrganizationProfile>('/v1/admin/organization')
}

export function updateOrganization(input: OrganizationInput) {
  return request<OrganizationProfile>('/v1/admin/organization', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function companyLogoUrl(version?: string | null) {
  const query = version ? `?v=${encodeURIComponent(version)}` : ''
  return `/v1/organization/logo${query}`
}

export async function uploadCompanyLogo(file: File) {
  const data = new FormData()
  data.append('file', file)
  const res = await fetch('/v1/admin/organization/logo', {
    method: 'POST',
    credentials: 'include',
    body: data,
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string
      message?: string | { error?: string }
    }
    const code = typeof payload.message === 'object' ? payload.message?.error : payload.error
    throw new Error(code ?? 'request_failed')
  }
  return (await res.json()) as OrganizationProfile
}

export function deleteCompanyLogo() {
  return request<OrganizationProfile>('/v1/admin/organization/logo', { method: 'DELETE' })
}

export function resetOrganizationDemo() {
  return request<OrganizationProfile>('/v1/admin/organization/reset', { method: 'POST' })
}
