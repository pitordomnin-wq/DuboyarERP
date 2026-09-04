import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/tasks/TaskModal'
import {
  STAGE_STATUS_LABEL,
  RELEASE_TYPE_LABEL,
  LAYOUT_ROLE_LABEL,
  completeProductionJob,
  fetchJobWriteoffs,
  fetchProductionJobs,
  fetchProductionType,
  fetchProductionTypes,
  inputAppliesToRelease,
  previewJobWriteoffs,
  rollbackProductionJob,
  startProductionJob,
  type ProductionBomLine,
  type ProductionJob,
  type ProductionType,
  type ProductionTypeSummary,
  type ProductionWriteoff,
  type ProductionWriteoffPreview,
} from '@/lib/production-api'

export function ProductionPage() {
  const [types, setTypes] = useState<ProductionTypeSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [jobs, setJobs] = useState<ProductionJob[]>([])
  const [detail, setDetail] = useState<ProductionType | null>(null)
  const [loading, setLoading] = useState(true)
  const [opened, setOpened] = useState<ProductionJob | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void fetchProductionTypes().then((list) => {
      setTypes(list)
      setActiveId((current) => current ?? list[0]?.id ?? null)
    })
  }, [])

  useEffect(() => {
    if (!activeId) {
      setJobs([])
      setDetail(null)
      setLoading(false)
      return
    }
    setLoading(true)
    void Promise.all([fetchProductionJobs({ typeId: activeId }), fetchProductionType(activeId)])
      .then(([nextJobs, nextDetail]) => {
        setJobs(nextJobs)
        setDetail(nextDetail)
      })
      .finally(() => setLoading(false))
  }, [activeId])

  const grouped = useMemo(() => {
    const map = new Map<string, ProductionJob[]>()
    for (const stage of detail?.stages ?? []) map.set(stage.id, [])
    for (const job of jobs) map.get(job.stageId)?.push(job)
    return map
  }, [detail, jobs])

  function applyJob(job: ProductionJob) {
    setJobs((current) => current.map((item) => (item.id === job.id ? job : item)))
    setOpened(null)
    if (job.status === 'DONE') {
      setNotice(`Готово. Продукция помещена на склад «${job.warehouse.name}».`)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-line md:h-full md:w-72 md:overflow-hidden md:border-r md:border-b-0">
        <div className="shrink-0 px-4 py-3 md:px-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Продукция</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto md:px-2">
          {types.map((item) => {
            const active = item.id === activeId
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveId(item.id)}
                className={`side-item min-w-[220px] shrink-0 flex-col items-start md:min-w-0 ${active ? 'side-item-active' : ''}`}
              >
                <span className="text-sm">{item.name}</span>
                <span className="text-xs text-secondary">{item.stages.length} этап(ов)</span>
              </button>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 px-4 pt-5 pb-4 md:px-8">
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">{detail?.name ?? 'Производство'}</h1>
          {detail ? <p className="mt-1 text-sm text-secondary">{detail.warehouse.name}</p> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-4 pb-6 md:px-8">
          {!detail ? (
            <p className="text-sm text-secondary">Этапы настраивает администратор в панели управления.</p>
          ) : loading ? (
            <p className="text-sm text-secondary">Загрузка</p>
          ) : (
            <div className="flex h-full items-stretch gap-3">
              {detail.stages.map((stage) => (
                <section
                  key={stage.id}
                  className="glass-well flex h-full w-[300px] shrink-0 flex-col rounded-2xl"
                >
                  <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-white/55 px-3">
                    <h2 className="whitespace-nowrap text-sm font-semibold text-foreground">{stage.name}</h2>
                    <span className="glass-chip shrink-0 rounded-full px-1.5 py-0.5 text-xs tabular-nums text-secondary">
                      {grouped.get(stage.id)?.length ?? 0}
                    </span>
                  </header>
                  <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2">
                    {(grouped.get(stage.id) ?? []).map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => setOpened(job)}
                        className={`glass-chip shrink-0 rounded-xl p-3 text-left transition-[background-color,box-shadow] duration-150 hover:bg-white/85 ${
                          isRunningJob(job) ? 'job-running' : ''
                        }`}
                      >
                        <p className="text-sm font-medium text-foreground">{job.dealItem?.name ?? job.title}</p>
                        <p className="mt-1 text-xs text-secondary">
                          {jobPrimaryQty(job, detail).toLocaleString('ru-RU')} {jobUnit(job, detail)} · {jobStatusLabel(job)}
                        </p>
                        {job.deal ? <p className="mt-1 text-xs text-secondary">{job.deal.title}</p> : null}
                      </button>
                    ))}
                    {(grouped.get(stage.id) ?? []).length === 0 ? (
                      <p className="px-1 py-6 text-center text-xs text-slate-500">Пусто</p>
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {opened && detail ? (
        <JobCardModal job={opened} type={detail} onClose={() => setOpened(null)} onChanged={applyJob} />
      ) : null}
      {notice ? (
        <Modal title="Готово" onClose={() => setNotice(null)}>
          <p className="mt-4 text-sm leading-6 text-foreground">{notice}</p>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary"
            >
              Понятно
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function isRunningJob(job: ProductionJob) {
  return job.status === 'ACTIVE' && job.stageStatus === 'IN_PROGRESS'
}

function jobStatusLabel(job: ProductionJob) {
  if (job.status === 'DONE') return 'Продукция на складе'
  if (isRunningJob(job)) return 'Запущено'
  return STAGE_STATUS_LABEL[job.stageStatus]
}

function jobUnit(job: ProductionJob, type: ProductionType | null) {
  if (job.status === 'DONE') return 'упак'
  const stage = type?.stages.find((item) => item.id === job.stageId)
  const position = stage?.position ?? 0
  // Packaging stage and after: packages. Between profiling and packaging: pieces.
  if (position >= 3) return 'упак'
  if (job.pieceCount != null && position >= 1) return 'шт'
  if (job.packageCount != null) return 'упак'
  return job.dealItem?.unit ?? stage?.outputs[0]?.product?.unit ?? type?.product.unit ?? 'шт'
}

function jobPrimaryQty(job: ProductionJob, type: ProductionType | null) {
  if (job.status === 'DONE') return job.packageCount ?? job.quantity
  const stage = type?.stages.find((item) => item.id === job.stageId)
  const position = stage?.position ?? 0
  if (position >= 3) {
    return (
      job.packageCount ??
      (job.pieceCount != null && type
        ? Math.max(
            1,
            Math.round(
              job.pieceCount /
                Math.max(
                  1e-9,
                  type.piecesPerM2 *
                    (job.releaseType === 'HERRINGBONE' ? type.m2PerPackageHerringbone : type.m2PerPackageDeck),
                ),
            ),
          )
        : job.quantity)
    )
  }
  if (job.pieceCount != null && position >= 1) return job.pieceCount
  if (job.packageCount != null) return job.packageCount
  return job.quantity
}

function receiptNeedQty(
  output: { quantity: number },
  job: ProductionJob,
  type: ProductionType,
  stage: ProductionType['stages'][number],
) {
  const factor = Math.max(0, 1 - (stage.lossPercent ?? 0) / 100)
  if (stage.position >= 3) {
    const packages = jobPrimaryQty(job, type)
    return output.quantity * packages * factor
  }
  if (stage.position >= 2) {
    return output.quantity * (job.pieceCount ?? job.quantity) * factor
  }
  return output.quantity * job.quantityM2 * factor
}

function stageReceipts(stage: ProductionType['stages'][number], type: ProductionType, finishing: boolean) {
  if (stage.outputs.length > 0) return stage.outputs
  if (finishing) {
    return [
      {
        id: 'finished',
        productId: type.productId,
        quantity: 1,
        product: type.product,
      },
    ]
  }
  return []
}

function formatBomQty(value: number) {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 3 })
}

function formatInputLabel(input: ProductionBomLine) {
  if (input.inputMode === 'LKP_RECIPE') return 'ЛКП по рецепту (грунт, лак/масло, паста, краситель, пигмент)'
  if (input.productGroup) return `группа «${input.productGroup.name}» (FIFO)`
  if (input.layoutRole) return LAYOUT_ROLE_LABEL[input.layoutRole]
  if (input.product) return `${input.product.unit} · ${input.product.name}`
  if (input.keyword) return input.keyword
  return 'материал'
}

function inputNeedQty(
  input: ProductionBomLine,
  job: ProductionJob,
  type: ProductionType,
  stagePosition: number,
  profilingLoss: number,
) {
  const basis = input.quantityBasis ?? (input.inputMode === 'LKP_RECIPE' ? 'M2_ORIGINAL' : stagePosition >= 3 ? 'PACKAGE' : stagePosition >= 2 ? 'PIECE' : 'M2')
  let basisQty = job.quantityM2
  if (basis === 'M2_ORIGINAL') basisQty = job.quantityM2 * Math.max(0, 1 - profilingLoss / 100)
  else if (basis === 'PIECE') {
    basisQty =
      job.pieceCount ??
      job.quantityM2 * Math.max(0, 1 - profilingLoss / 100) * type.piecesPerM2
  } else if (basis === 'PACKAGE') {
    const m2PerPackage =
      job.releaseType === 'HERRINGBONE' ? type.m2PerPackageHerringbone : type.m2PerPackageDeck
    basisQty =
      job.packageCount ??
      Math.max(1, Math.ceil((job.quantityM2 * Math.max(0, 1 - profilingLoss / 100)) / m2PerPackage - 1e-9))
  }
  return input.quantity * basisQty
}

function JobCardModal({
  job,
  type,
  onClose,
  onChanged,
}: {
  job: ProductionJob
  type: ProductionType
  onClose: () => void
  onChanged: (job: ProductionJob) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ProductionWriteoffPreview[]>([])
  const [history, setHistory] = useState<ProductionWriteoff[]>([])
  const [pickingIndex, setPickingIndex] = useState<number | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const stage = type.stages.find((item) => item.id === job.stageId)
  const profilingStage = type.stages.find((item) => item.position === 1)
  const profilingLoss = profilingStage?.lossPercent ?? 20
  const m2AfterProfiling = job.quantityM2 * Math.max(0, 1 - profilingLoss / 100)
  const last = type.stages[type.stages.length - 1]
  const finishing = Boolean(stage && last && stage.id === last.id)
  const receipts = stage ? stageReceipts(stage, type, finishing) : []
  const visibleInputs = stage
    ? stage.inputs.filter((input) => inputAppliesToRelease(input, job.releaseType))
    : []
  const hasMoves = Boolean(stage && (visibleInputs.length > 0 || receipts.length > 0 || preview.length > 0))
  const pickingLine = pickingIndex != null ? preview[pickingIndex] : null
  const pickerOptions = useMemo(() => {
    if (!pickingLine) return []
    const query = pickerQuery.trim().toLowerCase()
    return (pickingLine.candidates ?? []).filter((item) => {
      if (!query) return true
      return item.productName.toLowerCase().includes(query) || item.unit.toLowerCase().includes(query)
    })
  }, [pickingLine, pickerQuery])

  useEffect(() => {
    void fetchJobWriteoffs(job.id).then(setHistory)
    if (job.status === 'ACTIVE') {
      void previewJobWriteoffs(job.id)
        .then(setPreview)
        .catch(() => setPreview([]))
    } else {
      setPreview([])
    }
    setPickingIndex(null)
    setPickerQuery('')
  }, [job.id, job.stageStatus, job.status, job.stageId])

  function selectWriteoffProduct(index: number, candidate: NonNullable<ProductionWriteoffPreview['candidates']>[number]) {
    setPreview((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              productId: candidate.productId,
              productName: candidate.productName,
              unit: candidate.unit || line.unit,
            }
          : line,
      ),
    )
    setPickingIndex(null)
    setPickerQuery('')
  }

  async function run(action: 'start' | 'complete' | 'rollback') {
    setBusy(true)
    setError(null)
    try {
      if (action === 'complete') {
        const missing = preview.find((line) => line.quantity > 0 && !line.productId)
        if (missing) {
          throw new Error(`Выберите товар для списания: ${missing.label ?? missing.productName}`)
        }
        const writeoffs = preview
          .filter((line) => line.productId && line.quantity > 0)
          .map((line) => ({ productId: line.productId, quantity: line.quantity }))
        onChanged(await completeProductionJob(job.id, writeoffs))
      } else if (action === 'rollback') {
        onChanged(await rollbackProductionJob(job.id))
      } else {
        onChanged(await startProductionJob(job.id))
      }
    } catch (err) {
      setError(err instanceof Error && err.message !== 'request_failed' ? err.message : 'Не удалось выполнить действие')
      setBusy(false)
    }
  }

  return (
    <Modal title={job.dealItem?.name ?? job.title} onClose={onClose} wide>
      <div className="mt-4 flex flex-col gap-3 text-sm">
        <p className="text-secondary">
          {formatBomQty(jobPrimaryQty(job, type))} {jobUnit(job, type)} · {RELEASE_TYPE_LABEL[job.releaseType]} ·{' '}
          {job.warehouse.name} · {jobStatusLabel(job)}
        </p>
        <p className="text-xs text-secondary">
          {job.packageCount != null ? `${formatBomQty(job.packageCount)} упак · ` : ''}
          Исходно {formatBomQty(job.quantityM2)} м² · после профиля {formatBomQty(m2AfterProfiling)} м²
          {job.pieceCount != null ? ` · ${formatBomQty(job.pieceCount)} шт` : ''}
          {stage && stage.position >= 3 && job.pieceCount != null
            ? ` → ${formatBomQty(jobPrimaryQty(job, type))} упак`
            : ''}
        </p>
        {job.deal ? <p className="text-secondary">Заказ: {job.deal.title}</p> : null}
        {job.status === 'ACTIVE' && stage ? (
          <div className="rounded-xl border border-line bg-white/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
              {job.stageStatus === 'TO_START' ? 'На этом этапе' : 'При выполнении этапа'}
            </p>
            {hasMoves ? (
              <div className="mt-3 flex flex-col gap-3">
                <div>
                  <p className="text-xs font-medium text-secondary">Списать со склада</p>
                  <p className="mt-0.5 text-[11px] text-secondary">Нажмите на строку, чтобы выбрать другой товар из остатков</p>
                  {preview.length > 0 ? (
                    <ul className="mt-1 flex flex-col gap-1">
                      {preview.map((line, index) => (
                        <li key={line.slotKey ?? `${line.productId}-${index}`}>
                          <button
                            type="button"
                            onClick={() => {
                              setPickingIndex(index)
                              setPickerQuery('')
                            }}
                            className="w-full rounded-md border border-transparent px-2 py-1.5 text-left text-foreground hover:border-line hover:bg-white/70"
                          >
                            <span className="font-medium">
                              {formatBomQty(line.quantity)} {line.unit}
                            </span>
                            {' · '}
                            {line.productName}
                            {line.groupName || line.label ? ` · ${line.groupName ?? line.label}` : ''}
                            <span className="mt-0.5 block text-[11px] text-secondary">Изменить</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : visibleInputs.length === 0 ? (
                    <p className="mt-1 text-secondary">Ничего</p>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-1">
                      {visibleInputs.map((input) => (
                        <li key={input.id} className="text-foreground">
                          {formatBomQty(
                            inputNeedQty(input, job, type, stage?.position ?? 0, profilingLoss),
                          )}{' '}
                          · {formatInputLabel(input)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-secondary">
                    Оприходовать на склад
                    {(stage.lossPercent ?? 0) > 0 ? ` (потери ${stage.lossPercent}%)` : ''}
                    {stage.position >= 3 ? ' · выход в упаковках' : ''}
                  </p>
                  {receipts.length === 0 ? (
                    <p className="mt-1 text-secondary">Ничего</p>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-1">
                      {receipts.map((output) => (
                        <li key={output.id} className="text-foreground">
                          {formatBomQty(receiptNeedQty(output, job, type, stage))}{' '}
                          {stage.position >= 3 ? 'упак' : output.product?.unit ?? ''} · {output.product?.name ?? ''}
                          {stage.position >= 3 && job.pieceCount != null
                            ? ` (из ${formatBomQty(job.pieceCount)} шт)`
                            : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-secondary">Проводок нет — переход на следующий этап</p>
            )}
          </div>
        ) : null}
        {history.length > 0 ? (
          <div className="rounded-xl border border-line bg-white/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">История списаний</p>
            <ul className="mt-2 flex flex-col gap-1">
              {history.map((item) => (
                <li key={item.id} className="text-foreground">
                  {new Date(item.createdAt).toLocaleString('ru-RU')} · {formatBomQty(item.quantity)} {item.product.unit} ·{' '}
                  {item.product.name}
                  {item.note ? ` · ${item.note}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {error ? <p className="text-destructive">{error}</p> : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {job.status === 'DONE' ? (
            <>
              <p className="mr-auto text-secondary">Продукция произведена и находится на складе</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run('rollback')}
                className="h-10 rounded-md border border-line px-4 text-sm font-medium text-secondary hover:text-foreground"
              >
                Откатить этап
              </button>
            </>
          ) : (
            <>
              {(job.stageStatus === 'IN_PROGRESS' ||
                (job.stageStatus === 'TO_START' && (stage?.position ?? 0) > 0)) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run('rollback')}
                  className="h-10 rounded-md border border-line px-4 text-sm font-medium text-secondary hover:text-foreground"
                >
                  Откатить
                </button>
              )}
              {job.stageStatus === 'TO_START' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run('start')}
                  className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary"
                >
                  Начать производство
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run('complete')}
                  className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary"
                >
                  Этап выполнен
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {pickingLine && pickingIndex != null ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={() => setPickingIndex(null)}>
          <div
            className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-line bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-line px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Выбор товара для списания</p>
              <p className="mt-1 text-xs text-secondary">
                Нужно {formatBomQty(pickingLine.quantity)} {pickingLine.unit}
                {pickingLine.label ? ` · ${pickingLine.label}` : ''}
              </p>
              <input
                autoFocus
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
                placeholder="Поиск по остаткам…"
                className="mt-3 h-10 w-full rounded-md border-2 border-slate-300 px-3 text-sm"
              />
            </div>
            <ul className="flex-1 overflow-y-auto p-2">
              {pickerOptions.length === 0 ? (
                <li className="px-3 py-4 text-sm text-secondary">Нет подходящих остатков</li>
              ) : (
                pickerOptions.map((item) => {
                  const enough = item.quantity + 1e-9 >= pickingLine.quantity
                  return (
                    <li key={item.productId}>
                      <button
                        type="button"
                        onClick={() => selectWriteoffProduct(pickingIndex, item)}
                        className="flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-foreground">{item.productName}</span>
                          <span className="block text-xs text-secondary">
                            Остаток {formatBomQty(item.quantity)} {item.unit}
                            {!enough ? ' · мало для списания' : ''}
                          </span>
                        </span>
                        {item.productId === pickingLine.productId ? (
                          <span className="shrink-0 text-xs font-medium text-primary">Выбран</span>
                        ) : null}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
            <div className="border-t border-line px-4 py-3 text-right">
              <button
                type="button"
                onClick={() => setPickingIndex(null)}
                className="h-9 rounded-md border border-line px-3 text-sm text-secondary hover:text-foreground"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
