import { useRef, useState, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { Modal } from '@/components/tasks/TaskModal'
import { UserAvatar, CompanyLogo } from '@/components/UserAvatar'
import { deleteAvatar, updateProfile, uploadAvatar, type SessionUser } from '@/lib/api'

type Tab = 'info' | 'signature'

export function UserSettings({
  user,
  onClose,
  onSaved,
}: {
  user: SessionUser
  onClose: () => void
  onSaved: (user: SessionUser) => void
}) {
  const [tab, setTab] = useState<Tab>('info')
  const [mailSignature, setMailSignature] = useState(user.mailSignature ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function saveSignature(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      onSaved(await updateProfile({ mailSignature }))
      setNotice('Подпись сохранена')
    } catch {
      setError('Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  async function onPick(list: FileList | null) {
    const file = list?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Нужен JPG, PNG, WEBP или GIF')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      onSaved(await uploadAvatar(file))
      setNotice('Аватарка обновлена')
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      setError(code === 'file_too_large' ? 'Файл больше 4 МБ' : 'Не удалось загрузить фото')
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function onRemoveAvatar() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      onSaved(await deleteAvatar())
      setNotice('Аватарка удалена')
    } catch {
      setError('Не удалось удалить фото')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Настройки" onClose={onClose} wide="xl">
      <div className="mt-4 flex min-h-[26rem] flex-col gap-4 md:flex-row md:gap-0">
        <nav className="flex gap-1 overflow-x-auto md:w-48 md:shrink-0 md:flex-col md:border-r md:border-line md:pr-4">
          <TabButton active={tab === 'info'} onClick={() => setTab('info')}>
            Информация
          </TabButton>
          <TabButton active={tab === 'signature'} onClick={() => setTab('signature')}>
            Подпись
          </TabButton>
        </nav>

        <div className="min-w-0 flex-1 md:pl-6">
          {tab === 'info' ? (
            <div className="flex flex-col gap-6">
              <section className="flex items-start gap-5">
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(event) => void onPick(event.target.files)}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    aria-label="Сменить аватарку"
                    title="Сменить аватарку"
                    onClick={() => fileInput.current?.click()}
                    className="group relative h-24 w-24 overflow-hidden rounded-full disabled:opacity-60"
                  >
                    <UserAvatar
                      id={user.id}
                      name={user.name}
                      hasAvatar={user.hasAvatar}
                      version={user.avatarAt}
                      size={96}
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-foreground/50 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                      <Pencil size={22} strokeWidth={1.75} />
                    </span>
                  </button>
                  {user.hasAvatar ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onRemoveAvatar()}
                      className="text-xs text-secondary hover:text-foreground disabled:opacity-60"
                    >
                      Убрать
                    </button>
                  ) : null}
                </div>
                <div className="min-w-0 pt-1">
                  <p className="text-xs font-medium text-secondary">Пользователь</p>
                  <p className="mt-0.5 text-lg font-semibold tracking-[-0.03em] text-foreground">{user.name}</p>
                  <p className="mt-1 text-sm text-secondary">{user.email}</p>
                  <p className="mt-3 text-xs font-medium text-secondary">Должность</p>
                  <p className="mt-0.5 text-sm text-foreground">{user.jobTitle?.trim() || 'Не указана'}</p>
                </div>
              </section>

              <section className="flex items-start gap-5 border-t-2 border-slate-300 pt-6">
                <CompanyLogo
                  name={user.organization.name}
                  hasLogo={user.organization.hasLogo}
                  version={user.organization.logoAt}
                  size={96}
                />
                <div className="min-w-0 pt-1">
                  <p className="text-xs font-medium text-secondary">Компания</p>
                  <p className="mt-0.5 text-base font-semibold tracking-[-0.03em] text-foreground">
                    {user.organization.name}
                  </p>
                  {user.organization.address ? (
                    <p className="mt-2 text-sm leading-6 text-secondary">{user.organization.address}</p>
                  ) : (
                    <p className="mt-2 text-sm text-secondary">Адрес не указан</p>
                  )}
                  <p className="mt-2 text-sm text-secondary">
                    {[user.organization.phone, user.organization.email].filter(Boolean).join(' · ') ||
                      'Контакты не указаны'}
                  </p>
                </div>
              </section>
            </div>
          ) : null}

          {tab === 'signature' ? (
            <form onSubmit={(event) => void saveSignature(event)} className="flex flex-col gap-3">
              <p className="text-sm text-secondary">Добавляется в конец исходящих писем.</p>
              <textarea
                value={mailSignature}
                onChange={(event) => setMailSignature(event.target.value)}
                rows={8}
                maxLength={2000}
                className="w-full rounded-md border-2 border-slate-300 px-3 py-2 text-sm text-foreground"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
                >
                  Сохранить
                </button>
              </div>
            </form>
          ) : null}

          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          {notice ? <p className="mt-4 text-sm text-secondary">{notice}</p> : null}
        </div>
      </div>
    </Modal>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-left text-sm ${
        active ? 'bg-white/60 font-medium text-foreground' : 'text-secondary hover:bg-white/35'
      }`}
    >
      {children}
    </button>
  )
}
