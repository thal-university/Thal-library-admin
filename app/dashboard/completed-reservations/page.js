"use client"
import { useEffect, useState } from 'react'
import Loader from '@/components/Loader'
import { BookMarked, Search, X, CheckCircle, Trash2, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { GlassCard, EmptyState, StatCard, Pill, ui } from '@/components/ui/glass'
import Select from '@/components/ui/Select'
import { cn } from '@/lib/utils'
import {
  formatDate,
  formatMoney,
  DEFAULT_SETTINGS,
  getLibrarySettings,
  fetchReservationsList
} from '@/lib/librarySettings'

const ROLE_OPTIONS = [['all', 'All Roles'], ['student', 'Students'], ['teacher', 'Teachers']]

export default function CompletedReservationsPage() {
  const [loading, setLoading] = useState(true)
  const [reservations, setReservations] = useState([])
  const [filterRole, setFilterRole] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    deleted: 0,
    fines: 0
  })

  useEffect(() => {
    fetchReservations()
    getLibrarySettings().then(setSettings)

    // Polled rather than subscribed: Supabase realtime honours row level
    // security, which hides `reservations` from the anon key.
    const refreshInterval = setInterval(fetchReservations, 10000)

    return () => clearInterval(refreshInterval)
  }, [])

  async function fetchReservations() {
    try {
      const allReservations = await fetchReservationsList('archived')
      setReservations(allReservations)

      const completedCount = allReservations.filter(
        r => r.status === 'returned' || r.status === 'completed'
      ).length
      const deletedCount = allReservations.filter(r => r.status === 'deleted').length
      const finesTotal = allReservations.reduce((sum, r) => sum + Number(r.fine_amount || 0), 0)

      setStats({
        total: allReservations.length,
        completed: completedCount,
        deleted: deletedCount,
        fines: finesTotal
      })
    } catch (error) {
      console.error('Error fetching completed reservations:', error)
      toast.error('Failed to fetch completed reservations')
    } finally {
      setLoading(false)
    }
  }

  function formatUpdatedAt(ts) {
    if (!ts) return '-'
    try {
      const d = new Date(ts)
      return d.toLocaleString()
    } catch (e) {
      return '-'
    }
  }

  if (loading) return <Loader inline />

  const filteredReservations = reservations.filter(r => {
    if (filterRole !== 'all' && r.reserver_role !== filterRole) return false
    if (filterType === 'completed') {
      if (r.status !== 'returned' && r.status !== 'completed') return false
    } else if (filterType !== 'all' && r.status !== filterType) {
      return false
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        r.reserver_name.toLowerCase().includes(q) ||
        r.reserver_id.toLowerCase().includes(q) ||
        r.book_name.toLowerCase().includes(q) ||
        (r.book?.author && r.book.author.toLowerCase().includes(q))
      )
    }
    return true
  })

  const segBtn = (active) => cn(
    'inline-flex h-7 items-center justify-center rounded-lg px-3 text-[12.5px] font-semibold transition',
    active
      ? 'bg-brand-500 text-white shadow-[0_6px_14px_-6px_rgba(238,122,26,0.7)]'
      : 'text-ink-soft hover:bg-surface hover:text-ink'
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Stats Cards */}
      <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard index={0} icon={BookMarked} label="Total" value={stats.total} tone="brand" />
        <StatCard index={1} icon={CheckCircle} label="Done" value={stats.completed} tone="success" />
        <StatCard index={2} icon={Trash2} label="Deleted" value={stats.deleted} tone="navy" />
        <StatCard index={3} icon={BookMarked} label="Fines" value={formatMoney(stats.fines, settings)} tone="danger" />
      </div>

      {/* Search, Filters and Table */}
      <GlassCard index={4} className="flex min-h-[360px] flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex shrink-0 flex-col gap-2 border-b border-glass-line p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                placeholder="Search..."
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
            <div className="hidden flex-wrap items-center gap-2 md:flex">
              <div className="flex items-center gap-1 rounded-xl border border-edge/80 bg-surface/50 p-1">
                <button onClick={() => setFilterType('all')} className={segBtn(filterType === 'all')}>
                  All ({stats.total})
                </button>
                <button onClick={() => setFilterType('completed')} className={segBtn(filterType === 'completed')}>
                  Completed ({stats.completed})
                </button>
                <button onClick={() => setFilterType('deleted')} className={segBtn(filterType === 'deleted')}>
                  Deleted ({stats.deleted})
                </button>
              </div>
              <Select
                label="Role"
                value={filterRole}
                onChange={setFilterRole}
                options={ROLE_OPTIONS}
              />
            </div>

            {/* Mobile: Filter Icon */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-xl border transition md:hidden',
                showFilters || filterType !== 'all' || filterRole !== 'all'
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-edge/90 bg-surface/70 text-ink-soft hover:text-ink'
              )}
              title="Filters"
            >
              <Filter className="size-4" />
            </button>
          </div>

          {/* Mobile: Collapsible Filters */}
          {showFilters && (
            <div className="fade-in flex flex-col gap-2 border-t border-glass-line pt-2 md:hidden">
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-edge/80 bg-surface/50 p-1">
                <button onClick={() => setFilterType('all')} className={segBtn(filterType === 'all')}>
                  All ({stats.total})
                </button>
                <button onClick={() => setFilterType('completed')} className={segBtn(filterType === 'completed')}>
                  Done ({stats.completed})
                </button>
                <button onClick={() => setFilterType('deleted')} className={segBtn(filterType === 'deleted')}>
                  Del ({stats.deleted})
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

        {/* Mobile Card View */}
        <div className="scroll-quiet min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3 md:hidden">
          {filteredReservations.length === 0 ? (
            <EmptyState
              icon={BookMarked}
              title="No completed reservations"
              hint="Try adjusting your filters"
            />
          ) : (
            filteredReservations.map((reservation) => (
              <div
                key={reservation.id}
                className="rounded-xl border border-glass-line bg-surface/50 px-3 py-2"
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <Pill tone={reservation.status === 'deleted' ? 'neutral' : 'success'}>
                    {reservation.status === 'deleted' ? 'Del' : 'Done'}
                  </Pill>
                  <Pill tone={reservation.reserver_role === 'teacher' ? 'brand' : 'info'}>
                    {reservation.reserver_role === 'teacher' ? 'Teacher' : 'Student'}
                  </Pill>
                  <span className="ml-auto text-[10.5px] text-ink-muted">{formatUpdatedAt(reservation.updated_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <h4 className="truncate text-[13px] font-semibold text-ink">{reservation.reserver_name}</h4>
                  <span className="text-[11.5px] text-ink-muted">({reservation.reserver_id})</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="flex-1 truncate text-[12.5px] font-medium text-ink-soft">{reservation.book_name}</p>
                  <span className="font-mono text-[11px] text-ink-muted">SR: {reservation.book?.sr_no || reservation.book_sr_no || 'N/A'}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-ink-muted">
                  <span>
                    <span className="font-semibold text-ink-soft">Issued:</span> {formatDate(reservation.issue_date)}
                  </span>
                  <span>
                    <span className="font-semibold text-ink-soft">Due:</span> {formatDate(reservation.due_date)}
                  </span>
                  <span>
                    <span className="font-semibold text-ink-soft">Returned:</span> {formatDate(reservation.return_date)}
                  </span>
                  {Number(reservation.fine_amount || 0) > 0 && (
                    <Pill tone={reservation.fine_paid ? 'success' : 'danger'}>
                      Fine {formatMoney(reservation.fine_amount, settings)}
                    </Pill>
                  )}
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
                <th className={ui.th}>Returned</th>
                <th className={ui.th}>Fine</th>
                <th className={ui.th}>Updated At</th>
              </tr>
            </thead>
            <tbody>
              {filteredReservations.length === 0 ? (
                <tr>
                  <td colSpan="10">
                    <EmptyState
                      icon={BookMarked}
                      title="No completed reservations found"
                      hint="Try adjusting your filters or search query"
                    />
                  </td>
                </tr>
              ) : (
                filteredReservations.map((reservation, index) => (
                  <tr key={reservation.id} className={ui.tr}>
                    <td className={cn(ui.td, 'py-2')}>
                      <div className="flex items-center gap-1.5">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-[13px] font-semibold text-ink">
                            {reservation.reserver_name}
                          </span>
                          <span className="text-[11.5px] text-ink-muted">
                            {reservation.reserver_id}
                          </span>
                        </div>
                        <span className={cn(
                          'grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-bold',
                          reservation.reserver_role === 'teacher'
                            ? 'bg-brand-500/10 text-brand-700'
                            : 'bg-sky-500/10 text-sky-700'
                        )}>
                          {reservation.reserver_role === 'teacher' ? 'T' : 'S'}
                        </span>
                      </div>
                    </td>
                    <td className={cn(ui.td, 'py-2')}>
                      <span className="font-mono text-[12px] font-semibold text-ink">
                        {reservation.book?.sr_no || reservation.book_sr_no || 'N/A'}
                      </span>
                    </td>
                    <td className={cn(ui.td, 'max-w-[220px] py-2')}>
                      <div className="flex items-center gap-1.5">
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span
                            className="block truncate text-[13px] font-semibold text-ink"
                            title={reservation.book_name}
                          >
                            {reservation.book_name}
                          </span>
                          {reservation.book?.author && (
                            <span
                              className="block truncate text-[11.5px] text-ink-muted"
                              title={reservation.book.author}
                            >
                              {reservation.book.author}
                            </span>
                          )}
                        </div>
                        {reservation.book?.status && (
                          <span className={cn(
                            'shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                            reservation.book.status === 'Available'
                              ? 'bg-emerald-500/10 text-emerald-700'
                              : 'bg-rose-500/10 text-rose-700'
                          )}>
                            {reservation.book.status === 'Available' ? 'Avail' : 'Borr'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={cn(ui.td, 'max-w-[140px] py-2')}>
                      <span
                        className="block truncate text-[12px]"
                        title={reservation.book?.department || 'N/A'}
                      >
                        {reservation.book?.department || 'N/A'}
                      </span>
                    </td>
                    <td className={cn(ui.td, 'py-2')}>
                      <Pill tone={
                        reservation.status === 'returned' || reservation.status === 'completed'
                          ? 'success'
                          : reservation.status === 'deleted'
                          ? 'neutral'
                          : 'warning'
                      }>
                        {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
                      </Pill>
                    </td>
                    <td className={cn(ui.td, 'py-2')}>
                      <span className="whitespace-nowrap text-[12px]">{formatDate(reservation.issue_date)}</span>
                    </td>
                    <td className={cn(ui.td, 'py-2')}>
                      <span className="whitespace-nowrap text-[12px]">{formatDate(reservation.due_date)}</span>
                    </td>
                    <td className={cn(ui.td, 'py-2')}>
                      <span className="whitespace-nowrap text-[12px]">{formatDate(reservation.return_date)}</span>
                    </td>
                    <td className={cn(ui.td, 'py-2')}>
                      {Number(reservation.fine_amount || 0) > 0 ? (
                        <Pill tone={reservation.fine_paid ? 'success' : 'danger'}>
                          {formatMoney(reservation.fine_amount, settings)}{reservation.fine_paid ? ' • paid' : ''}
                        </Pill>
                      ) : (
                        <span className="text-[12px] text-ink-muted/70">-</span>
                      )}
                    </td>
                    <td className={cn(ui.td, 'py-2')}>
                      <span className="whitespace-nowrap text-[11.5px] text-ink-muted">{formatUpdatedAt(reservation.updated_at)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with Count */}
        <div className="shrink-0 border-t border-glass-line px-4 py-2">
          <p className="text-[12px] text-ink-muted">
            Showing <span className="font-semibold text-ink">{filteredReservations.length}</span> of{' '}
            <span className="font-semibold text-ink">{reservations.length}</span> completed reservations
          </p>
        </div>
      </GlassCard>
    </div>
  )
}
