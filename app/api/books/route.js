import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * GET - Fetch all books or filter by query params
 * Query params: status, department, search
 */
export async function GET(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const department = searchParams.get('department')
    const search = searchParams.get('search')

    // Build query
    let query = supabase
      .from('books')
      .select('*')
      .order('created_at', { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (department) {
      query = query.eq('department', department)
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,author.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ books: data }, { status: 200 })
  } catch (error) {
    console.error('GET /api/books error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch books' },
      { status: 500 }
    )
  }
}

/**
 * POST - Create a new book
 * Body: { name, author, type, department, status }
 */
export async function POST(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('role', 'admin')
      .single()

    if (!roleData) {
      // Check profiles table as fallback
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profileData?.role !== 'admin') {
        return NextResponse.json(
          { error: 'Forbidden: Admin access required' },
          { status: 403 }
        )
      }
    }

    // Parse request body
    const body = await request.json()
    const { name, author, type, department, status = 'Available' } = body

    // Validate required fields
    if (!name || !author || !type || !department) {
      return NextResponse.json(
        { error: 'Missing required fields: name, author, type, department' },
        { status: 400 }
      )
    }

    // Insert book
    const { data, error } = await supabase
      .from('books')
      .insert([
        {
          name,
          author,
          type,
          department,
          status,
          uploaded_by: session.user.id
        }
      ])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(
      { message: 'Book created successfully', book: data },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/books error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create book' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Update an existing book
 * Body: { id, name, author, type, department, status }
 */
export async function PUT(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('role', 'admin')
      .single()

    if (!roleData) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profileData?.role !== 'admin') {
        return NextResponse.json(
          { error: 'Forbidden: Admin access required' },
          { status: 403 }
        )
      }
    }

    // Parse request body
    const body = await request.json()
    const { id, name, author, type, department, status } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Book ID is required' },
        { status: 400 }
      )
    }

    // Build update object (only include provided fields)
    const updates = {}
    if (name !== undefined) updates.name = name
    if (author !== undefined) updates.author = author
    if (type !== undefined) updates.type = type
    if (department !== undefined) updates.department = department
    if (status !== undefined) updates.status = status

    // Update book
    const { data, error } = await supabase
      .from('books')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(
      { message: 'Book updated successfully', book: data },
      { status: 200 }
    )
  } catch (error) {
    console.error('PUT /api/books error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update book' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Delete a book
 * Query param: id
 */
export async function DELETE(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('role', 'admin')
      .single()

    if (!roleData) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profileData?.role !== 'admin') {
        return NextResponse.json(
          { error: 'Forbidden: Admin access required' },
          { status: 403 }
        )
      }
    }

    // Get book ID from query params
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Book ID is required' },
        { status: 400 }
      )
    }

    // Delete book
    const { error } = await supabase
      .from('books')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json(
      { message: 'Book deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('DELETE /api/books error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete book' },
      { status: 500 }
    )
  }
}
