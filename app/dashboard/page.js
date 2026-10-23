


'use client'
import { useEffect, useState } from 'react'
import DashboardCards from '@/components/DashboardCards'
import Loader from '@/components/Loader'
import { supabase } from '@/lib/supabase'
import { GlassCard, CardHeader, EmptyState, Pill } from '@/components/ui/glass'
import { BookOpen, TrendingUp, Users, Calendar, Quote } from 'lucide-react'

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

  if (loading) return <Loader inline />

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scroll-quiet min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-7xl space-y-3 pb-3">
          {/* Greeting */}
          <div className="rise flex flex-wrap items-end justify-between gap-3 px-1 pt-1">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink-muted">
                <Calendar className="size-3.5" aria-hidden="true" />
                {todayLabel}
              </p>
              <h1 className="mt-0.5 text-[20px] font-bold leading-tight tracking-tight text-heading sm:text-[22px]">
                Welcome{' '}
                <span className="bg-[linear-gradient(120deg,#f59a3c,#dd6b12)] bg-clip-text text-transparent">back</span>
              </h1>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">Here&apos;s how the library collection looks today.</p>
            </div>
          </div>

          {/* === Stats Cards === */}
          <DashboardCards stats={stats} />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {/* === Recent Books === */}
            <GlassCard index={5} className="flex min-w-0 flex-col lg:col-span-2">
              <CardHeader title="Recently Added Books" subtitle="The latest five additions to the catalogue">
                <span className="grid size-8 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
                  <BookOpen className="size-4" aria-hidden="true" />
                </span>
              </CardHeader>

              {recentBooks.length === 0 ? (
                <EmptyState icon={BookOpen} title="No books added yet" hint="New books will show up here." />
              ) : (
                <div className="scroll-quiet max-h-[380px] space-y-1.5 overflow-y-auto px-3 pb-3">
                  {recentBooks.map((book) => (
                    <div
                      key={book.id}
                      className="flex items-center gap-3 rounded-xl border border-glass-line bg-surface/50 px-3 py-2 transition-colors hover:bg-surface/80"
                    >
                      <div className="hidden shrink-0 sm:block">
                        <div className="grid h-10 w-8 place-items-center rounded-lg bg-[linear-gradient(135deg,#2b3a63,#16203b)] text-white shadow-[0_6px_14px_-8px_rgba(22,32,59,0.8)]">
                          <BookOpen className="size-3.5" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[13px] font-semibold leading-tight text-ink">
                          {book.name}
                        </h3>
                        <p className="truncate text-[12px] text-ink-muted">
                          <span className="font-medium">by</span> {book.author}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="rounded-md bg-surface/80 px-1.5 py-0.5 text-[11px] text-ink-soft ring-1 ring-edge">{book.department}</span>
                        </div>
                      </div>
                      <Pill tone={book.status === 'Available' ? 'success' : 'warning'} className="shrink-0">
                        {book.status}
                      </Pill>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            {/* === Quick Stats Column === */}
            <div className="flex min-w-0 flex-col gap-3">
              {/* Activity Card */}
              <GlassCard index={6} className="p-3.5">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#f9a24f,#dd6b12)] text-white shadow-[0_8px_18px_-8px_rgba(221,107,18,0.8)]">
                    <TrendingUp className="size-[18px]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-medium text-ink-muted">Library Activity</p>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-bold leading-tight text-heading">Active</h3>
                      <Pill tone="success" pulse>Online</Pill>
                    </div>
                  </div>
                </div>
                <p className="mt-2.5 rounded-xl bg-surface/60 px-3 py-2 text-[12px] leading-relaxed text-ink-soft ring-1 ring-glass-line">
                  System running smoothly with <strong className="font-semibold text-ink">{stats.total}</strong> books in collection.
                </p>
              </GlassCard>

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
              </div> */}

              {/* Academic Quote - Compact */}
              <GlassCard index={7} className="p-3.5">
                <Quote className="size-4 text-brand-500" aria-hidden="true" />
                <p className="mt-1.5 text-[12.5px] italic leading-relaxed text-ink-soft">
                  Education is the most powerful weapon which you can use to change the world.
                </p>
                <p className="mt-1.5 text-[11.5px] font-semibold text-brand-600">
                  - Nelson Mandela
                </p>
              </GlassCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
