import React, { useState, useEffect } from 'react'
import { BaseWidget } from '../BaseWidget'
import { Widget } from '@/types/dashboard'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { ArrowUpDown, ExternalLink } from 'lucide-react'

interface TableWidgetProps {
  widget: Widget
  onRefresh?: () => void
  onRemove?: () => void
  onConfig?: () => void
}

export function TableWidget({ widget, onRefresh, onRemove, onConfig }: TableWidgetProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any[]>([])
  const [columns, setColumns] = useState<Array<{ key: string; label: string; format?: string }>>([])

  useEffect(() => {
    fetchData()
  }, [widget.config])

  const fetchData = async () => {
    setLoading(true)
    try {
      const tableData = await getTableData(widget.module)
      setData(tableData.rows)
      setColumns(tableData.columns)
    } catch (error) {
      console.error('Error fetching table data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTableData = async (module: string) => {
    const limit = widget.config.limit || 10

    switch (module) {
      case 'billing':
        return await getBillingTableData(limit)
      case 'leads':
        return await getLeadsTableData(limit)
      case 'support':
        return await getSupportTableData(limit)
      case 'tasks':
        return await getTasksTableData(limit)
      case 'expenses':
        return await getExpensesTableData(limit)
      case 'members':
        return await getMembersTableData(limit)
      default:
        return { rows: [], columns: [] }
    }
  }

  const getBillingTableData = async (limit: number) => {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('invoice_number, contact_id, amount, status, due_date, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    const columns = [
      { key: 'invoice_number', label: 'Invoice #' },
      { key: 'contact_id', label: 'Contact' },
      { key: 'amount', label: 'Amount', format: 'currency' },
      { key: 'status', label: 'Status', format: 'badge' },
      { key: 'due_date', label: 'Due Date', format: 'date' }
    ]

    return { rows: invoices || [], columns }
  }

  const getLeadsTableData = async (limit: number) => {
    const { data: leads } = await supabase
      .from('leads')
      .select('lead_id, name, phone, email, stage, priority, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    const columns = [
      { key: 'lead_id', label: 'Lead ID' },
      { key: 'name', label: 'Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'stage', label: 'Stage', format: 'badge' },
      { key: 'priority', label: 'Priority', format: 'badge' },
      { key: 'created_at', label: 'Created', format: 'date' }
    ]

    return { rows: leads || [], columns }
  }

  const getSupportTableData = async (limit: number) => {
    const { data: tickets } = await supabase
      .from('support_tickets')
      .select('ticket_id, subject, status, priority, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    const columns = [
      { key: 'ticket_id', label: 'Ticket ID' },
      { key: 'subject', label: 'Subject' },
      { key: 'status', label: 'Status', format: 'badge' },
      { key: 'priority', label: 'Priority', format: 'badge' },
      { key: 'created_at', label: 'Created', format: 'date' }
    ]

    return { rows: tickets || [], columns }
  }

  const getTasksTableData = async (limit: number) => {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('task_id, title, status, priority, due_date, assigned_to_name')
      .order('created_at', { ascending: false })
      .limit(limit)

    const columns = [
      { key: 'task_id', label: 'Task ID' },
      { key: 'title', label: 'Title' },
      { key: 'assigned_to_name', label: 'Assigned To' },
      { key: 'status', label: 'Status', format: 'badge' },
      { key: 'priority', label: 'Priority', format: 'badge' },
      { key: 'due_date', label: 'Due Date', format: 'date' }
    ]

    return { rows: tasks || [], columns }
  }

  const getExpensesTableData = async (limit: number) => {
    const { data: expenses } = await supabase
      .from('expenses')
      .select('id, description, amount, category, status, expense_date')
      .order('expense_date', { ascending: false })
      .limit(limit)

    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'description', label: 'Description' },
      { key: 'category', label: 'Category' },
      { key: 'amount', label: 'Amount', format: 'currency' },
      { key: 'status', label: 'Status', format: 'badge' },
      { key: 'expense_date', label: 'Date', format: 'date' }
    ]

    return { rows: expenses || [], columns }
  }

  const getMembersTableData = async (limit: number) => {
    const { data: members } = await supabase
      .from('enrolled_members')
      .select('id, name, email, phone, status, enrollment_date')
      .order('enrollment_date', { ascending: false })
      .limit(limit)

    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status', format: 'badge' },
      { key: 'enrollment_date', label: 'Enrolled', format: 'date' }
    ]

    return { rows: members || [], columns }
  }

  const formatCellValue = (value: any, format?: string) => {
    if (value === null || value === undefined) return '-'

    switch (format) {
      case 'currency':
        return formatCurrency(value)
      case 'date':
        try {
          return format(new Date(value), 'MMM dd, yyyy')
        } catch {
          return value
        }
      case 'badge':
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBadgeColor(value)}`}>
            {value}
          </span>
        )
      default:
        return value
    }
  }

  const getBadgeColor = (status: string) => {
    const statusLower = status?.toLowerCase() || ''

    if (statusLower === 'paid' || statusLower === 'completed' || statusLower === 'active' || statusLower === 'resolved' || statusLower === 'approved') {
      return 'bg-green-100 text-green-800'
    }
    if (statusLower === 'pending' || statusLower === 'in progress' || statusLower === 'processing') {
      return 'bg-yellow-100 text-yellow-800'
    }
    if (statusLower === 'overdue' || statusLower === 'rejected' || statusLower === 'cancelled' || statusLower === 'closed') {
      return 'bg-red-100 text-red-800'
    }
    if (statusLower === 'hot' || statusLower === 'high' || statusLower === 'urgent') {
      return 'bg-orange-100 text-orange-800'
    }
    if (statusLower === 'cold' || statusLower === 'low') {
      return 'bg-blue-100 text-blue-800'
    }
    if (statusLower === 'warm' || statusLower === 'medium') {
      return 'bg-purple-100 text-purple-800'
    }
    return 'bg-gray-100 text-gray-800'
  }

  const handleRefresh = () => {
    fetchData()
    onRefresh?.()
  }

  return (
    <BaseWidget
      title={widget.title}
      onRefresh={handleRefresh}
      onRemove={onRemove}
      onConfig={onConfig}
      isLoading={loading}
      colorScheme={widget.config.colorScheme}
    >
      <div className="h-full overflow-auto">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-50 transition-colors">
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-3 text-gray-900">
                        {formatCellValue(row[column.key], column.format)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </BaseWidget>
  )
}
