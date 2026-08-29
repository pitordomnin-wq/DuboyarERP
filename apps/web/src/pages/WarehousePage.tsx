import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/tasks/TaskModal'
import {
  PRODUCT_KIND_LABEL,
  createStockItem,
  createWarehouse,
  fetchStock,
  fetchStockItem,
  fetchWarehouses,
  postStockMovement,
  updateStockItem,
  type ProductKind,
  type StockCard,
  type StockMovementType,
  type StockRow,
  type Warehouse,
} from '@/lib/warehouse-api'

const TABS: { id: ProductKind | 'all'; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'CONSUMABLE', label: 'Расходники' },
  { id: 'MATERIAL', label: 'Сырьё' },
  { id: 'SEMI_FINISHED', label: 'Заготовки' },
  { id: 'FINISHED', label: 'Готовая продукция' },
]

export function WarehousePage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [tab, setTab] = useState<ProductKind | 'all'>('all')
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingWarehouse, setCreatingWarehouse] = useState(false)
  const [creatingItem, setCreatingItem] = useState(false)
  const [moving, setMoving] = useState<'RECEIPT' | 'WRITEOFF' | null>(null)
  const [opened, setOpened] = useState<string | null>(null)

  async function loadWarehouses(selectId?: string) {
    const list = await fetchWarehouses()
    setWarehouses(list)
    setActiveId((current) => selectId ?? current ?? list[0]?.id ?? null)
  }

  useEffect(() => {
    void loadWarehouses()
  }, [])

  useEffect(() => {
    if (!activeId) return
    const timer = window.setTimeout(() => {
      setLoading(true)
      fetchStock(activeId, tab, query)
        .then(setRows)
        .finally(() => setLoading(false))
    }, 200)
    return () => window.clearTimeout(timer)
  }, [activeId, tab, query])

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="shrink-0 border-b-2 border-slate-300 md:w-72 md:border-r-2 md:border-b-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3 md:px-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Склады</p>
          <button type="button" onClick={() => setCreatingWarehouse(true)} className="text-xs text-secondary hover:text-foreground">
            Новый
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-2">
          {warehouses.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveId(item.id)}
              className={`min-w-[220px] shrink-0 rounded-md px-3 py-2 text-left md:min-w-0 ${
                item.id === activeId ? 'bg-slate-200 text-foreground' : 'text-secondary hover:bg-slate-100'
              }`}
            >
              <p className="text-sm font-medium">{item.name}</p>
              {item.address ? <p className="mt-0.5 text-xs leading-snug text-secondary">{item.address}</p> : null}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-5 md:px-8">
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!activeId}
            onClick={() => setCreatingItem(true)}
            className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
          >
            Новая позиция
          </button>
          <button
            type="button"
            disabled={!activeId}
            onClick={() => setMoving('RECEIPT')}
            className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
          >
            Оприходование
          </button>
          <button
            type="button"
            disabled={!activeId}
            onClick={() => setMoving('WRITEOFF')}
            className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
          >
            Списание
          </button>
        </div>

        <div className="mb-3 flex gap-1 overflow-x-auto">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`shrink-0 whitespace-nowrap rounded-md border-2 px-3 py-1.5 text-sm ${
                tab === item.id ? 'border-foreground bg-slate-100' : 'border-slate-300 text-secondary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по названию или номеру"
          className="mb-4 h-10 max-w-md rounded-md border-2 border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
        />

        <div className="min-h-0 flex-1 overflow-auto rounded-md border-2 border-slate-300 bg-white">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-secondary">
              <tr>
                <th className="border-b-2 border-slate-300 px-3 py-2">Номер</th>
                <th className="border-b-2 border-slate-300 px-3 py-2">Наименование</th>
                <th className="border-b-2 border-slate-300 px-3 py-2">Количество</th>
                <th className="border-b-2 border-slate-300 px-3 py-2">Ед.</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-secondary">
                    Загрузка
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-secondary">
                    Позиций нет
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-slate-200 hover:bg-slate-50"
                    onClick={() => setOpened(row.id)}
                  >
                    <td className="px-3 py-2.5 tabular-nums text-secondary">{row.sku ?? '—'}</td>
                    <td className="px-3 py-2.5 font-medium text-foreground">{row.name}</td>
                    <td className="px-3 py-2.5 tabular-nums text-secondary">{formatQty(row.quantity)}</td>
                    <td className="px-3 py-2.5 text-secondary">{row.unit}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {creatingWarehouse ? (
        <WarehouseFormModal
          onClose={() => setCreatingWarehouse(false)}
          onCreated={(item) => {
            setCreatingWarehouse(false)
            void loadWarehouses(item.id)
          }}
        />
      ) : null}
      {creatingItem && activeId ? (
        <ItemFormModal
          onClose={() => setCreatingItem(false)}
          onCreated={() => {
            setCreatingItem(false)
            void fetchStock(activeId, tab, query).then(setRows)
          }}
          warehouseId={activeId}
        />
      ) : null}
      {moving && activeId ? (
        <MovementFormModal
          warehouseId={activeId}
          type={moving}
          onClose={() => setMoving(null)}
          onDone={() => {
            setMoving(null)
            void fetchStock(activeId, tab, query).then(setRows)
          }}
        />
      ) : null}
      {opened && activeId ? (
        <StockCardModal
          warehouseId={activeId}
          productId={opened}
          onClose={() => setOpened(null)}
          onChanged={() => void fetchStock(activeId, tab, query).then(setRows)}
        />
      ) : null}
    </div>
  )
}

function WarehouseFormModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (item: Warehouse) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') ?? '').trim()
    if (!name) return
    setBusy(true)
    setError(null)
    try {
      onCreated(
        await createWarehouse({
          name,
          address: String(data.get('address') ?? '').trim() || undefined,
        }),
      )
    } catch {
      setError('Не удалось создать склад')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Новый склад" onClose={onClose}>
      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
        <label className="text-xs font-medium text-secondary">
          Название
          <input name="name" required className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm" />
        </label>
        <label className="text-xs font-medium text-secondary">
          Адрес
          <input name="address" className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm" />
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
  )
}

function ItemFormModal({
  warehouseId,
  onClose,
  onCreated,
}: {
  warehouseId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setError(null)
    try {
      await createStockItem(warehouseId, {
        name: String(data.get('name') ?? '').trim(),
        sku: String(data.get('sku') ?? '').trim(),
        kind: String(data.get('kind')) as ProductKind,
        unit: String(data.get('unit') ?? '').trim() || 'шт',
      })
      onCreated()
    } catch {
      setError('Не удалось сохранить. Проверьте название и номер — он должен быть уникальным.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Новая позиция" onClose={onClose}>
      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
        <label className="text-xs font-medium text-secondary">
          Наименование
          <input name="name" required className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm" />
        </label>
        <label className="text-xs font-medium text-secondary">
          Номер
          <input name="sku" required className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm" />
        </label>
        <label className="text-xs font-medium text-secondary">
          Тип
          <select name="kind" defaultValue="MATERIAL" className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm">
            {(Object.keys(PRODUCT_KIND_LABEL) as ProductKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {PRODUCT_KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-secondary">
          Единица измерения
          <UnitInput defaultValue="шт" />
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
  )
}

function MovementFormModal({
  warehouseId,
  type,
  onClose,
  onDone,
}: {
  warehouseId: string
  type: StockMovementType
  onClose: () => void
  onDone: () => void
}) {
  const [items, setItems] = useState<StockRow[]>([])
  const [productId, setProductId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selected = items.find((item) => item.id === productId)

  useEffect(() => {
    void fetchStock(warehouseId).then(setItems)
  }, [warehouseId])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const productId = String(data.get('productId') ?? '')
    const quantity = Number(data.get('quantity'))
    if (!productId || !quantity) {
      setError('Выберите позицию и количество')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await postStockMovement(warehouseId, {
        productId,
        type,
        quantity,
        note: String(data.get('note') ?? '').trim() || undefined,
      })
      onDone()
    } catch {
      setError(type === 'WRITEOFF' ? 'Недостаточно остатка или не удалось провести' : 'Не удалось провести')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={type === 'RECEIPT' ? 'Оприходование' : 'Списание'} onClose={onClose}>
      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
        <label className="text-xs font-medium text-secondary">
          Позиция
          <select
            name="productId"
            required
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm"
          >
            <option value="">Выберите</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.sku ? `${item.sku} · ` : ''}
                {item.name} ({formatQty(item.quantity)} {item.unit})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-secondary">
          Количество
          <span className="mt-1 flex gap-2">
            <input
              name="quantity"
              type="number"
              min="0.001"
              step="any"
              required
              className="h-10 min-w-0 flex-1 rounded-md border-2 border-slate-300 px-3 text-sm"
            />
            <span className="flex h-10 min-w-12 items-center rounded-md border-2 border-slate-300 px-3 text-sm text-secondary">
              {selected?.unit ?? 'ед.'}
            </span>
          </span>
        </label>
        <label className="text-xs font-medium text-secondary">
          Комментарий
          <input name="note" className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm" />
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="mt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 px-3 text-sm text-secondary">
            Отмена
          </button>
          <button type="submit" disabled={busy || items.length === 0} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60">
            Провести
          </button>
        </div>
      </form>
    </Modal>
  )
}

function StockCardModal({
  warehouseId,
  productId,
  onClose,
  onChanged,
}: {
  warehouseId: string
  productId: string
  onClose: () => void
  onChanged: () => void
}) {
  const [card, setCard] = useState<StockCard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setCard(await fetchStockItem(warehouseId, productId))
  }

  useEffect(() => {
    void load()
  }, [warehouseId, productId])

  async function saveUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const unit = String(data.get('unit') ?? '').trim() || 'шт'
    setBusy(true)
    setError(null)
    try {
      await updateStockItem(warehouseId, productId, { unit })
      await load()
      onChanged()
    } catch {
      setError('Не удалось сохранить единицу измерения')
    } finally {
      setBusy(false)
    }
  }

  async function move(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const quantity = Number(data.get('quantity'))
    if (!quantity) return
    setBusy(true)
    setError(null)
    try {
      await postStockMovement(warehouseId, {
        productId,
        type: String(data.get('type')) as 'RECEIPT' | 'WRITEOFF',
        quantity,
        note: String(data.get('note') ?? '').trim() || undefined,
      })
      event.currentTarget.reset()
      await load()
      onChanged()
    } catch {
      setError('Недостаточно остатка или не удалось провести')
    } finally {
      setBusy(false)
    }
  }

  if (!card) {
    return (
      <Modal title="Позиция" onClose={onClose}>
        <p className="mt-4 text-sm text-secondary">Загрузка</p>
      </Modal>
    )
  }

  return (
    <Modal title={card.product.name} onClose={onClose}>
      <div className="mt-4 flex max-h-[70vh] flex-col gap-4 overflow-auto">
        <p className="text-sm text-secondary">
          {card.product.sku ?? 'без номера'} · {PRODUCT_KIND_LABEL[card.product.kind]} · {formatQty(card.quantity)}{' '}
          {card.product.unit}
        </p>
        <form onSubmit={saveUnit} className="flex flex-col gap-2 rounded-md border-2 border-slate-300 p-3">
          <label className="text-xs font-medium text-secondary">
            Единица измерения
            <UnitInput key={card.product.unit} defaultValue={card.product.unit} />
          </label>
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary">
              Сохранить
            </button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
        <form onSubmit={move} className="grid grid-cols-2 gap-2 rounded-md border-2 border-slate-300 p-3">
          <label className="text-xs font-medium text-secondary">
            Проводка
            <select name="type" className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm">
              <option value="RECEIPT">Приход</option>
              <option value="WRITEOFF">Списание</option>
            </select>
          </label>
          <label className="text-xs font-medium text-secondary">
            Количество
            <span className="mt-1 flex gap-2">
              <input
                name="quantity"
                type="number"
                min="0.001"
                step="any"
                required
                className="h-10 min-w-0 flex-1 rounded-md border-2 border-slate-300 px-3 text-sm"
              />
              <span className="flex h-10 min-w-12 items-center rounded-md border-2 border-slate-300 px-3 text-sm text-secondary">
                {card.product.unit}
              </span>
            </span>
          </label>
          <label className="col-span-2 text-xs font-medium text-secondary">
            Комментарий
            <input name="note" className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm" />
          </label>
          {error ? <p className="col-span-2 text-sm text-destructive">{error}</p> : null}
          <div className="col-span-2 flex justify-end">
            <button type="submit" disabled={busy} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary">
              Провести
            </button>
          </div>
        </form>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">Движения</p>
          {card.movements.length === 0 ? (
            <p className="text-sm text-secondary">Проводок нет — остаток нулевой</p>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-md border-2 border-slate-300">
              {card.movements.map((item) => (
                <li key={item.id} className="px-3 py-2 text-sm">
                  <p className="text-foreground">
                    {item.type === 'RECEIPT' ? 'Приход' : 'Списание'} {formatQty(item.quantity)} {card.product.unit}
                  </p>
                  <p className="text-xs text-secondary">
                    {item.createdBy.name} · {new Date(item.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                    {item.note ? ` · ${item.note}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}

function formatQty(value: number) {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 3 })
}

const UNIT_SUGGESTIONS = ['шт', 'компл', 'уп', 'кг', 'г', 'т', 'м', 'м.п.', 'м²', 'м³', 'л', 'мл', 'лист', 'рул']

function UnitInput({ defaultValue }: { defaultValue?: string }) {
  return (
    <>
      <input
        name="unit"
        list="stock-units"
        defaultValue={defaultValue ?? 'шт'}
        maxLength={20}
        className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
      />
      <datalist id="stock-units">
        {UNIT_SUGGESTIONS.map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>
    </>
  )
}
