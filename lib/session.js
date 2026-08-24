import crypto from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const SESSION_COOKIE = 'library_session'

/** Sessions last a week. */
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60

function getSecret() {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!secret) {
    throw new Error(
      'Missing SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY) — see supabase/README.md.'
    )
  }

  return secret
}

function sign(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

/**
 * Build a signed `userId.expiry.signature` token.
 * @param {string} userId
 * @returns {string}
 */
export function createSessionToken(userId) {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000
  const payload = `${userId}.${expiresAt}`
  return `${payload}.${sign(payload)}`
}

/**
 * Verify a token and return the user id it carries.
 * @param {string} token
 * @returns {string|null} null if tampered with, malformed or expired
 */
export function verifySessionToken(token) {
  if (!token) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [userId, expiresAt, signature] = parts
  const expected = sign(`${userId}.${expiresAt}`)

  const given = Buffer.from(signature)
  const want = Buffer.from(expected)

  if (given.length !== want.length) return null
  if (!crypto.timingSafeEqual(given, want)) return null
  if (Number(expiresAt) < Date.now()) return null

  return userId
}

/** Cookie options shared by login and logout. */
export function sessionCookieOptions(maxAge = MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge
  }
}

/**
 * The signed-in admin's user id, or null.
 * @returns {Promise<string|null>}
 */
export async function getSessionUserId() {
  const cookieStore = await cookies()
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)
}

/**
 * Guard for admin API routes.
 * @returns {Promise<{ userId: string, response: null } | { userId: null, response: NextResponse }>}
 */
export async function requireSession() {
  const userId = await getSessionUserId()

  if (!userId) {
    return {
      userId: null,
      response: NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }
  }

  return { userId, response: null }
}
