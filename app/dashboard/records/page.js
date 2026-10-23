'use client'
import { useState } from 'react'
import {
  Search,
  X,
  User,
  GraduationCap,
  BookMarked,
  AlertTriangle,
  CheckCircle,
  Coins,
  Download,
  Users
} from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { GlassCard, CardHeader, EmptyState, StatCard, Pill, ui } from '@/components/ui/glass'
import { cn } from '@/lib/utils'
import {
  getLibrarySettings,
  searchPeople,
  fetchPersonHistory,
  DEFAULT_SETTINGS,
  calculateFine,
  formatDate,
  formatMoney
} from '@/lib/librarySettings'

const ARCHIVED_STATUSES = ['returned', 'completed']

export default function RecordsPage() {
  const [mode, setMode] = useState('student') // 'student' | 'teacher'
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [matches, setMatches] = useState([])
  const [person, setPerson] = useState(null)
  const [history, setHistory] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  function resetResults() {
    setMatches([])
    setPerson(null)
    setHistory([])
  }

  function switchMode(next) {
    setMode(next)
    setQuery('')
    setHasSearched(false)
    resetResults()
  }

  async function handleSearch(e) {
    e?.preventDefault()

    const term = query.trim()
    if (!term) {
      toast.error(mode === 'student' ? 'Enter a roll number' : 'Enter a teacher name')
      return
    }

    try {
      setSearching(true)
      setHasSearched(true)
      resetResults()

      const loadedSettings = await getLibrarySettings()
      setSettings(loadedSettings)

      // Served by /api/people: `profiles` and `faculty_directory` are hidden
      // from the browser's anon key by row level security.
      const found = await searchPeople(mode, term)

      if (found.length === 0) {
        toast.error(
          mode === 'student'
            ? `No student found with roll number "${term}"`
            : `No teacher found matching "${term}"`
        )
        return
      }

      if (found.length === 1) {
        await loadRecord(found[0])
      } else {
        setMatches(found)
        toast.success(`${found.length} matches found - pick one`)
      }
    } catch (error) {
      console.error('Error searching records:', error)
      toast.error('Failed to search records')
    } finally {
      setSearching(false)
    }
  }

  /** Pull every reservation this person has ever made. */
  async function loadRecord(target) {
    try {
      setSearching(true)
      setPerson(target)
      setMatches([])
      setHistory([])

      const rows = await fetchPersonHistory(target)
      setHistory(rows)

      if (rows.length === 0) {
        toast(`No borrowing history for ${target.name}`)
      }
    } catch (error) {
      console.error('Error loading record:', error)
      toast.error('Failed to load the borrowing record')
    } finally {
      setSearching(false)
    }
  }

  /** Live fine for a row: settled rows keep their stored amount. */
  function fineFor(reservation) {
    if (ARCHIVED_STATUSES.includes(reservation.status)) {
      return {
        amount: Number(reservation.fine_amount || 0),
        days: calculateFine(reservation.due_date, reservation.return_date, settings).days
      }
    }
    if (reservation.status === 'confirmed') {
      return calculateFine(reservation.due_date, null, settings)
    }
    return { amount: 0, days: 0 }
  }

  const summary = {
    total: history.length,
    issued: history.filter(r => r.status === 'confirmed').length,
    pending: history.filter(r => r.status === 'pending').length,
    returned: history.filter(r => ARCHIVED_STATUSES.includes(r.status)).length,
    overdue: history.filter(r => r.status === 'confirmed' && fineFor(r).days > 0).length,
    finesTotal: history.reduce((sum, r) => sum + fineFor(r).amount, 0),
    finesUnpaid: history
      .filter(r => !r.fine_paid)
      .reduce((sum, r) => sum + fineFor(r).amount, 0)
  }

  function exportRecord() {
    if (!person || history.length === 0) {
      toast.error('Nothing to export')
      return
    }

    const rows = history.map(r => ({
      'Book SR No': r.book_sr_no || '',
      'Book ID': r.book_id || '',
      'Book Name': r.book_name || '',
      'Author': r.book?.author || '',
      'Department': r.book?.department || '',
      'Status': r.status,
      'Issue Date': r.issue_date || '',
      'Due Date': r.due_date || '',
      'Return Date': r.return_date || '',
      'Days Late': fineFor(r).days,
      [`Fine (${settings.currency})`]: fineFor(r).amount,
      'Fine Paid': r.fine_paid ? 'Yes' : 'No',
      'Reserved On': r.reservation_date ? new Date(r.reservation_date).toLocaleString() : ''
    }))

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Record')

    const safeName = `${person.identifier || person.name}`.replace(/[^a-z0-9]+/gi, '_')
    XLSX.writeFile(workbook, `library_record_${safeName}.xlsx`)
    toast.success('Record exported')
  }

  const statusTones = {
    pending: 'warning',
    confirmed: 'info',
    returned: 'success',
    completed: 'success',
    deleted: 'neutral'
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scroll-quiet flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {/* Search Panel */}
        <GlassCard index={0} className="shrink-0 p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            {/* Mode toggle */}
            <div className="grid shrink-0 grid-cols-2 gap-1 rounded-xl border border-edge/80 bg-surface/50 p-1 sm:flex sm:w-fit">
              <button
                onClick={() => switchMode('student')}
                className={cn(
                  'flex h-7 items-center justify-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition',
                  mode === 'student'
                    ? 'bg-brand-500 text-white shadow-[0_6px_14px_-6px_rgba(238,122,26,0.7)]'
                    : 'text-ink-soft hover:bg-surface hover:text-ink'
                )}
              >
                <GraduationCap className="size-4" />
                Student (Roll No)
              </button>
              <button
                onClick={() => switchMode('teacher')}
                className={cn(
                  'flex h-7 items-center justify-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition',
                  mode === 'teacher'
                    ? 'bg-brand-500 text-white shadow-[0_6px_14px_-6px_rgba(238,122,26,0.7)]'
                    : 'text-ink-soft hover:bg-surface hover:text-ink'
                )}
              >
                <User className="size-4" />
                Teacher (Name)
              </button>
            </div>

            {/* Search field */}
            <form onSubmit={handleSearch} className="flex flex-1 flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    mode === 'student'
                      ? 'Enter roll number, e.g. 2021-CS-045'
                      : 'Enter teacher name, e.g. Ahmed Raza'
                  }
                  className={cn(ui.input, 'pl-9 pr-9')}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => { setQuery(''); setHasSearched(false); resetResults() }}
                    className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-ink-muted transition hover:bg-surface hover:text-ink"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <button type="submit" disabled={searching} className={ui.btnPrimary}>
                {searching ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
                ) : (
                  <Search className="size-4" />
                )}
                Search
              </button>
            </form>
          </div>
        </GlassCard>

        {/* Multiple matches - pick one */}
        {matches.length > 0 && (
          <GlassCard index={1} className="shrink-0 overflow-hidden">
            <CardHeader title={`${matches.length} matches - select one`} />
            <div className="scroll-quiet max-h-72 divide-y divide-glass-line overflow-y-auto border-t border-glass-line">
              {matches.map(m => (
                <button
                  key={`${m.kind}-${m.id || m.key}`}
                  onClick={() => loadRecord(m)}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-surface/60"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-600">
                    <Users className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-ink">{m.name}</span>
                    <span className="block truncate text-[11.5px] text-ink-muted">
                      {m.identifier}{m.department ? ` - ${m.department}` : ''}
                      {m.directoryOnly ? ' - not registered yet' : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Empty state */}
        {!person && matches.length === 0 && (
          <GlassCard index={1} className="flex min-h-[220px] flex-1 flex-col">
            <EmptyState
              icon={BookMarked}
              title={hasSearched && !searching ? 'No record found' : 'Search a complete borrowing record'}
              hint={mode === 'student'
                ? 'Look up a student by their roll number.'
                : 'Look up a teacher by their name.'}
            />
          </GlassCard>
        )}

        {/* The record */}
        {person && (
          <>
            {/* Profile card */}
            <GlassCard index={1} className="shrink-0">
              <CardHeader
                title={
                  <span className="flex items-center gap-1.5">
                    {person.kind === 'teacher' ? <User className="size-4 text-brand-600" /> : <GraduationCap className="size-4 text-brand-600" />}
                    {person.kind === 'teacher' ? 'Teacher' : 'Student'} Profile
                  </span>
                }
              >
                <button onClick={exportRecord} className={cn(ui.btnSecondary, 'h-8 px-3 text-[12px]')}>
                  <Download className="size-3.5" />
                  Export
                </button>
              </CardHeader>
              <div className="grid grid-cols-2 gap-2 px-3.5 pb-3.5 sm:grid-cols-3 lg:grid-cols-6">
                <Field label="Name" value={person.name} />
                <Field label={person.kind === 'teacher' ? 'Official Email' : 'Roll Number'} value={person.identifier} />
                <Field label="Department" value={person.department} />
                <Field label="Email" value={person.email} />
                <Field label="Father Name" value={person.father_name} />
                <Field label="CNIC" value={person.cnic} />
              </div>
            </GlassCard>

            {/* Summary */}
            <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <StatCard index={2} icon={BookMarked} label="Total" value={summary.total} tone="brand" />
              <StatCard index={3} icon={BookMarked} label="Issued" value={summary.issued} tone="info" />
              <StatCard index={4} icon={BookMarked} label="Pending" value={summary.pending} tone="navy" />
              <StatCard index={5} icon={CheckCircle} label="Returned" value={summary.returned} tone="success" />
              <StatCard index={6} icon={AlertTriangle} label="Overdue" value={summary.overdue} tone="danger" />
              <StatCard
                index={7}
                icon={Coins}
                label="Fines Due"
                value={formatMoney(summary.finesUnpaid, settings)}
                tone="danger"
              />
            </div>

            {/* History table */}
            <GlassCard index={8} className="flex min-h-[320px] flex-1 flex-col overflow-hidden">
              <CardHeader
                title={
                  <span className="flex items-center gap-1.5">
                    <BookMarked className="size-4 text-brand-600" />
                    Complete Borrowing History
                  </span>
                }
              />

              {/* Mobile cards */}
              <div className="scroll-quiet min-h-0 flex-1 space-y-1.5 overflow-auto px-3 pb-3 md:hidden">
                {history.length === 0 ? (
                  <p className="py-6 text-center text-[12.5px] text-ink-muted">No borrowing history</p>
                ) : (
                  history.map(r => {
                    const fine = fineFor(r)
                    return (
                      <div key={r.id} className="rounded-xl border border-glass-line bg-surface/50 px-3 py-2">
                        <div className="mb-1 flex items-center gap-1.5">
                          <Pill tone={statusTones[r.status] || 'neutral'}>
                            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </Pill>
                          <span className="ml-auto font-mono text-[11px] text-ink-muted">SR: {r.book_sr_no || 'N/A'}</span>
                        </div>
                        <p className="truncate text-[13px] font-semibold text-ink">{r.book_name}</p>
                        {r.book?.author && <p className="truncate text-[11.5px] text-ink-muted">{r.book.author}</p>}
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-ink-muted">
                          <span>
                            <span className="font-semibold text-ink-soft">Issued:</span> {formatDate(r.issue_date)}
                          </span>
                          <span>
                            <span className="font-semibold text-ink-soft">Due:</span> {formatDate(r.due_date)}
                          </span>
                          <span>
                            <span className="font-semibold text-ink-soft">Returned:</span> {formatDate(r.return_date)}
                          </span>
                          {fine.amount > 0 && (
                            <Pill tone="danger">
                              Fine {formatMoney(fine.amount, settings)} ({fine.days}d)
                            </Pill>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Desktop table */}
              <div className="scroll-quiet hidden min-h-0 flex-1 overflow-auto border-t border-glass-line md:block">
                <table className={ui.table}>
                  <thead className={ui.thead}>
                    <tr>
                      <th className={ui.th}>Book SR No</th>
                      <th className={ui.th}>Book Details</th>
                      <th className={ui.th}>Department</th>
                      <th className={ui.th}>Status</th>
                      <th className={ui.th}>Issue Date</th>
                      <th className={ui.th}>Due Date</th>
                      <th className={ui.th}>Return Date</th>
                      <th className={ui.th}>Fine</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan="8">
                          <EmptyState
                            icon={BookMarked}
                            title="No borrowing history"
                            hint={`${person.name} has not reserved any book yet`}
                          />
                        </td>
                      </tr>
                    ) : (
                      history.map((r, index) => {
                        const fine = fineFor(r)
                        const isLate = fine.days > 0
                        return (
                          <tr key={r.id} className={ui.tr}>
                            <td className={cn(ui.td, 'py-2')}>
                              <span className="font-mono text-[12px] font-semibold text-ink">{r.book_sr_no || 'N/A'}</span>
                            </td>
                            <td className={cn(ui.td, 'max-w-[240px] py-2')}>
                              <span className="block truncate text-[13px] font-semibold text-ink" title={r.book_name}>
                                {r.book_name}
                              </span>
                              {r.book?.author && (
                                <span className="block truncate text-[11.5px] text-ink-muted" title={r.book.author}>
                                  {r.book.author}
                                </span>
                              )}
                            </td>
                            <td className={cn(ui.td, 'max-w-[140px] py-2')}>
                              <span className="block truncate text-[12px]">{r.book?.department || '-'}</span>
                            </td>
                            <td className={cn(ui.td, 'py-2')}>
                              <Pill tone={statusTones[r.status] || 'neutral'}>
                                {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                              </Pill>
                            </td>
                            <td className={cn(ui.td, 'py-2')}>
                              <span className="whitespace-nowrap text-[12px]">{formatDate(r.issue_date)}</span>
                            </td>
                            <td className={cn(ui.td, 'py-2')}>
                              <span className={cn('whitespace-nowrap text-[12px]', isLate && 'font-semibold text-rose-600')}>
                                {formatDate(r.due_date)}
                              </span>
                            </td>
                            <td className={cn(ui.td, 'py-2')}>
                              <span className="whitespace-nowrap text-[12px]">{formatDate(r.return_date)}</span>
                            </td>
                            <td className={cn(ui.td, 'py-2')}>
                              {fine.amount > 0 ? (
                                <Pill tone={r.fine_paid ? 'success' : 'danger'}>
                                  {formatMoney(fine.amount, settings)}{r.fine_paid ? ' paid' : ''}
                                </Pill>
                              ) : (
                                <span className="text-[12px] text-ink-muted/70">-</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-glass-line px-4 py-2 text-[12px] text-ink-muted">
                <p>
                  <span className="font-semibold text-ink">{history.length}</span> reservation(s) on record
                </p>
                <p>
                  Total fines charged:{' '}
                  <span className="font-semibold text-rose-600">{formatMoney(summary.finesTotal, settings)}</span>
                </p>
              </div>
            </GlassCard>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="rounded-xl border border-glass-line bg-surface/50 px-2.5 py-2">
      <p className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{label}</p>
      <p className="break-words text-[12.5px] font-medium text-ink">{value || 'N/A'}</p>
    </div>
  )
}
