'use client'
import { useEffect, useState } from 'react'
import Loader from '@/components/Loader'
import { BookMarked, Search, X, CheckCircle, AlertTriangle, Filter, CalendarDays, Undo2, Plus, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getLibrarySettings,
  fetchReservationsList,
  updateReservation,
  DEFAULT_SETTINGS,
  calculateFine,
  formatDate,
  formatMoney,
  today
} from '@/lib/librarySettings'
import ReserveBookModal from '@/components/ReserveBookModal'
import { GlassCard, EmptyState, Pill, StatCard, ui } from '@/components/ui/glass'
import Select from '@/components/ui/Select'
import { cn } from '@/lib/utils'

const ROLE_OPTIONS = [['all', 'All Roles'], ['student', 'Students'], ['teacher', 'Teachers']]

// Pill tone per stored reservation status
const STATUS_TONE = {
  pending: 'warning',
  confirmed: 'info',
  issued: 'info',
  returned: 'success',
  completed: 'success',
  rejected: 'danger',
  cancelled: 'danger',
  overdue: 'danger',
  deleted: 'neutral',
}

// Segmented filter tab classes
const tabClass = (active) =>
  cn(
    'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[12px] font-semibold transition',
    active ? 'bg-surface text-ink shadow-[0_2px_8px_-3px_rgba(30,50,90,0.3)]' : 'text-ink-muted hover:text-ink'
  )

const countClass = (active) =>
  cn('rounded-md px-1.5 text-[10.5px] tabular-nums', active ? 'bg-brand-500/12 text-brand-700' : 'bg-slate-500/10 text-ink-muted')

