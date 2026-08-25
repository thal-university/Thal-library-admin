import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { requireSession } from '@/lib/session'
import { DEFAULT_SETTINGS, calculateFine, today } from '@/lib/loans'

/**
 * PATCH /api/reservations/[id] — move a reservation through its lifecycle.
 *
 * Body: { action: 'confirm' | 'return' | 'cancel' | 'mark-fine-paid', ... }
 *   confirm        -> { issue_date, due_date }   sets status 'confirmed', book 'Allocated'
 *   return         -> { return_date, fine_amount?, fine_paid? }
 *                                                sets status 'returned', book 'Available', records the fine
 *   cancel         -> {}                         archives the row, book back to 'Available'
 *   mark-fine-paid -> { paid_on? }               records the fine as collected
 */
export async function PATCH(request, { params }) {
  const { response: authError } = await requireSession()
  if (authError) return authError

  try {
    const { id } = await params
    const body = await request.json()
    const supabase = getSupabaseAdmin()

    const { data: reservation, error: loadError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', Number(id))
      .single()

    if (loadError || !reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }

    const { data: settingsRow } = await supabase
      .from('library_settings')
      .select('*')
      .eq('id', 1)
      .single()

    const settings = { ...DEFAULT_SETTINGS, ...settingsRow }

    switch (body.action) {
      case 'confirm':
        return await confirmReservation(supabase, reservation, body, settings)
      case 'return':
        return await returnReservation(supabase, reservation, body, settings)
      case 'cancel':
        return await cancelReservation(supabase, reservation)
      case 'mark-fine-paid':
        return await markFinePaid(supabase, reservation, body)
      default:
        return NextResponse.json({ error: `Unknown action "${body.action}"` }, { status: 400 })
    }
  } catch (error) {
    console.error('PATCH /api/reservations/[id] failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/reservations/[id] — drop a pending reservation outright.
 * Confirmed reservations are archived instead, so the borrowing record survives.
 */
export async function DELETE(request, { params }) {
  const { response: authError } = await requireSession()
  if (authError) return authError

  try {
    const { id } = await params
    const supabase = getSupabaseAdmin()

    const { data: reservation, error: loadError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', Number(id))
      .single()

    if (loadError || !reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }

    if (reservation.status === 'confirmed') {
      return await cancelReservation(supabase, reservation)
    }

    const { error } = await supabase.from('reservations').delete().eq('id', reservation.id)
    if (error) throw error

    return NextResponse.json({ ok: true, deleted: true })
  } catch (error) {
    console.error('DELETE /api/reservations/[id] failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function confirmReservation(supabase, reservation, body, settings) {
  const issueDate = body.issue_date || today()
  const dueDate = body.due_date

  if (!dueDate) {
    return NextResponse.json({ error: 'A due date is required' }, { status: 400 })
  }

  if (new Date(dueDate) < new Date(issueDate)) {
    return NextResponse.json(
      { error: 'Due date cannot be earlier than the issue date' },
      { status: 400 }
    )
  }

  const book = await findBook(supabase, reservation)

  if (!book) {
    return NextResponse.json({ error: 'Could not find the book to allocate' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('reservations')
    .update({
      status: 'confirmed',
      book_id: book.book_id,
      issue_date: issueDate,
      due_date: dueDate,
      return_date: null,
      fine_amount: 0,
      fine_paid: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', reservation.id)
    .select()
    .single()

  if (error) throw error

  const { error: bookError } = await supabase
    .from('books')
    .update({ status: 'Allocated' })
    .eq('id', book.id)

  if (bookError) throw bookError

  return NextResponse.json({ reservation: data })
}

async function returnReservation(supabase, reservation, body, settings) {
  const returnDate = body.return_date || today()
  const calculated = calculateFine(reservation.due_date, returnDate, settings)

  // The admin records what is actually charged at the counter: normally the
  // calculated amount, but it can be adjusted or waived, and flagged as
  // collected there and then.
  const overridden = body.fine_amount !== undefined && body.fine_amount !== null && body.fine_amount !== ''
  const amount = overridden ? Number(body.fine_amount) : calculated.amount

  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: 'Fine amount must be zero or more' }, { status: 400 })
  }

  // Nothing owed means nothing left to collect.
  const finePaid = amount === 0 ? true : Boolean(body.fine_paid)
  const fine = { days: calculated.days, amount: Math.round(amount * 100) / 100, paid: finePaid }

  const patch = {
    status: 'returned',
    return_date: returnDate,
    fine_amount: fine.amount,
    fine_paid: finePaid,
    // Collected at the counter as the book came back; left open otherwise, for
    // the Fine Records page to settle later.
    fine_paid_at: finePaid && fine.amount > 0 ? returnDate : null,
    updated_at: new Date().toISOString()
  }

  let { data, error } = await supabase
    .from('reservations')
    .update(patch)
    .eq('id', reservation.id)
    .select()
    .single()

  // `fine_paid_at` arrives with migration 03; a return must still go through
  // on a database that has not run it yet.
  if (error && isMissingColumn(error, 'fine_paid_at')) {
    delete patch.fine_paid_at
    ;({ data, error } = await supabase
      .from('reservations')
      .update(patch)
      .eq('id', reservation.id)
      .select()
      .single())
  }

  if (error) throw error

  const book = await findBook(supabase, reservation)

  if (book) {
    const { error: bookError } = await supabase
      .from('books')
      .update({ status: 'Available' })
      .eq('id', book.id)

    if (bookError) throw bookError
  }

  return NextResponse.json({ reservation: data, fine })
}

async function cancelReservation(supabase, reservation) {
  const { data, error } = await supabase
    .from('reservations')
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .eq('id', reservation.id)
    .select()
    .single()

  if (error) throw error

  const book = await findBook(supabase, reservation)

  if (book) {
    const { error: bookError } = await supabase
      .from('books')
      .update({ status: 'Available' })
      .eq('id', book.id)

    if (bookError) throw bookError
  }

  return NextResponse.json({ reservation: data })
}

async function markFinePaid(supabase, reservation, body = {}) {
  if (!(Number(reservation.fine_amount) > 0)) {
    return NextResponse.json({ error: 'This reservation has no fine to collect' }, { status: 400 })
  }

  if (reservation.fine_paid) {
    return NextResponse.json({ error: 'This fine is already marked paid' }, { status: 409 })
  }

  const paidOn = body.paid_on || today()
  const patch = { fine_paid: true, fine_paid_at: paidOn, updated_at: new Date().toISOString() }

  let { data, error } = await supabase
    .from('reservations')
    .update(patch)
    .eq('id', reservation.id)
    .select()
    .single()

  // Migration 03 adds `fine_paid_at`. Until it is run the column is missing,
  // which must not block collecting the money -- record the payment without it.
  if (error && isMissingColumn(error, 'fine_paid_at')) {
    delete patch.fine_paid_at
    ;({ data, error } = await supabase
      .from('reservations')
      .update(patch)
      .eq('id', reservation.id)
      .select()
      .single())
  }

  if (error) throw error

  return NextResponse.json({ reservation: data })
}

/** True when Postgres/PostgREST rejected a write because `column` does not exist. */
function isMissingColumn(error, column) {
  // 42703 is Postgres' undefined_column; PGRST204 is PostgREST's schema-cache miss.
  if (error.code === '42703' || error.code === 'PGRST204') return true
  return typeof error.message === 'string' && error.message.includes(column)
}

/** Resolve the book behind a reservation by book_id, falling back to sr_no. */
async function findBook(supabase, reservation) {
  if (reservation.book_id) {
    const { data } = await supabase
      .from('books')
      .select('id, book_id, name, sr_no')
      .eq('book_id', reservation.book_id)
      .maybeSingle()

    if (data) return data
  }

  if (reservation.book_sr_no) {
    const { data } = await supabase
      .from('books')
      .select('id, book_id, name, sr_no')
      .eq('sr_no', reservation.book_sr_no)
      .maybeSingle()

    if (data) return data
  }

  return null
}
