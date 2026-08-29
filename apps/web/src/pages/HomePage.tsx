import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowUpRight,
  Factory,
  Handshake,
  ListTodo,
  Mail,
  Package,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { compactMoney, fetchHome, type HomeMonth, type HomeSummary } from '@/lib/home-api'
import { money } from '@/lib/products-api'

export function HomePage() {
  const { user } = useAuth()
  const [data, setData] = useState<HomeSummary | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchHome()
      .then((summary) => {
        if (!cancelled) setData(summary)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const greeting = useMemo(() => greet(user?.name ?? ''), [user?.name])
  const today = useMemo(() => formatToday(), [])

  if (error) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 md:px-8">
        <h1 className="text-xl font-semibold tracking-[-0.03em]">Главная</h1>
        <p className="mt-2 text-sm text-secondary">Не удалось загрузить сводку. Обновите страницу.</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl animate-pulse space-y-4">
          <div className="h-10 w-64 rounded-md bg-slate-200" />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 rounded-xl border-2 border-slate-300 bg-white" />
            ))}
          </div>
          <div className="h-72 rounded-xl border-2 border-slate-300 bg-white" />
        </div>
      </div>
    )
  }

  const { kpis } = data
  const financial = [
    kpis.pipelineCount !== null
      ? {
          key: 'pipeline',
          to: '/sales',
          label: 'Сделки в работе',
          value: String(kpis.pipelineCount),
          hint: kpis.pipelineValue !== null ? compactMoney(kpis.pipelineValue) : undefined,
          icon: Handshake,
        }
      : null,
    kpis.revenueMonth !== null
      ? {
          key: 'revenue',
          to: '/sales',
          label: 'Выручка за месяц',
          value: compactMoney(kpis.revenueMonth),
          hint: 'Оплаченные и дальше по воронке',
          icon: TrendingUp,
        }
      : null,
    kpis.expensesMonth !== null
      ? {
          key: 'expenses',
          to: '/purchases',
          label: 'Расходы за месяц',
          value: compactMoney(kpis.expensesMonth),
          hint: 'Проведённые закупки',
          icon: TrendingDown,
        }
      : null,
    kpis.profitMonth !== null
      ? {
          key: 'profit',
          to: '/sales',
          label: 'Прибыль за месяц',
          value: compactMoney(kpis.profitMonth),
          hint: 'Выручка минус закупки',
          icon: kpis.profitMonth >= 0 ? TrendingUp : TrendingDown,
          down: kpis.profitMonth < 0,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)
  const operational = [
    kpis.openTasks !== null
      ? {
          key: 'tasks',
          to: '/tasks',
          label: 'Открытые задачи',
          value: String(kpis.openTasks),
          hint: kpis.personalOpen ? `Личных: ${kpis.personalOpen}` : 'Доска организации',
          icon: ListTodo,
        }
      : null,
    kpis.activeJobs !== null
      ? {
          key: 'jobs',
          to: '/production',
          label: 'Производство',
          value: String(kpis.activeJobs),
          hint: 'Активные заказы',
          icon: Factory,
        }
      : null,
    kpis.unreadMail !== null
      ? {
          key: 'mail',
          to: '/mail',
          label: 'Письма',
          value: String(kpis.unreadMail),
          hint: 'Непрочитанные входящие',
          icon: Mail,
        }
      : null,
    kpis.stockValue !== null
      ? {
          key: 'stock',
          to: '/warehouse',
          label: 'Остатки',
          value: compactMoney(kpis.stockValue),
          hint: 'Оценка по цене в карточке',
          icon: Warehouse,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)
  const kpisList = (financial.length >= 3 ? financial : [...financial, ...operational]).slice(0, 4)

  const showRevenue = kpis.revenueMonth !== null
  const showExpenses = kpis.expensesMonth !== null
  const pipelineLive = Boolean(data.pipeline?.some((row) => row.count > 0))

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 md:gap-6 md:px-8 md:py-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-foreground md:text-[28px]">{greeting}</h1>
            <p className="mt-1 text-sm text-secondary">Сводка по {data.organizationName}</p>
          </div>
          <p className="text-sm capitalize text-secondary">{today}</p>
        </header>

        {kpisList.length > 0 ? (
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {kpisList.map((item) => (
              <KpiCard
                key={item.key}
                to={item.to}
                label={item.label}
                value={item.value}
                hint={item.hint}
                icon={item.icon}
                down={item.down}
              />
            ))}
          </section>
        ) : null}

        {data.months || pipelineLive ? (
          <section className="grid gap-3 lg:grid-cols-5">
            {data.months ? (
              <article
                className={`rounded-xl border-2 border-slate-300 bg-white p-4 md:p-5 ${
                  pipelineLive ? 'lg:col-span-3' : 'lg:col-span-5'
                }`}
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold tracking-[-0.02em] text-foreground">Выручка и расходы</h2>
                    <p className="mt-0.5 text-xs text-secondary">Последние шесть месяцев</p>
                  </div>
                  <div className="flex gap-3 text-xs text-secondary">
                    {showRevenue ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-foreground" />
                        Выручка
                      </span>
                    ) : null}
                    {showExpenses ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-accent" />
                        Расходы
                      </span>
                    ) : null}
                  </div>
                </div>
                <TrendChart months={data.months} showRevenue={showRevenue} showExpenses={showExpenses} />
              </article>
            ) : null}
            {pipelineLive && data.pipeline ? (
              <article className="rounded-xl border-2 border-slate-300 bg-white p-4 md:p-5 lg:col-span-2">
                <h2 className="text-sm font-semibold tracking-[-0.02em] text-foreground">Воронка продаж</h2>
                <p className="mt-0.5 text-xs text-secondary">Сделки по статусам</p>
                <PipelineList rows={data.pipeline} />
              </article>
            ) : null}
          </section>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.tasks ? (
            <ProcessCard
              to="/tasks"
              title="Задачи"
              icon={ListTodo}
              rows={[
                ['Открытые', String(data.tasks.open)],
                ['На проверке', String(data.tasks.review)],
                ['Личные', String(data.tasks.personalOpen)],
              ]}
            />
          ) : null}
          {kpis.unreadMail ? (
            <ProcessCard
              to="/mail"
              title="Почта"
              icon={Mail}
              rows={[['Непрочитанные', String(kpis.unreadMail)]]}
            />
          ) : null}
          {data.production ? (
            <ProcessCard
              to="/production"
              title="Производство"
              icon={Factory}
              rows={[
                ['В работе', String(data.production.active)],
                ['К запуску', String(data.production.toStart)],
                ['Готово', String(data.production.done)],
              ]}
            />
          ) : null}
          {data.warehouse ? (
            <ProcessCard
              to="/warehouse"
              title="Склад"
              icon={Warehouse}
              rows={[
                ['Остатки', compactMoney(data.warehouse.stockValue)],
                ['Позиции', String(data.warehouse.skuInStock)],
                ['Склады', String(data.warehouse.warehouses)],
              ]}
            />
          ) : null}
          {data.purchases ? (
            <ProcessCard
              to="/purchases"
              title="Закупки"
              icon={ShoppingCart}
              rows={[
                ['За месяц', compactMoney(data.purchases.postedMonthValue)],
                ['Проведено', String(data.purchases.postedMonth)],
                ['Черновики', String(data.purchases.drafts)],
              ]}
            />
          ) : null}
          {data.catalog.products !== null ? (
            <ProcessCard
              to="/products"
              title="Товары"
              icon={Package}
              rows={[['Всего', String(data.catalog.products)]]}
            />
          ) : null}
          {data.catalog.counterparties !== null ? (
            <ProcessCard
              to="/counterparties"
              title="Контрагенты"
              icon={Users}
              rows={[['Всего', String(data.catalog.counterparties)]]}
            />
          ) : null}
        </section>

        {data.attention.length > 0 ? (
          <section className="rounded-xl border-2 border-slate-300 bg-white p-4 md:p-5">
            <div className="mb-3 flex items-center gap-2">
              <AlertCircle size={16} strokeWidth={1.75} className="text-secondary" />
              <h2 className="text-sm font-semibold tracking-[-0.02em] text-foreground">Требует внимания</h2>
            </div>
            <ul className="divide-y divide-slate-200">
              {data.attention.map((item) => (
                <li key={item.id}>
                  <Link
                    to={item.to}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:text-foreground"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="mt-0.5 text-xs text-secondary">{item.hint}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-sm font-semibold tabular-nums text-foreground">
                      {item.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function KpiCard({
  to,
  label,
  value,
  hint,
  icon: Icon,
  down,
}: {
  to: string
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  down?: boolean
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-xl border-2 border-slate-300 bg-white p-4 transition-colors duration-200 hover:border-slate-400"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">{label}</p>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-secondary">
          <Icon size={16} strokeWidth={1.75} />
        </span>
      </div>
      <p
        className={`mt-3 text-xl font-semibold tracking-[-0.04em] tabular-nums md:text-2xl ${
          down ? 'text-destructive' : 'text-foreground'
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-secondary">{hint}</p> : null}
    </Link>
  )
}

function ProcessCard({
  to,
  title,
  icon: Icon,
  rows,
}: {
  to: string
  title: string
  icon: LucideIcon
  rows: [string, string][]
}) {
  return (
    <Link
      to={to}
      className="group flex h-full flex-col rounded-xl border-2 border-slate-300 bg-white p-4 transition-colors duration-200 hover:border-slate-400"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-secondary">
            <Icon size={16} strokeWidth={1.75} />
          </span>
          <h2 className="text-sm font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
        </div>
        <ArrowUpRight size={16} strokeWidth={1.75} className="text-slate-300 transition-colors group-hover:text-secondary" />
      </div>
      <dl className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-secondary">{label}</dt>
            <dd className="text-sm font-medium tabular-nums text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </Link>
  )
}

function PipelineList({ rows }: { rows: NonNullable<HomeSummary['pipeline']> }) {
  const max = Math.max(1, ...rows.map((row) => row.count))
  return (
    <ul className="mt-4 space-y-2.5">
      {rows.map((row) => (
        <li key={row.status} title={money(row.value)}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate text-secondary">{row.label}</span>
            <span className="shrink-0 tabular-nums text-foreground">{row.count}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-foreground"
              style={{ width: `${Math.max(row.count > 0 ? 6 : 0, (row.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function TrendChart({
  months,
  showRevenue,
  showExpenses,
}: {
  months: HomeMonth[]
  showRevenue: boolean
  showExpenses: boolean
}) {
  const width = 640
  const height = 228
  const pad = { l: 52, r: 12, t: 12, b: 28 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const peak = Math.max(
    1,
    ...months.map((item) => Math.max(showRevenue ? item.revenue : 0, showExpenses ? item.expenses : 0)),
  )
  const n = months.length
  const x = (index: number) => pad.l + (n <= 1 ? innerW / 2 : (index / (n - 1)) * innerW)
  const y = (value: number) => pad.t + innerH - (value / peak) * innerH
  const ticks = [0, 0.5, 1].map((part) => part * peak)
  const empty = months.every((item) => item.revenue === 0 && item.expenses === 0)

  function line(values: number[]) {
    return values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(' ')
  }

  function area(values: number[]) {
    return `${line(values)} L ${x(values.length - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[200px] w-full md:h-[228px]" role="img" aria-label="График выручки и расходов">
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <text x={pad.l - 8} y={y(tick) + 4} textAnchor="end" className="fill-slate-400" fontSize="10">
              {formatAxis(tick)}
            </text>
          </g>
        ))}
        {showExpenses ? (
          <>
            <path d={area(months.map((item) => item.expenses))} fill="#0369a1" fillOpacity="0.12" />
            <path d={line(months.map((item) => item.expenses))} fill="none" stroke="#0369a1" strokeWidth="2" />
          </>
        ) : null}
        {showRevenue ? (
          <>
            <path d={area(months.map((item) => item.revenue))} fill="#0f172a" fillOpacity="0.1" />
            <path d={line(months.map((item) => item.revenue))} fill="none" stroke="#0f172a" strokeWidth="2.25" />
          </>
        ) : null}
        {months.map((item, index) => (
          <g key={item.key}>
            {showRevenue ? (
              <circle cx={x(index)} cy={y(item.revenue)} r="3.5" fill="#0f172a">
                <title>
                  {item.label}: выручка {compactMoney(item.revenue)}
                </title>
              </circle>
            ) : null}
            {showExpenses ? (
              <circle cx={x(index)} cy={y(item.expenses)} r="3.5" fill="#0369a1">
                <title>
                  {item.label}: расходы {compactMoney(item.expenses)}
                </title>
              </circle>
            ) : null}
            <text x={x(index)} y={height - 8} textAnchor="middle" className="fill-slate-500" fontSize="11">
              {item.label}
            </text>
          </g>
        ))}
      </svg>
      {empty ? (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-secondary">
          За полгода пока нет оплат и закупок
        </p>
      ) : null}
    </div>
  )
}

function greet(name: string) {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', hour: 'numeric', hour12: false }).format(new Date()),
  )
  const first = name.trim().split(/\s+/)[0] || ''
  let hello = 'Добрый день'
  if (hour < 5 || hour >= 23) hello = 'Доброй ночи'
  else if (hour < 12) hello = 'Доброе утро'
  else if (hour >= 18) hello = 'Добрый вечер'
  return first ? `${hello}, ${first}` : hello
}

function formatToday() {
  return new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Moscow',
  })
}

function formatAxis(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`
  if (value >= 1000) return `${Math.round(value / 1000)} тыс`
  return String(Math.round(value))
}
