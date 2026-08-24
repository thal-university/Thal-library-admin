import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { requireSession } from '@/lib/session'
import { DEFAULT_SETTINGS } from '@/lib/loans'

/**
 * GET /api/settings — read the single library_settings row.
 */
export async function GET() {
  const { response: authError } = await requireSession()
  if (authError) return authError

  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('library_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    if (error) throw error

    // No row yet (migration seeded nothing) is not an error -- fall back.
    return NextResponse.json({ settings: { ...DEFAULT_SETTINGS, ...(data || {}) } })
  } catch (error) {
    console.error('GET /api/settings failed:', error)
    return NextResponse.json(
      { error: error.message, settings: DEFAULT_SETTINGS },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/settings — save the fine rate.
 * Body: { fine_per_day }
 */
export async function PUT(request) {
  const { response: authError } = await requireSession()
  if (authError) return authError

  try {
    const body = await request.json()

    const finePerDay = Number(body.fine_per_day)

    if (!Number.isFinite(finePerDay) || finePerDay < 0) {
      return NextResponse.json({ error: 'Fine per day must be zero or more' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('library_settings')
      .update({ fine_per_day: finePerDay })
      .eq('id', 1)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ settings: { ...DEFAULT_SETTINGS, ...data } })
  } catch (error) {
    console.error('PUT /api/settings failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
