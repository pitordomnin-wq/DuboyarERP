import { useEffect, useState } from 'react'
import {
  LKP_CATEGORY_LABEL,
  type LkpMaterialCategory,
} from '@/lib/production-api'
import type { ProductCoatingRecipeLine } from '@/lib/products-api'

const ALL: LkpMaterialCategory[] = ['PRIMER', 'LACQUER_OIL', 'PASTE', 'DYE', 'PIGMENT']

function defaultLines(existing?: ProductCoatingRecipeLine[]): ProductCoatingRecipeLine[] {
  return ALL.map((category) => {
    const row = existing?.find((item) => item.category === category)
    return {
      category,
      enabled: row?.enabled ?? (category === 'LACQUER_OIL' || category === 'PRIMER'),
      normPerM2Kg: row?.normPerM2Kg ?? null,
    }
  })
}

export function CoatingRecipeEditor({
  initial,
  onChange,
}: {
  initial?: ProductCoatingRecipeLine[]
  onChange: (rows: ProductCoatingRecipeLine[]) => void
}) {
  const [rows, setRows] = useState(() => defaultLines(initial))

  useEffect(() => {
    onChange(defaultLines(initial))
  }, [])

  function patch(index: number, patch: Partial<ProductCoatingRecipeLine>) {
    setRows((current) => {
      const next = current.map((row, i) => (i === index ? { ...row, ...patch } : row))
      onChange(next)
      return next
    })
  }

  return (
    <div className="rounded-md border-2 border-slate-300 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Рецепт покрытия (этап 3)</p>
      <p className="text-xs text-secondary">Грунт + лак/масло + паста + краситель + пигмент. Нормы в кг/м² после профилирования.</p>
      <div className="mt-3 flex flex-col gap-2">
        {rows.map((row, index) => (
          <div key={row.category} className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-[140px] items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(event) => patch(index, { enabled: event.target.checked })}
              />
              {LKP_CATEGORY_LABEL[row.category]}
            </label>
            <input
              type="number"
              min="0"
              step="0.0001"
              disabled={!row.enabled}
              value={row.normPerM2Kg ?? ''}
              placeholder="по умолчанию"
              onChange={(event) =>
                patch(index, {
                  normPerM2Kg: event.target.value ? Number(event.target.value) : null,
                })
              }
              className="h-9 w-32 rounded-md border-2 border-slate-300 px-2 text-sm disabled:opacity-50"
            />
            <span className="text-xs text-secondary">кг/м²</span>
          </div>
        ))}
      </div>
    </div>
  )
}
