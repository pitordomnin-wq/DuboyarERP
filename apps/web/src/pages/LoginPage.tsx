import { useState, type FormEvent } from 'react'
import { requestOtp, verifyOtp } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { OtpInput } from '@/components/OtpInput'

type Step = 'email' | 'code'

export function LoginPage() {
  const { setUser } = useAuth()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submitEmail(event: FormEvent) {
    event.preventDefault()
    const nextEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setError('Проверьте адрес почты')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await requestOtp(nextEmail)
      setEmail(nextEmail)
      setCode('')
      setStep('code')
    } catch {
      setError('Не удалось продолжить')
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault()
    if (code.length !== 6) {
      setError('Введите код полностью')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { user } = await verifyOtp(email, code)
      setUser(user)
    } catch {
      setError('Неверный код')
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  async function requestAgain() {
    setBusy(true)
    setError(null)
    try {
      await requestOtp(email)
      setCode('')
    } catch {
      setError('Не удалось продолжить')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="px-6 py-5">
        <p className="text-[15px] font-semibold tracking-[-0.03em] text-foreground">Faverum</p>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 pt-[18vh] sm:pt-[22vh]">
        <div className="w-full max-w-[360px]">
          {step === 'email' ? (
            <form onSubmit={submitEmail} className="flex flex-col gap-8">
              <div>
                <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em] text-foreground">
                  Вход
                </h1>
                <p className="mt-2 text-sm leading-6 text-secondary">По почте организации</p>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-[13px] font-medium text-secondary">
                  Почта
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={email}
                  disabled={busy}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setError(null)
                  }}
                  className="h-12 rounded-lg border border-border bg-white px-3.5 text-[16px] text-foreground outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary focus:shadow-[0_0_0_3px_rgba(15,23,42,0.12)]"
                />
              </div>

              {error ? (
                <p className="-mt-4 text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="h-12 rounded-lg bg-primary text-sm font-semibold text-on-primary transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
              >
                {busy ? 'Подождите' : 'Продолжить'}
              </button>
            </form>
          ) : (
            <form onSubmit={submitCode} className="flex flex-col gap-8">
              <div>
                <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em] text-foreground">
                  Код
                </h1>
                <button
                  type="button"
                  className="mt-2 text-sm text-secondary transition-colors duration-200 hover:text-foreground"
                  onClick={() => {
                    setStep('email')
                    setCode('')
                    setError(null)
                  }}
                >
                  {email}
                </button>
              </div>

              <OtpInput
                value={code}
                disabled={busy}
                error={Boolean(error)}
                onChange={(value) => {
                  setCode(value)
                  setError(null)
                }}
              />

              {error ? (
                <p className="-mt-4 text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="h-12 rounded-lg bg-primary text-sm font-semibold text-on-primary transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
              >
                {busy ? 'Подождите' : 'Войти'}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={requestAgain}
                className="text-sm text-secondary transition-colors duration-200 hover:text-foreground disabled:opacity-60"
              >
                Запросить код ещё раз
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
