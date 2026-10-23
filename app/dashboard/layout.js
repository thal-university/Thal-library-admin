'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar, { NAVIGATION, isActive } from '@/components/Sidebar'
import Header from '@/components/Header'

export default function DashboardLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [user, setUser] = useState({ name: 'Admin' })
  const current = NAVIGATION.find((item) => isActive(pathname, item.href))

  useEffect(() => {
    // Display name only; the signed httpOnly cookie is what authorises requests
    try {
      const saved = JSON.parse(localStorage.getItem('library_user') || 'null')
      if (saved) setUser({ name: saved.name || 'Admin', username: saved.username })
    } catch {}
  }, [])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout request failed:', error)
    }
    localStorage.removeItem('library_user')
    router.push('/')
  }

  return (
    <div className="flex h-screen gap-3 p-2.5 xl:p-3">
      <aside data-print-hide className="hidden h-full w-[216px] shrink-0 lg:block">
        <Sidebar pathname={pathname} user={user} onLogout={handleLogout} />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            className="absolute inset-0 bg-navy-900/30 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          />
          <div className="rise absolute inset-y-3 left-3 w-[260px] max-w-[calc(100vw-1.5rem)]">
            <Sidebar pathname={pathname} user={user} onLogout={handleLogout} onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={current?.name ?? 'Library'} user={user} onMenu={() => setDrawerOpen(true)} onLogout={handleLogout} />
        {/* Pages fill this column and manage their own inner scrolling */}
        <main className="flex min-h-0 flex-1 flex-col pt-3">{children}</main>
      </div>
    </div>
  )
}
