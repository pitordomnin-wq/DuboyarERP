import type { FormEvent, ReactNode } from 'react'
import type { Counterparty, CounterpartyInput } from '@/lib/counterparties-api'

const inputClass =
  'h-10 w-full rounded-md border-2 border-slate-300 bg-white px-3 text-sm text-foreground outline-none focus:border-slate-500'

const areaClass =
  'w-full resize-none rounded-md border-2 border-slate-300 bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-slate-500'

function Field({
  label,
  name,
  defaultValue,
  required,
  placeholder,
}: {
  label: string
  name: string
  defaultValue?: string | null
  required?: boolean
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-secondary">
      {label}
      <input
        name={name}
        required={required}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        className={inputClass}
      />
    </label>
  )
}

export function CounterpartyForm({
  initial,
  busy,
  error,
  submitLabel,
  extra,
  onSubmit,
}: {
  initial?: Counterparty
  busy: boolean
  error: string | null
  submitLabel: string
  extra?: ReactNode
  onSubmit: (input: CounterpartyInput) => void
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const read = (key: string) => String(data.get(key) ?? '').trim()
    onSubmit({
      name: read('name'),
      legalName: read('legalName'),
      inn: read('inn'),
      kpp: read('kpp'),
      ogrn: read('ogrn'),
      legalAddress: read('legalAddress'),
      actualAddress: read('actualAddress'),
      bankName: read('bankName'),
      bik: read('bik'),
      checkingAccount: read('checkingAccount'),
      correspondentAccount: read('correspondentAccount'),
      email: read('email'),
      phone: read('phone'),
      telegram: read('telegram'),
      contactName: read('contactName'),
      notes: read('notes'),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <section className="grid gap-3 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-sm font-semibold text-foreground">Юридические данные</h2>
        <Field label="Наименование" name="name" required defaultValue={initial?.name} />
        <Field label="Полное наименование" name="legalName" required defaultValue={initial?.legalName} />
        <Field label="ИНН" name="inn" required defaultValue={initial?.inn} placeholder="10 или 12 цифр" />
        <Field label="КПП" name="kpp" defaultValue={initial?.kpp} placeholder="9 цифр" />
        <Field label="ОГРН / ОГРНИП" name="ogrn" defaultValue={initial?.ogrn} />
        <div className="sm:col-span-2">
          <Field label="Юридический адрес" name="legalAddress" required defaultValue={initial?.legalAddress} />
        </div>
        <div className="sm:col-span-2">
          <Field label="Фактический адрес" name="actualAddress" defaultValue={initial?.actualAddress} />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-sm font-semibold text-foreground">Банк</h2>
        <div className="sm:col-span-2">
          <Field label="Банк" name="bankName" defaultValue={initial?.bankName} />
        </div>
        <Field label="БИК" name="bik" defaultValue={initial?.bik} placeholder="9 цифр" />
        <Field label="Расчётный счёт" name="checkingAccount" defaultValue={initial?.checkingAccount} />
        <div className="sm:col-span-2">
          <Field label="Корреспондентский счёт" name="correspondentAccount" defaultValue={initial?.correspondentAccount} />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-sm font-semibold text-foreground">Контакты</h2>
        <Field label="Email" name="email" required defaultValue={initial?.email} />
        <Field label="Telegram" name="telegram" defaultValue={initial?.telegram} placeholder="без @" />
        <Field label="Телефон" name="phone" defaultValue={initial?.phone} />
        <Field label="Контактное лицо" name="contactName" defaultValue={initial?.contactName} />
        <label className="sm:col-span-2 flex flex-col gap-1 text-xs font-medium text-secondary">
          Комментарий
          <textarea name="notes" rows={3} defaultValue={initial?.notes ?? ''} className={areaClass} />
        </label>
      </section>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {extra}
        <button
          type="submit"
          disabled={busy}
          className="ml-auto h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
