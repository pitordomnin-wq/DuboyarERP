import { Navigate, Outlet } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { PageWash } from '@/components/PageWash'
import { useAuth } from '@/lib/auth'

export function AppShell() {
  const { user } = useAuth()
  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-transparent">
      <PageWash />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <AppHeader />
        <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function SectionPlaceholder({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-secondary">Раздел появится в следующей итерации.</p>
    </div>
  )
}
