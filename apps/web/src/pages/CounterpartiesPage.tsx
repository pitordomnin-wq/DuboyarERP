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
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-on-primary"
        >
          Новый контрагент
        </Link>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Поиск по названию, ИНН, почте"
        className="mb-4 h-10 max-w-md rounded-md border-2 border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
      />

      <div className="min-h-0 flex-1 overflow-auto rounded-md border-2 border-slate-300 bg-white">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-secondary">
            <tr>
              <th className="border-b-2 border-slate-300 px-3 py-2">Наименование</th>
              <th className="border-b-2 border-slate-300 px-3 py-2">ИНН</th>
              <th className="border-b-2 border-slate-300 px-3 py-2">Email</th>
              <th className="border-b-2 border-slate-300 px-3 py-2">Telegram</th>
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
      <td className="px-3 py-2.5 text-secondary">{item.email}</td>
      <td className="px-3 py-2.5 text-secondary">
        {item.telegram ? `@${item.telegram}` : 'не подключён'}
      </td>
    </tr>
  )
}
