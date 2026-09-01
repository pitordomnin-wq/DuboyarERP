import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Paperclip, X } from 'lucide-react'
import { STATUS_LABEL, nextStatus, type Task, type TaskFile } from '@/lib/task-columns'
import {
  TASK_FILE_ACCEPT,
  addTaskComment,
  deleteTaskFile,
  fileErrorMessage,
  taskFileUrl,
} from '@/lib/tasks-api'
import { PendingFiles } from '@/components/tasks/TaskModal'
import { UserAvatar } from '@/components/UserAvatar'

export function TaskDetail({
  task,
  userId,
  onChange,
  onClose,
  onAdvance,
  onDelete,
}: {
  task: Task
  userId: string
  onChange: (task: Task) => void
  onClose: () => void
  onAdvance: () => void
  onDelete: () => void
}) {
  const next = nextStatus(task.board, task.status)
  const files = task.files ?? []
  const comments = task.comments ?? []
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [comment, setComment] = useState('')
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const commentFileInput = useRef<HTMLInputElement>(null)

  async function removeFile(file: TaskFile) {
    setBusy(true)
    setError('')
    try {
      onChange(await deleteTaskFile(task.id, file.id))
    } catch (err) {
      setError(fileErrorMessage(err instanceof Error ? err.message : ''))
    } finally {
      setBusy(false)
    }
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault()
    if (!comment.trim() && !commentFiles.length) return
    setBusy(true)
    setError('')
    try {
      onChange(await addTaskComment(task.id, comment.trim(), commentFiles))
      setComment('')
      setCommentFiles([])
    } catch (err) {
      setError(fileErrorMessage(err instanceof Error ? err.message : ''))
    } finally {
      setBusy(false)
    }
  }

  function canRemoveFile(file: TaskFile) {
    if (!file.commentId) return false
    const owner = comments.find((item) => item.id === file.commentId)
    return owner?.author.id === userId
  }

  return (
    <>
      <p className="mt-2 text-sm text-secondary">{STATUS_LABEL[task.status]}</p>
      {task.description ? (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">{task.description}</p>
      ) : (
        <p className="mt-4 text-sm text-secondary">Без описания</p>
      )}

      {task.board === 'ORGANIZATION' ? (
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Автор</dt>
            <dd className="mt-1.5 flex items-center gap-2 text-sm text-foreground">
              <UserAvatar
                id={task.createdBy.id}
                name={task.createdBy.name}
                hasAvatar={task.createdBy.hasAvatar}
                version={task.createdBy.avatarAt}
                size={28}
              />
              {task.createdBy.name}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Ответственные</dt>
            <dd className="mt-1.5">
              {(task.assignees ?? []).length ? (
                <ul className="flex flex-col gap-1.5">
                  {(task.assignees ?? []).map((person) => (
                    <li key={person.id} className="flex items-center gap-2 text-sm text-foreground">
                      <UserAvatar
                        id={person.id}
                        name={person.name}
                        hasAvatar={person.hasAvatar}
                        version={person.avatarAt}
                        size={28}
                      />
                      {person.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-secondary">Не назначены</p>
              )}
            </dd>
          </div>
        </dl>
      ) : null}

      <section className="mt-5">
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Файлы</h3>
        <FileList taskId={task.id} items={files} onRemove={canRemoveFile} busy={busy} onDelete={(file) => void removeFile(file)} />
      </section>

      <section className="mt-6">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Комментарии</h3>
        <div className="mt-2 max-h-56 space-y-3 overflow-auto rounded-md border-2 border-slate-300 p-3">
          {comments.length === 0 ? (
            <p className="text-sm text-secondary">Пока нет комментариев</p>
          ) : (
            comments.map((item) => (
              <article key={item.id} className="text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                    <UserAvatar
                      id={item.author.id}
                      name={item.author.name}
                      hasAvatar={item.author.hasAvatar}
                      version={item.author.avatarAt}
                      size={24}
                    />
                    <span className="truncate">{item.author.name}</span>
                  </p>
                  <time className="shrink-0 text-[11px] text-secondary" dateTime={item.createdAt}>
                    {formatWhen(item.createdAt)}
                  </time>
                </div>
                {item.body ? (
                  <p className="mt-1 whitespace-pre-wrap text-foreground">{item.body}</p>
                ) : null}
                {item.files.length ? (
                  <FileList
                    taskId={task.id}
                    items={item.files}
                    onRemove={canRemoveFile}
                    busy={busy}
                    onDelete={(file) => void removeFile(file)}
                    className="mt-2"
                  />
                ) : null}
              </article>
            ))
          )}
        </div>
        <form onSubmit={(event) => void submitComment(event)} className="mt-3 flex flex-col gap-2">
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Написать комментарий"
            className="resize-none rounded-lg border-2 border-slate-300 px-3 py-2 text-sm outline-none focus:border-foreground"
          />
          <PendingFiles
            files={commentFiles}
            onRemove={(index) => setCommentFiles((current) => current.filter((_, i) => i !== index))}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={commentFileInput}
              type="file"
              multiple
              className="hidden"
              accept={TASK_FILE_ACCEPT}
              onChange={(event) => {
                const list = event.target.files ? Array.from(event.target.files) : []
                if (list.length) setCommentFiles((current) => [...current, ...list].slice(0, 10))
                event.target.value = ''
              }}
            />
            <button
              type="button"
              disabled={busy || commentFiles.length >= 10}
              onClick={() => commentFileInput.current?.click()}
              className="inline-flex h-10 items-center gap-2 rounded-md border-2 border-slate-300 px-3 text-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <Paperclip size={16} strokeWidth={1.75} />
              Файл
            </button>
            <button
              type="submit"
              disabled={busy || (!comment.trim() && !commentFiles.length)}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:opacity-90 disabled:opacity-60"
            >
              Отправить
            </button>
          </div>
        </form>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        {task.canDelete ? (
          confirming ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-foreground">Удалить задачу?</span>
              <button
                type="button"
                onClick={onDelete}
                className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary"
              >
                Да
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-10 rounded-md border-2 border-slate-300 px-4 text-sm"
              >
                Нет
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-sm text-secondary transition-colors duration-200 hover:text-destructive"
            >
              Удалить
            </button>
          )
        ) : (
          <span />
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-3 text-sm text-secondary transition-colors duration-200 hover:text-foreground"
          >
            Закрыть
          </button>
          {next ? (
            <button
              type="button"
              onClick={onAdvance}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary transition-opacity duration-200 hover:opacity-90"
            >
              {STATUS_LABEL[next]}
            </button>
          ) : null}
        </div>
      </div>
    </>
  )
}

function FileList({
  taskId,
  items,
  onRemove,
  onDelete,
  busy,
  className,
}: {
  taskId: string
  items: TaskFile[]
  onRemove: (file: TaskFile) => boolean
  onDelete: (file: TaskFile) => void
  busy: boolean
  className?: string
}) {
  const [preview, setPreview] = useState<TaskFile | null>(null)
  if (!items.length) {
    return <p className={`text-sm text-secondary ${className ?? ''}`}>Нет файлов</p>
  }

  return (
    <div className={className}>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 rounded-md border-2 border-slate-300 bg-white px-3 py-2">
            <button
              type="button"
              onClick={() => setPreview(item)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <FileThumb url={taskFileUrl(taskId, item.id)} mime={item.mimeType} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{item.name}</span>
                <span className="block text-xs text-secondary">{formatBytes(item.size)}</span>
              </span>
            </button>
            {onRemove(item) ? (
              <button
                type="button"
                aria-label="Удалить файл"
                disabled={busy}
                onClick={() => onDelete(item)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-slate-100 disabled:opacity-60"
              >
                <X size={16} strokeWidth={2} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {preview ? (
        <FilePreview
          name={preview.name}
          mimeType={preview.mimeType}
          url={taskFileUrl(taskId, preview.id)}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  )
}

function FileThumb({ url, mime }: { url: string; mime: string }) {
  if (mime.startsWith('image/')) {
    return <img src={url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
  }
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-100 text-secondary">
      <Paperclip size={16} strokeWidth={2} />
    </span>
  )
}

function FilePreview({
  name,
  mimeType,
  url,
  onClose,
}: {
  name: string
  mimeType: string
  url: string
  onClose: () => void
}) {
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

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" aria-label="Закрыть" className="glass-scrim absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-file-preview-title"
        className="glass-strong relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 id="task-file-preview-title" className="truncate text-sm font-semibold text-foreground">
            {name}
          </h2>
          <div className="flex shrink-0 items-center gap-3">
            <a href={url} download={name} className="text-sm text-secondary hover:text-foreground">
              Скачать
            </a>
            <button type="button" className="text-sm text-secondary" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-4">
          {mimeType.startsWith('image/') ? (
            <img src={url} alt={name} className="mx-auto max-h-[75vh] max-w-full object-contain" />
          ) : mimeType === 'application/pdf' ? (
            <iframe title={name} src={url} className="h-[75vh] w-full rounded-md border-2 border-slate-300 bg-white" />
          ) : (
            <p className="px-2 py-10 text-center text-sm text-secondary">Предпросмотр недоступен — скачайте файл</p>
          )}
        </div>
      </div>
    </div>
  )
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} Б`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} КБ`
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
