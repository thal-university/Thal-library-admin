'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------- Class tokens
// Shared class strings so every page draws inputs, buttons and tables the same way.
export const ui = {
  input:
    'h-9 w-full rounded-xl border border-edge/80 bg-surface/70 px-3 text-[13px] text-ink outline-none transition placeholder:text-ink-muted/80 focus:border-brand-400 focus:bg-surface focus:ring-4 focus:ring-brand-500/15 disabled:opacity-60',
  textarea:
    'w-full rounded-xl border border-edge/80 bg-surface/70 px-3 py-2 text-[13px] text-ink outline-none transition placeholder:text-ink-muted/80 focus:border-brand-400 focus:bg-surface focus:ring-4 focus:ring-brand-500/15',
  label: 'mb-1 block text-[12px] font-medium text-ink-soft',
  btnPrimary:
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(238,122,26,0.7)] transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60',
  btnSecondary:
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-edge/90 bg-surface/70 px-3.5 text-[13px] font-semibold text-ink-soft transition hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60',
  btnDanger:
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(225,29,72,0.6)] transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:cursor-not-allowed disabled:opacity-60',
  btnSuccess:
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(5,150,105,0.6)] transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-60',
  // Small square icon button for table rows
  iconBtn:
    'grid size-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-50',
  // Tables sit inside a GlassCard; the header row is sticky inside its scroll area
  table: 'w-full text-[13px]',
  thead: 'sticky top-0 z-10 bg-white/80 backdrop-blur-md',
  th: 'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted border-b border-glass-line',
  tr: 'border-b border-glass-line transition-colors hover:bg-surface/60',
  td: 'px-3 py-2.5 text-ink-soft',
}

// ---------------------------------------------------------------- Surfaces
// index drives the staggered entrance animation (see .rise in globals.css)
export function GlassCard({ className, children, index, style, strong = false, ...props }) {
  return (
    <div
      className={cn(strong ? 'glass-strong' : 'glass', 'rounded-[18px]', index != null && 'rise', className)}
      style={index != null ? { '--i': index, ...style } : style}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, className, children }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-4 pt-3.5 pb-2', className)}>
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold leading-tight text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[11.5px] text-ink-muted">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  )
}

export function PageHeader({ title, description, children }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-heading">{title}</h1>
        {description ? <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, hint, className, children }) {
  return (
    <div className={cn('flex flex-1 flex-col items-center justify-center px-6 py-10 text-center', className)}>
      {Icon ? (
        <div className="mb-2.5 grid size-10 place-items-center rounded-xl bg-surface/80 text-ink-muted shadow-[0_4px_12px_-6px_rgba(30,50,90,0.25)] ring-1 ring-edge">
          <Icon className="size-[18px]" aria-hidden="true" />
        </div>
      ) : null}
      <p className="text-[13px] font-semibold text-ink-soft">{title}</p>
      {hint ? <p className="mt-0.5 max-w-[18rem] text-[11.5px] text-ink-muted">{hint}</p> : null}
      {children}
    </div>
  )
}

// Stat tile: icon chip, big number, label
export function StatCard({ icon: Icon, label, value, hint, tone = 'brand', index }) {
  const chip = {
    brand: 'bg-[linear-gradient(135deg,#f9a24f,#dd6b12)] shadow-[0_8px_18px_-8px_rgba(221,107,18,0.8)]',
    navy: 'bg-[linear-gradient(135deg,#2b3a63,#16203b)] shadow-[0_8px_18px_-8px_rgba(22,32,59,0.8)]',
    success: 'bg-[linear-gradient(135deg,#34d399,#059669)] shadow-[0_8px_18px_-8px_rgba(5,150,105,0.8)]',
    danger: 'bg-[linear-gradient(135deg,#fb7185,#e11d48)] shadow-[0_8px_18px_-8px_rgba(225,29,72,0.7)]',
    info: 'bg-[linear-gradient(135deg,#60a5fa,#2563eb)] shadow-[0_8px_18px_-8px_rgba(37,99,235,0.7)]',
  }[tone]
  return (
    <GlassCard index={index} className="lift flex items-center gap-3 p-3.5">
      {Icon ? (
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl text-white', chip)}>
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="text-[11.5px] font-medium text-ink-muted">{label}</p>
        <p className="text-xl font-bold leading-tight tabular-nums text-heading">{value}</p>
        {hint ? <p className="truncate text-[11px] text-ink-muted">{hint}</p> : null}
      </div>
    </GlassCard>
  )
}

// Tinted status pill with a dot. tone: success | warning | info | danger | neutral | brand
const TONES = {
  success: 'bg-emerald-500/10 text-emerald-700 [--dot:var(--color-emerald-500)]',
  warning: 'bg-amber-500/12 text-amber-700 [--dot:var(--color-amber-500)]',
  info: 'bg-sky-500/10 text-sky-700 [--dot:var(--color-sky-500)]',
  danger: 'bg-rose-500/10 text-rose-700 [--dot:var(--color-rose-500)]',
  neutral: 'bg-slate-500/10 text-slate-600 [--dot:var(--color-slate-400)]',
  brand: 'bg-brand-500/10 text-brand-700 [--dot:var(--brand-500)]',
}

export function Pill({ tone = 'neutral', pulse = false, children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-semibold leading-none',
        TONES[tone],
        className
      )}
    >
      <span className="relative flex size-1.5">
        {pulse ? <span className="ping-soft absolute inset-0 rounded-full bg-[var(--dot)]" /> : null}
        <span className="relative size-1.5 rounded-full bg-[var(--dot)]" />
      </span>
      {children}
    </span>
  )
}

// ---------------------------------------------------------------- Modal
// Frosted dialog. Closes on Escape and backdrop click.
export function Modal({ open = true, onClose, title, subtitle, icon: Icon, size = 'md', children, footer }) {
  useEffect(() => {
    if (!open || !onClose) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fade-in absolute inset-0 bg-navy-900/30 backdrop-blur-[3px]"
      />
      <div className={cn('glass-strong pop-in relative flex max-h-[90vh] w-full flex-col rounded-[22px]', width)}>
        {title ? (
          <div className="flex items-start gap-3 border-b border-glass-line px-5 py-3.5">
            {Icon ? (
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
                <Icon className="size-[18px]" aria-hidden="true" />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-semibold text-heading">{title}</h2>
              {subtitle ? <p className="mt-0.5 text-[12px] text-ink-muted">{subtitle}</p> : null}
            </div>
            {onClose ? (
              <button type="button" onClick={onClose} className={ui.iconBtn} aria-label="Close">
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-glass-line px-5 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}
