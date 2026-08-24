import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { requireSession } from '@/lib/session'

/**
 * GET /api/people?role=student|teacher&q=...
 *
 * Borrower lookup for the admin panel. `public.profiles` and
 * `public.faculty_directory` both have row level security scoped to the
 * signed-in mobile user, so the browser's anon key reads zero rows from them —
 * these searches have to run server-side with the service role key.
 *
 * Students are matched on roll number (or name), teachers on name.
 */
export async function GET(request) {
  const { response: authError } = await requireSession()
  if (authError) return authError

  try {
    const params = new URL(request.url).searchParams
    const role = params.get('role') === 'teacher' ? 'teacher' : 'student'
    const term = (params.get('q') || '').trim()

    if (!term) {
      return NextResponse.json({ people: [] })
    }

    const supabase = getSupabaseAdmin()
    const people = role === 'student'
      ? await findStudents(supabase, term)
      : await findTeachers(supabase, term)

    return NextResponse.json({ people })
  } catch (error) {
    console.error('GET /api/people failed:', error)
    return NextResponse.json({ error: error.message, people: [] }, { status: 500 })
  }
}

async function findStudents(supabase, term) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, roll_number, official_email, full_name, department, user_type, role, cnic, father_name, status')
    .or(`roll_number.ilike.%${term}%,full_name.ilike.%${term}%`)
    .limit(25)

  if (error) throw error

  return (data || [])
    .filter(p => p.user_type !== 'faculty' && p.role !== 'teacher')
    .map(p => ({
      id: p.id,
      kind: 'student',
      name: p.full_name || 'Unknown',
      identifier: p.roll_number,
      email: p.official_email,
      department: p.department,
      cnic: p.cnic,
      father_name: p.father_name,
      status: p.status
    }))
}

async function findTeachers(supabase, term) {
  const [profileResult, directoryResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, roll_number, official_email, full_name, department, user_type, role, cnic, father_name, status')
      .ilike('full_name', `%${term}%`)
      .limit(25),
    supabase
      .from('faculty_directory')
      .select('id, official_email, full_name, department, status, is_active')
      .ilike('full_name', `%${term}%`)
      .limit(25)
  ])

  if (profileResult.error) throw profileResult.error
  if (directoryResult.error) throw directoryResult.error

  const results = []
  const seenEmails = new Set()

  ;(profileResult.data || [])
    .filter(p => p.user_type === 'faculty' || p.role === 'teacher')
    .forEach(p => {
      seenEmails.add((p.official_email || '').toLowerCase())
      results.push({
        id: p.id,
        kind: 'teacher',
        name: p.full_name || 'Unknown',
        identifier: p.official_email,
        email: p.official_email,
        department: p.department,
        cnic: p.cnic,
        father_name: p.father_name,
        status: p.status
      })
    })

  // Faculty listed in the directory who have not signed up yet
  ;(directoryResult.data || []).forEach(f => {
    if (seenEmails.has((f.official_email || '').toLowerCase())) return
    results.push({
      id: null,
      key: f.id,
      kind: 'teacher',
      name: f.full_name,
      identifier: f.official_email,
      email: f.official_email,
      department: f.department,
      status: f.is_active ? 'Active' : 'Inactive',
      directoryOnly: true
    })
  })

  return results
}
