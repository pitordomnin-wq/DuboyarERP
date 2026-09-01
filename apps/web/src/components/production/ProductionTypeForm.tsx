import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/tasks/TaskModal'
import { fetchProducts, type Product } from '@/lib/products-api'
import {
  createProductionType,
  deleteProductionType,
  INPUT_MODE_LABEL,
  LAYOUT_ROLE_LABEL,
  QUANTITY_BASIS_LABEL,
  RELEASE_TYPE_LABEL,
  updateProductionType,
  type LayoutMaterialRole,
  type ProductionType,
  type ProductionTypeInput,
  type ProductionReleaseType,
  type StageInputMode,
  type StageQuantityBasis,
} from '@/lib/production-api'
import { fetchProductGroups, fetchWarehouses, type ProductGroup, type Warehouse } from '@/lib/warehouse-api'

type InputRow = {
  mode: StageInputMode
  productId: string
  productGroupId: string
  quantity: number
  quantityBasis: StageQuantityBasis
  keyword: string
  layoutRole: LayoutMaterialRole | ''
}

type OutputRow = { productId: string; quantity: number }

type StageDraft = {
  name: string
  lossPercent: number
  inputs: InputRow[]
  outputs: OutputRow[]
}

const emptyInput = (): InputRow => ({
  mode: 'PRODUCT',
  productId: '',
  productGroupId: '',
  quantity: 1,
  quantityBasis: 'M2',
  keyword: '',
  layoutRole: '',
})

const emptyStage = (): StageDraft => ({ name: '', lossPercent: 0, inputs: [], outputs: [] })

