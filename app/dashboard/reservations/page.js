'use client'
import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import Loader from '@/components/Loader'
import { supabase } from '@/lib/supabase'
import { BookMarked, Search, X, CheckCircle, XCircle, AlertTriangle, Filter } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

export default function ReservationsPage() {
  const [loading, setLoading] = useState(true)
  const [reservations, setReservations] = useState([])
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterRole, setFilterRole] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState(null)
  const [existingReservation, setExistingReservation] = useState(null)
  const [_currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    fetchReservations()
    // Clean up old pending reservations on page load
    cleanupOldReservations()

    // Set up Supabase realtime subscription for instant updates
    const channel = supabase
      .channel('reservations-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        (payload) => {
          console.log('Realtime update received:', payload)
          fetchReservations()
        }
      )
      .subscribe()

    // Fallback: Also use polling every 10 seconds
    const refreshInterval = setInterval(() => {
      console.log('Polling for updates...')
      fetchReservations()
    }, 10000) // 10 seconds

    return () => {
      supabase.removeChannel(channel)
      clearInterval(refreshInterval)
    }
  }, [])

  // Update time every second for live countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  async function fetchReservations() {
    try {
      // Fetch reservations without foreign key join
      const { data: reservationsData, error } = await supabase
        .from('reservations')
        .select('*')
        .order('reservation_date', { ascending: false })

      if (error) throw error

      // Get unique book_sr_no values to fetch book details
      const bookSrNos = [...new Set(reservationsData?.map(r => r.book_sr_no).filter(Boolean))]

      let booksMap = {}
      if (bookSrNos.length > 0) {
        const { data: booksData } = await supabase
          .from('books')
          .select('id, name, author, department, status, sr_no')
          .in('sr_no', bookSrNos)

        // Create a map of sr_no to book data
        booksData?.forEach(book => {
          booksMap[book.sr_no] = book
        })
      }

      // Attach book data to reservations
      const reservationsWithBooks = reservationsData?.map(reservation => ({
        ...reservation,
        book: reservation.book_sr_no ? booksMap[reservation.book_sr_no] || null : null
      })) || []

      setReservations(reservationsWithBooks)
    } catch (error) {
      console.error('Error fetching reservations:', error)
      toast.error('Failed to fetch reservations')
    } finally {
      setLoading(false)
    }
  }

  async function cleanupOldReservations() {
    try {
      // Delete pending reservations older than 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 43 * 60 * 60 * 1000).toISOString()

      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('status', 'pending')
        .lt('created_at', twentyFourHoursAgo)

      if (error) throw error
    } catch (error) {
      console.error('Error cleaning up old reservations:', error)
    }
  }

  async function handleConfirm(reservation, forceConfirm = false) {
    try {
      // Check if the reserver already has a confirmed reservation
      const { data: existingConfirmed, error: checkError } = await supabase
        .from('reservations')
        .select('id, book_name')
        .eq('reserver_id', reservation.reserver_id)
        .eq('status', 'confirmed')

      if (checkError) throw checkError

      // If they already have a confirmed reservation and not forcing, show error
      if (existingConfirmed && existingConfirmed.length > 0 && !forceConfirm) {
        toast.error(
          `Cannot confirm! ${reservation.reserver_name} already has a confirmed reservation for "${existingConfirmed[0].book_name}". Please return the previously borrowed book before reserving another.`,
          { duration: 6000 }
        )
        setShowConfirmModal(false)
        setSelectedReservation(null)
        setExistingReservation(null)
        return
      }

      // Get the book's UUID (book_id) from the books table using sr_no
      const bookSrNo = reservation.book_sr_no || reservation.book?.sr_no
      const { data: bookData, error: bookLookupError } = await supabase
        .from('books')
        .select('id, book_id')
        .eq('sr_no', bookSrNo)
        .single()

      if (bookLookupError || !bookData) {
        console.error('Error finding book:', bookLookupError)
        toast.error('Could not find the book to confirm reservation')
        return
      }

      // Update reservation status to 'confirmed' and set the book_id
      const { error } = await supabase
        .from('reservations')
        .update({
          status: 'confirmed',
          book_id: bookData.book_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', reservation.id)

      if (error) throw error

      // Update book status to 'Allocated'
      const { error: bookError } = await supabase
        .from('books')
        .update({ status: 'Allocated' })
        .eq('id', bookData.id)

      if (bookError) {
        console.error('Error updating book status:', bookError)
        toast.error('Reservation confirmed but failed to update book status')
        return
      }

      if (forceConfirm) {
        toast.success(`Reservation confirmed! Note: ${reservation.reserver_name} now has multiple confirmed reservations.`, { duration: 6000 })
      } else {
        toast.success('Reservation confirmed successfully! Book status updated to Allocated.')
      }

      setShowConfirmModal(false)
      setSelectedReservation(null)
      setExistingReservation(null)
      fetchReservations()
    } catch (error) {
      console.error('Error confirming reservation:', error)
      toast.error('Failed to confirm reservation')
      setShowConfirmModal(false)
      setSelectedReservation(null)
      setExistingReservation(null)
    }
  }

  async function handleDelete(reservation) {
    try {
      // If reservation was confirmed, update book status back to 'Available'
      if (reservation.status === 'confirmed') {
        const { error: bookError } = await supabase
          .from('books')
          .update({ status: 'Available' })
          .eq('sr_no', reservation.book_sr_no || reservation.book?.sr_no)

        if (bookError) {
          console.error('Error updating book status:', bookError)
          toast.error('Failed to update book status to Available')
          return
        }
      }

      // If it was confirmed, mark as deleted (archive) so it appears in Completed Reservations
      if (reservation.status === 'confirmed') {
        const { error: deleteError } = await supabase
          .from('reservations')
          .update({ status: 'deleted', updated_at: new Date().toISOString() })
          .eq('id', reservation.id)

        if (deleteError) throw deleteError
      } else {
        // For pending or other statuses, delete as before
        const { error: deleteError } = await supabase
          .from('reservations')
          .delete()
          .eq('id', reservation.id)

        if (deleteError) throw deleteError
      }

      toast.success('Reservation deleted successfully! Book status updated to Available.')
      setShowDeleteModal(false)
      setSelectedReservation(null)
      fetchReservations()
    } catch (error) {
      console.error('Error deleting reservation:', error)
      toast.error('Failed to delete reservation')
    }
  }

  async function openConfirmModal(reservation) {
    setSelectedReservation(reservation)

    // Check if user already has a confirmed reservation
    try {
      const { data: existingConfirmed, error } = await supabase
        .from('reservations')
        .select('id, book_name, book_sr_no')
        .eq('reserver_id', reservation.reserver_id)
        .eq('status', 'confirmed')
        .limit(1)

      if (!error && existingConfirmed && existingConfirmed.length > 0) {
        setExistingReservation(existingConfirmed[0])
      } else {
        setExistingReservation(null)
      }
    } catch (error) {
      console.error('Error checking existing reservations:', error)
      setExistingReservation(null)
    }

    setShowConfirmModal(true)
  }

  function openDeleteModal(reservation) {
    setSelectedReservation(reservation)
    setShowDeleteModal(true)
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
      // Exclude archived (deleted) reservations from the main reservations view
      if (reservation.status === 'deleted') return false
      // Status filter
      if (filterStatus !== 'all' && reservation.status !== filterStatus) return false

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

  // Calculate stats
  const stats = {
    total: reservations.filter(r => r.status !== 'deleted').length,
    pending: reservations.filter(r => r.status === 'pending').length,
    confirmed: reservations.filter(r => r.status === 'confirmed').length,
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
                <div className="grid grid-cols-3 gap-1.5">
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
                        <>
                          <button
                            onClick={() => openConfirmModal(reservation)}
                            className="p-1.5 bg-green-500 text-white rounded-lg border border-green-700"
                            title="Confirm"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(reservation)}
                            className="p-1.5 bg-red-500 text-white rounded-lg border border-red-700"
                            title="Delete"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {reservation.status === 'confirmed' && (
                        <button
                          onClick={() => openDeleteModal(reservation)}
                          className="p-1.5 bg-red-500 text-white rounded-lg border border-red-700"
                          title="Delete"
                        >
                          <XCircle className="w-4 h-4" />
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
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Time Left</th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-[#002147] uppercase tracking-tight">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredReservations.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-gray-500">
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
                            <>
                              <button
                                onClick={() => openConfirmModal(reservation)}
                                className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 transition-colors border border-green-700"
                                title="Confirm Reservation"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openDeleteModal(reservation)}
                                className="p-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors border border-red-700"
                                title="Delete Reservation"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {reservation.status === 'confirmed' && (
                            <button
                              onClick={() => openDeleteModal(reservation)}
                              className="p-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors border border-red-700"
                              title="Delete Reservation"
                            >
                              <XCircle className="w-3.5 h-3.5" />
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

      {/* Delete Modal */}
      {showDeleteModal && selectedReservation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full border-2 border-red-500 shadow-2xl">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center border-2 border-red-500">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-[#002147]">Delete Reservation</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete this reservation? This action cannot be undone.
              </p>
              <div className="bg-gray-50 p-4 rounded-lg mb-4 border-2 border-gray-200">
                <p className="text-sm font-semibold text-[#002147]">{selectedReservation.reserver_name}</p>
                <p className="text-sm text-gray-600">{selectedReservation.book_name}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setSelectedReservation(null)
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium border-2 border-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(selectedReservation)}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium border-2 border-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
