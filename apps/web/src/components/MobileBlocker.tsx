import { BrandLogo } from '@/components/BrandLogo'

export function MobileBlocker() {
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-6 text-center md:hidden"
      style={{
        backgroundColor: '#eef2f5',
        backgroundImage:
          'radial-gradient(70vw 40vh at 20% 100%, rgba(74, 144, 176, 0.36), transparent 70%),' +
          'radial-gradient(70vw 40vh at 80% 100%, rgba(58, 128, 166, 0.3), transparent 70%),' +
          'radial-gradient(70vw 40vh at 50% 0%, rgba(227, 148, 33, 0.14), transparent 74%),' +
          'linear-gradient(180deg, #f5f7f9 0%, #e8eef1 100%)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-[10%] left-1/2 h-[55vh] w-[85vw] -translate-x-1/2 rounded-full bg-[#4a90b0]/28 blur-3xl" />
        <div className="absolute -bottom-[10%] left-1/2 h-[50vh] w-[85vw] -translate-x-1/2 rounded-full bg-[#3a80a6]/24 blur-3xl" />
      </div>

      <div className="glass-strong relative z-10 flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl px-6 py-9">
        <BrandLogo className="h-9 w-auto" />
        <div className="flex flex-col items-center gap-1.5">
          <h1 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
            Мобильная версия в разработке
          </h1>
          <p className="text-sm leading-6 text-secondary">
            Пожалуйста, откройте Faverum с компьютера или планшета
          </p>
        </div>
      </div>
    </div>
  )
}
