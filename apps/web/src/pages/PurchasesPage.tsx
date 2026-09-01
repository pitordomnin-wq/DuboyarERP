import { useEffect, useState, type FormEvent } from 'react'
import { ProductCatalogPicker, type CatalogLine } from '@/components/products/ProductCatalogPicker'
import { DateField } from '@/components/DateField'
import { Modal } from '@/components/tasks/TaskModal'
import { fetchCounterparties, type Counterparty } from '@/lib/counterparties-api'
import { money } from '@/lib/products-api'
import {
  addPurchaseDocument,
  createPurchase,
  deletePurchase,
  fetchPurchase,
  fetchPurchases,
  postPurchase,
  purchaseDocumentUrl,
  type PurchaseCard,
  type PurchaseRow,
} from '@/lib/purchases-api'
import { fetchWarehouses, type Warehouse } from '@/lib/warehouse-api'

const STATUS_LABEL: Record<PurchaseRow['status'], string> = {
  DRAFT: 'Черновик',
  POSTED: 'Проведена',
}

export function PurchasesPage() {
  const [rows, setRows] = useState<PurchaseRow[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [opened, setOpened] = useState<string | null>(null)

  function reload() {
    setLoading(true)
    return fetchPurchases(query)
      .then(setRows)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload()
    }, 200)
    return () => window.clearTimeout(timer)
  }, [query])

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-5 md:px-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Закупки</h1>
          <p className="mt-1 text-sm text-secondary">Сырьё, расходники и заготовки на склад. Каталог магазина — в «Товарах».</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary shadow-[0_2px_10px_rgba(47,90,112,0.22)] transition-opacity duration-150 hover:opacity-95"
        >
          Новая закупка
        </button>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Поиск по номеру, названию или контрагенту"
        className="mb-4 h-10 max-w-md rounded-xl border border-line bg-white/70 px-3.5 text-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:shadow-[0_0_0_3px_rgba(227,148,33,0.22)]"
      />

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl glass">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-secondary">
            <tr>
              <th className="border-b border-line px-3 py-2">Номер</th>
              <th className="border-b border-line px-3 py-2">Наименование</th>
              <th className="border-b border-line px-3 py-2">Контрагент</th>
              <th className="border-b border-line px-3 py-2">Сумма</th>
              <th className="border-b border-line px-3 py-2">Дата</th>
              <th className="border-b border-line px-3 py-2">Статус</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-secondary">
                  Загрузка
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-secondary">
                  Закупок нет
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-b border-slate-200 hover:bg-slate-50"
                  onClick={() => setOpened(row.id)}
                >
                  <td className="px-3 py-2.5 tabular-nums text-secondary">{row.number}</td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{row.title}</td>
                  <td className="px-3 py-2.5 text-secondary">{row.counterparty.name}</td>
                  <td className="px-3 py-2.5 tabular-nums text-secondary">{money(row.total)}</td>
                  <td className="px-3 py-2.5 text-secondary">{formatDate(row.purchasedAt)}</td>
                  <td className="px-3 py-2.5 text-secondary">{STATUS_LABEL[row.status]}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {creating ? (
        <PurchaseFormModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            void reload()
          }}
        />
      ) : null}
      {opened ? (
        <PurchaseCardModal
          id={opened}
          onClose={() => setOpened(null)}
          onChanged={() => void reload()}
        />
      ) : null}
    </div>
  )
}

function PurchaseFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<CatalogLine[]>([])
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([fetchCounterparties(), fetchWarehouses()]).then(([nextCounterparties, nextWarehouses]) => {
      setCounterparties(nextCounterparties)
      setWarehouses(nextWarehouses)
    })
  }, [])

  function setItemQty(productId: string, quantity: number) {
    setItems((current) =>
      current
        .map((item) => (item.productId === productId ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0),
    )
  }

  function setItemPrice(productId: string, price: number) {
    setItems((current) => current.map((item) => (item.productId === productId ? { ...item, price } : item)))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const title = String(data.get('title') ?? '').trim()
    const counterpartyId = String(data.get('counterpartyId') ?? '')
    const warehouseId = String(data.get('warehouseId') ?? '')
    if (!title || !counterpartyId || !warehouseId) return
    if (items.length === 0) {
      setError('Добавьте хотя бы одну позицию')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createPurchase({
        title,
        counterpartyId,
        warehouseId,
        purchasedAt: String(data.get('purchasedAt') ?? ''),
        note: String(data.get('note') ?? '').trim() || undefined,
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, price: item.price })),
      })
      onCreated()
    } catch {
      setError('Не удалось сохранить закупку')
    } finally {
      setBusy(false)
    }
  }

  const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0)

  return (
    <>
      <Modal title="Новая закупка" onClose={onClose} wide>
        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
          <label className="text-xs font-medium text-secondary">
            Наименование
            <input name="title" required className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm" />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-medium text-secondary">
              Контрагент
              <select name="counterpartyId" required className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm">
                <option value="">Выберите</option>
                {counterparties.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-secondary">
              Склад
              <select name="warehouseId" required className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm">
                <option value="">Выберите</option>
                {warehouses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-xs font-medium text-secondary">
            Дата
            <DateField name="purchasedAt" required defaultValue={todayInput()} />
          </label>
          <div>
            <p className="text-xs font-medium text-secondary">Позиции</p>
            {items.length > 0 ? (
              <ul className="mt-1 divide-y divide-line rounded-md border-2 border-slate-300">
                {items.map((item) => (
                  <li key={item.productId} className="flex flex-wrap items-center gap-2 px-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{item.name}</p>
                      <p className="text-xs text-secondary">
                        {item.sku ? `${item.sku} · ` : ''}
                        {item.unit}
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
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.price}
                      onChange={(event) => setItemPrice(item.productId, Number(event.target.value) || 0)}
                      className="h-9 w-24 rounded-md border-2 border-slate-300 px-2 text-sm"
                      aria-label={`Цена ${item.name}`}
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
              <p className="mt-1 text-sm text-secondary">Позиции не выбраны</p>
            )}
            <button
              type="button"
              onClick={() => setCatalogOpen(true)}
              className="mt-2 h-10 w-full rounded-md border-2 border-slate-300 text-sm font-medium hover:bg-slate-50"
            >
              {items.length ? 'Добавить со склада' : 'Выбрать со склада'}
            </button>
            {items.length > 0 ? <p className="mt-2 text-sm text-secondary">Сумма {money(total)}</p> : null}
          </div>
          <label className="text-xs font-medium text-secondary">
            Комментарий
            <input name="note" className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm" />
          </label>
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
          kind="supply"
          title="Склад"
          emptyHint="На складе нет сырья и расходников. Добавьте позиции в разделе «Склад»."
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

function PurchaseCardModal({
  id,
  onClose,
  onChanged,
}: {
  id: string
  onClose: () => void
  onChanged: () => void
}) {
  const [card, setCard] = useState<PurchaseCard | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  async function load() {
    setCard(await fetchPurchase(id))
  }

  useEffect(() => {
    void load()
  }, [id])

  async function onPost() {
    setBusy(true)
    setError(null)
    try {
      setCard(await postPurchase(id))
      onChanged()
    } catch {
      setError('Не удалось провести закупку')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    setBusy(true)
    setError(null)
    try {
      await deletePurchase(id)
      onChanged()
      onClose()
    } catch {
      setConfirming(false)
      setError(
        card?.status === 'POSTED'
          ? 'Нельзя удалить: часть товара уже списана со склада'
          : 'Не удалось удалить закупку',
      )
    } finally {
      setBusy(false)
    }
  }

  async function onAddDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const title = String(data.get('title') ?? '').trim()
    if (!title) return
    setBusy(true)
    setError(null)
    try {
      await addPurchaseDocument(id, {
        title,
        number: String(data.get('number') ?? '').trim() || undefined,
        issuedAt: String(data.get('issuedAt') ?? '') || undefined,
        note: String(data.get('note') ?? '').trim() || undefined,
      })
      form.reset()
      await load()
    } catch {
      setError('Не удалось сохранить документ')
    } finally {
      setBusy(false)
    }
  }

  if (!card) {
    return (
      <Modal title="Закупка" onClose={onClose} wide>
        <p className="mt-4 text-sm text-secondary">Загрузка</p>
      </Modal>
    )
  }

  return (
    <>
    <Modal title={`${card.number} · ${card.title}`} onClose={onClose} wide>
      <div className="mt-4 flex flex-col gap-4">
        <p className="text-sm text-secondary">
          {card.counterparty.name}
          {card.counterparty.inn ? ` · ИНН ${card.counterparty.inn}` : ''} · {card.warehouse.name} ·{' '}
          {formatDate(card.purchasedAt)} · {STATUS_LABEL[card.status]}
        </p>
        {card.note ? <p className="text-sm text-foreground">{card.note}</p> : null}
        <div className="overflow-auto rounded-md border-2 border-slate-300">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-secondary">
              <tr>
                <th className="border-b border-line px-3 py-2">Позиция</th>
                <th className="border-b border-line px-3 py-2">Кол-во</th>
                <th className="border-b border-line px-3 py-2">Цена</th>
                <th className="border-b border-line px-3 py-2">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {card.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-200">
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2 tabular-nums text-secondary">
                    {item.quantity.toLocaleString('ru-RU')} {item.unit}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-secondary">{money(item.price)}</td>
                  <td className="px-3 py-2 tabular-nums text-secondary">{money(item.quantity * item.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm font-medium text-foreground">Итого {money(card.total)}</p>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">Счета и документы</p>
          {card.documents.length === 0 ? (
            <p className="mb-3 text-sm text-secondary">Документов нет</p>
          ) : (
            <ul className="mb-3 divide-y divide-line rounded-md border-2 border-slate-300">
              {card.documents.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-2 px-3 py-2 text-sm">
                  <button type="button" onClick={() => setPreviewId(item.id)} className="min-w-0 flex-1 text-left">
                    <p className="text-foreground">{item.title}</p>
                    <p className="text-xs text-secondary">
                      {item.number ? `№ ${item.number}` : 'без номера'}
                      {item.issuedAt ? ` · ${formatDate(item.issuedAt)}` : ''}
                      {item.note ? ` · ${item.note}` : ''}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPreviewId(item.id)}
                      className="text-xs text-secondary hover:text-foreground"
                    >
                      Посмотреть
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={onAddDocument} className="grid gap-2 rounded-md border-2 border-slate-300 p-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-secondary sm:col-span-2">
              Название
              <input name="title" required placeholder="Счёт поставщика" className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm" />
            </label>
            <label className="text-xs font-medium text-secondary">
              Номер
              <input name="number" className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm" />
            </label>
            <label className="text-xs font-medium text-secondary">
              Дата документа
              <DateField name="issuedAt" />
            </label>
            <label className="text-xs font-medium text-secondary sm:col-span-2">
              Комментарий
              <input name="note" className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm" />
            </label>
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" disabled={busy} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary">
                Прикрепить
              </button>
            </div>
          </form>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {confirming ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-foreground">Удалить закупку?</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onDelete()}
                className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
              >
                Да
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
                className="h-10 rounded-md border-2 border-slate-300 px-4 text-sm disabled:opacity-60"
              >
                Нет
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
              className="text-sm text-secondary transition-colors duration-200 hover:text-destructive disabled:opacity-60"
            >
              Удалить
            </button>
          )}
          {card.status === 'DRAFT' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onPost()}
              className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary"
            >
              Провести
            </button>
          ) : (
            <p className="text-sm text-secondary">Проведена {card.createdBy.name}</p>
          )}
        </div>
      </div>
    </Modal>
    {previewId ? (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <button type="button" aria-label="Закрыть документ" className="glass-scrim absolute inset-0" onClick={() => setPreviewId(null)} />
        <div className="glass-strong relative z-10 flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl">
          <div className="flex items-center justify-end border-b border-line px-3 py-2">
            <button type="button" onClick={() => setPreviewId(null)} className="h-10 px-3 text-sm text-secondary">
              Закрыть
            </button>
          </div>
          <iframe title="Документ" className="min-h-0 flex-1 w-full" src={purchaseDocumentUrl(id, previewId)} />
        </div>
      </div>
    ) : null}
    </>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ru-RU')
}

function todayInput() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
