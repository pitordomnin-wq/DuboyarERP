import { useEffect, useState, type FormEvent } from 'react'
import {
  fetchLkpNorms,
  LKP_CATEGORY_LABEL,
  updateLkpNorms,
  type LkpMaterialCategory,
  type LkpNorm,
} from '@/lib/production-api'

const ALL_CATEGORIES: LkpMaterialCategory[] = ['PRIMER', 'LACQUER_OIL', 'PASTE', 'DYE', 'PIGMENT']

export function LkpNormsPanel() {
  const [items, setItems] = useState<LkpNorm[]>([])
  const [draft, setDraft] = useState<Record<LkpMaterialCategory, { normPerM2Kg: number; keywords: string }>>({
    PRIMER: { normPerM2Kg: 0.05, keywords: 'грунт, грунтовк, изолятор' },
    LACQUER_OIL: { normPerM2Kg: 0.015, keywords: 'лак, масло' },
    PASTE: { normPerM2Kg: 0.005, keywords: 'паста' },
    DYE: { normPerM2Kg: 0.005, keywords: 'краситель, морилк' },
    PIGMENT: { normPerM2Kg: 0.003, keywords: 'пигмент' },
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void fetchLkpNorms()
      .then((rows) => {
        setItems(rows)
        const next = { ...draft }
        for (const row of rows) {
          next[row.category] = {
            normPerM2Kg: row.normPerM2Kg,
            keywords: row.keywords.join(', '),
          }
        }
        setDraft(next)
      })
      .finally(() => setLoading(false))
  }, [])

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      const payload = ALL_CATEGORIES.map((category) => ({
        category,
        normPerM2Kg: draft[category].normPerM2Kg,
        keywords: draft[category].keywords
          .split(/[,;]+/)
          .map((part) => part.trim().toLowerCase())
          .filter(Boolean),
      }))
      const next = await updateLkpNorms(payload)
      setItems(next)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-secondary">Загрузка</p>

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Нормы расхода ЛКП</h2>
        <p className="mt-1 text-sm text-secondary">
          Нормы в кг на 1 м² после профилирования (0,015 = 15 г). Материалы подбираются по ключевым словам в названии на складе.
        </p>
      </div>
      <div className="overflow-auto rounded-2xl glass">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-secondary">
            <tr>
              <th className="border-b border-line px-3 py-2">Категория</th>
              <th className="border-b border-line px-3 py-2">кг / м²</th>
              <th className="border-b border-line px-3 py-2">Ключевые слова</th>
            </tr>
          </thead>
          <tbody>
            {ALL_CATEGORIES.map((category) => (
              <tr key={category} className="border-b border-slate-200">
                <td className="px-3 py-2.5 font-medium">{LKP_CATEGORY_LABEL[category]}</td>
                <td className="px-3 py-2.5">
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={draft[category].normPerM2Kg}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [category]: { ...current[category], normPerM2Kg: Number(event.target.value) || 0 },
                      }))
                    }
                    className="h-9 w-28 rounded-md border-2 border-slate-300 px-2 text-sm"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <input
                    value={draft[category].keywords}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [category]: { ...current[category], keywords: event.target.value },
                      }))
                    }
                    className="h-9 w-full rounded-md border-2 border-slate-300 px-2 text-sm"
                    placeholder="лак, масло"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50"
        >
          {saving ? 'Сохранение…' : 'Сохранить нормы'}
        </button>
        {saved ? <span className="text-sm text-secondary">Сохранено</span> : null}
      </div>
      {items.length ? (
        <p className="text-xs text-secondary">Лак и масло списываются взаимозаменяемо по FIFO в одной категории.</p>
      ) : null}
    </form>
  )
}
