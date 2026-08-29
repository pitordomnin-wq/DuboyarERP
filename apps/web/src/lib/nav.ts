export const PAGE_KEYS = [
  'tasks',
  'mail',
  'sales',
  'warehouse',
  'production',
  'products',
  'purchases',
  'counterparties',
  'admin',
] as const

export type PageKey = (typeof PAGE_KEYS)[number]

export const HOME_NAV = { to: '/', label: 'Главная', end: true as const }

export const NAV_ITEMS: { to: string; page: PageKey; label: string; end?: boolean }[] = [
  { to: '/tasks', page: 'tasks', label: 'Задачи' },
  { to: '/mail', page: 'mail', label: 'Почта' },
  { to: '/sales', page: 'sales', label: 'Продажи' },
  { to: '/warehouse', page: 'warehouse', label: 'Склад' },
  { to: '/production', page: 'production', label: 'Производство' },
  { to: '/products', page: 'products', label: 'Товары' },
  { to: '/purchases', page: 'purchases', label: 'Закупки' },
  { to: '/counterparties', page: 'counterparties', label: 'Контрагенты' },
  { to: '/admin', page: 'admin', label: 'Панель управления' },
]

export type HeaderNavItem = { to: string; label: string; end?: boolean }

export function headerNavItems(user: { pages?: string[]; role?: string } | null): HeaderNavItem[] {
  return [HOME_NAV, ...NAV_ITEMS.filter((item) => canSeePage(user, item.page))]
}

export function userPages(user: { pages?: string[]; role?: string } | null) {
  if (!user) return [] as PageKey[]
  if (user.pages) return PAGE_KEYS.filter((page) => user.pages?.includes(page))
  if (user.role === 'ADMIN') return [...PAGE_KEYS]
  return PAGE_KEYS.filter((page) => page !== 'admin')
}

export function canSeePage(user: { pages?: string[]; role?: string } | null, page: PageKey) {
  return userPages(user).includes(page)
}

export function homePath(user: { pages?: string[]; role?: string } | null) {
  return user ? '/' : '/login'
}
