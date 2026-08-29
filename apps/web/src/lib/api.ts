export type SessionUser = {
  id: string
  email: string
  name: string
  jobTitle?: string | null
  role: 'ADMIN' | 'MEMBER'
  roleId?: string
  pages?: string[]
  mailSignature?: string | null
  hasAvatar?: boolean
  avatarAt?: string | null
  organizationId?: string
  organization: {
    id: string
    name: string
  }
}

async function parseError(res: Response) {
  return res.status === 401 ? 'invalid_code' : 'request_failed'
}

export async function requestOtp(email: string) {
  const res = await fetch('/v1/auth/otp/request', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    throw new Error(await parseError(res))
  }
}

export async function verifyOtp(email: string, code: string) {
  const res = await fetch('/v1/auth/otp/verify', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })
  if (!res.ok) {
    throw new Error(await parseError(res))
  }
  return (await res.json()) as { user: SessionUser }
}

export async function fetchMe() {
  const res = await fetch('/v1/auth/me', { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error('request_failed')
  return (await res.json()) as SessionUser
}

export async function logout() {
  await fetch('/v1/auth/logout', {
    method: 'POST',
    credentials: 'include',
  })
}

export async function updateProfile(input: { mailSignature?: string }) {
  return request<SessionUser>('/v1/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function uploadAvatar(file: File) {
  const data = new FormData()
  data.append('file', file)
  const res = await fetch('/v1/auth/me/avatar', {
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
  return (await res.json()) as SessionUser
}

export function deleteAvatar() {
  return request<SessionUser>('/v1/auth/me/avatar', { method: 'DELETE' })
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (res.status === 204) {
    return undefined as T
  }
  if (!res.ok) {
    throw new Error('request_failed')
  }
  return (await res.json()) as T
}

