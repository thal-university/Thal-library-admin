'use client'
import { useEffect, useState } from 'react'
import Loader from '@/components/Loader'
import { Search, X, Filter, Wallet, AlertTriangle, CheckCircle, Clock, BadgeDollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import { GlassCard, CardHeader, StatCard, Pill, Modal, EmptyState as GlassEmptyState, ui } from '@/components/ui/glass'
import Select from '@/components/ui/Select'
import { cn } from '@/lib/utils'
import {
  getLibrarySettings,
  fetchReservationsList,
  recordFinePayment,
  DEFAULT_SETTINGS,
  calculateFine,
  formatDate,
  formatMoney,
  today
} from '@/lib/librarySettings'

const ROLE_OPTIONS = [['all', 'All Roles'], ['student', 'Students'], ['teacher', 'Teachers']]

/** Statuses that mean the loan is closed, so its fine is settled at a fixed amount. */
const ARCHIVED_STATUSES = ['returned', 'completed', 'deleted']

export default function FineRecordsPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterState, setFilterState] = useState('unpaid')
  const [filterRole, setFilterRole] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState(null)
  const [paidOn, setPaidOn] = useState(today())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchFines()
    getLibrarySettings().then(setSettings)

    // Polled rather than subscribed: Supabase realtime honours row level
    // security, which hides `reservations` from the anon key. Keeping it live
    // means a return recorded on another screen shows up here on its own.
    const refreshInterval = setInterval(fetchFines, 10000)

    return () => clearInterval(refreshInterval)
  }, [])

  async function fetchFines() {
    try {
      setRows(await fetchReservationsList('fines'))
    } catch (error) {
      console.error('Error fetching fine records:', error)
      toast.error('Failed to fetch fine records')
    } finally {
      setLoading(false)
    }
  }

  /**
   * What this row owes. A closed loan keeps the amount stamped at return; a
   * book still out keeps accruing, so it is recalculated on every render.
   */
  function fineFor(row) {
    if (ARCHIVED_STATUSES.includes(row.status)) {
      return {
        amount: Number(row.fine_amount || 0),
        days: calculateFine(row.due_date, row.return_date, settings).days,
        settled: true
      }
    }

    return { ...calculateFine(row.due_date, null, settings), settled: false }
  }

  /** Where a row sits: still accruing, owed at the counter, or collected. */
  function stateOf(row) {
    const fine = fineFor(row)
    if (!fine.settled) return 'accruing'
    return row.fine_paid ? 'paid' : 'unpaid'
  }

  function openPaymentModal(row) {
    setSelected(row)
    setPaidOn(today())
  }

  async function handleRecordPayment() {
    if (!selected) return

    try {
      setSaving(true)
      await recordFinePayment(selected.id, paidOn)

      toast.success(
        `${formatMoney(fineFor(selected).amount, settings)} collected from ${selected.reserver_name}.`
      )

      setSelected(null)
      fetchFines()
    } catch (error) {
      console.error('Error recording fine payment:', error)
      toast.error(`Failed to record the payment: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Every row that carries a fine, newest first. Rows whose live fine has not
  // started yet (due today, nothing owed) are dropped.
  const fineRows = rows
    .map(row => ({ ...row, fine: fineFor(row), state: stateOf(row) }))
    .filter(row => row.fine.amount > 0)

  const filteredRows = fineRows.filter(row => {
    if (filterState !== 'all' && row.state !== filterState) return false
    if (filterRole !== 'all' && row.reserver_role !== filterRole) return false

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        row.reserver_name.toLowerCase().includes(q) ||
        row.reserver_id.toLowerCase().includes(q) ||
        row.book_name.toLowerCase().includes(q) ||
        String(row.book?.sr_no || row.book_sr_no || '').toLowerCase().includes(q) ||
        (row.book?.author && row.book.author.toLowerCase().includes(q))
      )
    }

    return true
  })

  const sum = (list) => list.reduce((total, row) => total + row.fine.amount, 0)

  const stats = {
    all: fineRows.length,
    unpaid: fineRows.filter(r => r.state === 'unpaid').length,
    paid: fineRows.filter(r => r.state === 'paid').length,
    accruing: fineRows.filter(r => r.state === 'accruing').length,
    outstanding: sum(fineRows.filter(r => r.state === 'unpaid')),
    collected: sum(fineRows.filter(r => r.state === 'paid')),
    accruingTotal: sum(fineRows.filter(r => r.state === 'accruing'))
  }

  // Pill tone for each state
  const stateStyles = {
    unpaid: 'danger',
    paid: 'success',
    accruing: 'warning'
  }

  const stateLabels = {
    unpaid: 'Unpaid',
    paid: 'Paid',
    accruing: 'Accruing'
  }

  const filterButtons = [
    { key: 'unpaid', label: 'Unpaid', count: stats.unpaid, active: 'bg-rose-500/12 text-rose-700 ring-rose-500/30' },
    { key: 'paid', label: 'Paid', count: stats.paid, active: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/30' },
    { key: 'accruing', label: 'Accruing', count: stats.accruing, active: 'bg-amber-500/14 text-amber-700 ring-amber-500/30' },
    { key: 'all', label: 'All', count: stats.all, active: 'bg-brand-500/12 text-brand-700 ring-brand-500/30' }
  ]

  if (loading) return <Loader inline />

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scroll-quiet flex min-h-0 flex-1 flex-col gap-3 overflow-auto md:overflow-hidden">
        {/* Money at a glance */}
        <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            icon={Wallet}
            label={`Outstanding (${stats.unpaid})`}
            value={formatMoney(stats.outstanding, settings)}
            tone="danger"
            index={0}
          />
          <StatCard
            icon={CheckCircle}
            label={`Collected (${stats.paid})`}
            value={formatMoney(stats.collected, settings)}
            tone="success"
            index={1}
          />
          <StatCard
            icon={Clock}
            label={`Accruing (${stats.accruing})`}
            value={formatMoney(stats.accruingTotal, settings)}
            tone="brand"
            index={2}
          />
          <StatCard
            icon={BadgeDollarSign}
            label="Per Day"
            value={formatMoney(settings.fine_per_day, settings)}
            tone="navy"
            index={3}
          />
        </div>

        {/* Search and Filters */}
        <GlassCard index={4} className="shrink-0 p-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  placeholder="Search by name, roll no, book or SR no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(ui.input, 'pl-9 pr-9')}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-ink-muted transition-colors hover:text-ink"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-xl border transition-colors md:hidden',
                  showFilters || filterState !== 'unpaid' || filterRole !== 'all'
                    ? 'border-brand-400 bg-brand-500/10 text-brand-600'
                    : 'border-edge/90 bg-surface/70 text-ink-soft hover:bg-surface hover:text-ink'
                )}
                title="Filters"
              >
                <Filter className="size-4" />
              </button>
            </div>

            {/* Desktop filters */}
            <div className="hidden flex-wrap items-center gap-2 md:flex">
              <div className="flex flex-wrap items-center gap-1 rounded-xl bg-surface/50 p-1 ring-1 ring-glass-line">
                {filterButtons.map(button => (
                  <button
                    key={button.key}
                    onClick={() => setFilterState(button.key)}
                    className={cn(
                      'inline-flex h-7 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition-colors',
                      filterState === button.key
                        ? `${button.active} ring-1`
                        : 'text-ink-soft hover:bg-surface/80 hover:text-ink'
                    )}
                  >
                    {button.label}
                    <span className="tabular-nums opacity-70">{button.count}</span>
                  </button>
                ))}
              </div>
              <Select
                label="Role"
                value={filterRole}
                onChange={setFilterRole}
                options={ROLE_OPTIONS}
              />
            </div>

            {/* Mobile filters */}
            {showFilters && (
              <div className="fade-in flex flex-col gap-2 border-t border-glass-line pt-2 md:hidden">
                <div className="grid grid-cols-4 gap-1.5">
                  {filterButtons.map(button => (
                    <button
                      key={button.key}
                      onClick={() => setFilterState(button.key)}
                      className={cn(
                        'rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition-colors',
                        filterState === button.key
                          ? `${button.active} ring-1`
                          : 'bg-surface/60 text-ink-soft ring-1 ring-glass-line'
                      )}
                    >
                      {button.label} ({button.count})
                    </button>
                  ))}
                </div>
                <Select
                  variant="field"
                  label="Role"
                  value={filterRole}
                  onChange={setFilterRole}
                  options={ROLE_OPTIONS}
                />
              </div>
            )}
          </div>
        </GlassCard>

        {/* Fines table */}
        <GlassCard index={5} className="flex min-h-[320px] shrink-0 flex-col overflow-hidden md:min-h-0 md:flex-1 md:shrink">
          <CardHeader title="Fine Records" subtitle="Late returns and the fines they carry" className="border-b border-glass-line">
            <span className="grid size-8 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
              <Wallet className="size-4" aria-hidden="true" />
            </span>
          </CardHeader>

          {/* Mobile card view */}
          <div className="scroll-quiet flex-1 space-y-1.5 overflow-y-auto p-2.5 md:hidden">
            {filteredRows.length === 0 ? (
              <EmptyState />
            ) : (
              filteredRows.map(row => (
                <div
                  key={row.id}
                  className="rounded-xl border border-glass-line bg-surface/50 px-3 py-2"
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <Pill tone={stateStyles[row.state]}>
                      {stateLabels[row.state]}
                    </Pill>
                    <Pill tone={row.reserver_role === 'teacher' ? 'brand' : 'info'}>
                      {row.reserver_role === 'teacher' ? 'Teacher' : 'Student'}
                    </Pill>
                  </div>

                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-[13px] font-semibold text-ink">{row.reserver_name}</h4>
                    <span className="text-[11.5px] text-ink-muted">({row.reserver_id})</span>
                  </div>

                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="flex-1 truncate text-[12px] font-medium text-ink-soft">{row.book_name}</p>
                    <span className="font-mono text-[11px] text-ink-muted">
                      SR: {row.book?.sr_no || row.book_sr_no || 'N/A'}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                    <span className="text-[11px] text-ink-muted">
                      <span className="font-semibold text-ink-soft">Due:</span> {formatDate(row.due_date)}
                    </span>
                    <span className="text-[11px] text-ink-muted">
                      <span className="font-semibold text-ink-soft">Returned:</span> {formatDate(row.return_date)}
                    </span>
                    <span className="text-[11px] font-semibold text-rose-600">{row.fine.days}d late</span>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-glass-line pt-1.5">
                    <span className={cn('text-[13px] font-bold tabular-nums', row.state === 'paid' ? 'text-emerald-700' : 'text-rose-700')}>
                      {formatMoney(row.fine.amount, settings)}
                    </span>
                    <PaymentAction row={row} onPay={openPaymentModal} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop table view */}
          <div className="scroll-quiet hidden min-h-0 flex-1 overflow-auto md:block">
            <table className={ui.table}>
              <thead className={ui.thead}>
                <tr>
                  <th className={ui.th}>Borrower</th>
                  <th className={ui.th}>Book SR No</th>
                  <th className={ui.th}>Book</th>
                  <th className={ui.th}>Due Date</th>
                  <th className={ui.th}>Returned</th>
                  <th className={ui.th}>Days Late</th>
                  <th className={ui.th}>Fine</th>
                  <th className={ui.th}>Payment</th>
                  <th className={ui.th.replace('text-left', 'text-center')}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-4 py-6 text-center">
                      <EmptyState />
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => (
                    <tr key={row.id} className={ui.tr}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-[13px] font-semibold text-ink">
                              {row.reserver_name}
                            </span>
                            <span className="text-[11px] text-ink-muted">{row.reserver_id}</span>
                          </div>
                          <span className={cn(
                            'shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                            row.reserver_role === 'teacher'
                              ? 'bg-brand-500/10 text-brand-700'
                              : 'bg-sky-500/10 text-sky-700'
                          )}>
                            {row.reserver_role === 'teacher' ? 'T' : 'S'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-[12px] font-semibold text-ink-soft">
                          {row.book?.sr_no || row.book_sr_no || 'N/A'}
                        </span>
                      </td>
                      <td className="max-w-[220px] px-3 py-2">
                        <div className="flex min-w-0 flex-col">
                          <span className="block truncate text-[13px] font-medium text-ink" title={row.book_name}>
                            {row.book_name}
                          </span>
                          {row.book?.author && (
                            <span className="block truncate text-[11px] text-ink-muted" title={row.book.author}>
                              {row.book.author}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="whitespace-nowrap text-[12px] font-medium text-rose-600">
                          {formatDate(row.due_date)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {row.return_date ? (
                          <span className="whitespace-nowrap text-[12px] text-ink-soft">
                            {formatDate(row.return_date)}
                          </span>
                        ) : (
                          <span className="whitespace-nowrap text-[12px] font-semibold text-amber-600">
                            Still out
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[12px] font-semibold tabular-nums text-rose-600">{row.fine.days}d</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          'whitespace-nowrap text-[13px] font-bold tabular-nums',
                          row.state === 'paid' ? 'text-emerald-700' : 'text-rose-700'
                        )}>
                          {formatMoney(row.fine.amount, settings)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col items-start gap-0.5">
                          <Pill tone={stateStyles[row.state]}>
                            {stateLabels[row.state]}
                          </Pill>
                          {row.state === 'paid' && row.fine_paid_at && (
                            <span className="text-[10.5px] text-ink-muted">
                              {formatDate(row.fine_paid_at)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-center">
                          <PaymentAction row={row} onPay={openPaymentModal} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-glass-line px-3.5 py-2">
            <p className="text-[12px] text-ink-muted">
              Showing <span className="font-semibold text-ink">{filteredRows.length}</span> of{' '}
              <span className="font-semibold text-ink">{fineRows.length}</span> fine record(s)
            </p>
            <p className="text-[12px] text-ink-muted">
              Shown total:{' '}
              <span className="font-bold tabular-nums text-ink">{formatMoney(sum(filteredRows), settings)}</span>
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Record Payment Modal */}
      {selected && (() => {
        const fine = fineFor(selected)
        return (
          <Modal
            onClose={saving ? undefined : () => setSelected(null)}
            title="Record Payment"
            subtitle="Collect this fine at the counter"
            icon={Wallet}
            size="md"
            footer={
              <>
                <button
                  onClick={() => setSelected(null)}
                  disabled={saving}
                  className={ui.btnSecondary}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRecordPayment}
                  disabled={saving || !paidOn}
                  className={ui.btnSuccess}
                >
                  {saving ? 'Recording...' : 'Record Payment'}
                </button>
              </>
            }
          >
            <div className="space-y-3">
              <div className="rounded-xl border border-glass-line bg-surface/60 p-3">
                <p className="text-[13px] font-semibold text-ink">{selected.reserver_name}</p>
                <p className="text-[11.5px] text-ink-muted">{selected.reserver_id}</p>
                <p className="mt-1 text-[12.5px] text-ink-soft">{selected.book_name}</p>
                <div className="mt-2 grid grid-cols-3 gap-2 border-t border-glass-line pt-2">
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Due</p>
                    <p className="text-[12px] font-semibold text-ink">{formatDate(selected.due_date)}</p>
                  </div>
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Returned</p>
                    <p className="text-[12px] font-semibold text-ink">{formatDate(selected.return_date)}</p>
                  </div>
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Days Late</p>
                    <p className="text-[12px] font-semibold text-rose-600">{fine.days}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-emerald-500/10 p-3 ring-1 ring-emerald-500/25">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-emerald-700">Amount to collect</p>
                <p className="text-xl font-bold tabular-nums text-emerald-700">
                  {formatMoney(fine.amount, settings)}
                </p>
              </div>

              <div>
                <label className={ui.label}>
                  Payment Date *
                </label>
                <input
                  type="date"
                  value={paidOn}
                  onChange={(e) => setPaidOn(e.target.value)}
                  className={ui.input}
                />
              </div>

              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 ring-1 ring-amber-500/25">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p className="text-[11.5px] text-amber-800">
                  This marks the fine as collected. It cannot be undone from the admin panel.
                </p>
              </div>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}

/** The per-row action: collect an unpaid fine, or explain why it cannot be. */
function PaymentAction({ row, onPay }) {
  if (row.state === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-700">
        <CheckCircle className="size-3.5" />
        Paid
      </span>
    )
  }

  if (row.state === 'accruing') {
    return (
      <span className="whitespace-nowrap text-[11.5px] italic text-ink-muted" title="The fine is settled when the book comes back">
        On return
      </span>
    )
  }

  return (
    <button
      onClick={() => onPay(row)}
      className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-600 px-2.5 text-[12px] font-semibold text-white shadow-[0_6px_16px_-8px_rgba(5,150,105,0.6)] transition hover:bg-emerald-700"
      title="Record this fine as collected"
    >
      <Wallet className="size-3.5" />
      Record Payment
    </button>
  )
}

function EmptyState() {
  return (
    <GlassEmptyState
      icon={Wallet}
      title="No fine records found"
      hint="Try a different filter or search"
      className="py-6"
    />
  )
}
