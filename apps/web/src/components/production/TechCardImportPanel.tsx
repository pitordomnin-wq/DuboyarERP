import { useEffect, useState } from 'react'
import { fetchProducts, type Product } from '@/lib/products-api'
import { fetchWarehouses, type Warehouse } from '@/lib/warehouse-api'
import {
  importTechCard,
  RELEASE_TYPE_LABEL,
  type ImportTechCardRow,
  type ProductionReleaseType,
} from '@/lib/production-api'

type ParsedSheet = {
  rows: ImportTechCardRow[]
  fileName: string
}

export function TechCardImportPanel({ onImported }: { onImported?: () => void }) {
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [productId, setProductId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [releaseType, setReleaseType] = useState<ProductionReleaseType>('DECK')
  const [parsed, setParsed] = useState<ParsedSheet | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    void Promise.all([fetchProducts(undefined, 'FINISHED'), fetchWarehouses()]).then(([nextProducts, nextWarehouses]) => {
      setProducts(nextProducts)
      setWarehouses(nextWarehouses)
      setProductId(nextProducts[0]?.id ?? '')
      setWarehouseId(nextWarehouses[0]?.id ?? '')
    })
  }, [])

  async function onPickFile(list: FileList | null) {
    const file = list?.[0]
    if (!file) return
    setError(null)
    setDone(false)
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1 })
      const rows: ImportTechCardRow[] = []
      for (let i = 2; i < matrix.length; i++) {
        const row = matrix[i]
        if (!row?.[0]) continue
        const stage = Number(row[1])
        if (!stage) continue
        rows.push({
          materialName: String(row[0]),
          stage,
          normDeckM2: row[2] != null ? Number(row[2]) : undefined,
          normHerringboneM2: row[3] != null ? Number(row[3]) : undefined,
        })
      }
      if (!rows.length) {
        setError('Не удалось прочитать строки материалов')
        return
      }
      setParsed({ rows, fileName: file.name })
    } catch {
      setError('Не удалось прочитать Excel-файл')
    }
  }

  async function submit() {
    if (!parsed || !productId || !warehouseId) return
    setBusy(true)
    setError(null)
    try {
      await importTechCard({
        productId,
        warehouseId,
        defaultReleaseType: releaseType,
        rows: parsed.rows,
      })
      setDone(true)
      onImported?.()
    } catch {
      setError('Не удалось импортировать техкарту')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Импорт техкарты из Excel</h2>
        <p className="mt-1 text-sm text-secondary">
          Загрузите файл «Норма расхода с разбивкой на этапы». Этапы 1, 3 и 4 будут сопоставлены автоматически.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl glass p-4 sm:grid-cols-2">
        <label className="text-xs font-medium text-secondary">
          Готовая продукция
          <select
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm"
          >
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-secondary">
          Склад
          <select
            value={warehouseId}
            onChange={(event) => setWarehouseId(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-2 text-sm"
          >
            {warehouses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-secondary">
          Тип выпуска по умолчанию
          <select
            value={releaseType}
            onChange={(event) => setReleaseType(event.target.value as ProductionReleaseType)}
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
          Excel-файл
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) => void onPickFile(event.target.files)}
            className="mt-1 block w-full text-sm"
          />
        </label>
      </div>

      {parsed ? (
        <p className="text-sm text-secondary">
          Прочитано {parsed.rows.length} строк из «{parsed.fileName}»
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {done ? <p className="text-sm text-secondary">Техкарта импортирована</p> : null}

      <button
        type="button"
        disabled={!parsed || busy}
        onClick={() => void submit()}
        className="h-10 w-fit rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50"
      >
        {busy ? 'Импорт…' : 'Импортировать'}
      </button>
    </div>
  )
}
