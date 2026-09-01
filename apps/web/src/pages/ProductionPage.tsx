import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/tasks/TaskModal'
import {
  STAGE_STATUS_LABEL,
  RELEASE_TYPE_LABEL,
  completeProductionJob,
  fetchProductionJobs,
  fetchProductionType,
  fetchProductionTypes,
  startProductionJob,
  type ProductionJob,
  type ProductionType,
  type ProductionTypeSummary,
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
                          {job.quantity.toLocaleString('ru-RU')} {jobUnit(job, detail)} · {jobStatusLabel(job)}
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
  const stage = type?.stages.find((item) => item.id === job.stageId)
  return job.dealItem?.unit ?? stage?.outputs[0]?.product?.unit ?? type?.product.unit ?? 'шт'
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
  const stage = type.stages.find((item) => item.id === job.stageId)
  const profilingStage = type.stages.find((item) => item.position === 1)
  const profilingLoss = profilingStage?.lossPercent ?? 20
  const m2AfterProfiling = job.quantityM2 * Math.max(0, 1 - profilingLoss / 100)
  const last = type.stages[type.stages.length - 1]
  const finishing = Boolean(stage && last && stage.id === last.id)
  const receipts = stage ? stageReceipts(stage, type, finishing) : []
  const hasMoves = Boolean(stage && (stage.inputs.length > 0 || receipts.length > 0))

  async function run(action: 'start' | 'complete') {
    setBusy(true)
    setError(null)
    try {
      onChanged(action === 'start' ? await startProductionJob(job.id) : await completeProductionJob(job.id))
    } catch (err) {
      setError(err instanceof Error && err.message !== 'request_failed' ? err.message : 'Не удалось выполнить действие')
      setBusy(false)
    }
  }

  return (
    <Modal title={job.dealItem?.name ?? job.title} onClose={onClose} wide>
      <div className="mt-4 flex flex-col gap-3 text-sm">
        <p className="text-secondary">
          {formatBomQty(job.quantity)} {jobUnit(job, type)} · {RELEASE_TYPE_LABEL[job.releaseType]} ·{' '}
          {job.warehouse.name} · {jobStatusLabel(job)}
        </p>
        <p className="text-xs text-secondary">
          Исходно {formatBomQty(job.quantityM2)} м² · после профиля {formatBomQty(m2AfterProfiling)} м²
          {job.pieceCount != null ? ` · ${formatBomQty(job.pieceCount)} шт` : ''}
          {job.packageCount != null ? ` · ${formatBomQty(job.packageCount)} упак` : ''}
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
                  {stage.inputs.length === 0 ? (
                    <p className="mt-1 text-secondary">Ничего</p>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-1">
                      {stage.inputs.map((input) => (
                        <li key={input.id} className="text-foreground">
                          {formatBomQty(input.quantity * job.quantity)}{' '}
                          {input.productGroup
                            ? `· группа «${input.productGroup.name}» (FIFO)`
                            : `${input.product?.unit ?? ''} · ${input.product?.name ?? ''}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-secondary">
                    Оприходовать на склад
                    {(stage.lossPercent ?? 0) > 0 ? ` (потери ${stage.lossPercent}%)` : ''}
                  </p>
                  {receipts.length === 0 ? (
                    <p className="mt-1 text-secondary">Ничего</p>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-1">
                      {receipts.map((output) => {
                        const factor = Math.max(0, 1 - (stage.lossPercent ?? 0) / 100)
                        return (
                          <li key={output.id} className="text-foreground">
                            {formatBomQty(output.quantity * job.quantity * factor)} {output.product?.unit ?? ''} ·{' '}
                            {output.product?.name ?? ''}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-secondary">Проводок нет — переход на следующий этап</p>
            )}
          </div>
        ) : null}
        {error ? <p className="text-destructive">{error}</p> : null}
        <div className="flex justify-end">
          {job.status === 'DONE' ? (
            <p className="text-secondary">Продукция произведена и находится на складе</p>
          ) : job.stageStatus === 'TO_START' ? (
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
        </div>
      </div>
    </Modal>
  )
}
