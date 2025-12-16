import { supabase } from './supabase'

/**
 * Get the currently authenticated user
 * @returns {Promise<User|null>} The current user or null
 */
export async function getCurrentUser() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.user || null
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Get the current user's profile from the profiles table
 * @returns {Promise<Object|null>} The user profile or null
 */
export async function getCurrentUserProfile() {
  try {
    const user = await getCurrentUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error getting user profile:', error)
    return null
  }
}

/**
 * Sign out the current user
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return true
  } catch (error) {
    console.error('Error signing out:', error)
    return false
  }
}

/**
 * Check if a user has admin role
 * @param {string} userId - The user ID to check
 * @returns {Promise<boolean>} True if user is admin, false otherwise
 */
export async function isAdmin(userId) {
  try {
    if (!userId) return false

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single()

    if (error) {
      // If no role found, check profiles table fallback
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
      
      return profileData?.role === 'admin'
    }
    
    return !!data
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

/**
 * Check if user is authenticated and is admin
 * @returns {Promise<Object>} Object with user and isAdmin boolean
 */
export async function checkAdminStatus() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { user: null, isAdmin: false }
    }

    const adminStatus = await isAdmin(user.id)
    return { user, isAdmin: adminStatus }
  } catch (error) {
    console.error('Error checking admin status:', error)
    return { user: null, isAdmin: false }
  }
}



