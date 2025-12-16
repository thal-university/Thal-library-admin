


'use client'
import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import DashboardCards from '@/components/DashboardCards'
import Loader from '@/components/Loader'
import { supabase } from '@/lib/supabase'
import { BookOpen, TrendingUp, Users, Calendar } from 'lucide-react'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    allocated: 0,
    allocationRate: 0
  })
  const [recentBooks, setRecentBooks] = useState([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    try {
      // Fetch counts using Supabase count feature (bypasses 1000 row limit)
      const [totalResult, availableResult, allocatedResult] = await Promise.all([
        supabase.from('books').select('*', { count: 'exact', head: true }),
        supabase.from('books').select('*', { count: 'exact', head: true }).eq('status', 'Available'),
        supabase.from('books').select('*', { count: 'exact', head: true }).eq('status', 'Allocated')
      ])

      if (totalResult.error) throw totalResult.error
      if (availableResult.error) throw availableResult.error
      if (allocatedResult.error) throw allocatedResult.error

      const total = totalResult.count || 0
      const available = availableResult.count || 0
      const allocated = allocatedResult.count || 0
      const allocationRate = total > 0 ? Math.round((allocated / total) * 100) : 0

      setStats({ total, available, allocated, allocationRate })

      // Fetch recent books with uploader information
      const { data: books, error } = await supabase
        .from('books')
        .select(`
          *,
          uploader:uploaded_by (
            id,
            name,
            email,
            username
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error
      setRecentBooks(books || [])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Loader />

  return (
    <div className="h-screen overflow-hidden bg-white flex flex-col">
      <Header title="Dashboard" />

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full">
        {/* University Header Banner */}
        

        {/* === Stats Cards === */}
        <DashboardCards stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* === Recent Books === */}
          <div className="lg:col-span-2 bg-white rounded-xl p-3 sm:p-4 border-2 border-[#fe9800] shadow-xl">
            <div className="flex items-center gap-2 mb-3 sm:mb-4 pb-2 border-b-2 border-[#fe9800]">
              <div className="p-1.5 sm:p-2 rounded-lg bg-[#fe9800] flex-shrink-0">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <h2 className="text-xs sm:text-sm font-bold text-[#002147] tracking-tight font-serif">
                Recently Added Books
              </h2>
            </div>

            {recentBooks.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-10 h-10 mx-auto text-[#002147] mb-2 opacity-50" />
                <p className="text-gray-500 text-xs font-serif">No books added yet</p>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1 sm:pr-2 scrollbar-thin scrollbar-thumb-[#fe9800] scrollbar-track-transparent hover:scrollbar-thumb-[#002147]">
                {recentBooks.map((book) => (
                  <div
                    key={book.id}
                    className="flex items-start gap-2 p-2.5 sm:p-3 bg-gray-50 rounded-lg border-l-4 border-[#fe9800] hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex-shrink-0 mt-0.5 hidden sm:block">
                      <div className="w-8 h-11 bg-[#002147] rounded shadow-md flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[#002147] text-[10px] sm:text-xs leading-tight mb-0.5 font-serif">
                        {book.name}
                      </h3>
                      <p className="text-[10px] text-gray-600 mb-1">
                        <span className="font-medium">by</span> {book.author}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 flex-wrap">
                        <span className="bg-white px-1.5 py-0.5 rounded text-[10px] border border-gray-300">{book.department}</span>
                      </div>
                    </div>
                    <span
                      className={`flex-shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold ${
                        book.status === 'Available'
                          ? 'bg-[#fe9800] text-white'
                          : 'bg-[#002147] text-white'
                      }`}
                    >
                      {book.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* === Quick Stats Column === */}
          <div className="space-y-3 sm:space-y-4">
            {/* Activity Card */}
            <div className="bg-[#fe9800] rounded-xl p-3 sm:p-4 text-white shadow-xl border-2 border-[#fe9800]">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-white/20 rounded-lg flex-shrink-0">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-white">Library Activity</p>
                  <h3 className="text-sm sm:text-base font-bold tracking-tight font-serif">Active</h3>
                </div>
              </div>
              <div className="bg-white/10 rounded-lg p-2">
                <p className="text-[10px] leading-relaxed">
                  System running smoothly with <strong className="text-xs font-bold">{stats.total}</strong> books in collection.
                </p>
              </div>
            </div>

            {/* Library Stats */}
            {/* <div className="bg-white rounded-xl p-3 sm:p-4 border-2 border-[#002147] shadow-xl">
              <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b-2 border-[#fe9800]">
                <div className="p-1.5 bg-[#002147] rounded-lg flex-shrink-0">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-[#002147] font-serif">
                  Library Info
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-2 rounded bg-gray-50 border border-gray-200">
                  <span className="text-gray-700 font-medium">Total Collection</span>
                  <span className="font-bold text-[#002147]">{stats.total} Books</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-gray-50 border border-gray-200">
                  <span className="text-gray-700 font-medium">Available</span>
                  <span className="font-bold text-[#fe9800]">{stats.available} Books</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-gray-50 border border-gray-200">
                  <span className="text-gray-700 font-medium">Allocated</span>
                  <span className="font-bold text-[#002147]">{stats.allocated} Books</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-gray-50 border-t-2 border-[#fe9800] mt-2 pt-2">
                  <span className="text-gray-700 font-medium">System Status</span>
                  <span className="flex items-center gap-1.5 sm:gap-2 font-bold text-[#fe9800]">
                    <span className="w-2 h-2 bg-[#fe9800] rounded-full animate-pulse"></span>
                    Online
                  </span>
                </div>
              </div>
            </div> */}

            {/* Academic Quote - Compact */}
            <div className="bg-[#002147] rounded-xl p-3 text-white shadow-xl border-2 border-[#fe9800]">
              <div className="text-2xl text-[#fe9800] opacity-75 font-serif leading-none mb-1">"</div>
              <p className="text-[10px] italic leading-relaxed mb-1.5 font-serif">
                Education is the most powerful weapon which you can use to change the world.
              </p>
              <p className="text-[10px] text-[#fe9800] font-medium">
                - Nelson Mandela
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}