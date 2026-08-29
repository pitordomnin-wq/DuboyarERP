import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { ProductionTypeForm } from '@/components/production/ProductionTypeForm'
import { Modal } from '@/components/tasks/TaskModal'
import { useAuth } from '@/lib/auth'
import { canSeePage, homePath, NAV_ITEMS, type PageKey } from '@/lib/nav'
import { fetchMe } from '@/lib/api'
import {
  fetchProductionType,
  fetchProductionTypes,
  type ProductionType,
  type ProductionTypeSummary,
} from '@/lib/production-api'
import { createOrgUser, fetchOrgUsers, updateOrgUser, type OrgUser } from '@/lib/users-api'
import { createRole, deleteRole, fetchRoles, updateRole, type AccessRole } from '@/lib/roles-api'
import {
  fetchOrganization,
  updateOrganization,
  type OrganizationProfile,
} from '@/lib/organization-api'

type AdminSection = 'organization' | 'production' | 'users' | 'roles'

const inputClass =
  'mt-1 h-10 w-full rounded-md border-2 border-slate-300 bg-white px-3 text-sm text-foreground outline-none focus:border-slate-500'

export function AdminPage() {
  const { user } = useAuth()
  const [section, setSection] = useState<AdminSection>('organization')

  if (!user || !canSeePage(user, 'admin')) {
    return <Navigate to={homePath(user)} replace />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="shrink-0 border-b-2 border-slate-300 md:w-64 md:border-r-2 md:border-b-0">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Разделы</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col">
          <NavButton active={section === 'organization'} onClick={() => setSection('organization')}>
            Организация
          </NavButton>
          <NavButton active={section === 'users'} onClick={() => setSection('users')}>
            Пользователи
          </NavButton>
          <NavButton active={section === 'roles'} onClick={() => setSection('roles')}>
            Права доступа
          </NavButton>
          <NavButton active={section === 'production'} onClick={() => setSection('production')}>
            Производство
          </NavButton>
        </nav>
      </aside>
      {section === 'organization' ? <OrganizationSection /> : null}
      {section === 'users' ? <UsersSection currentId={user.id} companyName={user.organization.name} /> : null}
      {section === 'roles' ? <RolesSection currentRoleId={user.roleId} /> : null}
      {section === 'production' ? <ProductionSection /> : null}
    </div>
  )
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-left text-sm ${
        active ? 'bg-slate-200 font-medium text-foreground' : 'text-secondary hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  )
}

function toTypeSummary(item: ProductionType, jobs = 0): ProductionTypeSummary {
  return {
    id: item.id,
    name: item.name,
    productId: item.productId,
    product: item.product,
    warehouse: item.warehouse,
    stages: item.stages.map((stage) => ({ id: stage.id, name: stage.name, position: stage.position })),
    _count: { jobs },
  }
}

function ProductionSection() {
  const [types, setTypes] = useState<ProductionTypeSummary[]>([])
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ProductionType | null>(null)

  useEffect(() => {
    void fetchProductionTypes().then(setTypes)
  }, [])

  function applySaved(item: ProductionType) {
    setCreating(false)
    setEditing(null)
    setTypes((current) => {
      const jobs = current.find((entry) => entry.id === item.id)?._count.jobs ?? 0
      const next = toTypeSummary(item, jobs)
      const index = current.findIndex((entry) => entry.id === item.id)
      if (index === -1) return [...current, next]
      return current.map((entry, i) => (i === index ? next : entry))
    })
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-5 md:px-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Этапы производства</h1>
          <p className="mt-1 text-sm text-secondary">Готовая продукция, склад и последовательность этапов</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary"
        >
          Добавить
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-md border-2 border-slate-300 bg-white">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-secondary">
            <tr>
              <th className="border-b-2 border-slate-300 px-3 py-2">Название</th>
              <th className="border-b-2 border-slate-300 px-3 py-2">Продукция</th>
              <th className="border-b-2 border-slate-300 px-3 py-2">Этапы</th>
              <th className="border-b-2 border-slate-300 px-3 py-2">Склад</th>
            </tr>
          </thead>
          <tbody>
            {types.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-secondary">
                  Пока нет
                </td>
              </tr>
            ) : (
              types.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer border-b border-slate-200 hover:bg-slate-50"
                  onClick={() => void fetchProductionType(item.id).then(setEditing)}
                >
                  <td className="px-3 py-2.5 font-medium text-foreground">{item.name}</td>
                  <td className="px-3 py-2.5 text-secondary">{item.product.name}</td>
                  <td className="px-3 py-2.5 text-secondary">{item.stages.map((stage) => stage.name).join(' → ')}</td>
                  <td className="px-3 py-2.5 text-secondary">{item.warehouse.name}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {creating ? (
        <ProductionTypeForm
          title="Новые этапы"
          onClose={() => setCreating(false)}
          onSaved={(item) => {
            if (item) applySaved(item)
          }}
        />
      ) : null}
      {editing ? (
        <ProductionTypeForm
          title={editing.name}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(item) => {
            if (item) applySaved(item)
          }}
          onDeleted={(id) => {
            setEditing(null)
            setTypes((current) => current.filter((item) => item.id !== id))
          }}
        />
      ) : null}
    </div>
  )
}

function OrganizationSection() {
  const [profile, setProfile] = useState<OrganizationProfile | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void fetchOrganization().then(setProfile)
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const read = (key: string) => String(data.get(key) ?? '').trim()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const next = await updateOrganization({
        name: read('name'),
        inn: read('inn'),
        kpp: read('kpp'),
        ogrn: read('ogrn'),
        legalAddress: read('legalAddress'),
        bankName: read('bankName'),
        bik: read('bik'),
        checkingAccount: read('checkingAccount'),
        correspondentAccount: read('correspondentAccount'),
      })
      setProfile(next)
      setSaved(true)
    } catch {
      setError('Проверьте поля. ИНН — 10 или 12 цифр, КПП и БИК — 9, счета — 20.')
    } finally {
      setBusy(false)
    }
  }

  if (!profile) {
    return <p className="px-4 py-6 text-sm text-secondary md:px-8">Загрузка</p>
  }

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto px-4 py-5 md:px-8">
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Организация</h1>
        <p className="mt-1 text-sm text-secondary">Реквизиты для счетов на оплату</p>
      </div>
      <form key={profile.updatedAt} onSubmit={submit} className="max-w-3xl rounded-md border-2 border-slate-300 bg-white p-5">
        <section className="grid gap-3 sm:grid-cols-2">
          <h2 className="text-sm font-semibold text-foreground sm:col-span-2">Юридические данные</h2>
          <label className="text-xs font-medium text-secondary sm:col-span-2">
            Наименование
            <input name="name" required defaultValue={profile.name} className={inputClass} />
          </label>
          <label className="text-xs font-medium text-secondary">
            ИНН
            <input name="inn" defaultValue={profile.inn ?? ''} placeholder="10 или 12 цифр" className={inputClass} />
          </label>
          <label className="text-xs font-medium text-secondary">
            КПП
            <input name="kpp" defaultValue={profile.kpp ?? ''} placeholder="9 цифр" className={inputClass} />
          </label>
          <label className="text-xs font-medium text-secondary sm:col-span-2">
            ОГРН / ОГРНИП
            <input name="ogrn" defaultValue={profile.ogrn ?? ''} className={inputClass} />
          </label>
          <label className="text-xs font-medium text-secondary sm:col-span-2">
            Юридический адрес
            <input name="legalAddress" defaultValue={profile.legalAddress ?? ''} className={inputClass} />
          </label>
        </section>
        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          <h2 className="text-sm font-semibold text-foreground sm:col-span-2">Банк</h2>
          <label className="text-xs font-medium text-secondary sm:col-span-2">
            Банк
            <input name="bankName" defaultValue={profile.bankName ?? ''} className={inputClass} />
          </label>
          <label className="text-xs font-medium text-secondary">
            БИК
            <input name="bik" defaultValue={profile.bik ?? ''} placeholder="9 цифр" className={inputClass} />
          </label>
          <label className="text-xs font-medium text-secondary">
            Расчётный счёт
            <input name="checkingAccount" defaultValue={profile.checkingAccount ?? ''} className={inputClass} />
          </label>
          <label className="text-xs font-medium text-secondary sm:col-span-2">
            Корреспондентский счёт
            <input name="correspondentAccount" defaultValue={profile.correspondentAccount ?? ''} className={inputClass} />
          </label>
        </section>
        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        {saved ? <p className="mt-4 text-sm text-secondary">Сохранено. Новые счета возьмут эти реквизиты.</p> : null}
        <div className="mt-5 flex justify-end">
          <button type="submit" disabled={busy} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary">
            Сохранить
          </button>
        </div>
      </form>
    </div>
  )
}

