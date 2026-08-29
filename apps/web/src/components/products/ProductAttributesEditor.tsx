import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import {
  createAttributeTemplate,
  deleteAttributeTemplate,
  fetchAttributeTemplates,
  type AttributeTemplate,
  type ProductAttribute,
} from '@/lib/products-api'

type Row = { key: string; name: string; value: string }

function toRows(items?: ProductAttribute[]): Row[] {
  const filled = (items ?? []).filter((item) => item.name.trim() || item.value.trim())
  if (!filled.length) return [{ key: crypto.randomUUID(), name: '', value: '' }]
  return filled.map((item) => ({
    key: item.id ?? crypto.randomUUID(),
    name: item.name,
    value: item.value,
  }))
}

export function filledAttributes(rows: Row[]) {
  return rows
    .map((row) => ({ name: row.name.trim(), value: row.value.trim() }))
    .filter((row) => row.name && row.value)
}

export function ProductAttributesEditor({
  initial,
  onChange,
  onError,
}: {
  initial?: ProductAttribute[]
  onChange: (rows: { name: string; value: string }[]) => void
  onError: (message: string | null) => void
}) {
  const [rows, setRows] = useState<Row[]>(() => toRows(initial))
  const [templates, setTemplates] = useState<AttributeTemplate[]>([])
  const [saving, setSaving] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [naming, setNaming] = useState(false)

  useEffect(() => {
    onChange(filledAttributes(rows))
  }, [])

  useEffect(() => {
    void fetchAttributeTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
  }, [])

  function emit(next: Row[]) {
    setRows(next)
    onChange(filledAttributes(next))
  }

  function addRow() {
    if (rows.length >= 20) return
    emit([...rows, { key: crypto.randomUUID(), name: '', value: '' }])
  }

  async function saveTemplate() {
    const items = filledAttributes(rows)
    if (!items.length) {
      onError('Сначала заполните характеристики')
      return
    }
    const name = templateName.trim()
    if (!name) {
      onError('Укажите название шаблона')
      return
    }
    setSaving(true)
    onError(null)
    try {
      const saved = await createAttributeTemplate({ name, items })
      setTemplates((current) => [...current, saved].sort((a, b) => a.name.localeCompare(b.name, 'ru')))
      setTemplateName('')
      setNaming(false)
    } catch (err) {
      onError(err instanceof Error && err.message === 'template_name_taken' ? 'Шаблон с таким названием уже есть' : 'Не удалось сохранить шаблон')
    } finally {
      setSaving(false)
    }
  }

  function applyTemplate(id: string) {
    const template = templates.find((item) => item.id === id)
    if (!template) return
    emit(toRows(template.items))
  }

  async function removeTemplate(id: string) {
    try {
      await deleteAttributeTemplate(id)
      setTemplates((current) => current.filter((item) => item.id !== id))
    } catch {
      onError('Не удалось удалить шаблон')
    }
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-medium text-secondary">Характеристики</legend>
      {rows.map((row, index) => (
        <div key={row.key} className="flex items-center gap-2">
          <input
            value={row.name}
            onChange={(event) =>
              emit(rows.map((item) => (item.key === row.key ? { ...item, name: event.target.value } : item)))
            }
            placeholder="Название"
            maxLength={80}
            className="h-10 min-w-0 flex-1 rounded-md border-2 border-slate-300 px-3 text-sm"
          />
          <input
            value={row.value}
            onChange={(event) =>
              emit(rows.map((item) => (item.key === row.key ? { ...item, value: event.target.value } : item)))
            }
            placeholder="Значение"
            maxLength={300}
            className="h-10 min-w-0 flex-1 rounded-md border-2 border-slate-300 px-3 text-sm"
          />
          <button
            type="button"
            aria-label="Удалить характеристику"
            disabled={rows.length === 1 && !row.name && !row.value}
            onClick={() =>
              emit(rows.length === 1 ? [{ key: crypto.randomUUID(), name: '', value: '' }] : rows.filter((item) => item.key !== row.key))
            }
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border-2 border-slate-300 text-secondary hover:bg-slate-50 disabled:opacity-40"
          >
            <X size={16} strokeWidth={2} />
          </button>
          {index === rows.length - 1 ? (
            <button
              type="button"
              aria-label="Добавить характеристику"
              disabled={rows.length >= 20}
              onClick={addRow}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border-2 border-slate-300 text-foreground hover:bg-slate-50 disabled:opacity-40"
            >
              <Plus size={16} strokeWidth={2} />
            </button>
          ) : (
            <span className="w-10 shrink-0" />
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        {naming ? (
          <>
            <input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="Название шаблона"
              maxLength={120}
              className="h-10 min-w-0 flex-1 rounded-md border-2 border-slate-300 px-3 text-sm"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveTemplate()}
              className="h-10 rounded-md bg-primary px-3 text-sm font-semibold text-on-primary disabled:opacity-60"
            >
              Сохранить
            </button>
            <button type="button" onClick={() => setNaming(false)} className="h-10 px-2 text-sm text-secondary">
              Отмена
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="h-10 rounded-md border-2 border-slate-300 bg-white px-3 text-sm"
          >
            Сохранить шаблон
          </button>
        )}
      </div>
      {templates.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {templates.map((item) => (
            <li key={item.id} className="inline-flex items-center gap-1 rounded-md border-2 border-slate-300 px-2 py-1 text-xs">
              <button type="button" onClick={() => applyTemplate(item.id)} className="text-foreground" title="Подставить в карточку">
                {item.name}
              </button>
              <button
                type="button"
                aria-label={`Удалить шаблон ${item.name}`}
                onClick={() => void removeTemplate(item.id)}
                className="text-secondary hover:text-foreground"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  )
}
