

'use client'
import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import Loader from '@/components/Loader'
import { supabase } from '@/lib/supabase'
import { Plus, Pencil, Trash2, BookOpen, Search, X, AlertTriangle, Upload, FileSpreadsheet } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import * as XLSX from 'xlsx'

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
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

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
  }, [])

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
            ),
            reservations!reservations_book_sr_no_fkey (
              reserver_name,
              status
            )
          `)
          .order('created_at', { ascending: false })
          .range(i * batchSize, (i + 1) * batchSize - 1)

        if (error) throw error
        allBooks = [...allBooks, ...(data || [])]
      }

      // Filter to show only confirmed reservations for each book
      const booksWithConfirmedReservations = allBooks.map(book => ({
        ...book,
        reservations: book.reservations?.filter(r => r.status === 'confirmed') || []
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
        author: formData.author,
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
    try {
      const newStatus = book.status === 'Available' ? 'Allocated' : 'Available'

      const { error } = await supabase
        .from('books')
        .update({ status: newStatus })
        .eq('id', book.id)

      if (error) throw error

      toast.success(`Book status changed to ${newStatus}`)
      fetchBooks()
    } catch (error) {
      console.error('Error updating book status:', error)
      toast.error('Failed to update book status')
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
        })

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
      if (!book.author) {
        rowErrors.push('Author is required')
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
          author: book.author,
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
    .filter(book => filterDepartment === 'all' || book.department === filterDepartment)
    .filter(book => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        (book.name || '').toLowerCase().includes(query) ||
        (book.author || '').toLowerCase().includes(query) ||
        (book.department || '').toLowerCase().includes(query) ||
        (book.status || '').toLowerCase().includes(query)
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

  if (loading) return <Loader />

  return (
    <div className="h-screen overflow-hidden bg-white flex flex-col">
      <Toaster position="top-right" />
      <Header title="Books Management" />

      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2">
        {/* University Books Header - Compact */}


        {/* Search and Actions Bar */}
        <div className="bg-white rounded-xl p-2 sm:p-3 border-2 border-[#fe9800] shadow-lg">
          <div className="flex flex-col gap-2">
            {/* Search Bar */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-[#fe9800]" />
              <input
                type="text"
                placeholder="Search books..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-9 sm:pr-10 py-2 sm:py-2.5 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none transition-all font-medium text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#fe9800] hover:text-[#002147]"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}
            </div>

            {/* Filter Buttons and Add Book Button */}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
              {/* Filter Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold transition-all shadow-md text-xs sm:text-sm border-2 ${
                    filterStatus === 'all'
                      ? 'bg-[#fe9800] text-white shadow-lg scale-105 border-[#002147]'
                      : 'bg-white text-[#002147] border-[#002147] hover:bg-gray-50'
                  }`}
                >
                  All ({books.length})
                </button>
                <button
                  onClick={() => setFilterStatus('Available')}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold transition-all shadow-md text-xs sm:text-sm border-2 ${
                    filterStatus === 'Available'
                      ? 'bg-[#fe9800] text-white shadow-lg scale-105 border-[#002147]'
                      : 'bg-white text-[#002147] border-[#002147] hover:bg-gray-50'
                  }`}
                >
                  Available ({books.filter(b => b.status === 'Available').length})
                </button>
                <button
                  onClick={() => setFilterStatus('Allocated')}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold transition-all shadow-md text-xs sm:text-sm border-2 ${
                    filterStatus === 'Allocated'
                      ? 'bg-[#002147] text-white shadow-lg scale-105 border-[#fe9800]'
                      : 'bg-white text-[#002147] border-[#002147] hover:bg-gray-50'
                  }`}
                >
                  Allocated ({books.filter(b => b.status === 'Allocated').length})
                </button>

                {/* Department Filter */}
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold transition-all shadow-md text-xs sm:text-sm border-2 border-[#002147] bg-white text-[#002147] hover:bg-gray-50 focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none"
                >
                  <option value="all">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.department_name}>
                      {dept.department_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Add Book and Bulk Import Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBulkImportModal(true)}
                  className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-[#002147] text-white rounded-lg hover:shadow-xl hover:scale-105 transition-all font-bold whitespace-nowrap text-xs sm:text-sm border-2 border-[#fe9800]"
                >
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                  Bulk Import
                </button>
                <button
                  onClick={() => {
                    setEditingBook(null)
                    setFormData({ name: '', author: '', department: '', edition: '', status: 'Available' })
                    setShowModal(true)
                  }}
                  className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-[#fe9800] text-white rounded-lg hover:shadow-xl hover:scale-105 transition-all font-bold whitespace-nowrap text-xs sm:text-sm border-2 border-[#002147]"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  Add New Book
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Books Table - Increased Viewport */}
        <div className="bg-white rounded-xl border-2 border-[#fe9800] overflow-hidden shadow-xl flex-1 flex flex-col">
          <div className="bg-[#002147] px-3 sm:px-4 py-1.5 sm:py-2 border-b-2 border-[#fe9800]">
            <h3 className="text-sm sm:text-base font-bold text-white font-serif flex items-center gap-1.5 sm:gap-2">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
              Complete Book Collection
            </h3>
          </div>
          <div className="overflow-x-auto overflow-y-auto flex-1 scrollbar-hide">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-[#fe9800] sticky top-0">
                <tr>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-bold text-[#002147] uppercase tracking-tight">
                    Sr No
                  </th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-bold text-[#002147] uppercase tracking-tight">
                    Book Title
                  </th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-bold text-[#002147] uppercase tracking-tight">
                    Author
                  </th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-bold text-[#002147] uppercase tracking-tight">
                    Department
                  </th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-bold text-[#002147] uppercase tracking-tight">
                    Edition
                  </th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-bold text-[#002147] uppercase tracking-tight">
                    Status
                  </th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-bold text-[#002147] uppercase tracking-tight">
                    Allocated To
                  </th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-bold text-[#002147] uppercase tracking-tight">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBooks.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center bg-white">
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-20 bg-[#fe9800] rounded shadow-lg flex items-center justify-center mb-3 border-2 border-[#002147]">
                          <BookOpen className="w-8 h-8 text-white" />
                        </div>
                        <p className="text-[#002147] text-base font-serif font-medium">
                          {searchQuery ? 'No books found matching your search.' : 'No books in the library yet'}
                        </p>
                        <p className="text-gray-600 text-xs mt-2">
                          {searchQuery ? 'Try a different search term' : 'Click "Add New Book" to begin building your collection'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedBooks.map((book, index) => (
                    <tr key={book.id} className={`hover:bg-gray-50 transition-all ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-700 font-bold text-[10px] sm:text-xs">
                        {book.sr_no || 'N/A'}
                      </td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-700 font-bold text-[#002147] text-[10px] sm:text-xs">
                        {book.name}
                      </td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-700 font-medium text-[10px] sm:text-xs">
                        {book.author}
                      </td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-700 font-medium text-[10px] sm:text-xs">
                        {book.department}
                      </td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-700 font-medium text-[10px] sm:text-xs">
                        {book.edition || 'N/A'}
                      </td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                        <button
                          onClick={() => toggleBookStatus(book)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] sm:text-xs font-bold transition-all hover:shadow-md hover:scale-105 border cursor-pointer ${
                            book.status === 'Available'
                              ? 'bg-[#fe9800] text-white border-[#002147]'
                              : 'bg-[#002147] text-white border-[#fe9800]'
                          }`}
                          title={`Click to change to ${book.status === 'Available' ? 'Allocated' : 'Available'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            book.status === 'Available' ? 'bg-white' : 'bg-[#fe9800]'
                          }`}></span>
                          <span>{book.status}</span>
                        </button>
                      </td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-700 font-medium text-[10px] sm:text-xs">
                        {book.status === 'Allocated' && book.reservations?.[0]?.reserver_name
                          ? book.reservations[0].reserver_name
                          : '-'}
                      </td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-right">
                        <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                          <button
                            onClick={() => openEditModal(book)}
                            className="p-1 sm:p-1.5 text-white bg-[#fe9800] hover:bg-[#002147] rounded transition-all font-medium border border-[#002147]"
                            title="Edit Book"
                          >
                            <Pencil className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(book)}
                            className="p-1 sm:p-1.5 text-white bg-[#002147] hover:bg-[#fe9800] rounded transition-all font-medium border border-[#fe9800]"
                            title="Delete Book"
                          >
                            <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredBooks.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t-2 border-[#002147] flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Items per page selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-[#002147]">Show:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-2 py-1 border-2 border-gray-300 rounded text-xs font-medium text-[#002147] focus:outline-none focus:border-[#fe9800]"
                >
                  <option value={10}>10</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-xs text-gray-600">per page</span>
              </div>

              {/* Page info and navigation */}
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-600">
                  Showing <span className="font-semibold text-[#002147]">{startIndex + 1}</span> to{' '}
                  <span className="font-semibold text-[#002147]">{Math.min(endIndex, filteredBooks.length)}</span> of{' '}
                  <span className="font-semibold text-[#002147]">{filteredBooks.length}</span> books
                </p>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 border-2 border-[#002147] rounded text-xs font-bold text-[#002147] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#fe9800] hover:text-white transition-colors"
                    >
                      Prev
                    </button>
                    <span className="text-xs font-semibold text-[#002147] px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 border-2 border-[#002147] rounded text-xs font-bold text-[#002147] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#fe9800] hover:text-white transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal - Right Sidebar */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end"
          onClick={() => {
            setShowModal(false)
            setEditingBook(null)
            setFormData({ name: '', author: '', department: '', edition: '', sr_no: '', status: 'Available' })
          }}
        >
          <div
            className="bg-white h-full w-full max-w-md shadow-2xl border-l-2 border-[#fe9800] overflow-y-auto animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#002147] px-5 py-4 sticky top-0 z-10 border-b-2 border-[#fe9800]">
              <h2 className="text-xl font-bold text-white font-serif flex items-center gap-2">
                <BookOpen className="w-6 h-6" />
                {editingBook ? 'Edit Book Details' : 'Add New Book'}
              </h2>
            </div>
            <div className="p-6">

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-[#002147] mb-2 uppercase tracking-wide">
                  Book Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none transition-all font-medium"
                  placeholder="Enter book title"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#002147] mb-2 uppercase tracking-wide">
                  Author Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  className="w-full px-3 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none transition-all font-medium"
                  placeholder="Enter author name"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#002147] mb-2 uppercase tracking-wide">
                  Department *
                </label>
                <select
                  required
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none transition-all font-medium"
                >
                  <option value="">Select a department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.department_name}>
                      {dept.department_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#002147] mb-2 uppercase tracking-wide">
                  Edition
                </label>
                <input
                  type="text"
                  value={formData.edition}
                  onChange={(e) => setFormData({ ...formData, edition: e.target.value })}
                  className="w-full px-3 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none transition-all font-medium"
                  placeholder="e.g., 1st Edition, 2nd Edition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#002147] mb-2 uppercase tracking-wide">
                  Serial Number
                </label>
                <input
                  type="text"
                  value={formData.sr_no}
                  onChange={(e) => setFormData({ ...formData, sr_no: e.target.value })}
                  className="w-full px-3 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none transition-all font-medium"
                  placeholder="Enter serial number"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#002147] mb-2 uppercase tracking-wide">
                  Availability Status *
                </label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-[#fe9800] focus:border-[#fe9800] outline-none transition-all font-medium"
                >
                  <option value="Available">Available</option>
                  <option value="Allocated">Allocated</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t-2 border-[#002147]">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingBook(null)
                    setFormData({ name: '', author: '', department: '', edition: '', status: 'Available' })
                  }}
                  className="flex-1 px-4 py-3 border-2 border-[#002147] text-[#002147] rounded-lg hover:bg-gray-100 transition-all font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-[#fe9800] text-white rounded-lg hover:shadow-xl hover:scale-105 transition-all font-bold border-2 border-[#002147]"
                >
                  {editingBook ? 'Update Book' : 'Add Book'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal - Right Sidebar */}
      {showDeleteModal && bookToDelete && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end"
          onClick={() => {
            setShowDeleteModal(false)
            setBookToDelete(null)
          }}
        >
          <div
            className="bg-white h-full w-full max-w-md shadow-2xl border-l-2 border-[#fe9800] overflow-y-auto animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#002147] px-5 py-4 sticky top-0 z-10 border-b-2 border-[#fe9800]">
              <h2 className="text-xl font-bold text-white font-serif flex items-center gap-2">
                <AlertTriangle className="w-6 h-6" />
                Confirm Deletion
              </h2>
            </div>

            <div className="p-6">
              <div className="flex flex-col items-center text-center">
                {/* Warning Icon */}
                <div className="w-16 h-20 bg-[#fe9800] rounded-lg shadow-lg flex items-center justify-center mb-4 border-2 border-[#002147]">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>

                {/* Description */}
                <p className="text-gray-700 mb-3 text-base font-medium">
                  Are you sure you want to remove this book from the library?
                </p>
                <p className="text-[#fe9800] font-bold text-lg mb-6 font-serif">
                  "{bookToDelete.name}"
                </p>

                {/* Book Details Card */}
                <div className="w-full bg-gray-50 rounded-lg p-4 mb-6 border-2 border-[#002147]">
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between items-center p-2.5 bg-white rounded border border-[#002147]">
                      <span className="text-[#002147] font-bold">Author:</span>
                      <span className="font-medium text-gray-900">{bookToDelete.author}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 bg-white rounded border border-[#002147]">
                      <span className="text-[#002147] font-bold">Department:</span>
                      <span className="font-medium text-gray-900">{bookToDelete.department}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 bg-white rounded border border-[#002147]">
                      <span className="text-[#002147] font-bold">Edition:</span>
                      <span className="font-medium text-gray-900">{bookToDelete.edition || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 bg-white rounded border border-[#002147]">
                      <span className="text-[#002147] font-bold">Status:</span>
                      <span className={`font-bold ${
                        bookToDelete.status === 'Available'
                          ? 'text-[#fe9800]'
                          : 'text-[#002147]'
                      }`}>
                        {bookToDelete.status}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-500 italic mb-6">
                  This action cannot be undone. The book will be permanently removed from the database.
                </p>

                {/* Action Buttons */}
                <div className="flex gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteModal(false)
                      setBookToDelete(null)
                    }}
                    className="flex-1 px-4 py-3 border-2 border-[#002147] text-[#002147] rounded-lg hover:bg-gray-100 transition-all font-bold"
                  >
                    Keep Book
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-3 bg-[#002147] text-white rounded-lg hover:shadow-xl hover:scale-105 transition-all font-bold border-2 border-[#fe9800]"
                  >
                    Delete Permanently
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal - Right Sidebar */}
      {showBulkImportModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end"
          onClick={() => {
            setShowBulkImportModal(false)
            setImportFile(null)
            setImportPreview([])
            setImportErrors([])
          }}
        >
          <div
            className="bg-white h-full w-full max-w-md shadow-2xl border-l-2 border-[#fe9800] overflow-y-auto animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#002147] px-5 py-4 sticky top-0 z-10 border-b-2 border-[#fe9800]">
              <h2 className="text-xl font-bold text-white font-serif flex items-center gap-2">
                <FileSpreadsheet className="w-6 h-6" />
                Bulk Import Books
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-5">
                {/* File Upload Section */}
                <div>
                  <label className="block text-xs font-bold text-[#002147] mb-2 uppercase tracking-wide">
                    Upload File (CSV or XLSX)
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#fe9800] transition-colors">
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileChange}
                      className="hidden"
                      id="bulk-import-file"
                    />
                    <label htmlFor="bulk-import-file" className="cursor-pointer">
                      <Upload className="w-10 h-10 mx-auto text-[#fe9800] mb-3" />
                      <p className="text-sm font-medium text-gray-700">
                        {importFile ? importFile.name : 'Click to upload or drag and drop'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        CSV, XLS, or XLSX files only
                      </p>
                    </label>
                  </div>
                </div>

                {/* Expected Format */}
                <div className="bg-gray-50 rounded-lg p-4 border-2 border-[#002147]">
                  <h4 className="text-sm font-bold text-[#002147] mb-2">Expected Columns:</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-[#fe9800] rounded-full"></span>
                      <strong>name</strong> - Book title (required)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-[#fe9800] rounded-full"></span>
                      <strong>author</strong> - Author name (required)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-[#fe9800] rounded-full"></span>
                      <strong>department</strong> - Department (required)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                      <strong>edition</strong> - Edition (optional)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                      <strong>sr_no</strong> - Serial Number (optional)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                      <strong>status</strong> - Available/Allocated (optional, defaults to Available)
                    </li>
                  </ul>
                </div>

                {/* Preview Section */}
                {importPreview.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-[#002147] mb-2">
                      Preview ({importPreview.length} books)
                    </h4>
                    <div className="max-h-48 overflow-y-auto border-2 border-gray-200 rounded-lg">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-2 py-1 text-left font-bold text-[#002147]">Name</th>
                            <th className="px-2 py-1 text-left font-bold text-[#002147]">Author</th>
                            <th className="px-2 py-1 text-left font-bold text-[#002147]">Dept</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {importPreview.slice(0, 10).map((book, index) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-2 py-1 truncate max-w-[100px]">{book.name || '-'}</td>
                              <td className="px-2 py-1 truncate max-w-[80px]">{book.author || '-'}</td>
                              <td className="px-2 py-1 truncate max-w-[60px]">{book.department || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {importPreview.length > 10 && (
                        <p className="text-xs text-center text-gray-500 py-2">
                          ...and {importPreview.length - 10} more books
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Errors Section */}
                {importErrors.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-4 border-2 border-red-300">
                    <h4 className="text-sm font-bold text-red-700 mb-2 flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      Validation Errors
                    </h4>
                    <div className="max-h-32 overflow-y-auto">
                      {importErrors.map((error, index) => (
                        <div key={index} className="text-xs text-red-600 mb-1">
                          <strong>Row {error.row}:</strong> {error.errors.join(', ')}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t-2 border-[#002147]">
                  <button
                    type="button"
                    onClick={resetBulkImport}
                    className="flex-1 px-4 py-3 border-2 border-[#002147] text-[#002147] rounded-lg hover:bg-gray-100 transition-all font-bold"
                    disabled={importing}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkImport}
                    disabled={importing || importPreview.length === 0}
                    className="flex-1 px-4 py-3 bg-[#fe9800] text-white rounded-lg hover:shadow-xl hover:scale-105 transition-all font-bold border-2 border-[#002147] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {importing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                        Importing...
                      </span>
                    ) : (
                      `Import ${importPreview.length} Books`
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}