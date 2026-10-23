'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, LogOut, Menu, Settings } from 'lucide-react'
import { Avatar } from '@/components/Sidebar'
import { cn } from '@/lib/utils'

export default function Header({ title, user, onMenu, onLogout }) {
  return (
    <header data-print-hide className="glass z-30 flex h-12 shrink-0 items-center gap-2 rounded-[16px] px-2.5 sm:gap-3 sm:px-3">
      <button
        onClick={onMenu}
        className="grid size-9 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-surface/80 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 pl-1 text-[13px]">
        <span className="hidden text-ink-muted sm:inline">Library</span>
        <ChevronRight className="hidden size-3.5 text-ink-muted/60 sm:block" aria-hidden="true" />
        <span className="truncate font-semibold text-ink">{title}</span>
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        <UserMenu user={user} onLogout={onLogout} />
      </div>
    </header>
  )
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-xl p-1 transition-colors hover:bg-surface/80 sm:pr-2"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={user.name} />
        <span className="hidden text-left sm:block">
          <span className="block text-[13px] font-semibold leading-tight text-ink">{user.name}</span>
          <span className="block text-[11px] leading-tight text-ink-muted">Administrator</span>
        </span>
        <ChevronDown
          className={cn('hidden size-4 text-ink-muted transition-transform duration-300 ease-spring sm:block', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-56">
          <div role="menu" className="glass-strong rise rounded-2xl p-1.5">
            <div className="flex items-center gap-2.5 border-b border-glass-line px-2.5 pt-1.5 pb-2.5">
              <Avatar name={user.name} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-ink">{user.name}</p>
                <p className="truncate text-[11px] text-ink-muted">{user.username ? `@${user.username}` : 'Administrator'}</p>
              </div>
            </div>
            <Link
              role="menuitem"
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="mt-1 flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] text-ink-soft transition-colors hover:bg-surface hover:text-ink"
            >
              <Settings className="size-4" aria-hidden="true" /> Settings
            </Link>
            <button
              role="menuitem"
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] text-ink-soft transition-colors hover:bg-surface hover:text-danger"
            >
              <LogOut className="size-4" aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
