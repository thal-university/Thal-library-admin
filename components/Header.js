// ===== components/Header.js =====
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, User } from 'lucide-react'

export default function Header({ title }) {
  const router = useRouter()
  const [userName, setUserName] = useState('Admin')

  useEffect(() => {
    // Get user info from localStorage
    const userSession = localStorage.getItem('library_user')
    if (userSession) {
      const user = JSON.parse(userSession)
      setUserName(user.name || 'Admin')
    }
  }, [])

  const handleLogout = () => {
    // Clear session from localStorage
    localStorage.removeItem('library_user')
    router.push('/')
  }

  return (
    <header className="bg-white border-b-2 border-[#fe9800] px-3 sm:px-5 py-3 sm:py-3.5 shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-shrink ml-12 lg:ml-0">
          <h1 className="text-base sm:text-xl font-bold text-[#002147] font-serif truncate">{title}</h1>
          <p className="text-xs text-gray-600 font-medium hidden sm:block">Welcome back, {userName}</p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          <div className="hidden md:flex items-center gap-2.5 bg-gray-50 px-3 py-2 rounded-lg border-2 border-[#fe9800]">
            <div className="w-9 h-9 bg-[#fe9800] rounded-full flex items-center justify-center shadow-md">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#002147]">{userName}</p>
              <p className="text-xs text-gray-600">Administrator</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3.5 py-2 bg-[#002147] text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all font-bold text-sm"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}
