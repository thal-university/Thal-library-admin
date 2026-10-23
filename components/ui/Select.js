'use client'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Glass dropdown that replaces native <select>.
// options: [value, label] tuples or { value, label, hint?, disabled? }.
// variant "pill" sits in toolbars, "field" fills a form row, "compact" is for tight spots like per-page pickers.
// Search shows automatically once the list is long enough (or force with `searchable`).
// `required` keeps native form validation via a hidden proxy input.
export default function Select({
  value,
  onChange,
  options,
  label,
  icon: Icon,
  placeholder = 'Select…',
  variant = 'pill',
  searchable,
  searchPlaceholder = 'Search…',
  required,
  invalid,
  disabled,
  id,
  className,
  menuClassName,
}) {
  const items = useMemo(
    () => options.map((o) => (Array.isArray(o) ? { value: o[0], label: o[1] } : o)),
    [options]
  )
  const selected = items.find((o) => String(o.value) === String(value))
  const withSearch = searchable ?? items.length > 7

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const listRef = useRef(null)
  const searchRef = useRef(null)
  const listId = useId()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((o) => String(o.label).toLowerCase().includes(q) || String(o.hint ?? '').toLowerCase().includes(q))
  }, [items, query])

  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.max(r.width, variant === 'pill' ? 220 : variant === 'compact' ? 96 : r.width)
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
    const below = window.innerHeight - r.bottom - 12
    const above = r.top - 12
    const up = below < 260 && above > below
    setPos({
      left,
      width,
      up,
      top: up ? undefined : r.bottom + 6,
      bottom: up ? window.innerHeight - r.top + 6 : undefined,
      max: Math.min(360, up ? above : below),
    })
  }, [variant])

  const openMenu = () => {
    if (disabled) return
    place()
    setQuery('')
    setActive(Math.max(0, items.findIndex((o) => String(o.value) === String(value))))
    setOpen(true)
  }

  const close = useCallback((refocus = true) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }, [])

  const pick = (o) => {
    if (!o || o.disabled) return
    if (String(o.value) !== String(value)) onChange(o.value)
    close()
  }

  // Follow the trigger while scrolling / resizing; close on outside press
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return
      close(false)
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    document.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open, place, close])

  useLayoutEffect(() => {
    if (open) (withSearch ? searchRef.current : listRef.current)?.focus({ preventScroll: true })
  }, [open, withSearch])

  // Keep the highlighted row in view
  useEffect(() => {
    if (!open || active < 0) return
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const move = (dir) => {
    if (!filtered.length) return
    let i = active
    for (let n = 0; n < filtered.length; n++) {
      i = (i + dir + filtered.length) % filtered.length
      if (!filtered[i].disabled) break
    }
    setActive(i)
  }

  const onMenuKey = (e) => {
    if (e.key === 'ArrowDown') (e.preventDefault(), move(1))
    else if (e.key === 'ArrowUp') (e.preventDefault(), move(-1))
    else if (e.key === 'Home') (e.preventDefault(), setActive(0))
    else if (e.key === 'End') (e.preventDefault(), setActive(filtered.length - 1))
    else if (e.key === 'Enter') (e.preventDefault(), pick(filtered[active]))
    else if (e.key === 'Escape') (e.preventDefault(), e.stopPropagation(), close())
    else if (e.key === 'Tab') close(false)
  }

  const onTriggerKey = (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      openMenu()
    }
  }

  return (
    <span className={cn('relative', variant === 'field' ? 'block w-full' : 'inline-block')}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKey}
        className={cn(
          'group relative inline-flex cursor-pointer items-center gap-2 rounded-xl border text-left outline-none disabled:cursor-not-allowed disabled:opacity-60',
          'transition-[background-color,border-color,box-shadow] duration-300 hover:bg-surface focus-visible:border-brand-300 focus-visible:shadow-[0_0_0_4px_rgba(238,122,26,0.12)]',
          variant === 'pill' && 'h-9 max-w-[240px] bg-surface/60 pr-2.5 pl-3 text-[12.5px] font-semibold text-ink-soft',
          variant === 'field' && 'h-9 w-full bg-surface/70 pr-2.5 pl-3 text-[13px] text-ink',
          variant === 'compact' && 'h-8 bg-surface/60 pr-2 pl-2.5 text-[12px] font-semibold text-ink-soft',
          open
            ? 'border-brand-300 bg-surface shadow-[0_0_0_4px_rgba(238,122,26,0.12)]'
            : invalid
              ? 'border-rose-300 bg-rose-50/40'
              : 'border-edge/90',
          className
        )}
      >
        {Icon ? <Icon className="size-3.5 shrink-0 text-ink-muted" aria-hidden="true" /> : null}
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-ink-muted')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn('size-3.5 shrink-0 text-ink-muted transition-transform duration-500 ease-spring', open && 'rotate-180 text-brand-500')}
          aria-hidden="true"
        />
      </button>

      {/* Invisible proxy so the browser still blocks submit and points here when nothing is chosen */}
      {required ? (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value ?? ''}
          onChange={() => {}}
          onFocus={() => triggerRef.current?.focus()}
          className="pointer-events-none absolute bottom-0 left-1/2 h-px w-px opacity-0"
        />
      ) : null}

      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              onKeyDown={onMenuKey}
              style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, transformOrigin: pos.up ? 'bottom' : 'top' }}
              className={cn('glass-strong select-pop fixed z-[80] flex flex-col overflow-hidden rounded-2xl', menuClassName)}
            >
              {withSearch ? (
                <div className="relative border-b border-glass-line p-1.5">
                  <Search className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      setActive(0)
                    }}
                    placeholder={searchPlaceholder}
                    aria-label={`Search ${label ?? 'options'}`}
                    aria-controls={listId}
                    aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                    className="h-8 w-full rounded-lg border border-edge/90 bg-surface/70 pr-8 pl-8 text-[12.5px] text-ink outline-none placeholder:text-ink-muted focus:border-brand-300 focus:bg-surface"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => (setQuery(''), searchRef.current?.focus())}
                      className="absolute top-1/2 right-3 grid size-5 -translate-y-1/2 place-items-center rounded-md text-ink-muted hover:bg-ink/5 hover:text-ink"
                      aria-label="Clear search"
                    >
                      <X className="size-3" />
                    </button>
                  ) : null}
                </div>
              ) : null}

              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label={label}
                tabIndex={-1}
                aria-activedescendant={!withSearch && active >= 0 ? `${listId}-${active}` : undefined}
                style={{ maxHeight: Math.max(120, pos.max - (withSearch ? 46 : 0)) }}
                className="scroll-quiet overflow-y-auto overscroll-contain p-1.5 outline-none"
              >
                {filtered.length ? (
                  filtered.map((o, i) => {
                    const isSel = String(o.value) === String(value)
                    return (
                      <li
                        key={o.value}
                        id={`${listId}-${i}`}
                        data-idx={i}
                        role="option"
                        aria-selected={isSel}
                        aria-disabled={o.disabled || undefined}
                        onPointerMove={() => !o.disabled && active !== i && setActive(i)}
                        onClick={() => pick(o)}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-[7px] text-[12.5px] transition-colors duration-150',
                          o.disabled && 'cursor-not-allowed opacity-45',
                          i === active && !o.disabled ? 'bg-brand-500/10 text-ink' : 'text-ink-soft',
                          isSel && 'font-semibold text-brand-700'
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          <Highlight text={String(o.label)} query={query} />
                        </span>
                        {o.hint ? <span className="shrink-0 text-[11px] font-normal text-ink-muted">{o.hint}</span> : null}
                        <Check className={cn('size-3.5 shrink-0 text-brand-500', !isSel && 'invisible')} aria-hidden="true" />
                      </li>
                    )
                  })
                ) : (
                  <li className="px-2.5 py-6 text-center text-[12px] text-ink-muted">No matches for “{query}”</li>
                )}
              </ul>
            </div>,
            document.body
          )
        : null}
    </span>
  )
}

function Highlight({ text, query }) {
  const q = query.trim()
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[3px] bg-brand-500/18 px-px text-inherit">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  )
}
