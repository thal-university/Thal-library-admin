"use client"
import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import Loader from '@/components/Loader'
import { supabase } from '@/lib/supabase'
import { BookMarked, Search, X, CheckCircle, Trash2, Filter } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

export default function CompletedReservationsPage() {
  const [loading, setLoading] = useState(true)
  const [reservations, setReservations] = useState([])
  const [filterRole, setFilterRole] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    deleted: 0
  })

  useEffect(() => {
    fetchReservations()

    const channel = supabase
      .channel('reservations-changes-completed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, (payload) => {
        fetchReservations()
      })
      .subscribe()

    const refreshInterval = setInterval(() => fetchReservations(), 10000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(refreshInterval)
    }
  }, [])

  async function fetchReservations() {
    try {
      // Fetch both completed and deleted reservations without foreign key join
      const { data: reservationsData, error } = await supabase
        .from('reservations')
        .select('*')
        .in('status', ['completed', 'deleted'])
        .order('updated_at', { ascending: false })

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
      const allReservations = reservationsData?.map(reservation => ({
        ...reservation,
        book: reservation.book_sr_no ? booksMap[reservation.book_sr_no] || null : null
      })) || []

      setReservations(allReservations)

      // Calculate stats
      const completedCount = allReservations.filter(r => r.status === 'completed').length
      const deletedCount = allReservations.filter(r => r.status === 'deleted').length
      setStats({
        total: allReservations.length,
        completed: completedCount,
        deleted: deletedCount
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

  if (loading) return <Loader />

  const filteredReservations = reservations.filter(r => {
    if (filterRole !== 'all' && r.reserver_role !== filterRole) return false
    if (filterType !== 'all' && r.status !== filterType) return false
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

  return (
    <div className="h-screen overflow-hidden bg-white flex flex-col">
      <Toaster position="top-right" />
      <Header title="Completed Reservations" />

      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2">
        {/* Stats Cards - Compact for mobile */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-lg p-2 sm:p-3 border-2 border-[#fe9800] shadow-md">
            <div className="flex items-center justify-between">
              <div className="p-1.5 sm:p-2 rounded-lg bg-[#fe9800]">
                <BookMarked className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="text-lg sm:text-2xl font-bold text-[#002147]">
                {stats.total}
              </div>
            </div>
            <p className="text-[10px] sm:text-xs font-bold text-[#002147] mt-1 uppercase">Total</p>
          </div>
          <div className="bg-white rounded-lg p-2 sm:p-3 border-2 border-green-500 shadow-md">
            <div className="flex items-center justify-between">
              <div className="p-1.5 sm:p-2 rounded-lg bg-green-500">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="text-lg sm:text-2xl font-bold text-green-600">
                {stats.completed}
              </div>
            </div>
            <p className="text-[10px] sm:text-xs font-bold text-[#002147] mt-1 uppercase">Done</p>
          </div>
          <div className="bg-white rounded-lg p-2 sm:p-3 border-2 border-[#002147] shadow-md">
            <div className="flex items-center justify-between">
              <div className="p-1.5 sm:p-2 rounded-lg bg-[#002147]">
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="text-lg sm:text-2xl font-bold text-[#002147]">
                {stats.deleted}
              </div>
            </div>
            <p className="text-[10px] sm:text-xs font-bold text-[#002147] mt-1 uppercase">Deleted</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl p-2 sm:p-3 border-2 border-[#fe9800] shadow-lg">
          <div className="flex flex-col gap-2">
            {/* Top Row: Search + Filter Icon */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#fe9800]" />
                <input
                  type="text"
                  placeholder="Search..."
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
                  showFilters || filterType !== 'all' || filterRole !== 'all'
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
                onClick={() => setFilterType('all')}
                className={`px-4 py-1.5 rounded-lg font-bold transition-all shadow-md text-sm border-2 ${
                  filterType === 'all'
                    ? 'bg-[#fe9800] text-white shadow-lg scale-105 border-[#002147]'
                    : 'bg-white text-[#002147] border-[#002147] hover:bg-gray-50'
                }`}
              >
                All ({stats.total})
              </button>
              <button
                onClick={() => setFilterType('completed')}
                className={`px-4 py-1.5 rounded-lg font-bold transition-all shadow-md text-sm border-2 ${
                  filterType === 'completed'
                    ? 'bg-green-500 text-white shadow-lg scale-105 border-green-700'
                    : 'bg-white text-[#002147] border-[#002147] hover:bg-gray-50'
                }`}
              >
                Completed ({stats.completed})
              </button>
              <button
                onClick={() => setFilterType('deleted')}
                className={`px-4 py-1.5 rounded-lg font-bold transition-all shadow-md text-sm border-2 ${
                  filterType === 'deleted'
                    ? 'bg-[#002147] text-white shadow-lg scale-105 border-[#fe9800]'
                    : 'bg-white text-[#002147] border-[#002147] hover:bg-gray-50'
                }`}
              >
                Deleted ({stats.deleted})
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
                    onClick={() => setFilterType('all')}
                    className={`px-2 py-2 rounded-lg font-bold transition-all text-xs border-2 ${
                      filterType === 'all'
                        ? 'bg-[#fe9800] text-white border-[#002147]'
                        : 'bg-white text-[#002147] border-[#002147]'
                    }`}
                  >
                    All ({stats.total})
                  </button>
                  <button
                    onClick={() => setFilterType('completed')}
                    className={`px-2 py-2 rounded-lg font-bold transition-all text-xs border-2 ${
                      filterType === 'completed'
                        ? 'bg-green-500 text-white border-green-700'
                        : 'bg-white text-[#002147] border-[#002147]'
                    }`}
                  >
                    Done ({stats.completed})
                  </button>
                  <button
                    onClick={() => setFilterType('deleted')}
                    className={`px-2 py-2 rounded-lg font-bold transition-all text-xs border-2 ${
                      filterType === 'deleted'
                        ? 'bg-[#002147] text-white border-[#fe9800]'
                        : 'bg-white text-[#002147] border-[#002147]'
                    }`}
                  >
                    Del ({stats.deleted})
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
              Archived Reservations
            </h3>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden overflow-y-auto flex-1 p-2 space-y-1.5">
            {filteredReservations.length === 0 ? (
              <div className="flex flex-col items-center py-8">
                <div className="w-14 h-16 bg-[#fe9800] rounded shadow-lg flex items-center justify-center mb-3 border-2 border-[#002147]">
                  <BookMarked className="w-6 h-6 text-white" />
                </div>
                <p className="text-[#002147] text-sm font-serif font-medium text-center">
                  No completed reservations
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
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      reservation.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {reservation.status === 'completed' ? 'Done' : 'Del'}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      reservation.reserver_role === 'teacher'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {reservation.reserver_role === 'teacher' ? 'Teacher' : 'Student'}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-auto">{formatUpdatedAt(reservation.updated_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-[#002147] truncate">{reservation.reserver_name}</h4>
                    <span className="text-xs text-gray-500">({reservation.reserver_id})</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs font-semibold text-[#002147] truncate flex-1">{reservation.book_name}</p>
                    <span className="text-[10px] text-gray-500">SR: {reservation.book?.sr_no || reservation.book_sr_no || 'N/A'}</span>
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
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Updated At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredReservations.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-12 text-center text-gray-500">
                      <BookMarked className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p className="font-medium">No completed reservations found</p>
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
                              reservation.book.status === 'Available'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {reservation.book.status === 'Available' ? 'Avail' : 'Borr'}
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
                          reservation.status === 'completed'
                            ? 'bg-green-100 text-green-700 border border-green-300'
                            : reservation.status === 'deleted'
                            ? 'bg-gray-100 text-gray-700 border border-gray-300'
                            : 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                        }`}>
                          {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] text-gray-600">{formatUpdatedAt(reservation.updated_at)}</span>
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
              <span className="font-semibold text-[#002147]">{reservations.length}</span> completed reservations
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
