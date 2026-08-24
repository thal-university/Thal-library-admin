/**
 * Server-side reservation helpers. Used only by `app/api/**` route handlers.
 */

export const ACTIVE_STATUSES = ['pending', 'confirmed']
export const ARCHIVED_STATUSES = ['returned', 'completed', 'deleted']

/**
 * Attach each reservation's book, looked up by serial number.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<Object>} reservations
 * @returns {Promise<Array<Object>>} the same rows with `.book` set
 */
export async function attachBooks(supabase, reservations) {
  const srNos = [...new Set(reservations.map(r => r.book_sr_no).filter(Boolean))]
  if (srNos.length === 0) return reservations.map(r => ({ ...r, book: null }))

  const booksMap = {}

  // Chunked so a long history cannot blow past the URL length limit.
  for (let i = 0; i < srNos.length; i += 200) {
    const { data } = await supabase
      .from('books')
      .select('id, book_id, name, author, edition, department, status, sr_no')
      .in('sr_no', srNos.slice(i, i + 200))

    data?.forEach(b => { booksMap[b.sr_no] = b })
  }

  return reservations.map(r => ({ ...r, book: booksMap[r.book_sr_no] || null }))
}
