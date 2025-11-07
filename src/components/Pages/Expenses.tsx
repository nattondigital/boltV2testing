import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Eye, Edit, Trash2, DollarSign, TrendingUp, Calendar, Receipt, X, Save, FileText, CreditCard, Banknote, MoreVertical, ChevronRight, ArrowLeft, Upload, Image, CheckCircle, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { KPICard } from '@/components/Common/KPICard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { format } from 'date-fns'

const statusColors: Record<string, string> = {
  'Pending': 'bg-yellow-100 text-yellow-800',
  'Approved': 'bg-green-100 text-green-800',
  'Rejected': 'bg-red-100 text-red-800',
  'Reimbursed': 'bg-blue-100 text-blue-800'
}

const categoryColors: Record<string, string> = {
  'Travel': 'bg-blue-50 text-blue-700',
  'Food': 'bg-orange-50 text-orange-700',
  'Office Supplies': 'bg-purple-50 text-purple-700',
  'Software': 'bg-green-50 text-green-700',
  'Marketing': 'bg-red-50 text-red-700',
  'Training': 'bg-teal-50 text-teal-700',
  'Other': 'bg-gray-50 text-gray-700'
}

const categoryIcons: Record<string, string> = {
  'Travel': '✈️',
  'Food': '🍽️',
  'Office Supplies': '📎',
  'Software': '💻',
  'Marketing': '📢',
  'Training': '🎓',
  'Other': '📦'
}

