import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { requireSession } from '@/lib/session'

/**
 * GET /api/account — the signed-in admin's own record.
 *
 * The user id comes from the signed session cookie, never from the client, so
 * one admin cannot read or edit another's account.
 */
export async function GET() {
  const { userId, response } = await requireSession()
  if (response) return response

  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('users')
      .select('id, username, name, email, created_at')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return NextResponse.json({ error: 'Account no longer exists' }, { status: 404 })
    }

    return NextResponse.json({ user: data })
  } catch (error) {
    console.error('GET /api/account failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * PATCH /api/account — update the signed-in admin's own credentials.
 * Body: { action: 'username', username } | { action: 'password', currentPassword, newPassword }
 */
export async function PATCH(request) {
  const { userId, response } = await requireSession()
  if (response) return response

  try {
    const body = await request.json()
    const supabase = getSupabaseAdmin()

    if (body.action === 'username') {
      return await updateUsername(supabase, userId, body)
    }

    if (body.action === 'password') {
      return await updatePassword(supabase, userId, body)
    }

    return NextResponse.json({ error: `Unknown action "${body.action}"` }, { status: 400 })
  } catch (error) {
    console.error('PATCH /api/account failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function updateUsername(supabase, userId, body) {
  const username = String(body.username || '').trim()

  if (!username) {
    return NextResponse.json({ error: 'Username cannot be empty' }, { status: 400 })
  }

  const { data: taken, error: checkError } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .neq('id', userId)
    .maybeSingle()

  if (checkError) throw checkError

  if (taken) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('users')
    .update({ username })
    .eq('id', userId)
    .select('id, username, name, email, created_at')
    .single()

  if (error) throw error

  return NextResponse.json({ user: data })
}

async function updatePassword(supabase, userId, body) {
  const { currentPassword, newPassword } = body

  if (!currentPassword) {
    return NextResponse.json({ error: 'Please enter your current password' }, { status: 400 })
  }

  if (!newPassword || String(newPassword).length < 6) {
    return NextResponse.json(
      { error: 'New password must be at least 6 characters' },
      { status: 400 }
    )
  }

  const { data: user, error: loadError } = await supabase
    .from('users')
    .select('password')
    .eq('id', userId)
    .maybeSingle()

  if (loadError) throw loadError

  if (!user || user.password !== currentPassword) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
  }

  const { error } = await supabase
    .from('users')
    .update({ password: newPassword })
    .eq('id', userId)

  if (error) throw error

  return NextResponse.json({ ok: true })
}
