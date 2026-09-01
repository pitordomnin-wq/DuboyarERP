import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Filter } from 'lucide-react'
import { Modal } from '@/components/tasks/TaskModal'
import { DealPanel } from '@/components/sales/DealPanel'
import { ProductCatalogPicker, type CatalogLine } from '@/components/products/ProductCatalogPicker'
import { DateField } from '@/components/DateField'
import { DEAL_STATUS_LABEL, DEAL_STATUSES, type DealStatus } from '@/lib/deal-columns'
import { fetchCounterparties, type Counterparty } from '@/lib/counterparties-api'
import { fetchAddressBook } from '@/lib/mail-api'
import { fetchProducts, money, type Product } from '@/lib/products-api'
import {
  fetchDealPipeline,
  pipelineColorMap,
  pipelineLabelMap,
  type DealPipelineColumn,
} from '@/lib/sales-pipeline-api'
import {
  createDeal,
  fetchDeal,
  fetchDeals,
  type DealDetail,
  type DealListFilters,
  type DealSummary,
} from '@/lib/sales-api'

const emptyFilters: DealListFilters = {}

function countFilters(filters: DealListFilters) {
  return [
    filters.counterpartyId,
    filters.createdById,
    filters.productId,
    filters.dueFrom,
    filters.dueTo,
    filters.createdFrom,
    filters.createdTo,
    filters.overdue,
    filters.status?.length,
  ].filter(Boolean).length
}

