import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { requireSession } from '@/lib/session'
import { today } from '@/lib/loans'
import { attachBooks, ACTIVE_STATUSES, ARCHIVED_STATUSES } from '@/lib/reservationsServer'

/**
 * GET /api/reservations?scope=active|archived|all|fines
 *
 * `fines` returns every row that carries a fine: one already charged at return
 * (`fine_amount > 0`, paid or not) and one still building up on a book that is
 * out past its due date. The second kind has no stored amount yet -- the page
 * works it out live -- so it has to be matched on the due date instead.
 *
 * `public.reservations` has row level security scoped to the mobile app's
 * signed-in user, so the browser's anon key reads zero rows from it. All
 * reservation reads therefore run here with the service role key.
 *
 * Each row comes back with its book attached under `.book`.
 */
export async function GET(request) {
  const { response: authError } = await requireSession()
  if (authError) return authError

  try {
    const scope = new URL(request.url).searchParams.get('scope') || 'all'
    const supabase = getSupabaseAdmin()

    let query = supabase.from('reservations').select('*')

    if (scope === 'active') {
      query = query.in('status', ACTIVE_STATUSES).order('reservation_date', { ascending: false })
    } else if (scope === 'fines') {
      query = query
        .or(`fine_amount.gt.0,and(status.eq.confirmed,due_date.lt.${today()})`)
        .order('updated_at', { ascending: false })
    } else if (scope === 'archived') {
      query = query.in('status', ARCHIVED_STATUSES).order('updated_at', { ascending: false })
    } else {
      query = query.order('reservation_date', { ascending: false })
    }

    const { data: reservations, error } = await query
    if (error) throw error

    return NextResponse.json({
      reservations: await attachBooks(supabase, reservations || [])
    })
  } catch (error) {
    console.error('GET /api/reservations failed:', error)
    return NextResponse.json({ error: error.message, reservations: [] }, { status: 500 })
  }
}

/**
 * POST /api/reservations — create a reservation on the borrower's behalf.
 *
 * Used by both admin flows: "Search & Reserve" on the Reservations page and
 * "Allocate" on the Books page. Runs with the service role key, so it is not
 * blocked by the row level security policies written for the mobile app.
 *
 * Body: {
 *   book_id, reserver_id, reserver_name, reserver_role,
 *   issue_date?, due_date?, status?, user_id?
 * }
 */
export async function POST(request) {
  const { response: authError } = await requireSession()
  if (authError) return authError

  try {
    const body = await request.json()

    const reserverId = String(body.reserver_id || '').trim()
    const reserverName = String(body.reserver_name || '').trim()
    const reserverRole = body.reserver_role === 'teacher' ? 'teacher' : 'student'
    const status = body.status === 'pending' ? 'pending' : 'confirmed'

    if (!reserverId) {
      return NextResponse.json({ error: 'Reserver ID is required' }, { status: 400 })
    }

    if (!reserverName) {
      return NextResponse.json({ error: 'Reserver name is required' }, { status: 400 })
    }

    if (!body.book_id) {
      return NextResponse.json({ error: 'A book must be selected' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Look the book up by its integer book_id so the caller cannot invent one.
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, book_id, name, sr_no, status')
      .eq('book_id', Number(body.book_id))
      .single()

    if (bookError || !book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    if (status === 'confirmed' && book.status !== 'Available') {
      return NextResponse.json(
        { error: `"${book.name}" is already allocated` },
        { status: 409 }
      )
    }

    // The admin sets the loan length per reservation, so a due date is required.
    const issueDate = body.issue_date || today()
    const dueDate = body.due_date

    if (status === 'confirmed' && !dueDate) {
      return NextResponse.json({ error: 'A due date is required' }, { status: 400 })
    }

    if (dueDate && new Date(dueDate) < new Date(issueDate)) {
      return NextResponse.json(
        { error: 'Due date cannot be earlier than the issue date' },
        { status: 400 }
      )
    }

    const { data: reservation, error: insertError } = await supabase
      .from('reservations')
      .insert([{
        reserver_id: reserverId,
        reserver_name: reserverName,
        reserver_role: reserverRole,
        user_id: body.user_id || null,
        book_id: book.book_id,
        book_name: book.name,
        book_sr_no: book.sr_no || '',
        status,
        issue_date: status === 'confirmed' ? issueDate : null,
        due_date: status === 'confirmed' ? dueDate : null,
        fine_amount: 0,
        fine_paid: false
      }])
      .select()
      .single()

    if (insertError) throw insertError

    // Take the book off the shelf.
    if (status === 'confirmed') {
      const { error: statusError } = await supabase
        .from('books')
        .update({ status: 'Allocated' })
        .eq('id', book.id)

      if (statusError) {
        // Roll the reservation back so the two tables cannot disagree.
        await supabase.from('reservations').delete().eq('id', reservation.id)
        throw statusError
      }
    }

    return NextResponse.json({ reservation }, { status: 201 })
  } catch (error) {
    console.error('POST /api/reservations failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
