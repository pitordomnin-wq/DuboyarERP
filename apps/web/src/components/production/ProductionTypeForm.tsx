import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/tasks/TaskModal'
import { fetchProducts, type Product } from '@/lib/products-api'
import {
  createProductionType,
  deleteProductionType,
  updateProductionType,
  type ProductionType,
  type ProductionTypeInput,
} from '@/lib/production-api'
import { fetchProductGroups, fetchWarehouses, type ProductGroup, type Warehouse } from '@/lib/warehouse-api'

type InputRow = {
  mode: 'product' | 'group'
  productId: string
  productGroupId: string
  quantity: number
}

type OutputRow = { productId: string; quantity: number }

type StageDraft = {
  name: string
  lossPercent: number
  inputs: InputRow[]
  outputs: OutputRow[]
}

const emptyInput = (): InputRow => ({ mode: 'product', productId: '', productGroupId: '', quantity: 1 })
const emptyStage = (): StageDraft => ({ name: '', lossPercent: 0, inputs: [], outputs: [] })

export function ProductionTypeForm({
  title,
  initial,
  onClose,
  onSaved,
  onDeleted,
}: {
  title: string
  initial?: ProductionType
  onClose: () => void
  onSaved: (item?: ProductionType) => void | Promise<void>
  onDeleted?: (id: string) => void
}) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [finished, setFinished] = useState<Product[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [groups, setGroups] = useState<ProductGroup[]>([])
  const [stages, setStages] = useState<StageDraft[]>(
    () =>
      initial?.stages.map((stage) => ({
        name: stage.name,
        lossPercent: stage.lossPercent ?? 0,
        inputs: stage.inputs.map((input) =>
          input.productGroupId
            ? {
                mode: 'group' as const,
                productId: '',
                productGroupId: input.productGroupId,
                quantity: input.quantity,
              }
            : {
                mode: 'product' as const,
                productId: input.productId ?? '',
                productGroupId: '',
                quantity: input.quantity,
              },
        ),
        outputs: stage.outputs.map((output) => ({ productId: output.productId!, quantity: output.quantity })),
      })) ?? [emptyStage()],
  )
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([
      fetchWarehouses(),
      fetchProducts(undefined, 'FINISHED'),
      fetchProducts(undefined, 'all'),
      fetchProductGroups(),
    ]).then(([nextWarehouses, nextFinished, nextProducts, nextGroups]) => {
      setWarehouses(nextWarehouses)
      setFinished(nextFinished)
      setProducts(nextProducts)
      setGroups(nextGroups)
    })
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const payload: ProductionTypeInput = {
      name: String(data.get('name') ?? '').trim(),
      productId: String(data.get('productId') ?? ''),
      warehouseId: String(data.get('warehouseId') ?? ''),
      stages: stages
        .filter((stage) => stage.name.trim())
        .map((stage) => ({
          name: stage.name.trim(),
          lossPercent: stage.lossPercent || 0,
          inputs: stage.inputs
            .filter((row) => row.quantity > 0 && (row.mode === 'product' ? row.productId : row.productGroupId))
            .map((row) =>
              row.mode === 'group'
                ? { productGroupId: row.productGroupId, quantity: row.quantity }
                : { productId: row.productId, quantity: row.quantity },
            ),
          outputs: stage.outputs.filter((row) => row.productId && row.quantity > 0),
        })),
    }
    if (!payload.name || !payload.productId || !payload.warehouseId || payload.stages.length === 0) {
      setError('Нужны название, готовая продукция, склад и хотя бы один этап')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const saved = initial
        ? await updateProductionType(initial.id, payload)
        : await createProductionType(payload)
      await onSaved(saved)
    } catch {
      setError(initial ? 'Нельзя менять число этапов, пока есть заказы' : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!initial) return
    setBusy(true)
    setError(null)
    try {
      await deleteProductionType(initial.id)
      onDeleted?.(initial.id)
    } catch {
      setError('Нельзя удалить: по этим этапам уже есть заказы')
      setBusy(false)
      setConfirming(false)
    }
  }

  function patchStage(index: number, patch: Partial<StageDraft>) {
    setStages((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  return (
    <Modal title={title} onClose={onClose} wide>
      <form onSubmit={(event) => void onSubmit(event)} className="mt-5 flex flex-col gap-3">
        <label className="text-xs font-medium text-secondary">
          Название
          <input
            name="name"
            required
            defaultValue={initial?.name}
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-secondary">
          Готовая продукция
          <select
            name="productId"
            required
            key={`product-${finished.length}`}
            defaultValue={initial?.productId ?? ''}
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm"
          >
            <option value="">Выберите</option>
            {finished.map((item) => (
              <option key={item.id} value={item.id}>
                {item.sku ? `${item.sku} · ` : ''}
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-secondary">
          Склад
          <select
            name="warehouseId"
            required
            key={`warehouse-${warehouses.length}`}
            defaultValue={initial?.warehouseId ?? ''}
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm"
          >
            <option value="">Выберите</option>
            {warehouses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {stages.map((stage, index) => (
          <div key={index} className="rounded-md border-2 border-slate-300 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Этап {index + 1}</p>
              {stages.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setStages((current) => current.filter((_, i) => i !== index))}
                  className="text-xs text-secondary hover:text-foreground"
                >
                  Удалить этап
                </button>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-secondary">
                Название этапа
                <input
                  value={stage.name}
                  onChange={(event) => patchStage(index, { name: event.target.value })}
                  required
                  className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-secondary">
                Потери, %
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={stage.lossPercent}
                  onChange={(event) => patchStage(index, { lossPercent: Number(event.target.value) || 0 })}
                  className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
                />
                <span className="mt-1 block text-[11px] text-secondary">Уменьшает оприходование на этапе</span>
              </label>
            </div>
            <InputLines
              rows={stage.inputs}
              products={products}
              groups={groups}
              onChange={(inputs) => patchStage(index, { inputs })}
            />
            <BomLines
              label="Оприходовать на единицу заказа"
              addLabel="Добавить оприходование"
              rows={stage.outputs}
              products={products}
              onChange={(outputs) => patchStage(index, { outputs })}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setStages((current) => [...current, emptyStage()])}
          className="h-10 rounded-md border-2 border-slate-300 text-sm font-medium hover:bg-slate-50"
        >
          Добавить этап
        </button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="mt-2 flex items-center justify-between gap-3">
          {initial ? (
            confirming ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-foreground">Вы уверены?</span>
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
                onClick={() => setConfirming(true)}
                className="h-10 rounded-md border-2 border-slate-300 bg-white px-4 text-sm"
              >
                Удалить
              </button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="h-10 px-3 text-sm text-secondary">
              Отмена
            </button>
            <button type="submit" disabled={busy} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary">
              Сохранить
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

function InputLines({
  rows,
  products,
  groups,
  onChange,
}: {
  rows: InputRow[]
  products: Product[]
  groups: ProductGroup[]
  onChange: (rows: InputRow[]) => void
}) {
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-secondary">Списать на единицу заказа</p>
      {rows.map((row, index) => (
        <div key={index} className="mt-1 flex flex-wrap gap-2">
          <select
            value={row.mode}
            onChange={(event) =>
              onChange(
                rows.map((item, i) =>
                  i === index
                    ? { ...item, mode: event.target.value as 'product' | 'group', productId: '', productGroupId: '' }
                    : item,
                ),
              )
            }
            className="h-10 w-28 rounded-md border-2 border-slate-300 px-2 text-sm"
          >
            <option value="product">Товар</option>
            <option value="group">Группа</option>
          </select>
          {row.mode === 'product' ? (
            <select
              value={row.productId}
              onChange={(event) =>
                onChange(rows.map((item, i) => (i === index ? { ...item, productId: event.target.value } : item)))
              }
              className="h-10 min-w-0 flex-1 rounded-md border-2 border-slate-300 px-2 text-sm"
            >
              <option value="">Позиция</option>
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku ? `${item.sku} · ` : ''}
                  {item.name}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={row.productGroupId}
              onChange={(event) =>
                onChange(rows.map((item, i) => (i === index ? { ...item, productGroupId: event.target.value } : item)))
              }
              className="h-10 min-w-0 flex-1 rounded-md border-2 border-slate-300 px-2 text-sm"
            >
              <option value="">Группа (FIFO)</option>
              {groups.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          )}
          <input
            type="number"
            min="0.001"
            step="any"
            value={row.quantity}
            onChange={(event) =>
              onChange(rows.map((item, i) => (i === index ? { ...item, quantity: Number(event.target.value) || 0 } : item)))
            }
            className="h-10 w-24 rounded-md border-2 border-slate-300 px-2 text-sm"
          />
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
            className="h-10 shrink-0 px-2 text-sm text-secondary hover:text-foreground"
          >
            Удалить
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, emptyInput()])}
        className="mt-2 text-xs text-secondary hover:text-foreground"
      >
        Добавить списание
      </button>
    </div>
  )
}

function BomLines({
  label,
  addLabel,
  rows,
  products,
  onChange,
}: {
  label: string
  addLabel: string
  rows: OutputRow[]
  products: Product[]
  onChange: (rows: OutputRow[]) => void
}) {
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-secondary">{label}</p>
      {rows.map((row, index) => (
        <div key={index} className="mt-1 flex gap-2">
          <select
            value={row.productId}
            onChange={(event) =>
              onChange(rows.map((item, i) => (i === index ? { ...item, productId: event.target.value } : item)))
            }
            className="h-10 min-w-0 flex-1 rounded-md border-2 border-slate-300 px-2 text-sm"
          >
            <option value="">Позиция</option>
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.sku ? `${item.sku} · ` : ''}
                {item.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0.001"
            step="any"
            value={row.quantity}
            onChange={(event) =>
              onChange(rows.map((item, i) => (i === index ? { ...item, quantity: Number(event.target.value) || 0 } : item)))
            }
            className="h-10 w-24 rounded-md border-2 border-slate-300 px-2 text-sm"
          />
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
            className="h-10 shrink-0 px-2 text-sm text-secondary hover:text-foreground"
          >
            Удалить
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { productId: '', quantity: 1 }])}
        className="mt-2 text-xs text-secondary hover:text-foreground"
      >
        {addLabel}
      </button>
    </div>
  )
}
