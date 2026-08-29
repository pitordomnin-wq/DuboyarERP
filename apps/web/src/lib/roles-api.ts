import { request } from '@/lib/api'
import type { PageKey } from '@/lib/nav'

export type AccessRole = {
  id: string
  name: string
  pages: PageKey[]
  locked: boolean
  createdAt: string
  updatedAt: string
  _count: { users: number }
}

export function fetchRoles() {
  return request<AccessRole[]>('/v1/admin/roles')
}

export function createRole(input: { name: string; pages: string[] }) {
  return request<AccessRole>('/v1/admin/roles', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateRole(id: string, input: { name?: string; pages?: string[] }) {
  return request<AccessRole>(`/v1/admin/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteRole(id: string) {
  return request<void>(`/v1/admin/roles/${id}`, { method: 'DELETE' })
}
