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
import { fetchWarehouses, type Warehouse } from '@/lib/warehouse-api'

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
  const [stages, setStages] = useState(
    () =>
      initial?.stages.map((stage) => ({
        name: stage.name,
        outputProductId: stage.outputProductId ?? '',
        inputs: stage.inputs.map((input) => ({ productId: input.productId, quantity: input.quantity })),
      })) ?? [{ name: '', outputProductId: '', inputs: [] as { productId: string; quantity: number }[] }],
  )
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([fetchWarehouses(), fetchProducts(undefined, 'FINISHED'), fetchProducts(undefined, 'all')]).then(
      ([nextWarehouses, nextFinished, nextProducts]) => {
        setWarehouses(nextWarehouses)
        setFinished(nextFinished)
        setProducts(nextProducts)
      },
    )
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
          outputProductId: stage.outputProductId || undefined,
          inputs: stage.inputs.filter((input) => input.productId && input.quantity > 0),
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

  return (
    <Modal title={title} onClose={onClose} wide>
      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
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
            <label className="text-xs font-medium text-secondary">
              Название этапа
              <input
                value={stage.name}
                onChange={(event) =>
                  setStages((current) => current.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))
                }
                required
                className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
              />
            </label>
            <label className="mt-2 block text-xs font-medium text-secondary">
              Оприходовать после этапа
              <select
                value={stage.outputProductId}
                onChange={(event) =>
                  setStages((current) =>
                    current.map((item, i) => (i === index ? { ...item, outputProductId: event.target.value } : item)),
                  )
                }
                className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm"
              >
                <option value="">Ничего</option>
                {products.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku ? `${item.sku} · ` : ''}
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs font-medium text-secondary">Списать на единицу заказа</p>
            {stage.inputs.map((input, inputIndex) => (
              <div key={inputIndex} className="mt-1 flex gap-2">
                <select
                  value={input.productId}
                  onChange={(event) =>
                    setStages((current) =>
                      current.map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              inputs: item.inputs.map((row, j) =>
                                j === inputIndex ? { ...row, productId: event.target.value } : row,
                              ),
                            }
                          : item,
                      ),
                    )
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
                  value={input.quantity}
                  onChange={(event) =>
                    setStages((current) =>
                      current.map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              inputs: item.inputs.map((row, j) =>
                                j === inputIndex ? { ...row, quantity: Number(event.target.value) || 0 } : row,
                              ),
                            }
                          : item,
                      ),
                    )
                  }
                  className="h-10 w-24 rounded-md border-2 border-slate-300 px-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    setStages((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, inputs: item.inputs.filter((_, j) => j !== inputIndex) }
                          : item,
                      ),
                    )
                  }
                  className="h-10 shrink-0 px-2 text-sm text-secondary hover:text-foreground"
                >
                  Удалить
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setStages((current) =>
                  current.map((item, i) =>
                    i === index ? { ...item, inputs: [...item.inputs, { productId: '', quantity: 1 }] } : item,
                  ),
                )
              }
              className="mt-2 text-xs text-secondary hover:text-foreground"
            >
              Добавить списание
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setStages((current) => [...current, { name: '', outputProductId: '', inputs: [] }])}
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
