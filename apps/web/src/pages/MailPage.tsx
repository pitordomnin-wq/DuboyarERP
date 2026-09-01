import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  Archive,
  BookUser,
  FilePenLine,
  Inbox,
  Mail,
  MailWarning,
  Paperclip,
  PenLine,
  Send,
  X,
  type LucideIcon,
} from 'lucide-react'
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

const GHOST =
  'inline-flex h-9 items-center justify-center rounded-xl border border-line bg-white/45 px-3 text-sm text-foreground hover:bg-white/70 disabled:opacity-60'

const FOLDER_ICON: Record<MailFolder, LucideIcon> = {
  INBOX: Inbox,
  SENT: Send,
  DRAFTS: FilePenLine,
  SPAM: MailWarning,
  ARCHIVE: Archive,
}

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
    <div className="relative flex min-h-0 flex-1 flex-col p-3 md:p-4">
      <div className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl md:flex-row">
        <aside className="flex shrink-0 flex-col border-b border-line md:w-[220px] md:border-r md:border-b-0">
          <nav className="flex gap-1 overflow-x-auto px-3 py-3 md:flex-col md:px-2">
            {MAIL_FOLDERS.map((item) => {
              const Icon = FOLDER_ICON[item]
              const count = counts
                ? item === 'INBOX' && counts.unread
                  ? counts.unread
                  : counts[item]
                : 0
              const unread = item === 'INBOX' && Boolean(counts?.unread)
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setView(item)
                    setOpened(null)
                  }}
                  className={`side-item min-w-[150px] shrink-0 items-center md:min-w-0 ${item === view ? 'side-item-active' : ''}`}
                >
                  <Icon size={16} strokeWidth={1.75} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm">{MAIL_FOLDER_LABEL[item]}</span>
                  {count ? (
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                        unread ? 'bg-accent/15 font-semibold text-accent' : 'text-secondary'
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => {
                setView('BOOK')
                setOpened(null)
              }}
              className={`side-item min-w-[150px] shrink-0 items-center md:min-w-0 ${view === 'BOOK' ? 'side-item-active' : ''}`}
            >
              <BookUser size={16} strokeWidth={1.75} className="shrink-0" />
              <span className="text-sm">Адресная книга</span>
            </button>
          </nav>
        </aside>

        {view === 'BOOK' ? (
          <AddressBookPage onCompose={composeTo} />
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1">
            <section
              className={`flex min-w-0 flex-col md:w-[340px] md:shrink-0 md:border-r md:border-line ${
                opened ? 'hidden md:flex' : 'w-full'
              }`}
            >
              <header className="flex h-12 shrink-0 items-center border-b border-line px-4">
                <h1 className="text-sm font-semibold tracking-[-0.02em] text-foreground">
                  {MAIL_FOLDER_LABEL[folder]}
                </h1>
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
                      className={`relative flex w-full gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 ${
                        opened?.id === item.id
                          ? 'bg-slate-200 text-foreground'
                          : 'text-foreground hover:bg-slate-100'
                      }`}
                    >
                      {opened?.id === item.id ? (
                        <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" />
                      ) : null}
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.readAt ? 'bg-transparent' : 'bg-accent'}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span
                            className={`truncate text-sm ${item.readAt ? 'font-medium' : 'font-semibold'} text-foreground`}
                          >
                            {peer(item, folder)}
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums text-secondary">
                            {formatListDate(item.createdAt)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-foreground">
                          {item.subject || '(без темы)'}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-secondary">
                          {item.attachments?.length ? (
                            <span className="inline-flex shrink-0 items-center gap-0.5 text-foreground">
                              <Paperclip size={12} strokeWidth={2} />
                              {item.attachments.length}
                            </span>
                          ) : null}
                          <span className="truncate">
                            {preview(item.body) || (item.attachments?.length ? 'Вложение' : '')}
                          </span>
                        </span>
                      </span>
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
                <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/55 text-secondary">
                    <Mail size={22} strokeWidth={1.75} />
                  </span>
                  <p className="mt-3 text-sm font-medium text-foreground">Выберите письмо</p>
                  <p className="mt-1 max-w-xs text-xs text-secondary">Откройте сообщение из списка слева</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {compose ? null : (
        <button
          type="button"
          onClick={() => setCompose('new')}
          className="absolute right-7 bottom-7 z-30 flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary shadow-lg shadow-primary/20"
        >
          <PenLine size={16} strokeWidth={2} />
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
      <header className="flex h-12 shrink-0 items-center border-b border-line px-4">
        <h1 className="text-sm font-semibold tracking-[-0.02em] text-foreground">Адресная книга</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 md:px-6">
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
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onTab('employees')}
          className={`tab-item ${tab === 'employees' ? 'tab-item-active' : ''}`}
        >
          Сотрудники
          {book ? (
            <span className="ml-2 rounded-full bg-white/60 px-1.5 py-0.5 text-[11px] tabular-nums text-secondary">
              {book.employees.length}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => onTab('counterparties')}
          className={`tab-item ${tab === 'counterparties' ? 'tab-item-active' : ''}`}
        >
          Контрагенты
          {book ? (
            <span className="ml-2 rounded-full bg-white/60 px-1.5 py-0.5 text-[11px] tabular-nums text-secondary">
              {book.counterparties.length}
            </span>
          ) : null}
        </button>
      </div>
      <input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Поиск по имени или почте"
        className="h-10 rounded-xl border border-line bg-white/45 px-3 text-sm outline-none focus:border-accent"
      />
      <div className="overflow-auto rounded-xl border border-line bg-white/35">
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
              className="block w-full border-b border-line px-3 py-2.5 text-left last:border-b-0 hover:bg-white/50"
            >
              <p className="text-sm font-medium text-foreground">{entry.name}</p>
              <p className="text-xs text-secondary">{entry.email}</p>
              {'contactName' in entry && typeof entry.contactName === 'string' && entry.contactName ? (
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
      <header className="shrink-0 border-b border-line px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">{item.subject || '(без темы)'}</h2>
          {onClose ? (
            <button type="button" className="text-sm text-secondary hover:text-foreground" onClick={onClose}>
              Закрыть
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-foreground/80">
          От: {item.fromName} &lt;{item.fromAddress}&gt;
        </p>
        <p className="text-sm text-foreground/80">
          Кому: {item.toName} &lt;{item.toAddress}&gt;
        </p>
        <p className="mt-1 text-xs text-secondary">{formatDate(item.createdAt)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {item.folder === 'DRAFTS' ? (
            <>
              <button type="button" onClick={onReply} className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-sm font-semibold text-on-primary">
                Продолжить
              </button>
              <button type="button" onClick={onSendDraft} className={GHOST}>
                Отправить
              </button>
              <button type="button" onClick={onDelete} className={GHOST}>
                Удалить
              </button>
            </>
          ) : (
            <>
              {item.folder !== 'SENT' ? (
                <button type="button" onClick={onReply} className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-sm font-semibold text-on-primary">
                  Ответить
                </button>
              ) : null}
              {item.folder !== 'ARCHIVE' ? (
                <button type="button" onClick={() => onMove('ARCHIVE')} className={GHOST}>
                  В архив
                </button>
              ) : (
                <button type="button" onClick={() => onMove('INBOX')} className={GHOST}>
                  Во входящие
                </button>
              )}
              {item.folder !== 'SPAM' ? (
                <button type="button" onClick={() => onMove('SPAM')} className={GHOST}>
                  Спам
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => onMove('INBOX')} className={GHOST}>
                    Не спам
                  </button>
                  <button type="button" onClick={onDelete} className={GHOST}>
                    Удалить
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground">{item.body}</p>
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
  const [body, setBody] = useState(
    reply ? (initial ? quote(initial) : '') : initial?.body ?? '',
  )
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
              className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-white/45 px-3 text-sm text-foreground outline-none focus:border-accent"
            />
            <button
              type="button"
              aria-label="Адресная книга"
              onClick={() => setBookOpen(true)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white/45 text-foreground hover:bg-white/70"
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
            className="mt-1 h-10 w-full rounded-xl border border-line bg-white/45 px-3 text-sm text-foreground outline-none focus:border-accent"
          />
        </label>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={10}
          className="rounded-xl border border-line bg-white/45 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
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
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white/45 px-3 text-sm disabled:opacity-60"
            >
              <Paperclip size={16} strokeWidth={2} />
              Приложить файл
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(true)}
              className="h-10 rounded-xl border border-line bg-white/45 px-4 text-sm disabled:opacity-60"
            >
              Черновик
            </button>
            <button type="submit" disabled={busy} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60">
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

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Закрыть" className="glass-scrim absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="address-book-title"
        className="glass-strong relative z-10 max-h-[85vh] w-full max-w-lg overflow-auto rounded-t-3xl p-6 sm:rounded-3xl"
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
    </div>,
    document.body,
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
          <li key={item.id} className="flex items-center gap-2 rounded-xl border border-line bg-white/45 px-3 py-2">
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
      <button type="button" aria-label="Закрыть" className="glass-scrim absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="attachment-preview-title"
        className="glass-strong relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
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
            <iframe title={name} src={url} className="h-[75vh] w-full rounded-xl border border-line bg-white" />
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

function formatListDate(value: string) {
  const date = new Date(value)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
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
