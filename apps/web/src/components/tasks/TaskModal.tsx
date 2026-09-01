import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Paperclip, X } from 'lucide-react'
import type { TaskPerson } from '@/lib/task-columns'
import { TASK_FILE_ACCEPT } from '@/lib/tasks-api'
import { UserAvatar } from '@/components/UserAvatar'

export function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean | 'xl'
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-8">
      <button
        type="button"
        aria-label="Закрыть"
        className="glass-scrim absolute inset-0"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className={`glass-strong relative z-10 max-h-[90vh] w-full overflow-auto rounded-t-3xl p-6 sm:rounded-3xl ${
          wide === 'xl' ? 'max-w-3xl' : wide ? 'max-w-2xl' : 'max-w-lg'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="dialog-title" className="text-lg font-semibold tracking-[-0.03em] text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-1.5 -mt-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-secondary transition-colors duration-150 hover:bg-white/70 hover:text-foreground"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function AssigneePicker({
  people,
  selected,
  onChange,
}: {
  people: TaskPerson[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const chosenPeople = people.filter((person) => selected.includes(person.id))

  if (!people.length) {
    return <p className="text-sm text-secondary">Нет сотрудников</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-fit items-center rounded-md border-2 border-slate-300 px-3 text-sm text-foreground hover:bg-slate-50"
      >
        Выбрать ответственного
      </button>
      {chosenPeople.length ? (
        <ul className="flex flex-col gap-1.5">
          {chosenPeople.map((person) => (
            <li key={person.id} className="flex items-center gap-2 rounded-md border-2 border-slate-300 px-3 py-2">
              <UserAvatar
                id={person.id}
                name={person.name}
                hasAvatar={person.hasAvatar}
                version={person.avatarAt}
                size={24}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{person.name}</span>
              <button
                type="button"
                aria-label={`Убрать ${person.name}`}
                onClick={() => onChange(selected.filter((id) => id !== person.id))}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-slate-100"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-secondary">Не назначены</p>
      )}
      {open ? (
        <AssigneeDialog
          people={people}
          selected={selected}
          onClose={() => setOpen(false)}
          onSave={(ids) => {
            onChange(ids)
            setOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

function AssigneeDialog({
  people,
  selected,
  onClose,
  onSave,
}: {
  people: TaskPerson[]
  selected: string[]
  onClose: () => void
  onSave: (ids: string[]) => void
}) {
  const [draft, setDraft] = useState<string[]>(selected)
  const [query, setQuery] = useState('')
  const chosen = new Set(draft)
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return people
    return people.filter((person) => person.name.toLowerCase().includes(needle))
  }, [people, query])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  function toggle(id: string) {
    setDraft((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Закрыть" className="glass-scrim absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignee-dialog-title"
        className="glass-strong relative z-10 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl p-6 sm:rounded-3xl"
      >
        <h2 id="assignee-dialog-title" className="text-lg font-semibold tracking-[-0.03em] text-foreground">
          Ответственные
        </h2>
        <p className="mt-1 text-sm text-secondary">Можно выбрать одного или нескольких</p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Найти"
          className="mt-4 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm outline-none focus:border-foreground"
        />
        <div className="mt-3 max-h-80 overflow-auto rounded-md border-2 border-slate-300 p-1">
          {filtered.length ? (
            <ul>
              {filtered.map((person) => (
                <li key={person.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={chosen.has(person.id)}
                      onChange={() => toggle(person.id)}
                      className="h-4 w-4 accent-foreground"
                    />
                    <UserAvatar
                      id={person.id}
                      name={person.name}
                      hasAvatar={person.hasAvatar}
                      version={person.avatarAt}
                      size={28}
                    />
                    {person.name}
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 py-6 text-center text-sm text-secondary">Никого не нашли</p>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-secondary">
            {draft.length ? `Выбрано: ${draft.length}` : 'Никто не выбран'}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-3 text-sm text-secondary transition-colors duration-200 hover:text-foreground"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => onSave(draft)}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:opacity-90"
            >
              Готово
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function PendingFiles({
  files,
  onRemove,
}: {
  files: File[]
  onRemove: (index: number) => void
}) {
  if (!files.length) return null
  return (
    <ul className="flex flex-col gap-1.5">
      {files.map((file, index) => (
        <li
          key={`${file.name}-${file.size}-${index}`}
          className="flex items-center gap-2 rounded-md border-2 border-slate-300 px-3 py-2"
        >
          <Paperclip size={14} strokeWidth={2} className="shrink-0 text-secondary" />
          <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
          <button
            type="button"
            aria-label="Убрать файл"
            onClick={() => onRemove(index)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-slate-100"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </li>
      ))}
    </ul>
  )
}

export function CreateTaskForm({
  people,
  shared,
  onSubmit,
  onCancel,
  busy,
}: {
  people: TaskPerson[]
  shared?: boolean
  onSubmit: (input: { title: string; description: string; assigneeIds: string[]; files: File[] }) => void
  onCancel: () => void
  busy: boolean
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const title = String(data.get('title') ?? '').trim()
    if (!title) return
    onSubmit({
      title,
      description: String(data.get('description') ?? '').trim(),
      assigneeIds: shared ? assigneeIds : [],
      files,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-secondary">
        Название
        <input
          name="title"
          required
          autoFocus
          maxLength={200}
          className="h-11 rounded-lg border-2 border-slate-300 bg-white px-3 text-[15px] font-normal text-foreground outline-none focus:border-foreground"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-secondary">
        Описание
        <textarea
          name="description"
          rows={4}
          maxLength={4000}
          className="resize-none rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-[15px] font-normal text-foreground outline-none focus:border-foreground"
        />
      </label>
      {shared ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-[13px] font-medium text-secondary">Ответственные</legend>
          <AssigneePicker people={people} selected={assigneeIds} onChange={setAssigneeIds} />
        </fieldset>
      ) : null}
      <div className="flex flex-col gap-2">
        <PendingFiles files={files} onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))} />
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          accept={TASK_FILE_ACCEPT}
          onChange={(event) => {
            const list = event.target.files ? Array.from(event.target.files) : []
            if (list.length) setFiles((current) => [...current, ...list].slice(0, 10))
            event.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={files.length >= 10}
          className="inline-flex h-10 w-fit items-center gap-2 rounded-md border-2 border-slate-300 px-3 text-sm text-foreground hover:bg-slate-50 disabled:opacity-60"
        >
          <Paperclip size={16} strokeWidth={1.75} />
          Приложить файл
        </button>
      </div>
      <div className="mt-2 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 px-3 text-sm text-secondary transition-colors duration-200 hover:text-foreground"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={busy}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
        >
          Создать
        </button>
      </div>
    </form>
  )
}
