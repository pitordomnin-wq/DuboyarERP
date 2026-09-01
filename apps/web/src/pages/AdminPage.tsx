import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { ProductionTypeForm } from '@/components/production/ProductionTypeForm'
import { LkpNormsPanel } from '@/components/production/LkpNormsPanel'
import { ProductGroupsPanel } from '@/components/production/ProductGroupsPanel'
import { TechCardImportPanel } from '@/components/production/TechCardImportPanel'
import { Modal } from '@/components/tasks/TaskModal'
import { CompanyLogo } from '@/components/UserAvatar'
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
  deleteCompanyLogo,
  fetchOrganization,
  resetOrganizationDemo,
  updateOrganization,
  uploadCompanyLogo,
  type OrganizationProfile,
} from '@/lib/organization-api'
import {
  fetchAdminDealPipeline,
  updateAdminDealPipeline,
  type DealPipelineColumn,
} from '@/lib/sales-pipeline-api'

type AdminSection = 'organization' | 'production' | 'sales' | 'users' | 'roles'

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
      <aside className="shrink-0 border-b border-line md:w-64 md:border-r md:border-b-0">
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
          <NavButton active={section === 'sales'} onClick={() => setSection('sales')}>
            Продажи
          </NavButton>
        </nav>
      </aside>
      {section === 'organization' ? <OrganizationSection /> : null}
      {section === 'users' ? <UsersSection currentId={user.id} companyName={user.organization.name} /> : null}
      {section === 'roles' ? <RolesSection currentRoleId={user.roleId} /> : null}
      {section === 'production' ? <ProductionSection /> : null}
      {section === 'sales' ? <SalesPipelineSection /> : null}
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
      className={`side-item shrink-0 items-center ${active ? 'side-item-active' : ''}`}
    >
      <span className="text-sm">{children}</span>
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
  const [tab, setTab] = useState<'cards' | 'lkp' | 'groups' | 'import'>('cards')
  const [types, setTypes] = useState<ProductionTypeSummary[]>([])
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ProductionType | null>(null)

  function reloadTypes() {
    void fetchProductionTypes().then(setTypes)
  }

  useEffect(() => {
    reloadTypes()
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
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Производство</h1>
        <p className="mt-1 text-sm text-secondary">Техкарты, нормы ЛКП и учётные группы</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <TabButton active={tab === 'cards'} onClick={() => setTab('cards')}>
          Техкарты
        </TabButton>
        <TabButton active={tab === 'lkp'} onClick={() => setTab('lkp')}>
          Нормы ЛКП
        </TabButton>
        <TabButton active={tab === 'groups'} onClick={() => setTab('groups')}>
          Учётные группы
        </TabButton>
        <TabButton active={tab === 'import'} onClick={() => setTab('import')}>
          Импорт Excel
        </TabButton>
      </div>

      {tab === 'lkp' ? <LkpNormsPanel /> : null}
      {tab === 'groups' ? <ProductGroupsPanel /> : null}
      {tab === 'import' ? <TechCardImportPanel onImported={reloadTypes} /> : null}

      {tab === 'cards' ? (
        <>
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary"
            >
              Добавить техкарту
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-2xl glass">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-secondary">
                <tr>
                  <th className="border-b border-line px-3 py-2">Название</th>
                  <th className="border-b border-line px-3 py-2">Продукция</th>
                  <th className="border-b border-line px-3 py-2">Этапы</th>
                  <th className="border-b border-line px-3 py-2">Склад</th>
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
        </>
      ) : null}

      {creating ? (
        <ProductionTypeForm
          title="Новая техкарта"
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

function TabButton({
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
      className={`h-9 rounded-md px-3 text-sm ${active ? 'bg-primary text-on-primary' : 'border-2 border-slate-300 text-secondary'}`}
    >
      {children}
    </button>
  )
}

function SalesPipelineSection() {
  const [columns, setColumns] = useState<DealPipelineColumn[]>([])
  const [draft, setDraft] = useState<DealPipelineColumn[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void fetchAdminDealPipeline()
      .then((rows) => {
        setColumns(rows)
        setDraft(rows)
      })
      .finally(() => setLoading(false))
  }, [])

  const dirty = JSON.stringify(columns) !== JSON.stringify(draft)

  function updateRow(index: number, patch: Partial<DealPipelineColumn>) {
    setDraft((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))
    setSaved(false)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      const next = await updateAdminDealPipeline(draft)
      setColumns(next)
      setDraft(next)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-5 md:px-8">
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Колонки продаж</h1>
        <p className="mt-1 text-sm text-secondary">Названия и цвета колонок в разделе «Продажи» и на главной</p>
      </div>

      {loading ? (
        <p className="text-sm text-secondary">Загрузка</p>
      ) : (
        <form onSubmit={(event) => void save(event)} className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="min-h-0 flex-1 overflow-auto rounded-2xl glass">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-secondary">
                <tr>
                  <th className="border-b border-line px-3 py-2">Цвет</th>
                  <th className="border-b border-line px-3 py-2">Название колонки</th>
                  <th className="border-b border-line px-3 py-2">Предпросмотр</th>
                </tr>
              </thead>
              <tbody>
                {draft.map((row, index) => (
                  <tr key={row.status} className="border-b border-slate-200 last:border-b-0">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={row.color}
                          onChange={(event) => updateRow(index, { color: event.target.value })}
                          className="h-9 w-9 cursor-pointer rounded-lg border border-line bg-white p-0.5"
                          aria-label={`Цвет колонки ${row.label}`}
                        />
                        <input
                          value={row.color}
                          onChange={(event) => updateRow(index, { color: event.target.value })}
                          className="h-9 w-[88px] rounded-lg border border-line bg-white px-2 font-mono text-xs uppercase outline-none focus:border-accent"
                          maxLength={7}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        value={row.label}
                        onChange={(event) => updateRow(index, { label: event.target.value })}
                        className="h-9 w-full max-w-md rounded-lg border border-line bg-white px-3 outline-none focus:border-accent"
                        maxLength={80}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: row.color }}
                          aria-hidden
                        />
                        <span className="text-sm font-medium text-foreground">{row.label}</span>
                      </div>
                      <div className="mt-2 h-1.5 max-w-[180px] overflow-hidden rounded-full bg-white/45">
                        <div className="h-full rounded-full" style={{ width: '68%', backgroundColor: row.color }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!dirty || saving}
              className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50"
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
            {saved ? <span className="text-sm text-secondary">Сохранено</span> : null}
          </div>
        </form>
      )}
    </div>
  )
}

function OrganizationSection() {
  const { setUser } = useAuth()
  const [profile, setProfile] = useState<OrganizationProfile | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [resetStep, setResetStep] = useState(0)
  const [resetBusy, setResetBusy] = useState(false)
  const logoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void fetchOrganization().then(setProfile)
  }, [])

  async function refreshSession() {
    const next = await fetchMe()
    if (next) setUser(next)
  }

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
        legalName: read('legalName'),
        brandAddress: read('brandAddress'),
        phone: read('phone'),
        email: read('email'),
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
      await refreshSession()
    } catch {
      setError('Проверьте поля. ИНН — 10 или 12 цифр, КПП и БИК — 9, счета — 20.')
    } finally {
      setBusy(false)
    }
  }

  async function onPickLogo(list: FileList | null) {
    const file = list?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Нужен JPG, PNG, WEBP или GIF')
      return
    }
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      setProfile(await uploadCompanyLogo(file))
      await refreshSession()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      setError(code === 'file_too_large' ? 'Файл больше 4 МБ' : 'Не удалось загрузить логотип')
    } finally {
      setBusy(false)
      if (logoInput.current) logoInput.current.value = ''
    }
  }

  async function onRemoveLogo() {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      setProfile(await deleteCompanyLogo())
      await refreshSession()
    } catch {
      setError('Не удалось удалить логотип')
    } finally {
      setBusy(false)
    }
  }

  async function onResetDemo() {
    if (resetStep === 0) {
      setResetStep(1)
      return
    }
    setResetBusy(true)
    setError(null)
    try {
      const next = await resetOrganizationDemo()
      setProfile(next)
      await refreshSession()
      window.location.reload()
    } catch {
      setResetBusy(false)
      setResetStep(0)
      setError('Не удалось сбросить данные')
    }
  }

  if (!profile) {
    return <p className="px-4 py-6 text-sm text-secondary md:px-8">Загрузка</p>
  }

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto px-4 py-5 md:px-8">
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Организация</h1>
        <p className="mt-1 text-sm text-secondary">Карточка компании в сервисе и реквизиты для счетов</p>
      </div>
      <form onSubmit={submit} className="max-w-3xl">
        <section className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground">Карточка компании</h2>
          <p className="mt-1 text-sm text-secondary">Так компанию видят сотрудники в настройках</p>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <input
                ref={logoInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(event) => void onPickLogo(event.target.files)}
              />
              <button
                type="button"
                disabled={busy}
                aria-label="Сменить логотип"
                title="Сменить логотип"
                onClick={() => logoInput.current?.click()}
                className="group relative h-24 w-24 overflow-hidden rounded-xl disabled:opacity-60"
              >
                <CompanyLogo
                  name={profile.name}
                  hasLogo={profile.hasLogo}
                  version={profile.logoAt}
                  size={96}
                />
                <span className="absolute inset-0 flex items-center justify-center bg-foreground/50 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Pencil size={22} strokeWidth={1.75} />
                </span>
              </button>
              {profile.hasLogo ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onRemoveLogo()}
                  className="text-xs text-secondary hover:text-foreground disabled:opacity-60"
                >
                  Убрать
                </button>
              ) : null}
            </div>
            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-secondary sm:col-span-2">
                Название
                <input name="name" required defaultValue={profile.name} className={inputClass} />
              </label>
              <label className="text-xs font-medium text-secondary sm:col-span-2">
                Адрес
                <input name="brandAddress" defaultValue={profile.brandAddress ?? ''} className={inputClass} />
              </label>
              <label className="text-xs font-medium text-secondary">
                Телефон
                <input name="phone" defaultValue={profile.phone ?? ''} className={inputClass} />
              </label>
              <label className="text-xs font-medium text-secondary">
                Email
                <input name="email" type="email" defaultValue={profile.email ?? ''} className={inputClass} />
              </label>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-3 rounded-2xl glass p-5 sm:grid-cols-2">
          <h2 className="text-sm font-semibold text-foreground sm:col-span-2">Юридические данные</h2>
          <p className="text-sm text-secondary sm:col-span-2">Для счетов на оплату и документов</p>
          <label className="text-xs font-medium text-secondary sm:col-span-2">
            Наименование
            <input name="legalName" defaultValue={profile.legalName ?? ''} className={inputClass} />
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

        <section className="mt-4 grid gap-3 rounded-2xl glass p-5 sm:grid-cols-2">
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
        {saved ? <p className="mt-4 text-sm text-secondary">Сохранено. Новые счета возьмут юридические реквизиты.</p> : null}
        <div className="mt-5 flex justify-end">
          <button type="submit" disabled={busy} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary">
            Сохранить
          </button>
        </div>
      </form>

      <section className="mt-10 max-w-3xl rounded-2xl glass p-5">
        <h2 className="text-sm font-semibold text-foreground">Полный сброс</h2>
        <p className="mt-2 text-sm leading-6 text-secondary">
          Удалит сделки, склад, закупки, производство, задачи, почту и контрагентов, затем заново заполнит демо
          паркетного цеха с января 2026. Пользователи и вход сохранятся. Карточка компании вернётся к демо-реквизитам.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={resetBusy || busy}
            onClick={() => void onResetDemo()}
            className="h-10 rounded-md border-2 border-slate-400 bg-white px-4 text-sm font-semibold text-foreground disabled:opacity-60"
          >
            {resetBusy ? 'Сбрасываем…' : resetStep === 0 ? 'Сбросить данные' : 'Да, сбросить всё'}
          </button>
          {resetStep > 0 && !resetBusy ? (
            <button type="button" onClick={() => setResetStep(0)} className="text-sm text-secondary hover:text-foreground">
              Отмена
            </button>
          ) : null}
        </div>
      </section>
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

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl glass">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-secondary">
            <tr>
              <th className="border-b border-line px-3 py-2">Имя</th>
              <th className="border-b border-line px-3 py-2">Должность</th>
              <th className="border-b border-line px-3 py-2">Email</th>
              <th className="border-b border-line px-3 py-2">Роль</th>
              <th className="border-b border-line px-3 py-2">Статус</th>
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

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl glass">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-secondary">
            <tr>
              <th className="border-b border-line px-3 py-2">Роль</th>
              <th className="border-b border-line px-3 py-2">Страницы</th>
              <th className="border-b border-line px-3 py-2">Сотрудники</th>
              <th className="border-b border-line px-3 py-2" />
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
