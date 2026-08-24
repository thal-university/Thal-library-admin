'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { createReservation, searchPeople, formatMoney, today } from '@/lib/librarySettings'
import { Search, X, BookOpen, CheckCircle, CalendarDays, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

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

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end"
      onClick={onClose}
    >
      <div
        className="bg-white h-full w-full max-w-lg shadow-2xl border-l-2 border-[#fe9800] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#002147] px-5 py-4 sticky top-0 z-10 border-b-2 border-[#fe9800] flex items-center justify-between">
          <h2 className="text-xl font-bold text-white font-serif flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            Search &amp; Reserve
          </h2>
          <button onClick={onClose} className="p-1.5 text-white hover:text-[#fe9800]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Step 1 - book */}
          <section>
            <h3 className="text-xs font-bold text-[#002147] uppercase tracking-wide mb-2">
              1. Choose a book
            </h3>

            {selectedBook ? (
              <div className="bg-gray-50 rounded-lg p-3 border-2 border-[#002147]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#002147]">{selectedBook.name}</p>
                    <p className="text-xs text-gray-600">{selectedBook.author || 'Unknown author'}</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      SR: {selectedBook.sr_no || 'N/A'} &middot; ID: {selectedBook.book_id}
                      {selectedBook.department ? ` · ${selectedBook.department}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedBook(null); setBookResults([]); setBookQuery('') }}
                    className="text-xs font-bold text-[#fe9800] hover:text-[#002147] whitespace-nowrap"
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#fe9800]" />
                  <input
                    type="text"
                    value={bookQuery}
                    onChange={(e) => setBookQuery(e.target.value)}
                    placeholder="Search by title, author, SR no or book ID"
                    className="w-full pl-9 pr-9 py-2.5 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 text-sm focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none"
                  />
                  {searchingBooks && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#fe9800] animate-spin" />
                  )}
                </div>

                {bookResults.length > 0 && (
                  <div className="mt-2 border-2 border-gray-200 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">
                    {bookResults.map(book => {
                      const available = book.status === 'Available'
                      return (
                        <button
                          key={book.id}
                          type="button"
                          disabled={!available}
                          onClick={() => { setSelectedBook(book); setBookResults([]) }}
                          className={`w-full text-left px-3 py-2 transition-colors ${
                            available ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#002147] truncate">{book.name}</p>
                              <p className="text-[11px] text-gray-500 truncate">
                                {book.author || 'Unknown'} &middot; SR: {book.sr_no || 'N/A'}
                              </p>
                            </div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                              available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {available ? 'Available' : 'Allocated'}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {bookQuery.trim().length >= 2 && !searchingBooks && bookResults.length === 0 && (
                  <p className="text-xs text-gray-500 mt-2">No books match &ldquo;{bookQuery}&rdquo;</p>
                )}
              </>
            )}
          </section>

          {/* Step 2 - borrower */}
          <section>
            <h3 className="text-xs font-bold text-[#002147] uppercase tracking-wide mb-2">
              2. Choose the borrower
            </h3>

            <div className="grid grid-cols-2 gap-2 mb-3">
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
                  className={`px-3 py-2 rounded-lg font-bold text-sm border-2 transition-all ${
                    role === option
                      ? 'bg-[#fe9800] text-white border-[#002147]'
                      : 'bg-white text-[#002147] border-[#002147] hover:bg-gray-50'
                  }`}
                >
                  {option === 'student' ? 'Student' : 'Teacher'}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#fe9800]" />
              <input
                type="text"
                value={personQuery}
                onChange={(e) => setPersonQuery(e.target.value)}
                placeholder={role === 'student' ? 'Search by roll number or name' : 'Search by teacher name'}
                className="w-full pl-9 pr-9 py-2.5 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 text-sm focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none"
              />
              {searchingPeople && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#fe9800] animate-spin" />
              )}
            </div>

            {personResults.length > 0 && (
              <div className="mt-2 border-2 border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {personResults.map(person => (
                  <button
                    key={`${person.id || person.key}-${person.reserver_id}`}
                    type="button"
                    onClick={() => pickPerson(person)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-semibold text-[#002147] truncate">{person.label}</p>
                    <p className="text-[11px] text-gray-500 truncate">{person.sub}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Always editable, so a walk-in with no profile can still be served */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                  Borrower Name *
                </label>
                <input
                  type="text"
                  required
                  value={reserver.reserver_name}
                  onChange={(e) => setReserver({ ...reserver, reserver_name: e.target.value, id: null })}
                  className="w-full px-2 py-2 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 text-sm focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                  {role === 'student' ? 'Roll Number *' : 'Teacher ID / Email *'}
                </label>
                <input
                  type="text"
                  required
                  value={reserver.reserver_id}
                  onChange={(e) => setReserver({ ...reserver, reserver_id: e.target.value, id: null })}
                  className="w-full px-2 py-2 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 text-sm focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none"
                  placeholder={role === 'student' ? '2021-CS-045' : 'name@thal.edu.pk'}
                />
              </div>
            </div>
          </section>

          {/* Step 3 - dates */}
          <section>
            <h3 className="text-xs font-bold text-[#002147] uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-[#fe9800]" />
              3. Loan period
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Issue Date *</label>
                <input
                  type="date"
                  required
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-2 py-2 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 text-sm focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Due Date *</label>
                <input
                  type="date"
                  required
                  min={issueDate || undefined}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-2 py-2 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 text-sm focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none"
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-2">
              Pick when the book is due back. Every day past it is fined{' '}
              <span className="font-bold text-[#002147]">{formatMoney(settings.fine_per_day, settings)}</span>.
            </p>
          </section>

          <div className="flex gap-3 pt-4 border-t-2 border-[#002147]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-3 border-2 border-[#002147] text-[#002147] rounded-lg hover:bg-gray-100 transition-all font-bold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !selectedBook}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#fe9800] text-white rounded-lg hover:shadow-xl transition-all font-bold border-2 border-[#002147] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Reserving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
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
