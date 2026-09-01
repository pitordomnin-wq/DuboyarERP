/** Soft abstract wash placed in the same stacking context as glass surfaces so backdrop-filter can sample it. */
export function PageWash() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -left-[15%] top-[42%] h-[65vh] w-[55vw] rounded-full bg-[#4a90b0]/26 blur-3xl" />
      <div className="absolute -right-[15%] top-[55%] h-[60vh] w-[55vw] rounded-full bg-[#3a80a6]/22 blur-3xl" />
      <div className="absolute -bottom-[25%] left-[15%] h-[55vh] w-[65vw] rounded-full bg-[#5c9ec2]/24 blur-3xl" />
      <div className="absolute top-[8%] right-[8%] h-[42vh] w-[32vw] rounded-full bg-[#e39421]/12 blur-3xl" />
    </div>
  )
}