export default function ReservationsPage() {
  const [loading, setLoading] = useState(true)
  const [reservations, setReservations] = useState([])
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterRole, setFilterRole] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState(null)
  const [existingReservation, setExistingReservation] = useState(null)
  const [_currentTime, setCurrentTime] = useState(new Date())
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [issueDate, setIssueDate] = useState(today())
  const [dueDate, setDueDate] = useState('')
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnDate, setReturnDate] = useState(today())
  const [fineAmount, setFineAmount] = useState('0')
  const [finePaid, setFinePaid] = useState(false)
  const [showReserveModal, setShowReserveModal] = useState(false)

  useEffect(() => {
    fetchReservations()
    fetchSettings()
    // Clean up old pending reservations on page load
    cleanupOldReservations()

    // Poll for updates. Supabase realtime cannot be used here: it honours row
    // level security, which hides `reservations` from the anon key.
    const refreshInterval = setInterval(fetchReservations, 10000)

    return () => clearInterval(refreshInterval)
  }, [])

  // Update time every second for live countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  async function fetchSettings() {
    setSettings(await getLibrarySettings())
  }

  async function fetchReservations() {
    try {
      // Served by /api/reservations: row level security hides the table from
      // the browser's anon key, so this read runs with the service role key.
      setReservations(await fetchReservationsList('all'))
    } catch (error) {
      console.error('Error fetching reservations:', error)
      toast.error('Failed to fetch reservations')
    } finally {
      setLoading(false)
    }
  }

  async function cleanupOldReservations() {
    try {
      // Expired pending reservations are swept server-side, where the service
      // role key is available.
      await fetch('/api/reservations/cleanup', { method: 'POST' })
    } catch (error) {
      console.error('Error cleaning up old reservations:', error)
    }
  }

  async function handleConfirm(reservation, forceConfirm = false) {
    try {
      // One book per person unless the admin overrides it
      const existingConfirmed = reservations.filter(
        r => r.status === 'confirmed' && r.reserver_id === reservation.reserver_id
      )

      if (existingConfirmed.length > 0 && !forceConfirm) {
        toast.error(
          `Cannot confirm! ${reservation.reserver_name} already has a confirmed reservation for "${existingConfirmed[0].book_name}". Please return the previously borrowed book before reserving another.`,
          { duration: 6000 }
        )
        setShowConfirmModal(false)
        setSelectedReservation(null)
        setExistingReservation(null)
        return
      }

      if (!issueDate || !dueDate) {
        toast.error('Please set both an issue date and a due date')
        return
      }

      if (new Date(dueDate) < new Date(issueDate)) {
        toast.error('Due date cannot be earlier than the issue date')
        return
      }

      await updateReservation(reservation.id, 'confirm', {
        issue_date: issueDate,
        due_date: dueDate
      })

      if (forceConfirm) {
        toast.success(`Reservation confirmed! Note: ${reservation.reserver_name} now has multiple confirmed reservations.`, { duration: 6000 })
      } else {
        toast.success(`Reservation confirmed! Issued ${formatDate(issueDate)}, due ${formatDate(dueDate)}.`)
      }

      setShowConfirmModal(false)
      setSelectedReservation(null)
      setExistingReservation(null)
      fetchReservations()
    } catch (error) {
      console.error('Error confirming reservation:', error)
      toast.error(`Failed to confirm reservation: ${error.message}`)
      setShowConfirmModal(false)
      setSelectedReservation(null)
      setExistingReservation(null)
    }
  }

  async function openConfirmModal(reservation) {
    setSelectedReservation(reservation)

    // Issue today by default; the admin picks how long the loan runs
    setIssueDate(today())
    setDueDate('')

    // Warn if this borrower already has a book out
    const alreadyOut = reservations.find(
      r => r.status === 'confirmed' && r.reserver_id === reservation.reserver_id
    )
    setExistingReservation(alreadyOut || null)

    setShowConfirmModal(true)
  }

  function openReturnModal(reservation) {
    setSelectedReservation(reservation)

    const due = today()
    setReturnDate(due)

    // Start from what the rules say is owed; the admin can adjust or waive it.
    const owed = calculateFine(reservation.due_date, due, settings)
    setFineAmount(String(owed.amount))
    setFinePaid(owed.amount === 0)

    setShowReturnModal(true)
  }

  async function handleReturn(reservation) {
    try {
      if (!returnDate) {
        toast.error('Please pick a return date')
        return
      }

      const charged = Number(fineAmount)

      if (!Number.isFinite(charged) || charged < 0) {
        toast.error('Fine must be a number of zero or more')
        return
      }

      const { fine } = await updateReservation(reservation.id, 'return', {
        return_date: returnDate,
        fine_amount: charged,
        fine_paid: finePaid
      })

      if (fine?.amount > 0) {
        toast.success(
          `Book returned. Fine ${formatMoney(fine.amount, settings)} recorded as ${fine.paid ? 'paid' : 'unpaid'}.`,
          { duration: 6000 }
        )
      } else {
        toast.success('Book returned. No fine recorded.')
      }

      setShowReturnModal(false)
      setSelectedReservation(null)
      fetchReservations()
    } catch (error) {
      console.error('Error returning reservation:', error)
      toast.error(`Failed to record the return: ${error.message}`)
    }
  }

  function getTimeRemaining(reservationDate) {
    const now = new Date()
    const reservedAt = new Date(reservationDate)
    const twentyFourHours = 43 * 60 * 60 * 1000
    const elapsed = now - reservedAt
    const remaining = twentyFourHours - elapsed

    if (remaining <= 0) return { expired: true }

    const hours = Math.floor(remaining / (60 * 60 * 1000))
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000))
    const seconds = Math.floor((remaining % (60 * 1000)) / 1000)

    return { expired: false, hours, minutes, seconds }
  }

  // Filter and search reservations
  const filteredReservations = reservations
    .filter(reservation => {
      // Exclude archived (returned / deleted) reservations from the main view
      if (reservation.status === 'deleted' || reservation.status === 'returned' || reservation.status === 'completed') return false
      // Status filter ('overdue' is a derived status, not a stored one)
      if (filterStatus === 'overdue') {
        if (reservation.status !== 'confirmed') return false
        if (calculateFine(reservation.due_date, null, settings).days === 0) return false
      } else if (filterStatus !== 'all' && reservation.status !== filterStatus) {
        return false
      }

      // Role filter
      if (filterRole !== 'all' && reservation.reserver_role !== filterRole) return false

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          reservation.reserver_name.toLowerCase().includes(query) ||
          reservation.reserver_id.toLowerCase().includes(query) ||
          reservation.book_name.toLowerCase().includes(query) ||
          (reservation.book?.author && reservation.book.author.toLowerCase().includes(query))
        )
      }

      return true
    })

  const isActive = (r) => r.status === 'pending' || r.status === 'confirmed'

  // Calculate stats
  const stats = {
    total: reservations.filter(isActive).length,
    pending: reservations.filter(r => r.status === 'pending').length,
    confirmed: reservations.filter(r => r.status === 'confirmed').length,
    overdue: reservations.filter(r => r.status === 'confirmed' && calculateFine(r.due_date, null, settings).days > 0).length,
    students: reservations.filter(r => r.reserver_role === 'student').length,
    teachers: reservations.filter(r => r.reserver_role === 'teacher').length,
  }

  if (loading) {
    return <Loader inline />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* KPIs */}
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard index={0} icon={BookMarked} label="Active Reservations" value={stats.total} hint={`${stats.students} students · ${stats.teachers} teachers`} tone="brand" />
        <StatCard index={1} icon={Clock} label="Pending" value={stats.pending} hint="Waiting for confirmation" tone="info" />
        <StatCard index={2} icon={CheckCircle} label="Issued" value={stats.confirmed} hint="Books out with readers" tone="success" />
        <StatCard index={3} icon={AlertTriangle} label="Overdue" value={stats.overdue} hint={stats.overdue > 0 ? 'Past due date, fine accruing' : 'Nothing overdue'} tone="danger" />
      </div>

      {/* Search and Filters Bar */}
      <GlassCard index={4} className="relative z-10 p-2.5 sm:p-3">
        <div className="flex flex-col gap-2">
          {/* Top Row: Search + Filter Icon (Mobile) / Full Layout (Desktop) */}
          <div className="flex items-center gap-2">
            {/* Search Bar */}
            <div className="relative min-w-0 flex-1 md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                placeholder="Search reservations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(ui.input, 'pl-9 pr-9')}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-ink-muted transition hover:bg-surface hover:text-ink"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Desktop: Always show filters inline */}
            <div className="hidden flex-1 flex-wrap items-center gap-2 md:flex">
              <div className="flex items-center gap-0.5 rounded-xl border border-edge/70 bg-slate-500/[0.06] p-1">
                <button onClick={() => setFilterStatus('all')} className={tabClass(filterStatus === 'all')}>
                  All <span className={countClass(filterStatus === 'all')}>{stats.total}</span>
                </button>
                <button onClick={() => setFilterStatus('pending')} className={tabClass(filterStatus === 'pending')}>
                  Pending <span className={countClass(filterStatus === 'pending')}>{stats.pending}</span>
                </button>
                <button onClick={() => setFilterStatus('confirmed')} className={tabClass(filterStatus === 'confirmed')}>
                  Confirmed <span className={countClass(filterStatus === 'confirmed')}>{stats.confirmed}</span>
                </button>
                <button onClick={() => setFilterStatus('overdue')} className={tabClass(filterStatus === 'overdue')}>
                  Overdue{' '}
                  <span
                    className={cn(
                      'rounded-md px-1.5 text-[10.5px] tabular-nums',
                      stats.overdue > 0 ? 'bg-rose-500/10 text-rose-700' : countClass(filterStatus === 'overdue')
                    )}
                  >
                    {stats.overdue}
                  </span>
                </button>
              </div>
              <Select
                label="Role"
                value={filterRole}
                onChange={setFilterRole}
                options={ROLE_OPTIONS}
              />
            </div>

            {/* Admin: search a book and reserve it directly */}
            <button
              onClick={() => setShowReserveModal(true)}
              className={cn(ui.btnPrimary, 'shrink-0')}
              title="Search a book and reserve it"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Search &amp; Reserve</span>
            </button>

            {/* Mobile: Filter Icon */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-xl border transition md:hidden',
                showFilters || filterStatus !== 'all' || filterRole !== 'all'
                  ? 'border-brand-400 bg-brand-500/10 text-brand-600'
                  : 'border-edge/90 bg-surface/70 text-ink-soft'
              )}
              title="Filters"
            >
              <Filter className="size-4" />
            </button>
          </div>

          {/* Mobile: Collapsible Filters */}
          {showFilters && (
            <div className="fade-in flex flex-col gap-2 border-t border-glass-line pt-2 md:hidden">
              <div className="grid grid-cols-4 gap-0.5 rounded-xl border border-edge/70 bg-slate-500/[0.06] p-1">
                <button onClick={() => setFilterStatus('all')} className={cn(tabClass(filterStatus === 'all'), 'justify-center px-1 text-[11px]')}>
                  All ({stats.total})
                </button>
                <button onClick={() => setFilterStatus('pending')} className={cn(tabClass(filterStatus === 'pending'), 'justify-center px-1 text-[11px]')}>
                  Pend ({stats.pending})
                </button>
                <button onClick={() => setFilterStatus('confirmed')} className={cn(tabClass(filterStatus === 'confirmed'), 'justify-center px-1 text-[11px]')}>
                  Conf ({stats.confirmed})
                </button>
                <button onClick={() => setFilterStatus('overdue')} className={cn(tabClass(filterStatus === 'overdue'), 'justify-center px-1 text-[11px]')}>
                  Late ({stats.overdue})
                </button>
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

      {/* Reservations Table */}
      <GlassCard index={1} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-glass-line px-3.5 py-2.5">
          <span className="grid size-7 place-items-center rounded-lg bg-brand-500/10 text-brand-600">
            <BookMarked className="size-4" />
          </span>
          <h3 className="text-[13px] font-semibold text-ink">Reservation Requests</h3>
        </div>

        {/* Mobile Card View */}
        <div className="scroll-quiet min-h-0 flex-1 space-y-1.5 overflow-auto p-2 md:hidden">
          {filteredReservations.length === 0 ? (
            <EmptyState icon={BookMarked} title="No reservations found" hint="Try adjusting your filters" />
          ) : (
            filteredReservations.map((reservation) => (
              <div
                key={reservation.id}
                className="rounded-xl border border-glass-line bg-surface/60 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Pill tone={reservation.status === 'pending' ? 'warning' : 'info'} pulse={reservation.status === 'pending'}>
                        {reservation.status === 'pending' ? 'Pending' : 'Confirmed'}
                      </Pill>
                      <Pill tone={reservation.reserver_role === 'teacher' ? 'brand' : 'neutral'}>
                        {reservation.reserver_role === 'teacher' ? 'Teacher' : 'Student'}
                      </Pill>
                    </div>
                    <div className="flex items-center gap-2">
                      <h4 className="truncate text-[13px] font-semibold text-ink">{reservation.reserver_name}</h4>
                      <span className="text-[11px] text-ink-muted">({reservation.reserver_id})</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="flex-1 truncate text-[12px] font-medium text-ink-soft">{reservation.book_name}</p>
                      <span className="font-mono text-[10.5px] text-ink-muted">SR: {reservation.book?.sr_no || reservation.book_sr_no || 'N/A'}</span>
                    </div>
                    {reservation.status === 'confirmed' && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-[11px] text-ink-muted">
                          <span className="font-semibold text-ink-soft">Issued:</span> {formatDate(reservation.issue_date)}
                        </span>
                        <span className={`text-[11px] ${calculateFine(reservation.due_date, null, settings).days > 0 ? 'font-semibold text-rose-600' : 'text-ink-muted'}`}>
                          <span className="font-semibold text-ink-soft">Due:</span> {formatDate(reservation.due_date)}
                        </span>
                        {calculateFine(reservation.due_date, null, settings).amount > 0 && (
                          <Pill tone="danger">
                            Fine {formatMoney(calculateFine(reservation.due_date, null, settings).amount, settings)}
                          </Pill>
                        )}
                      </div>
                    )}
                    {reservation.status === 'pending' && (
                      <span className={`text-[11px] font-semibold tabular-nums ${
                        (() => {
                          const timeLeft = getTimeRemaining(reservation.created_at)
                          return timeLeft.expired ? 'text-rose-600' : (timeLeft.hours < 2 ? 'text-rose-600' : 'text-amber-600')
                        })()
                      }`}>
                        {(() => {
                          const timeLeft = getTimeRemaining(reservation.created_at)
                          if (timeLeft.expired) return 'Expired'
                          return `${String(timeLeft.hours).padStart(2, '0')}h:${String(timeLeft.minutes).padStart(2, '0')}m left`
                        })()}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {reservation.status === 'pending' && (
                      <button
                        onClick={() => openConfirmModal(reservation)}
                        className={cn(ui.iconBtn, 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-700')}
                        title="Confirm"
                      >
                        <CheckCircle className="size-4" />
                      </button>
                    )}
                    {reservation.status === 'confirmed' && (
                      <button
                        onClick={() => openReturnModal(reservation)}
                        className={cn(ui.iconBtn, 'bg-brand-500/10 text-brand-600 hover:bg-brand-500/20 hover:text-brand-700')}
                        title="Mark as Returned"
                      >
                        <Undo2 className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="scroll-quiet hidden min-h-0 flex-1 overflow-auto md:block">
          <table className={ui.table}>
            <thead className={ui.thead}>
              <tr>
                <th className={ui.th}>Reserver Info</th>
                <th className={ui.th}>Book SR No</th>
                <th className={ui.th}>Book Details</th>
                <th className={ui.th}>Department</th>
                <th className={ui.th}>Status</th>
                <th className={ui.th}>Issue Date</th>
                <th className={ui.th}>Due Date</th>
                <th className={ui.th}>Fine</th>
                <th className={ui.th}>Time Left</th>
                <th className={cn(ui.th, 'text-center')}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReservations.length === 0 ? (
                <tr>
                  <td colSpan="10">
                    <EmptyState icon={BookMarked} title="No reservations found" hint="Try adjusting your filters or search query" />
                  </td>
                </tr>
              ) : (
                filteredReservations.map((reservation) => (
                  <tr key={reservation.id} className={ui.tr}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-[12.5px] font-semibold text-ink">
                            {reservation.reserver_name}
                          </span>
                          <span className="text-[11px] text-ink-muted">
                            {reservation.reserver_id}
                          </span>
                        </div>
                        <span
                          className={cn(
                            'grid size-[18px] shrink-0 place-items-center rounded-md text-[9.5px] font-bold',
                            reservation.reserver_role === 'teacher'
                              ? 'bg-brand-500/12 text-brand-700'
                              : 'bg-sky-500/10 text-sky-700'
                          )}
                          title={reservation.reserver_role === 'teacher' ? 'Teacher' : 'Student'}
                        >
                          {reservation.reserver_role === 'teacher' ? 'T' : 'S'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-[12px] font-semibold text-ink-soft">
                        {reservation.book?.sr_no || reservation.book_sr_no || 'N/A'}
                      </span>
                    </td>
                    <td className="max-w-[220px] px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span
                            className="block truncate text-[12.5px] font-semibold text-ink"
                            title={reservation.book_name}
                          >
                            {reservation.book_name}
                          </span>
                          {reservation.book?.author && (
                            <span
                              className="block truncate text-[11px] text-ink-muted"
                              title={reservation.book.author}
                            >
                              {reservation.book.author}
                            </span>
                          )}
                        </div>
                        {reservation.book?.status && (
                          <span className={cn(
                            'shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                            reservation.status === 'confirmed'
                              ? 'bg-rose-500/10 text-rose-700'
                              : reservation.book.status === 'Available'
                              ? 'bg-emerald-500/10 text-emerald-700'
                              : 'bg-rose-500/10 text-rose-700'
                          )}>
                            {reservation.status === 'confirmed' ? 'Borr' : reservation.book.status === 'Available' ? 'Avail' : 'Borr'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[140px] px-3 py-2">
                      <span
                        className="block truncate text-[12px] text-ink-muted"
                        title={reservation.book?.department || 'N/A'}
                      >
                        {reservation.book?.department || 'N/A'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Pill tone={STATUS_TONE[reservation.status] || 'neutral'} pulse={reservation.status === 'pending'}>
                        {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
                      </Pill>
                    </td>
                    <td className="px-3 py-2">
                      <span className="whitespace-nowrap text-[12px] text-ink-soft">
                        {formatDate(reservation.issue_date)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {(() => {
                        if (!reservation.due_date) {
                          return <span className="text-[12px] text-ink-muted/70">-</span>
                        }
                        const overdue = reservation.status === 'confirmed' && calculateFine(reservation.due_date, null, settings).days > 0
                        return (
                          <span className={`whitespace-nowrap text-[12px] font-medium ${overdue ? 'font-semibold text-rose-600' : 'text-ink-soft'}`}>
                            {formatDate(reservation.due_date)}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-3 py-2">
                      {(() => {
                        if (reservation.status !== 'confirmed' || !reservation.due_date) {
                          return <span className="text-[12px] text-ink-muted/70">-</span>
                        }
                        const fine = calculateFine(reservation.due_date, null, settings)
                        if (fine.days === 0) {
                          return <Pill tone="success">On time</Pill>
                        }
                        return (
                          <span className="inline-flex flex-col leading-tight">
                            <span className="text-[12px] font-bold tabular-nums text-rose-700">{formatMoney(fine.amount, settings)}</span>
                            <span className="text-[10.5px] text-rose-500">{fine.days}d late</span>
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-3 py-2">
                      {reservation.status === 'pending' ? (
                        (() => {
                          const timeLeft = getTimeRemaining(reservation.created_at)
                          if (timeLeft.expired) {
                            return (
                              <Pill tone="danger" pulse>
                                Expired
                              </Pill>
                            )
                          }
                          const isUrgent = timeLeft.hours < 2
                          return (
                            <div className={cn(
                              'inline-flex items-center rounded-lg px-2 py-1 font-mono text-[11px] font-semibold tabular-nums',
                              isUrgent
                                ? 'bg-rose-500/10 text-rose-700'
                                : 'bg-amber-500/12 text-amber-700'
                            )}>
                              <div className="flex items-center gap-0.5">
                                <span>{String(timeLeft.hours).padStart(2, '0')}</span>
                                <span className="text-[9px] opacity-70">h</span>
                                <span className="mx-0.5 opacity-60">:</span>
                                <span>{String(timeLeft.minutes).padStart(2, '0')}</span>
                                <span className="text-[9px] opacity-70">m</span>
                                <span className="mx-0.5 opacity-60">:</span>
                                <span>{String(timeLeft.seconds).padStart(2, '0')}</span>
                                <span className="text-[9px] opacity-70">s</span>
                              </div>
                            </div>
                          )
                        })()
                      ) : (
                        <span className="text-[12px] text-ink-muted/70">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-center gap-1">
                        {reservation.status === 'pending' && (
                          <button
                            onClick={() => openConfirmModal(reservation)}
                            className={cn(ui.iconBtn, 'text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700')}
                            title="Confirm Reservation"
                          >
                            <CheckCircle className="size-4" />
                          </button>
                        )}
                        {reservation.status === 'confirmed' && (
                          <button
                            onClick={() => openReturnModal(reservation)}
                            className={cn(ui.iconBtn, 'text-brand-600 hover:bg-brand-500/10 hover:text-brand-700')}
                            title="Mark as Returned"
                          >
                            <Undo2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with Count */}
        <div className="border-t border-glass-line px-3.5 py-2">
          <p className="text-[11.5px] text-ink-muted">
            Showing <span className="font-semibold text-ink">{filteredReservations.length}</span> of{' '}
            <span className="font-semibold text-ink">{stats.total}</span> reservations
          </p>
        </div>
      </GlassCard>

      {/* Confirm Modal */}
      {showConfirmModal && selectedReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fade-in absolute inset-0 bg-navy-900/30 backdrop-blur-[3px]" />
          <div className="glass-strong pop-in relative flex max-h-[90vh] w-full max-w-md flex-col rounded-[22px]">
            <div className="flex items-center gap-3 border-b border-glass-line px-5 py-3.5">
              <span className={cn(
                'grid size-9 shrink-0 place-items-center rounded-xl',
                existingReservation ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'
              )}>
                {existingReservation ? (
                  <AlertTriangle className="size-[18px]" />
                ) : (
                  <CheckCircle className="size-[18px]" />
                )}
              </span>
              <h3 className="text-[15px] font-semibold text-heading">
                {existingReservation ? 'Warning!' : 'Confirm Reservation'}
              </h3>
            </div>

            <div className="scroll-quiet min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {existingReservation ? (
                <>
                  <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.07] p-3">
                    <p className="mb-1 text-[12.5px] font-semibold text-rose-700">
                      ⚠️ This user already has a confirmed reservation!
                    </p>
                    <p className="text-[12px] text-rose-700/90">
                      <span className="font-semibold">{selectedReservation.reserver_name}</span> currently has:
                    </p>
                    <div className="mt-2 rounded-lg bg-surface/80 px-2.5 py-2 ring-1 ring-rose-500/15">
                      <p className="text-[12px] font-semibold text-ink">{existingReservation.book_name}</p>
                      <p className="text-[11px] text-ink-muted">SR No: {existingReservation.book_sr_no}</p>
                    </div>
                  </div>
                  <p className="text-[12.5px] text-ink-soft">
                    Only one book can be reserved per person. Please ensure the previously borrowed book is returned before confirming this new reservation.
                  </p>
                  <div className="rounded-xl border border-glass-line bg-surface/60 p-3">
                    <p className="mb-0.5 text-[11px] text-ink-muted">Attempting to confirm:</p>
                    <p className="text-[13px] font-semibold text-ink">{selectedReservation.reserver_name}</p>
                    <p className="text-[12px] text-ink-soft">{selectedReservation.book_name}</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[12.5px] text-ink-soft">
                    Are you sure you want to confirm this reservation?
                  </p>
                  <div className="rounded-xl border border-glass-line bg-surface/60 p-3">
                    <p className="text-[13px] font-semibold text-ink">{selectedReservation.reserver_name}</p>
                    <p className="text-[12px] text-ink-soft">{selectedReservation.book_name}</p>
                  </div>
                </>
              )}

              {/* Issue date / due date — set on every reservation */}
              <div className="rounded-xl border border-brand-500/25 bg-brand-500/[0.05] p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft">
                  <CalendarDays className="size-4 text-brand-500" />
                  Loan Period
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={ui.label}>Issue Date *</label>
                    <input
                      type="date"
                      required
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className={ui.input}
                    />
                  </div>
                  <div>
                    <label className={ui.label}>Due Date *</label>
                    <input
                      type="date"
                      required
                      value={dueDate}
                      min={issueDate || undefined}
                      onChange={(e) => setDueDate(e.target.value)}
                      className={ui.input}
                    />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-ink-muted">
                  Pick when the book is due back. Every day past it is fined{' '}
                  <span className="font-semibold text-ink">{formatMoney(settings.fine_per_day, settings)}</span>.
                </p>
              </div>
            </div>

            <div className="flex gap-2 border-t border-glass-line px-5 py-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  setSelectedReservation(null)
                  setExistingReservation(null)
                }}
                className={cn(ui.btnSecondary, 'flex-1')}
              >
                Cancel
              </button>
              {existingReservation ? (
                <button
                  onClick={() => handleConfirm(selectedReservation, true)}
                  className={cn(ui.btnDanger, 'flex-1')}
                >
                  Confirm Anyway
                </button>
              ) : (
                <button
                  onClick={() => handleConfirm(selectedReservation, false)}
                  className={cn(ui.btnSuccess, 'flex-1')}
                >
                  Confirm
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search & Reserve Modal */}
      {showReserveModal && (
        <ReserveBookModal
          settings={settings}
          onClose={() => setShowReserveModal(false)}
          onCreated={fetchReservations}
        />
      )}

      {/* Return Modal */}
      {showReturnModal && selectedReservation && (() => {
        const fine = calculateFine(selectedReservation.due_date, returnDate, settings)
        const charged = Number(fineAmount)
        const chargedValid = Number.isFinite(charged) && charged >= 0
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fade-in absolute inset-0 bg-navy-900/30 backdrop-blur-[3px]" />
            <div className="glass-strong pop-in relative flex max-h-[90vh] w-full max-w-md flex-col rounded-[22px]">
              <div className="flex items-center gap-3 border-b border-glass-line px-5 py-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
                  <Undo2 className="size-[18px]" />
                </span>
                <h3 className="text-[15px] font-semibold text-heading">Return Book</h3>
              </div>

              <div className="scroll-quiet min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                <div className="rounded-xl border border-glass-line bg-surface/60 p-3">
                  <p className="text-[13px] font-semibold text-ink">{selectedReservation.reserver_name}</p>
                  <p className="text-[12px] text-ink-soft">{selectedReservation.book_name}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 border-t border-glass-line pt-2">
                    <div>
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Issued</p>
                      <p className="text-[12px] font-semibold text-ink">{formatDate(selectedReservation.issue_date)}</p>
                    </div>
                    <div>
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Due</p>
                      <p className="text-[12px] font-semibold text-ink">{formatDate(selectedReservation.due_date)}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className={ui.label}>Return Date *</label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => {
                      const value = e.target.value
                      setReturnDate(value)

                      // Re-suggest the fine for the new date; it stays editable.
                      const owed = calculateFine(selectedReservation.due_date, value, settings)
                      setFineAmount(String(owed.amount))
                      setFinePaid(owed.amount === 0)
                    }}
                    className={ui.input}
                  />
                </div>

                <div className={cn(
                  'rounded-xl border p-3',
                  fine.amount > 0 ? 'border-rose-500/25 bg-rose-500/[0.07]' : 'border-emerald-500/25 bg-emerald-500/[0.07]'
                )}>
                  {fine.amount > 0 ? (
                    <>
                      <p className="text-[13px] font-semibold text-rose-700">
                        Calculated fine: {formatMoney(fine.amount, settings)}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-rose-600">
                        {fine.days} day(s) late &times; {formatMoney(settings.fine_per_day, settings)} per day
                      </p>
                    </>
                  ) : (
                    <p className="text-[13px] font-semibold text-emerald-700">Returned on time — no fine due.</p>
                  )}
                </div>

                {/* Fine actually charged at the counter */}
                <div className="rounded-xl border border-brand-500/25 bg-brand-500/[0.05] p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft">
                    Record Fine
                  </p>

                  <label className={ui.label}>
                    Fine Charged ({settings.currency})
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={fineAmount}
                      onChange={(e) => setFineAmount(e.target.value)}
                      className={cn(ui.input, 'flex-1')}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFineAmount('0')
                        setFinePaid(true)
                      }}
                      className={ui.btnSecondary}
                      title="Charge nothing for this return"
                    >
                      Waive
                    </button>
                  </div>
                  {!chargedValid && (
                    <p className="mt-1 text-[11px] font-semibold text-rose-600">
                      Enter an amount of zero or more.
                    </p>
                  )}

                  <label className={`mt-3 flex items-center gap-2 ${chargedValid && charged > 0 ? 'cursor-pointer' : 'opacity-60'}`}>
                    <input
                      type="checkbox"
                      checked={chargedValid && charged === 0 ? true : finePaid}
                      disabled={!chargedValid || charged === 0}
                      onChange={(e) => setFinePaid(e.target.checked)}
                      className="size-4 accent-brand-500"
                    />
                    <span className="text-[12px] font-semibold text-ink">
                      Fine collected now
                    </span>
                  </label>
                  <p className="mt-1 text-[11px] text-ink-muted">
                    Leave it unticked to record the fine as outstanding — it stays on the
                    borrower&apos;s record until it is paid.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 border-t border-glass-line px-5 py-3">
                <button
                  onClick={() => {
                    setShowReturnModal(false)
                    setSelectedReservation(null)
                  }}
                  className={cn(ui.btnSecondary, 'flex-1')}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReturn(selectedReservation)}
                  disabled={!chargedValid}
                  className={cn(ui.btnPrimary, 'flex-1')}
                >
                  Confirm Return
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
