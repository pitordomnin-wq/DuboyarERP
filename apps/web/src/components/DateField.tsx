import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

type DateFieldProps = {
  name?: string
  value?: string
  defaultValue?: string
  required?: boolean
  className?: string
  onChange?: (event: { target: { name?: string; value: string } }) => void
}

export function DateField({ name, value, defaultValue = '', required, className, onChange }: DateFieldProps) {
  const isControlled = value !== undefined
  const [inner, setInner] = useState(defaultValue)
  const selected = isControlled ? value : inner
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => monthFrom(selected))
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const labelId = useId()

  useEffect(() => {
    if (open) setView(monthFrom(selected))
  }, [open, selected])

  useEffect(() => {
    if (!open) return

    function onPointer(event: PointerEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || popRef.current?.contains(target)) return
      setOpen(false)
    }

    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  function commit(next: string) {
    if (!isControlled) setInner(next)
    onChange?.({ target: { name, value: next } })
  }

  function pick(iso: string) {
    commit(iso)
    setOpen(false)
  }

  return (
    <>
      <input
        name={name}
        value={selected}
        required={required}
        tabIndex={-1}
        aria-hidden
        onChange={() => {}}
        onInvalid={(event) => {
          event.preventDefault()
          triggerRef.current?.focus()
          setOpen(true)
        }}
        className="sr-only"
      />
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? labelId : undefined}
        onClick={() => setOpen((current) => !current)}
          className={`inline-flex items-center text-left ${
          className ??
          'mt-1 h-10 w-full rounded-md border-2 border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500'
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? 'text-foreground' : 'text-slate-400'}`}>
          {selected ? formatDisplay(selected) : 'ДД.ММ.ГГГГ'}
        </span>
        <CalendarDays size={16} strokeWidth={2} className="ml-2 shrink-0 text-secondary" />
      </button>
      {open
        ? createPortal(
            <CalendarPopover
              id={labelId}
              popRef={popRef}
              anchor={triggerRef.current?.getBoundingClientRect() ?? null}
              view={view}
              selected={selected}
              required={required}
              onView={setView}
              onPick={pick}
              onClear={() => {
                commit('')
                setOpen(false)
              }}
            />,
            document.body,
          )
        : null}
    </>
  )
}

function CalendarPopover({
  id,
  popRef,
  anchor,
  view,
  selected,
  required,
  onView,
  onPick,
  onClear,
}: {
  id: string
  popRef: RefObject<HTMLDivElement | null>
  anchor: DOMRect | null
  view: { year: number; month: number }
  selected: string
  required?: boolean
  onView: (next: { year: number; month: number }) => void
  onPick: (iso: string) => void
  onClear: () => void
}) {
  const today = toIso(new Date())
  const days = monthCells(view.year, view.month)
  const pos = place(anchor)

  function shift(delta: number) {
    const date = new Date(view.year, view.month + delta, 1)
    onView({ year: date.getFullYear(), month: date.getMonth() })
  }

  function onGridKey(event: KeyboardEvent<HTMLDivElement>) {
    const current = document.activeElement
    if (!(current instanceof HTMLElement) || current.dataset.iso == null) return
    const iso = current.dataset.iso
    const date = parseIso(iso)
    if (!date) return
    let next: Date | null = null
    if (event.key === 'ArrowLeft') next = addDays(date, -1)
    if (event.key === 'ArrowRight') next = addDays(date, 1)
    if (event.key === 'ArrowUp') next = addDays(date, -7)
    if (event.key === 'ArrowDown') next = addDays(date, 7)
    if (!next) return
    event.preventDefault()
    onView({ year: next.getFullYear(), month: next.getMonth() })
    const isoNext = toIso(next)
    requestAnimationFrame(() => {
      popRef.current?.querySelector<HTMLElement>(`[data-iso="${isoNext}"]`)?.focus()
    })
  }

  return (
    <div
      ref={popRef}
      id={id}
      role="dialog"
      aria-label="Календарь"
      style={{ top: pos.top, left: pos.left }}
      className="glass-pop fixed z-[100] w-[292px] rounded-2xl p-3"
    >
      <div className="mb-3 flex items-center gap-1">
        <button
          type="button"
          aria-label="Предыдущий месяц"
          onClick={() => shift(-1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-secondary hover:bg-slate-100 hover:text-foreground"
        >
          <ChevronLeft size={18} strokeWidth={2} />
        </button>
        <p className="min-w-0 flex-1 text-center text-sm font-semibold tracking-[-0.02em] text-foreground">
          {monthTitle(view.year, view.month)}
        </p>
        <button
          type="button"
          aria-label="Следующий месяц"
          onClick={() => shift(1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-secondary hover:bg-slate-100 hover:text-foreground"
        >
          <ChevronRight size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((day) => (
          <span key={day} className="pb-1 text-[11px] font-medium text-secondary">
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5" onKeyDown={onGridKey}>
        {days.map((day, index) => {
          const iso = toIso(day)
          const inMonth = day.getMonth() === view.month
          if (!inMonth) return <span key={`${iso}-${index}`} className="h-9" />
          const isSelected = iso === selected
          const isToday = iso === today
          return (
            <button
              key={iso}
              type="button"
              data-iso={iso}
              onClick={() => onPick(iso)}
              className={`h-9 rounded-md text-sm tabular-nums transition-colors duration-150 ${
                isSelected
                  ? 'bg-primary font-semibold text-on-primary'
                  : isToday
                    ? 'border-2 border-slate-400 font-medium text-foreground hover:bg-slate-100'
                    : 'text-foreground hover:bg-slate-100'
              }`}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
        {required ? (
          <span />
        ) : (
          <button
            type="button"
            onClick={onClear}
            className="h-8 px-1 text-sm text-secondary hover:text-foreground"
          >
            Очистить
          </button>
        )}
        <button
          type="button"
          onClick={() => onPick(today)}
          className="h-8 px-1 text-sm font-medium text-foreground hover:text-secondary"
        >
          Сегодня
        </button>
      </div>
    </div>
  )
}

function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1)
  const weekday = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - weekday)
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

function monthFrom(iso: string) {
  const parsed = parseIso(iso)
  const base = parsed ?? new Date()
  return { year: base.getFullYear(), month: base.getMonth() }
}

function monthTitle(year: number, month: number) {
  const raw = new Date(year, month, 1).toLocaleDateString('ru-RU', { month: 'long' })
  return `${raw.charAt(0).toUpperCase()}${raw.slice(1)} ${year}`
}

function toIso(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function parseIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDisplay(iso: string) {
  const date = parseIso(iso)
  return date ? date.toLocaleDateString('ru-RU') : iso
}

function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
}

function place(anchor: DOMRect | null) {
  const width = 292
  const height = 360
  const gap = 6
  if (!anchor) return { top: 80, left: 24 }
  let top = anchor.bottom + gap
  let left = anchor.left
  if (top + height > window.innerHeight - 8) top = Math.max(8, anchor.top - height - gap)
  if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8)
  if (left < 8) left = 8
  return { top, left }
}
