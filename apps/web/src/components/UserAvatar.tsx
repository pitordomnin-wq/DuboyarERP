import { useEffect, useState } from 'react'

export function userAvatarUrl(id: string, version?: string | null) {
  const query = version ? `?v=${encodeURIComponent(version)}` : ''
  return `/v1/users/${id}/avatar${query}`
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

export function UserAvatar({
  id,
  name,
  hasAvatar,
  version,
  size = 24,
  className = '',
}: {
  id: string
  name: string
  hasAvatar?: boolean
  version?: string | null
  size?: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const showPhoto = Boolean(hasAvatar) && !failed
  const text = size >= 40 ? 'text-sm' : size >= 28 ? 'text-[11px]' : 'text-[10px]'

  useEffect(() => {
    setFailed(false)
  }, [id, version, hasAvatar])

  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 font-semibold text-slate-700 ${text} ${className}`}
      style={{ width: size, height: size }}
    >
      {showPhoto ? (
        <img
          src={userAvatarUrl(id, version)}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(name)
      )}
    </span>
  )
}