function mapInput(input: ProductionType['stages'][number]['inputs'][number]): InputRow {
  if (input.inputMode === 'LKP_RECIPE') {
    return { ...emptyInput(), mode: 'LKP_RECIPE', quantity: 0, quantityBasis: 'M2_ORIGINAL' }
  }
  if (input.inputMode === 'KEYWORD' || input.layoutRole) {
    return {
      mode: 'KEYWORD',
      productId: '',
      productGroupId: '',
      quantity: input.quantity,
      quantityBasis: input.quantityBasis ?? 'M2',
      keyword: input.keyword ?? '',
      layoutRole: input.layoutRole ?? '',
    }
  }
  if (input.productGroupId || input.inputMode === 'GROUP') {
    return {
      mode: 'GROUP',
      productId: '',
      productGroupId: input.productGroupId ?? '',
      quantity: input.quantity,
      quantityBasis: input.quantityBasis ?? 'M2',
      keyword: '',
      layoutRole: '',
    }
  }
  return {
    mode: 'PRODUCT',
    productId: input.productId ?? '',
    productGroupId: '',
    quantity: input.quantity,
    quantityBasis: input.quantityBasis ?? 'M2',
    keyword: '',
    layoutRole: '',
  }
}

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
  const [defaultReleaseType, setDefaultReleaseType] = useState<ProductionReleaseType>(
    initial?.defaultReleaseType ?? 'DECK',
  )
  const [stages, setStages] = useState<StageDraft[]>(
    () =>
      initial?.stages.map((stage) => ({
        name: stage.name,
        lossPercent: stage.lossPercent ?? 0,
        inputs: stage.inputs.map(mapInput),
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
      defaultReleaseType,
      piecesPerM2: Number(data.get('piecesPerM2')) || undefined,
      m2PerPackageDeck: Number(data.get('m2PerPackageDeck')) || undefined,
      m2PerPackageHerringbone: Number(data.get('m2PerPackageHerringbone')) || undefined,
      stages: stages
        .filter((stage) => stage.name.trim())
        .map((stage) => ({
          name: stage.name.trim(),
          lossPercent: stage.lossPercent || 0,
          inputs: stage.inputs
            .filter((row) => row.mode === 'LKP_RECIPE' || row.quantity > 0)
            .map((row) => {
              if (row.mode === 'LKP_RECIPE') {
                return { inputMode: 'LKP_RECIPE' as const, quantity: 0, quantityBasis: 'M2_ORIGINAL' as const }
              }
              if (row.mode === 'GROUP') {
                return {
                  inputMode: 'GROUP' as const,
                  productGroupId: row.productGroupId,
                  quantity: row.quantity,
                  quantityBasis: row.quantityBasis,
                }
              }
              if (row.mode === 'KEYWORD') {
                return {
                  inputMode: 'KEYWORD' as const,
                  quantity: row.quantity,
                  quantityBasis: row.quantityBasis,
                  keyword: row.keyword || undefined,
                  layoutRole: row.layoutRole || undefined,
                }
              }
              return {
                inputMode: 'PRODUCT' as const,
                productId: row.productId,
                quantity: row.quantity,
                quantityBasis: row.quantityBasis,
              }
            }),
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
        <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-secondary">
            Тип выпуска
            <select
              value={defaultReleaseType}
              onChange={(event) => setDefaultReleaseType(event.target.value as ProductionReleaseType)}
              className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm"
            >
              {Object.entries(RELEASE_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-secondary">
            Шт / м²
            <input
              name="piecesPerM2"
              type="number"
              step="0.001"
              defaultValue={initial?.piecesPerM2 ?? 4.972}
              className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-secondary">
            м² / упак (палуба)
            <input
              name="m2PerPackageDeck"
              type="number"
              step="0.001"
              defaultValue={initial?.m2PerPackageDeck ?? 0.829}
              className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-secondary">
            м² / упак (ёлка)
            <input
              name="m2PerPackageHerringbone"
              type="number"
              step="0.001"
              defaultValue={initial?.m2PerPackageHerringbone ?? 0.992}
              className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
            />
          </label>
        </div>
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
                <span className="mt-1 block text-[11px] text-secondary">
                  {index === 1 ? 'На профилировании: 20% потерь площади' : 'Уменьшает оприходование'}
                </span>
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
            onChange={(event) => {
              const mode = event.target.value as StageInputMode
              onChange(
                rows.map((item, i) =>
                  i === index
                    ? {
                        ...emptyInput(),
                        mode,
                        quantityBasis:
                          mode === 'LKP_RECIPE'
                            ? 'M2_ORIGINAL'
                            : item.quantityBasis,
                      }
                    : item,
                ),
              )
            }}
            className="h-10 w-36 rounded-md border-2 border-slate-300 px-2 text-sm"
          >
            {Object.entries(INPUT_MODE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {row.mode === 'PRODUCT' ? (
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
          ) : null}
          {row.mode === 'GROUP' ? (
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
          ) : null}
          {row.mode === 'KEYWORD' ? (
            <>
              <select
                value={row.layoutRole}
                onChange={(event) =>
                  onChange(
                    rows.map((item, i) =>
                      i === index ? { ...item, layoutRole: event.target.value as LayoutMaterialRole | '' } : item,
                    ),
                  )
                }
                className="h-10 min-w-[180px] flex-1 rounded-md border-2 border-slate-300 px-2 text-sm"
              >
                <option value="">Свои ключевые слова</option>
                {Object.entries(LAYOUT_ROLE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {!row.layoutRole ? (
                <input
                  value={row.keyword}
                  onChange={(event) =>
                    onChange(rows.map((item, i) => (i === index ? { ...item, keyword: event.target.value } : item)))
                  }
                  placeholder="ключевые слова"
                  className="h-10 min-w-[140px] flex-1 rounded-md border-2 border-slate-300 px-2 text-sm"
                />
              ) : null}
            </>
          ) : null}
          {row.mode === 'LKP_RECIPE' ? (
            <span className="flex h-10 flex-1 items-center text-sm text-secondary">Из рецепта покрытия продукции</span>
          ) : (
            <>
              <select
                value={row.quantityBasis}
                onChange={(event) =>
                  onChange(
                    rows.map((item, i) =>
                      i === index ? { ...item, quantityBasis: event.target.value as StageQuantityBasis } : item,
                    ),
                  )
                }
                className="h-10 w-28 rounded-md border-2 border-slate-300 px-2 text-sm"
              >
                {Object.entries(QUANTITY_BASIS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="any"
                value={row.quantity}
                onChange={(event) =>
                  onChange(rows.map((item, i) => (i === index ? { ...item, quantity: Number(event.target.value) || 0 } : item)))
                }
                className="h-10 w-24 rounded-md border-2 border-slate-300 px-2 text-sm"
              />
            </>
          )}
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
