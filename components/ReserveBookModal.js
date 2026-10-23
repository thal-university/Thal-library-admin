'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { createReservation, searchPeople, formatMoney, today } from '@/lib/librarySettings'
import { Search, X, BookOpen, CheckCircle, CalendarDays, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Pill, ui } from '@/components/ui/glass'
import { cn } from '@/lib/utils'

/**
 * Admin "Search & Reserve" drawer.
 *
 * Step 1 — find an available book by name, author or serial number.
 * Step 2 — find the borrower (student by roll number, teacher by name), or
 *          type their details in by hand for a walk-in.
 * Step 3 — set the loan period and reserve.
 *
 * @param {{ settings: Object, onClose: () => void, onCreated: () => void }} props
 */
export default function ReserveBookModal({ settings, onClose, onCreated }) {
  const [bookQuery, setBookQuery] = useState('')
  const [bookResults, setBookResults] = useState([])
  const [searchingBooks, setSearchingBooks] = useState(false)
  const [selectedBook, setSelectedBook] = useState(null)

  const [role, setRole] = useState('student')
  const [personQuery, setPersonQuery] = useState('')
  const [personResults, setPersonResults] = useState([])
  const [searchingPeople, setSearchingPeople] = useState(false)
  const [reserver, setReserver] = useState({ id: null, reserver_id: '', reserver_name: '' })

  const [issueDate, setIssueDate] = useState(today())
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  // Debounced book search
  useEffect(() => {
    const term = bookQuery.trim()
    if (term.length < 2) {
      setBookResults([])
      return
    }

    const timer = setTimeout(() => { searchBooks(term) }, 300)
    return () => clearTimeout(timer)
  }, [bookQuery])

  // Debounced borrower search
  useEffect(() => {
    const term = personQuery.trim()
    if (term.length < 2) {
      setPersonResults([])
      return
    }

    const timer = setTimeout(() => { lookUpPeople(term) }, 300)
    return () => clearTimeout(timer)
  }, [personQuery, role])

  async function searchBooks(term) {
    try {
      setSearchingBooks(true)

      let query = supabase
        .from('books')
        .select('id, book_id, name, author, edition, department, sr_no, status')
        .or(`name.ilike.%${term}%,author.ilike.%${term}%,sr_no.ilike.%${term}%`)
        .order('name')
        .limit(20)

      // A bare number is almost always a book id
      if (/^\d+$/.test(term)) {
        query = supabase
          .from('books')
          .select('id, book_id, name, author, edition, department, sr_no, status')
          .or(`book_id.eq.${term},sr_no.ilike.%${term}%,name.ilike.%${term}%`)
          .order('name')
          .limit(20)
      }

      const { data, error } = await query
      if (error) throw error

      setBookResults(data || [])
    } catch (error) {
      console.error('Error searching books:', error)
      toast.error('Failed to search books')
    } finally {
      setSearchingBooks(false)
    }
  }

  async function lookUpPeople(term) {
    try {
      setSearchingPeople(true)

      // Served by /api/people: row level security hides `profiles` and
      // `faculty_directory` from the browser's anon key.
      const found = await searchPeople(role, term)

      setPersonResults(found.map(p => ({
        id: p.id,
        key: p.key,
        label: p.name,
        sub: `${p.identifier || ''}${p.department ? ` - ${p.department}` : ''}${p.directoryOnly ? ' - not registered yet' : ''}`,
        reserver_id: p.identifier || p.name,
        reserver_name: p.name
      })))
    } catch (error) {
      console.error('Error searching people:', error)
      toast.error('Failed to search borrowers')
    } finally {
      setSearchingPeople(false)
    }
  }

  function pickPerson(person) {
    setReserver({
      id: person.id,
      reserver_id: person.reserver_id || '',
      reserver_name: person.reserver_name || ''
    })
    setPersonResults([])
    setPersonQuery('')
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!selectedBook) {
      toast.error('Pick a book first')
      return
    }

    if (!reserver.reserver_name.trim() || !reserver.reserver_id.trim()) {
      toast.error('Enter the borrower name and ID')
      return
    }

    if (!issueDate || !dueDate) {
      toast.error('Set both an issue date and a due date')
      return
    }

    if (new Date(dueDate) < new Date(issueDate)) {
      toast.error('Due date cannot be earlier than the issue date')
      return
    }

    try {
      setSaving(true)

      await createReservation({
        book_id: selectedBook.book_id,
        reserver_id: reserver.reserver_id.trim(),
        reserver_name: reserver.reserver_name.trim(),
        reserver_role: role,
        user_id: reserver.id,
        issue_date: issueDate,
        due_date: dueDate,
        status: 'confirmed'
      })

      toast.success(`"${selectedBook.name}" reserved for ${reserver.reserver_name}`)
      onCreated?.()
      onClose?.()
    } catch (error) {
      console.error('Error creating reservation:', error)
      toast.error(`Failed to reserve: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const stepTitle = 'mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft'
  const stepNum = 'grid size-5 place-items-center rounded-md bg-brand-500/12 text-[10.5px] font-bold text-brand-700'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end p-2 sm:p-3"
      onClick={onClose}
    >
      <div className="fade-in absolute inset-0 bg-navy-900/30 backdrop-blur-[3px]" />
      <div
        className="glass-strong pop-in relative flex h-full w-full max-w-lg flex-col overflow-hidden rounded-[22px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-glass-line px-5 py-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
            <BookOpen className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-heading">Search &amp; Reserve</h2>
            <p className="mt-0.5 text-[12px] text-ink-muted">Pick a book, a borrower and the loan period</p>
          </div>
          <button type="button" onClick={onClose} className={ui.iconBtn} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="scroll-quiet min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {/* Step 1 - book */}
            <section>
              <h3 className={stepTitle}>
                <span className={stepNum}>1</span>
                Choose a book
              </h3>

              {selectedBook ? (
                <div className="rounded-xl border border-brand-500/25 bg-brand-500/[0.05] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink">{selectedBook.name}</p>
                      <p className="text-[12px] text-ink-soft">{selectedBook.author || 'Unknown author'}</p>
                      <p className="mt-1 text-[11px] text-ink-muted">
                        SR: {selectedBook.sr_no || 'N/A'} &middot; ID: {selectedBook.book_id}
                        {selectedBook.department ? ` · ${selectedBook.department}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedBook(null); setBookResults([]); setBookQuery('') }}
                      className="whitespace-nowrap rounded-lg px-2 py-1 text-[12px] font-semibold text-brand-600 transition hover:bg-brand-500/10 hover:text-brand-700"
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                    <input
                      type="text"
                      value={bookQuery}
                      onChange={(e) => setBookQuery(e.target.value)}
                      placeholder="Search by title, author, SR no or book ID"
                      className={cn(ui.input, 'pl-9 pr-9')}
                    />
                    {searchingBooks && (
                      <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-brand-500" />
                    )}
                  </div>

                  {bookResults.length > 0 && (
                    <div className="scroll-quiet mt-2 max-h-56 divide-y divide-glass-line overflow-y-auto rounded-xl border border-glass-line bg-surface/60">
                      {bookResults.map(book => {
                        const available = book.status === 'Available'
                        return (
                          <button
                            key={book.id}
                            type="button"
                            disabled={!available}
                            onClick={() => { setSelectedBook(book); setBookResults([]) }}
                            className={`w-full px-3 py-2 text-left transition-colors ${
                              available ? 'hover:bg-surface' : 'cursor-not-allowed opacity-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-semibold text-ink">{book.name}</p>
                                <p className="truncate text-[11px] text-ink-muted">
                                  {book.author || 'Unknown'} &middot; SR: {book.sr_no || 'N/A'}
                                </p>
                              </div>
                              <Pill tone={available ? 'success' : 'danger'}>
                                {available ? 'Available' : 'Allocated'}
                              </Pill>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {bookQuery.trim().length >= 2 && !searchingBooks && bookResults.length === 0 && (
                    <p className="mt-2 text-[12px] text-ink-muted">No books match &ldquo;{bookQuery}&rdquo;</p>
                  )}
                </>
              )}
            </section>

            {/* Step 2 - borrower */}
            <section>
              <h3 className={stepTitle}>
                <span className={stepNum}>2</span>
                Choose the borrower
              </h3>

              <div className="mb-3 grid grid-cols-2 gap-0.5 rounded-xl border border-edge/70 bg-slate-500/[0.06] p-1">
                {['student', 'teacher'].map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setRole(option)
                      setPersonResults([])
                      setPersonQuery('')
                      setReserver({ id: null, reserver_id: '', reserver_name: '' })
                    }}
                    className={cn(
                      'h-7 rounded-lg text-[12px] font-semibold transition',
                      role === option
                        ? 'bg-surface text-ink shadow-[0_2px_8px_-3px_rgba(30,50,90,0.3)]'
                        : 'text-ink-muted hover:text-ink'
                    )}
                  >
                    {option === 'student' ? 'Student' : 'Teacher'}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  value={personQuery}
                  onChange={(e) => setPersonQuery(e.target.value)}
                  placeholder={role === 'student' ? 'Search by roll number or name' : 'Search by teacher name'}
                  className={cn(ui.input, 'pl-9 pr-9')}
                />
                {searchingPeople && (
                  <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-brand-500" />
                )}
              </div>

              {personResults.length > 0 && (
                <div className="scroll-quiet mt-2 max-h-48 divide-y divide-glass-line overflow-y-auto rounded-xl border border-glass-line bg-surface/60">
                  {personResults.map(person => (
                    <button
                      key={`${person.id || person.key}-${person.reserver_id}`}
                      type="button"
                      onClick={() => pickPerson(person)}
                      className="w-full px-3 py-2 text-left transition-colors hover:bg-surface"
                    >
                      <p className="truncate text-[13px] font-semibold text-ink">{person.label}</p>
                      <p className="truncate text-[11px] text-ink-muted">{person.sub}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Always editable, so a walk-in with no profile can still be served */}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className={ui.label}>
                    Borrower Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={reserver.reserver_name}
                    onChange={(e) => setReserver({ ...reserver, reserver_name: e.target.value, id: null })}
                    className={ui.input}
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className={ui.label}>
                    {role === 'student' ? 'Roll Number *' : 'Teacher ID / Email *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={reserver.reserver_id}
                    onChange={(e) => setReserver({ ...reserver, reserver_id: e.target.value, id: null })}
                    className={ui.input}
                    placeholder={role === 'student' ? '2021-CS-045' : 'name@thal.edu.pk'}
                  />
                </div>
              </div>
            </section>

            {/* Step 3 - dates */}
            <section>
              <h3 className={stepTitle}>
                <span className={stepNum}>3</span>
                <CalendarDays className="size-4 text-brand-500" />
                Loan period
              </h3>
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
                    min={issueDate || undefined}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={ui.input}
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-ink-muted">
                Pick when the book is due back. Every day past it is fined{' '}
                <span className="font-semibold text-ink">{formatMoney(settings.fine_per_day, settings)}</span>.
              </p>
            </section>
          </div>

          <div className="flex gap-2 border-t border-glass-line px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={cn(ui.btnSecondary, 'flex-1')}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !selectedBook}
              className={cn(ui.btnPrimary, 'flex-1')}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Reserving...
                </>
              ) : (
                <>
                  <CheckCircle className="size-4" />
                  Reserve Book
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
