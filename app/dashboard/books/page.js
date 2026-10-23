

'use client'
import { useEffect, useState } from 'react'
import { GlassCard, EmptyState, Pill, Modal, StatCard, ui } from '@/components/ui/glass'
import Select from '@/components/ui/Select'
import { cn } from '@/lib/utils'
import Loader from '@/components/Loader'
import { supabase } from '@/lib/supabase'
import { Plus, Pencil, Trash2, BookOpen, Search, X, AlertTriangle, Upload, FileSpreadsheet, XCircle, Filter, SlidersHorizontal, Library, BookCheck, BookX, Building2 } from 'lucide-react'

const PER_PAGE_OPTIONS = [[10, '10'], [50, '50'], [100, '100']]
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import {
  getLibrarySettings,
  createReservation,
  DEFAULT_SETTINGS,
  formatDate,
  formatMoney,
  today
} from '@/lib/librarySettings'

export default function BooksPage() {
  const [loading, setLoading] = useState(true)
  const [books, setBooks] = useState([])
  const [departments, setDepartments] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [bookToDelete, setBookToDelete] = useState(null)
  const [editingBook, setEditingBook] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDepartment, setFilterDepartment] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    author: '',
    department: '',
    edition: '',
    sr_no: '',
    status: 'Available'
  })
  const [showBulkImportModal, setShowBulkImportModal] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importPreview, setImportPreview] = useState([])
  const [importing, setImporting] = useState(false)
  const [importErrors, setImportErrors] = useState([])
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [bulkDeleteDepartment, setBulkDeleteDepartment] = useState('')
  const [bulkDeleteCount, setBulkDeleteCount] = useState(0)
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [showAllocationModal, setShowAllocationModal] = useState(false)
  const [bookToAllocate, setBookToAllocate] = useState(null)
  const [allocating, setAllocating] = useState(false)
  const [reserverInfo, setReserverInfo] = useState({
    reserver_name: '',
    reserver_id: '',
    reserver_role: 'student'
  })
  const [librarySettings, setLibrarySettings] = useState(DEFAULT_SETTINGS)
  const [allocationDates, setAllocationDates] = useState({
    issue_date: today(),
    due_date: ''
  })

  // const libraryQuotes = [
  //   "A library is not a luxury but one of the necessities of life. - Henry Ward Beecher",
  //   "The only thing you absolutely have to know is the location of the library. - Albert Einstein",
  //   "Libraries are the backbone of a civilized society. - Neil Gaiman",
  //   "A library is infinity under a roof. - Gail Carson Levine"
  // ]

  // const randomQuote = libraryQuotes[Math.floor(Math.random() * libraryQuotes.length)]

  useEffect(() => {
    fetchBooks()
    fetchDepartments()
    fetchLibrarySettings()
  }, [])

  async function fetchLibrarySettings() {
    setLibrarySettings(await getLibrarySettings())
  }

  async function fetchBooks() {
    try {
      // First, get the total count to know how many batches we need
      const { count: totalCount, error: countError } = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true })

      if (countError) throw countError

      const batchSize = 1000
      const batches = Math.ceil((totalCount || 0) / batchSize)
      let allBooks = []

      // Fetch all books in batches to overcome Supabase's 1000 row limit
      for (let i = 0; i < batches; i++) {
        const { data, error } = await supabase
          .from('books')
          .select(`
            *,
            uploader:uploaded_by (
              id,
              name,
              email,
              username
            )
          `)
          .order('created_at', { ascending: false })
          .range(i * batchSize, (i + 1) * batchSize - 1)

        if (error) throw error
        allBooks = [...allBooks, ...(data || [])]
      }

      // Fetch confirmed reservations separately and map them to books by book_id
      const bookIds = allBooks.map(book => book.book_id).filter(Boolean)
      let reservationsMap = {}

      if (bookIds.length > 0) {
        const { data: reservationsData } = await supabase
          .from('reservations')
          .select('book_id, reserver_name, status')
          .in('book_id', bookIds)
          .eq('status', 'confirmed')

        // Group reservations by book_id
        reservationsData?.forEach(r => {
          if (!reservationsMap[r.book_id]) {
            reservationsMap[r.book_id] = []
          }
          reservationsMap[r.book_id].push(r)
        })
      }

      // Attach reservations to books
      const booksWithConfirmedReservations = allBooks.map(book => ({
        ...book,
        reservations: book.book_id ? (reservationsMap[book.book_id] || []) : []
      }))

      setBooks(booksWithConfirmedReservations)
    } catch (error) {
      console.error('Error fetching books:', error)
      toast.error('Failed to fetch books')
    } finally {
      setLoading(false)
    }
  }

  async function fetchDepartments() {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('department_name', { ascending: true })

      if (error) throw error
      setDepartments(data || [])
    } catch (error) {
      console.error('Error fetching departments:', error)
      toast.error('Failed to fetch departments')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    try {
      // Get current user from localStorage
      const userSession = localStorage.getItem('library_user')
      const user = userSession ? JSON.parse(userSession) : null
      const userId = user?.id

      // Prepare book data with proper null handling
      const bookData = {
        name: formData.name,
        author: formData.author || null,
        department: formData.department,
        edition: formData.edition || null,
        sr_no: formData.sr_no || null,
        status: formData.status
      }

      if (editingBook) {
        const { error } = await supabase
          .from('books')
          .update(bookData)
          .eq('id', editingBook.id)

        if (error) throw error
        toast.success('Book updated successfully!')
      } else {
        // Insert new book with uploaded_by field
        const { error } = await supabase
          .from('books')
          .insert([{
            ...bookData,
            uploaded_by: userId
          }])

        if (error) throw error
        toast.success('Book added successfully!')
      }

      setShowModal(false)
      setEditingBook(null)
      setFormData({ name: '', author: '', department: '', edition: '', sr_no: '', status: 'Available' })
      fetchBooks()
    } catch (error) {
      console.error('Error saving book:', error)
      toast.error('Failed to save book')
    }
  }

  async function confirmDelete() {
    if (!bookToDelete) return

    try {
      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', bookToDelete.id)

      if (error) throw error
      toast.success('Book deleted successfully!')
      setShowDeleteModal(false)
      setBookToDelete(null)
      fetchBooks()
    } catch (error) {
      console.error('Error deleting book:', error)
      toast.error('Failed to delete book')
    }
  }

  function openDeleteModal(book) {
    setBookToDelete(book)
    setShowDeleteModal(true)
  }

  async function toggleBookStatus(book) {
    // If changing to Allocated, show the allocation modal
    if (book.status === 'Available') {
      setBookToAllocate(book)
      setReserverInfo({ reserver_name: '', reserver_id: '', reserver_role: 'student' })
      setAllocationDates({ issue_date: today(), due_date: '' })
      setShowAllocationModal(true)
      return
    }

    // If changing to Available, just update the status and delete the reservation
    try {
      // Delete any confirmed reservation for this book
      await supabase
        .from('reservations')
        .delete()
        .eq('book_id', book.book_id)
        .eq('status', 'confirmed')

      const { error } = await supabase
        .from('books')
        .update({ status: 'Available' })
        .eq('id', book.id)

      if (error) throw error

      toast.success('Book status changed to Available')
      fetchBooks()
    } catch (error) {
      console.error('Error updating book status:', error)
      toast.error('Failed to update book status')
    }
  }

  async function handleAllocateBook(e) {
    e.preventDefault()

    if (!bookToAllocate) return

    const { issue_date: issueDate, due_date: dueDate } = allocationDates

    if (!issueDate || !dueDate) {
      toast.error('Please set both an issue date and a due date')
      return
    }

    if (new Date(dueDate) < new Date(issueDate)) {
      toast.error('Due date cannot be earlier than the issue date')
      return
    }

    try {
      setAllocating(true)

      // Goes through /api/reservations, which uses the service role key and so
      // is not blocked by the mobile app's row level security policies.
      await createReservation({
        book_id: bookToAllocate.book_id,
        reserver_id: reserverInfo.reserver_id,
        reserver_name: reserverInfo.reserver_name,
        reserver_role: reserverInfo.reserver_role,
        issue_date: issueDate,
        due_date: dueDate,
        status: 'confirmed'
      })

      toast.success(`Book allocated! Issued ${formatDate(issueDate)}, due ${formatDate(dueDate)}.`)
      setShowAllocationModal(false)
      setBookToAllocate(null)
      setReserverInfo({ reserver_name: '', reserver_id: '', reserver_role: 'student' })
      fetchBooks()
    } catch (error) {
      console.error('Error allocating book:', error)
      toast.error('Failed to allocate book: ' + error.message)
    } finally {
      setAllocating(false)
    }
  }


  function openEditModal(book) {
    setEditingBook(book)
    setFormData({
      name: book.name,
      author: book.author,
      department: book.department,
      edition: book.edition || '',
      sr_no: book.sr_no || '',
      status: book.status
    })
    setShowModal(true)
  }

  // Handle file selection for bulk import
  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return

    setImportFile(file)
    setImportErrors([])

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = event.target.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

        // Map the data to our schema
        const mappedData = jsonData.map((row, index) => {
          // Try to find columns with various naming conventions
          const name = row.name || row.Name || row.title || row.Title || row['Book Name'] || row['book_name'] || ''
          const author = row.author || row.Author || row['Author Name'] || row['author_name'] || ''
          const department = row.department || row.Department || row.dept || row.Dept || ''
          const edition = row.edition || row.Edition || ''
          const sr_no = row['sr-no'] || row['sr_no'] || row['Sr-No'] || row['Sr_No'] || row['Serial Number'] || row['serial_number'] || row.srno || row.SrNo || ''
          const status = row.status || row.Status || 'Available'

          return {
            rowIndex: index + 2, // Excel rows start at 1, plus header
            name: String(name).trim(),
            author: String(author).trim(),
            department: String(department).trim(),
            edition: String(edition).trim(),
            sr_no: sr_no ? String(sr_no).trim() : '',
            status: status === 'Allocated' ? 'Allocated' : 'Available'
          }
        }).filter(row => row.name) // Filter out empty rows

        setImportPreview(mappedData)
      } catch (error) {
        console.error('Error parsing file:', error)
        toast.error('Failed to parse file. Please check the format.')
        setImportFile(null)
      }
    }
    reader.readAsBinaryString(file)
  }

  // Validate and import books
  async function handleBulkImport() {
    if (importPreview.length === 0) {
      toast.error('No data to import')
      return
    }

    setImporting(true)
    const errors = []
    const validBooks = []

    // Validate each row
    importPreview.forEach((book) => {
      const rowErrors = []

      if (!book.name) {
        rowErrors.push('Name is required')
      }
      if (!book.department) {
        rowErrors.push('Department is required')
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: book.rowIndex,
          errors: rowErrors
        })
      } else {
        validBooks.push({
          name: book.name,
          author: book.author || null,
          department: book.department,
          edition: book.edition || null,
          sr_no: book.sr_no || null,
          status: book.status
        })
      }
    })

    setImportErrors(errors)

    if (validBooks.length === 0) {
      toast.error('No valid books to import')
      setImporting(false)
      return
    }

    try {
      // Get current user from localStorage
      const userSession = localStorage.getItem('library_user')
      const user = userSession ? JSON.parse(userSession) : null
      const userId = user?.id

      // Add uploaded_by to all books
      const booksWithUploader = validBooks.map(book => ({
        ...book,
        uploaded_by: userId
      }))

      const { data, error } = await supabase
        .from('books')
        .insert(booksWithUploader)
        .select()

      if (error) throw error

      const successCount = data?.length || validBooks.length
      const errorCount = errors.length

      if (errorCount > 0) {
        toast.success(`Imported ${successCount} books. ${errorCount} rows had errors.`)
      } else {
        toast.success(`Successfully imported ${successCount} books!`)
      }

      // Reset and close modal
      setShowBulkImportModal(false)
      setImportFile(null)
      setImportPreview([])
      setImportErrors([])
      fetchBooks()
    } catch (error) {
      console.error('Error importing books:', error)
      toast.error('Failed to import books: ' + error.message)
    } finally {
      setImporting(false)
    }
  }

  // Reset bulk import state
  function resetBulkImport() {
    setShowBulkImportModal(false)
    setImportFile(null)
    setImportPreview([])
    setImportErrors([])
  }

  // Filter books by status, department and search query, then sort by sr_no
  const filteredBooks = books
    .filter(book => filterStatus === 'all' || book.status === filterStatus)
    .filter(book => filterDepartment === 'all' || (book.department || '').toLowerCase().trim() === filterDepartment.toLowerCase().trim())
    .filter(book => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        (book.name || '').toLowerCase().includes(query) ||
        (book.author || '').toLowerCase().includes(query) ||
        (book.department || '').toLowerCase().includes(query) ||
        (book.status || '').toLowerCase().includes(query) ||
        (book.sr_no || '').toString().toLowerCase().includes(query)
      )
    })
    .sort((a, b) => {
      // Sort by sr_no in ascending order
      const srNoA = a.sr_no ? parseInt(a.sr_no) : Number.MAX_SAFE_INTEGER
      const srNoB = b.sr_no ? parseInt(b.sr_no) : Number.MAX_SAFE_INTEGER
      return srNoA - srNoB
    })

  // Pagination calculations
  const totalPages = Math.ceil(filteredBooks.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedBooks = filteredBooks.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filterStatus, filterDepartment, searchQuery, itemsPerPage])

  if (loading) return <Loader inline />

  // Labels are trimmed: some department names are stored with stray whitespace
  const deptOptions = departments.map((dept) => [dept.department_name, dept.department_name.trim()])
  const availableCount = books.filter(b => b.status === 'Available').length
  const allocatedCount = books.filter(b => b.status === 'Allocated').length
  const departmentCount = new Set(books.map(b => (b.department || '').trim().toLowerCase()).filter(Boolean)).size

  const segBtn = (active) =>
    cn(
      'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-brand-500/40',
      active
        ? 'bg-[linear-gradient(135deg,#f9a24f,#dd6b12)] text-white shadow-[0_6px_14px_-6px_rgba(221,107,18,0.7)]'
        : 'text-ink-soft hover:bg-surface/80 hover:text-ink'
    )

  const pagerBtn = 'inline-flex h-8 items-center justify-center rounded-lg border border-edge/90 bg-surface/70 px-2.5 text-[12px] font-semibold text-ink-soft transition hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* KPIs */}
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard index={0} icon={Library} label="Total Books" value={books.length.toLocaleString()} hint="Across the whole catalogue" tone="brand" />
        <StatCard index={1} icon={BookCheck} label="Available" value={availableCount.toLocaleString()} hint="On the shelf now" tone="success" />
        <StatCard index={2} icon={BookX} label="Allocated" value={allocatedCount.toLocaleString()} hint="Issued to readers" tone="navy" />
        <StatCard index={3} icon={Building2} label="Departments" value={departmentCount} hint="With books in stock" tone="info" />
      </div>

      {/* Search and Actions Bar */}
      <GlassCard index={4} className="p-3">
        <div className="flex flex-col gap-2.5">
          {/* Top Row: Search + Icon Buttons (Mobile) / Full Layout (Desktop) */}
          <div className="flex items-center gap-2">
            <div className="hidden min-w-0 shrink-0 lg:block lg:pr-2">
              <h1 className="flex items-center gap-1.5 text-[15px] font-bold leading-tight text-heading">
                <BookOpen className="size-4 text-brand-500" />
                Book Collection
              </h1>
              <p className="text-[11.5px] text-ink-muted">Catalogue, allocate and import books</p>
            </div>

            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                placeholder="Search books..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(ui.input, 'pl-9 pr-9')}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-ink-muted transition hover:bg-surface hover:text-ink"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Mobile: Icon Buttons */}
            <div className="flex items-center gap-1.5 md:hidden">
              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'grid size-9 place-items-center rounded-xl border transition',
                  showFilters || filterStatus !== 'all' || filterDepartment !== 'all'
                    ? 'border-brand-400 bg-brand-500/10 text-brand-600'
                    : 'border-edge/90 bg-surface/70 text-ink-soft'
                )}
                title="Filters"
              >
                <Filter className="size-4" />
              </button>

              {/* Actions Toggle */}
              <button
                onClick={() => setShowActions(!showActions)}
                className={cn(
                  'grid size-9 place-items-center rounded-xl border transition',
                  showActions
                    ? 'border-brand-400 bg-brand-500/10 text-brand-600'
                    : 'border-edge/90 bg-surface/70 text-ink-soft'
                )}
                title="Actions"
              >
                <SlidersHorizontal className="size-4" />
              </button>

              {/* Add Button - Always Visible */}
              <button
                onClick={() => {
                  setEditingBook(null)
                  setFormData({ name: '', author: '', department: '', edition: '', sr_no: '', status: 'Available' })
                  setShowModal(true)
                }}
                className={cn(ui.btnPrimary, 'w-9 px-0')}
                title="Add New Book"
              >
                <Plus className="size-4" />
              </button>
            </div>

            {/* Desktop: Full Buttons */}
            <div className="hidden items-center gap-2 md:flex">
              <button
                onClick={() => setShowBulkImportModal(true)}
                className={ui.btnSecondary}
              >
                <Upload className="size-4" />
                Bulk Import
              </button>
              <button
                onClick={() => setShowBulkDeleteModal(true)}
                className={cn(ui.btnSecondary, 'text-rose-600 hover:bg-rose-500/10 hover:text-rose-700')}
                title="Delete all books for a selected department"
              >
                <Trash2 className="size-4" />
                Bulk Delete
              </button>
              <button
                onClick={() => {
                  setEditingBook(null)
                  setFormData({ name: '', author: '', department: '', edition: '', sr_no: '', status: 'Available' })
                  setShowModal(true)
                }}
                className={ui.btnPrimary}
              >
                <Plus className="size-4" />
                Add New Book
              </button>
            </div>
          </div>

          {/* Desktop: Always show filters inline */}
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <div className="flex items-center gap-0.5 rounded-xl border border-edge/80 bg-surface/50 p-0.5">
              <button onClick={() => setFilterStatus('all')} className={segBtn(filterStatus === 'all')}>
                All <span className="tabular-nums opacity-80">({books.length})</span>
              </button>
              <button onClick={() => setFilterStatus('Available')} className={segBtn(filterStatus === 'Available')}>
                Available <span className="tabular-nums opacity-80">({books.filter(b => b.status === 'Available').length})</span>
              </button>
              <button onClick={() => setFilterStatus('Allocated')} className={segBtn(filterStatus === 'Allocated')}>
                Allocated <span className="tabular-nums opacity-80">({books.filter(b => b.status === 'Allocated').length})</span>
              </button>
            </div>
            <Select
              label="Department"
              value={filterDepartment}
              onChange={setFilterDepartment}
              options={[['all', 'All Departments'], ...deptOptions]}
              searchPlaceholder="Search departments…"
              className="min-w-[13rem]"
            />
          </div>

          {/* Mobile: Collapsible Filters */}
          {showFilters && (
            <div className="fade-in flex flex-col gap-2 border-t border-glass-line pt-2.5 md:hidden">
              <div className="grid grid-cols-3 gap-0.5 rounded-xl border border-edge/80 bg-surface/50 p-0.5">
                <button onClick={() => setFilterStatus('all')} className={cn(segBtn(filterStatus === 'all'), 'justify-center px-1.5 text-[11.5px]')}>
                  All ({books.length})
                </button>
                <button onClick={() => setFilterStatus('Available')} className={cn(segBtn(filterStatus === 'Available'), 'justify-center px-1.5 text-[11.5px]')}>
                  Avail ({books.filter(b => b.status === 'Available').length})
                </button>
                <button onClick={() => setFilterStatus('Allocated')} className={cn(segBtn(filterStatus === 'Allocated'), 'justify-center px-1.5 text-[11.5px]')}>
                  Alloc ({books.filter(b => b.status === 'Allocated').length})
                </button>
              </div>
              <Select
                variant="field"
                label="Department"
                value={filterDepartment}
                onChange={setFilterDepartment}
                options={[['all', 'All Departments'], ...deptOptions]}
                searchPlaceholder="Search departments…"
              />
            </div>
          )}

          {/* Mobile: Collapsible Actions */}
          {showActions && (
            <div className="fade-in grid grid-cols-2 gap-2 border-t border-glass-line pt-2.5 md:hidden">
              <button
                onClick={() => {
                  setShowBulkImportModal(true)
                  setShowActions(false)
                }}
                className={ui.btnSecondary}
              >
                <Upload className="size-4" />
                Bulk Import
              </button>
              <button
                onClick={() => {
                  setShowBulkDeleteModal(true)
                  setShowActions(false)
                }}
                className={cn(ui.btnSecondary, 'text-rose-600 hover:bg-rose-500/10 hover:text-rose-700')}
              >
                <Trash2 className="size-4" />
                Bulk Delete
              </button>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Books Table */}
      <GlassCard index={1} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-glass-line px-3.5 py-2">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <BookOpen className="size-4 text-brand-500" />
            Complete Book Collection
          </h3>
          <span className="text-[11.5px] tabular-nums text-ink-muted">{filteredBooks.length} books</span>
        </div>

        {/* Mobile Card View */}
        <div className="scroll-quiet min-h-0 flex-1 space-y-2 overflow-auto p-2.5 md:hidden">
          {filteredBooks.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={searchQuery ? 'No books found' : 'No books yet'}
              hint={searchQuery ? 'Try different search' : 'Tap + to add books'}
            />
          ) : (
            paginatedBooks.map((book) => (
              <div
                key={book.id}
                className="rounded-xl border border-glass-line bg-surface/60 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-md bg-navy-900/5 px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-ink-soft">
                        #{book.sr_no || 'N/A'}
                      </span>
                      <button onClick={() => toggleBookStatus(book)}>
                        <Pill tone={book.status === 'Available' ? 'success' : 'brand'}>
                          {book.status === 'Available' ? 'Avail' : 'Alloc'}
                        </Pill>
                      </button>
                    </div>
                    <h4 className="truncate text-[13px] font-semibold text-ink">{book.name}</h4>
                    <p className="truncate text-[12px] text-ink-soft">{book.author || 'Unknown Author'}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="max-w-[120px] truncate rounded-md bg-navy-900/5 px-1.5 py-0.5 text-[10.5px] text-ink-muted">
                        {book.department}
                      </span>
                      {book.edition && (
                        <span className="text-[10.5px] text-ink-muted">Ed: {book.edition}</span>
                      )}
                    </div>
                    {book.status === 'Allocated' && book.reservations?.[0]?.reserver_name && (
                      <p className="mt-1 text-[11px] font-medium text-ink-soft">
                        To: {book.reservations[0].reserver_name}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => openEditModal(book)}
                    className={cn(ui.iconBtn, 'shrink-0')}
                    title="Edit Book"
                  >
                    <Pencil className="size-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="scroll-quiet hidden min-h-0 flex-1 overflow-auto md:block">
          <table className={ui.table}>
            <thead className={ui.thead}>
              <tr>
                <th className={ui.th}>Sr No</th>
                <th className={ui.th}>Book Title</th>
                <th className={ui.th}>Author</th>
                <th className={ui.th}>Department</th>
                <th className={ui.th}>Edition</th>
                <th className={ui.th}>Status</th>
                <th className={ui.th}>Allocated To</th>
                <th className={cn(ui.th, 'text-right')}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBooks.length === 0 ? (
                <tr>
                  <td colSpan="8">
                    <EmptyState
                      icon={BookOpen}
                      title={searchQuery ? 'No books found matching your search.' : 'No books in the library yet'}
                      hint={searchQuery ? 'Try a different search term' : 'Click "Add New Book" to begin building your collection'}
                    />
                  </td>
                </tr>
              ) : (
                paginatedBooks.map((book) => (
                  <tr key={book.id} className={ui.tr}>
                    <td className={cn(ui.td, 'py-2 font-semibold tabular-nums text-ink')}>
                      {book.sr_no || 'N/A'}
                    </td>
                    <td className={cn(ui.td, 'py-2 font-semibold text-ink')}>
                      {book.name}
                    </td>
                    <td className={cn(ui.td, 'py-2')}>
                      {book.author}
                    </td>
                    <td className={cn(ui.td, 'py-2')}>
                      {book.department}
                    </td>
                    <td className={cn(ui.td, 'py-2 text-ink-muted')}>
                      {book.edition || 'N/A'}
                    </td>
                    <td className={cn(ui.td, 'py-2')}>
                      <button
                        onClick={() => toggleBookStatus(book)}
                        className="rounded-full transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                        title={`Click to change to ${book.status === 'Available' ? 'Allocated' : 'Available'}`}
                      >
                        <Pill tone={book.status === 'Available' ? 'success' : 'brand'}>{book.status}</Pill>
                      </button>
                    </td>
                    <td className={cn(ui.td, 'py-2')}>
                      {book.status === 'Allocated' && book.reservations?.[0]?.reserver_name
                        ? book.reservations[0].reserver_name
                        : <span className="text-ink-muted">-</span>}
                    </td>
                    <td className={cn(ui.td, 'py-1.5 text-right')}>
                      <button
                        onClick={() => openEditModal(book)}
                        className={cn(ui.iconBtn, 'ml-auto')}
                        title="Edit Book"
                      >
                        <Pencil className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredBooks.length > 0 && (
          <div className="border-t border-glass-line px-3 py-2">
            {/* Mobile Pagination */}
            <div className="flex flex-col gap-2 md:hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] font-medium text-ink-muted">Show:</label>
                  <Select
                    variant="compact"
                    label="Books per page"
                    value={itemsPerPage}
                    onChange={(v) => setItemsPerPage(Number(v))}
                    options={PER_PAGE_OPTIONS}
                  />
                </div>
                <p className="text-[11px] text-ink-muted">
                  <span className="font-semibold text-ink">{startIndex + 1}-{Math.min(endIndex, filteredBooks.length)}</span> of{' '}
                  <span className="font-semibold text-ink">{filteredBooks.length}</span>
                </p>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={pagerBtn}
                  >
                    Prev
                  </button>
                  <span className="text-[12px] font-semibold tabular-nums text-ink-soft">
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={pagerBtn}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Desktop Pagination */}
            <div className="hidden items-center justify-between md:flex">
              <div className="flex items-center gap-2">
                <label className="text-[12px] font-medium text-ink-muted">Show:</label>
                <Select
                  variant="compact"
                  label="Books per page"
                  value={itemsPerPage}
                  onChange={(v) => setItemsPerPage(Number(v))}
                  options={PER_PAGE_OPTIONS}
                />
                <span className="text-[12px] text-ink-muted">per page</span>
              </div>

              <div className="flex items-center gap-3">
                <p className="text-[12px] text-ink-muted">
                  Showing <span className="font-semibold text-ink">{startIndex + 1}</span> to{' '}
                  <span className="font-semibold text-ink">{Math.min(endIndex, filteredBooks.length)}</span> of{' '}
                  <span className="font-semibold text-ink">{filteredBooks.length}</span> books
                </p>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className={pagerBtn}
                    >
                      Prev
                    </button>
                    <span className="px-2 text-[12px] font-semibold tabular-nums text-ink-soft">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className={pagerBtn}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal
          onClose={() => {
            setShowModal(false)
            setEditingBook(null)
            setFormData({ name: '', author: '', department: '', edition: '', sr_no: '', status: 'Available' })
          }}
          title={editingBook ? 'Edit Book Details' : 'Add New Book'}
          icon={BookOpen}
          size="md"
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false)
                  setEditingBook(null)
                  setFormData({ name: '', author: '', department: '', edition: '', sr_no: '', status: 'Available' })
                }}
                className={ui.btnSecondary}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="book-form"
                className={ui.btnPrimary}
              >
                {editingBook ? 'Update Book' : 'Add Book'}
              </button>
            </>
          }
        >
          <form id="book-form" onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className={ui.label}>
                Book Title *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={ui.input}
                placeholder="Enter book title"
              />
            </div>

            <div>
              <label className={ui.label}>
                Author Name
              </label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                className={ui.input}
                placeholder="Enter author name (optional)"
              />
            </div>

            <div>
              <label className={ui.label}>
                Department *
              </label>
              <Select
                variant="field"
                required
                label="Department"
                placeholder="Select a department"
                value={formData.department}
                onChange={(v) => setFormData({ ...formData, department: v })}
                options={deptOptions}
                searchPlaceholder="Search departments…"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={ui.label}>
                  Edition
                </label>
                <input
                  type="text"
                  value={formData.edition}
                  onChange={(e) => setFormData({ ...formData, edition: e.target.value })}
                  className={ui.input}
                  placeholder="e.g., 1st Edition, 2nd Edition"
                />
              </div>

              <div>
                <label className={ui.label}>
                  Serial Number
                </label>
                <input
                  type="text"
                  value={formData.sr_no}
                  onChange={(e) => setFormData({ ...formData, sr_no: e.target.value })}
                  className={ui.input}
                  placeholder="Enter serial number"
                />
              </div>
            </div>

            <div>
              <label className={ui.label}>
                Availability Status *
              </label>
              <Select
                variant="field"
                required
                label="Availability status"
                value={formData.status}
                onChange={(v) => setFormData({ ...formData, status: v })}
                options={[['Available', 'Available'], ['Allocated', 'Allocated']]}
              />
            </div>

            {editingBook && (
              <div className="border-t border-glass-line pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    openDeleteModal(editingBook)
                  }}
                  className={cn(ui.btnSecondary, 'w-full text-rose-600 hover:bg-rose-500/10 hover:text-rose-700')}
                >
                  <Trash2 className="size-4" />
                  Delete This Book
                </button>
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && bookToDelete && (
        <Modal
          onClose={() => {
            setShowDeleteModal(false)
            setBookToDelete(null)
          }}
          title="Confirm Deletion"
          subtitle="Are you sure you want to remove this book from the library?"
          icon={AlertTriangle}
          size="sm"
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false)
                  setBookToDelete(null)
                }}
                className={ui.btnSecondary}
              >
                Keep Book
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className={ui.btnDanger}
              >
                Delete Permanently
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-[14px] font-semibold text-heading">
              "{bookToDelete.name}"
            </p>

            {/* Book Details Card */}
            <dl className="divide-y divide-glass-line rounded-xl border border-glass-line bg-surface/60 text-[12.5px]">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-ink-muted">Author:</dt>
                <dd className="font-medium text-ink">{bookToDelete.author}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-ink-muted">Department:</dt>
                <dd className="font-medium text-ink">{bookToDelete.department}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-ink-muted">Edition:</dt>
                <dd className="font-medium text-ink">{bookToDelete.edition || 'N/A'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-ink-muted">Status:</dt>
                <dd>
                  <Pill tone={bookToDelete.status === 'Available' ? 'success' : 'brand'}>{bookToDelete.status}</Pill>
                </dd>
              </div>
            </dl>

            <p className="flex items-start gap-1.5 rounded-xl bg-rose-500/8 px-3 py-2 text-[12px] text-rose-700">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              This action cannot be undone. The book will be permanently removed from the database.
            </p>
          </div>
        </Modal>
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <Modal
          onClose={() => {
            setShowBulkImportModal(false)
            setImportFile(null)
            setImportPreview([])
            setImportErrors([])
          }}
          title="Bulk Import Books"
          icon={FileSpreadsheet}
          size="md"
          footer={
            <>
              <button
                type="button"
                onClick={resetBulkImport}
                className={ui.btnSecondary}
                disabled={importing}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkImport}
                disabled={importing || importPreview.length === 0}
                className={ui.btnPrimary}
              >
                {importing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
                    Importing...
                  </span>
                ) : (
                  `Import ${importPreview.length} Books`
                )}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            {/* File Upload Section */}
            <div>
              <label className={ui.label}>
                Upload File (CSV or XLSX)
              </label>
              <div className="rounded-xl border border-dashed border-edge bg-surface/50 p-4 text-center transition-colors hover:border-brand-400 hover:bg-brand-500/5">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="bulk-import-file"
                />
                <label htmlFor="bulk-import-file" className="block cursor-pointer">
                  <span className="mx-auto mb-2 grid size-9 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
                    <Upload className="size-4" />
                  </span>
                  <p className="text-[13px] font-medium text-ink">
                    {importFile ? importFile.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-ink-muted">
                    CSV, XLS, or XLSX files only
                  </p>
                </label>
              </div>
            </div>

            {/* Expected Format */}
            <div className="rounded-xl border border-glass-line bg-surface/50 p-3">
              <h4 className="mb-1.5 text-[12px] font-semibold text-ink">Expected Columns:</h4>
              <ul className="space-y-1 text-[11.5px] text-ink-soft">
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-brand-500"></span>
                  <strong className="text-ink">name</strong> - Book title (required)
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-slate-400"></span>
                  <strong className="text-ink">author</strong> - Author name (optional)
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-brand-500"></span>
                  <strong className="text-ink">department</strong> - Department (required)
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-slate-400"></span>
                  <strong className="text-ink">edition</strong> - Edition (optional)
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-slate-400"></span>
                  <strong className="text-ink">sr_no</strong> - Serial Number (optional)
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-slate-400"></span>
                  <strong className="text-ink">status</strong> - Available/Allocated (optional, defaults to Available)
                </li>
              </ul>
            </div>

            {/* Preview Section */}
            {importPreview.length > 0 && (
              <div>
                <h4 className="mb-1.5 text-[12px] font-semibold text-ink">
                  Preview ({importPreview.length} books)
                </h4>
                <div className="scroll-quiet max-h-48 overflow-y-auto rounded-xl border border-glass-line bg-surface/50">
                  <table className="w-full text-[12px]">
                    <thead className={ui.thead}>
                      <tr>
                        <th className={cn(ui.th, 'px-2.5 py-1.5')}>Name</th>
                        <th className={cn(ui.th, 'px-2.5 py-1.5')}>Author</th>
                        <th className={cn(ui.th, 'px-2.5 py-1.5')}>Dept</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 10).map((book, index) => (
                        <tr key={index} className="border-b border-glass-line last:border-0">
                          <td className="max-w-[100px] truncate px-2.5 py-1.5 text-ink">{book.name || '-'}</td>
                          <td className="max-w-[80px] truncate px-2.5 py-1.5 text-ink-soft">{book.author || '-'}</td>
                          <td className="max-w-[60px] truncate px-2.5 py-1.5 text-ink-soft">{book.department || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importPreview.length > 10 && (
                    <p className="py-1.5 text-center text-[11.5px] text-ink-muted">
                      ...and {importPreview.length - 10} more books
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Errors Section */}
            {importErrors.length > 0 && (
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/8 p-3">
                <h4 className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-rose-700">
                  <XCircle className="size-4" />
                  Validation Errors
                </h4>
                <div className="scroll-quiet max-h-32 overflow-y-auto">
                  {importErrors.map((error, index) => (
                    <div key={index} className="mb-1 text-[11.5px] text-rose-600">
                      <strong>Row {error.row}:</strong> {error.errors.join(', ')}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <Modal
          onClose={() => {
            setShowBulkDeleteModal(false)
            setBulkDeleteDepartment('')
            setBulkDeleteCount(0)
          }}
          title="Bulk Delete Books by Department"
          icon={AlertTriangle}
          size="sm"
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  setShowBulkDeleteModal(false)
                  setBulkDeleteDepartment('')
                  setBulkDeleteCount(0)
                }}
                className={ui.btnSecondary}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!bulkDeleteDepartment) {
                    toast.error('Please select a department')
                    return
                  }

                  if (bulkDeleteCount === 0) {
                    toast.error('No books to delete for the selected department')
                    return
                  }

                  try {
                    setDeletingBulk(true)
                    const { error } = await supabase
                      .from('books')
                      .delete()
                      .eq('department', bulkDeleteDepartment)

                    if (error) throw error

                    toast.success(`Deleted ${bulkDeleteCount} book(s) from ${bulkDeleteDepartment}`)
                    setShowBulkDeleteModal(false)
                    setBulkDeleteDepartment('')
                    setBulkDeleteCount(0)
                    fetchBooks()
                  } catch (err) {
                    console.error('Error deleting books in bulk:', err)
                    toast.error('Failed to delete books')
                  } finally {
                    setDeletingBulk(false)
                  }
                }}
                className={ui.btnDanger}
                disabled={deletingBulk}
              >
                {deletingBulk ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className={ui.label}>
                Select Department to Delete
              </label>
              <Select
                variant="field"
                label="Department to delete"
                placeholder="Select a department"
                value={bulkDeleteDepartment}
                options={deptOptions}
                searchPlaceholder="Search departments…"
                onChange={async (dept) => {
                  setBulkDeleteDepartment(dept)
                  // Fetch count
                  if (dept) {
                    try {
                      const { count, error } = await supabase
                        .from('books')
                        .select('id', { count: 'exact', head: true })
                        .eq('department', dept)

                      if (error) throw error
                      setBulkDeleteCount(count || 0)
                    } catch (err) {
                      console.error('Error fetching department count:', err)
                      toast.error('Failed to fetch books count for selected department')
                      setBulkDeleteCount(0)
                    }
                  } else {
                    setBulkDeleteCount(0)
                  }
                }}
              />
            </div>

            <div className="rounded-xl border border-glass-line bg-surface/50 px-3 py-2.5">
              <p className="text-[12.5px] text-ink-soft">
                {bulkDeleteDepartment
                  ? `This will permanently delete ${bulkDeleteCount} book(s) in the "${bulkDeleteDepartment}" department.`
                  : 'Select a department to see how many books will be deleted.'}
              </p>
            </div>

            <p className="flex items-start gap-1.5 rounded-xl bg-rose-500/8 px-3 py-2 text-[12px] text-rose-700">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              This action cannot be undone. Only proceed if you are certain.
            </p>
          </div>
        </Modal>
      )}

      {/* Allocation Modal */}
      {showAllocationModal && bookToAllocate && (
        <Modal
          onClose={() => {
            setShowAllocationModal(false)
            setBookToAllocate(null)
            setReserverInfo({ reserver_name: '', reserver_id: '', reserver_role: 'student' })
          }}
          title="Allocate Book"
          icon={BookOpen}
          size="md"
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  setShowAllocationModal(false)
                  setBookToAllocate(null)
                  setReserverInfo({ reserver_name: '', reserver_id: '', reserver_role: 'student' })
                }}
                className={ui.btnSecondary}
                disabled={allocating}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="allocate-form"
                disabled={allocating}
                className={ui.btnPrimary}
              >
                {allocating ? 'Allocating...' : 'Allocate Book'}
              </button>
            </>
          }
        >
          {/* Book Info */}
          <div className="mb-3 rounded-xl border border-glass-line bg-surface/50 p-3">
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Book Details</h3>
            <div className="space-y-1 text-[12.5px]">
              <div className="flex justify-between gap-3">
                <span className="shrink-0 text-ink-muted">Title:</span>
                <span className="text-right font-medium text-ink">{bookToAllocate.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="shrink-0 text-ink-muted">Author:</span>
                <span className="text-right font-medium text-ink">{bookToAllocate.author || 'N/A'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="shrink-0 text-ink-muted">Sr No:</span>
                <span className="text-right font-medium tabular-nums text-ink">{bookToAllocate.sr_no || 'N/A'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="shrink-0 text-ink-muted">Book ID:</span>
                <span className="text-right font-medium tabular-nums text-ink">{bookToAllocate.book_id}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="shrink-0 text-ink-muted">Department:</span>
                <span className="text-right font-medium text-ink">{bookToAllocate.department || 'N/A'}</span>
              </div>
            </div>
          </div>

          <form id="allocate-form" onSubmit={handleAllocateBook} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={ui.label}>
                  Reserver Name *
                </label>
                <input
                  type="text"
                  required
                  value={reserverInfo.reserver_name}
                  onChange={(e) => setReserverInfo({ ...reserverInfo, reserver_name: e.target.value })}
                  className={ui.input}
                  placeholder="Enter reserver's full name"
                />
              </div>

              <div>
                <label className={ui.label}>
                  Reserver ID *
                </label>
                <input
                  type="text"
                  required
                  value={reserverInfo.reserver_id}
                  onChange={(e) => setReserverInfo({ ...reserverInfo, reserver_id: e.target.value })}
                  className={ui.input}
                  placeholder="Enter student/teacher ID"
                />
              </div>
            </div>

            <div>
              <label className={ui.label}>
                Role *
              </label>
              <Select
                variant="field"
                required
                label="Role"
                value={reserverInfo.reserver_role}
                onChange={(v) => setReserverInfo({ ...reserverInfo, reserver_role: v })}
                options={[['student', 'Student'], ['teacher', 'Teacher']]}
              />
            </div>

            {/* Issue date / due date */}
            <div className="rounded-xl border border-brand-500/25 bg-brand-500/5 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-700">
                Loan Period
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={ui.label}>Issue Date *</label>
                  <input
                    type="date"
                    required
                    value={allocationDates.issue_date}
                    onChange={(e) => setAllocationDates({ ...allocationDates, issue_date: e.target.value })}
                    className={ui.input}
                  />
                </div>
                <div>
                  <label className={ui.label}>Due Date *</label>
                  <input
                    type="date"
                    required
                    min={allocationDates.issue_date || undefined}
                    value={allocationDates.due_date}
                    onChange={(e) => setAllocationDates({ ...allocationDates, due_date: e.target.value })}
                    className={ui.input}
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-ink-muted">
                Pick when the book is due back. Every day past it is fined{' '}
                <span className="font-semibold text-ink">{formatMoney(librarySettings.fine_per_day, librarySettings)}</span>.
              </p>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
