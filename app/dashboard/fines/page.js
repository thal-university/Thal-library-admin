'use client'
import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import Loader from '@/components/Loader'
import { Search, X, Filter, Wallet, AlertTriangle, CheckCircle, Clock, BadgeDollarSign } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import {
  getLibrarySettings,
  fetchReservationsList,
  recordFinePayment,
  DEFAULT_SETTINGS,
  calculateFine,
  formatDate,
  formatMoney,
  today
} from '@/lib/librarySettings'

/** Statuses that mean the loan is closed, so its fine is settled at a fixed amount. */
const ARCHIVED_STATUSES = ['returned', 'completed', 'deleted']

export default function FineRecordsPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterState, setFilterState] = useState('unpaid')
  const [filterRole, setFilterRole] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState(null)
  const [paidOn, setPaidOn] = useState(today())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchFines()
    getLibrarySettings().then(setSettings)

    // Polled rather than subscribed: Supabase realtime honours row level
    // security, which hides `reservations` from the anon key. Keeping it live
    // means a return recorded on another screen shows up here on its own.
    const refreshInterval = setInterval(fetchFines, 10000)

    return () => clearInterval(refreshInterval)
  }, [])

  async function fetchFines() {
    try {
      setRows(await fetchReservationsList('fines'))
    } catch (error) {
      console.error('Error fetching fine records:', error)
      toast.error('Failed to fetch fine records')
    } finally {
      setLoading(false)
    }
  }

  /**
   * What this row owes. A closed loan keeps the amount stamped at return; a
   * book still out keeps accruing, so it is recalculated on every render.
   */
  function fineFor(row) {
    if (ARCHIVED_STATUSES.includes(row.status)) {
      return {
        amount: Number(row.fine_amount || 0),
        days: calculateFine(row.due_date, row.return_date, settings).days,
        settled: true
      }
    }

    return { ...calculateFine(row.due_date, null, settings), settled: false }
  }

  /** Where a row sits: still accruing, owed at the counter, or collected. */
  function stateOf(row) {
    const fine = fineFor(row)
    if (!fine.settled) return 'accruing'
    return row.fine_paid ? 'paid' : 'unpaid'
  }

  function openPaymentModal(row) {
    setSelected(row)
    setPaidOn(today())
  }

  async function handleRecordPayment() {
    if (!selected) return

    try {
      setSaving(true)
      await recordFinePayment(selected.id, paidOn)

      toast.success(
        `${formatMoney(fineFor(selected).amount, settings)} collected from ${selected.reserver_name}.`
      )

      setSelected(null)
      fetchFines()
    } catch (error) {
      console.error('Error recording fine payment:', error)
      toast.error(`Failed to record the payment: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Every row that carries a fine, newest first. Rows whose live fine has not
  // started yet (due today, nothing owed) are dropped.
  const fineRows = rows
    .map(row => ({ ...row, fine: fineFor(row), state: stateOf(row) }))
    .filter(row => row.fine.amount > 0)

  const filteredRows = fineRows.filter(row => {
    if (filterState !== 'all' && row.state !== filterState) return false
    if (filterRole !== 'all' && row.reserver_role !== filterRole) return false

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        row.reserver_name.toLowerCase().includes(q) ||
        row.reserver_id.toLowerCase().includes(q) ||
        row.book_name.toLowerCase().includes(q) ||
        String(row.book?.sr_no || row.book_sr_no || '').toLowerCase().includes(q) ||
        (row.book?.author && row.book.author.toLowerCase().includes(q))
      )
    }

    return true
  })

  const sum = (list) => list.reduce((total, row) => total + row.fine.amount, 0)

  const stats = {
    all: fineRows.length,
    unpaid: fineRows.filter(r => r.state === 'unpaid').length,
    paid: fineRows.filter(r => r.state === 'paid').length,
    accruing: fineRows.filter(r => r.state === 'accruing').length,
    outstanding: sum(fineRows.filter(r => r.state === 'unpaid')),
    collected: sum(fineRows.filter(r => r.state === 'paid')),
    accruingTotal: sum(fineRows.filter(r => r.state === 'accruing'))
  }

  const stateStyles = {
    unpaid: 'bg-red-100 text-red-700 border-red-300',
    paid: 'bg-green-100 text-green-700 border-green-300',
    accruing: 'bg-orange-100 text-orange-700 border-orange-300'
  }

  const stateLabels = {
    unpaid: 'Unpaid',
    paid: 'Paid',
    accruing: 'Accruing'
  }

  const filterButtons = [
    { key: 'unpaid', label: 'Unpaid', count: stats.unpaid, active: 'bg-red-600 text-white border-red-800' },
    { key: 'paid', label: 'Paid', count: stats.paid, active: 'bg-green-500 text-white border-green-700' },
    { key: 'accruing', label: 'Accruing', count: stats.accruing, active: 'bg-orange-500 text-white border-orange-700' },
    { key: 'all', label: 'All', count: stats.all, active: 'bg-[#fe9800] text-white border-[#002147]' }
  ]

  if (loading) return <Loader />

  return (
    <div className="h-screen overflow-hidden bg-white flex flex-col">
      <Toaster position="top-right" />
      <Header title="Fine Records" />

      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2">
        {/* Money at a glance */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-white rounded-lg p-2 sm:p-3 border-2 border-red-500 shadow-md">
            <div className="flex items-center justify-between">
              <div className="p-1.5 sm:p-2 rounded-lg bg-red-500">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="text-base sm:text-xl font-bold text-red-600">
                {formatMoney(stats.outstanding, settings)}
              </div>
            </div>
            <p className="text-[10px] sm:text-xs font-bold text-[#002147] mt-1 uppercase">
              Outstanding ({stats.unpaid})
            </p>
          </div>

          <div className="bg-white rounded-lg p-2 sm:p-3 border-2 border-green-500 shadow-md">
            <div className="flex items-center justify-between">
              <div className="p-1.5 sm:p-2 rounded-lg bg-green-500">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="text-base sm:text-xl font-bold text-green-600">
                {formatMoney(stats.collected, settings)}
              </div>
            </div>
            <p className="text-[10px] sm:text-xs font-bold text-[#002147] mt-1 uppercase">
              Collected ({stats.paid})
            </p>
          </div>

          <div className="bg-white rounded-lg p-2 sm:p-3 border-2 border-orange-500 shadow-md">
            <div className="flex items-center justify-between">
              <div className="p-1.5 sm:p-2 rounded-lg bg-orange-500">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="text-base sm:text-xl font-bold text-orange-600">
                {formatMoney(stats.accruingTotal, settings)}
              </div>
            </div>
            <p className="text-[10px] sm:text-xs font-bold text-[#002147] mt-1 uppercase">
              Accruing ({stats.accruing})
            </p>
          </div>

          <div className="bg-white rounded-lg p-2 sm:p-3 border-2 border-[#fe9800] shadow-md">
            <div className="flex items-center justify-between">
              <div className="p-1.5 sm:p-2 rounded-lg bg-[#fe9800]">
                <BadgeDollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="text-base sm:text-xl font-bold text-[#002147]">
                {formatMoney(settings.fine_per_day, settings)}
              </div>
            </div>
            <p className="text-[10px] sm:text-xs font-bold text-[#002147] mt-1 uppercase">Per Day</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl p-2 sm:p-3 border-2 border-[#fe9800] shadow-lg">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#fe9800]" />
                <input
                  type="text"
                  placeholder="Search by name, roll no, book or SR no..."
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

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`md:hidden p-2 rounded-lg border-2 transition-all ${
                  showFilters || filterState !== 'unpaid' || filterRole !== 'all'
                    ? 'bg-[#fe9800] text-white border-[#002147]'
                    : 'bg-white text-[#002147] border-[#002147]'
                }`}
                title="Filters"
              >
                <Filter className="w-5 h-5" />
              </button>
            </div>

            {/* Desktop filters */}
            <div className="hidden md:flex flex-wrap items-center gap-2">
              {filterButtons.map(button => (
                <button
                  key={button.key}
                  onClick={() => setFilterState(button.key)}
                  className={`px-4 py-1.5 rounded-lg font-bold transition-all shadow-md text-sm border-2 ${
                    filterState === button.key
                      ? `${button.active} shadow-lg scale-105`
                      : 'bg-white text-[#002147] border-[#002147] hover:bg-gray-50'
                  }`}
                >
                  {button.label} ({button.count})
                </button>
              ))}
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

            {/* Mobile filters */}
            {showFilters && (
              <div className="md:hidden flex flex-col gap-2 pt-2 border-t border-gray-200">
                <div className="grid grid-cols-4 gap-1.5">
                  {filterButtons.map(button => (
                    <button
                      key={button.key}
                      onClick={() => setFilterState(button.key)}
                      className={`px-2 py-2 rounded-lg font-bold transition-all text-xs border-2 ${
                        filterState === button.key
                          ? button.active
                          : 'bg-white text-[#002147] border-[#002147]'
                      }`}
                    >
                      {button.label} ({button.count})
                    </button>
                  ))}
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

        {/* Fines table */}
        <div className="bg-white rounded-xl border-2 border-[#fe9800] overflow-hidden shadow-xl flex-1 flex flex-col">
          <div className="bg-[#002147] px-3 py-1.5 border-b-2 border-[#fe9800]">
            <h3 className="text-sm font-bold text-white font-serif flex items-center gap-1.5">
              <Wallet className="w-4 h-4" />
              Fine Records
            </h3>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden overflow-y-auto flex-1 p-2 space-y-1.5">
            {filteredRows.length === 0 ? (
              <EmptyState />
            ) : (
              filteredRows.map(row => (
                <div
                  key={row.id}
                  className="bg-gray-50 rounded-lg px-2.5 py-2 border border-gray-200 shadow-sm"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${stateStyles[row.state]}`}>
                      {stateLabels[row.state]}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      row.reserver_role === 'teacher'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {row.reserver_role === 'teacher' ? 'Teacher' : 'Student'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-[#002147] truncate">{row.reserver_name}</h4>
                    <span className="text-xs text-gray-500">({row.reserver_id})</span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs font-semibold text-[#002147] truncate flex-1">{row.book_name}</p>
                    <span className="text-[10px] text-gray-500">
                      SR: {row.book?.sr_no || row.book_sr_no || 'N/A'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                    <span className="text-[10px] text-gray-600">
                      <span className="font-semibold text-[#002147]">Due:</span> {formatDate(row.due_date)}
                    </span>
                    <span className="text-[10px] text-gray-600">
                      <span className="font-semibold text-[#002147]">Returned:</span> {formatDate(row.return_date)}
                    </span>
                    <span className="text-[10px] text-red-600 font-semibold">{row.fine.days}d late</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-gray-200">
                    <span className={`text-sm font-bold ${row.state === 'paid' ? 'text-green-700' : 'text-red-700'}`}>
                      {formatMoney(row.fine.amount, settings)}
                    </span>
                    <PaymentAction row={row} onPay={openPaymentModal} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto overflow-y-auto flex-1 scrollbar-hide">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-[#fe9800] sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Borrower</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Book SR No</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Book</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Due Date</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Returned</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Days Late</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Fine</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-[#002147] uppercase tracking-tight">Payment</th>
                  <th className="px-3 py-2 text-center text-xs font-bold text-[#002147] uppercase tracking-tight">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-4 py-12 text-center">
                      <EmptyState />
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => (
                    <tr key={row.id} className={`hover:bg-gray-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-xs text-[#002147] truncate">
                              {row.reserver_name}
                            </span>
                            <span className="text-[10px] text-gray-500">{row.reserver_id}</span>
                          </div>
                          <span className={`text-[9px] px-1 py-0.5 rounded whitespace-nowrap flex-shrink-0 ${
                            row.reserver_role === 'teacher'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {row.reserver_role === 'teacher' ? 'T' : 'S'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-[#002147] font-semibold">
                          {row.book?.sr_no || row.book_sr_no || 'N/A'}
                        </span>
                      </td>
                      <td className="px-3 py-2 max-w-[200px]">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-xs text-[#002147] truncate block" title={row.book_name}>
                            {row.book_name}
                          </span>
                          {row.book?.author && (
                            <span className="text-[10px] text-gray-500 truncate block" title={row.book.author}>
                              {row.book.author}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] text-red-600 font-semibold whitespace-nowrap">
                          {formatDate(row.due_date)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {row.return_date ? (
                          <span className="text-[10px] text-gray-600 whitespace-nowrap">
                            {formatDate(row.return_date)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-orange-600 font-semibold whitespace-nowrap">
                            Still out
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] font-bold text-red-600">{row.fine.days}d</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-bold whitespace-nowrap ${
                          row.state === 'paid' ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {formatMoney(row.fine.amount, settings)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border w-fit ${stateStyles[row.state]}`}>
                            {stateLabels[row.state]}
                          </span>
                          {row.state === 'paid' && row.fine_paid_at && (
                            <span className="text-[9px] text-gray-500 mt-0.5">
                              {formatDate(row.fine_paid_at)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-center">
                          <PaymentAction row={row} onPay={openPaymentModal} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-2 md:px-4 py-2 md:py-3 bg-gray-50 border-t-2 border-[#002147] flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] md:text-sm text-gray-600">
              Showing <span className="font-semibold text-[#002147]">{filteredRows.length}</span> of{' '}
              <span className="font-semibold text-[#002147]">{fineRows.length}</span> fine record(s)
            </p>
            <p className="text-[10px] md:text-sm text-gray-600">
              Shown total:{' '}
              <span className="font-bold text-[#002147]">{formatMoney(sum(filteredRows), settings)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {selected && (() => {
        const fine = fineFor(selected)
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full border-2 border-green-500 shadow-2xl">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center border-2 border-green-500">
                    <Wallet className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-[#002147]">Record Payment</h3>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg mb-4 border-2 border-gray-200">
                  <p className="text-sm font-semibold text-[#002147]">{selected.reserver_name}</p>
                  <p className="text-xs text-gray-500">{selected.reserver_id}</p>
                  <p className="text-sm text-gray-600 mt-1">{selected.book_name}</p>
                  <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-gray-200">
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Due</p>
                      <p className="text-xs font-semibold text-[#002147]">{formatDate(selected.due_date)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Returned</p>
                      <p className="text-xs font-semibold text-[#002147]">{formatDate(selected.return_date)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Days Late</p>
                      <p className="text-xs font-semibold text-red-600">{fine.days}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3 mb-4">
                  <p className="text-[10px] font-bold text-green-800 uppercase">Amount to collect</p>
                  <p className="text-2xl font-bold text-green-800">
                    {formatMoney(fine.amount, settings)}
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={paidOn}
                    onChange={(e) => setPaidOn(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 text-sm focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none"
                  />
                </div>

                <div className="flex items-start gap-2 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-2.5 mb-4">
                  <AlertTriangle className="w-4 h-4 text-yellow-700 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-yellow-800">
                    This marks the fine as collected. It cannot be undone from the admin panel.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setSelected(null)}
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium border-2 border-gray-400 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRecordPayment}
                    disabled={saving || !paidOn}
                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium border-2 border-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Recording...' : 'Record Payment'}
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

/** The per-row action: collect an unpaid fine, or explain why it cannot be. */
function PaymentAction({ row, onPay }) {
  if (row.state === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700">
        <CheckCircle className="w-3.5 h-3.5" />
        Paid
      </span>
    )
  }

  if (row.state === 'accruing') {
    return (
      <span className="text-[10px] text-gray-500 italic whitespace-nowrap" title="The fine is settled when the book comes back">
        On return
      </span>
    )
  }

  return (
    <button
      onClick={() => onPay(row)}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-[10px] font-bold border-2 border-green-700 whitespace-nowrap"
      title="Record this fine as collected"
    >
      <Wallet className="w-3.5 h-3.5" />
      Record Payment
    </button>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center py-6">
      <div className="w-12 h-14 bg-[#fe9800] rounded shadow-lg flex items-center justify-center mb-2 border-2 border-[#002147]">
        <Wallet className="w-5 h-5 text-white" />
      </div>
      <p className="text-[#002147] text-sm font-serif font-medium text-center">No fine records found</p>
      <p className="text-gray-600 text-xs mt-1 text-center">Try a different filter or search</p>
    </div>
  )
}
