'use client'
import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import Loader from '@/components/Loader'
import { supabase } from '@/lib/supabase'
import { Settings, User, Lock, Eye, EyeOff, Save } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [usernameForm, setUsernameForm] = useState({
    username: ''
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  async function fetchCurrentUser() {
    try {
      const userSession = localStorage.getItem('library_user')
      if (!userSession) {
        toast.error('Please login first')
        setLoading(false)
        return
      }

      const user = JSON.parse(userSession)

      // Fetch fresh user data from database
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error

      setCurrentUser(data)
      setUsernameForm({ username: data.username })
    } catch (error) {
      console.error('Error fetching user:', error)
      toast.error('Failed to fetch user data')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateUsername(e) {
    e.preventDefault()

    if (!usernameForm.username.trim()) {
      toast.error('Username cannot be empty')
      return
    }

    if (usernameForm.username === currentUser.username) {
      toast.error('New username is the same as current username')
      return
    }

    try {
      setSaving(true)

      // Check if username already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('username', usernameForm.username)
        .neq('id', currentUser.id)
        .single()

      if (existingUser) {
        toast.error('Username already taken')
        setSaving(false)
        return
      }

      // Update username
      const { error } = await supabase
        .from('users')
        .update({ username: usernameForm.username })
        .eq('id', currentUser.id)

      if (error) throw error

      // Update localStorage
      const userSession = JSON.parse(localStorage.getItem('library_user'))
      userSession.username = usernameForm.username
      localStorage.setItem('library_user', JSON.stringify(userSession))

      setCurrentUser({ ...currentUser, username: usernameForm.username })
      toast.success('Username updated successfully!')
    } catch (error) {
      console.error('Error updating username:', error)
      toast.error('Failed to update username')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdatePassword(e) {
    e.preventDefault()

    if (!passwordForm.currentPassword) {
      toast.error('Please enter your current password')
      return
    }

    if (!passwordForm.newPassword) {
      toast.error('Please enter a new password')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    try {
      setSaving(true)

      // Verify current password
      const { data: userData, error: verifyError } = await supabase
        .from('users')
        .select('password')
        .eq('id', currentUser.id)
        .single()

      if (verifyError) throw verifyError

      if (userData.password !== passwordForm.currentPassword) {
        toast.error('Current password is incorrect')
        setSaving(false)
        return
      }

      // Update password
      const { error } = await supabase
        .from('users')
        .update({ password: passwordForm.newPassword })
        .eq('id', currentUser.id)

      if (error) throw error

      // Clear password form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })

      toast.success('Password updated successfully!')
    } catch (error) {
      console.error('Error updating password:', error)
      toast.error('Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loader />

  return (
    <div className="h-screen overflow-hidden bg-white flex flex-col">
      <Toaster position="top-right" />
      <Header title="Settings" />

      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-4">
        {/* Page Header */}
        <div className="bg-white rounded-xl p-4 border-2 border-[#fe9800] shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#fe9800] rounded-lg flex items-center justify-center shadow-md border-2 border-[#002147]">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#002147] font-serif">Account Settings</h2>
              <p className="text-sm text-gray-600">Manage your username and password</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Update Username Section */}
          <div className="bg-white rounded-xl border-2 border-[#fe9800] shadow-xl overflow-hidden">
            <div className="bg-[#002147] px-4 py-3 border-b-2 border-[#fe9800]">
              <h3 className="text-base font-bold text-white font-serif flex items-center gap-2">
                <User className="w-5 h-5" />
                Update Username
              </h3>
            </div>
            <div className="p-4">
              <form onSubmit={handleUpdateUsername} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#002147] mb-2 uppercase tracking-wide">
                    Current Username
                  </label>
                  <div className="w-full px-3 py-3 border-2 border-gray-200 rounded-lg bg-gray-100 text-gray-600 font-medium">
                    {currentUser?.username || 'N/A'}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#002147] mb-2 uppercase tracking-wide">
                    New Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={usernameForm.username}
                    onChange={(e) => setUsernameForm({ username: e.target.value })}
                    className="w-full px-3 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none transition-all font-medium"
                    placeholder="Enter new username"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#fe9800] text-white rounded-lg hover:shadow-xl hover:scale-105 transition-all font-bold border-2 border-[#002147] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {saving ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Update Username
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Update Password Section */}
          <div className="bg-white rounded-xl border-2 border-[#fe9800] shadow-xl overflow-hidden">
            <div className="bg-[#002147] px-4 py-3 border-b-2 border-[#fe9800]">
              <h3 className="text-base font-bold text-white font-serif flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Update Password
              </h3>
            </div>
            <div className="p-4">
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#002147] mb-2 uppercase tracking-wide">
                    Current Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      required
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className="w-full px-3 py-3 pr-10 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none transition-all font-medium"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-[#002147]"
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#002147] mb-2 uppercase tracking-wide">
                    New Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="w-full px-3 py-3 pr-10 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none transition-all font-medium"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-[#002147]"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#002147] mb-2 uppercase tracking-wide">
                    Confirm New Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="w-full px-3 py-3 pr-10 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none transition-all font-medium"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-[#002147]"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#002147] text-white rounded-lg hover:shadow-xl hover:scale-105 transition-all font-bold border-2 border-[#fe9800] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {saving ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Update Password
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* User Info Card */}
        <div className="bg-white rounded-xl border-2 border-[#fe9800] shadow-xl overflow-hidden">
          <div className="bg-[#002147] px-4 py-3 border-b-2 border-[#fe9800]">
            <h3 className="text-base font-bold text-white font-serif flex items-center gap-2">
              <User className="w-5 h-5" />
              Account Information
            </h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 border-2 border-[#002147]">
                <p className="text-xs font-bold text-[#002147] uppercase tracking-wide mb-1">Name</p>
                <p className="text-sm font-medium text-gray-900">{currentUser?.name || 'N/A'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border-2 border-[#002147]">
                <p className="text-xs font-bold text-[#002147] uppercase tracking-wide mb-1">Email</p>
                <p className="text-sm font-medium text-gray-900">{currentUser?.email || 'N/A'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border-2 border-[#002147]">
                <p className="text-xs font-bold text-[#002147] uppercase tracking-wide mb-1">Username</p>
                <p className="text-sm font-medium text-gray-900">{currentUser?.username || 'N/A'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border-2 border-[#002147]">
                <p className="text-xs font-bold text-[#002147] uppercase tracking-wide mb-1">Member Since</p>
                <p className="text-sm font-medium text-gray-900">
                  {currentUser?.created_at
                    ? new Date(currentUser.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })
                    : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
