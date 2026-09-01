import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/tasks/TaskModal'
import { StockPositionDialog, UnitInput, formatQty } from '@/components/warehouse/StockPositionDialog'
import {
  PRODUCT_KIND_LABEL,
  createStockItem,
  createWarehouse,
  createWarehouseCategory,
  deleteWarehouseCategory,
  fetchProductGroups,
  fetchStock,
  fetchWarehouseCategories,
  fetchWarehouses,
  reorderWarehouseCategories,
  updateWarehouseCategory,
  postStockMovement,
  type ProductGroup,
  type ProductKind,
  type StockMovementType,
  type StockRow,
  type Warehouse,
  type WarehouseCategory,
} from '@/lib/warehouse-api'

export function WarehousePage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [categories, setCategories] = useState<WarehouseCategory[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [tab, setTab] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingWarehouse, setCreatingWarehouse] = useState(false)
  const [creatingItem, setCreatingItem] = useState(false)
  const [moving, setMoving] = useState<'RECEIPT' | 'WRITEOFF' | null>(null)
  const [opened, setOpened] = useState<string | null>(null)
  const [editingTabs, setEditingTabs] = useState(false)

  async function loadWarehouses(selectId?: string) {
    const list = await fetchWarehouses()
    setWarehouses(list)
    setActiveId((current) => selectId ?? current ?? list[0]?.id ?? null)
  }

  async function loadCategories() {
    setCategories(await fetchWarehouseCategories())
  }

  useEffect(() => {
    void loadWarehouses()
    void loadCategories()
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

  useEffect(() => {
    if (tab !== 'all' && categories.length && !categories.some((c) => c.id === tab)) {
      setTab('all')
    }
  }, [categories, tab])

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="shrink-0 border-b border-line md:w-72 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3 md:px-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Склады</p>
          <button type="button" onClick={() => setCreatingWarehouse(true)} className="text-xs text-secondary hover:text-foreground">
            Новый
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-2">
          {warehouses.map((item) => {
            const active = item.id === activeId
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveId(item.id)}
                className={`side-item min-w-[220px] shrink-0 flex-col items-start md:min-w-0 ${active ? 'side-item-active' : ''}`}
              >
                <span className="text-sm">{item.name}</span>
                {item.address ? (
                  <span className="text-xs leading-snug text-secondary">{item.address}</span>
                ) : null}
              </button>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-4 md:px-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setTab('all')}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors duration-150 ${
                tab === 'all'
                  ? 'bg-primary font-semibold text-on-primary shadow-[0_1px_6px_rgba(47,90,112,0.28)]'
                  : 'text-secondary hover:bg-white/60 hover:text-foreground'
              }`}
            >
              Все
            </button>
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors duration-150 ${
                  tab === item.id
                    ? 'bg-primary font-semibold text-on-primary shadow-[0_1px_6px_rgba(47,90,112,0.28)]'
                    : 'text-secondary hover:bg-white/60 hover:text-foreground'
                }`}
              >
                {item.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setEditingTabs(true)}
              className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-secondary hover:bg-white/60 hover:text-foreground"
            >
              Настроить
            </button>
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={!activeId}
              onClick={() => setCreatingItem(true)}
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary shadow-[0_2px_10px_rgba(47,90,112,0.22)] transition-opacity duration-150 hover:opacity-95 disabled:opacity-50"
            >
              Новая позиция
            </button>
            <button
              type="button"
              disabled={!activeId}
              onClick={() => setMoving('RECEIPT')}
              className="inline-flex h-10 items-center rounded-xl border border-line bg-white/70 px-4 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-white/90 disabled:opacity-50"
            >
              Оприходование
            </button>
            <button
              type="button"
              disabled={!activeId}
              onClick={() => setMoving('WRITEOFF')}
              className="inline-flex h-10 items-center rounded-xl border border-line bg-white/70 px-4 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-white/90 disabled:opacity-50"
            >
              Списание
            </button>
          </div>
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по названию или артикулу"
          className="mb-4 h-10 max-w-md rounded-xl border border-line bg-white/70 px-3.5 text-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:shadow-[0_0_0_3px_rgba(227,148,33,0.22)]"
        />

        <div className="min-h-0 flex-1 overflow-auto rounded-2xl glass">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-secondary">
              <tr>
                <th className="border-b border-line px-3 py-2">Артикул</th>
                <th className="border-b border-line px-3 py-2">Наименование</th>
                <th className="border-b border-line px-3 py-2">Количество</th>
                <th className="border-b border-line px-3 py-2">Ед.</th>
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
          categories={categories}
          onClose={() => setCreatingItem(false)}
          onCreated={() => {
            setCreatingItem(false)
            void fetchStock(activeId, tab, query).then(setRows)
          }}
          warehouseId={activeId}
        />
      ) : null}
      {editingTabs ? (
        <CategoriesModal
          categories={categories}
          onClose={() => setEditingTabs(false)}
          onChanged={() => void loadCategories()}
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
        <StockPositionDialog
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

function CategoriesModal({
  categories,
  onClose,
  onChanged,
}: {
  categories: WarehouseCategory[]
  onClose: () => void
  onChanged: () => void
}) {
  const [rows, setRows] = useState(categories)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setRows(categories)
  }, [categories])

  async function addCategory(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await createWarehouseCategory(name.trim())
      setName('')
      onChanged()
    } catch {
      setError('Не удалось создать вкладку')
    } finally {
      setBusy(false)
    }
  }

  async function rename(id: string, next: string) {
    const trimmed = next.trim()
    if (!trimmed) return
    try {
      await updateWarehouseCategory(id, { name: trimmed })
      onChanged()
    } catch {
      setError('Имя занято или недоступно')
    }
  }

  async function remove(id: string) {
    setError(null)
    try {
      await deleteWarehouseCategory(id)
      onChanged()
    } catch (err) {
      setError(err instanceof Error && err.message === 'category_in_use' ? 'Во вкладке есть товары' : 'Нельзя удалить')
    }
  }

  async function move(id: string, dir: -1 | 1) {
    const index = rows.findIndex((row) => row.id === id)
    const next = index + dir
    if (index < 0 || next < 0 || next >= rows.length) return
    const ids = rows.map((row) => row.id)
    ;[ids[index], ids[next]] = [ids[next], ids[index]]
    setRows(ids.map((itemId, position) => ({ ...rows.find((r) => r.id === itemId)!, position })))
    await reorderWarehouseCategories(ids)
    onChanged()
  }

  return (
    <Modal title="Вкладки склада" onClose={onClose}>
      <div className="mt-4 flex flex-col gap-3">
        <ul className="divide-y divide-line rounded-xl border border-line">
          {rows.map((row, index) => (
            <li key={row.id} className="flex items-center gap-2 px-3 py-2">
              <input
                defaultValue={row.name}
                onBlur={(event) => {
                  if (event.target.value.trim() !== row.name) void rename(row.id, event.target.value)
                }}
                className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-white px-2 text-sm"
              />
              <button type="button" disabled={index === 0} onClick={() => void move(row.id, -1)} className="text-xs text-secondary disabled:opacity-40">
                ↑
              </button>
              <button
                type="button"
                disabled={index === rows.length - 1}
                onClick={() => void move(row.id, 1)}
                className="text-xs text-secondary disabled:opacity-40"
              >
                ↓
              </button>
              <button type="button" onClick={() => void remove(row.id)} className="text-xs text-destructive">
                Удалить
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={(event) => void addCategory(event)} className="flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Новая вкладка"
            className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm"
          />
          <button type="submit" disabled={busy} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">
            Добавить
          </button>
        </form>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="h-10 px-3 text-sm text-secondary">
            Закрыть
          </button>
        </div>
      </div>
    </Modal>
  )
}

function ItemFormModal({
  warehouseId,
  categories,
  onClose,
  onCreated,
}: {
  warehouseId: string
  categories: WarehouseCategory[]
  onClose: () => void
  onCreated: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<ProductGroup[]>([])
  const [groupMode, setGroupMode] = useState<'none' | 'existing' | 'new'>('none')

  useEffect(() => {
    void fetchProductGroups().then(setGroups)
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setError(null)
    try {
      const groupName = String(data.get('groupName') ?? '').trim()
      const groupId = String(data.get('groupId') ?? '').trim()
      await createStockItem(warehouseId, {
        name: String(data.get('name') ?? '').trim(),
        sku: String(data.get('sku') ?? '').trim(),
        kind: String(data.get('kind')) as ProductKind,
        categoryId: String(data.get('categoryId') ?? ''),
        unit: String(data.get('unit') ?? '').trim() || 'шт',
        price: Number(data.get('price') || 0),
        ...(groupMode === 'new' && groupName ? { groupName } : {}),
        ...(groupMode === 'existing' && groupId ? { groupId } : {}),
      })
      onCreated()
    } catch {
      setError('Не удалось сохранить. Проверьте название и артикул — он должен быть уникальным.')
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
          Артикул
          <input name="sku" required className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
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
            Вкладка
            <select
              name="categoryId"
              required
              defaultValue={categories.find((c) => c.name === 'Сырьё')?.id ?? categories[0]?.id}
              className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm"
            >
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="text-xs font-medium text-secondary">
          Группа (необязательно)
          <select
            value={groupMode}
            onChange={(event) => setGroupMode(event.target.value as typeof groupMode)}
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm"
          >
            <option value="none">Без группы</option>
            <option value="existing">Выбрать существующую</option>
            <option value="new">Создать новую</option>
          </select>
        </label>
        {groupMode === 'existing' ? (
          <select name="groupId" className="h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm">
            <option value="">Выберите</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        ) : null}
        {groupMode === 'new' ? (
          <input name="groupName" placeholder="Название группы" className="h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm" />
        ) : null}
        <label className="text-xs font-medium text-secondary">
          Единица измерения
          <UnitInput defaultValue="шт" />
        </label>
        <label className="text-xs font-medium text-secondary">
          Учётная цена, ₽
          <input name="price" type="number" min="0" step="0.01" defaultValue={0} className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm" />
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
