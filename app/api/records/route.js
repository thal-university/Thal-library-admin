import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { requireSession } from '@/lib/session'
import { attachBooks } from '@/lib/reservationsServer'

/**
 * POST /api/records — every reservation a given person has ever made.
 *
 * Runs server-side with the service role key: `public.reservations` has row
 * level security scoped to the mobile app's signed-in user, so the browser's
 * anon key reads zero rows from it.
 *
 * Body: the person object returned by /api/people
 */
export async function POST(request) {
  const { response: authError } = await requireSession()
  if (authError) return authError

  try {
    const person = await request.json()
    const supabase = getSupabaseAdmin()

    // Reservations record the borrower as a free-text id + name, so match on
    // whichever the mobile app happened to write. Values are quoted so commas
    // and dots cannot break the PostgREST `or` syntax.
    const quote = (v) => `"${String(v).replace(/"/g, '')}"`

    const filters = []
    if (person.id) filters.push(`user_id.eq.${person.id}`)
    if (person.identifier) filters.push(`reserver_id.ilike.${quote(person.identifier)}`)
    if (person.email && person.email !== person.identifier) {
      filters.push(`reserver_id.ilike.${quote(person.email)}`)
    }
    if (person.name) filters.push(`reserver_name.ilike.${quote(person.name)}`)

    if (filters.length === 0) {
      return NextResponse.json({ history: [] })
    }

    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .or(filters.join(','))
      .order('reservation_date', { ascending: false })

    if (error) throw error

    return NextResponse.json({ history: await attachBooks(supabase, data || []) })
  } catch (error) {
    console.error('POST /api/records failed:', error)
    return NextResponse.json({ error: error.message, history: [] }, { status: 500 })
  }
}
