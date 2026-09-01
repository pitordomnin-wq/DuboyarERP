import { useEffect, useState, type FormEvent } from 'react'
import {
  createProductGroup,
  fetchProductGroups,
  updateProductGroup,
  type ProductGroup,
} from '@/lib/warehouse-api'

export function ProductGroupsPanel() {
  const [groups, setGroups] = useState<ProductGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newKeywords, setNewKeywords] = useState('')

  async function load() {
    setGroups(await fetchProductGroups())
  }

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [])

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
  }

  if (loading) return <p className="text-sm text-secondary">Загрузка</p>

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Учётные группы</h2>
        <p className="mt-1 text-sm text-secondary">
          Группы для взаимозаменяемых материалов. Списание по FIFO внутри группы по ключевым словам.
        </p>
      </div>

      <form onSubmit={(event) => void create(event)} className="flex flex-wrap items-end gap-2 rounded-2xl glass p-4">
        <label className="min-w-[180px] flex-1 text-xs font-medium text-secondary">
          Название
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
            placeholder="Клеи"
          />
        </label>
        <label className="min-w-[240px] flex-[2] text-xs font-medium text-secondary">
          Ключевые слова
          <input
            value={newKeywords}
            onChange={(event) => setNewKeywords(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
            placeholder="клей, смола"
          />
        </label>
        <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary">
          Добавить
        </button>
      </form>

      <div className="overflow-auto rounded-2xl glass">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-secondary">
            <tr>
              <th className="border-b border-line px-3 py-2">Группа</th>
              <th className="border-b border-line px-3 py-2">Товаров</th>
              <th className="border-b border-line px-3 py-2">Ключевые слова</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <GroupRow key={group.id} group={group} onSave={saveGroup} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GroupRow({
  group,
  onSave,
}: {
  group: ProductGroup
  onSave: (group: ProductGroup, keywords: string) => Promise<void>
}) {
  const [keywords, setKeywords] = useState((group.keywords ?? []).join(', '))
  const [saving, setSaving] = useState(false)

  return (
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
    </tr>
  )
}
