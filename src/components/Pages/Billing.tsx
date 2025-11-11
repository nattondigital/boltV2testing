import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Download, Eye, Edit, Trash2, DollarSign, TrendingUp, Calendar, AlertCircle, CheckCircle, Clock, Send, FileText, Receipt, Repeat, Search, X, Save, MoreVertical, Printer, ArrowLeft, ChevronRight, Link2, Copy, Share2, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { KPICard } from '@/components/Common/KPICard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatCurrency, formatDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { InvoicePDF } from '@/components/Billing/InvoicePDF'
import { EstimatePDF } from '@/components/Billing/EstimatePDF'
import { useAuth } from '@/contexts/AuthContext'
import { PermissionGuard } from '@/components/Common/PermissionGuard'

const statusColors: Record<string, string> = {
  'Paid': 'bg-green-100 text-green-800',
  'Pending': 'bg-yellow-100 text-yellow-800',
  'Overdue': 'bg-red-100 text-red-800',
  'Draft': 'bg-gray-100 text-gray-800',
  'Sent': 'bg-blue-100 text-blue-800',
  'Accepted': 'bg-green-100 text-green-800',
  'Rejected': 'bg-red-100 text-red-800',
  'Expired': 'bg-gray-100 text-gray-800',
  'Active': 'bg-green-100 text-green-800',
  'Cancelled': 'bg-red-100 text-red-800',
  'Paused': 'bg-yellow-100 text-yellow-800',
  'Completed': 'bg-green-100 text-green-800',
  'Failed': 'bg-red-100 text-red-800',
  'Refunded': 'bg-orange-100 text-orange-800',
  'Partially Paid': 'bg-yellow-100 text-yellow-800',
  'Invoiced': 'bg-purple-100 text-purple-800'
}

type TabType = 'estimates' | 'invoices' | 'subscriptions' | 'receipts'
type ViewState = 'list' | 'add' | 'edit' | 'view'

