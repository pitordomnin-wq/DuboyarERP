import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowUpRight,
  Factory,
  Handshake,
  ListTodo,
  Package,
  ShoppingCart,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
  compactMoney,
  fetchHome,
  type ChartRange,
  type HomeMonth,
  type HomeSummary,
} from '@/lib/home-api'
import { money } from '@/lib/products-api'

const CHART_RANGES: { id: ChartRange; label: string }[] = [
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'year', label: 'Год' },
  { id: 'all', label: 'Всё время' },
]

const SERIES = {
  revenue: { color: '#3d6f8c', fill: 'rgba(61, 111, 140, 0.16)', label: 'Выручка' },
  expenses: { color: '#c45c4a', fill: 'rgba(196, 92, 74, 0.13)', label: 'Расходы' },
  profit: { color: '#4a7c59', fill: 'rgba(74, 124, 89, 0.14)', label: 'Прибыль' },
} as const

export function HomePage() {
  const { user } = useAuth()
  const [data, setData] = useState<HomeSummary | null>(null)
  const [range, setRange] = useState<ChartRange>('year')
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchHome(range)
      .then((summary) => {
        if (!cancelled) {
          setData(summary)
          setError(false)
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [range])

  const greeting = useMemo(() => greet(user?.name ?? ''), [user?.name])
  const today = useMemo(() => formatToday(), [])

  if (error && !data) {
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
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-64 rounded-md bg-slate-200" />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="glass h-28 rounded-2xl" />
            ))}
          </div>
          <div className="glass h-72 rounded-2xl" />
        </div>
      </div>
    )
  }

  const { kpis } = data
  const modules = [
    data.tasks
      ? {
          key: 'tasks',
          to: '/tasks',
          title: 'Задачи',
          icon: ListTodo,
          rows: [
            ['Открытые', String(data.tasks.open)],
            ['На проверке', String(data.tasks.review)],
            ['Личные', String(data.tasks.personalOpen)],
          ] as [string, string][],
        }
      : null,
    data.production
      ? {
          key: 'production',
          to: '/production',
          title: 'Производство',
          icon: Factory,
          rows: [
            ['В работе', String(data.production.active)],
            ['К запуску', String(data.production.toStart)],
            ['Готово', String(data.production.done)],
          ] as [string, string][],
        }
      : null,
    data.warehouse
      ? {
          key: 'warehouse',
          to: '/warehouse',
          title: 'Склад',
          icon: Warehouse,
          rows: [
            ['Остатки', compactMoney(data.warehouse.stockValue)],
            ['Позиции', String(data.warehouse.skuInStock)],
            ['Склады', String(data.warehouse.warehouses)],
          ] as [string, string][],
        }
      : null,
    data.purchases
      ? {
          key: 'purchases',
          to: '/purchases',
          title: 'Закупки',
          icon: ShoppingCart,
          rows: [
            ['За месяц', compactMoney(data.purchases.postedMonthValue)],
            ['Проведено', String(data.purchases.postedMonth)],
            ['Черновики', String(data.purchases.drafts)],
          ] as [string, string][],
        }
      : null,
    data.catalog.products !== null
      ? {
          key: 'products',
          to: '/products',
          title: 'Товары',
          icon: Package,
          rows: [['Всего', String(data.catalog.products)]] as [string, string][],
        }
      : null,
    data.catalog.counterparties !== null
      ? {
          key: 'counterparties',
          to: '/counterparties',
          title: 'Контрагенты',
          icon: Users,
          rows: [['Всего', String(data.catalog.counterparties)]] as [string, string][],
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  const showDeals = data.pipeline !== null
  const showRevenue = kpis.revenueMonth !== null
  const showExpenses = kpis.expensesMonth !== null
  const showProfit = kpis.profitMonth !== null
  const showChart = Boolean(data.months)

  return (
    <div className="relative min-h-0 flex-1">
      <div className="flex w-full flex-col gap-5 px-4 py-6 md:gap-6 md:px-8 md:py-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-foreground md:text-[28px]">{greeting}</h1>
            <p className="mt-1 text-sm text-secondary">Сводка по {data.organizationName}</p>
          </div>
          <p className="text-sm capitalize text-secondary">{today}</p>
        </header>

        {modules.length > 0 ? (
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {modules.map((item) => (
              <ProcessCard key={item.key} to={item.to} title={item.title} icon={item.icon} rows={item.rows} />
            ))}
          </section>
        ) : null}

        {showDeals && data.pipeline ? (
          <Link
            to="/sales"
            className="glass flex min-h-[280px] flex-col rounded-2xl p-5 transition-[background-color,box-shadow] duration-150 hover:bg-white/55 md:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">Сделки в работе</p>
                <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] tabular-nums text-foreground md:text-4xl">
                  {kpis.pipelineCount ?? 0}
                </p>
                <p className="mt-1 text-sm text-secondary">
                  {kpis.pipelineValue !== null ? compactMoney(kpis.pipelineValue) : 'По воронке'}
                </p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/45 text-accent">
                <Handshake size={18} strokeWidth={1.75} />
              </span>
            </div>
            <PipelineList rows={data.pipeline} />
          </Link>
        ) : null}

        {showChart && data.months ? (
          <article className="glass rounded-2xl p-4 md:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold tracking-[-0.02em] text-foreground">Выручка и расходы</h2>
                <p className="mt-0.5 text-xs text-secondary">Наведите на график, чтобы увидеть суммы</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="hidden gap-3 text-xs text-secondary sm:flex">
                  {showRevenue ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: SERIES.revenue.color }} />
                      Выручка
                    </span>
                  ) : null}
                  {showExpenses ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: SERIES.expenses.color }} />
                      Расходы
                    </span>
                  ) : null}
                  {showProfit ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: SERIES.profit.color }} />
                      Прибыль
                    </span>
                  ) : null}
                </div>
                <div className="flex gap-1">
                  {CHART_RANGES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setRange(item.id)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors duration-200 ${
                        range === item.id
                          ? 'border-line bg-white/70 text-foreground'
                          : 'border-line text-secondary hover:bg-white/35'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <TrendChart
              points={data.months}
              range={range}
              showRevenue={showRevenue}
              showExpenses={showExpenses}
              showProfit={showProfit}
            />
          </article>
        ) : null}

        {data.attention.length > 0 ? (
          <section className="glass rounded-2xl p-4 md:p-5">
            <div className="mb-3 flex items-center gap-2">
              <AlertCircle size={16} strokeWidth={1.75} className="text-secondary" />
              <h2 className="text-sm font-semibold tracking-[-0.02em] text-foreground">Требует внимания</h2>
            </div>
            <ul className="divide-y divide-line">
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
                    <span className="shrink-0 rounded-full bg-white/50 px-2 py-1 text-sm font-semibold tabular-nums text-foreground">
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
      className="glass group flex h-full flex-col rounded-2xl p-4 transition-[background-color,box-shadow] duration-200 hover:bg-white/70"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/45 text-accent">
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
    <ul className="mt-5 divide-y divide-line">
      {rows.map((row) => (
        <li key={row.status} className="py-2.5 first:pt-0" title={money(row.value)}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate text-secondary">{row.label}</span>
            <span className="shrink-0 tabular-nums text-foreground">{row.count}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/45">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(row.count > 0 ? 6 : 0, (row.count / max) * 100)}%`,
                backgroundColor: row.color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function TrendChart({
  points,
  range,
  showRevenue,
  showExpenses,
  showProfit,
}: {
  points: HomeMonth[]
  range: ChartRange
  showRevenue: boolean
  showExpenses: boolean
  showProfit: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const apply = (box: DOMRectReadOnly) => {
      const w = Math.round(box.width)
      const h = Math.round(box.height)
      setSize((current) => (current.w === w && current.h === h ? current : { w, h }))
    }
    apply(el.getBoundingClientRect())
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) apply(box)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const width = size.w || 960
  const height = size.h || 320
  const pad = { l: 52, r: 12, t: 16, b: 28 }
  const innerW = Math.max(1, width - pad.l - pad.r)
  const innerH = Math.max(1, height - pad.t - pad.b)
  const values = points.flatMap((item) => [
    showRevenue ? item.revenue : 0,
    showExpenses ? item.expenses : 0,
    showProfit ? item.profit : 0,
  ])
  const peak = Math.max(1, ...values, 0)
  const floor = Math.min(0, ...values)
  const span = Math.max(1, peak - floor)
  const n = points.length
  const x = (index: number) => pad.l + (n <= 1 ? innerW / 2 : (index / (n - 1)) * innerW)
  const y = (value: number) => pad.t + innerH - ((value - floor) / span) * innerH
  const zeroY = y(0)
  const ticks = [floor, floor + span / 2, peak]
  const empty = points.every((item) => item.revenue === 0 && item.expenses === 0 && item.profit === 0)
  const labelStep = n > 16 ? Math.ceil(n / 8) : n > 10 ? 2 : 1

  function coords(key: 'revenue' | 'expenses' | 'profit') {
    return points.map((item, index) => ({ x: x(index), y: y(item[key]) }))
  }

  function pointFromEvent(event: MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg || n === 0) return null
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const inv = ctm.inverse()
    return {
      x: inv.a * event.clientX + inv.c * event.clientY + inv.e,
      y: inv.b * event.clientX + inv.d * event.clientY + inv.f,
    }
  }

  function onMove(event: MouseEvent<SVGSVGElement>) {
    const local = pointFromEvent(event)
    if (!local) return
    if (n === 1) {
      setHover(0)
      return
    }
    const t = (local.x - pad.l) / innerW
    const index = Math.round(Math.min(1, Math.max(0, t)) * (n - 1))
    setHover(index)
  }

  const active = hover !== null ? points[hover] : null
  const tooltipLeft =
    hover !== null ? Math.min(width - 196, Math.max(8, x(hover) - 90)) : 8

  return (
    <div ref={wrapRef} className="relative h-[240px] w-full md:h-[320px]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="График выручки, расходов и прибыли"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.l} x2={width - pad.r} y1={y(tick)} y2={y(tick)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={pad.l - 10} y={y(tick) + 4} textAnchor="end" className="fill-slate-400" fontSize="11">
              {formatAxis(tick)}
            </text>
          </g>
        ))}
        {floor < 0 ? (
          <line x1={pad.l} x2={width - pad.r} y1={zeroY} y2={zeroY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
        ) : null}

        {showExpenses ? (
          <>
            <path d={areaPath(coords('expenses'), zeroY)} fill={SERIES.expenses.fill} />
            <path
              d={smoothPath(coords('expenses'))}
              fill="none"
              stroke={SERIES.expenses.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}
        {showRevenue ? (
          <>
            <path d={areaPath(coords('revenue'), zeroY)} fill={SERIES.revenue.fill} />
            <path
              d={smoothPath(coords('revenue'))}
              fill="none"
              stroke={SERIES.revenue.color}
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}
        {showProfit ? (
          <path
            d={smoothPath(coords('profit'))}
            fill="none"
            stroke={SERIES.profit.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {hover !== null && active ? (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={pad.t}
              y2={pad.t + innerH}
              stroke="#94a3b8"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            {showRevenue ? <circle cx={x(hover)} cy={y(active.revenue)} r="5" fill={SERIES.revenue.color} /> : null}
            {showExpenses ? <circle cx={x(hover)} cy={y(active.expenses)} r="5" fill={SERIES.expenses.color} /> : null}
            {showProfit ? <circle cx={x(hover)} cy={y(active.profit)} r="5" fill={SERIES.profit.color} /> : null}
          </g>
        ) : null}

        {points.map((item, index) =>
          index % labelStep === 0 || index === n - 1 ? (
            <text
              key={item.key}
              x={x(index)}
              y={height - 8}
              textAnchor={index === 0 ? 'start' : index === n - 1 ? 'end' : 'middle'}
              className="fill-slate-500"
              fontSize="11"
            >
              {item.label}
            </text>
          ) : null,
        )}
      </svg>

      {active && hover !== null && !empty ? (
        <div
          className="glass-pop pointer-events-none absolute z-10 min-w-[180px] rounded-2xl px-3 py-2"
          style={{ left: tooltipLeft, top: 8 }}
        >
          <p className="text-xs font-semibold text-foreground">{active.label}</p>
          <dl className="mt-1.5 space-y-1">
            {showRevenue ? (
              <div className="flex items-center justify-between gap-4 text-xs">
                <dt className="text-secondary">Выручка</dt>
                <dd className="tabular-nums font-medium" style={{ color: SERIES.revenue.color }}>
                  {compactMoney(active.revenue)}
                </dd>
              </div>
            ) : null}
            {showExpenses ? (
              <div className="flex items-center justify-between gap-4 text-xs">
                <dt className="text-secondary">Расходы</dt>
                <dd className="tabular-nums font-medium" style={{ color: SERIES.expenses.color }}>
                  {compactMoney(active.expenses)}
                </dd>
              </div>
            ) : null}
            {showProfit ? (
              <div className="flex items-center justify-between gap-4 text-xs">
                <dt className="text-secondary">Прибыль</dt>
                <dd className="tabular-nums font-medium" style={{ color: SERIES.profit.color }}>
                  {compactMoney(active.profit)}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {empty ? (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-secondary">
          {range === 'week'
            ? 'За неделю пока нет оплат и закупок'
            : range === 'month'
              ? 'За месяц пока нет оплат и закупок'
              : range === 'all'
                ? 'Пока нет оплат и закупок'
                : 'За год пока нет оплат и закупок'}
        </p>
      ) : null}
    </div>
  )
}

function smoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }
  const n = points.length
  const dx: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = points[i + 1].x - points[i].x
    m[i] = dx[i] === 0 ? 0 : (points[i + 1].y - points[i].y) / dx[i]
  }
  const slope = Array(n).fill(0)
  slope[0] = m[0]
  slope[n - 1] = m[n - 2]
  for (let i = 1; i < n - 1; i += 1) {
    slope[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2
  }
  for (let i = 0; i < n - 1; i += 1) {
    if (m[i] === 0) {
      slope[i] = 0
      slope[i + 1] = 0
      continue
    }
    const a = slope[i] / m[i]
    const b = slope[i + 1] / m[i]
    const t = a * a + b * b
    if (t > 9) {
      const s = 3 / Math.sqrt(t)
      slope[i] = s * a * m[i]
      slope[i + 1] = s * b * m[i]
    }
  }
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 0; i < n - 1; i += 1) {
    const c1x = points[i].x + dx[i] / 3
    const c1y = points[i].y + (slope[i] * dx[i]) / 3
    const c2x = points[i + 1].x - dx[i] / 3
    const c2y = points[i + 1].y - (slope[i + 1] * dx[i]) / 3
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${points[i + 1].x.toFixed(2)} ${points[i + 1].y.toFixed(2)}`
  }
  return d
}

function areaPath(points: { x: number; y: number }[], baseline: number) {
  if (points.length === 0) return ''
  const line = smoothPath(points)
  return `${line} L ${points[points.length - 1].x.toFixed(2)} ${baseline.toFixed(2)} L ${points[0].x.toFixed(2)} ${baseline.toFixed(2)} Z`
}

function greet(name: string) {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', hour: 'numeric', hour12: false }).format(new Date()),
  )
  const parts = name.trim().split(/\s+/).filter(Boolean)
  // "Домнин Петр" → greet by the given name (second word).
  const firstName = parts.length >= 2 ? parts[1] : parts[0] || ''
  let hello = 'Добрый день'
  if (hour < 5 || hour >= 23) hello = 'Доброй ночи'
  else if (hour < 12) hello = 'Доброе утро'
  else if (hour >= 18) hello = 'Добрый вечер'
  return firstName ? `${hello}, ${firstName}` : hello
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
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`
  if (abs >= 1000) return `${sign}${Math.round(abs / 1000)} тыс`
  return `${sign}${Math.round(abs)}`
}
