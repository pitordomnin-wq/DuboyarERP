import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { headerNavItems } from '@/lib/nav'
import { BrandLogo } from '@/components/BrandLogo'
import { UserSettings } from '@/components/UserSettings'
import { UserAvatar } from '@/components/UserAvatar'

export function AppHeader() {
  const { user, logout, setUser } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [settings, setSettings] = useState(false)
  const userRef = useRef<HTMLDivElement>(null)

  const items = headerNavItems(user)

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!userRef.current?.contains(event.target as Node)) {
        setUserOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <header className="glass-nav sticky top-0 z-40 shrink-0">
      <div className="grid h-14 grid-cols-[1fr_auto] items-center px-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:px-6">
        <NavLink to="/" end className="inline-flex items-center" aria-label="Faverum">
          <BrandLogo />
        </NavLink>

        <nav className="hidden items-center justify-center gap-1 md:flex" aria-label="Разделы">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 text-[13px] transition-[background-color,color,box-shadow] duration-150 ${
                  isActive
                    ? 'bg-primary font-semibold text-on-primary shadow-[0_2px_8px_rgba(47,90,112,0.28)]'
                    : 'font-medium text-secondary hover:bg-white/70 hover:text-foreground'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2">
          <div className="relative hidden md:block" ref={userRef}>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full px-2 py-1.5 text-[13px] font-medium text-foreground transition-colors duration-150 hover:bg-white/70"
              aria-expanded={userOpen}
              aria-haspopup="menu"
              onClick={() => setUserOpen((open) => !open)}
            >
              {user ? (
                <UserAvatar
                  id={user.id}
                  name={user.name}
                  hasAvatar={user.hasAvatar}
                  version={user.avatarAt}
                  size={28}
                />
              ) : null}
              {user?.name}
            </button>
            {userOpen ? (
              <div
                role="menu"
                className="glass-pop absolute right-0 z-[80] mt-2 w-56 rounded-2xl py-1"
              >
                <p className="px-3 py-2 text-xs text-secondary">{user?.email}</p>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-sm text-foreground transition-colors duration-200 hover:bg-white/50"
                  onClick={() => {
                    setUserOpen(false)
                    setSettings(true)
                  }}
                >
                  Настройки
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-sm text-foreground transition-colors duration-200 hover:bg-white/50"
                  onClick={() => {
                    setUserOpen(false)
                    void logout()
                  }}
                >
                  Выйти
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground md:hidden"
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {menuOpen
        ? createPortal(
            <div className="glass-strong fixed inset-x-0 top-14 bottom-0 z-[70] flex flex-col md:hidden">
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-4" aria-label="Разделы">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `rounded-xl px-3 py-3 text-[15px] ${
                        isActive
                          ? 'bg-primary font-semibold text-on-primary'
                          : 'font-medium text-secondary'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="border-t border-line px-4 py-4">
                <div className="flex items-center gap-3">
                  {user ? (
                    <UserAvatar
                      id={user.id}
                      name={user.name}
                      hasAvatar={user.hasAvatar}
                      version={user.avatarAt}
                      size={40}
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-foreground">{user?.name}</p>
                    <p className="mt-0.5 truncate text-sm text-secondary">{user?.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-4 text-sm text-secondary transition-colors duration-200 hover:text-foreground"
                  onClick={() => {
                    setMenuOpen(false)
                    setSettings(true)
                  }}
                >
                  Настройки
                </button>
                <button
                  type="button"
                  className="mt-3 text-sm text-secondary transition-colors duration-200 hover:text-foreground"
                  onClick={() => {
                    setMenuOpen(false)
                    void logout()
                  }}
                >
                  Выйти
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
      {settings && user ? (
        <UserSettings user={user} onClose={() => setSettings(false)} onSaved={setUser} />
      ) : null}
    </header>
  )
}
