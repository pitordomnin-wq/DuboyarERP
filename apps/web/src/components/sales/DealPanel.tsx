import { useEffect, useState, type FormEvent } from 'react'
import { CHANNEL_LABEL, DEAL_STATUS_LABEL, type DealChannel, type DealStatus } from '@/lib/deal-columns'
import {
  createDealInvoice,
  createDealUpd,
  deleteDeal,
  deleteDealDocument,
  downloadDealDocument,
  fetchDeal,
  fetchDealDocumentBlob,
  sendDealDocument,
  sendDealMessage,
  sendDealSms,
  shipDeal,
  startDealCall,
  updateDealStatus,
  type DealDetail,
  type DealDocument,
} from '@/lib/sales-api'
import { sendDealItemToProduction, fetchProductionTypes, RELEASE_TYPE_LABEL, type ProductionReleaseType, type ProductionTypeSummary } from '@/lib/production-api'

const TABS = ['info', 'chat', 'docs', 'production', 'shipment', 'history'] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL: Record<Tab, string> = {
  info: 'Информация',
  chat: 'Чат',
  docs: 'Документы',
  production: 'Производство',
  shipment: 'Отгрузка',
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
          {tab === 'shipment' ? <ShipmentTab deal={deal} onChange={onChange} /> : null}
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
                {item.productionStatus === 'SHIPPED' ? (
                  <span className="mt-0.5 block text-xs text-secondary">отгружено клиенту</span>
                ) : item.productionStatus === 'IN_WAREHOUSE' ? (
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
  const [previewDoc, setPreviewDoc] = useState<DealDocument | null>(null)
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
                <button
                  type="button"
                  className="text-secondary hover:text-foreground"
                  onClick={() => setPreviewDoc(doc)}
                >
                  Посмотреть
                </button>
                <button
                  type="button"
                  className="text-secondary hover:text-foreground"
                  onClick={() =>
                    void downloadDealDocument(
                      deal.id,
                      doc.id,
                      doc.kind === 'UPD_XLSX'
                        ? `${doc.title}.xlsx`
                        : doc.kind === 'UPD_PDF'
                          ? `${doc.title}.pdf`
                          : `${doc.title}.html`,
                    )
                  }
                >
                  Скачать
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

      {previewDoc ? (
        <DocumentPreviewModal
          dealId={deal.id}
          doc={previewDoc}
          allDocs={deal.documents}
          onClose={() => setPreviewDoc(null)}
        />
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
  const [releaseByItem, setReleaseByItem] = useState<Record<string, ProductionReleaseType>>({})

  useEffect(() => {
    void fetchProductionTypes().then(setTypes)
  }, [])

  function inferReleaseType(name: string): ProductionReleaseType {
    const lower = name.toLowerCase()
    return lower.includes('ёлоч') || lower.includes('елоч') || lower.includes('елка') ? 'HERRINGBONE' : 'DECK'
  }

  async function send(itemId: string, itemName: string) {
    setBusyId(itemId)
    setError(null)
    try {
      await sendDealItemToProduction(itemId, releaseByItem[itemId] ?? inferReleaseType(itemName))
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
        const releaseType = releaseByItem[item.id] ?? inferReleaseType(item.name)
        return (
          <div key={item.id} className="rounded-md border-2 border-slate-300 p-3">
            <p className="text-sm font-medium text-foreground">{item.name}</p>
            <p className="mt-1 text-xs text-secondary">
              {item.quantity.toLocaleString('ru-RU')} {item.unit}
            </p>
            {item.productionStatus === 'SHIPPED' ? (
              <p className="mt-2 text-sm text-foreground">Отгружено клиенту — см. вкладку «Отгрузка»</p>
            ) : item.productionStatus === 'IN_WAREHOUSE' ? (
              <p className="mt-2 text-sm text-foreground">На складе — отгрузка во вкладке «Отгрузка»</p>
            ) : item.productionStatus === 'IN_PRODUCTION' ? (
              <p className="mt-2 text-sm text-secondary">В производстве</p>
            ) : types === null ? (
              <p className="mt-2 text-sm text-secondary">Загрузка</p>
            ) : !item.productId || !type ? (
              <p className="mt-2 text-sm text-secondary">Этапы не настроены в панели управления</p>
            ) : (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="text-xs font-medium text-secondary">
                  Тип выпуска
                  <select
                    value={releaseType}
                    onChange={(event) =>
                      setReleaseByItem((current) => ({
                        ...current,
                        [item.id]: event.target.value as ProductionReleaseType,
                      }))
                    }
                    className="mt-1 h-10 rounded-md border-2 border-slate-300 px-2 text-sm"
                  >
                    {Object.entries(RELEASE_TYPE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void send(item.id, item.name)}
                  className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary"
                >
                  Передать в производство
                </button>
              </div>
            )}
          </div>
        )
      })}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

function ShipmentTab({ deal, onChange }: { deal: DealDetail; onChange: (deal: DealDetail) => void }) {
  const [shippedAt, setShippedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<DealDocument | null>(null)

  const ready = deal.items.filter((item) => item.productionStatus === 'IN_WAREHOUSE')
  const shipped = deal.items.filter((item) => item.productionStatus === 'SHIPPED')
  const updDocs = deal.documents.filter((doc) => doc.kind === 'UPD_XLSX' || doc.kind === 'UPD_PDF')

  async function ship(itemIds?: string[]) {
    setBusy(true)
    setError(null)
    try {
      onChange(
        await shipDeal(deal.id, {
          itemIds,
          shippedAt: new Date(`${shippedAt}T12:00:00`).toISOString(),
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отгрузить')
    } finally {
      setBusy(false)
    }
  }

  async function regenerateUpd() {
    setBusy(true)
    setError(null)
    try {
      onChange(
        await createDealUpd(deal.id, {
          shippedAt: new Date(`${shippedAt}T12:00:00`).toISOString(),
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сформировать УПД')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="rounded-md border-2 border-slate-300 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Параметры отгрузки</p>
        <label className="mt-3 block text-xs font-medium text-secondary">
          Дата отгрузки
          <input
            type="date"
            value={shippedAt}
            onChange={(event) => setShippedAt(event.target.value)}
            className="mt-1 h-10 w-full max-w-xs rounded-md border-2 border-slate-300 px-3 text-sm"
          />
        </label>
        <div className="mt-3 space-y-1 text-sm">
          <p>
            <span className="text-secondary">Грузополучатель: </span>
            {deal.counterparty.legalName || deal.counterparty.name}
          </p>
          <p>
            <span className="text-secondary">Адрес: </span>
            {deal.counterparty.legalAddress || '—'}
          </p>
          <p>
            <span className="text-secondary">ИНН/КПП: </span>
            {[deal.counterparty.inn, deal.counterparty.kpp].filter(Boolean).join(' / ') || '—'}
          </p>
          <p>
            <span className="text-secondary">Основание: </span>
            Сделка «{deal.title}»
          </p>
          <p className="text-xs text-secondary">
            Статус сделки: {DEAL_STATUS_LABEL[deal.status]}. После полной отгрузки — «Доставлено», при частичной —
            «Передано в доставку».
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">К отгрузке</p>
          {ready.length > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void ship()}
              className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
            >
              Отгрузить всё ({ready.length})
            </button>
          ) : null}
        </div>
        {ready.length === 0 ? (
          <p className="text-secondary">Нет позиций на складе. Сначала завершите производство.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ready.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border-2 border-slate-300 p-3">
                <div>
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-secondary">
                    {item.quantity.toLocaleString('ru-RU')} {item.unit}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void ship([item.id])}
                  className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
                >
                  Отгрузить
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">Отгружено</p>
        {shipped.length === 0 ? (
          <p className="text-secondary">Пока ничего не отгружено</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shipped.map((item) => (
              <li key={item.id} className="rounded-md border-2 border-slate-300 p-3">
                <p className="font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-secondary">
                  {item.quantity.toLocaleString('ru-RU')} {item.unit} · отгружено клиенту
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">УПД</p>
          {shipped.length > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void regenerateUpd()}
              className="h-10 rounded-md border-2 border-slate-300 bg-white px-4 text-sm disabled:opacity-60"
            >
              Сформировать УПД снова
            </button>
          ) : null}
        </div>
        {updDocs.length === 0 ? (
          <p className="text-secondary">После отгрузки здесь появятся Excel и PDF</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border-2 border-slate-300">
            {updDocs.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span>
                  <span className="block text-foreground">{doc.title}</span>
                  <span className="text-xs text-secondary">{formatDate(doc.createdAt)}</span>
                </span>
                <span className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    className="text-sm text-secondary hover:text-foreground"
                    onClick={() => setPreviewDoc(doc)}
                  >
                    Посмотреть
                  </button>
                  <button
                    type="button"
                    className="text-sm text-secondary hover:text-foreground"
                    onClick={() =>
                      void downloadDealDocument(
                        deal.id,
                        doc.id,
                        doc.kind === 'UPD_XLSX' ? `${doc.title}.xlsx` : `${doc.title}.pdf`,
                      ).catch(() => setError('Не удалось скачать файл'))
                    }
                  >
                    Скачать
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {previewDoc ? (
        <DocumentPreviewModal
          dealId={deal.id}
          doc={previewDoc}
          allDocs={deal.documents}
          onClose={() => setPreviewDoc(null)}
        />
      ) : null}

      {error ? <p className="text-destructive">{error}</p> : null}
    </div>
  )
}

function DocumentPreviewModal({
  dealId,
  doc,
  allDocs,
  onClose,
}: {
  dealId: string
  doc: DealDocument
  allDocs: DealDocument[]
  onClose: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Excel cannot render in iframe — show companion PDF from the same UPD pair.
  const previewTarget =
    doc.kind === 'UPD_XLSX'
      ? allDocs.find(
          (item) =>
            item.kind === 'UPD_PDF' &&
            item.title.replace(/\s*\(PDF\)\s*$/i, '') === doc.title.replace(/\s*\(Excel\)\s*$/i, ''),
        ) ??
        allDocs.find((item) => item.kind === 'UPD_PDF') ??
        doc
      : doc

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    setLoading(true)
    setError(null)

    void fetchDealDocumentBlob(dealId, previewTarget.id)
      .then(({ blob, mimeType }) => {
        if (cancelled) return
        if (previewTarget.kind === 'UPD_XLSX' && !mimeType.includes('pdf') && !mimeType.includes('html')) {
          setError('Excel нельзя показать в браузере — откройте PDF или скачайте файл.')
          setLoading(false)
          return
        }
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError('Не удалось открыть документ')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [dealId, previewTarget.id, previewTarget.kind])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button type="button" className="glass-scrim absolute inset-0" onClick={onClose} aria-label="Закрыть" />
      <div className="glass-strong relative z-10 flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{doc.title}</p>
            {previewTarget.id !== doc.id ? (
              <p className="text-xs text-secondary">Просмотр PDF-версии того же УПД</p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className="h-9 rounded-md border-2 border-slate-300 px-3 text-sm"
              onClick={() =>
                void downloadDealDocument(
                  dealId,
                  doc.id,
                  doc.kind === 'UPD_XLSX'
                    ? `${doc.title}.xlsx`
                    : doc.kind === 'UPD_PDF'
                      ? `${doc.title}.pdf`
                      : `${doc.title}.html`,
                )
              }
            >
              Скачать
            </button>
            <button type="button" className="h-9 px-2 text-sm text-secondary" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-white">
          {loading ? <p className="p-4 text-sm text-secondary">Загрузка…</p> : null}
          {error ? <p className="p-4 text-sm text-destructive">{error}</p> : null}
          {url ? <iframe title={doc.title} className="h-full w-full border-0" src={url} /> : null}
        </div>
      </div>
    </div>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

function money(value: number) {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽'
}
