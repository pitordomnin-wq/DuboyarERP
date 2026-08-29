import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/tasks/TaskModal'
import {
  STAGE_STATUS_LABEL,
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
      <aside className="flex shrink-0 flex-col border-b-2 border-slate-300 md:h-full md:w-72 md:overflow-hidden md:border-r-2 md:border-b-0">
        <div className="shrink-0 px-4 py-3 md:px-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Продукция</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto md:px-2">
          {types.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveId(item.id)}
              className={`min-w-[220px] shrink-0 rounded-md px-3 py-2 text-left md:min-w-0 ${
                item.id === activeId ? 'bg-slate-200 text-foreground' : 'text-secondary hover:bg-slate-100'
              }`}
            >
              <p className="text-sm font-medium">{item.name}</p>
              <p className="mt-0.5 text-xs text-secondary">{item.stages.length} этап(ов)</p>
            </button>
          ))}
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
                  className="flex h-full w-[300px] shrink-0 flex-col rounded-lg border-2 border-slate-300 bg-slate-100"
                >
                  <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b-2 border-slate-300 px-3">
                    <h2 className="whitespace-nowrap text-sm font-semibold text-foreground">{stage.name}</h2>
                    <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-xs tabular-nums text-secondary">
                      {grouped.get(stage.id)?.length ?? 0}
                    </span>
                  </header>
                  <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2">
                    {(grouped.get(stage.id) ?? []).map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => setOpened(job)}
                        className="shrink-0 rounded-md border border-slate-300 bg-white p-3 text-left"
                      >
                        <p className="text-sm font-medium text-foreground">{job.dealItem?.name ?? job.title}</p>
                        <p className="mt-1 text-xs text-secondary">
                          {job.quantity.toLocaleString('ru-RU')} шт · {jobStatusLabel(job)}
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

function jobStatusLabel(job: ProductionJob) {
  if (job.status === 'DONE') return 'Продукция на складе'
  return STAGE_STATUS_LABEL[job.stageStatus]
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
  const last = type.stages[type.stages.length - 1]
  const finishing = Boolean(stage && last && stage.id === last.id)

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
          {job.quantity.toLocaleString('ru-RU')} шт · {job.warehouse.name} · {jobStatusLabel(job)}
        </p>
        {job.deal ? <p className="text-secondary">Заказ: {job.deal.title}</p> : null}
        {job.status === 'ACTIVE' && job.stageStatus === 'IN_PROGRESS' && stage ? (
          <div className="rounded-md border-2 border-slate-300 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">При выполнении этапа</p>
            {stage.inputs.length === 0 && !stage.outputProduct && !finishing ? (
              <p className="mt-2 text-secondary">Проводок нет — переход на следующий этап</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1">
                {stage.inputs.map((input) => (
                  <li key={input.id} className="text-foreground">
                    Списать {(input.quantity * job.quantity).toLocaleString('ru-RU')} {input.product.unit} · {input.product.name}
                  </li>
                ))}
                {stage.outputProduct || finishing ? (
                  <li className="text-foreground">
                    Оприходовать {job.quantity.toLocaleString('ru-RU')} шт
                    {stage.outputProduct ? ` · ${stage.outputProduct.name}` : ' · готовая продукция'}
                  </li>
                ) : null}
              </ul>
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
