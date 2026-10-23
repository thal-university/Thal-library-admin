'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Loader from '@/components/Loader'
import { Settings, User, Lock, Eye, EyeOff, Save, Coins } from 'lucide-react'
import toast from 'react-hot-toast'
import { GlassCard, CardHeader, ui } from '@/components/ui/glass'
import { getLibrarySettings, updateLibrarySettings, DEFAULT_SETTINGS, formatMoney } from '@/lib/librarySettings'

export default function SettingsPage() {
  const router = useRouter()
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

  const [savingFine, setSavingFine] = useState(false)
  const [librarySettings, setLibrarySettings] = useState(DEFAULT_SETTINGS)
  const [fineForm, setFineForm] = useState({
    fine_per_day: String(DEFAULT_SETTINGS.fine_per_day)
  })

  useEffect(() => {
    fetchCurrentUser()
    fetchLibrarySettings()
  }, [])

  async function fetchLibrarySettings() {
    const loaded = await getLibrarySettings()
    setLibrarySettings(loaded)
    setFineForm({ fine_per_day: String(loaded.fine_per_day) })
  }

  async function handleUpdateFineSettings(e) {
    e.preventDefault()

    const finePerDay = Number(fineForm.fine_per_day)

    if (!Number.isFinite(finePerDay) || finePerDay < 0) {
      toast.error('Fine per day must be zero or more')
      return
    }

    try {
      setSavingFine(true)

      const saved = await updateLibrarySettings({ fine_per_day: finePerDay })

      setLibrarySettings({ ...librarySettings, ...saved })
      toast.success(`Fine set to ${formatMoney(finePerDay, librarySettings)} per day`)
    } catch (error) {
      console.error('Error updating fine settings:', error)
      toast.error(error.message || 'Failed to update fine settings')
    } finally {
      setSavingFine(false)
    }
  }

  async function fetchCurrentUser() {
    try {
      const response = await fetch('/api/account')
      const payload = await response.json().catch(() => ({}))

      if (response.status === 401 || response.status === 404) {
        localStorage.removeItem('library_user')
        toast.error('Your session has expired. Please log in again.')
        router.push('/')
        return
      }

      if (!response.ok) throw new Error(payload.error || 'Failed to fetch user data')

      setCurrentUser(payload.user)
      setUsernameForm({ username: payload.user.username })
    } catch (error) {
      console.error('Error fetching user:', error.message)
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

      const response = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'username', username: usernameForm.username.trim() })
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Failed to update username')

      // Keep the cached display name in step
      const cached = JSON.parse(localStorage.getItem('library_user') || '{}')
      localStorage.setItem('library_user', JSON.stringify({ ...cached, username: payload.user.username }))

      setCurrentUser(payload.user)
      toast.success('Username updated successfully!')
    } catch (error) {
      console.error('Error updating username:', error.message)
      toast.error(error.message)
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

      const response = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'password',
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Failed to update password')

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      toast.success('Password updated successfully!')
    } catch (error) {
      console.error('Error updating password:', error.message)
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loader inline />

  const spinner = <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
  const eyeBtn = 'absolute right-1 top-1/2 -translate-y-1/2 ' + ui.iconBtn
  const hint = 'mt-1 text-[11px] text-ink-muted'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scroll-quiet min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl space-y-3 pb-3">
          {/* Page Header */}
          <div className="rise flex items-center gap-3 px-1 pt-1">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#f9a24f,#dd6b12)] text-white shadow-[0_8px_18px_-8px_rgba(221,107,18,0.8)]">
              <Settings className="size-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight text-heading">Account Settings</h1>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">Manage your credentials and library-wide fine rules</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* Fine & Loan Settings */}
            <GlassCard index={1} className="flex flex-col">
              <SectionHeader icon={Coins} title="Fine & Loan Settings" subtitle="Charged for every day a book is kept past its due date" />
              <div className="px-4 pb-4">
                <p className="mb-3 text-[12px] leading-relaxed text-ink-muted">
                  Set how much a borrower is charged for every day a book is kept past its due date.
                  The fine is worked out automatically from the due date on each reservation and keeps
                  growing until the book comes back.
                </p>
                <form onSubmit={handleUpdateFineSettings} className="space-y-3">
                  <div className="sm:max-w-xs">
                    <label className={ui.label}>
                      Fine Per Day ({librarySettings.currency}) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      required
                      value={fineForm.fine_per_day}
                      onChange={(e) => setFineForm({ fine_per_day: e.target.value })}
                      className={ui.input}
                      placeholder="10"
                    />
                    <p className={hint}>
                      Charged for each day past the due date. Set to 0 to disable fines.
                    </p>
                  </div>

                  <div className="rounded-xl bg-brand-500/[0.07] px-3 py-2.5 ring-1 ring-brand-500/20">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-brand-700">Example</p>
                    <p className="mt-0.5 text-[12.5px] text-ink-soft">
                      A book returned <span className="font-semibold text-ink">5 days</span> after its due date would be fined{' '}
                      <span className="font-bold text-rose-600">
                        {formatMoney(5 * (Number(fineForm.fine_per_day) || 0), librarySettings)}
                      </span>.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={savingFine}
                    className={ui.btnPrimary + ' w-full sm:w-auto'}
                  >
                    {savingFine ? (
                      <>
                        {spinner}
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="size-4" />
                        Save Fine Settings
                      </>
                    )}
                  </button>
                </form>
              </div>
            </GlassCard>

            {/* User Info Card */}
            <GlassCard index={2} className="flex flex-col">
              <SectionHeader icon={User} title="Account Information" subtitle="Details of the signed-in administrator" />
              <div className="px-4 pb-4">
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <InfoTile label="Name" value={currentUser?.name || 'N/A'} />
                  <InfoTile label="Email" value={currentUser?.email || 'N/A'} />
                  <InfoTile label="Username" value={currentUser?.username || 'N/A'} />
                  <InfoTile
                    label="Member Since"
                    value={
                      currentUser?.created_at
                        ? new Date(currentUser.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        : 'N/A'
                    }
                  />
                </dl>
              </div>
            </GlassCard>

            {/* Update Username Section */}
            <GlassCard index={3} className="flex flex-col">
              <SectionHeader icon={User} title="Update Username" subtitle="The name you sign in with" />
              <div className="px-4 pb-4">
                <form onSubmit={handleUpdateUsername} className="space-y-3">
                  <div>
                    <label className={ui.label}>
                      Current Username
                    </label>
                    <div className="flex h-9 w-full items-center rounded-xl border border-edge/60 bg-surface/40 px-3 text-[13px] text-ink-muted">
                      {currentUser?.username || 'N/A'}
                    </div>
                  </div>

                  <div>
                    <label className={ui.label}>
                      New Username *
                    </label>
                    <input
                      type="text"
                      required
                      value={usernameForm.username}
                      onChange={(e) => setUsernameForm({ username: e.target.value })}
                      className={ui.input}
                      placeholder="Enter new username"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className={ui.btnPrimary + ' w-full'}
                  >
                    {saving ? (
                      <>
                        {spinner}
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="size-4" />
                        Update Username
                      </>
                    )}
                  </button>
                </form>
              </div>
            </GlassCard>

            {/* Update Password Section */}
            <GlassCard index={4} className="flex flex-col">
              <SectionHeader icon={Lock} title="Update Password" subtitle="At least 6 characters" />
              <div className="px-4 pb-4">
                <form onSubmit={handleUpdatePassword} className="space-y-3">
                  <div>
                    <label className={ui.label}>
                      Current Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        required
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className={ui.input + ' pr-10'}
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className={eyeBtn}
                      >
                        {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className={ui.label}>
                        New Password *
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                          className={ui.input + ' pr-10'}
                          placeholder="Enter new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className={eyeBtn}
                        >
                          {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className={ui.label}>
                        Confirm New Password *
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                          className={ui.input + ' pr-10'}
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className={eyeBtn}
                        >
                          {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className={ui.btnPrimary + ' w-full'}
                  >
                    {saving ? (
                      <>
                        {spinner}
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="size-4" />
                        Update Password
                      </>
                    )}
                  </button>
                </form>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Card heading with a tinted icon chip. */
function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <CardHeader title={title} subtitle={subtitle} className="mb-1">
      <span className="grid size-8 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
        <Icon className="size-4" aria-hidden="true" />
      </span>
    </CardHeader>
  )
}

/** One read-only account detail. */
function InfoTile({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-glass-line bg-surface/50 px-3 py-2">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-medium text-ink" title={value}>{value}</dd>
    </div>
  )
}
