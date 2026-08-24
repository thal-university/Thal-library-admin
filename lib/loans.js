/**
 * Loan maths shared by the server routes and the client pages.
 * Pure functions only — no Supabase, no React, safe on both sides.
 */

export const DEFAULT_SETTINGS = {
  fine_per_day: 10,
  currency: 'PKR'
}

/** Format a Date (or ISO string) as the `YYYY-MM-DD` string Postgres `date` wants. */
export function toDateInput(value) {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** Today as a `YYYY-MM-DD` string. */
export function today() {
  return toDateInput(new Date())
}

/** Render a date for display, e.g. `12 Jan 2026`. */
export function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * Whole days a book is late. Counts from `dueDate` to `returnDate`
 * (or to today while the book is still out). Never negative.
 * @returns {number}
 */
export function daysOverdue(dueDate, returnDate = null) {
  if (!dueDate) return 0

  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return 0
  due.setHours(0, 0, 0, 0)

  const end = returnDate ? new Date(returnDate) : new Date()
  if (Number.isNaN(end.getTime())) return 0
  end.setHours(0, 0, 0, 0)

  const diff = Math.floor((end - due) / (24 * 60 * 60 * 1000))
  return diff > 0 ? diff : 0
}

/**
 * Fine owed for a loan. Charged per day once the due date has passed --
 * to the return date if the book is back, otherwise to today, so an
 * outstanding fine keeps growing on its own.
 *
 * @param {string} dueDate
 * @param {string|null} returnDate - null while the book is still out
 * @param {Object} settings
 * @returns {{ days: number, amount: number }}
 */
export function calculateFine(dueDate, returnDate, settings = DEFAULT_SETTINGS) {
  const days = daysOverdue(dueDate, returnDate)
  const amount = days * Number(settings?.fine_per_day ?? 0)

  return { days, amount: Math.round(amount * 100) / 100 }
}

/** `PKR 250` style money string. */
export function formatMoney(amount, settings = DEFAULT_SETTINGS) {
  const value = Number(amount || 0)
  return `${settings?.currency || 'PKR'} ${value.toLocaleString('en-PK', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}`
}
