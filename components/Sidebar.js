'use client'
import { useLayoutEffect, useRef } from 'react'
import Link from 'next/link'
import { BookMarked, CheckCheck, FileSearch, LayoutDashboard, Library, LogOut, Settings, Wallet, X } from 'lucide-react'
import Logo from '@/components/ui/Logo'
import { cn, initials } from '@/lib/utils'

export const NAVIGATION = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Books', href: '/dashboard/books', icon: Library },
  { name: 'Reservations', href: '/dashboard/reservations', icon: BookMarked },
  { name: 'Completed', href: '/dashboard/completed-reservations', icon: CheckCheck },
  { name: 'Overall Record', href: '/dashboard/records', icon: FileSearch },
  { name: 'Fine Records', href: '/dashboard/fines', icon: Wallet },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

// /dashboard only matches itself; every other item also owns its sub-paths
export const isActive = (pathname, href) =>
  href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

const PILL_MOTION = '[transition:transform_520ms_var(--ease-spring),height_520ms_var(--ease-spring),opacity_220ms_var(--ease-out)]'

export default function Sidebar({ pathname, user, onLogout, onClose }) {
  return (
    <nav className="glass-strong flex h-full flex-col rounded-[20px] p-2.5" aria-label="Main">
      <div className="flex items-center justify-between px-1.5 pt-1 pb-3">
        <Logo size="sm" />
        {onClose ? (
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface/80 hover:text-ink"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="mx-2 mb-2.5 h-px bg-gradient-to-r from-transparent via-ink/10 to-transparent" />

      <SidebarNav pathname={pathname} onNavigate={onClose} />

      <div className="pt-2.5">
        <div className="flex items-center gap-2.5 rounded-2xl bg-surface/50 p-2 ring-1 ring-edge/80">
          <Avatar name={user.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold leading-tight text-ink">{user.name}</p>
            <p className="truncate text-[11px] leading-tight text-ink-muted">Administrator</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="grid size-8 place-items-center rounded-lg text-ink-muted transition-colors duration-200 hover:bg-surface hover:text-danger"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </nav>
  )
}

function SidebarNav({ pathname, onNavigate }) {
  const hoverRef = useRef(null)
  const activeRef = useRef(null)
  const links = useRef(new Map())
  const activeHref = NAVIGATION.find((item) => isActive(pathname, item.href))?.href

  // Place a pill over a link. When the pill is hidden it appears in place
  // (fade only); when visible it springs to the new row.
  function place(pill, link, { instant }) {
    if (instant) pill.style.transition = 'none'
    pill.style.transform = `translate3d(0, ${link.offsetTop}px, 0)`
    pill.style.height = `${link.offsetHeight}px`
    if (instant) {
      void pill.offsetHeight // commit position before re-enabling motion
      pill.style.transition = ''
    }
  }

  useLayoutEffect(() => {
    const pill = activeRef.current
    const link = links.current.get(activeHref)
    if (!pill) return
    if (!link) {
      pill.style.opacity = '0'
      return
    }
    place(pill, link, { instant: pill.dataset.ready !== '1' })
    pill.style.opacity = '1'
    pill.dataset.ready = '1'
  }, [activeHref])

  function showHover(href) {
    const pill = hoverRef.current
    const link = links.current.get(href)
    if (!pill || !link) return
    if (href === activeHref) return hideHover()
    place(pill, link, { instant: pill.dataset.shown !== '1' })
    pill.style.opacity = '1'
    pill.dataset.shown = '1'
  }

  function hideHover() {
    const pill = hoverRef.current
    if (!pill) return
    pill.style.opacity = '0'
    pill.dataset.shown = '0'
  }

  return (
    <div className="scroll-quiet relative min-h-0 flex-1 overflow-y-auto px-0.5" onMouseLeave={hideHover}>
      {/* Hover pill (frosted) */}
      <span
        ref={hoverRef}
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-0.5 top-0 rounded-xl opacity-0',
          'bg-surface/85 shadow-[0_6px_16px_-10px_rgba(30,50,90,0.35)] ring-1 ring-edge',
          PILL_MOTION
        )}
      />
      {/* Active pill (brand gradient) */}
      <span
        ref={activeRef}
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-0.5 top-0 overflow-hidden rounded-xl opacity-0',
          'bg-[linear-gradient(135deg,#f9a24f_0%,#ee7a1a_55%,#e06d14_100%)]',
          'shadow-[0_10px_24px_-10px_rgba(238,122,26,0.8),inset_0_1px_0_rgba(255,255,255,0.35)]',
          PILL_MOTION
        )}
      >
        <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
      </span>

      <ul className="flex flex-col gap-0.5">
        {NAVIGATION.map((item) => {
          const Icon = item.icon
          const active = item.href === activeHref
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                ref={(el) => {
                  if (el) links.current.set(item.href, el)
                  else links.current.delete(item.href)
                }}
                onClick={onNavigate}
                onMouseEnter={() => showHover(item.href)}
                onFocus={() => showHover(item.href)}
                onBlur={hideHover}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative z-10 flex h-9 items-center gap-2.5 rounded-xl px-3 text-[13px] font-medium outline-none',
                  'transition-colors duration-300 ease-out-soft focus-visible:ring-2 focus-visible:ring-brand-500/50',
                  active ? 'text-white' : 'text-ink-soft hover:text-ink'
                )}
              >
                <Icon
                  className={cn(
                    'size-[17px] shrink-0 transition-[color,transform] duration-500 ease-spring',
                    active ? 'text-white' : 'text-ink-muted group-hover:-rotate-3 group-hover:scale-110 group-hover:text-brand-500'
                  )}
                  strokeWidth={active ? 2.2 : 1.9}
                  aria-hidden="true"
                />
                <span className="truncate transition-transform duration-500 ease-spring group-hover:translate-x-0.5">
                  {item.name}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Avatar({ name, size = 'md' }) {
  const dims = size === 'sm' ? 'size-8 text-[11px]' : 'size-9 text-xs'
  return (
    <span
      className={cn(
        dims,
        'grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#f9a24f,#dd6b12)] font-bold text-white shadow-[0_4px_10px_-4px_rgba(221,107,18,0.7)] ring-2 ring-edge'
      )}
    >
      {initials(name) || 'A'}
    </span>
  )
}
