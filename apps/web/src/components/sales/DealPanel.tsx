import { useEffect, useState, type FormEvent } from 'react'
import { CHANNEL_LABEL, DEAL_STATUS_LABEL, type DealChannel, type DealStatus } from '@/lib/deal-columns'
import {
  createDealInvoice,
  deleteDeal,
  deleteDealDocument,
  fetchDeal,
  sendDealDocument,
  sendDealMessage,
  sendDealSms,
  startDealCall,
  updateDealStatus,
  type DealDetail,
} from '@/lib/sales-api'
import { sendDealItemToProduction, fetchProductionTypes, type ProductionTypeSummary } from '@/lib/production-api'

const TABS = ['info', 'chat', 'docs', 'production', 'history'] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL: Record<Tab, string> = {
  info: 'Информация',
  chat: 'Чат',
  docs: 'Документы',
  production: 'Производство',
  history: 'История',
}

export function DealPanel({
  deal,
  statusLabels = DEAL_STATUS_LABEL,
  onClose,
  onChange,
  onDeleted,
}: {
  deal: DealDetail
  statusLabels?: Record<DealStatus, string>
  onClose: () => void
  onChange: (deal: DealDetail) => void
  onDeleted: () => void
}) {
  const [tab, setTab] = useState<Tab>('info')

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex">
      <button type="button" aria-label="Закрыть" className="glass-scrim absolute inset-0" onClick={onClose} />
      <div className="glass-panel relative z-10 ml-auto flex h-full w-full max-w-3xl flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">{deal.title}</h2>
            <p className="mt-1 text-sm text-secondary">{deal.counterparty.name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-secondary hover:text-foreground">
            Закрыть
          </button>
        </header>
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`tab-item shrink-0 ${tab === item ? 'tab-item-active' : ''}`}
            >
              {TAB_LABEL[item]}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-5">
          {tab === 'info' ? (
            <InfoTab deal={deal} statusLabels={statusLabels} onChange={onChange} onDeleted={onDeleted} />
          ) : null}
          {tab === 'chat' ? <ChatTab deal={deal} onChange={onChange} /> : null}
          {tab === 'docs' ? <DocsTab deal={deal} onChange={onChange} /> : null}
          {tab === 'production' ? <ProductionTab deal={deal} onChange={onChange} /> : null}
          {tab === 'history' ? (
            <ul className="flex flex-col gap-3">
              {deal.events.map((event) => (
                <li key={event.id} className="text-sm">
                  <p className="text-foreground">{event.text}</p>
                  <p className="text-xs text-secondary">{formatDate(event.createdAt)}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function InfoTab({
  deal,
  statusLabels,
  onChange,
  onDeleted,
}: {
  deal: DealDetail
  statusLabels: Record<DealStatus, string>
  onChange: (deal: DealDetail) => void
  onDeleted: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setConfirming(false)
    setBusy(false)
    setError(null)
  }, [deal.id])

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await deleteDeal(deal.id)
      onDeleted()
    } catch {
      setError('Не удалось удалить заказ')
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col gap-5 text-sm">
      <label className="flex max-w-sm flex-col gap-1 text-xs font-medium text-secondary">
        Статус
        <select
          value={deal.status}
          onChange={(event) => {
            void updateDealStatus(deal.id, event.target.value as DealStatus).then(onChange)
          }}
          className="h-10 rounded-md border-2 border-slate-300 bg-white px-2 text-sm text-foreground"
        >
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p>
        <span className="text-secondary">Заказчик: </span>
        {deal.counterparty.legalName}
      </p>
      <p>
        <span className="text-secondary">Заказали: </span>
        {formatDate(deal.createdAt)}
      </p>
      <p>
        <span className="text-secondary">Нужно к: </span>
        {deal.dueDate ? formatDate(deal.dueDate) : 'не указано'}
      </p>
      {deal.description ? <p className="whitespace-pre-wrap">{deal.description}</p> : null}
      <table className="w-full border-collapse border-2 border-slate-300 text-left">
        <thead className="bg-slate-100 text-xs text-secondary">
          <tr>
            <th className="border border-slate-300 px-2 py-1.5">Позиция</th>
            <th className="border border-slate-300 px-2 py-1.5">Кол-во</th>
            <th className="border border-slate-300 px-2 py-1.5">Цена</th>
            <th className="border border-slate-300 px-2 py-1.5">Сумма</th>
          </tr>
        </thead>
        <tbody>
          {deal.items.map((item) => (
            <tr key={item.id}>
              <td className="border border-slate-300 px-2 py-1.5">
                {item.name}
                {item.productionStatus === 'IN_WAREHOUSE' ? (
                  <span className="mt-0.5 block text-xs text-secondary">произведена, на складе</span>
                ) : item.productionStatus === 'IN_PRODUCTION' ? (
                  <span className="mt-0.5 block text-xs text-secondary">в производстве</span>
                ) : null}
              </td>
              <td className="border border-slate-300 px-2 py-1.5">
                {item.quantity} {item.unit}
              </td>
              <td className="border border-slate-300 px-2 py-1.5">{money(item.price)}</td>
              <td className="border border-slate-300 px-2 py-1.5">{money(item.quantity * item.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-auto flex flex-col items-end gap-2 pt-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {confirming ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-foreground">Вы уверены?</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
            >
              Да
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="h-10 rounded-md border-2 border-slate-300 px-4 text-sm disabled:opacity-60"
            >
              Нет
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="h-10 rounded-md border-2 border-slate-300 bg-white px-4 text-sm"
          >
            Удалить заказ
          </button>
        )}
      </div>
    </div>
  )
}

function ChatTab({ deal, onChange }: { deal: DealDetail; onChange: (deal: DealDetail) => void }) {
  const [channel, setChannel] = useState<DealChannel>('EMAIL')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const telegramOn = Boolean(deal.counterparty.telegram)
  const phoneOn = Boolean(deal.counterparty.phone)
  const messages = deal.messages.filter((item) => item.channel === channel)

  async function send(event: FormEvent) {
    event.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    try {
      const next =
        channel === 'PHONE'
          ? await sendDealSms(deal.id, text.trim())
          : await sendDealMessage(deal.id, channel, text.trim())
      setText('')
      onChange(next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-[360px] flex-col">
      <div className="mb-4 flex gap-2">
        {(['EMAIL', 'TELEGRAM', 'PHONE'] as DealChannel[]).map((item) => {
          const blocked =
            (item === 'TELEGRAM' && !telegramOn) || (item === 'PHONE' && !phoneOn)
          return (
            <button
              key={item}
              type="button"
              onClick={() => setChannel(item)}
              className={`rounded-md border-2 px-3 py-1.5 text-sm ${
                channel === item ? 'border-foreground bg-slate-100' : 'border-slate-300'
              } ${blocked ? 'opacity-60' : ''}`}
            >
              {CHANNEL_LABEL[item]}
              {item === 'TELEGRAM' && !telegramOn ? ' (не подключён)' : ''}
              {item === 'PHONE' && !phoneOn ? ' (нет номера)' : ''}
            </button>
          )
        })}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto rounded-md border-2 border-slate-300 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-secondary">
            {channel === 'PHONE' ? 'Звонков и SMS нет' : 'Сообщений нет'}
          </p>
        ) : (
          messages.map((item) => (
            <div key={item.id} className="text-sm">
              <p className="text-xs text-secondary">
                {item.author?.name ?? 'Контрагент'} · {formatDate(item.createdAt)}
              </p>
              <p className="whitespace-pre-wrap">{item.body}</p>
            </div>
          ))
        )}
      </div>
      {channel === 'TELEGRAM' && !telegramOn ? (
        <p className="mt-3 text-sm text-secondary">Telegram контрагента не подключён</p>
      ) : channel === 'PHONE' && !phoneOn ? (
        <p className="mt-3 text-sm text-secondary">У контрагента не указан телефон</p>
      ) : channel === 'PHONE' ? (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-secondary">{deal.counterparty.phone}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                void startDealCall(deal.id)
                  .then(onChange)
                  .finally(() => setBusy(false))
              }}
              className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
            >
              Позвонить
            </button>
          </div>
          <form onSubmit={send} className="flex gap-2">
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="h-10 flex-1 rounded-md border-2 border-slate-300 px-3 text-sm"
              placeholder="Текст SMS"
            />
            <button
              type="submit"
              disabled={busy}
              className="h-10 rounded-md border-2 border-slate-300 px-4 text-sm font-medium disabled:opacity-60"
            >
              SMS
            </button>
          </form>
        </div>
      ) : (
        <form onSubmit={send} className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="h-10 flex-1 rounded-md border-2 border-slate-300 px-3 text-sm"
            placeholder="Сообщение"
          />
          <button type="submit" disabled={busy} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60">
            Отправить
          </button>
        </form>
      )}
    </div>
  )
}

function DocsTab({ deal, onChange }: { deal: DealDetail; onChange: (deal: DealDetail) => void }) {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [sendId, setSendId] = useState<string | null>(null)

  return (
    <div>
      <button
        type="button"
        onClick={() => void createDealInvoice(deal.id).then(onChange)}
        className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary"
      >
        Сформировать счёт
      </button>
      <ul className="mt-4 divide-y divide-line border-2 border-slate-300">
        {deal.documents.length === 0 ? (
          <li className="px-3 py-4 text-sm text-secondary">Документов нет</li>
        ) : (
          deal.documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block text-foreground">{doc.title}</span>
                {doc.sentAt ? <span className="text-xs text-secondary">отправлено заказчику</span> : null}
              </span>
              <span className="flex shrink-0 gap-3">
                <button type="button" className="text-secondary hover:text-foreground" onClick={() => setPreviewId(doc.id)}>
                  Посмотреть
                </button>
                {doc.sentAt ? null : (
                  <>
                    <button type="button" className="text-secondary hover:text-foreground" onClick={() => setSendId(doc.id)}>
                      Отправить в чат
                    </button>
                    <button
                      type="button"
                      className="text-secondary hover:text-foreground"
                      onClick={() => void deleteDealDocument(deal.id, doc.id).then(onChange)}
                    >
                      Удалить
                    </button>
                  </>
                )}
              </span>
            </li>
          ))
        )}
      </ul>

      {previewId ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button type="button" className="glass-scrim absolute inset-0" onClick={() => setPreviewId(null)} />
          <div className="glass-strong relative z-10 h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl">
            <iframe title="Документ" className="h-full w-full" src={`/v1/deals/${deal.id}/documents/${previewId}/file`} />
          </div>
        </div>
      ) : null}

      {sendId ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button type="button" className="glass-scrim absolute inset-0" onClick={() => setSendId(null)} />
          <div className="glass-strong relative z-10 w-full max-w-sm rounded-3xl p-5">
            <p className="font-medium">Куда отправить</p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="h-10 rounded-md border-2 border-slate-300 text-sm hover:bg-slate-50"
                onClick={() => {
                  void sendDealDocument(deal.id, sendId, 'EMAIL').then((next) => {
                    onChange(next)
                    setSendId(null)
                  })
                }}
              >
                Email
              </button>
              <button
                type="button"
                disabled={!deal.counterparty.telegram}
                className="h-10 rounded-md border-2 border-slate-300 text-sm hover:bg-slate-50 disabled:opacity-50"
                onClick={() => {
                  void sendDealDocument(deal.id, sendId, 'TELEGRAM').then((next) => {
                    onChange(next)
                    setSendId(null)
                  })
                }}
              >
                Telegram{deal.counterparty.telegram ? '' : ' (не подключён)'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ProductionTab({ deal, onChange }: { deal: DealDetail; onChange: (deal: DealDetail) => void }) {
  const [types, setTypes] = useState<ProductionTypeSummary[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchProductionTypes().then(setTypes)
  }, [])

  async function send(itemId: string) {
    setBusyId(itemId)
    setError(null)
    try {
      await sendDealItemToProduction(itemId)
      onChange(await fetchDeal(deal.id))
    } catch {
      setError('Не удалось передать в производство. Проверьте, что этапы настроены в панели управления.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {deal.items.map((item) => {
        const type = types?.find((entry) => entry.productId === item.productId)
        return (
          <div key={item.id} className="rounded-md border-2 border-slate-300 p-3">
            <p className="text-sm font-medium text-foreground">{item.name}</p>
            <p className="mt-1 text-xs text-secondary">
              {item.quantity.toLocaleString('ru-RU')} {item.unit}
            </p>
            {item.productionStatus === 'IN_WAREHOUSE' ? (
              <p className="mt-2 text-sm text-foreground">Продукция произведена и находится на складе</p>
            ) : item.productionStatus === 'IN_PRODUCTION' ? (
              <p className="mt-2 text-sm text-secondary">В производстве</p>
            ) : types === null ? (
              <p className="mt-2 text-sm text-secondary">Загрузка</p>
            ) : !item.productId || !type ? (
              <p className="mt-2 text-sm text-secondary">Этапы не настроены в панели управления</p>
            ) : (
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => void send(item.id)}
                className="mt-3 h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary"
              >
                Передать в производство
              </button>
            )}
          </div>
        )
      })}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

function money(value: number) {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽'
}
