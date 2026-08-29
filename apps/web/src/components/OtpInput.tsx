import { useEffect, useRef, type KeyboardEvent, type ClipboardEvent } from 'react'

type OtpInputProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  error?: boolean
}

export function OtpInput({ value, onChange, disabled, error }: OtpInputProps) {
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '')
  const refs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    refs.current[0]?.focus()
  }, [])

  function setDigit(index: number, char: string) {
    const next = digits.slice()
    next[index] = char
    onChange(next.join('').slice(0, 6))
  }

  function handleChange(index: number, raw: string) {
    const char = raw.replace(/\D/g, '').slice(-1)
    if (!char) {
      setDigit(index, '')
      return
    }
    setDigit(index, char)
    refs.current[index + 1]?.focus()
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus()
      setDigit(index - 1, '')
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus()
    }
    if (event.key === 'ArrowRight' && index < 5) {
      refs.current[index + 1]?.focus()
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    onChange(pasted)
    refs.current[Math.min(pasted.length, 5)]?.focus()
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Код из шести цифр">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node
          }}
          id={index === 0 ? 'otp-0' : undefined}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={digit}
          aria-label={`Цифра ${index + 1}`}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          className={`h-14 w-11 rounded-lg border bg-white text-center text-lg font-medium text-foreground outline-none transition-[border-color,box-shadow] duration-200 sm:w-12 ${
            error
              ? 'border-destructive focus:border-destructive focus:shadow-[0_0_0_3px_rgba(220,38,38,0.12)]'
              : 'border-border focus:border-primary focus:shadow-[0_0_0_3px_rgba(15,23,42,0.12)]'
          }`}
        />
      ))}
    </div>
  )
}
