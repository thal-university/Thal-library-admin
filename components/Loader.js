'use client'
import Image from 'next/image'

// Emblem inside a spinning brand ring, on a frosted card.
// Full-screen by default; `inline` fills the dashboard content area instead.
export default function Loader({ label = 'Loading library…', inline = false }) {
  return (
    <div className={inline ? 'flex flex-1 items-center justify-center' : 'fixed inset-0 z-50 flex items-center justify-center'}>
      <div className="glass-strong pop-in flex flex-col items-center gap-3 rounded-3xl px-8 py-6">
        <div className="relative grid size-16 place-items-center">
          <span className="absolute inset-0 rounded-full border-[3px] border-ink/10" />
          <span
            className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-brand-500"
            style={{ animationDuration: '0.8s' }}
          />
          <Image src="/tub-emblem.png" alt="" width={34} height={34} priority />
        </div>
        <p className="text-[13px] font-medium text-ink-soft">{label}</p>
      </div>
    </div>
  )
}
