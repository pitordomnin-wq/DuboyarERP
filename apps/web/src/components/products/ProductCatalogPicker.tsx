import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchProducts, money, type Product } from '@/lib/products-api'
import { PRODUCT_KIND_LABEL, type ProductKind } from '@/lib/warehouse-api'

export type CatalogLine = {
  productId: string
  name: string
  sku: string | null
  unit: string
  price: number
  quantity: number
}

export function ProductCatalogPicker({
  selected,
  onClose,
  onConfirm,
  kind,
  title = 'Каталог товаров',
  emptyHint,
}: {
  selected: CatalogLine[]
  onClose: () => void
  onConfirm: (lines: CatalogLine[]) => void
  kind?: ProductKind | 'all' | 'supply'
  title?: string
  emptyHint?: string
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Record<string, CatalogLine>>(() =>
    Object.fromEntries(
      selected.filter((line) => line.quantity > 0).map((line) => [line.productId, line]),
    ),
  )

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      onClose()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      fetchProducts(query, kind)
        .then(setProducts)
        .finally(() => setLoading(false))
    }, 200)
    return () => window.clearTimeout(timer)
  }, [query, kind])

  const pickedCount = Object.values(draft).filter((line) => line.quantity > 0).length

  function setQty(item: Product, quantity: number) {
    setDraft((current) => {
      const next = { ...current }
      if (!quantity || quantity < 0) {
        delete next[item.id]
      } else {
        next[item.id] = {
          productId: item.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          price: item.price,
          quantity,
        }
      }
      return next
    })
  }

  function confirm() {
    onConfirm(Object.values(draft).filter((line) => line.quantity > 0))
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Закрыть каталог" className="glass-scrim absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-title"
        className="glass-strong relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-3xl p-5 sm:rounded-3xl"
      >
        <h2 id="catalog-title" className="text-lg font-semibold tracking-[-0.03em] text-foreground">
          {title}
        </h2>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по названию или артикулу"
          className="mt-4 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
        />
        <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-md border-2 border-slate-300">
          {loading ? (
            <p className="px-3 py-8 text-sm text-secondary">Загрузка</p>
          ) : products.length === 0 ? (
            <p className="px-3 py-8 text-sm text-secondary">
              {query.trim()
                ? 'Ничего не найдено'
                : emptyHint ?? 'Каталог пуст. Сначала добавьте товары в разделе «Товары».'}
            </p>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-xs text-secondary">
                <tr>
                  <th className="border-b border-slate-300 px-2 py-1.5">Товар</th>
                  <th className="border-b border-slate-300 px-2 py-1.5">Цена</th>
                  <th className="w-28 border-b border-slate-300 px-2 py-1.5">Кол-во</th>
                </tr>
              </thead>
              <tbody>
                {products.map((item) => {
                  const quantity = draft[item.id]?.quantity ?? 0
                  const active = quantity > 0
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-slate-200 ${active ? 'bg-slate-50' : ''}`}
                    >
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => setQty(item, active ? 0 : 1)}
                        >
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-secondary">
                            {item.sku ? `${item.sku} · ` : ''}
                            {item.kind ? `${PRODUCT_KIND_LABEL[item.kind]} · ` : ''}
                            {item.unit}
                          </p>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 tabular-nums text-secondary">{money(item.price)}</td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={quantity || ''}
                          placeholder="0"
                          onChange={(event) => setQty(item, Number(event.target.value) || 0)}
                          className="h-9 w-full rounded-md border-2 border-slate-300 px-2 text-sm"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-secondary">{pickedCount ? `Выбрано: ${pickedCount}` : 'Ничего не выбрано'}</p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="h-10 px-3 text-sm text-secondary">
              Отмена
            </button>
            <button
              type="button"
              disabled={pickedCount === 0}
              onClick={confirm}
              className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
            >
              Добавить
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
