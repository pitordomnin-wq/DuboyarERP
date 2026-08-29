import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CounterpartyForm } from '@/components/counterparties/CounterpartyForm'
import {
  createCounterparty,
  deleteCounterparty,
  fetchCounterparty,
  updateCounterparty,
  type Counterparty,
  type CounterpartyInput,
} from '@/lib/counterparties-api'

export function CounterpartyNewPage() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(input: CounterpartyInput) {
    setBusy(true)
    setError(null)
    try {
      const created = await createCounterparty(input)
      navigate(`/counterparties/${created.id}`, { replace: true })
    } catch {
      setError('Не удалось сохранить. Проверьте ИНН и обязательные поля.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormLayout title="Новый контрагент">
      <CounterpartyForm busy={busy} error={error} submitLabel="Создать" onSubmit={onSubmit} />
    </FormLayout>
  )
}

export function CounterpartyEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState<Counterparty | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetchCounterparty(id).then(setItem).catch(() => navigate('/counterparties', { replace: true }))
  }, [id, navigate])

  async function onSubmit(input: CounterpartyInput) {
    if (!id) return
    setBusy(true)
    setError(null)
    try {
      const saved = await updateCounterparty(id, input)
      setItem(saved)
    } catch {
      setError('Не удалось сохранить. Возможно, такой ИНН уже есть.')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!id) return
    if (!window.confirm('Удалить контрагента?')) return
    await deleteCounterparty(id)
    navigate('/counterparties', { replace: true })
  }

  if (!item) {
    return <p className="px-4 py-8 text-sm text-secondary">Загрузка</p>
  }

  return (
    <FormLayout title={item.name}>
      <CounterpartyForm
        initial={item}
        busy={busy}
        error={error}
        submitLabel="Сохранить"
        onSubmit={onSubmit}
        extra={
          <button
            type="button"
            onClick={() => void onDelete()}
            className="h-10 text-sm text-secondary hover:text-destructive"
          >
            Удалить
          </button>
        }
      />
    </FormLayout>
  )
}

function FormLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-auto px-4 py-5 md:px-8">
      <Link to="/counterparties" className="text-sm text-secondary hover:text-foreground">
        ← К списку
      </Link>
      <h1 className="mt-3 mb-6 text-xl font-semibold tracking-[-0.03em] text-foreground">{title}</h1>
      {children}
    </div>
  )
}
