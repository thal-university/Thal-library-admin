import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session'

/**
 * POST /api/auth/login
 *
 * Runs server-side with the service role key: `public.users` has row level
 * security on, so the browser's anon key reads zero rows from it and could
 * never authenticate anyone. Keeping this on the server also means the
 * password never travels as a query filter and the stored password never
 * reaches the browser.
 *
 * Body: { username, password }
 */
export async function POST(request) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, name, email, password')
      .eq('username', username)
      .maybeSingle()

    if (error) throw error

    // Same response either way, so the form cannot be used to discover which
    // usernames exist.
    if (!user || user.password !== password) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email
    }

    const response = NextResponse.json({ user: safeUser })
    response.cookies.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions())

    return response
  } catch (error) {
    console.error('POST /api/auth/login failed:', error)
    return NextResponse.json(
      { error: error.message || 'Login failed' },
      { status: 500 }
    )
  }
}
