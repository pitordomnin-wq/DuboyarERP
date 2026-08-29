import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BookUser, Paperclip, PenLine, X } from 'lucide-react'
import { Modal } from '@/components/tasks/TaskModal'
import {
  MAIL_FOLDER_LABEL,
  MAIL_FOLDERS,
  attachmentFileUrl,
  composeMail,
  deleteAttachment,
  deleteMail,
  fetchAddressBook,
  fetchMail,
  fetchMailCounts,
  fetchMailMessage,
  sendDraft,
  updateMail,
  uploadAttachments,
  type AddressBook,
  type MailAttachment,
  type MailCounts,
  type MailFolder,
  type MailMessage,
} from '@/lib/mail-api'

type MailView = MailFolder | 'BOOK'

export function MailPage() {
  const [view, setView] = useState<MailView>('INBOX')
  const [items, setItems] = useState<MailMessage[]>([])
  const [counts, setCounts] = useState<MailCounts | null>(null)
  const [opened, setOpened] = useState<MailMessage | null>(null)
  const [compose, setCompose] = useState<Partial<MailMessage> | 'new' | null>(null)
  const [loading, setLoading] = useState(true)
  const folder = view === 'BOOK' ? 'INBOX' : view

  async function reload(nextFolder = folder) {
    const [list, nextCounts] = await Promise.all([fetchMail(nextFolder), fetchMailCounts()])
    setItems(list)
    setCounts(nextCounts)
  }

  useEffect(() => {
    if (view === 'BOOK') return
    setLoading(true)
    void reload(view).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  async function open(id: string) {
    const item = await fetchMailMessage(id)
    setOpened(item)
    setItems((current) => current.map((row) => (row.id === item.id ? item : row)))
    setCounts(await fetchMailCounts())
  }

  async function move(id: string, next: MailFolder) {
    await updateMail(id, { folder: next })
    setOpened(null)
    await reload()
  }

  function composeTo(name: string, email: string) {
    setCompose({ toName: name, toAddress: email })
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="shrink-0 border-b-2 border-slate-300 md:w-56 md:border-r-2 md:border-b-0">
        <div className="px-4 py-3 md:px-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Папки</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-2">
          {MAIL_FOLDERS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setView(item)
                setOpened(null)
              }}
              className={`min-w-[140px] shrink-0 rounded-md px-3 py-2 text-left md:min-w-0 ${
                item === view ? 'bg-slate-200 text-foreground' : 'text-secondary hover:bg-slate-100'
              }`}
            >
              <span className="text-sm font-medium">{MAIL_FOLDER_LABEL[item]}</span>
              {counts ? (
                <span className="ml-2 text-xs tabular-nums text-secondary">
                  {item === 'INBOX' && counts.unread ? counts.unread : counts[item] || ''}
                </span>
              ) : null}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setView('BOOK')
              setOpened(null)
            }}
            className={`min-w-[140px] shrink-0 rounded-md px-3 py-2 text-left md:min-w-0 ${
              view === 'BOOK' ? 'bg-slate-200 text-foreground' : 'text-secondary hover:bg-slate-100'
            }`}
          >
            <span className="text-sm font-medium">Адресная книга</span>
          </button>
        </nav>
      </aside>

      {view === 'BOOK' ? (
        <AddressBookPage onCompose={composeTo} />
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1">
          <section className={`flex min-w-0 flex-col border-slate-300 md:w-[360px] md:shrink-0 md:border-r-2 ${opened ? 'hidden md:flex' : 'w-full'}`}>
            <header className="flex h-12 shrink-0 items-center border-b-2 border-slate-300 px-4">
              <h1 className="text-sm font-semibold text-foreground">{MAIL_FOLDER_LABEL[folder]}</h1>
            </header>
            <div className="min-h-0 flex-1 overflow-auto">
              {loading ? (
                <p className="px-4 py-6 text-sm text-secondary">Загрузка</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-6 text-sm text-secondary">Писем нет</p>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void open(item.id)}
                    className={`block w-full border-b border-slate-200 px-4 py-3 text-left ${
                      opened?.id === item.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <p className={`truncate text-sm ${item.readAt ? 'font-medium text-foreground' : 'font-semibold text-foreground'}`}>
                      {peer(item, folder)}
                    </p>
                    <p className="truncate text-sm text-foreground">{item.subject || '(без темы)'}</p>
                    <p className="mt-0.5 truncate text-xs text-secondary">
                      {item.attachments?.length ? (
                        <span className="mr-1.5 inline-flex items-center gap-0.5 text-foreground">
                          <Paperclip size={12} strokeWidth={2} />
                          {item.attachments.length}
                        </span>
                      ) : null}
                      {preview(item.body) || (item.attachments?.length ? 'Вложение' : '')}
                    </p>
                    <p className="mt-1 text-xs text-secondary">{formatDate(item.createdAt)}</p>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className={`min-h-0 min-w-0 flex-1 flex-col ${opened ? 'flex' : 'hidden md:flex'}`}>
            {opened ? (
              <MessageView
                item={opened}
                onReply={() => setCompose(opened)}
                onMove={(next) => void move(opened.id, next)}
                onClose={() => setOpened(null)}
                onDelete={async () => {
                  await deleteMail(opened.id)
                  setOpened(null)
                  await reload()
                }}
                onSendDraft={async () => {
                  await sendDraft(opened.id)
                  setView('SENT')
                  setOpened(null)
                  await reload('SENT')
                }}
              />
            ) : (
              <p className="px-6 py-10 text-sm text-secondary">Выберите письмо</p>
            )}
          </section>
        </div>
      )}

      {compose ? null : (
        <button
          type="button"
          onClick={() => setCompose('new')}
          className="fixed right-5 bottom-5 z-30 flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary"
        >
          <PenLine size={18} strokeWidth={2} />
          Написать
        </button>
      )}

      {compose ? (
        <ComposeModal
          initial={compose === 'new' ? null : compose}
          onClose={async () => {
            setCompose(null)
            await reload()
          }}
          onDone={async (nextFolder) => {
            setCompose(null)
            if (nextFolder) setView(nextFolder)
            await reload(nextFolder ?? folder)
          }}
        />
      ) : null}
    </div>
  )
}

function AddressBookPage({ onCompose }: { onCompose: (name: string, email: string) => void }) {
  const [book, setBook] = useState<AddressBook | null>(null)
  const [tab, setTab] = useState<'employees' | 'counterparties'>('employees')
  const [query, setQuery] = useState('')

  useEffect(() => {
    void fetchAddressBook().then(setBook)
  }, [])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b-2 border-slate-300 px-4">
        <h1 className="text-sm font-semibold text-foreground">Адресная книга</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 md:px-8">
        <AddressBookList book={book} tab={tab} query={query} onTab={setTab} onQuery={setQuery} onPick={onCompose} />
      </div>
    </div>
  )
}

function AddressBookList({
  book,
  tab,
  query,
  onTab,
  onQuery,
  onPick,
}: {
  book: AddressBook | null
  tab: 'employees' | 'counterparties'
  query: string
  onTab: (tab: 'employees' | 'counterparties') => void
  onQuery: (query: string) => void
  onPick: (name: string, email: string) => void
}) {
  const q = query.trim().toLowerCase()
  const rows =
    tab === 'employees'
      ? (book?.employees ?? []).filter(
          (item) => item.name.toLowerCase().includes(q) || item.email.toLowerCase().includes(q),
        )
      : (book?.counterparties ?? []).filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            item.email.toLowerCase().includes(q) ||
            (item.contactName ?? '').toLowerCase().includes(q),
        )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex rounded-md border-2 border-slate-300">
        <button
          type="button"
          onClick={() => onTab('employees')}
          className={`flex-1 px-3 py-2 text-sm ${tab === 'employees' ? 'bg-slate-100 font-medium text-foreground' : 'text-secondary'}`}
        >
          Сотрудники
        </button>
        <button
          type="button"
          onClick={() => onTab('counterparties')}
          className={`flex-1 px-3 py-2 text-sm ${tab === 'counterparties' ? 'bg-slate-100 font-medium text-foreground' : 'text-secondary'}`}
        >
          Контрагенты
        </button>
      </div>
      <input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Поиск по имени или почте"
        className="h-10 rounded-md border-2 border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
      />
      <div className="overflow-auto rounded-md border-2 border-slate-300 bg-white">
        {!book ? (
          <p className="px-3 py-6 text-sm text-secondary">Загрузка</p>
        ) : rows.length === 0 ? (
          <p className="px-3 py-6 text-sm text-secondary">Никого нет</p>
        ) : (
          rows.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onPick(entry.name, entry.email)}
              className="block w-full border-b border-slate-200 px-3 py-2.5 text-left last:border-b-0 hover:bg-slate-50"
            >
              <p className="text-sm font-medium text-foreground">{entry.name}</p>
              <p className="text-xs text-secondary">{entry.email}</p>
              {'contactName' in entry && entry.contactName ? (
                <p className="text-xs text-secondary">{entry.contactName}</p>
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function MessageView({
  item,
  onReply,
  onMove,
  onDelete,
  onSendDraft,
  onClose,
}: {
  item: MailMessage
  onReply: () => void
  onMove: (folder: MailFolder) => void
  onDelete: () => void
  onSendDraft: () => void
  onClose?: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b-2 border-slate-300 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">{item.subject || '(без темы)'}</h2>
          {onClose ? (
            <button type="button" className="text-sm text-secondary" onClick={onClose}>
              Закрыть
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-secondary">
          От: {item.fromName} &lt;{item.fromAddress}&gt;
        </p>
        <p className="text-sm text-secondary">
          Кому: {item.toName} &lt;{item.toAddress}&gt;
        </p>
        <p className="mt-1 text-xs text-secondary">{formatDate(item.createdAt)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {item.folder === 'DRAFTS' ? (
            <>
              <button type="button" onClick={onReply} className="h-9 rounded-md bg-primary px-3 text-sm font-semibold text-on-primary">
                Продолжить
              </button>
              <button type="button" onClick={onSendDraft} className="h-9 rounded-md border-2 border-slate-300 px-3 text-sm">
                Отправить
              </button>
              <button type="button" onClick={onDelete} className="h-9 rounded-md border-2 border-slate-300 px-3 text-sm">
                Удалить
              </button>
            </>
          ) : (
            <>
              {item.folder !== 'SENT' ? (
                <button type="button" onClick={onReply} className="h-9 rounded-md bg-primary px-3 text-sm font-semibold text-on-primary">
                  Ответить
                </button>
              ) : null}
              {item.folder !== 'ARCHIVE' ? (
                <button type="button" onClick={() => onMove('ARCHIVE')} className="h-9 rounded-md border-2 border-slate-300 px-3 text-sm">
                  В архив
                </button>
              ) : (
                <button type="button" onClick={() => onMove('INBOX')} className="h-9 rounded-md border-2 border-slate-300 px-3 text-sm">
                  Во входящие
                </button>
              )}
              {item.folder !== 'SPAM' ? (
                <button type="button" onClick={() => onMove('SPAM')} className="h-9 rounded-md border-2 border-slate-300 px-3 text-sm">
                  Спам
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => onMove('INBOX')} className="h-9 rounded-md border-2 border-slate-300 px-3 text-sm">
                    Не спам
                  </button>
                  <button type="button" onClick={onDelete} className="h-9 rounded-md border-2 border-slate-300 px-3 text-sm">
                    Удалить
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{item.body}</p>
        <AttachmentList
          messageId={item.id}
          items={item.attachments ?? []}
          className="mt-6"
        />
      </div>
    </div>
  )
}

function ComposeModal({
  initial,
  onClose,
  onDone,
}: {
  initial: Partial<MailMessage> | null
  onClose: () => void
  onDone: (folder?: MailFolder) => Promise<void>
}) {
  const reply = Boolean(initial?.id && initial.folder && initial.folder !== 'DRAFTS')
  const fileInput = useRef<HTMLInputElement>(null)
  const [book, setBook] = useState<AddressBook | null>(null)
  const [bookOpen, setBookOpen] = useState(false)
  const [tab, setTab] = useState<'employees' | 'counterparties'>('employees')
  const [query, setQuery] = useState('')
  const [draftId, setDraftId] = useState(initial?.folder === 'DRAFTS' ? initial.id : undefined)
  const [attachments, setAttachments] = useState<MailAttachment[]>(
    initial?.folder === 'DRAFTS' ? (initial.attachments ?? []) : [],
  )
  const [toAddress, setToAddress] = useState(reply ? initial?.fromAddress ?? '' : initial?.toAddress ?? '')
  const [toName, setToName] = useState(reply ? initial?.fromName ?? '' : initial?.toName ?? '')
  const [subject, setSubject] = useState(
    reply ? replySubject(initial?.subject ?? '') : initial?.subject ?? '',
  )
  const [body, setBody] = useState(reply ? quote(initial) : initial?.body ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchAddressBook().then(setBook)
  }, [])

  async function ensureDraft() {
    const payload = { toAddress, toName, subject, body, draft: true as const }
    if (draftId) {
      const saved = await updateMail(draftId, payload)
      return saved.id
    }
    const saved = await composeMail(payload)
    setDraftId(saved.id)
    setAttachments(saved.attachments ?? [])
    return saved.id
  }

  async function attach(files: FileList | File[]) {
    const list = Array.from(files)
    if (!list.length) return
    setBusy(true)
    setError(null)
    try {
      if (attachments.length + list.length > 10) {
        setError('Можно прикрепить не больше 10 файлов')
        return
      }
      const tooBig = list.find((file) => file.size > 10 * 1024 * 1024)
      if (tooBig) {
        setError('Файл больше 10 МБ')
        return
      }
      const id = await ensureDraft()
      const saved = await uploadAttachments(id, list)
      setDraftId(saved.id)
      setAttachments(saved.attachments ?? [])
    } catch (err) {
      setError(attachError(err))
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function removeFile(attachmentId: string) {
    if (!draftId) return
    setBusy(true)
    setError(null)
    try {
      const saved = await deleteAttachment(draftId, attachmentId)
      setAttachments(saved.attachments ?? [])
    } catch {
      setError('Не удалось удалить вложение')
    } finally {
      setBusy(false)
    }
  }

  async function save(draft: boolean) {
    setBusy(true)
    setError(null)
    try {
      if (!draft && (!toAddress.trim() || (!body.trim() && attachments.length === 0))) {
        setError('Укажите адрес и текст письма или вложение')
        return
      }
      const payload = { toAddress, toName, subject, body, draft }
      if (draftId) {
        await updateMail(draftId, payload)
        if (draft) {
          await onDone('DRAFTS')
        } else {
          await sendDraft(draftId)
          await onDone('SENT')
        }
      } else if (initial?.id && initial.folder === 'DRAFTS' && draft) {
        await updateMail(initial.id, payload)
        await onDone('DRAFTS')
      } else if (initial?.id && initial.folder === 'DRAFTS' && !draft) {
        await updateMail(initial.id, payload)
        await sendDraft(initial.id)
        await onDone('SENT')
      } else {
        await composeMail(payload)
        await onDone(draft ? 'DRAFTS' : 'SENT')
      }
    } catch {
      setError('Не удалось отправить письмо')
    } finally {
      setBusy(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void save(false)
  }

  return (
    <>
    <Modal title={reply ? 'Ответ' : 'Новое письмо'} onClose={onClose} wide>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <label className="text-sm text-secondary">
          Кому
          <span className="mt-1 flex gap-2">
            <input
              type="email"
              value={toAddress}
              onChange={(event) => {
                setToAddress(event.target.value)
                setToName('')
              }}
              placeholder="name@example.com"
              className="h-10 min-w-0 flex-1 rounded-md border-2 border-slate-300 px-3 text-sm text-foreground"
            />
            <button
              type="button"
              aria-label="Адресная книга"
              onClick={() => setBookOpen(true)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border-2 border-slate-300 text-foreground hover:bg-slate-50"
            >
              <BookUser size={18} strokeWidth={1.75} />
            </button>
          </span>
          {toName ? <span className="mt-1 block text-xs text-secondary">{toName}</span> : null}
        </label>
        <label className="text-sm text-secondary">
          Тема
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm text-foreground"
          />
        </label>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={10}
          className="rounded-md border-2 border-slate-300 px-3 py-2 text-sm text-foreground"
        />
        <AttachmentList
          messageId={draftId}
          items={attachments}
          onRemove={removeFile}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex items-center justify-between gap-2">
          <div>
            <input
              ref={fileInput}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.zip,.doc,.docx,.xls,.xlsx,application/pdf,image/jpeg,image/png,image/gif,image/webp,text/plain,text/csv,application/zip"
              onChange={(event) => {
                if (event.target.files) void attach(event.target.files)
              }}
            />
            <button
              type="button"
              disabled={busy || attachments.length >= 10}
              onClick={() => fileInput.current?.click()}
              className="inline-flex h-10 items-center gap-2 rounded-md border-2 border-slate-300 px-3 text-sm"
            >
              <Paperclip size={16} strokeWidth={2} />
              Вложить
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(true)}
              className="h-10 rounded-md border-2 border-slate-300 px-4 text-sm"
            >
              Черновик
            </button>
            <button type="submit" disabled={busy} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary">
              Отправить
            </button>
          </div>
        </div>
      </form>
    </Modal>
      {bookOpen ? (
        <AddressBookPopup
          book={book}
          tab={tab}
          query={query}
          onTab={setTab}
          onQuery={setQuery}
          onClose={() => setBookOpen(false)}
          onPick={(name, email) => {
            setToName(name)
            setToAddress(email)
            setBookOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

function AddressBookPopup({
  book,
  tab,
  query,
  onTab,
  onQuery,
  onClose,
  onPick,
}: {
  book: AddressBook | null
  tab: 'employees' | 'counterparties'
  query: string
  onTab: (tab: 'employees' | 'counterparties') => void
  onQuery: (query: string) => void
  onClose: () => void
  onPick: (name: string, email: string) => void
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
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Закрыть" className="absolute inset-0 bg-foreground/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="address-book-title"
        className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="address-book-title" className="text-lg font-semibold tracking-[-0.03em] text-foreground">
            Адресная книга
          </h2>
          <button type="button" className="text-sm text-secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
        <AddressBookList book={book} tab={tab} query={query} onTab={onTab} onQuery={onQuery} onPick={onPick} />
      </div>
    </div>
  )
}

function attachError(err: unknown) {
  const code = err instanceof Error ? err.message : ''
  if (code === 'file_too_large') return 'Файл больше 10 МБ'
  if (code === 'file_type') return 'Этот тип файла нельзя прикрепить'
  if (code === 'too_many_files') return 'Можно прикрепить не больше 10 файлов'
  return 'Не удалось прикрепить файл'
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} Б`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} КБ`
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`
}

function isPreviewable(mime: string) {
  return mime.startsWith('image/') || mime === 'application/pdf'
}

function AttachmentList({
  messageId,
  items,
  onRemove,
  className,
}: {
  messageId?: string
  items: MailAttachment[]
  onRemove?: (id: string) => void
  className?: string
}) {
  const [preview, setPreview] = useState<MailAttachment | null>(null)
  if (!items.length) return null
  const url = (item: MailAttachment) => (messageId ? attachmentFileUrl(messageId, item.id) : '')

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">Вложения</p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 rounded-md border-2 border-slate-300 bg-white px-3 py-2">
            <button
              type="button"
              onClick={() => (messageId ? setPreview(item) : undefined)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <AttachmentThumb url={url(item)} mime={item.mimeType} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{item.name}</span>
                <span className="block text-xs text-secondary">{formatBytes(item.size)}</span>
              </span>
            </button>
            {onRemove ? (
              <button
                type="button"
                aria-label="Удалить вложение"
                onClick={() => onRemove(item.id)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-slate-100"
              >
                <X size={16} strokeWidth={2} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {preview && messageId ? (
        <AttachmentPreview
          name={preview.name}
          mimeType={preview.mimeType}
          url={url(preview)}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  )
}

function AttachmentThumb({ url, mime }: { url: string; mime: string }) {
  if (url && mime.startsWith('image/')) {
    return <img src={url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
  }
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-100 text-secondary">
      <Paperclip size={16} strokeWidth={2} />
    </span>
  )
}

function AttachmentPreview({
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
      <button type="button" aria-label="Закрыть" className="absolute inset-0 bg-foreground/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="attachment-preview-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white"
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-slate-300 px-5 py-3">
          <h2 id="attachment-preview-title" className="truncate text-sm font-semibold text-foreground">
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
            <p className="px-2 py-10 text-center text-sm text-secondary">
              {isPreviewable(mimeType) ? 'Не удалось показать файл' : 'Предпросмотр недоступен — скачайте файл'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function peer(item: MailMessage, folder: MailFolder) {
  if (folder === 'SENT' || folder === 'DRAFTS') return item.toName || item.toAddress
  return item.fromName || item.fromAddress
}

function preview(body: string) {
  return body.replace(/\s+/g, ' ').trim().slice(0, 80)
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

function replySubject(subject: string) {
  return subject.startsWith('Re:') ? subject : `Re: ${subject}`
}

function quote(item: Partial<MailMessage>) {
  const who = item.fromName || item.fromAddress || ''
  const quoted = (item.body ?? '').split('\n').map((line) => `> ${line}`).join('\n')
  return `\n\n${who} писал(а):\n${quoted}`
}
