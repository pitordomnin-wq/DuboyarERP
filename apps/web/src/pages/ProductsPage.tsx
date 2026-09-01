import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  createProduct,
  deleteProductImage,
  fetchProducts,
  money,
  productImageUrl,
  setProductCatalog,
  updateProduct,
  uploadProductImages,
  type Product,
  type ProductImage,
  type ProductInput,
} from '@/lib/products-api'
import { PRODUCT_KIND_LABEL, fetchProductGroups, fetchWarehouseCategories, type ProductKind } from '@/lib/warehouse-api'
import { Modal } from '@/components/tasks/TaskModal'
import { ProductAttributesEditor } from '@/components/products/ProductAttributesEditor'

export function ProductsPage() {
  const [items, setItems] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [fromStock, setFromStock] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      fetchProducts(query)
        .then(setItems)
        .finally(() => setLoading(false))
    }, 200)
    return () => window.clearTimeout(timer)
  }, [query])

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-5 md:px-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="shrink-0 text-xl font-semibold tracking-[-0.03em] text-foreground">Товары</h1>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по названию или артикулу"
          className="h-10 min-w-[180px] flex-1 rounded-xl border border-line bg-white/55 px-3 text-sm outline-none focus:border-accent md:max-w-md"
        />
        <div className="ml-auto flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setFromStock(true)}
            className="h-10 rounded-xl border border-line bg-white/55 px-4 text-sm font-medium"
          >
            Со склада
          </button>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary"
          >
            Новая карточка
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <p className="py-8 text-sm text-secondary">Загрузка</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-sm text-secondary">
            {query.trim() ? 'Ничего не найдено' : 'Карточек нет. Добавьте новую или возьмите позицию со склада.'}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setEditing(item)}
                className="glass flex flex-col rounded-2xl p-4 text-left transition-[background-color] duration-200 hover:bg-white/70"
              >
                <div className="mb-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-slate-100">
                  {item.images?.[0] ? (
                    <img
                      src={productImageUrl(item.id, item.images[0].id, 480)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl font-semibold tracking-[-0.04em] text-slate-400">
                      {item.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold leading-5 text-foreground">{item.name}</p>
                <p className="mt-1 text-xs text-secondary">{item.sku ?? 'Без артикула'}</p>
                <p className="mt-3 text-base font-semibold tabular-nums text-foreground">{money(item.price)}</p>
                {item.description ? (
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-secondary">{item.description}</p>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {editing ? (
        <ProductFormModal
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(item) => {
            setEditing(null)
            setItems((current) => {
              const index = current.findIndex((row) => row.id === item.id)
              if (index === -1) return [...current, item]
              return current.map((row) => (row.id === item.id ? item : row))
            })
          }}
          onUpdated={(item) => {
            setItems((current) => current.map((row) => (row.id === item.id ? item : row)))
          }}
          onRemoved={(id) => {
            setEditing(null)
            setItems((current) => current.filter((item) => item.id !== id))
          }}
        />
      ) : null}
      {fromStock ? (
        <FromWarehouseModal
          onClose={() => setFromStock(false)}
          onAdded={(added) => {
            setFromStock(false)
            setItems((current) => {
              const ids = new Set(current.map((item) => item.id))
              return [...current, ...added.filter((item) => !ids.has(item.id))]
            })
          }}
        />
      ) : null}
    </div>
  )
}

function imageError(code: string) {
  if (code === 'file_too_large') return 'Файл слишком большой — до 8 МБ'
  if (code === 'too_many_files') return 'Можно загрузить не больше 8 картинок'
  if (code === 'file_type') return 'Нужен JPG, PNG, WEBP или GIF'
  return 'Не удалось загрузить картинку'
}

function ProductFormModal({
  initial,
  onClose,
  onSaved,
  onUpdated,
  onRemoved,
}: {
  initial: Product | null
  onClose: () => void
  onSaved: (item: Product) => void
  onUpdated: (item: Product) => void
  onRemoved: (id: string) => void
}) {
  const pendingRef = useRef<{ key: string; file: File; url: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedImages, setSavedImages] = useState<ProductImage[]>(initial?.images ?? [])
  const [pending, setPending] = useState<{ key: string; file: File; url: string }[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const attributesRef = useRef<{ name: string; value: string }[]>(
    (initial?.attributes ?? []).map((item) => ({ name: item.name, value: item.value })),
  )

  pendingRef.current = pending
  useEffect(() => {
    void Promise.all([fetchWarehouseCategories(), fetchProductGroups()]).then(([cats, g]) => {
      setCategories(cats)
      setGroups(g)
    })
    return () => {
      pendingRef.current.forEach((item) => URL.revokeObjectURL(item.url))
    }
  }, [])

  const total = savedImages.length + pending.length

  async function addFiles(list: FileList | File[]) {
    const files = [...list].filter((file) => file.type.startsWith('image/'))
    if (files.length === 0) {
      setError('Нужен JPG, PNG, WEBP или GIF')
      return
    }
    const room = 8 - savedImages.length - pending.length
    if (room <= 0) {
      setError('Можно загрузить не больше 8 картинок')
      return
    }
    const slice = files.slice(0, room)
    setError(null)
    if (initial) {
      setBusy(true)
      try {
        const next = await uploadProductImages(initial.id, slice)
        setSavedImages(next.images ?? [])
        onUpdated(next)
      } catch (err) {
        setError(imageError(err instanceof Error ? err.message : ''))
      } finally {
        setBusy(false)
      }
      return
    }
    setPending((current) => [
      ...current,
      ...slice.map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        url: URL.createObjectURL(file),
      })),
    ])
  }

  async function removeSaved(imageId: string) {
    if (!initial) return
    setBusy(true)
    setError(null)
    try {
      const next = await deleteProductImage(initial.id, imageId)
      setSavedImages(next.images ?? [])
      onUpdated(next)
    } catch {
      setError('Не удалось удалить картинку')
    } finally {
      setBusy(false)
    }
  }

  function removePending(key: string) {
    setPending((current) => {
      const item = current.find((row) => row.key === key)
      if (item) URL.revokeObjectURL(item.url)
      return current.filter((row) => row.key !== key)
    })
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const groupName = String(data.get('groupName') ?? '').trim()
    const input: ProductInput = {
      name: String(data.get('name') ?? '').trim(),
      sku: String(data.get('sku') ?? '').trim() || undefined,
      unit: String(data.get('unit') ?? '').trim() || 'шт',
      price: Number(data.get('price')),
      description: String(data.get('description') ?? '').trim() || undefined,
      kind: String(data.get('kind') || 'FINISHED') as ProductKind,
      categoryId: String(data.get('categoryId') ?? '') || undefined,
      ...(groupName
        ? { groupName }
        : { groupId: String(data.get('groupId') ?? '') || undefined }),
      attributes: attributesRef.current,
    }
    if (!input.name || Number.isNaN(input.price)) {
      setError('Укажите название и цену')
      return
    }
    setBusy(true)
    setError(null)
    try {
      let saved = initial ? await updateProduct(initial.id, input) : await createProduct(input)
      if (!initial && pending.length) {
        saved = await uploadProductImages(
          saved.id,
          pending.map((item) => item.file),
        )
      }
      onSaved(saved)
    } catch (err) {
      setError(
        !initial && pending.length
          ? imageError(err instanceof Error ? err.message : '')
          : 'Не удалось сохранить. Возможно, такой артикул уже есть.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function onRemove() {
    if (!initial) return
    setBusy(true)
    setError(null)
    try {
      await setProductCatalog(initial.id, false)
      onRemoved(initial.id)
    } catch {
      setError('Не удалось убрать из каталога')
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <Modal title={initial ? initial.name : 'Новая карточка'} onClose={onClose} wide>
      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
        <div>
          <p className="text-xs font-medium text-secondary">Картинки</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {initial
              ? savedImages.map((image) => (
                  <div key={image.id} className="relative h-24 w-24 overflow-hidden rounded-md border-2 border-slate-300">
                    <img
                      src={productImageUrl(initial.id, image.id, 192)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeSaved(image.id)}
                      className="absolute top-1 right-1 rounded bg-white/90 px-1.5 text-xs leading-5 text-foreground"
                    >
                      ×
                    </button>
                  </div>
                ))
              : null}
            {pending.map((item) => (
              <div key={item.key} className="relative h-24 w-24 overflow-hidden rounded-md border-2 border-slate-300">
                <img src={item.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePending(item.key)}
                  className="absolute top-1 right-1 rounded bg-white/90 px-1.5 text-xs leading-5 text-foreground"
                >
                  ×
                </button>
              </div>
            ))}
            {total < 8 ? (
              <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 text-center text-xs text-secondary hover:bg-slate-50">
                Добавить
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    if (event.target.files?.length) void addFiles(event.target.files)
                    event.target.value = ''
                  }}
                />
              </label>
            ) : null}
          </div>
        </div>
        <label className="text-xs font-medium text-secondary">
          Название
          <input
            name="name"
            required
            defaultValue={initial?.name ?? ''}
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-secondary">
          Артикул
          <input
            name="sku"
            defaultValue={initial?.sku ?? ''}
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-medium text-secondary">
            Тип
            <select
              name="kind"
              defaultValue={initial?.kind ?? 'FINISHED'}
              className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm"
            >
              {(Object.keys(PRODUCT_KIND_LABEL) as ProductKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {PRODUCT_KIND_LABEL[kind]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-secondary">
            Вкладка склада
            <select
              name="categoryId"
              defaultValue={initial?.categoryId ?? categories.find((c) => c.name === 'Готовая продукция')?.id ?? ''}
              className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm"
            >
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-secondary">
            Ед.
            <input
              name="unit"
              defaultValue={initial?.unit ?? 'шт'}
              className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-secondary">
            Цена
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={initial?.price ?? 0}
              className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
            />
          </label>
        </div>
        <label className="text-xs font-medium text-secondary">
          Группа
          <select
            name="groupId"
            defaultValue={initial?.groupId ?? ''}
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm"
          >
            <option value="">Без группы</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-secondary">
          Или новая группа
          <input
            name="groupName"
            placeholder="Название"
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
          />
        </label>
        <ProductAttributesEditor
          initial={initial?.attributes}
          onChange={(rows) => {
            attributesRef.current = rows
          }}
          onError={setError}
        />
        <label className="text-xs font-medium text-secondary">
          Описание
          <textarea
            name="description"
            rows={2}
            defaultValue={initial?.description ?? ''}
            className="mt-1 w-full rounded-md border-2 border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="mt-2 flex items-center justify-between gap-3">
          {initial ? (
            confirming ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-foreground">Убрать из каталога?</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onRemove()}
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
                Убрать из каталога
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
              {initial ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

function FromWarehouseModal({
  onClose,
  onAdded,
}: {
  onClose: () => void
  onAdded: (items: Product[]) => void
}) {
  const [items, setItems] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      fetchProducts(query, 'stock')
        .then(setItems)
        .finally(() => setLoading(false))
    }, 200)
    return () => window.clearTimeout(timer)
  }, [query])

  const selected = items.filter((item) => picked[item.id])

  async function confirm() {
    if (selected.length === 0) return
    setBusy(true)
    setError(null)
    try {
      onAdded(await Promise.all(selected.map((item) => setProductCatalog(item.id, true))))
    } catch {
      setError('Не удалось добавить со склада')
      setBusy(false)
    }
  }

  return (
    <Modal title="Со склада" onClose={onClose} wide>
      <p className="mt-1 text-sm text-secondary">Позиция останется на складе и появится как карточка в каталоге.</p>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Поиск по названию или артикулу"
        className="mt-4 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
      />
      <div className="mt-3 max-h-[50vh] overflow-auto rounded-md border-2 border-slate-300">
        {loading ? (
          <p className="px-3 py-8 text-sm text-secondary">Загрузка</p>
        ) : items.length === 0 ? (
          <p className="px-3 py-8 text-sm text-secondary">
            {query.trim() ? 'Ничего не найдено' : 'Все складские позиции уже в каталоге, либо склад пуст.'}
          </p>
        ) : (
          <ul>
            {items.map((item) => {
              const on = Boolean(picked[item.id])
              return (
                <li key={item.id} className={`border-b border-slate-200 last:border-b-0 ${on ? 'bg-slate-50' : ''}`}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setPicked((current) => ({ ...current, [item.id]: !current[item.id] }))}
                      className="mt-1"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">{item.name}</span>
                      <span className="block text-xs text-secondary">
                        {item.sku ? `${item.sku} · ` : ''}
                        {item.kind ? `${PRODUCT_KIND_LABEL[item.kind]} · ` : ''}
                        {item.unit}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-secondary">{selected.length ? `Выбрано: ${selected.length}` : 'Ничего не выбрано'}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="h-10 px-3 text-sm text-secondary">
            Отмена
          </button>
          <button
            type="button"
            disabled={busy || selected.length === 0}
            onClick={() => void confirm()}
            className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
          >
            Добавить в каталог
          </button>
        </div>
      </div>
    </Modal>
  )
}
