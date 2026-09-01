import { useState, type FormEvent } from 'react'
import { requestOtp, verifyOtp } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { BrandLogo } from '@/components/BrandLogo'
import { OtpInput } from '@/components/OtpInput'
import { PageWash } from '@/components/PageWash'

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
    <div className="relative flex min-h-dvh flex-col bg-transparent">
      <PageWash />
      <header className="relative px-6 py-5">
        <BrandLogo />
      </header>

      <main className="relative flex flex-1 items-start justify-center px-6 pt-[14vh] sm:pt-[18vh]">
        <div className="glass-strong w-full max-w-[400px] rounded-3xl p-7 sm:p-8">
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
                  placeholder="you@company.ru"
                  value={email}
                  disabled={busy}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setError(null)
                  }}
                  className="h-12 rounded-xl border-2 border-slate-300 bg-white px-3.5 text-[16px] text-foreground outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-secondary/70 focus:border-foreground focus:shadow-[0_0_0_3px_rgba(28,36,48,0.08)]"
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
                className="h-12 rounded-xl bg-primary text-sm font-semibold text-on-primary transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
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
                className="h-12 rounded-xl bg-primary text-sm font-semibold text-on-primary transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
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