function UsersSection({ currentId, companyName }: { currentId: string; companyName: string }) {
  const { setUser } = useAuth()
  const [items, setItems] = useState<OrgUser[]>([])
  const [roles, setRoles] = useState<AccessRole[]>([])
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<OrgUser | null>(null)

  async function load() {
    const [nextUsers, nextRoles] = await Promise.all([fetchOrgUsers(), fetchRoles()])
    setItems(nextUsers)
    setRoles(nextRoles)
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-5 md:px-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Пользователи</h1>
          <p className="mt-1 text-sm text-secondary">Почты сотрудников — это учётные записи и адреса в почте</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary"
        >
          Новый пользователь
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-md border-2 border-slate-300 bg-white">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-secondary">
            <tr>
              <th className="border-b-2 border-slate-300 px-3 py-2">Имя</th>
              <th className="border-b-2 border-slate-300 px-3 py-2">Должность</th>
              <th className="border-b-2 border-slate-300 px-3 py-2">Email</th>
              <th className="border-b-2 border-slate-300 px-3 py-2">Роль</th>
              <th className="border-b-2 border-slate-300 px-3 py-2">Статус</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="cursor-pointer border-b border-slate-200 hover:bg-slate-50"
                onClick={() => setEditing(item)}
              >
                <td className="px-3 py-2.5 font-medium text-foreground">{item.name}</td>
                <td className="px-3 py-2.5 text-secondary">{item.jobTitle || '—'}</td>
                <td className="px-3 py-2.5 text-secondary">{item.email}</td>
                <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                  {item.id === currentId ? (
                    <span className="text-secondary">{item.accessRole.name}</span>
                  ) : (
                    <select
                      value={item.roleId}
                      onChange={(event) => {
                        void updateOrgUser(item.id, { roleId: event.target.value }).then(load)
                      }}
                      className="h-9 rounded-md border-2 border-slate-300 bg-white px-2 text-sm"
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                  {item.id === currentId ? (
                    <span className="text-secondary">Активен</span>
                  ) : (
                    <select
                      value={item.status}
                      onChange={(event) => {
                        void updateOrgUser(item.id, { status: event.target.value as OrgUser['status'] }).then(load)
                      }}
                      className="h-9 rounded-md border-2 border-slate-300 bg-white px-2 text-sm"
                    >
                      <option value="ACTIVE">Активен</option>
                      <option value="BLOCKED">Заблокирован</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating ? (
        <UserForm
          title="Новый пользователь"
          companyName={companyName}
          roles={roles}
          onClose={() => setCreating(false)}
          onSaved={load}
        />
      ) : null}
      {editing ? (
        <UserForm
          title="Пользователь"
          companyName={companyName}
          roles={roles}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await load()
            if (editing.id === currentId) {
              const next = await fetchMe()
              if (next) setUser(next)
            }
          }}
        />
      ) : null}
    </div>
  )
}

function UserForm({
  title,
  companyName,
  roles,
  initial,
  onClose,
  onSaved,
}: {
  title: string
  companyName: string
  roles: AccessRole[]
  initial?: OrgUser
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const defaultRoleId = initial?.roleId ?? roles.find((role) => !role.locked)?.id ?? roles[0]?.id ?? ''

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') ?? '').trim()
    const jobTitle = String(data.get('jobTitle') ?? '').trim()
    setBusy(true)
    setError(null)
    try {
      if (initial) {
        await updateOrgUser(initial.id, { name, jobTitle })
      } else {
        await createOrgUser({
          name,
          email: String(data.get('email') ?? '').trim(),
          jobTitle,
          roleId: String(data.get('roleId') ?? '') || undefined,
        })
      }
      await onSaved()
      onClose()
    } catch {
      setError(initial ? 'Не удалось сохранить' : 'Не удалось создать. Возможно, эта почта уже есть.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <label className="text-sm text-secondary">
          Компания
          <input readOnly value={companyName} className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 bg-slate-50 px-3 text-sm text-foreground" />
        </label>
        <label className="text-sm text-secondary">
          Имя
          <input
            name="name"
            required
            defaultValue={initial?.name}
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
          />
        </label>
        <label className="text-sm text-secondary">
          Должность
          <input
            name="jobTitle"
            defaultValue={initial?.jobTitle ?? ''}
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
          />
        </label>
        {initial ? (
          <label className="text-sm text-secondary">
            Email
            <input
              readOnly
              value={initial.email}
              className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 bg-slate-50 px-3 text-sm text-foreground"
            />
          </label>
        ) : (
          <label className="text-sm text-secondary">
            Email
            <input name="email" type="email" required className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm" />
          </label>
        )}
        {initial ? null : (
          <label className="text-sm text-secondary">
            Роль
            <select
              name="roleId"
              defaultValue={defaultRoleId}
              className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 bg-white px-2 text-sm"
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end">
          <button type="submit" disabled={busy} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary">
            {initial ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function RolesSection({ currentRoleId }: { currentRoleId?: string }) {
  const { setUser } = useAuth()
  const [items, setItems] = useState<AccessRole[]>([])
  const [editing, setEditing] = useState<AccessRole | null>(null)
  const [creating, setCreating] = useState(false)

  async function load() {
    setItems(await fetchRoles())
  }

  useEffect(() => {
    void load()
  }, [])

  async function refreshSessionIfNeeded(roleId: string) {
    if (roleId !== currentRoleId) return
    const next = await fetchMe()
    if (next) setUser(next)
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-5 md:px-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Права доступа</h1>
          <p className="mt-1 text-sm text-secondary">Роли и страницы, которые видит сотрудник в меню</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary"
        >
          Новая роль
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-md border-2 border-slate-300 bg-white">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-secondary">
            <tr>
              <th className="border-b-2 border-slate-300 px-3 py-2">Роль</th>
              <th className="border-b-2 border-slate-300 px-3 py-2">Страницы</th>
              <th className="border-b-2 border-slate-300 px-3 py-2">Сотрудники</th>
              <th className="border-b-2 border-slate-300 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-secondary">
                  Ролей нет
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer border-b border-slate-200 hover:bg-slate-50"
                  onClick={() => setEditing(item)}
                >
                  <td className="px-3 py-2.5 font-medium text-foreground">{item.name}</td>
                  <td className="px-3 py-2.5 text-secondary">
                    {item.pages.length === NAV_ITEMS.length
                      ? 'Все страницы'
                      : item.pages.length
                        ? NAV_ITEMS.filter((page) => item.pages.includes(page.page))
                            .map((page) => page.label)
                            .join(', ')
                        : 'Нет доступа'}
                  </td>
                  <td className="px-3 py-2.5 text-secondary">{item._count.users}</td>
                  <td className="px-3 py-2.5 text-right">
                    {item.locked ? (
                      <span className="text-xs text-secondary">системная</span>
                    ) : (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!window.confirm('Удалить эту роль?')) return
                          void deleteRole(item.id)
                            .then(load)
                            .catch(() => {
                              window.alert(
                                item._count.users
                                  ? 'Нельзя удалить: роль назначена сотрудникам'
                                  : 'Не удалось удалить роль',
                              )
                            })
                        }}
                        className="text-sm text-secondary hover:text-foreground"
                      >
                        Удалить
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {creating ? (
        <RoleForm
          title="Новая роль"
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false)
            await load()
          }}
        />
      ) : null}
      {editing ? (
        <RoleForm
          title="Роль"
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async (roleId) => {
            setEditing(null)
            await load()
            await refreshSessionIfNeeded(roleId)
          }}
        />
      ) : null}
    </div>
  )
}

function RoleForm({
  title,
  initial,
  onClose,
  onSaved,
}: {
  title: string
  initial?: AccessRole
  onClose: () => void
  onSaved: (roleId: string) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [pages, setPages] = useState<PageKey[]>(initial?.pages ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const allOn = pages.length === NAV_ITEMS.length

  function toggle(page: PageKey) {
    setPages((current) => (current.includes(page) ? current.filter((item) => item !== page) : [...current, page]))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Укажите название')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const saved = initial
        ? await updateRole(initial.id, { name: trimmed, pages })
        : await createRole({ name: trimmed, pages })
      await onSaved(saved.id)
    } catch {
      setError(initial ? 'Не удалось сохранить роль' : 'Не удалось создать. Возможно, такое имя уже есть.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        <label className="text-sm text-secondary">
          Название
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
          />
        </label>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Страницы в меню</p>
            <button
              type="button"
              onClick={() => setPages(allOn ? [] : NAV_ITEMS.map((item) => item.page))}
              className="text-sm text-secondary hover:text-foreground"
            >
              {allOn ? 'Снять все' : 'Выбрать все'}
            </button>
          </div>
          <div className="flex flex-col gap-1 rounded-md border-2 border-slate-300 p-3">
            {NAV_ITEMS.map((item) => (
              <label key={item.page} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={pages.includes(item.page)}
                  onChange={() => toggle(item.page)}
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end">
          <button type="submit" disabled={busy} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary">
            Сохранить
          </button>
        </div>
      </form>
    </Modal>
  )
}
