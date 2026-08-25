'use client'
import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import Loader from '@/components/Loader'
import { BookMarked, Search, X, CheckCircle, AlertTriangle, Filter, CalendarDays, Undo2, Plus } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
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
    return <Loader />
  }

  return (
    <div className="h-screen overflow-hidden bg-white flex flex-col">
      <Toaster position="top-right" />
      <Header title="Reservation Requests" />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2">
        {/* Search and Filters Bar */}
        <div className="bg-white rounded-xl p-2 sm:p-3 border-2 border-[#fe9800] shadow-lg">
          <div className="flex flex-col gap-2">
            {/* Top Row: Search + Filter Icon (Mobile) / Full Layout (Desktop) */}
            <div className="flex items-center gap-2">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#fe9800]" />
                <input
                  type="text"
                  placeholder="Search reservations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none transition-all font-medium text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#fe9800] hover:text-[#002147]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Admin: search a book and reserve it directly */}
              <button
                onClick={() => setShowReserveModal(true)}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-[#fe9800] text-white rounded-lg font-bold text-sm border-2 border-[#002147] hover:shadow-lg transition-all whitespace-nowrap"
                title="Search a book and reserve it"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Search &amp; Reserve</span>
              </button>

              {/* Mobile: Filter Icon */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`md:hidden p-2 rounded-lg border-2 transition-all ${
                  showFilters || filterStatus !== 'all' || filterRole !== 'all'
                    ? 'bg-[#fe9800] text-white border-[#002147]'
                    : 'bg-white text-[#002147] border-[#002147]'
                }`}
                title="Filters"
              >
                <Filter className="w-5 h-5" />
              </button>
            </div>

            {/* Desktop: Always show filters inline */}
            <div className="hidden md:flex flex-wrap items-center gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-1.5 rounded-lg font-bold transition-all shadow-md text-sm border-2 ${
                  filterStatus === 'all'
                    ? 'bg-[#fe9800] text-white shadow-lg scale-105 border-[#002147]'
                    : 'bg-white text-[#002147] border-[#002147] hover:bg-gray-50'
                }`}
              >
                All ({stats.total})
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`px-4 py-1.5 rounded-lg font-bold transition-all shadow-md text-sm border-2 ${
                  filterStatus === 'pending'
                    ? 'bg-yellow-500 text-white shadow-lg scale-105 border-yellow-700'
                    : 'bg-white text-[#002147] border-[#002147] hover:bg-gray-50'
                }`}
              >
                Pending ({stats.pending})
              </button>
              <button
                onClick={() => setFilterStatus('confirmed')}
                className={`px-4 py-1.5 rounded-lg font-bold transition-all shadow-md text-sm border-2 ${
                  filterStatus === 'confirmed'
                    ? 'bg-green-500 text-white shadow-lg scale-105 border-green-700'
                    : 'bg-white text-[#002147] border-[#002147] hover:bg-gray-50'
                }`}
              >
                Confirmed ({stats.confirmed})
              </button>
              <button
                onClick={() => setFilterStatus('overdue')}
                className={`px-4 py-1.5 rounded-lg font-bold transition-all shadow-md text-sm border-2 ${
                  filterStatus === 'overdue'
                    ? 'bg-red-600 text-white shadow-lg scale-105 border-red-800'
                    : 'bg-white text-[#002147] border-[#002147] hover:bg-gray-50'
                }`}
              >
                Overdue ({stats.overdue})
              </button>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-4 py-1.5 rounded-lg font-bold transition-all shadow-md text-sm border-2 border-[#002147] bg-white text-[#002147] hover:bg-gray-50 focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none"
              >
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="teacher">Teachers</option>
              </select>
            </div>

            {/* Mobile: Collapsible Filters */}
            {showFilters && (
              <div className="md:hidden flex flex-col gap-2 pt-2 border-t border-gray-200">
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-2 py-2 rounded-lg font-bold transition-all text-xs border-2 ${
                      filterStatus === 'all'
                        ? 'bg-[#fe9800] text-white border-[#002147]'
                        : 'bg-white text-[#002147] border-[#002147]'
                    }`}
                  >
                    All ({stats.total})
                  </button>
                  <button
                    onClick={() => setFilterStatus('pending')}
                    className={`px-2 py-2 rounded-lg font-bold transition-all text-xs border-2 ${
                      filterStatus === 'pending'
                        ? 'bg-yellow-500 text-white border-yellow-700'
                        : 'bg-white text-[#002147] border-[#002147]'
                    }`}
                  >
                    Pend ({stats.pending})
                  </button>
                  <button
                    onClick={() => setFilterStatus('confirmed')}
                    className={`px-2 py-2 rounded-lg font-bold transition-all text-xs border-2 ${
                      filterStatus === 'confirmed'
                        ? 'bg-green-500 text-white border-green-700'
                        : 'bg-white text-[#002147] border-[#002147]'
                    }`}
                  >
                    Conf ({stats.confirmed})
                  </button>
                  <button
                    onClick={() => setFilterStatus('overdue')}
                    className={`px-2 py-2 rounded-lg font-bold transition-all text-xs border-2 ${
                      filterStatus === 'overdue'
                        ? 'bg-red-600 text-white border-red-800'
                        : 'bg-white text-[#002147] border-[#002147]'
                    }`}
                  >
                    Late ({stats.overdue})
                  </button>
                </div>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg font-bold text-xs border-2 border-[#002147] bg-white text-[#002147] focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none"
                >
                  <option value="all">All Roles</option>
                  <option value="student">Students</option>
                  <option value="teacher">Teachers</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Reservations Table */}
        <div className="bg-white rounded-xl border-2 border-[#fe9800] overflow-hidden shadow-xl flex-1 flex flex-col">
          <div className="bg-[#002147] px-3 py-1.5 border-b-2 border-[#fe9800]">
            <h3 className="text-sm font-bold text-white font-serif flex items-center gap-1.5">
              <BookMarked className="w-4 h-4" />
              Reservation Requests
            </h3>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden overflow-y-auto flex-1 p-2 space-y-1.5">
            {filteredReservations.length === 0 ? (
              <div className="flex flex-col items-center py-6">
                <div className="w-12 h-14 bg-[#fe9800] rounded shadow-lg flex items-center justify-center mb-2 border-2 border-[#002147]">
                  <BookMarked className="w-5 h-5 text-white" />
                </div>
                <p className="text-[#002147] text-sm font-serif font-medium text-center">
                  No reservations found
                </p>
                <p className="text-gray-600 text-xs mt-1 text-center">
                  Try adjusting your filters
                </p>
              </div>
            ) : (
              filteredReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="bg-gray-50 rounded-lg px-2.5 py-2 border border-gray-200 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          reservation.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {reservation.status === 'pending' ? 'Pending' : 'Confirmed'}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          reservation.reserver_role === 'teacher'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {reservation.reserver_role === 'teacher' ? 'Teacher' : 'Student'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[#002147] truncate">{reservation.reserver_name}</h4>
                        <span className="text-xs text-gray-500">({reservation.reserver_id})</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs font-semibold text-[#002147] truncate flex-1">{reservation.book_name}</p>
                        <span className="text-[10px] text-gray-500">SR: {reservation.book?.sr_no || reservation.book_sr_no || 'N/A'}</span>
                      </div>
                      {reservation.status === 'confirmed' && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                          <span className="text-[10px] text-gray-600">
                            <span className="font-semibold text-[#002147]">Issued:</span> {formatDate(reservation.issue_date)}
                          </span>
                          <span className={`text-[10px] ${calculateFine(reservation.due_date, null, settings).days > 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                            <span className="font-semibold text-[#002147]">Due:</span> {formatDate(reservation.due_date)}
                          </span>
                          {calculateFine(reservation.due_date, null, settings).amount > 0 && (
                            <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                              Fine {formatMoney(calculateFine(reservation.due_date, null, settings).amount, settings)}
                            </span>
                          )}
                        </div>
                      )}
                      {reservation.status === 'pending' && (
                        <span className={`text-[10px] font-bold ${
                          (() => {
                            const timeLeft = getTimeRemaining(reservation.created_at)
                            return timeLeft.expired ? 'text-red-600' : (timeLeft.hours < 2 ? 'text-red-600' : 'text-orange-600')
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
                          className="p-1.5 bg-green-500 text-white rounded-lg border border-green-700"
                          title="Confirm"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {reservation.status === 'confirmed' && (
                        <button
                          onClick={() => openReturnModal(reservation)}
                          className="p-1.5 bg-[#002147] text-white rounded-lg border border-[#fe9800]"
                          title="Mark as Returned"
                        >
                          <Undo2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto overflow-y-auto flex-1 scrollbar-hide">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-[#fe9800] sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Reserver Info</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Book SR No</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Book Details</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Department</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Issue Date</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Due Date</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Fine</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Time Left</th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-[#002147] uppercase tracking-tight">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredReservations.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-12 text-center text-gray-500">
                      <BookMarked className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p className="font-medium">No reservations found</p>
                      <p className="text-sm">Try adjusting your filters or search query</p>
                    </td>
                  </tr>
                ) : (
                  filteredReservations.map((reservation, index) => (
                    <tr key={reservation.id} className={`hover:bg-gray-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-xs text-[#002147] truncate">
                              {reservation.reserver_name}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {reservation.reserver_id}
                            </span>
                          </div>
                          <span className={`text-[9px] px-1 py-0.5 rounded whitespace-nowrap flex-shrink-0 ${
                            reservation.reserver_role === 'teacher'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {reservation.reserver_role === 'teacher' ? 'T' : 'S'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-[#002147] font-semibold">
                          {reservation.book?.sr_no || reservation.book_sr_no || 'N/A'}
                        </span>
                      </td>
                      <td className="px-3 py-2 max-w-[200px]">
                        <div className="flex items-center gap-1.5">
                          <div className="flex flex-col min-w-0 flex-1">
                            <span
                              className="font-semibold text-xs text-[#002147] truncate block"
                              title={reservation.book_name}
                            >
                              {reservation.book_name}
                            </span>
                            {reservation.book?.author && (
                              <span
                                className="text-[10px] text-gray-500 truncate block"
                                title={reservation.book.author}
                              >
                                {reservation.book.author}
                              </span>
                            )}
                          </div>
                          {reservation.book?.status && (
                            <span className={`text-[9px] px-1 py-0.5 rounded whitespace-nowrap flex-shrink-0 ${
                              reservation.status === 'confirmed'
                                ? 'bg-red-100 text-red-700'
                                : reservation.book.status === 'Available'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {reservation.status === 'confirmed' ? 'Borr' : reservation.book.status === 'Available' ? 'Avail' : 'Borr'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 max-w-[120px]">
                        <span
                          className="text-[10px] text-gray-600 truncate block"
                          title={reservation.book?.department || 'N/A'}
                        >
                          {reservation.book?.department || 'N/A'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                          reservation.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                            : reservation.status === 'confirmed'
                            ? 'bg-green-100 text-green-700 border border-green-300'
                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}>
                          {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] text-gray-600 whitespace-nowrap">
                          {formatDate(reservation.issue_date)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {(() => {
                          if (!reservation.due_date) {
                            return <span className="text-[10px] text-gray-400">-</span>
                          }
                          const overdue = reservation.status === 'confirmed' && calculateFine(reservation.due_date, null, settings).days > 0
                          return (
                            <span className={`text-[10px] font-semibold whitespace-nowrap ${overdue ? 'text-red-600' : 'text-gray-600'}`}>
                              {formatDate(reservation.due_date)}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-3 py-2">
                        {(() => {
                          if (reservation.status !== 'confirmed' || !reservation.due_date) {
                            return <span className="text-[10px] text-gray-400">-</span>
                          }
                          const fine = calculateFine(reservation.due_date, null, settings)
                          if (fine.days === 0) {
                            return <span className="text-[10px] text-green-600 font-semibold">On time</span>
                          }
                          return (
                            <span className="inline-flex flex-col">
                              <span className="text-[10px] font-bold text-red-700">{formatMoney(fine.amount, settings)}</span>
                              <span className="text-[9px] text-red-500">{fine.days}d late</span>
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
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-md text-[10px] font-bold border border-red-300">
                                  <span className="w-1 h-1 rounded-full bg-red-600 animate-pulse"></span>
                                  Expired
                                </span>
                              )
                            }
                            const isUrgent = timeLeft.hours < 2
                            return (
                              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border ${
                                isUrgent
                                  ? 'bg-red-50 text-red-700 border-red-300'
                                  : 'bg-orange-50 text-orange-700 border-orange-300'
                              }`}>
                                <div className="flex items-center gap-0.5">
                                  <span className="font-mono">{String(timeLeft.hours).padStart(2, '0')}</span>
                                  <span className="text-[8px]">h</span>
                                  <span className="mx-0.5">:</span>
                                  <span className="font-mono">{String(timeLeft.minutes).padStart(2, '0')}</span>
                                  <span className="text-[8px]">m</span>
                                  <span className="mx-0.5">:</span>
                                  <span className="font-mono">{String(timeLeft.seconds).padStart(2, '0')}</span>
                                  <span className="text-[8px]">s</span>
                                </div>
                              </div>
                            )
                          })()
                        ) : (
                          <span className="text-[10px] text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 justify-center">
                          {reservation.status === 'pending' && (
                            <button
                              onClick={() => openConfirmModal(reservation)}
                              className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 transition-colors border border-green-700"
                              title="Confirm Reservation"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {reservation.status === 'confirmed' && (
                            <button
                              onClick={() => openReturnModal(reservation)}
                              className="p-1.5 bg-[#002147] text-white rounded hover:bg-[#00335f] transition-colors border border-[#fe9800]"
                              title="Mark as Returned"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
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
          <div className="px-2 md:px-4 py-2 md:py-3 bg-gray-50 border-t-2 border-[#002147]">
            <p className="text-[10px] md:text-sm text-gray-600">
              Showing <span className="font-semibold text-[#002147]">{filteredReservations.length}</span> of{' '}
              <span className="font-semibold text-[#002147]">{stats.total}</span> reservations
            </p>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && selectedReservation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`bg-white rounded-lg max-w-md w-full border-2 shadow-2xl ${existingReservation ? 'border-red-500' : 'border-green-500'}`}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${existingReservation ? 'bg-red-100 border-red-500' : 'bg-green-100 border-green-500'}`}>
                  {existingReservation ? (
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  ) : (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-[#002147]">
                  {existingReservation ? 'Warning!' : 'Confirm Reservation'}
                </h3>
              </div>

              {existingReservation ? (
                <>
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4">
                    <p className="text-sm font-semibold text-red-800 mb-2">
                      ⚠️ This user already has a confirmed reservation!
                    </p>
                    <p className="text-xs text-red-700">
                      <span className="font-semibold">{selectedReservation.reserver_name}</span> currently has:
                    </p>
                    <div className="mt-2 bg-white rounded p-2 border border-red-200">
                      <p className="text-xs font-semibold text-[#002147]">{existingReservation.book_name}</p>
                      <p className="text-xs text-gray-500">SR No: {existingReservation.book_sr_no}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-4">
                    Only one book can be reserved per person. Please ensure the previously borrowed book is returned before confirming this new reservation.
                  </p>
                  <div className="bg-gray-50 p-4 rounded-lg mb-4 border-2 border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Attempting to confirm:</p>
                    <p className="text-sm font-semibold text-[#002147]">{selectedReservation.reserver_name}</p>
                    <p className="text-sm text-gray-600">{selectedReservation.book_name}</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-600 mb-4">
                    Are you sure you want to confirm this reservation?
                  </p>
                  <div className="bg-gray-50 p-4 rounded-lg mb-4 border-2 border-gray-200">
                    <p className="text-sm font-semibold text-[#002147]">{selectedReservation.reserver_name}</p>
                    <p className="text-sm text-gray-600">{selectedReservation.book_name}</p>
                  </div>
                </>
              )}

              {/* Issue date / due date — set on every reservation */}
              <div className="bg-white border-2 border-[#fe9800] rounded-lg p-3 mb-4">
                <p className="text-xs font-bold text-[#002147] uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-[#fe9800]" />
                  Loan Period
                </p>
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
                      value={dueDate}
                      min={issueDate || undefined}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-2 py-2 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 text-sm focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-2">
                  Pick when the book is due back. Every day past it is fined{' '}
                  <span className="font-bold text-[#002147]">{formatMoney(settings.fine_per_day, settings)}</span>.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowConfirmModal(false)
                    setSelectedReservation(null)
                    setExistingReservation(null)
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium border-2 border-gray-400"
                >
                  Cancel
                </button>
                {existingReservation ? (
                  <button
                    onClick={() => handleConfirm(selectedReservation, true)}
                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium border-2 border-red-700"
                  >
                    Confirm Anyway
                  </button>
                ) : (
                  <button
                    onClick={() => handleConfirm(selectedReservation, false)}
                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium border-2 border-green-700"
                  >
                    Confirm
                  </button>
                )}
              </div>
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full border-2 border-[#fe9800] shadow-2xl">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-[#fe9800]/15 rounded-full flex items-center justify-center border-2 border-[#fe9800]">
                    <Undo2 className="w-6 h-6 text-[#fe9800]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#002147]">Return Book</h3>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg mb-4 border-2 border-gray-200">
                  <p className="text-sm font-semibold text-[#002147]">{selectedReservation.reserver_name}</p>
                  <p className="text-sm text-gray-600">{selectedReservation.book_name}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-200">
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Issued</p>
                      <p className="text-xs font-semibold text-[#002147]">{formatDate(selectedReservation.issue_date)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Due</p>
                      <p className="text-xs font-semibold text-[#002147]">{formatDate(selectedReservation.due_date)}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Return Date *</label>
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
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 text-sm focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none"
                  />
                </div>

                <div className={`rounded-lg p-3 mb-4 border-2 ${fine.amount > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                  {fine.amount > 0 ? (
                    <>
                      <p className="text-sm font-bold text-red-800">
                        Calculated fine: {formatMoney(fine.amount, settings)}
                      </p>
                      <p className="text-xs text-red-700 mt-0.5">
                        {fine.days} day(s) late &times; {formatMoney(settings.fine_per_day, settings)} per day
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-bold text-green-800">Returned on time — no fine due.</p>
                  )}
                </div>

                {/* Fine actually charged at the counter */}
                <div className="bg-white border-2 border-[#fe9800] rounded-lg p-3 mb-4">
                  <p className="text-xs font-bold text-[#002147] uppercase tracking-wide mb-2">
                    Record Fine
                  </p>

                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                    Fine Charged ({settings.currency})
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={fineAmount}
                      onChange={(e) => setFineAmount(e.target.value)}
                      className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 text-sm focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFineAmount('0')
                        setFinePaid(true)
                      }}
                      className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-xs font-bold border-2 border-gray-400 whitespace-nowrap"
                      title="Charge nothing for this return"
                    >
                      Waive
                    </button>
                  </div>
                  {!chargedValid && (
                    <p className="text-[10px] text-red-600 font-semibold mt-1">
                      Enter an amount of zero or more.
                    </p>
                  )}

                  <label className={`flex items-center gap-2 mt-3 ${chargedValid && charged > 0 ? 'cursor-pointer' : 'opacity-60'}`}>
                    <input
                      type="checkbox"
                      checked={chargedValid && charged === 0 ? true : finePaid}
                      disabled={!chargedValid || charged === 0}
                      onChange={(e) => setFinePaid(e.target.checked)}
                      className="w-4 h-4 accent-[#fe9800]"
                    />
                    <span className="text-xs font-semibold text-[#002147]">
                      Fine collected now
                    </span>
                  </label>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Leave it unticked to record the fine as outstanding — it stays on the
                    borrower&apos;s record until it is paid.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowReturnModal(false)
                      setSelectedReservation(null)
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium border-2 border-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleReturn(selectedReservation)}
                    disabled={!chargedValid}
                    className="flex-1 px-4 py-2 bg-[#002147] text-white rounded-lg hover:bg-[#00335f] transition-colors font-medium border-2 border-[#fe9800] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirm Return
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
