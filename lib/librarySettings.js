import { DEFAULT_SETTINGS } from './loans'

export {
  DEFAULT_SETTINGS,
  toDateInput,
  today,
  formatDate,
  daysOverdue,
  calculateFine,
  formatMoney
} from './loans'

/** Throw the API's error message rather than a bare "500". */
async function unwrap(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`)
  return payload
}

/**
 * Read the library settings.
 * Falls back to DEFAULT_SETTINGS so the UI still renders if the migration or
 * the service role key is not in place yet.
 * @returns {Promise<Object>}
 */
export async function getLibrarySettings() {
  try {
    const payload = await unwrap(await fetch('/api/settings'))
    return { ...DEFAULT_SETTINGS, ...payload.settings }
  } catch (error) {
    console.error('Error fetching library settings:', error)
    return { ...DEFAULT_SETTINGS }
  }
}

/**
 * Save the fine rate.
 * @param {Object} settings - { fine_per_day }
 * @returns {Promise<Object>} The saved settings
 */
export async function updateLibrarySettings(settings) {
  const payload = await unwrap(await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fine_per_day: Number(settings.fine_per_day) })
  }))

  return payload.settings
}

/**
 * Create a reservation on a borrower's behalf (search & reserve, allocate).
 * @param {Object} input - book_id, reserver_id, reserver_name, reserver_role, issue_date, due_date
 * @returns {Promise<Object>} The created reservation
 */
export async function createReservation(input) {
  const payload = await unwrap(await fetch('/api/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  }))

  return payload.reservation
}

/**
 * Move a reservation through its lifecycle.
 * @param {number} id
 * @param {'confirm'|'return'|'cancel'|'mark-fine-paid'} action
 * @param {Object} [input] - issue_date / due_date for confirm,
 *   return_date / fine_amount / fine_paid for return
 */
export async function updateReservation(id, action, input = {}) {
  return unwrap(await fetch(`/api/reservations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...input })
  }))
}

/**
 * Record a fine as collected.
 * @param {number} id
 * @param {string} [paidOn] - `YYYY-MM-DD`, defaults to today server-side
 */
export async function recordFinePayment(id, paidOn) {
  const payload = await updateReservation(id, 'mark-fine-paid', paidOn ? { paid_on: paidOn } : {})
  return payload.reservation
}

/**
 * Read reservations. Runs server-side because row level security hides the
 * table from the browser's anon key.
 * @param {'active'|'archived'|'all'|'fines'} scope
 * @returns {Promise<Array<Object>>} rows with `.book` attached
 */
export async function fetchReservationsList(scope = 'all') {
  const payload = await unwrap(await fetch(`/api/reservations?scope=${scope}`))
  return payload.reservations || []
}

/**
 * Search borrowers.
 * @param {'student'|'teacher'} role
 * @param {string} query - roll number or name
 * @returns {Promise<Array<Object>>}
 */
export async function searchPeople(role, query) {
  const payload = await unwrap(
    await fetch(`/api/people?role=${role}&q=${encodeURIComponent(query)}`)
  )
  return payload.people || []
}

/**
 * Every reservation a person has ever made.
 * @param {Object} person - as returned by searchPeople()
 * @returns {Promise<Array<Object>>} rows with `.book` attached
 */
export async function fetchPersonHistory(person) {
  const payload = await unwrap(await fetch('/api/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(person)
  }))
  return payload.history || []
}
