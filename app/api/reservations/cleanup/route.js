import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { requireSession } from '@/lib/session'

/** Pending reservations expire after this long. */
const EXPIRY_HOURS = 43

/**
 * POST /api/reservations/cleanup — drop pending reservations nobody collected.
 * Called when the Reservations page loads.
 */
export async function POST() {
  const { response: authError } = await requireSession()
  if (authError) return authError

  try {
    const supabase = getSupabaseAdmin()
    const cutoff = new Date(Date.now() - EXPIRY_HOURS * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('reservations')
      .delete()
      .eq('status', 'pending')
      .lt('created_at', cutoff)
      .select('id')

    if (error) throw error

    return NextResponse.json({ removed: data?.length || 0 })
  } catch (error) {
    console.error('POST /api/reservations/cleanup failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
