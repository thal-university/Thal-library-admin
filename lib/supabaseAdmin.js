import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client backed by the service role key.
 *
 * It bypasses row level security, so it may ONLY be used from server code
 * (`app/api/**` route handlers). Never import this from a `'use client'` file:
 * `SUPABASE_SERVICE_ROLE_KEY` has no `NEXT_PUBLIC_` prefix, so it is undefined
 * in the browser and this would throw rather than leak — but keep it server
 * side regardless.
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  }

  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local — see supabase/README.md.'
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}
