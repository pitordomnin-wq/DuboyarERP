import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchCounterparties, type Counterparty } from '@/lib/counterparties-api'

export function CounterpartiesPage() {
  const [items, setItems] = useState<Counterparty[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      fetchCounterparties(query)
        .then(setItems)
        .finally(() => setLoading(false))
    }, 200)
    return () => window.clearTimeout(timer)
  }, [query])

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-5 md:px-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Контрагенты</h1>
          <p className="mt-1 text-sm text-secondary">Юр. данные и контакты для счетов и чата в продажах</p>
        </div>
        <Link
          to="/counterparties/new"
          className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary shadow-[0_2px_10px_rgba(47,90,112,0.22)] transition-opacity duration-150 hover:opacity-95"
        >
          Новый контрагент
        </Link>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Поиск по названию, ИНН, почте"
        className="mb-4 h-10 max-w-md rounded-xl border border-line bg-white/70 px-3.5 text-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:shadow-[0_0_0_3px_rgba(227,148,33,0.22)]"
      />

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl glass">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-secondary">
            <tr>
              <th className="border-b border-line px-3 py-2">Наименование</th>
              <th className="border-b border-line px-3 py-2">ИНН</th>
              <th className="border-b border-line px-3 py-2">Юридический адрес</th>
              <th className="border-b border-line px-3 py-2">Email</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-secondary">
                  Загрузка
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-secondary">
                  Никого нет
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <CounterpartyRow key={item.id} item={item} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CounterpartyRow({ item }: { item: Counterparty }) {
  const navigate = useNavigate()
  return (
    <tr
      className="cursor-pointer border-b border-slate-200 hover:bg-slate-50"
      onClick={() => navigate(`/counterparties/${item.id}`)}
    >
      <td className="px-3 py-2.5 font-medium text-foreground">{item.name}</td>
      <td className="px-3 py-2.5 tabular-nums text-secondary">{item.inn}</td>
      <td className="max-w-md px-3 py-2.5 text-secondary">{item.legalAddress}</td>
      <td className="px-3 py-2.5 text-secondary">{item.email}</td>
    </tr>
  )
}
