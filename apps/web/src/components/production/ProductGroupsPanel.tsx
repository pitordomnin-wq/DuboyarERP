import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  addProductsToGroup,
  createProductGroup,
  fetchProductGroup,
  fetchProductGroups,
  fetchWarehouses,
  fetchStock,
  removeProductFromGroup,
  updateProductGroup,
  type ProductGroup,
  type StockRow,
} from '@/lib/warehouse-api'

export function ProductGroupsPanel() {
  const [groups, setGroups] = useState<ProductGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newKeywords, setNewKeywords] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<ProductGroup | null>(null)
  const [stock, setStock] = useState<StockRow[]>([])
  const [pickProductId, setPickProductId] = useState('')

  async function load() {
    setGroups(await fetchProductGroups())
  }

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!expandedId) {
      setExpanded(null)
      return
    }
    void fetchProductGroup(expandedId).then(setExpanded)
    void fetchWarehouses().then(async (warehouses) => {
      const warehouseId = warehouses[0]?.id
      if (!warehouseId) return
      setStock(await fetchStock(warehouseId, 'all'))
    })
  }, [expandedId])

  const availableProducts = useMemo(() => {
    if (!expanded) return stock
    const inGroup = new Set(expanded.products?.map((item) => item.id) ?? [])
    return stock.filter((item) => !inGroup.has(item.id))
  }, [expanded, stock])

  async function create(event: FormEvent) {
    event.preventDefault()
    if (!newName.trim()) return
    const keywords = newKeywords
      .split(/[,;]+/)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
    await createProductGroup(newName.trim(), keywords)
    setNewName('')
    setNewKeywords('')
    await load()
  }

  async function saveGroup(group: ProductGroup, keywords: string) {
    const parsed = keywords
      .split(/[,;]+/)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
    await updateProductGroup(group.id, { keywords: parsed })
    await load()
    if (expandedId === group.id) {
      setExpanded(await fetchProductGroup(group.id))
    }
  }

  async function addProduct() {
    if (!expandedId || !pickProductId) return
    setExpanded(await addProductsToGroup(expandedId, [pickProductId]))
    setPickProductId('')
    await load()
  }

  async function removeProduct(productId: string) {
    if (!expandedId) return
    await removeProductFromGroup(expandedId, productId)
    setExpanded(await fetchProductGroup(expandedId))
    await load()
  }

  if (loading) return <p className="text-sm text-secondary">Загрузка</p>

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Учётные группы</h2>
        <p className="mt-1 text-sm text-secondary">
          Группы по цвету заливки в файле норм. Списание: этап 1 — ХДФ, шпон, клей (FIFO); этап 4 — короб/упаковка по позиции. Состав группы редактируется вручную.
        </p>
      </div>

      <form onSubmit={(event) => void create(event)} className="flex flex-wrap items-end gap-2 rounded-2xl glass p-4">
        <label className="min-w-[180px] flex-1 text-xs font-medium text-secondary">
          Название
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
            placeholder="Клей Teracol D301"
          />
        </label>
        <label className="min-w-[240px] flex-[2] text-xs font-medium text-secondary">
          Ключевые слова
          <input
            value={newKeywords}
            onChange={(event) => setNewKeywords(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
            placeholder="teracol, клей"
          />
        </label>
        <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary">
          Добавить
        </button>
      </form>

      <div className="overflow-auto rounded-2xl glass">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-secondary">
            <tr>
              <th className="border-b border-line px-3 py-2">Группа</th>
              <th className="border-b border-line px-3 py-2">Товаров</th>
              <th className="border-b border-line px-3 py-2">Ключевые слова</th>
              <th className="border-b border-line px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                expanded={expandedId === group.id}
                onToggle={() => setExpandedId((current) => (current === group.id ? null : group.id))}
                onSave={saveGroup}
                detail={expandedId === group.id ? expanded : null}
                availableProducts={expandedId === group.id ? availableProducts : []}
                pickProductId={pickProductId}
                onPickProductId={setPickProductId}
                onAddProduct={() => void addProduct()}
                onRemoveProduct={(productId) => void removeProduct(productId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GroupRow({
  group,
  expanded,
  onToggle,
  onSave,
  detail,
  availableProducts,
  pickProductId,
  onPickProductId,
  onAddProduct,
  onRemoveProduct,
}: {
  group: ProductGroup
  expanded: boolean
  onToggle: () => void
  onSave: (group: ProductGroup, keywords: string) => Promise<void>
  detail: ProductGroup | null
  availableProducts: StockRow[]
  pickProductId: string
  onPickProductId: (value: string) => void
  onAddProduct: () => void
  onRemoveProduct: (productId: string) => void
}) {
  const [keywords, setKeywords] = useState((group.keywords ?? []).join(', '))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setKeywords((group.keywords ?? []).join(', '))
  }, [group.keywords])

  return (
    <>
      <tr className="border-b border-slate-200">
        <td className="px-3 py-2.5 font-medium">{group.name}</td>
        <td className="px-3 py-2.5 text-secondary">{group._count?.products ?? 0}</td>
        <td className="px-3 py-2.5">
          <div className="flex gap-2">
            <input
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
              className="h-9 min-w-0 flex-1 rounded-md border-2 border-slate-300 px-2 text-sm"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setSaving(true)
                void onSave(group, keywords).finally(() => setSaving(false))
              }}
              className="h-9 shrink-0 rounded-md border-2 border-slate-300 px-3 text-sm"
            >
              {saving ? '…' : 'Сохранить'}
            </button>
          </div>
        </td>
        <td className="px-3 py-2.5 text-right">
          <button type="button" onClick={onToggle} className="text-sm text-primary">
            {expanded ? 'Свернуть' : 'Состав'}
          </button>
        </td>
      </tr>
      {expanded && detail ? (
        <tr className="border-b border-slate-200 bg-white/30">
          <td colSpan={4} className="px-3 py-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-[280px] flex-1 text-xs font-medium text-secondary">
                  Добавить позицию со склада
                  <select
                    value={pickProductId}
                    onChange={(event) => onPickProductId(event.target.value)}
                    className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm"
                  >
                    <option value="">Выберите товар</option>
                    {availableProducts.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.unit})
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!pickProductId}
                  onClick={onAddProduct}
                  className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50"
                >
                  Добавить в группу
                </button>
              </div>
              {detail.products?.length ? (
                <ul className="flex flex-col gap-1">
                  {detail.products.map((product) => (
                    <li key={product.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                      <span>
                        {product.name} · {product.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveProduct(product.id)}
                        className="text-sm text-red-700"
                      >
                        Убрать
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-secondary">В группе пока нет товаров</p>
              )}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}