export function Billing() {
  const { canCreate, canUpdate, canDelete } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('estimates')
  const [viewState, setViewState] = useState<ViewState>('list')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)

  const [estimates, setEstimates] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [receipts, setReceipts] = useState<any[]>([])

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showInvoicePDF, setShowInvoicePDF] = useState(false)
  const [showEstimatePDF, setShowEstimatePDF] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)

  const [formData, setFormData] = useState<any>({})

  const [contacts, setContacts] = useState<any[]>([])
  const [contactSearchTerm, setContactSearchTerm] = useState('')
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  const [mobileContactSearchTerm, setMobileContactSearchTerm] = useState('')
  const [showMobileContactDropdown, setShowMobileContactDropdown] = useState(false)

  const [products, setProducts] = useState<any[]>([])
  const [packages, setPackages] = useState<any[]>([])
  const [showPackageDropdown, setShowPackageDropdown] = useState(false)
  const [packageSearchTerm, setPackageSearchTerm] = useState('')
  const [paymentGateways, setPaymentGateways] = useState<any[]>([])
  const [showGatewayModal, setShowGatewayModal] = useState(false)
  const [selectedInvoiceForLink, setSelectedInvoiceForLink] = useState<any>(null)

  useEffect(() => {
    loadData()
    loadContacts()
    loadProducts()
    loadPackages()
    loadPaymentGateways()
  }, [activeTab])

  const loadPaymentGateways = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_gateway_config')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false })

      if (error) throw error
      setPaymentGateways(data || [])
    } catch (error) {
      console.error('Error loading payment gateways:', error)
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.package-search-container')) {
        setShowPackageDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts_master')
        .select('*')
        .order('full_name', { ascending: true })

      if (error) throw error
      setContacts(data || [])
    } catch (error) {
      console.error('Error loading contacts:', error)
    }
  }

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('product_name', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  const loadPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('is_active', true)
        .order('package_name', { ascending: true })

      if (error) throw error
      setPackages(data || [])
    } catch (error) {
      console.error('Error loading packages:', error)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      switch (activeTab) {
        case 'estimates':
          const { data: estimatesData } = await supabase
            .from('estimates')
            .select('*')
            .order('created_at', { ascending: false })
          setEstimates(estimatesData || [])
          break
        case 'invoices':
          const { data: invoicesData } = await supabase
            .from('invoices')
            .select('*')
            .order('created_at', { ascending: false })
          setInvoices(invoicesData || [])
          break
        case 'subscriptions':
          const { data: subscriptionsData } = await supabase
            .from('subscriptions')
            .select('*')
            .order('created_at', { ascending: false })
          setSubscriptions(subscriptionsData || [])
          break
        case 'receipts':
          const { data: receiptsData } = await supabase
            .from('receipts')
            .select('*')
            .order('created_at', { ascending: false })
          setReceipts(receiptsData || [])
          break
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    setLoading(true)
    try {
      switch (activeTab) {
        case 'estimates':
          await supabase.from('estimates').insert([{
            customer_name: formData.customerName,
            customer_email: formData.customerEmail,
            customer_phone: formData.customerPhone,
            title: formData.title,
            items: formData.items || [],
            subtotal: parseFloat(formData.subtotal) || 0,
            discount: parseFloat(formData.discount) || 0,
            tax_rate: parseFloat(formData.taxRate) || 0,
            tax_amount: parseFloat(formData.taxAmount) || 0,
            total_amount: parseFloat(formData.totalAmount) || 0,
            notes: formData.notes,
            status: formData.status || 'Draft',
            valid_until: formData.validUntil
          }])
          break
        case 'invoices':
          await supabase.from('invoices').insert([{
            customer_name: formData.customerName,
            customer_email: formData.customerEmail,
            customer_phone: formData.customerPhone,
            title: formData.title,
            items: formData.items || [],
            subtotal: parseFloat(formData.subtotal) || 0,
            discount: parseFloat(formData.discount) || 0,
            tax_rate: parseFloat(formData.taxRate) || 0,
            tax_amount: parseFloat(formData.taxAmount) || 0,
            total_amount: parseFloat(formData.totalAmount) || 0,
            paid_amount: 0,
            balance_due: parseFloat(formData.totalAmount) || 0,
            notes: formData.notes,
            terms: formData.terms,
            status: formData.status || 'Draft',
            receipts: [],
            issue_date: formData.issueDate,
            due_date: formData.dueDate
          }])

          if (formData.estimateId) {
            const { error: updateError } = await supabase
              .from('estimates')
              .update({ status: 'Invoiced' })
              .eq('id', formData.estimateId)

            if (updateError) {
              console.error('Error updating estimate status:', updateError)
            }
          }
          break
        case 'subscriptions':
          await supabase.from('subscriptions').insert([{
            customer_name: formData.customerName,
            customer_email: formData.customerEmail,
            customer_phone: formData.customerPhone,
            plan_name: formData.planName,
            plan_type: formData.planType,
            amount: parseFloat(formData.amount) || 0,
            currency: formData.currency || 'INR',
            billing_cycle_day: parseInt(formData.billingCycleDay) || 1,
            status: formData.status || 'Active',
            payment_method: formData.paymentMethod,
            start_date: formData.startDate,
            next_billing_date: formData.nextBillingDate,
            auto_renew: formData.autoRenew !== false,
            notes: formData.notes
          }])
          break
        case 'receipts':
          const amountPaid = parseFloat(formData.amountPaid) || 0
          const { data: newReceipt, error: receiptError } = await supabase.from('receipts').insert([{
            invoice_id: formData.invoiceId || null,
            customer_name: formData.customerName,
            customer_email: formData.customerEmail,
            payment_method: formData.paymentMethod,
            payment_reference: formData.paymentReference,
            amount_paid: amountPaid,
            currency: formData.currency || 'INR',
            payment_date: formData.paymentDate,
            description: formData.description,
            notes: formData.notes,
            status: formData.status || 'Completed'
          }]).select().single()

          if (receiptError) {
            console.error('Error creating receipt:', receiptError)
          }

          if (formData.invoiceId && newReceipt) {
            const { data: invoice, error: invoiceError } = await supabase
              .from('invoices')
              .select('paid_amount, total_amount, receipts')
              .eq('id', formData.invoiceId)
              .maybeSingle()

            if (invoiceError) {
              console.error('Error fetching invoice:', invoiceError)
            } else if (invoice) {
              const newPaidAmount = (parseFloat(invoice.paid_amount) || 0) + amountPaid
              const newBalanceDue = (parseFloat(invoice.total_amount) || 0) - newPaidAmount

              const existingReceipts = invoice.receipts || []
              const updatedReceipts = [...existingReceipts, {
                receipt_id: newReceipt.receipt_id,
                amount_paid: amountPaid,
                payment_date: formData.paymentDate,
                payment_method: formData.paymentMethod,
                payment_reference: formData.paymentReference || null
              }]

              const { error: updateError } = await supabase
                .from('invoices')
                .update({
                  paid_amount: newPaidAmount,
                  balance_due: newBalanceDue,
                  status: newBalanceDue <= 0 ? 'Paid' : invoice.paid_amount === 0 ? 'Pending' : 'Partially Paid',
                  receipts: updatedReceipts
                })
                .eq('id', formData.invoiceId)

              if (updateError) {
                console.error('Error updating invoice:', updateError)
              }
            }
          }
          break
      }

      await loadData()

      if (activeTab === 'receipts' && formData.invoiceId) {
        const { data: invoicesData } = await supabase
          .from('invoices')
          .select('*')
          .order('created_at', { ascending: false })
        setInvoices(invoicesData || [])
      }
      setShowCreateModal(false)
      setViewState('list')
      resetForm()
    } catch (error) {
      console.error('Error creating:', error)
      alert('Error creating record')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedItem) return
    setLoading(true)
    try {
      switch (activeTab) {
        case 'estimates':
          await supabase
            .from('estimates')
            .update({
              customer_name: formData.customerName,
              customer_email: formData.customerEmail,
              customer_phone: formData.customerPhone,
              title: formData.title,
              items: formData.items || [],
              subtotal: parseFloat(formData.subtotal) || 0,
              discount: parseFloat(formData.discount) || 0,
              tax_rate: parseFloat(formData.taxRate) || 0,
              tax_amount: parseFloat(formData.taxAmount) || 0,
              total_amount: parseFloat(formData.totalAmount) || 0,
              notes: formData.notes,
              status: formData.status,
              valid_until: formData.validUntil
            })
            .eq('id', selectedItem.id)
          break
        case 'invoices':
          await supabase
            .from('invoices')
            .update({
              customer_name: formData.customerName,
              customer_email: formData.customerEmail,
              customer_phone: formData.customerPhone,
              title: formData.title,
              items: formData.items || [],
              subtotal: parseFloat(formData.subtotal) || 0,
              discount: parseFloat(formData.discount) || 0,
              tax_rate: parseFloat(formData.taxRate) || 0,
              tax_amount: parseFloat(formData.taxAmount) || 0,
              total_amount: parseFloat(formData.totalAmount) || 0,
              notes: formData.notes,
              terms: formData.terms,
              status: formData.status,
              issue_date: formData.issueDate,
              due_date: formData.dueDate
            })
            .eq('id', selectedItem.id)
          break
        case 'subscriptions':
          await supabase
            .from('subscriptions')
            .update({
              customer_name: formData.customerName,
              customer_email: formData.customerEmail,
              customer_phone: formData.customerPhone,
              plan_name: formData.planName,
              plan_type: formData.planType,
              amount: parseFloat(formData.amount) || 0,
              status: formData.status,
              payment_method: formData.paymentMethod,
              next_billing_date: formData.nextBillingDate,
              auto_renew: formData.autoRenew !== false,
              notes: formData.notes
            })
            .eq('id', selectedItem.id)
          break
        case 'receipts':
          const oldAmountPaid = parseFloat(selectedItem.amount_paid) || 0
          const newAmountPaid = parseFloat(formData.amountPaid) || 0
          const amountDifference = newAmountPaid - oldAmountPaid

          await supabase
            .from('receipts')
            .update({
              customer_name: formData.customerName,
              customer_email: formData.customerEmail,
              payment_method: formData.paymentMethod,
              payment_reference: formData.paymentReference,
              amount_paid: newAmountPaid,
              payment_date: formData.paymentDate,
              description: formData.description,
              notes: formData.notes,
              status: formData.status
            })
            .eq('id', selectedItem.id)

          if (selectedItem.invoice_id) {
            const { data: invoice } = await supabase
              .from('invoices')
              .select('paid_amount, total_amount, receipts')
              .eq('id', selectedItem.invoice_id)
              .maybeSingle()

            if (invoice) {
              const updatedPaidAmount = (parseFloat(invoice.paid_amount) || 0) + amountDifference
              const updatedBalanceDue = (parseFloat(invoice.total_amount) || 0) - updatedPaidAmount

              const existingReceipts = invoice.receipts || []
              const updatedReceipts = existingReceipts.map((r: any) =>
                r.receipt_id === selectedItem.receipt_id
                  ? {
                      ...r,
                      amount_paid: newAmountPaid,
                      payment_date: formData.paymentDate,
                      payment_method: formData.paymentMethod,
                      payment_reference: formData.paymentReference || null
                    }
                  : r
              )

              await supabase
                .from('invoices')
                .update({
                  paid_amount: updatedPaidAmount,
                  balance_due: updatedBalanceDue,
                  status: updatedBalanceDue <= 0 ? 'Paid' : updatedPaidAmount === 0 ? 'Pending' : 'Partially Paid',
                  receipts: updatedReceipts
                })
                .eq('id', selectedItem.invoice_id)
            }
          }
          break
      }
      await loadData()
      setShowEditModal(false)
      setViewState('list')
      resetForm()
    } catch (error) {
      console.error('Error updating:', error)
      alert('Error updating record')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return
    setLoading(true)
    try {
      const table = activeTab === 'estimates' ? 'estimates' :
                    activeTab === 'invoices' ? 'invoices' :
                    activeTab === 'subscriptions' ? 'subscriptions' : 'receipts'

      if (activeTab === 'receipts') {
        const { data: receipt } = await supabase
          .from('receipts')
          .select('invoice_id, amount_paid, receipt_id')
          .eq('id', id)
          .maybeSingle()

        if (receipt?.invoice_id) {
          const { data: invoice } = await supabase
            .from('invoices')
            .select('paid_amount, total_amount, receipts')
            .eq('id', receipt.invoice_id)
            .maybeSingle()

          if (invoice) {
            const updatedPaidAmount = (parseFloat(invoice.paid_amount) || 0) - (parseFloat(receipt.amount_paid) || 0)
            const updatedBalanceDue = (parseFloat(invoice.total_amount) || 0) - updatedPaidAmount

            const existingReceipts = invoice.receipts || []
            const updatedReceipts = existingReceipts.filter((r: any) => r.receipt_id !== receipt.receipt_id)

            await supabase
              .from('invoices')
              .update({
                paid_amount: updatedPaidAmount,
                balance_due: updatedBalanceDue,
                status: updatedBalanceDue <= 0 ? 'Paid' : updatedPaidAmount === 0 ? 'Pending' : 'Partially Paid',
                receipts: updatedReceipts
              })
              .eq('id', receipt.invoice_id)
          }
        }
      }

      await supabase.from(table).delete().eq('id', id)
      await loadData()
    } catch (error) {
      console.error('Error deleting:', error)
      alert('Error deleting record')
    } finally {
      setLoading(false)
    }
  }

  const handleView = (item: any) => {
    setSelectedItem(item)
    setShowViewModal(true)
    setViewState('view')
  }

  const handleViewPDF = (item: any) => {
    setSelectedItem(item)
    setShowInvoicePDF(true)
  }

  const handleViewEstimatePDF = (item: any) => {
    setSelectedItem(item)
    setShowEstimatePDF(true)
  }

  const handleEdit = (item: any) => {
    setSelectedItem(item)
    setMobileContactSearchTerm(item.customer_name || '')
    switch (activeTab) {
      case 'estimates':
        setFormData({
          customerName: item.customer_name,
          customerEmail: item.customer_email,
          customerPhone: item.customer_phone,
          title: item.title,
          items: item.items || [],
          subtotal: item.subtotal,
          discount: item.discount,
          taxRate: item.tax_rate,
          taxAmount: item.tax_amount,
          totalAmount: item.total_amount,
          notes: item.notes,
          status: item.status,
          validUntil: item.valid_until
        })
        break
      case 'invoices':
        setFormData({
          customerName: item.customer_name,
          customerEmail: item.customer_email,
          customerPhone: item.customer_phone,
          title: item.title,
          items: item.items || [],
          subtotal: item.subtotal,
          discount: item.discount,
          taxRate: item.tax_rate,
          taxAmount: item.tax_amount,
          totalAmount: item.total_amount,
          notes: item.notes,
          terms: item.terms,
          status: item.status,
          paymentMethod: item.payment_method,
          issueDate: item.issue_date,
          dueDate: item.due_date
        })
        break
      case 'subscriptions':
        setFormData({
          customerName: item.customer_name,
          customerEmail: item.customer_email,
          customerPhone: item.customer_phone,
          planName: item.plan_name,
          planType: item.plan_type,
          amount: item.amount,
          status: item.status,
          paymentMethod: item.payment_method,
          nextBillingDate: item.next_billing_date,
          autoRenew: item.auto_renew,
          notes: item.notes
        })
        break
      case 'receipts':
        setFormData({
          customerName: item.customer_name,
          customerEmail: item.customer_email,
          paymentMethod: item.payment_method,
          paymentReference: item.payment_reference,
          amountPaid: item.amount_paid,
          paymentDate: item.payment_date,
          description: item.description,
          notes: item.notes,
          status: item.status
        })
        break
    }
    setShowEditModal(true)
    setViewState('edit')
  }

  const resetForm = () => {
    setFormData({})
    setSelectedItem(null)
    setMobileContactSearchTerm('')
    setShowMobileContactDropdown(false)
  }

  const openCreateModal = () => {
    resetForm()
    const today = new Date().toISOString().split('T')[0]
    switch (activeTab) {
      case 'estimates':
        setFormData({ status: 'Draft', validUntil: today, subtotal: 0, discount: 0, taxRate: 0, taxAmount: 0, totalAmount: 0 })
        break
      case 'invoices':
        setFormData({ status: 'Draft', issueDate: today, dueDate: today, subtotal: 0, discount: 0, taxRate: 0, taxAmount: 0, totalAmount: 0 })
        break
      case 'subscriptions':
        setFormData({ status: 'Active', startDate: today, nextBillingDate: today, autoRenew: true, currency: 'INR', billingCycleDay: 1, planType: 'Monthly' })
        break
      case 'receipts':
        setFormData({ status: 'Completed', paymentDate: today, currency: 'INR' })
        break
    }
    setShowCreateModal(true)
    setViewState('add')
  }

  const handleBackToList = () => {
    setViewState('list')
    resetForm()
    setShowCreateModal(false)
    setShowEditModal(false)
    setShowViewModal(false)
  }

  const handleViewItem = (item: any) => {
    setSelectedItem(item)
    setViewState('view')
    setShowViewModal(true)
  }

  const handleEditFromView = () => {
    if (selectedItem) {
      handleEdit(selectedItem)
      setViewState('edit')
      setShowViewModal(false)
    }
  }

  const handleCreateInvoice = (estimate: any) => {
    const today = new Date().toISOString().split('T')[0]
    setActiveTab('invoices')
    setFormData({
      estimateId: estimate.id,
      customerName: estimate.customer_name,
      customerEmail: estimate.customer_email,
      customerPhone: estimate.customer_phone,
      title: estimate.title,
      items: estimate.items || [],
      subtotal: estimate.subtotal,
      discount: estimate.discount,
      taxRate: estimate.tax_rate,
      taxAmount: estimate.tax_amount,
      totalAmount: estimate.total_amount,
      paidAmount: 0,
      balanceDue: estimate.total_amount,
      notes: estimate.notes,
      terms: '',
      status: 'Draft',
      issueDate: today,
      dueDate: today
    })
    setViewState('add')
    setShowCreateModal(true)
  }

  const handleRecordReceipt = (invoice: any) => {
    setActiveTab('receipts')
    setFormData({
      invoiceId: invoice.id,
      customerName: invoice.customer_name,
      customerEmail: invoice.customer_email,
      customerPhone: invoice.customer_phone || '',
      description: `Payment for ${invoice.title}`,
      amountPaid: invoice.balance_due,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: '',
      paymentReference: '',
      status: 'Completed',
      notes: `Receipt for Invoice ${invoice.invoice_id}`
    })
    setViewState('add')
    setShowCreateModal(true)
  }

  const handleGeneratePaymentLink = async (invoice: any, selectedGateway?: string) => {
    try {
      if (paymentGateways.length === 0) {
        alert('No payment gateway configured. Please configure Cashfree or Razorpay in Settings > Integrations.')
        return
      }

      setLoading(true)
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-payment-link`

      const payload: any = { invoice_id: invoice.id }
      if (selectedGateway) {
        payload.gateway_override = selectedGateway
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (!response.ok) {
        const errorMsg = result.error || 'Failed to generate payment link'

        if (result.gateway === 'Cashfree' && result.error.includes('not enabled')) {
          alert(`${errorMsg}\n\nNote: Cashfree payment links feature needs to be enabled by Cashfree support. You can try using Razorpay instead or contact care@cashfree.com to enable this feature.`)
        } else {
          alert(errorMsg)
        }
        return
      }

      alert(`Payment link generated successfully via ${result.gateway}!\n\nLink: ${result.payment_link_url}\n\nThe link has been copied to your clipboard.`)
      navigator.clipboard.writeText(result.payment_link_url)
      await loadData()
    } catch (error: any) {
      console.error('Error generating payment link:', error)
      alert(error.message || 'Failed to generate payment link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyPaymentLink = (paymentLink: string) => {
    navigator.clipboard.writeText(paymentLink)
    alert('Payment link copied to clipboard!')
  }

  const getFilteredData = () => {
    const data = activeTab === 'estimates' ? estimates :
                 activeTab === 'invoices' ? invoices :
                 activeTab === 'subscriptions' ? subscriptions : receipts

    return data.filter(item => {
      const searchField = activeTab === 'estimates' ? item.estimate_id :
                         activeTab === 'invoices' ? item.invoice_id :
                         activeTab === 'subscriptions' ? item.subscription_id : item.receipt_id
      const matchesSearch = item.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           searchField?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = !statusFilter || item.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }

  const getTabStats = () => {
    switch (activeTab) {
      case 'estimates':
        const totalEstimatesValue = estimates.reduce((sum, e) => sum + (parseFloat(e.total_amount) || 0), 0)
        const sentEstimates = estimates.filter(e => e.status === 'Sent').length
        const acceptedEstimates = estimates.filter(e => e.status === 'Accepted').length
        const draftEstimates = estimates.filter(e => e.status === 'Draft').length
        return [
          { title: 'Total Estimates', value: estimates.length, change: 8, icon: FileText, category: 'primary' as const },
          { title: 'Total Value', value: formatCurrency(totalEstimatesValue), change: 12, icon: DollarSign, category: 'success' as const },
          { title: 'Accepted', value: acceptedEstimates, change: 15, icon: CheckCircle, category: 'success' as const },
          { title: 'Sent', value: sentEstimates, change: 5, icon: Send, category: 'secondary' as const },
          { title: 'Draft', value: draftEstimates, change: -3, icon: Clock, category: 'warning' as const }
        ]

      case 'invoices':
        const totalRevenue = invoices.reduce((sum, i) => sum + (parseFloat(i.paid_amount) || 0), 0)
        const pendingAmount = invoices.filter(i => ['Pending', 'Partially Paid', 'Sent', 'Draft'].includes(i.status)).reduce((sum, i) => sum + (parseFloat(i.balance_due) || 0), 0)
        const overdueAmount = invoices.filter(i => i.status === 'Overdue').reduce((sum, i) => sum + (parseFloat(i.balance_due) || 0), 0)
        const paidInvoices = invoices.filter(i => i.status === 'Paid').length
        return [
          { title: 'Total Revenue', value: formatCurrency(totalRevenue), change: 15, icon: DollarSign, category: 'success' as const },
          { title: 'Pending Payments', value: formatCurrency(pendingAmount), change: -5, icon: Clock, category: 'warning' as const },
          { title: 'Overdue Amount', value: formatCurrency(overdueAmount), change: -12, icon: AlertCircle, category: 'warning' as const },
          { title: 'Paid Invoices', value: paidInvoices, change: 8, icon: CheckCircle, category: 'success' as const },
          { title: 'Total Invoices', value: invoices.length, change: 10, icon: FileText, category: 'primary' as const }
        ]

      case 'subscriptions':
        const activeSubscriptions = subscriptions.filter(s => s.status === 'Active').length
        const monthlyRecurring = subscriptions.filter(s => s.status === 'Active' && s.plan_type === 'Monthly').reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
        const totalSubscriptionValue = subscriptions.filter(s => s.status === 'Active').reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
        const cancelledSubscriptions = subscriptions.filter(s => s.status === 'Cancelled').length
        return [
          { title: 'Active Subscriptions', value: activeSubscriptions, change: 12, icon: Repeat, category: 'primary' as const },
          { title: 'Monthly Recurring', value: formatCurrency(monthlyRecurring), change: 8, icon: DollarSign, category: 'success' as const },
          { title: 'Total Recurring Value', value: formatCurrency(totalSubscriptionValue), change: 15, icon: TrendingUp, category: 'success' as const },
          { title: 'Cancelled', value: cancelledSubscriptions, change: -5, icon: AlertCircle, category: 'warning' as const },
          { title: 'Total Subscriptions', value: subscriptions.length, change: 7, icon: Calendar, category: 'secondary' as const }
        ]

      case 'receipts':
        const totalReceived = receipts.filter(r => r.status === 'Completed').reduce((sum, r) => sum + (parseFloat(r.amount_paid) || 0), 0)
        const completedReceipts = receipts.filter(r => r.status === 'Completed').length
        const refundedReceipts = receipts.filter(r => r.status === 'Refunded').length
        return [
          { title: 'Total Received', value: formatCurrency(totalReceived), change: 20, icon: DollarSign, category: 'success' as const },
          { title: 'Total Receipts', value: receipts.length, change: 10, icon: Receipt, category: 'primary' as const },
          { title: 'Completed', value: completedReceipts, change: 15, icon: CheckCircle, category: 'success' as const },
          { title: 'Refunded', value: refundedReceipts, change: -2, icon: AlertCircle, category: 'warning' as const },
          { title: 'This Month', value: receipts.length, change: 12, icon: Calendar, category: 'secondary' as const }
        ]
    }
  }

  const getStatusOptions = () => {
    switch (activeTab) {
      case 'estimates':
        return ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Invoiced']
      case 'invoices':
        return ['Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled']
      case 'subscriptions':
        return ['Active', 'Paused', 'Cancelled', 'Expired']
      case 'receipts':
        return ['Completed', 'Failed', 'Refunded', 'Pending']
    }
  }

  const tabStats = getTabStats()
  const filteredData = getFilteredData()

  const mobileFilteredContacts = contacts.filter((contact: any) => {
    const searchLower = mobileContactSearchTerm.toLowerCase()
    return (
      contact.full_name?.toLowerCase().includes(searchLower) ||
      contact.email?.toLowerCase().includes(searchLower) ||
      contact.phone?.toLowerCase().includes(searchLower)
    )
  })

  const getTabIcon = (tab: TabType) => {
    switch (tab) {
      case 'estimates': return FileText
      case 'invoices': return Receipt
      case 'subscriptions': return Repeat
      case 'receipts': return DollarSign
    }
  }

  const getTabColor = (tab: TabType) => {
    switch (tab) {
      case 'estimates': return 'blue'
      case 'invoices': return 'green'
      case 'subscriptions': return 'purple'
      case 'receipts': return 'orange'
    }
  }

  return (
    <>
      {/* Desktop View */}
      <div className="hidden md:block ppt-slide p-6">
        <AnimatePresence mode="wait">
          {viewState === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
      <PageHeader
        title="Billing & Payments"
        subtitle="Manage Estimates, Invoices, Subscriptions & Receipts"
        actions={[
          ...(canCreate('billing') ? [{
            label: `Create ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1, -1)}`,
            onClick: openCreateModal,
            variant: 'default' as const,
            icon: Plus
          }] : []),
          {
            label: 'Export Reports',
            onClick: () => {},
            variant: 'outline' as const,
            icon: Download
          }
        ]}
      />

      <motion.div className="mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => { setActiveTab('estimates'); setSearchTerm(''); setStatusFilter('') }}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              activeTab === 'estimates' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-600 hover:text-brand-primary'
            }`}
          >
            Estimates
          </button>
          <button
            onClick={() => { setActiveTab('invoices'); setSearchTerm(''); setStatusFilter('') }}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              activeTab === 'invoices' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-600 hover:text-brand-primary'
            }`}
          >
            Invoices
          </button>
          <button
            onClick={() => { setActiveTab('subscriptions'); setSearchTerm(''); setStatusFilter('') }}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              activeTab === 'subscriptions' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-600 hover:text-brand-primary'
            }`}
          >
            Subscriptions
          </button>
          <button
            onClick={() => { setActiveTab('receipts'); setSearchTerm(''); setStatusFilter('') }}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              activeTab === 'receipts' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-600 hover:text-brand-primary'
            }`}
          >
            Receipts
          </button>
        </div>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
        }}
      >
        {tabStats.map((stat, index) => (
          <motion.div key={index} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
            <KPICard {...stat} />
          </motion.div>
        ))}
      </motion.div>

      <motion.div className="mb-6 flex gap-4 flex-wrap" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder={`Search ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 max-w-md"
          />
        </div>
        <select
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          {getStatusOptions().map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </motion.div>

      {activeTab === 'estimates' && (
        <EstimatesTable data={filteredData} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} onCreateInvoice={handleCreateInvoice} onViewPDF={handleViewEstimatePDF} loading={loading} canUpdate={canUpdate('billing')} canDelete={canDelete('billing')} />
      )}

      {activeTab === 'invoices' && (
        <InvoicesTable data={filteredData} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} onRecordReceipt={handleRecordReceipt} onViewPDF={handleViewPDF} onGeneratePaymentLink={handleGeneratePaymentLink} onCopyPaymentLink={handleCopyPaymentLink} loading={loading} canUpdate={canUpdate('billing')} canDelete={canDelete('billing')} />
      )}

      {activeTab === 'subscriptions' && (
        <SubscriptionsTable data={filteredData} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} loading={loading} canUpdate={canUpdate('billing')} canDelete={canDelete('billing')} />
      )}

      {activeTab === 'receipts' && (
        <ReceiptsTable data={filteredData} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} loading={loading} canUpdate={canUpdate('billing')} canDelete={canDelete('billing')} />
      )}

      {showInvoicePDF && selectedItem && (
        <InvoicePDF
          invoice={selectedItem}
          onClose={() => setShowInvoicePDF(false)}
        />
      )}

      {showEstimatePDF && selectedItem && (
        <EstimatePDF
          estimate={selectedItem}
          onClose={() => setShowEstimatePDF(false)}
        />
      )}
            </motion.div>
          )}

          {viewState === 'view' && selectedItem && (
            <motion.div
              key="view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <ViewModal
                item={selectedItem}
                type={activeTab}
                onClose={handleBackToList}
                onEdit={handleEditFromView}
                canUpdate={canUpdate('billing')}
              />
            </motion.div>
          )}

          {(viewState === 'add' || viewState === 'edit') && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <FormModal
                title={`${viewState === 'add' ? 'Create' : 'Edit'} ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1, -1)}`}
                formData={formData}
                setFormData={setFormData}
                onSave={viewState === 'add' ? handleCreate : handleUpdate}
                onCancel={handleBackToList}
                type={activeTab}
                loading={loading}
                contacts={contacts}
                products={products}
                packages={packages}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile View */}
      <div className="md:hidden min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50">
        <AnimatePresence mode="wait">
          {viewState === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Mobile Header */}
              <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-6 shadow-lg">
                <h1 className="text-2xl font-bold mb-1">Billing</h1>
                <p className="text-cyan-100 text-sm">Manage all your billing documents</p>
              </div>

              {/* Tab Switcher */}
              <div className="px-4 py-4 bg-white shadow-sm">
                <div className="grid grid-cols-4 gap-2">
                  {(['estimates', 'invoices', 'subscriptions', 'receipts'] as TabType[]).map((tab) => {
                    const Icon = getTabIcon(tab)
                    const color = getTabColor(tab)
                    const isActive = activeTab === tab
                    return (
                      <button
                        key={tab}
                        onClick={() => { setActiveTab(tab); setSearchTerm(''); setStatusFilter('') }}
                        className={`p-3 rounded-xl transition-all ${
                          isActive
                            ? `bg-${color}-100 border-2 border-${color}-500`
                            : 'bg-gray-50 border-2 border-transparent'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mx-auto mb-1 ${isActive ? `text-${color}-600` : 'text-gray-400'}`} />
                        <p className={`text-xs font-medium ${isActive ? `text-${color}-600` : 'text-gray-500'}`}>
                          {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Stats Cards */}
              <div className="px-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  {tabStats.slice(0, 4).map((stat, index) => {
                    const StatIcon = stat.icon
                    const colorClass = stat.category === 'success' ? 'green' :
                                      stat.category === 'warning' ? 'orange' :
                                      stat.category === 'primary' ? 'blue' : 'purple'
                    return (
                      <motion.div
                        key={index}
                        whileTap={{ scale: 0.95 }}
                        className={`bg-white rounded-2xl p-4 shadow-lg border border-${colorClass}-100`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className={`bg-${colorClass}-100 p-2 rounded-xl`}>
                            <StatIcon className={`w-5 h-5 text-${colorClass}-600`} />
                          </div>
                          <span className={`text-xl font-bold text-${colorClass}-600`}>
                            {typeof stat.value === 'number' ? stat.value : stat.value}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 font-medium">{stat.title}</p>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              {/* Add Button */}
              {canCreate('billing') && (
                <div className="px-4 mb-4">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={openCreateModal}
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl py-4 px-6 shadow-lg flex items-center justify-center gap-3 font-semibold"
                  >
                    <Plus className="w-5 h-5" />
                    Create {activeTab.charAt(0).toUpperCase() + activeTab.slice(1, -1)}
                  </motion.button>
                </div>
              )}

              {/* List Items */}
              <div className="px-4 pb-20">
                <h2 className="text-lg font-bold text-gray-800 mb-3">
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                </h2>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
                  </div>
                ) : filteredData.length === 0 ? (
                  <div className="text-center py-12">
                    {React.createElement(getTabIcon(activeTab), { className: "w-12 h-12 text-gray-300 mx-auto mb-2" })}
                    <p className="text-gray-500 text-sm">No {activeTab} yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredData.map((item: any) => {
                      const itemId = activeTab === 'estimates' ? item.estimate_id :
                                    activeTab === 'invoices' ? item.invoice_id :
                                    activeTab === 'subscriptions' ? item.subscription_id : item.receipt_id
                      return (
                        <motion.div
                          key={item.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleViewItem(item)}
                          className="bg-white rounded-2xl p-4 shadow-md active:shadow-lg transition-shadow"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800">{item.customer_name}</p>
                              <p className="text-xs text-gray-500">{itemId}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>

                          <div className="flex items-center justify-between mb-2">
                            <Badge className={statusColors[item.status]}>{item.status}</Badge>
                            <span className="text-lg font-bold text-gray-800">
                              {formatCurrency(item.total_amount || item.amount || item.amount_paid || 0)}
                            </span>
                          </div>

                          <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                            {activeTab === 'estimates' && `Valid Until: ${formatDate(item.valid_until)}`}
                            {activeTab === 'invoices' && `Due: ${formatDate(item.due_date)}`}
                            {activeTab === 'subscriptions' && `Next Billing: ${formatDate(item.next_billing_date)}`}
                            {activeTab === 'receipts' && `Payment Date: ${formatDate(item.payment_date)}`}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {viewState === 'view' && selectedItem && (
            <motion.div
              key="view"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 bg-white z-[60] overflow-y-auto"
            >
              <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-6 sticky top-0 z-10">
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={handleBackToList}>
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <div className="flex-1">
                    <h1 className="text-xl font-bold">
                      {activeTab.charAt(0).toUpperCase() + activeTab.slice(1, -1)} Details
                    </h1>
                  </div>
                  {(canUpdate('billing') || canDelete('billing')) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-white hover:bg-white/20">
                          <MoreVertical className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canUpdate('billing') && (
                          <DropdownMenuItem onClick={handleEditFromView}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {canDelete('billing') && (
                          <DropdownMenuItem onClick={() => handleDelete(selectedItem.id)}>
                            <Trash2 className="w-4 h-4 mr-2 text-red-600" />
                            <span className="text-red-600">Delete</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{selectedItem.customer_name}</h2>
                    <p className="text-cyan-100 text-sm">
                      {activeTab === 'estimates' ? selectedItem.estimate_id :
                       activeTab === 'invoices' ? selectedItem.invoice_id :
                       activeTab === 'subscriptions' ? selectedItem.subscription_id : selectedItem.receipt_id}
                    </p>
                  </div>
                  <Badge className={`${statusColors[selectedItem.status]} border-0`}>
                    {selectedItem.status}
                  </Badge>
                </div>
              </div>

              <div className="p-4 space-y-4 pb-20">
                <div className="bg-white rounded-2xl p-4 shadow-md">
                  <h3 className="font-semibold text-gray-800 mb-3">Amount</h3>
                  <div className="text-center p-4 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl">
                    <div className="text-3xl font-bold text-cyan-600">
                      {formatCurrency(selectedItem.total_amount || selectedItem.amount || selectedItem.amount_paid || 0)}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-md">
                  <h3 className="font-semibold text-gray-800 mb-3">Customer Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between py-2">
                      <span className="text-sm text-gray-500">Name</span>
                      <span className="text-sm font-medium text-gray-800">{selectedItem.customer_name}</span>
                    </div>
                    {selectedItem.customer_email && (
                      <div className="flex justify-between py-2 border-t border-gray-100">
                        <span className="text-sm text-gray-500">Email</span>
                        <span className="text-sm font-medium text-gray-800">{selectedItem.customer_email}</span>
                      </div>
                    )}
                    {selectedItem.customer_phone && (
                      <div className="flex justify-between py-2 border-t border-gray-100">
                        <span className="text-sm text-gray-500">Phone</span>
                        <span className="text-sm font-medium text-gray-800">{selectedItem.customer_phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {activeTab === 'invoices' && (
                  <div className="bg-white rounded-2xl p-4 shadow-md">
                    <h3 className="font-semibold text-gray-800 mb-3">Payment Status</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between py-2">
                        <span className="text-sm text-gray-500">Paid Amount</span>
                        <span className="text-sm font-medium text-green-600">
                          {formatCurrency(selectedItem.paid_amount || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-t border-gray-100">
                        <span className="text-sm text-gray-500">Balance Due</span>
                        <span className="text-sm font-medium text-orange-600">
                          {formatCurrency(selectedItem.balance_due || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {selectedItem.notes && (
                  <div className="bg-white rounded-2xl p-4 shadow-md">
                    <h3 className="font-semibold text-gray-800 mb-3">Notes</h3>
                    <p className="text-sm text-gray-600">{selectedItem.notes}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {(viewState === 'add' || viewState === 'edit') && (
            <motion.div
              key="form"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 bg-white z-[60] overflow-y-auto"
            >
              <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-6 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <button onClick={handleBackToList}>
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <h1 className="text-xl font-bold">
                    {viewState === 'add' ? 'Create' : 'Edit'} {activeTab.charAt(0).toUpperCase() + activeTab.slice(1, -1)}
                  </h1>
                </div>
              </div>

              <div className="p-4 space-y-4 pb-24">
                {/* Contact Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search Customer *</label>
                  <div className="relative">
                    <Input
                      value={mobileContactSearchTerm}
                      onChange={(e) => {
                        setMobileContactSearchTerm(e.target.value)
                        setShowMobileContactDropdown(true)
                      }}
                      onFocus={() => setShowMobileContactDropdown(true)}
                      placeholder="Search customer by name, email, or phone..."
                      className="rounded-xl pr-20"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {mobileContactSearchTerm && (
                        <button
                          onClick={() => {
                            setMobileContactSearchTerm('')
                            setFormData({
                              ...formData,
                              customerName: '',
                              customerEmail: '',
                              customerPhone: ''
                            })
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <X className="w-4 h-4 text-gray-500" />
                        </button>
                      )}
                      <Search className="w-4 h-4 text-gray-400" />
                    </div>

                    {showMobileContactDropdown && mobileFilteredContacts.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {mobileFilteredContacts.map((contact) => (
                          <div
                            key={contact.id}
                            onClick={() => {
                              setFormData({
                                ...formData,
                                customerName: contact.full_name,
                                customerEmail: contact.email || '',
                                customerPhone: contact.phone || ''
                              })
                              setMobileContactSearchTerm(contact.full_name)
                              setShowMobileContactDropdown(false)
                            }}
                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">{contact.full_name}</div>
                            <div className="text-sm text-gray-500">
                              {contact.email && <div>{contact.email}</div>}
                              {contact.phone && <div>{contact.phone}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {formData.customerName && (
                    <div className="mt-2 p-3 bg-cyan-50 border border-cyan-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-cyan-900">{formData.customerName}</div>
                          {formData.customerEmail && (
                            <div className="text-sm text-cyan-700">{formData.customerEmail}</div>
                          )}
                          {formData.customerPhone && (
                            <div className="text-sm text-cyan-700">{formData.customerPhone}</div>
                          )}
                        </div>
                        <CheckCircle className="w-5 h-5 text-cyan-600" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Title/Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {activeTab === 'estimates' || activeTab === 'invoices' ? 'Title *' : 'Description *'}
                  </label>
                  <Input
                    value={formData.title || formData.description || ''}
                    onChange={(e) => {
                      if (activeTab === 'estimates' || activeTab === 'invoices') {
                        setFormData({ ...formData, title: e.target.value })
                      } else {
                        setFormData({ ...formData, description: e.target.value })
                      }
                    }}
                    placeholder={`Enter ${activeTab === 'estimates' || activeTab === 'invoices' ? 'title' : 'description'}`}
                    className="rounded-xl"
                  />
                </div>

                {/* Amount/Items Field */}
                {(activeTab === 'estimates' || activeTab === 'invoices') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Subtotal *</label>
                      <Input
                        type="number"
                        value={formData.subtotal || ''}
                        onChange={(e) => {
                          const subtotal = parseFloat(e.target.value) || 0
                          const discount = parseFloat(formData.discount) || 0
                          const taxRate = parseFloat(formData.taxRate) || 0
                          const afterDiscount = subtotal - discount
                          const taxAmount = (afterDiscount * taxRate) / 100
                          const totalAmount = afterDiscount + taxAmount
                          setFormData({
                            ...formData,
                            subtotal: e.target.value,
                            taxAmount: taxAmount.toFixed(2),
                            totalAmount: totalAmount.toFixed(2)
                          })
                        }}
                        placeholder="0.00"
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Discount</label>
                      <Input
                        type="number"
                        value={formData.discount || ''}
                        onChange={(e) => {
                          const subtotal = parseFloat(formData.subtotal) || 0
                          const discount = parseFloat(e.target.value) || 0
                          const taxRate = parseFloat(formData.taxRate) || 0
                          const afterDiscount = subtotal - discount
                          const taxAmount = (afterDiscount * taxRate) / 100
                          const totalAmount = afterDiscount + taxAmount
                          setFormData({
                            ...formData,
                            discount: e.target.value,
                            taxAmount: taxAmount.toFixed(2),
                            totalAmount: totalAmount.toFixed(2)
                          })
                        }}
                        placeholder="0.00"
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tax Rate (%)</label>
                      <Input
                        type="number"
                        value={formData.taxRate || ''}
                        onChange={(e) => {
                          const subtotal = parseFloat(formData.subtotal) || 0
                          const discount = parseFloat(formData.discount) || 0
                          const taxRate = parseFloat(e.target.value) || 0
                          const afterDiscount = subtotal - discount
                          const taxAmount = (afterDiscount * taxRate) / 100
                          const totalAmount = afterDiscount + taxAmount
                          setFormData({
                            ...formData,
                            taxRate: e.target.value,
                            taxAmount: taxAmount.toFixed(2),
                            totalAmount: totalAmount.toFixed(2)
                          })
                        }}
                        placeholder="0"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-700">Total Amount</span>
                        <span className="text-2xl font-bold text-cyan-600">
                          {formatCurrency(parseFloat(formData.totalAmount) || 0)}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {(activeTab === 'subscriptions' || activeTab === 'receipts') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount {activeTab === 'receipts' ? 'Paid' : ''} *
                    </label>
                    <Input
                      type="number"
                      value={formData.amount || formData.amountPaid || ''}
                      onChange={(e) => {
                        if (activeTab === 'receipts') {
                          setFormData({ ...formData, amountPaid: e.target.value })
                        } else {
                          setFormData({ ...formData, amount: e.target.value })
                        }
                      }}
                      placeholder="0.00"
                      className="rounded-xl"
                    />
                  </div>
                )}

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                  <Select
                    value={formData.status || ''}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {getStatusOptions().map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Fields */}
                {activeTab === 'estimates' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Valid Until</label>
                    <Input
                      type="date"
                      value={formData.validUntil || ''}
                      onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                )}

                {activeTab === 'invoices' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Issue Date</label>
                      <Input
                        type="date"
                        value={formData.issueDate || ''}
                        onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                      <Input
                        type="date"
                        value={formData.dueDate || ''}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                  </>
                )}

                {activeTab === 'subscriptions' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Plan Type</label>
                      <Select
                        value={formData.planType || 'Monthly'}
                        onValueChange={(value) => setFormData({ ...formData, planType: value })}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Monthly">Monthly</SelectItem>
                          <SelectItem value="Quarterly">Quarterly</SelectItem>
                          <SelectItem value="Annually">Annually</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                      <Input
                        type="date"
                        value={formData.startDate || ''}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Next Billing Date</label>
                      <Input
                        type="date"
                        value={formData.nextBillingDate || ''}
                        onChange={(e) => setFormData({ ...formData, nextBillingDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                  </>
                )}

                {activeTab === 'receipts' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date</label>
                      <Input
                        type="date"
                        value={formData.paymentDate || ''}
                        onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                      <Select
                        value={formData.paymentMethod || ''}
                        onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                          <SelectItem value="UPI">UPI</SelectItem>
                          <SelectItem value="Credit Card">Credit Card</SelectItem>
                          <SelectItem value="Debit Card">Debit Card</SelectItem>
                          <SelectItem value="Cheque">Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment Reference</label>
                      <Input
                        value={formData.paymentReference || ''}
                        onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                        placeholder="Transaction ID or reference number"
                        className="rounded-xl"
                      />
                    </div>
                  </>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Add any additional notes"
                    rows={4}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Fixed Save Button */}
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={viewState === 'add' ? handleCreate : handleUpdate}
                  disabled={loading || !formData.customerName}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl py-4 px-6 shadow-lg flex items-center justify-center gap-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-5 h-5" />
                  {viewState === 'add' ? 'Create' : 'Update'} {activeTab.charAt(0).toUpperCase() + activeTab.slice(1, -1)}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

function EstimatesTable({ data, onView, onEdit, onDelete, onCreateInvoice, onViewPDF, loading, canUpdate, canDelete }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Estimates</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No estimates found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Estimate ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Customer</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Title</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Amount</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Valid Until</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item: any, index: number) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 font-mono text-sm font-medium">{item.estimate_id}</td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{item.customer_name}</div>
                          <div className="text-sm text-gray-500">{item.customer_email}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium">{item.title}</td>
                      <td className="py-3 px-4 font-medium">{formatCurrency(item.total_amount)}</td>
                      <td className="py-3 px-4">
                        <Badge className={statusColors[item.status]}>{item.status}</Badge>
                      </td>
                      <td className="py-3 px-4">{formatDate(item.valid_until)}</td>
                      <td className="py-3 px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(item)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onViewPDF(item)}>
                              <Download className="w-4 h-4 mr-2" />
                              View PDF
                            </DropdownMenuItem>
                            {canUpdate && item.status !== 'Invoiced' && (
                              <DropdownMenuItem onClick={() => onEdit(item)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {canUpdate && item.status !== 'Invoiced' && (
                              <DropdownMenuItem onClick={() => onCreateInvoice(item)}>
                                <FileText className="w-4 h-4 mr-2" />
                                Create Invoice
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem onClick={() => onDelete(item.id)} className="text-red-600">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
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
  )
}

function InvoicesTable({ data, onView, onEdit, onDelete, onRecordReceipt, onViewPDF, onGeneratePaymentLink, onCopyPaymentLink, loading, canUpdate, canDelete }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No invoices found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Invoice ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Customer</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Title</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Amount</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Balance Due</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Payment Link</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Due Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item: any, index: number) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 font-mono text-sm font-medium">{item.invoice_id}</td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{item.customer_name}</div>
                          <div className="text-sm text-gray-500">{item.customer_email}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium">{item.title}</td>
                      <td className="py-3 px-4 font-medium">{formatCurrency(item.total_amount)}</td>
                      <td className="py-3 px-4 font-medium text-orange-600">{formatCurrency(item.balance_due)}</td>
                      <td className="py-3 px-4">
                        <Badge className={statusColors[item.status]}>{item.status}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {item.payment_link_url ? (
                          <div className="flex items-center space-x-2">
                            <Badge className="bg-green-100 text-green-800">
                              {item.payment_gateway_used || 'Active'}
                            </Badge>
                            <button
                              onClick={() => onCopyPaymentLink(item.payment_link_url)}
                              className="text-brand-primary hover:text-brand-primary/80"
                              title="Copy payment link"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">No link</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{formatDate(item.due_date)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onViewPDF(item)}>
                              <Printer className="w-4 h-4 mr-2" />
                              View Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onView(item)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {canUpdate && !item.payment_link_url && ['Draft', 'Sent', 'Pending', 'Partially Paid'].includes(item.status) && (
                              <>
                                <DropdownMenuItem onClick={() => onGeneratePaymentLink(item)}>
                                  <Link2 className="w-4 h-4 mr-2" />
                                  Generate Payment Link
                                </DropdownMenuItem>
                              </>
                            )}
                            {item.payment_link_url && (
                              <DropdownMenuItem onClick={() => onCopyPaymentLink(item.payment_link_url)}>
                                <Copy className="w-4 h-4 mr-2" />
                                Copy Payment Link
                              </DropdownMenuItem>
                            )}
                            {canUpdate && (
                              <DropdownMenuItem onClick={() => onEdit(item)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {canUpdate && (
                              <DropdownMenuItem onClick={() => onRecordReceipt(item)}>
                                <Receipt className="w-4 h-4 mr-2" />
                                Record Receipt
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem onClick={() => onDelete(item.id)} className="text-red-600">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
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
  )
}

function SubscriptionsTable({ data, onView, onEdit, onDelete, loading, canUpdate, canDelete }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No subscriptions found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Subscription ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Customer</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Plan</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Amount</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Next Billing</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item: any, index: number) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 font-mono text-sm font-medium">{item.subscription_id}</td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{item.customer_name}</div>
                          <div className="text-sm text-gray-500">{item.customer_email}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{item.plan_name}</div>
                          <Badge variant="outline" className="mt-1">{item.plan_type}</Badge>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium">{formatCurrency(item.amount)}</td>
                      <td className="py-3 px-4">
                        <Badge className={statusColors[item.status]}>{item.status}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {item.next_billing_date ? (
                          <div>
                            <div className="font-medium">{formatDate(item.next_billing_date)}</div>
                            <div className="text-sm text-gray-500">Started: {formatDate(item.start_date)}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(item)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            {canUpdate && (
                              <DropdownMenuItem onClick={() => onEdit(item)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem onClick={() => onDelete(item.id)} className="text-red-600 focus:text-red-600">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Cancel
                              </DropdownMenuItem>
                            )}
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
  )
}

function ReceiptsTable({ data, onView, onEdit, onDelete, loading, canUpdate, canDelete }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Receipts</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No receipts found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Receipt ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Customer</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Description</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Amount Paid</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Payment Method</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Payment Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item: any, index: number) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 font-mono text-sm font-medium">{item.receipt_id}</td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{item.customer_name}</div>
                          <div className="text-sm text-gray-500">{item.customer_email}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium">{item.description}</td>
                      <td className="py-3 px-4 font-medium text-green-600">{formatCurrency(item.amount_paid)}</td>
                      <td className="py-3 px-4">
                        <div>
                          <Badge variant="outline">{item.payment_method}</Badge>
                          <div className="text-xs text-gray-500 mt-1">{item.payment_reference}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium">{formatDate(item.payment_date)}</td>
                      <td className="py-3 px-4">
                        <Badge className={statusColors[item.status]}>{item.status}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(item)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onView(item)}>
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            {canUpdate && (
                              <DropdownMenuItem onClick={() => onEdit(item)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem onClick={() => onDelete(item.id)} className="text-red-600 focus:text-red-600">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
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
  )
}

function FormModal({ title, formData, setFormData, onSave, onCancel, type, loading, contacts, products, packages }: any) {
  const [contactSearchTerm, setContactSearchTerm] = useState('')
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [packageSearchTerm, setPackageSearchTerm] = useState('')
  const [showPackageDropdown, setShowPackageDropdown] = useState(false)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.package-search-container')) {
        setShowPackageDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
  }

  const handleContactSelect = (contact: any) => {
    setFormData((prev: any) => ({
      ...prev,
      customerName: contact.full_name,
      customerEmail: contact.email || '',
      customerPhone: contact.phone || ''
    }))
    setContactSearchTerm(contact.full_name)
    setShowContactDropdown(false)
  }

  const handleProductSelect = (product: any, isPreformatted = false) => {
    let newItem

    if (isPreformatted) {
      newItem = product
    } else {
      const price = product.product_price || 0
      newItem = {
        id: Date.now() + Math.random(),
        product_id: product.product_id,
        product_name: product.product_name,
        description: product.description,
        quantity: 1,
        unit_price: price,
        total: price
      }
    }

    const items = formData.items || []
    setFormData((prev: any) => ({
      ...prev,
      items: [...items, newItem]
    }))

    if (!isPreformatted) {
      setProductSearchTerm('')
      setShowProductDropdown(false)
    }

    calculateTotalsFromItems([...items, newItem])
  }

  const handlePackageSelect = (packageProducts: any[]) => {
    const items = formData.items || []
    const newItems = packageProducts.map((product: any, index: number) => ({
      id: Date.now() + Math.random() + index,
      product_id: product.product_id,
      product_name: product.product_name,
      description: product.description || '',
      quantity: product.quantity || 1,
      unit_price: product.unit_price || 0,
      total: (product.quantity || 1) * (product.unit_price || 0)
    }))

    const allItems = [...items, ...newItems]
    setFormData((prev: any) => ({
      ...prev,
      items: allItems
    }))

    calculateTotalsFromItems(allItems)
  }

  const handleRemoveItem = (itemId: number) => {
    const items = (formData.items || []).filter((item: any) => item.id !== itemId)
    setFormData((prev: any) => ({
      ...prev,
      items
    }))
    calculateTotalsFromItems(items)
  }

  const handleUpdateItemQuantity = (itemId: number, quantity: number) => {
    const items = (formData.items || []).map((item: any) =>
      item.id === itemId
        ? { ...item, quantity, total: item.unit_price * quantity }
        : item
    )
    setFormData((prev: any) => ({
      ...prev,
      items
    }))
    calculateTotalsFromItems(items)
  }

  const handleUpdateItemPrice = (itemId: number, price: number) => {
    const items = (formData.items || []).map((item: any) =>
      item.id === itemId
        ? { ...item, unit_price: price, total: price * item.quantity }
        : item
    )
    setFormData((prev: any) => ({
      ...prev,
      items
    }))
    calculateTotalsFromItems(items)
  }

  const calculateTotalsFromItems = (items: any[], discountValue?: string | number, taxRateValue?: string | number) => {
    const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0)
    const discount = parseFloat(String(discountValue ?? formData.discount)) || 0
    const taxRate = parseFloat(String(taxRateValue ?? formData.taxRate)) || 0
    const taxAmount = ((subtotal - discount) * taxRate) / 100
    const totalAmount = subtotal - discount + taxAmount

    setFormData((prev: any) => ({
      ...prev,
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100
    }))
  }

  const calculateTotals = (discountValue?: string | number, taxRateValue?: string | number) => {
    calculateTotalsFromItems(formData.items || [], discountValue, taxRateValue)
  }

  const filteredContacts = contacts?.filter((contact: any) =>
    contact.full_name?.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
    contact.phone?.includes(contactSearchTerm)
  ) || []

  const filteredProducts = products?.filter((product: any) =>
    product.product_name?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    product.product_id?.toLowerCase().includes(productSearchTerm.toLowerCase())
  ) || []

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{title}</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Fill in the details below</p>
            </div>
            <Button variant="outline" onClick={onCancel} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to List
            </Button>
          </div>
        </CardHeader>
        <CardContent>

        <div className="space-y-4">
          {(type === 'estimates' || type === 'invoices') && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name *</label>
                  <Input
                    value={contactSearchTerm || formData.customerName || ''}
                    onChange={(e) => {
                      setContactSearchTerm(e.target.value)
                      updateField('customerName', e.target.value)
                      setShowContactDropdown(true)
                    }}
                    onFocus={() => setShowContactDropdown(true)}
                    placeholder="Search customer by name, email, or phone"
                  />
                  {showContactDropdown && filteredContacts.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredContacts.map((contact: any) => (
                        <div
                          key={contact.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleContactSelect(contact)}
                        >
                          <div className="font-medium">{contact.full_name}</div>
                          <div className="text-sm text-gray-500">{contact.email || contact.phone}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Email *</label>
                  <Input value={formData.customerEmail || ''} onChange={(e) => updateField('customerEmail', e.target.value)} placeholder="Enter customer email" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Customer Phone</label>
                <Input value={formData.customerPhone || ''} onChange={(e) => updateField('customerPhone', e.target.value)} placeholder="Enter customer phone" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                <Input value={formData.title || ''} onChange={(e) => updateField('title', e.target.value)} placeholder="Enter title" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quick Add Package</label>
                <div className="relative package-search-container">
                  <Input
                    value={packageSearchTerm}
                    onChange={(e) => {
                      setPackageSearchTerm(e.target.value)
                      setShowPackageDropdown(true)
                    }}
                    onFocus={() => setShowPackageDropdown(true)}
                    placeholder="Search and add package (optional)"
                  />
                  {showPackageDropdown && packages.filter(pkg =>
                    pkg.package_name?.toLowerCase().includes(packageSearchTerm.toLowerCase()) ||
                    pkg.package_id?.toLowerCase().includes(packageSearchTerm.toLowerCase())
                  ).length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {packages.filter(pkg =>
                        pkg.package_name?.toLowerCase().includes(packageSearchTerm.toLowerCase()) ||
                        pkg.package_id?.toLowerCase().includes(packageSearchTerm.toLowerCase())
                      ).map((pkg: any) => (
                        <div
                          key={pkg.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => {
                            if (Array.isArray(pkg.products) && pkg.products.length > 0) {
                              handlePackageSelect(pkg.products)
                            }
                            setPackageSearchTerm('')
                            setShowPackageDropdown(false)
                          }}
                        >
                          <div className="font-medium">{pkg.package_name}</div>
                          <div className="text-sm text-gray-500">
                            {pkg.package_id} • {Array.isArray(pkg.products) ? pkg.products.length : 0} products • {formatCurrency(pkg.discounted_price || 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Select a package to add all its products at once</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Products *</label>
                <div className="relative">
                  <Input
                    value={productSearchTerm}
                    onChange={(e) => {
                      setProductSearchTerm(e.target.value)
                      setShowProductDropdown(true)
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    placeholder="Search and add products"
                  />
                  {showProductDropdown && filteredProducts.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredProducts.map((product: any) => (
                        <div
                          key={product.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleProductSelect(product)}
                        >
                          <div className="font-medium">{product.product_name}</div>
                          <div className="text-sm text-gray-500">
                            {product.product_id} • {formatCurrency(product.product_price || 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {(formData.items || []).length > 0 && (
                  <div className="mt-3 space-y-2">
                    {(formData.items || []).map((item: any) => (
                      <div key={item.id} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-medium">{item.product_name}</div>
                            <div className="text-xs text-gray-500">{item.product_id}</div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-gray-600">Quantity</label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItemQuantity(item.id, parseFloat(e.target.value) || 1)}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600">Unit Price</label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => handleUpdateItemPrice(item.id, parseFloat(e.target.value) || 0)}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600">Total</label>
                            <Input
                              type="number"
                              value={item.total.toFixed(2)}
                              readOnly
                              className="h-8 bg-gray-100"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subtotal</label>
                  <Input type="number" value={formData.subtotal || 0} readOnly className="bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount</label>
                  <Input type="number" value={formData.discount || ''} onChange={(e) => { updateField('discount', e.target.value); calculateTotals(e.target.value, undefined); }} placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tax Rate (%)</label>
                  <Input type="number" value={formData.taxRate || ''} onChange={(e) => { updateField('taxRate', e.target.value); calculateTotals(undefined, e.target.value); }} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tax Amount</label>
                  <Input type="number" value={formData.taxAmount || 0} readOnly className="bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Amount</label>
                  <Input type="number" value={formData.totalAmount || 0} readOnly className="bg-gray-50" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <Input value={formData.notes || ''} onChange={(e) => updateField('notes', e.target.value)} placeholder="Additional notes" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                  <Select value={formData.status} onValueChange={(value) => updateField('status', value)}>
                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      {type === 'estimates' ? (
                        <>
                          <SelectItem value="Draft">Draft</SelectItem>
                          <SelectItem value="Sent">Sent</SelectItem>
                          <SelectItem value="Accepted">Accepted</SelectItem>
                          <SelectItem value="Rejected">Rejected</SelectItem>
                          <SelectItem value="Expired">Expired</SelectItem>
                          <SelectItem value="Invoiced">Invoiced</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="Draft">Draft</SelectItem>
                          <SelectItem value="Sent">Sent</SelectItem>
                          <SelectItem value="Paid">Paid</SelectItem>
                          <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                          <SelectItem value="Overdue">Overdue</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {type === 'estimates' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Valid Until *</label>
                    <Input type="date" value={formData.validUntil || ''} onChange={(e) => updateField('validUntil', e.target.value)} />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                    <Select value={formData.paymentMethod} onValueChange={(value) => updateField('paymentMethod', value)}>
                      <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="Credit Card">Credit Card</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {type === 'invoices' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Terms</label>
                    <Input value={formData.terms || ''} onChange={(e) => updateField('terms', e.target.value)} placeholder="Payment terms" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Issue Date *</label>
                      <Input type="date" value={formData.issueDate || ''} onChange={(e) => updateField('issueDate', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Due Date *</label>
                      <Input type="date" value={formData.dueDate || ''} onChange={(e) => updateField('dueDate', e.target.value)} />
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {type === 'subscriptions' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name *</label>
                  <Input value={formData.customerName || ''} onChange={(e) => updateField('customerName', e.target.value)} placeholder="Enter customer name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Email *</label>
                  <Input value={formData.customerEmail || ''} onChange={(e) => updateField('customerEmail', e.target.value)} placeholder="Enter customer email" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Customer Phone</label>
                <Input value={formData.customerPhone || ''} onChange={(e) => updateField('customerPhone', e.target.value)} placeholder="Enter customer phone" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Plan Name *</label>
                  <Input value={formData.planName || ''} onChange={(e) => updateField('planName', e.target.value)} placeholder="Enter plan name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Plan Type *</label>
                  <Select value={formData.planType} onValueChange={(value) => updateField('planType', value)}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Quarterly">Quarterly</SelectItem>
                      <SelectItem value="Yearly">Yearly</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
                  <Input type="number" value={formData.amount || ''} onChange={(e) => updateField('amount', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                  <Select value={formData.paymentMethod} onValueChange={(value) => updateField('paymentMethod', value)}>
                    <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Credit Card">Credit Card</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Next Billing Date</label>
                <Input type="date" value={formData.nextBillingDate || ''} onChange={(e) => updateField('nextBillingDate', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                  <Select value={formData.status} onValueChange={(value) => updateField('status', value)}>
                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Paused">Paused</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Auto Renew</label>
                  <Select value={formData.autoRenew ? 'true' : 'false'} onValueChange={(value) => updateField('autoRenew', value === 'true')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <Input value={formData.notes || ''} onChange={(e) => updateField('notes', e.target.value)} placeholder="Additional notes" />
              </div>
            </>
          )}

          {type === 'receipts' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name *</label>
                  <Input value={formData.customerName || ''} onChange={(e) => updateField('customerName', e.target.value)} placeholder="Enter customer name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Email *</label>
                  <Input value={formData.customerEmail || ''} onChange={(e) => updateField('customerEmail', e.target.value)} placeholder="Enter customer email" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                <Input value={formData.description || ''} onChange={(e) => updateField('description', e.target.value)} placeholder="Payment description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount Paid *</label>
                  <Input type="number" value={formData.amountPaid || ''} onChange={(e) => updateField('amountPaid', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date *</label>
                  <Input type="date" value={formData.paymentDate || ''} onChange={(e) => updateField('paymentDate', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
                  <Select value={formData.paymentMethod} onValueChange={(value) => updateField('paymentMethod', value)}>
                    <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Credit Card">Credit Card</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Reference</label>
                  <Input value={formData.paymentReference || ''} onChange={(e) => updateField('paymentReference', e.target.value)} placeholder="Transaction ID" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                  <Select value={formData.status} onValueChange={(value) => updateField('status', value)}>
                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Failed">Failed</SelectItem>
                      <SelectItem value="Refunded">Refunded</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <Input value={formData.notes || ''} onChange={(e) => updateField('notes', e.target.value)} placeholder="Additional notes" />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center space-x-3 mt-6 pt-6 border-t border-gray-200">
          <Button onClick={onSave} disabled={loading}>
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function ViewModal({ item, type, onClose, onEdit, canUpdate }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">View Details</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                {type.charAt(0).toUpperCase() + type.slice(1, -1)} Information
              </p>
            </div>
            <Button variant="outline" onClick={onClose} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to List
            </Button>
          </div>
        </CardHeader>
        <CardContent>

        <div className="space-y-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">ID</div>
                <div className="font-medium">
                  {type === 'estimates' ? item.estimate_id :
                   type === 'invoices' ? item.invoice_id :
                   type === 'subscriptions' ? item.subscription_id : item.receipt_id}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Status</div>
                <Badge className={statusColors[item.status]}>{item.status}</Badge>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-brand-text mb-3">Customer Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Name</div>
                <div className="font-medium">{item.customer_name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Email</div>
                <div className="font-medium">{item.customer_email}</div>
              </div>
              {item.customer_phone && (
                <div>
                  <div className="text-sm text-gray-600">Phone</div>
                  <div className="font-medium">{item.customer_phone}</div>
                </div>
              )}
            </div>
          </div>

          {(type === 'estimates' || type === 'invoices') && (
            <>
              {item.items && item.items.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-brand-text mb-3">Products/Services</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Product</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Qty</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Unit Price</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.items.map((productItem: any, idx: number) => (
                          <tr key={idx} className="border-t border-gray-200">
                            <td className="py-3 px-4">
                              <div>
                                <div className="font-medium">{productItem.product_name || productItem.description}</div>
                                {productItem.description && productItem.product_name && (
                                  <div className="text-sm text-gray-600">{productItem.description}</div>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">{productItem.quantity}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(productItem.unit_price || productItem.rate || productItem.price || 0)}</td>
                            <td className="py-3 px-4 text-right font-medium">{formatCurrency(productItem.total || (productItem.quantity * (productItem.unit_price || productItem.rate || productItem.price || 0)))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-lg font-semibold text-brand-text mb-3">Financial Summary</h4>
                <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span className="font-medium">{formatCurrency(item.discount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax ({item.tax_rate}%):</span>
                    <span className="font-medium">{formatCurrency(item.tax_amount)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-brand-primary">{formatCurrency(item.total_amount)}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {type === 'subscriptions' && (
            <div>
              <h4 className="text-lg font-semibold text-brand-text mb-3">Subscription Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Plan Name</div>
                  <div className="font-medium">{item.plan_name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Plan Type</div>
                  <div className="font-medium">{item.plan_type}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Amount</div>
                  <div className="font-medium">{formatCurrency(item.amount)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Next Billing</div>
                  <div className="font-medium">{item.next_billing_date ? formatDate(item.next_billing_date) : '-'}</div>
                </div>
              </div>
            </div>
          )}

          {type === 'receipts' && (
            <div>
              <h4 className="text-lg font-semibold text-brand-text mb-3">Payment Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Amount Paid</div>
                  <div className="font-medium text-green-600">{formatCurrency(item.amount_paid)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Payment Method</div>
                  <div className="font-medium">{item.payment_method}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Payment Date</div>
                  <div className="font-medium">{formatDate(item.payment_date)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Reference</div>
                  <div className="font-medium">{item.payment_reference || '-'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3 mt-6 pt-6 border-t border-gray-200">
          {canUpdate && (
            <Button onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
