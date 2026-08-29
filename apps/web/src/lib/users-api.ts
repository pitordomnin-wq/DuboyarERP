import { request } from '@/lib/api'

export type OrgUser = {
  id: string
  email: string
  name: string
  jobTitle: string | null
  role: 'ADMIN' | 'MEMBER'
  roleId: string
  status: 'ACTIVE' | 'BLOCKED'
  createdAt: string
  accessRole: { id: string; name: string }
}

export function fetchOrgUsers() {
  return request<OrgUser[]>('/v1/admin/users')
}

export function createOrgUser(input: { email: string; name: string; jobTitle?: string; roleId?: string }) {
  return request<OrgUser>('/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateOrgUser(
  id: string,
  input: { name?: string; jobTitle?: string; roleId?: string; status?: 'ACTIVE' | 'BLOCKED' },
) {
  return request<OrgUser>(`/v1/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}