interface Expense {
  id: string
  expense_id: string
  admin_user_id: string
  category: string
  amount: number
  currency: string
  description: string
  expense_date: string
  payment_method: string
  receipt_url: string | null
  status: string
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export function Expenses() {
  const [view, setView] = useState<'list' | 'add' | 'edit' | 'view'>('list')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    receipt_url: ''
  })
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchExpenses()
  }, [])

  const fetchExpenses = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false })

      if (error) throw error
      setExpenses(data || [])
    } catch (error) {
      console.error('Failed to fetch expenses:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.expense_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.category.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = !categoryFilter || expense.category === categoryFilter
    const matchesStatus = !statusFilter || expense.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)
  const pendingExpenses = expenses.filter(exp => exp.status === 'Pending').length
  const approvedExpenses = expenses.filter(exp => exp.status === 'Approved').length
  const reimbursedAmount = expenses
    .filter(exp => exp.status === 'Reimbursed')
    .reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)

  const handleCreateExpense = async () => {
    try {
      let receiptUrl = formData.receipt_url

      if (receiptFile) {
        try {
          const { data: integration, error: integrationError } = await supabase
            .from('integrations')
            .select('config')
            .eq('integration_type', 'ghl_api')
            .maybeSingle()

          if (integration?.config?.accessToken) {
            const accessToken = integration.config.accessToken
            const locationId = integration.config.locationId || 'iDIRFjdZBWH7SqBzTowc'

            const { data: folderAssignment } = await supabase
              .from('media_folder_assignments')
              .select('media_folder_id, media_folders!inner(ghl_folder_id, folder_name)')
              .eq('trigger_event', 'EXPENSE_ADDED')
              .eq('module', 'Expenses')
              .maybeSingle()

            const ghlFolderId = folderAssignment?.media_folders?.ghl_folder_id

            if (!ghlFolderId) {
              console.log('No GHL folder configured for expense receipts, skipping upload')
            } else {
              let { data: expenseFolder } = await supabase
                .from('media_folders')
                .select('id')
                .eq('ghl_folder_id', ghlFolderId)
                .maybeSingle()

              if (!expenseFolder) {
                const { data: newFolder, error: folderError } = await supabase
                  .from('media_folders')
                  .insert({
                    folder_name: folderAssignment?.media_folders?.folder_name || 'Expense Receipts',
                    ghl_folder_id: ghlFolderId,
                    parent_id: null,
                    location_id: locationId
                  })
                  .select('id')
                  .single()

                if (!folderError && newFolder) {
                  expenseFolder = newFolder
                }
              }

              const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
              const fileName = `expense-${formData.category.replace(/\s+/g, '-')}-${timestamp}.${receiptFile.name.split('.').pop()}`

              const formDataUpload = new FormData()
              formDataUpload.append('file', receiptFile, fileName)
              formDataUpload.append('name', fileName)
              formDataUpload.append('parentId', ghlFolderId)

              const uploadResponse = await fetch('https://services.leadconnectorhq.com/medias/upload-file', {
                method: 'POST',
                headers: {
                  'Accept': 'application/json',
                  'Version': '2021-07-28',
                  'Authorization': `Bearer ${accessToken.trim()}`
                },
                body: formDataUpload
              })

              if (uploadResponse.ok) {
                const ghlFile = await uploadResponse.json()
                receiptUrl = ghlFile.url || ghlFile.fileUrl || receiptPreview || ''

                await supabase.from('media_files').insert({
                  file_name: fileName,
                  file_url: receiptUrl,
                  file_type: receiptFile.type,
                  file_size: receiptFile.size,
                  ghl_file_id: ghlFile._id || ghlFile.id,
                  folder_id: expenseFolder?.id || null,
                  location_id: locationId,
                  thumbnail_url: ghlFile.thumbnailUrl || null,
                  uploaded_by: 'c4489fab-966b-4465-bb68-cf5bc43310f9'
                })
              }
            }
          }
        } catch (uploadErr) {
          console.error('Error uploading receipt:', uploadErr)
        }
      }

      const { data, error } = await supabase
        .from('expenses')
        .insert([{
          admin_user_id: 'c4489fab-966b-4465-bb68-cf5bc43310f9',
          category: formData.category,
          amount: parseFloat(formData.amount),
          description: formData.description,
          expense_date: formData.expense_date,
          payment_method: formData.payment_method,
          receipt_url: receiptUrl || null,
          notes: null,
          status: 'Pending'
        }])
        .select()

      if (error) throw error

      await fetchExpenses()
      setShowCreateModal(false)
      setView('list')
      resetForm()
    } catch (error) {
      console.error('Failed to create expense:', error)
      alert('Failed to create expense. Please try again.')
    }
  }

  const handleAddExpense = () => {
    setView('add')
    resetForm()
  }

  const handleBackToList = () => {
    setView('list')
    resetForm()
  }

  const handleEditExpense = async () => {
    if (!selectedExpense) return

    try {
      let receiptUrl = formData.receipt_url

      if (receiptFile) {
        try {
          const { data: integration, error: integrationError } = await supabase
            .from('integrations')
            .select('config')
            .eq('integration_type', 'ghl_api')
            .maybeSingle()

          if (integration?.config?.accessToken) {
            const accessToken = integration.config.accessToken
            const locationId = integration.config.locationId || 'iDIRFjdZBWH7SqBzTowc'

            const { data: folderAssignment } = await supabase
              .from('media_folder_assignments')
              .select('media_folder_id, media_folders!inner(ghl_folder_id, folder_name)')
              .eq('trigger_event', 'EXPENSE_UPDATED')
              .eq('module', 'Expenses')
              .maybeSingle()

            const ghlFolderId = folderAssignment?.media_folders?.ghl_folder_id

            if (!ghlFolderId) {
              console.log('No GHL folder configured for expense updates, skipping upload')
            } else {
              let { data: expenseFolder } = await supabase
                .from('media_folders')
                .select('id')
                .eq('ghl_folder_id', ghlFolderId)
                .maybeSingle()

              if (!expenseFolder) {
                const { data: newFolder, error: folderError } = await supabase
                  .from('media_folders')
                  .insert({
                    folder_name: folderAssignment?.media_folders?.folder_name || 'Expense Receipts',
                    ghl_folder_id: ghlFolderId,
                    parent_id: null,
                    location_id: locationId
                  })
                  .select('id')
                  .single()

                if (!folderError && newFolder) {
                  expenseFolder = newFolder
                }
              }

              const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
              const fileName = `expense-${formData.category.replace(/\s+/g, '-')}-${timestamp}.${receiptFile.name.split('.').pop()}`

              const formDataUpload = new FormData()
              formDataUpload.append('file', receiptFile, fileName)
              formDataUpload.append('name', fileName)
              formDataUpload.append('parentId', ghlFolderId)

              const uploadResponse = await fetch('https://services.leadconnectorhq.com/medias/upload-file', {
                method: 'POST',
                headers: {
                  'Accept': 'application/json',
                  'Version': '2021-07-28',
                  'Authorization': `Bearer ${accessToken.trim()}`
                },
                body: formDataUpload
              })

              if (uploadResponse.ok) {
                const ghlFile = await uploadResponse.json()
                receiptUrl = ghlFile.url || ghlFile.fileUrl || receiptPreview || ''

                await supabase.from('media_files').insert({
                  file_name: fileName,
                  file_url: receiptUrl,
                  file_type: receiptFile.type,
                  file_size: receiptFile.size,
                  ghl_file_id: ghlFile._id || ghlFile.id,
                  folder_id: expenseFolder?.id || null,
                  location_id: locationId,
                  thumbnail_url: ghlFile.thumbnailUrl || null,
                  uploaded_by: 'c4489fab-966b-4465-bb68-cf5bc43310f9'
                })
              }
            }
          }
        } catch (uploadErr) {
          console.error('Error uploading receipt:', uploadErr)
        }
      }

      const { error } = await supabase
        .from('expenses')
        .update({
          category: formData.category,
          amount: parseFloat(formData.amount),
          description: formData.description,
          expense_date: formData.expense_date,
          payment_method: formData.payment_method,
          receipt_url: receiptUrl || null,
          notes: formData.notes || null
        })
        .eq('id', selectedExpense.id)

      if (error) throw error

      await fetchExpenses()
      setShowEditModal(false)
      setView('list')
      resetForm()
    } catch (error) {
      console.error('Failed to update expense:', error)
      alert('Failed to update expense. Please try again.')
    }
  }

  const handleDeleteExpense = async (id: string, expenseId: string) => {
    if (confirm(`Are you sure you want to delete expense ${expenseId}?`)) {
      try {
        const { error } = await supabase
          .from('expenses')
          .delete()
          .eq('id', id)

        if (error) throw error

        await fetchExpenses()
      } catch (error) {
        console.error('Failed to delete expense:', error)
        alert('Failed to delete expense. Please try again.')
      }
    }
  }

  const handleApproveExpense = async () => {
    if (!selectedExpense) return

    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'Approved',
          approved_at: new Date().toISOString()
        })
        .eq('id', selectedExpense.id)

      if (error) throw error

      await fetchExpenses()
      setShowApproveModal(false)
      setSelectedExpense(null)
      setView('list')
    } catch (error) {
      console.error('Failed to approve expense:', error)
      alert('Failed to approve expense. Please try again.')
    }
  }

  const handleRejectExpense = async () => {
    if (!selectedExpense || !rejectionReason.trim()) {
      alert('Please provide a reason for rejection.')
      return
    }

    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'Rejected',
          approved_at: new Date().toISOString(),
          rejection_reason: rejectionReason
        })
        .eq('id', selectedExpense.id)

      if (error) throw error

      await fetchExpenses()
      setShowRejectModal(false)
      setSelectedExpense(null)
      setRejectionReason('')
      setView('list')
    } catch (error) {
      console.error('Failed to reject expense:', error)
      alert('Failed to reject expense. Please try again.')
    }
  }

  const handleViewExpense = (expense: Expense) => {
    setSelectedExpense(expense)
    setView('view')
    setShowViewModal(true)
  }

  const handleEditClick = (expense: Expense) => {
    setSelectedExpense(expense)
    setFormData({
      category: expense.category,
      amount: expense.amount.toString(),
      description: expense.description,
      expense_date: expense.expense_date,
      payment_method: expense.payment_method,
      receipt_url: expense.receipt_url || ''
    })
    setView('edit')
    setShowEditModal(true)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setReceiptFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const resetForm = () => {
    setFormData({
      category: '',
      amount: '',
      description: '',
      expense_date: new Date().toISOString().split('T')[0],
      payment_method: '',
      receipt_url: ''
    })
    setSelectedExpense(null)
    setReceiptFile(null)
    setReceiptPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <>
      {/* Desktop View */}
      <div className="hidden md:block ppt-slide p-6">
        {view === 'list' && (
          <>
            <PageHeader
              title="Expense Management"
              subtitle="Track, manage, and approve team expenses"
              actions={[
                {
                  label: 'Add Expense',
                  onClick: handleAddExpense,
                  variant: 'default',
                  icon: Plus
                }
              ]}
            />

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
        >
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
            <KPICard
              title="Total Expenses"
              value={`₹${totalExpenses.toLocaleString()}`}
              change={12}
              icon={DollarSign}
              category="primary"
            />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
            <KPICard
              title="Pending Approval"
              value={pendingExpenses}
              change={-5}
              icon={Calendar}
              category="warning"
            />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
            <KPICard
              title="Approved"
              value={approvedExpenses}
              change={8}
              icon={TrendingUp}
              category="success"
            />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
            <KPICard
              title="Reimbursed"
              value={`₹${reimbursedAmount.toLocaleString()}`}
              change={15}
              icon={Receipt}
              category="secondary"
            />
          </motion.div>
        </motion.div>

        <motion.div
          className="mb-6 flex gap-4 flex-wrap"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Input
            placeholder="Search expenses by ID, description, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            <option value="Travel">Travel</option>
            <option value="Food">Food</option>
            <option value="Office Supplies">Office Supplies</option>
            <option value="Software">Software</option>
            <option value="Marketing">Marketing</option>
            <option value="Training">Training</option>
            <option value="Other">Other</option>
          </select>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Reimbursed">Reimbursed</option>
          </select>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Expense Records</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading expenses...</p>
                  </div>
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Expense ID</th>
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Category</th>
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Amount</th>
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((expense, index) => (
                      <motion.tr
                        key={expense.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * index }}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium font-mono">{expense.expense_id}</div>
                          <div className="text-sm text-gray-500 truncate max-w-xs">{expense.description}</div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={categoryColors[expense.category] || 'bg-gray-50 text-gray-700'}>
                            {expense.category}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-brand-primary">
                            {expense.currency} {parseFloat(expense.amount.toString()).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">{expense.payment_method}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm">{new Date(expense.expense_date).toLocaleDateString()}</div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={statusColors[expense.status]}>{expense.status}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewExpense(expense)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditClick(expense)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Expense
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteExpense(expense.id, expense.expense_id)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Expense
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
          </>
        )}

        {(view === 'add' || view === 'edit') && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <Button
                variant="ghost"
                onClick={handleBackToList}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to List
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {view === 'add' ? 'Add New Expense' : 'Edit Expense'}
                </h1>
                <p className="text-gray-500 mt-1">
                  {view === 'add' ? 'Record a new expense for tracking' : 'Update expense details'}
                </p>
              </div>
            </div>

            <Card className="max-w-3xl">
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                    <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Travel">Travel</SelectItem>
                        <SelectItem value="Food">Food</SelectItem>
                        <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                        <SelectItem value="Software">Software</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Training">Training</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="Enter amount"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter expense description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Expense Date *</label>
                    <Input
                      type="date"
                      value={formData.expense_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, expense_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
                    <Select value={formData.payment_method} onValueChange={(value) => setFormData(prev => ({ ...prev, payment_method: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Credit Card">Credit Card</SelectItem>
                        <SelectItem value="Debit Card">Debit Card</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Receipt Upload</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="space-y-3">
                    {receiptPreview || formData.receipt_url ? (
                      <div className="relative">
                        <img
                          src={receiptPreview || formData.receipt_url}
                          alt="Receipt preview"
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setReceiptFile(null)
                            setReceiptPreview(null)
                            setFormData(prev => ({ ...prev, receipt_url: '' }))
                            if (fileInputRef.current) fileInputRef.current.value = ''
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-brand-primary transition-colors"
                      >
                        <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600">Click to upload receipt</p>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3 pt-4">
                  <Button
                    onClick={view === 'add' ? handleCreateExpense : handleEditExpense}
                    disabled={!formData.category || !formData.amount || !formData.description || !formData.expense_date || !formData.payment_method}
                    className="flex-1"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {view === 'add' ? 'Add Expense' : 'Save Changes'}
                  </Button>
                  <Button variant="outline" onClick={handleBackToList} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {view === 'view' && selectedExpense && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <Button
                variant="ghost"
                onClick={handleBackToList}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to List
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Expense Details</h1>
                <p className="text-gray-500 mt-1">View complete expense information</p>
              </div>
            </div>

            <Card className="max-w-3xl">
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Category</label>
                    <p className="text-base font-semibold text-gray-800">{selectedExpense.category}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
                    <Badge className={statusColors[selectedExpense.status]}>
                      {selectedExpense.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Amount</label>
                    <p className="text-2xl font-bold text-orange-600">
                      {selectedExpense.currency} {parseFloat(selectedExpense.amount.toString()).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Date</label>
                    <p className="text-base font-semibold text-gray-800">
                      {format(new Date(selectedExpense.expense_date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Payment Method</label>
                  <p className="text-base font-semibold text-gray-800">{selectedExpense.payment_method}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                  <p className="text-base text-gray-700 leading-relaxed">{selectedExpense.description}</p>
                </div>

                {selectedExpense.receipt_url && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Receipt</label>
                    <img
                      src={selectedExpense.receipt_url}
                      alt="Receipt"
                      className="w-full max-w-md rounded-lg shadow-md cursor-pointer"
                      onClick={() => window.open(selectedExpense.receipt_url!, '_blank')}
                    />
                  </div>
                )}

                {selectedExpense.status === 'Rejected' && selectedExpense.rejection_reason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-red-800 mb-1">Rejection Reason</label>
                    <p className="text-base text-red-700 leading-relaxed">{selectedExpense.rejection_reason}</p>
                  </div>
                )}

                {selectedExpense.status === 'Pending' && (
                  <div className="flex items-center gap-3 pt-4 border-t pt-6">
                    <Button
                      onClick={() => setShowApproveModal(true)}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => setShowRejectModal(true)}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-4">
                  <Button
                    onClick={() => handleEditClick(selectedExpense)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleDeleteExpense(selectedExpense.id, selectedExpense.expense_id)
                      setView('list')
                    }}
                    className="flex-1 text-red-600 hover:text-red-700 hover:border-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Mobile View - App-like Experience */}
      <div className="md:hidden min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
        {/* Mobile Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-6 shadow-lg">
          <h1 className="text-2xl font-bold mb-1">Expenses</h1>
          <p className="text-orange-100 text-sm">{format(new Date(), 'EEEE, MMMM dd, yyyy')}</p>
        </div>

        {/* Stats Cards */}
        <div className="px-4 -mt-4 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <motion.div
              whileTap={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-4 shadow-lg border border-orange-100"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="bg-orange-100 p-2 rounded-xl">
                  <DollarSign className="w-5 h-5 text-orange-600" />
                </div>
                <span className="text-xl font-bold text-orange-600">₹{(totalExpenses/1000).toFixed(1)}k</span>
              </div>
              <p className="text-xs text-gray-600 font-medium">Total</p>
            </motion.div>

            <motion.div
              whileTap={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-4 shadow-lg border border-yellow-100"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="bg-yellow-100 p-2 rounded-xl">
                  <Calendar className="w-5 h-5 text-yellow-600" />
                </div>
                <span className="text-2xl font-bold text-yellow-600">{pendingExpenses}</span>
              </div>
              <p className="text-xs text-gray-600 font-medium">Pending</p>
            </motion.div>

            <motion.div
              whileTap={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-4 shadow-lg border border-green-100"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="bg-green-100 p-2 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-2xl font-bold text-green-600">{approvedExpenses}</span>
              </div>
              <p className="text-xs text-gray-600 font-medium">Approved</p>
            </motion.div>

            <motion.div
              whileTap={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-4 shadow-lg border border-blue-100"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="bg-blue-100 p-2 rounded-xl">
                  <Receipt className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-xl font-bold text-blue-600">₹{(reimbursedAmount/1000).toFixed(1)}k</span>
              </div>
              <p className="text-xs text-gray-600 font-medium">Reimbursed</p>
            </motion.div>
          </div>
        </div>

        {/* Add Expense Button */}
        <div className="px-4 mb-4">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl py-4 px-6 shadow-lg flex items-center justify-center gap-3 font-semibold"
          >
            <Plus className="w-5 h-5" />
            Add New Expense
          </motion.button>
        </div>

        {/* Recent Expenses */}
        <div className="px-4 pb-20">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Recent Expenses</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No expenses yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExpenses.map((expense) => (
                <motion.div
                  key={expense.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleViewExpense(expense)}
                  className="bg-white rounded-2xl p-4 shadow-md active:shadow-lg transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{categoryIcons[expense.category] || '📦'}</div>
                      <div>
                        <p className="font-semibold text-gray-800">{expense.category}</p>
                        <p className="text-xs text-gray-500">{format(new Date(expense.expense_date), 'MMM dd, yyyy')}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{expense.description}</p>
                      <p className="text-xl font-bold text-orange-600">
                        {expense.currency} {parseFloat(expense.amount.toString()).toLocaleString()}
                      </p>
                    </div>
                    <Badge className={statusColors[expense.status]}>
                      {expense.status}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal for Mobile */}
      <AnimatePresence>
        {showViewModal && selectedExpense && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="md:hidden fixed inset-0 bg-white z-50 overflow-y-auto"
          >
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-6 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <button onClick={() => setShowViewModal(false)}>
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold">Expense Details</h2>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-5xl">{categoryIcons[selectedExpense.category] || '📦'}</div>
                  <div>
                    <p className="text-lg font-bold text-gray-800">{selectedExpense.category}</p>
                    <Badge className={statusColors[selectedExpense.status]}>
                      {selectedExpense.status}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="flex items-center gap-3">
                      <div className="bg-orange-100 p-2 rounded-xl">
                        <DollarSign className="w-4 h-4 text-orange-600" />
                      </div>
                      <span className="text-sm text-gray-600">Amount</span>
                    </div>
                    <span className="text-xl font-bold text-orange-600">
                      {selectedExpense.currency} {parseFloat(selectedExpense.amount.toString()).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-xl">
                        <Calendar className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-sm text-gray-600">Date</span>
                    </div>
                    <span className="font-semibold text-gray-800">
                      {format(new Date(selectedExpense.expense_date), 'MMM dd, yyyy')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-xl">
                        <CreditCard className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="text-sm text-gray-600">Payment</span>
                    </div>
                    <span className="font-semibold text-gray-800">{selectedExpense.payment_method}</span>
                  </div>

                  <div className="py-3">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-purple-100 p-2 rounded-xl">
                        <FileText className="w-4 h-4 text-purple-600" />
                      </div>
                      <span className="text-sm text-gray-600">Description</span>
                    </div>
                    <p className="text-sm text-gray-700 ml-12 leading-relaxed">
                      {selectedExpense.description}
                    </p>
                  </div>

                  {selectedExpense.receipt_url && (
                    <div className="py-3 border-t">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="bg-gray-100 p-2 rounded-xl">
                          <Image className="w-4 h-4 text-gray-600" />
                        </div>
                        <span className="text-sm text-gray-600">Receipt</span>
                      </div>
                      <img
                        src={selectedExpense.receipt_url}
                        alt="Receipt"
                        className="ml-12 w-full max-w-sm rounded-lg shadow-md cursor-pointer"
                        onClick={() => window.open(selectedExpense.receipt_url!, '_blank')}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-4 pb-4 flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowViewModal(false)
                    handleEditClick(selectedExpense)
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl py-4 font-semibold shadow-lg flex items-center justify-center gap-2"
                >
                  <Edit className="w-5 h-5" />
                  Edit
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowViewModal(false)
                    handleDeleteExpense(selectedExpense.id, selectedExpense.expense_id)
                  }}
                  className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl py-4 font-semibold shadow-lg flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  Delete
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Create Expense Page */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="md:hidden fixed inset-0 bg-white z-[60] overflow-y-auto"
          >
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-6 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <button onClick={() => { setShowCreateModal(false); resetForm(); }}>
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold">Add New Expense</h2>
              </div>
            </div>

            <div className="p-4 pb-24 space-y-6">
              {/* Category & Amount */}
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Select category</option>
                    <option value="Travel">Travel ✈️</option>
                    <option value="Food">Food 🍽️</option>
                    <option value="Office Supplies">Office Supplies 📎</option>
                    <option value="Software">Software 💻</option>
                    <option value="Marketing">Marketing 📢</option>
                    <option value="Training">Training 🎓</option>
                    <option value="Other">Other 📦</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg font-semibold"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What was this expense for?"
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Date & Payment Method */}
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    value={formData.expense_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, expense_date: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Payment Method *
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Select method</option>
                    <option value="Cash">Cash 💵</option>
                    <option value="Credit Card">Credit Card 💳</option>
                    <option value="Debit Card">Debit Card 💳</option>
                    <option value="UPI">UPI 📱</option>
                    <option value="Bank Transfer">Bank Transfer 🏦</option>
                  </select>
                </div>
              </div>

              {/* Receipt Upload */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Upload Receipt (Optional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {receiptPreview ? (
                  <div className="relative">
                    <img
                      src={receiptPreview}
                      alt="Receipt preview"
                      className="w-full h-48 object-cover rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptFile(null)
                        setReceiptPreview(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="absolute top-3 right-3 bg-red-500 text-white rounded-full p-2 shadow-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-orange-500 transition-colors"
                  >
                    <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm font-medium text-gray-700">Tap to upload receipt</p>
                    <p className="text-xs text-gray-500 mt-1">Image or PDF</p>
                  </motion.button>
                )}
              </div>
            </div>

            {/* Fixed Bottom Button */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-20">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleCreateExpense}
                disabled={!formData.category || !formData.amount || !formData.description || !formData.expense_date || !formData.payment_method}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl py-4 font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                Add Expense
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Edit Expense Page */}
      <AnimatePresence>
        {showEditModal && selectedExpense && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="md:hidden fixed inset-0 bg-white z-[60] overflow-y-auto"
          >
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-6 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <button onClick={() => { setShowEditModal(false); resetForm(); }}>
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold">Edit Expense</h2>
              </div>
            </div>

            <div className="p-4 pb-24 space-y-6">
              {/* Category & Amount */}
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Select category</option>
                    <option value="Travel">Travel ✈️</option>
                    <option value="Food">Food 🍽️</option>
                    <option value="Office Supplies">Office Supplies 📎</option>
                    <option value="Software">Software 💻</option>
                    <option value="Marketing">Marketing 📢</option>
                    <option value="Training">Training 🎓</option>
                    <option value="Other">Other 📦</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg font-semibold"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What was this expense for?"
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Date & Payment Method */}
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    value={formData.expense_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, expense_date: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Payment Method *
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Select method</option>
                    <option value="Cash">Cash 💵</option>
                    <option value="Credit Card">Credit Card 💳</option>
                    <option value="Debit Card">Debit Card 💳</option>
                    <option value="UPI">UPI 📱</option>
                    <option value="Bank Transfer">Bank Transfer 🏦</option>
                  </select>
                </div>
              </div>

              {/* Receipt Upload */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Upload Receipt (Optional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {receiptPreview || formData.receipt_url ? (
                  <div className="relative">
                    <img
                      src={receiptPreview || formData.receipt_url}
                      alt="Receipt preview"
                      className="w-full h-48 object-cover rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptFile(null)
                        setReceiptPreview(null)
                        setFormData(prev => ({ ...prev, receipt_url: '' }))
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="absolute top-3 right-3 bg-red-500 text-white rounded-full p-2 shadow-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-orange-500 transition-colors"
                  >
                    <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm font-medium text-gray-700">Tap to upload receipt</p>
                    <p className="text-xs text-gray-500 mt-1">Image or PDF</p>
                  </motion.button>
                )}
              </div>
            </div>

            {/* Fixed Bottom Button */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-20">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleEditExpense}
                disabled={!formData.category || !formData.amount || !formData.description || !formData.expense_date || !formData.payment_method}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl py-4 font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                Save Changes
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Approve Modal */}
      {showApproveModal && selectedExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Approve Expense</h3>
                <p className="text-sm text-gray-500">Expense ID: {selectedExpense.expense_id}</p>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              Are you sure you want to approve this expense of {selectedExpense.currency} {parseFloat(selectedExpense.amount.toString()).toLocaleString()}?
            </p>
            <div className="flex gap-3">
              <Button
                onClick={handleApproveExpense}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowApproveModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Reject Expense</h3>
                <p className="text-sm text-gray-500">Expense ID: {selectedExpense.expense_id}</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason *
              </label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejecting this expense..."
                rows={4}
                className="w-full"
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleRejectExpense}
                disabled={!rejectionReason.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectionReason('')
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  )
}
