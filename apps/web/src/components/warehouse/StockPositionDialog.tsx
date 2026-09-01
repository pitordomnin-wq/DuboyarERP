import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, X } from 'lucide-react'
import { money } from '@/lib/products-api'
import {
  PRODUCT_KIND_LABEL,
  deleteStockItem,
  fetchProductGroups,
  fetchStockItem,
  fetchWarehouseCategories,
  postStockMovement,
  updateStockItem,
  type ProductGroup,
  type ProductKind,
  type StockCard,
  type StockMovement,
  type WarehouseCategory,
} from '@/lib/warehouse-api'

const UNIT_SUGGESTIONS = ['шт', 'компл', 'уп', 'кг', 'г', 'т', 'м', 'м.п.', 'м²', 'м³', 'л', 'мл', 'лист', 'рул']

export function StockPositionDialog({
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
  const [categories, setCategories] = useState<WarehouseCategory[]>([])
  const [groups, setGroups] = useState<ProductGroup[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load() {
    setCard(await fetchStockItem(warehouseId, productId))
  }

  useEffect(() => {
    void load()
    void fetchWarehouseCategories().then(setCategories)
    void fetchProductGroups().then(setGroups)
  }, [warehouseId, productId])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  async function saveCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setSaveError(null)
    try {
      const groupName = String(data.get('groupName') ?? '').trim()
      await updateStockItem(warehouseId, productId, {
        name: String(data.get('name') ?? '').trim(),
        sku: String(data.get('sku') ?? '').trim(),
        unit: String(data.get('unit') ?? '').trim() || 'шт',
        price: Number(data.get('price') || 0),
        kind: String(data.get('kind')) as ProductKind,
        categoryId: String(data.get('categoryId') ?? ''),
        ...(groupName
          ? { groupName }
          : { groupId: String(data.get('groupId') ?? '') || null }),
      })
      await load()
      onChanged()
    } catch {
      setSaveError('Не удалось сохранить. Проверьте название и артикул — он должен быть уникальным.')
    } finally {
      setBusy(false)
    }
  }

  async function move(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const quantity = Number(data.get('quantity'))
    if (!quantity) return
    setBusy(true)
    setMoveError(null)
    try {
      await postStockMovement(warehouseId, {
        productId,
        type: String(data.get('type')) as 'RECEIPT' | 'WRITEOFF',
        quantity,
        note: String(data.get('note') ?? '').trim() || undefined,
      })
      form.reset()
      await load()
      onChanged()
    } catch {
      setMoveError('Недостаточно остатка или не удалось провести')
    } finally {
      setBusy(false)
    }
  }

  function requestDelete() {
    setDeleteError(null)
    if (!card || card.quantity !== 0) {
      setDeleteError('Удалить можно только если остаток равен 0')
      setConfirmingDelete(false)
      return
    }
    setConfirmingDelete(true)
  }

  async function confirmDelete() {
    setBusy(true)
    setDeleteError(null)
    try {
      await deleteStockItem(warehouseId, productId)
      onChanged()
      onClose()
    } catch (err) {
      setConfirmingDelete(false)
      const code = err instanceof Error ? err.message : ''
      setDeleteError(
        code === 'has_stock' ? 'Удалить можно только если остаток равен 0' : 'Не удалось удалить позицию',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-5">
      <button type="button" aria-label="Закрыть" className="glass-scrim absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-position-title"
        className="glass-panel relative z-10 flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl sm:h-[min(720px,90vh)] sm:rounded-3xl"
      >
        {!card ? (
          <p className="p-6 text-sm text-secondary">Загрузка</p>
        ) : (
          <>
            <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-3 md:px-6">
              <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-start md:gap-5">
                <div className="min-w-0 flex-1">
                  <h2
                    id="stock-position-title"
                    className="line-clamp-2 break-words text-lg font-semibold leading-6 tracking-[-0.03em] text-foreground"
                    title={card.product.name}
                  >
                    {card.product.name}
                  </h2>
                  <p className="mt-0.5 truncate text-sm text-secondary">
                    {card.product.sku ?? 'без артикула'}
                    {' · '}
                    {card.warehouse.name}
                    {card.warehouse.address ? ` · ${card.warehouse.address}` : ''}
                  </p>
                </div>
                <dl className="grid shrink-0 grid-cols-[auto_minmax(0,11rem)] gap-x-3 gap-y-1">
                  <HeaderFact label="Тип" value={PRODUCT_KIND_LABEL[card.product.kind]} />
                  <HeaderFact label="Вкладка" value={card.product.category?.name ?? '—'} />
                  <HeaderFact label="Группа" value={card.product.group?.name ?? '—'} />
                  <HeaderFact
                    label="В каталоге"
                    value={card.product.inCatalog ? 'Да' : 'Нет'}
                  />
                </dl>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-slate-100 hover:text-foreground"
                aria-label="Закрыть"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-4 md:px-6">
                <dl className="grid shrink-0 grid-cols-4 gap-2">
                  <Stat label="Остаток" value={`${formatQty(card.quantity)} ${card.product.unit}`} />
                  <Stat label="На складе" value={money(card.quantity * card.product.price)} />
                  <Stat label="Приход" value={`${formatQty(card.stats.receipts)} ${card.product.unit}`} />
                  <Stat label="Списание" value={`${formatQty(card.stats.writeoffs)} ${card.product.unit}`} />
                </dl>

                {card.product.description ? (
                  <p className="mt-3 line-clamp-2 shrink-0 text-sm leading-5 text-secondary">{card.product.description}</p>
                ) : null}

                {card.product.attributes.length ? (
                  <ul className="mt-3 grid shrink-0 grid-cols-2 gap-2 overflow-hidden">
                    {card.product.attributes.slice(0, 4).map((item) => (
                      <li key={item.id} className="min-w-0 rounded-md border-2 border-slate-300 px-3 py-1.5">
                        <p className="truncate text-xs text-secondary">{item.name}</p>
                        <p className="truncate text-sm font-medium text-foreground">{item.value}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-4 grid min-h-0 flex-1 grid-cols-2 gap-3">
                  <form
                    key={`${card.product.updatedAt}-${card.product.unit}`}
                    onSubmit={saveCard}
                    className="flex min-h-0 flex-col overflow-hidden rounded-md border-2 border-slate-300 p-3"
                  >
                    <p className="shrink-0 text-sm font-semibold text-foreground">Карточка</p>
                    <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain grid grid-cols-2 gap-2 pe-1">
                      <label className="col-span-2 text-xs font-medium text-secondary">
                        Наименование
                        <input
                          name="name"
                          required
                          defaultValue={card.product.name}
                          className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                        />
                      </label>
                      <label className="text-xs font-medium text-secondary">
                        Артикул
                        <input
                          name="sku"
                          required
                          defaultValue={card.product.sku ?? ''}
                          className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                        />
                      </label>
                      <label className="text-xs font-medium text-secondary">
                        Единица измерения
                        <UnitInput defaultValue={card.product.unit} />
                      </label>
                      <label className="text-xs font-medium text-secondary">
                        Тип
                        <select
                          name="kind"
                          defaultValue={card.product.kind}
                          className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm outline-none focus:border-slate-500"
                        >
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
                          defaultValue={card.product.categoryId}
                          className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm outline-none focus:border-slate-500"
                        >
                          {categories.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="col-span-2 text-xs font-medium text-secondary">
                        Группа
                        <select
                          name="groupId"
                          defaultValue={card.product.groupId ?? ''}
                          className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm outline-none focus:border-slate-500"
                        >
                          <option value="">Без группы</option>
                          {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="col-span-2 text-xs font-medium text-secondary">
                        Или новая группа
                        <input
                          name="groupName"
                          placeholder="Название новой группы"
                          className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                        />
                      </label>
                      <label className="col-span-2 text-xs font-medium text-secondary">
                        Учётная цена, ₽
                        <input
                          name="price"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={card.product.price}
                          className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                        />
                      </label>
                    </div>
                    {saveError ? <p className="mt-3 shrink-0 text-sm text-destructive">{saveError}</p> : null}
                    <div className="mt-auto flex shrink-0 justify-end border-t border-line pt-3">
                      <button
                        type="submit"
                        disabled={busy}
                        className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
                      >
                        Сохранить
                      </button>
                    </div>
                  </form>

                  <form onSubmit={move} className="flex min-h-0 flex-col overflow-hidden rounded-md border-2 border-slate-300 p-3">
                    <p className="shrink-0 text-sm font-semibold text-foreground">Проводка</p>
                    <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain grid grid-cols-2 gap-2 pe-1">
                      <label className="text-xs font-medium text-secondary">
                        Тип
                        <select
                          name="type"
                          className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm outline-none focus:border-slate-500"
                        >
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
                            className="h-10 min-w-0 flex-1 rounded-md border-2 border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                          />
                          <span className="flex h-10 min-w-12 items-center rounded-md border-2 border-slate-300 px-3 text-sm text-secondary">
                            {card.product.unit}
                          </span>
                        </span>
                      </label>
                      <label className="col-span-2 text-xs font-medium text-secondary">
                        Комментарий
                        <input
                          name="note"
                          className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                        />
                      </label>
                    </div>
                    {moveError ? <p className="mt-3 shrink-0 text-sm text-destructive">{moveError}</p> : null}
                    <div className="mt-auto flex shrink-0 justify-end border-t border-line pt-3">
                      <button
                        type="submit"
                        disabled={busy}
                        className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
                      >
                        Провести
                      </button>
                    </div>
                  </form>
                </div>
                </div>

                {card.product.inCatalog ? null : (
                  <div className="flex shrink-0 flex-wrap items-center gap-3 border-t-2 border-slate-300 px-5 py-3 md:px-6">
                    {confirmingDelete ? (
                      <>
                        <span className="text-sm text-foreground">Удалить позицию?</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void confirmDelete()}
                          className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
                        >
                          Да
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmingDelete(false)}
                          className="h-10 rounded-md border-2 border-slate-300 px-4 text-sm disabled:opacity-60"
                        >
                          Нет
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={requestDelete}
                        className="text-sm text-secondary transition-colors duration-200 hover:text-destructive disabled:opacity-60"
                      >
                        Удалить
                      </button>
                    )}
                    {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
                  </div>
                )}
              </div>

              <aside className="flex h-[38%] min-h-[240px] w-full shrink-0 flex-col border-t border-line bg-white/40 sm:h-auto sm:w-[340px] sm:border-t-0 sm:border-l">
                <div className="border-b border-line px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Движения</p>
                  <p className="mt-1 text-sm text-secondary">История по этому складу</p>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  {card.movements.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-secondary">Проводок нет — остаток нулевой</p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {card.movements.map((item) => (
                        <MovementRow key={item.id} item={item} unit={card.product.unit} />
                      ))}
                    </ul>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border-2 border-slate-300 bg-white px-3 py-2">
      <dt className="text-xs font-medium text-secondary">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums tracking-[-0.02em] text-foreground">
        {value}
      </dd>
    </div>
  )
}

function HeaderFact({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[11px] leading-5 text-secondary">{label}</dt>
      <dd className="truncate text-sm leading-5 text-foreground" title={value}>
        {value}
      </dd>
    </>
  )
}

function MovementRow({ item, unit }: { item: StockMovement; unit: string }) {
  const receipt = item.type === 'RECEIPT'
  return (
    <li className="flex gap-3 px-4 py-3">
      <span
        className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
          receipt ? 'bg-slate-200 text-foreground' : 'bg-white text-secondary'
        }`}
      >
        {receipt ? <ArrowDownToLine size={16} strokeWidth={2} /> : <ArrowUpFromLine size={16} strokeWidth={2} />}
      </span>
      <div className="min-w-0">
        <p className="text-sm text-foreground">
          {receipt ? 'Приход' : 'Списание'} {formatQty(item.quantity)} {unit}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-secondary">
          {item.createdBy.name} ·{' '}
          {new Date(item.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
        {item.note ? <p className="mt-0.5 text-xs leading-5 text-secondary">{item.note}</p> : null}
      </div>
    </li>
  )
}

export function UnitInput({ defaultValue }: { defaultValue?: string }) {
  return (
    <>
      <input
        name="unit"
        list="stock-units"
        defaultValue={defaultValue ?? 'шт'}
        maxLength={20}
        className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
      />
      <datalist id="stock-units">
        {UNIT_SUGGESTIONS.map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>
    </>
  )
}

export function formatQty(value: number) {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 3 })
}