export function SalesPage() {
  const [deals, setDeals] = useState<DealSummary[]>([])
  const [pipeline, setPipeline] = useState<DealPipelineColumn[]>([])
  const [opened, setOpened] = useState<DealDetail | null>(null)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<DealListFilters>(emptyFilters)
  const [filterOpen, setFilterOpen] = useState(false)

  useEffect(() => {
    void fetchDealPipeline().then(setPipeline)
  }, [])

  const statusLabels = useMemo(
    () => (pipeline.length ? pipelineLabelMap(pipeline) : DEAL_STATUS_LABEL),
    [pipeline],
  )
  const statusColors = useMemo(
    () => (pipeline.length ? pipelineColorMap(pipeline) : undefined),
    [pipeline],
  )
  const columnOrder = useMemo(
    () => (pipeline.length ? pipeline.map((column) => column.status) : [...DEAL_STATUSES]),
    [pipeline],
  )

  async function load(nextQuery = query, nextFilters = filters) {
    setDeals(await fetchDeals({ ...nextFilters, q: nextQuery }))
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 200)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters])

  const grouped = useMemo(() => {
    const map = new Map<DealStatus, DealSummary[]>()
    for (const status of columnOrder) map.set(status, [])
    for (const deal of deals) map.get(deal.status)?.push(deal)
    return map
  }, [deals, columnOrder])

  const filterCount = countFilters(filters)

  async function openDeal(id: string) {
    setOpened(await fetchDeal(id))
  }

  function applyDeal(deal: DealDetail) {
    setOpened(deal)
    setDeals((current) => {
      const next = current.filter((item) => item.id !== deal.id)
      next.push(deal)
      return next
    })
  }

  function removeDeal(id: string) {
    setOpened(null)
    setDeals((current) => current.filter((item) => item.id !== id))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4 px-4 pt-5 pb-4 md:px-8">
        <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Продажи</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary shadow-[0_2px_10px_rgba(47,90,112,0.22)] transition-opacity duration-150 hover:opacity-95"
        >
          Новая сделка
        </button>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pb-4 md:px-8">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по названию, контрагенту, ИНН или товару"
          className="h-10 min-w-[220px] flex-1 rounded-xl border border-line bg-white/70 px-3.5 text-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:shadow-[0_0_0_3px_rgba(227,148,33,0.22)] md:max-w-md"
        />
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white/70 px-3.5 text-sm text-foreground transition-colors duration-150 hover:bg-white/90"
        >
          <Filter size={16} strokeWidth={2} />
          Фильтры
          {filterCount ? (
            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-accent">{filterCount}</span>
          ) : null}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-4 pb-6 md:px-8">
        <div className="flex h-full items-stretch gap-3">
          {columnOrder.map((status) => (
            <section
              key={status}
              className="glass-well flex h-full w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl"
            >
              <header
                className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-white/55 px-3"
                style={statusColors ? { boxShadow: `inset 0 3px 0 0 ${statusColors[status]}` } : undefined}
              >
                <h2 className="whitespace-nowrap text-sm font-semibold text-foreground">{statusLabels[status]}</h2>
                <span className="glass-chip shrink-0 rounded-full px-1.5 py-0.5 text-xs tabular-nums text-secondary">
                  {grouped.get(status)?.length ?? 0}
                </span>
              </header>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2">
                {(grouped.get(status) ?? []).map((deal) => (
                  <button
                    key={deal.id}
                    type="button"
                    onClick={() => void openDeal(deal.id)}
                    className="glass-chip shrink-0 rounded-xl p-3 text-left transition-[background-color,box-shadow] duration-150 hover:bg-white/85"
                  >
                    <p className="text-sm font-medium text-foreground">{deal.title}</p>
                    <p className="mt-1 text-xs text-secondary">{deal.counterparty.name}</p>
                    {deal.dueDate ? (
                      <p className="mt-1 text-xs text-secondary">к {new Date(deal.dueDate).toLocaleDateString('ru-RU')}</p>
                    ) : null}
                  </button>
                ))}
                {(grouped.get(status) ?? []).length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-slate-500">Пусто</p>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </div>
      {opened ? (
        <DealPanel
          deal={opened}
          statusLabels={statusLabels}
          onClose={() => setOpened(null)}
          onChange={applyDeal}
          onDeleted={() => removeDeal(opened.id)}
        />
      ) : null}
      {filterOpen ? (
        <DealFilterPopup
          value={filters}
          statusLabels={statusLabels}
          onClose={() => setFilterOpen(false)}
          onApply={(next) => {
            setFilters(next)
            setFilterOpen(false)
          }}
        />
      ) : null}
      {creating ? (
        <CreateDealModal
          onClose={() => setCreating(false)}
          onCreated={(deal) => {
            applyDeal(deal)
            setCreating(false)
          }}
        />
      ) : null}
    </div>
  )
}

function CreateDealModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (deal: DealDetail) => void
}) {
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [items, setItems] = useState<CatalogLine[]>([])
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchCounterparties().then(setCounterparties)
  }, [])

  function setItemQty(productId: string, quantity: number) {
    setItems((current) =>
      current
        .map((item) => (item.productId === productId ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0),
    )
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const title = String(data.get('title') ?? '').trim()
    const counterpartyId = String(data.get('counterpartyId') ?? '')
    if (!title || !counterpartyId || items.length === 0) {
      setError('Заполните контрагента, название и хотя бы одну позицию из каталога')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const due = String(data.get('dueDate') ?? '')
      const deal = await createDeal({
        counterpartyId,
        title,
        description: String(data.get('description') ?? '').trim() || undefined,
        dueDate: due ? new Date(due).toISOString() : undefined,
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      })
      onCreated(deal)
    } catch {
      setError('Не удалось создать сделку')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Modal title="Новая сделка" onClose={catalogOpen ? () => undefined : onClose}>
        <form onSubmit={onSubmit} className="mt-5 flex max-h-[70vh] flex-col gap-3 overflow-auto">
          <label className="text-xs font-medium text-secondary">
            Контрагент
            <select
              name="counterpartyId"
              required
              className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm"
            >
              <option value="">Выберите</option>
              {counterparties.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-secondary">
            Название
            <input name="title" required className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm" />
          </label>
          <label className="text-xs font-medium text-secondary">
            Описание
            <textarea name="description" rows={2} className="mt-1 w-full rounded-md border-2 border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-secondary">
            К какому числу
            <DateField name="dueDate" />
          </label>
          <div>
            <p className="text-xs font-medium text-secondary">Позиции</p>
            {items.length > 0 ? (
              <ul className="mt-1 divide-y divide-line rounded-md border-2 border-slate-300">
                {items.map((item) => (
                  <li key={item.productId} className="flex items-center gap-2 px-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{item.name}</p>
                      <p className="text-xs text-secondary">
                        {item.sku ? `${item.sku} · ` : ''}
                        {money(item.price)} / {item.unit}
                      </p>
                    </div>
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      value={item.quantity}
                      onChange={(event) => setItemQty(item.productId, Number(event.target.value) || 0)}
                      className="h-9 w-20 rounded-md border-2 border-slate-300 px-2 text-sm"
                      aria-label={`Количество ${item.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => setItemQty(item.productId, 0)}
                      className="text-xs text-secondary hover:text-foreground"
                    >
                      Убрать
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-secondary">Товары не выбраны</p>
            )}
            <button
              type="button"
              onClick={() => setCatalogOpen(true)}
              className="mt-2 h-10 w-full rounded-md border-2 border-slate-300 text-sm font-medium hover:bg-slate-50"
            >
              {items.length ? 'Добавить из каталога' : 'Выбрать из каталога'}
            </button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="h-10 px-3 text-sm text-secondary">
              Отмена
            </button>
            <button type="submit" disabled={busy} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary">
              Создать
            </button>
          </div>
        </form>
      </Modal>
      {catalogOpen ? (
        <ProductCatalogPicker
          selected={items}
          onClose={() => setCatalogOpen(false)}
          onConfirm={(lines) => {
            setItems(lines)
            setCatalogOpen(false)
            setError(null)
          }}
        />
      ) : null}
    </>
  )
}

const fieldClass = 'mt-1 h-10 w-full rounded-md border-2 border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500'

function DealFilterPopup({
  value,
  statusLabels,
  onClose,
  onApply,
}: {
  value: DealListFilters
  statusLabels: Record<DealStatus, string>
  onClose: () => void
  onApply: (next: DealListFilters) => void
}) {
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [people, setPeople] = useState<{ id: string; name: string }[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [draft, setDraft] = useState<DealListFilters>(value)

  useEffect(() => {
    void Promise.all([fetchCounterparties(), fetchAddressBook(), fetchProducts()]).then(
      ([nextCounterparties, book, nextProducts]) => {
        setCounterparties(nextCounterparties)
        setPeople(book.employees)
        setProducts(nextProducts)
      },
    )
  }, [])

  function setField<K extends keyof DealListFilters>(key: K, next: DealListFilters[K]) {
    setDraft((current) => ({ ...current, [key]: next || undefined }))
  }

  function toggleStatus(status: DealStatus) {
    setDraft((current) => {
      const selected = new Set(current.status ?? [])
      if (selected.has(status)) selected.delete(status)
      else selected.add(status)
      return { ...current, status: selected.size ? [...selected] : undefined }
    })
  }

  return (
    <Modal title="Фильтры" onClose={onClose} wide>
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          onApply(draft)
        }}
      >
        <label className="text-xs font-medium text-secondary">
          Контрагент
          <select
            value={draft.counterpartyId ?? ''}
            onChange={(event) => setField('counterpartyId', event.target.value)}
            className={fieldClass}
          >
            <option value="">Все</option>
            {counterparties.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-secondary">
          Ответственный
          <select
            value={draft.createdById ?? ''}
            onChange={(event) => setField('createdById', event.target.value)}
            className={fieldClass}
          >
            <option value="">Все</option>
            {people.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-secondary">
          Товар в заказе
          <select
            value={draft.productId ?? ''}
            onChange={(event) => setField('productId', event.target.value)}
            className={fieldClass}
          >
            <option value="">Все</option>
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.sku ? `${item.sku} · ` : ''}
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-secondary">
            Срок с
            <DateField
              value={draft.dueFrom ?? ''}
              onChange={(event) => setField('dueFrom', event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="text-xs font-medium text-secondary">
            Срок по
            <DateField
              value={draft.dueTo ?? ''}
              onChange={(event) => setField('dueTo', event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="text-xs font-medium text-secondary">
            Создано с
            <DateField
              value={draft.createdFrom ?? ''}
              onChange={(event) => setField('createdFrom', event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="text-xs font-medium text-secondary">
            Создано по
            <DateField
              value={draft.createdTo ?? ''}
              onChange={(event) => setField('createdTo', event.target.value)}
              className={fieldClass}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={Boolean(draft.overdue)}
            onChange={(event) => setDraft((current) => ({ ...current, overdue: event.target.checked || undefined }))}
          />
          Только просроченные
        </label>
        <div>
          <p className="mb-2 text-xs font-medium text-secondary">Статусы</p>
          <div className="grid gap-1 sm:grid-cols-2">
            {DEAL_STATUSES.map((status) => (
              <label key={status} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={Boolean(draft.status?.includes(status))}
                  onChange={() => toggleStatus(status)}
                />
                {statusLabels[status]}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setDraft(emptyFilters)
              onApply(emptyFilters)
            }}
            className="h-10 px-3 text-sm text-secondary"
          >
            Сбросить
          </button>
          <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary">
            Применить
          </button>
        </div>
      </form>
    </Modal>
  )
}
