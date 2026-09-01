export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="Faverum"
      className={className ?? 'h-7 w-auto'}
    />
  )
}
