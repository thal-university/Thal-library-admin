"use client"
import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import Loader from '@/components/Loader'
import { supabase } from '@/lib/supabase'
import { BookMarked, Search, X } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

export default function CompletedReservationsPage() {
  const [loading, setLoading] = useState(true)
  const [reservations, setReservations] = useState([])
  const [filterRole, setFilterRole] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

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
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          book:book_sr_no (
            id,
            name,
            author,
            department,
            status,
            sr_no
          )
        `)
        .eq('status', 'deleted')
        .order('updated_at', { ascending: false })

      if (error) throw error
      setReservations(data || [])
    } catch (error) {
      console.error('Error fetching completed reservations:', error)
      toast.error('Failed to fetch completed reservations')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Loader />

  const filteredReservations = reservations.filter(r => {
    if (filterRole !== 'all' && r.reserver_role !== filterRole) return false
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Toaster position="top-right" />
      <Header
        title="Completed Reservations"
        subtitle="Archived reservations (previously confirmed and then removed)"
        icon={BookMarked}
      />

      <div className="flex-1 p-6 flex flex-col">
        <div className="bg-white p-4 rounded-lg border-2 border-[#002147] shadow-sm mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, ID, or book..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#fe9800] placeholder:text-gray-400 placeholder:font-normal text-[#002147] font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#fe9800] font-medium text-[#002147]"
            >
              <option value="all">All Roles</option>
              <option value="student">Students</option>
              <option value="teacher">Teachers</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-lg border-2 border-[#002147] shadow-sm flex-1 flex flex-col overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full">
              <thead className="bg-[#002147] text-white sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold text-xs">Reserver Info</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-xs">Book SR No</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-xs">Book Details</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-xs">Department</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-xs">Status</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-xs">Time Left</th>
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
                  filteredReservations.map((reservation) => (
                    <tr key={reservation.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-2 py-1.5">
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
                      <td className="px-2 py-1.5">
                        <span className="font-mono text-xs text-[#002147] font-semibold">
                          {reservation.book?.sr_no || reservation.book_sr_no || 'N/A'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 max-w-[200px]">
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
                      <td className="px-2 py-1.5 max-w-[120px]">
                        <span
                          className="text-[10px] text-gray-600 truncate block"
                          title={reservation.book?.department || 'N/A'}
                        >
                          {reservation.book?.department || 'N/A'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
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
                      <td className="px-2 py-1.5">
                        <span className="text-[10px] text-gray-400">-</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 bg-gray-50 border-t-2 border-[#002147]">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold text-[#002147]">{filteredReservations.length}</span> of{' '}
              <span className="font-semibold text-[#002147]">{reservations.length}</span> completed reservations
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
