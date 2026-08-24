'use client'
import { useState } from 'react'
import Header from '@/components/Header'
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
import toast, { Toaster } from 'react-hot-toast'
import * as XLSX from 'xlsx'
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

  const statusStyles = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    confirmed: 'bg-blue-100 text-blue-700 border-blue-300',
    returned: 'bg-green-100 text-green-700 border-green-300',
    completed: 'bg-green-100 text-green-700 border-green-300',
    deleted: 'bg-gray-100 text-gray-700 border-gray-300'
  }

  return (
    <div className="h-screen overflow-hidden bg-white flex flex-col">
      <Toaster position="top-right" />
      <Header title="Complete Record" />

      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2">
        {/* Search Panel */}
        <div className="bg-white rounded-xl p-3 border-2 border-[#fe9800] shadow-lg">
          <div className="flex flex-col gap-3">
            {/* Mode toggle */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:w-fit">
              <button
                onClick={() => switchMode('student')}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-sm border-2 transition-all ${
                  mode === 'student'
                    ? 'bg-[#fe9800] text-white border-[#002147] shadow-md'
                    : 'bg-white text-[#002147] border-[#002147] hover:bg-gray-50'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                Student (Roll No)
              </button>
              <button
                onClick={() => switchMode('teacher')}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-sm border-2 transition-all ${
                  mode === 'teacher'
                    ? 'bg-[#fe9800] text-white border-[#002147] shadow-md'
                    : 'bg-white text-[#002147] border-[#002147] hover:bg-gray-50'
                }`}
              >
                <User className="w-4 h-4" />
                Teacher (Name)
              </button>
            </div>

            {/* Search field */}
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#fe9800]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    mode === 'student'
                      ? 'Enter roll number, e.g. 2021-CS-045'
                      : 'Enter teacher name, e.g. Ahmed Raza'
                  }
                  className="w-full pl-9 pr-9 py-2.5 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none transition-all font-medium text-sm"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => { setQuery(''); setHasSearched(false); resetResults() }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#fe9800] hover:text-[#002147]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={searching}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#002147] text-white rounded-lg font-bold text-sm border-2 border-[#fe9800] hover:shadow-lg transition-all disabled:opacity-50"
              >
                {searching ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Search
              </button>
            </form>
          </div>
        </div>

        {/* Multiple matches - pick one */}
        {matches.length > 0 && (
          <div className="bg-white rounded-xl border-2 border-[#fe9800] shadow-xl overflow-hidden">
            <div className="bg-[#002147] px-3 py-1.5 border-b-2 border-[#fe9800]">
              <h3 className="text-sm font-bold text-white font-serif flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {matches.length} matches - select one
              </h3>
            </div>
            <div className="divide-y divide-gray-200 max-h-72 overflow-y-auto">
              {matches.map(m => (
                <button
                  key={`${m.kind}-${m.id || m.key}`}
                  onClick={() => loadRecord(m)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <p className="text-sm font-bold text-[#002147]">{m.name}</p>
                  <p className="text-xs text-gray-600">
                    {m.identifier}{m.department ? ` - ${m.department}` : ''}
                    {m.directoryOnly ? ' - not registered yet' : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!person && matches.length === 0 && (
          <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm p-10 text-center">
            <div className="w-14 h-16 bg-[#fe9800] rounded shadow-lg flex items-center justify-center mb-3 border-2 border-[#002147] mx-auto">
              <BookMarked className="w-6 h-6 text-white" />
            </div>
            <p className="text-[#002147] font-serif font-semibold">
              {hasSearched && !searching ? 'No record found' : 'Search a complete borrowing record'}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {mode === 'student'
                ? 'Look up a student by their roll number.'
                : 'Look up a teacher by their name.'}
            </p>
          </div>
        )}

        {/* The record */}
        {person && (
          <>
            {/* Profile card */}
            <div className="bg-white rounded-xl border-2 border-[#fe9800] shadow-xl overflow-hidden">
              <div className="bg-[#002147] px-3 py-1.5 border-b-2 border-[#fe9800] flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white font-serif flex items-center gap-1.5">
                  {person.kind === 'teacher' ? <User className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                  {person.kind === 'teacher' ? 'Teacher' : 'Student'} Profile
                </h3>
                <button
                  onClick={exportRecord}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#fe9800] text-white rounded text-xs font-bold border border-white/30 hover:shadow-lg transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Field label="Name" value={person.name} />
                <Field label={person.kind === 'teacher' ? 'Official Email' : 'Roll Number'} value={person.identifier} />
                <Field label="Department" value={person.department} />
                <Field label="Email" value={person.email} />
                <Field label="Father Name" value={person.father_name} />
                <Field label="CNIC" value={person.cnic} />
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <SummaryCard icon={BookMarked} label="Total" value={summary.total} color="#fe9800" />
              <SummaryCard icon={BookMarked} label="Issued" value={summary.issued} color="#002147" />
              <SummaryCard icon={BookMarked} label="Pending" value={summary.pending} color="#ca8a04" />
              <SummaryCard icon={CheckCircle} label="Returned" value={summary.returned} color="#16a34a" />
              <SummaryCard icon={AlertTriangle} label="Overdue" value={summary.overdue} color="#dc2626" />
              <SummaryCard
                icon={Coins}
                label="Fines Due"
                value={formatMoney(summary.finesUnpaid, settings)}
                color="#dc2626"
                small
              />
            </div>

            {/* History table */}
            <div className="bg-white rounded-xl border-2 border-[#fe9800] overflow-hidden shadow-xl">
              <div className="bg-[#002147] px-3 py-1.5 border-b-2 border-[#fe9800]">
                <h3 className="text-sm font-bold text-white font-serif flex items-center gap-1.5">
                  <BookMarked className="w-4 h-4" />
                  Complete Borrowing History
                </h3>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden p-2 space-y-1.5">
                {history.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-6">No borrowing history</p>
                ) : (
                  history.map(r => {
                    const fine = fineFor(r)
                    return (
                      <div key={r.id} className="bg-gray-50 rounded-lg px-2.5 py-2 border border-gray-200">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusStyles[r.status] || statusStyles.deleted}`}>
                            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </span>
                          <span className="text-[10px] text-gray-500 ml-auto">SR: {r.book_sr_no || 'N/A'}</span>
                        </div>
                        <p className="text-sm font-bold text-[#002147] truncate">{r.book_name}</p>
                        {r.book?.author && <p className="text-[11px] text-gray-500 truncate">{r.book.author}</p>}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                          <span className="text-[10px] text-gray-600">
                            <span className="font-semibold text-[#002147]">Issued:</span> {formatDate(r.issue_date)}
                          </span>
                          <span className="text-[10px] text-gray-600">
                            <span className="font-semibold text-[#002147]">Due:</span> {formatDate(r.due_date)}
                          </span>
                          <span className="text-[10px] text-gray-600">
                            <span className="font-semibold text-[#002147]">Returned:</span> {formatDate(r.return_date)}
                          </span>
                          {fine.amount > 0 && (
                            <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                              Fine {formatMoney(fine.amount, settings)} ({fine.days}d)
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-[#fe9800]">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Book SR No</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Book Details</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Department</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Issue Date</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Due Date</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Return Date</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Fine</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-4 py-12 text-center text-gray-500">
                          <BookMarked className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="font-medium">No borrowing history</p>
                          <p className="text-sm">{person.name} has not reserved any book yet</p>
                        </td>
                      </tr>
                    ) : (
                      history.map((r, index) => {
                        const fine = fineFor(r)
                        const isLate = fine.days > 0
                        return (
                          <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            <td className="px-3 py-2">
                              <span className="font-mono text-xs text-[#002147] font-semibold">{r.book_sr_no || 'N/A'}</span>
                            </td>
                            <td className="px-3 py-2 max-w-[220px]">
                              <span className="font-semibold text-xs text-[#002147] truncate block" title={r.book_name}>
                                {r.book_name}
                              </span>
                              {r.book?.author && (
                                <span className="text-[10px] text-gray-500 truncate block" title={r.book.author}>
                                  {r.book.author}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 max-w-[120px]">
                              <span className="text-[10px] text-gray-600 truncate block">{r.book?.department || '-'}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${statusStyles[r.status] || statusStyles.deleted}`}>
                                {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-[10px] text-gray-600 whitespace-nowrap">{formatDate(r.issue_date)}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] whitespace-nowrap ${isLate ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                                {formatDate(r.due_date)}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-[10px] text-gray-600 whitespace-nowrap">{formatDate(r.return_date)}</span>
                            </td>
                            <td className="px-3 py-2">
                              {fine.amount > 0 ? (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${
                                  r.fine_paid
                                    ? 'text-green-700 bg-green-50 border-green-200'
                                    : 'text-red-700 bg-red-50 border-red-200'
                                }`}>
                                  {formatMoney(fine.amount, settings)}{r.fine_paid ? ' paid' : ''}
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-2 md:px-4 py-2 md:py-3 bg-gray-50 border-t-2 border-[#002147] flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] md:text-sm text-gray-600">
                  <span className="font-semibold text-[#002147]">{history.length}</span> reservation(s) on record
                </p>
                <p className="text-[10px] md:text-sm text-gray-600">
                  Total fines charged:{' '}
                  <span className="font-semibold text-red-700">{formatMoney(summary.finesTotal, settings)}</span>
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5 border-2 border-[#002147]">
      <p className="text-[10px] font-bold text-[#002147] uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-xs font-medium text-gray-900 break-words">{value || 'N/A'}</p>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, color, small }) {
  return (
    <div className="bg-white rounded-lg p-2 sm:p-3 border-2 shadow-md" style={{ borderColor: color }}>
      <div className="flex items-center justify-between gap-1">
        <div className="p-1.5 rounded-lg" style={{ backgroundColor: color }}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className={`font-bold ${small ? 'text-sm sm:text-base' : 'text-lg sm:text-2xl'}`} style={{ color }}>
          {value}
        </div>
      </div>
      <p className="text-[10px] sm:text-xs font-bold text-[#002147] mt-1 uppercase">{label}</p>
    </div>
  )
}
