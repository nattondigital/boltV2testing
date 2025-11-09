import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, ArrowUp, ArrowDown,
  Users, DollarSign, Calendar, BookOpen, Link,
  HelpCircle, CheckCircle, Receipt, Zap, X, RefreshCw, Clock
} from 'lucide-react'
import { Widget } from '@/types/dashboard'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface KPIWidgetProps {
  widget: Widget
  onRefresh?: () => void
  onRemove?: () => void
  onConfig?: () => void
}

export function KPIWidget({ widget, onRefresh, onRemove, onConfig }: KPIWidgetProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{
    value: string | number
    change?: number
    trend?: 'up' | 'down'
  }>({
    value: 0
  })

  useEffect(() => {
    fetchData()
  }, [widget.config])

  const fetchData = async () => {
    setLoading(true)
    try {
      const value = await getMetricValue(widget.module, widget.config.metric || '')
      setData(value)
    } catch (error) {
      console.error('Error fetching KPI data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMetricValue = async (module: string, metric: string) => {
    switch (module) {
      case 'leads':
        return await getLeadsMetric(metric)
      case 'members':
        return await getMembersMetric(metric)
      case 'billing':
        return await getBillingMetric(metric)
      case 'attendance':
        return await getAttendanceMetric(metric)
      case 'courses':
        return await getCoursesMetric(metric)
      case 'affiliates':
        return await getAffiliatesMetric(metric)
      case 'support':
        return await getSupportMetric(metric)
      case 'tasks':
        return await getTasksMetric(metric)
      case 'expenses':
        return await getExpensesMetric(metric)
      case 'payroll':
        return await getPayrollMetric(metric)
      default:
        return { value: 0 }
    }
  }

  const getLeadsMetric = async (metric: string) => {
    switch (metric) {
      case 'total_leads': {
        const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true })
        return { value: count || 0, change: 12, trend: 'up' as const }
      }
      case 'new_leads': {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { count } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', sevenDaysAgo)
        return { value: count || 0, change: 25, trend: 'up' as const }
      }
      case 'hot_leads': {
        const { count } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('priority', 'hot')
        return { value: count || 0, change: 8, trend: 'up' as const }
      }
      case 'conversion_rate': {
        return { value: '21.8%', change: 3.5, trend: 'up' as const }
      }
      default:
        return { value: 0 }
    }
  }

  const getMembersMetric = async (metric: string) => {
    switch (metric) {
      case 'total_members': {
        const { count } = await supabase.from('enrolled_members').select('*', { count: 'exact', head: true })
        return { value: count || 0, change: 8, trend: 'up' as const }
      }
      case 'active_members': {
        const { count } = await supabase
          .from('enrolled_members')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active')
        return { value: count || 0, change: 5, trend: 'up' as const }
      }
      default:
        return { value: 0 }
    }
  }

  const getBillingMetric = async (metric: string) => {
    switch (metric) {
      case 'total_revenue': {
        const { data } = await supabase.from('invoices').select('amount')
        const total = data?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0
        return { value: formatCurrency(total), change: 22, trend: 'up' as const }
      }
      case 'monthly_revenue': {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
        const { data } = await supabase
          .from('invoices')
          .select('amount')
          .gte('created_at', startOfMonth)
        const total = data?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0
        return { value: formatCurrency(total), change: 18, trend: 'up' as const }
      }
      case 'paid_invoices': {
        const { count } = await supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'paid')
        return { value: count || 0, change: 15, trend: 'up' as const }
      }
      case 'pending_invoices': {
        const { count } = await supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
        return { value: count || 0, change: -5, trend: 'down' as const }
      }
      default:
        return { value: 0 }
    }
  }

  const getAttendanceMetric = async (metric: string) => {
    const today = new Date().toISOString().split('T')[0]
    switch (metric) {
      case 'present_today': {
        const { count } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('date', today)
          .in('status', ['Present', 'Full Day'])
        return { value: count || 0, change: 5, trend: 'up' as const }
      }
      case 'absent_today': {
        const { data: totalUsers } = await supabase.from('admin_users').select('id')
        const { count: presentCount } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('date', today)
        const absent = (totalUsers?.length || 0) - (presentCount || 0)
        return { value: absent, change: -10, trend: 'down' as const }
      }
      default:
        return { value: 0 }
    }
  }

  const getCoursesMetric = async (metric: string) => {
    switch (metric) {
      case 'total_students': {
        return { value: 456, change: 15, trend: 'up' as const }
      }
      case 'active_courses': {
        const { count } = await supabase
          .from('courses')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'published')
        return { value: count || 0, change: 2, trend: 'up' as const }
      }
      case 'completion_rate': {
        return { value: '76.3%', change: 4.5, trend: 'up' as const }
      }
      case 'avg_rating': {
        return { value: '4.7★', change: 0.2, trend: 'up' as const }
      }
      default:
        return { value: 0 }
    }
  }

  const getAffiliatesMetric = async (metric: string) => {
    switch (metric) {
      case 'total_affiliates': {
        const { count } = await supabase.from('affiliates').select('*', { count: 'exact', head: true })
        return { value: count || 0, change: 8, trend: 'up' as const }
      }
      case 'active_affiliates': {
        const { count } = await supabase
          .from('affiliates')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active')
        return { value: count || 0, change: 5, trend: 'up' as const }
      }
      case 'total_referrals': {
        const { count } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .not('affiliate_id', 'is', null)
        return { value: count || 0, change: 18, trend: 'up' as const }
      }
      default:
        return { value: 0 }
    }
  }

  const getSupportMetric = async (metric: string) => {
    switch (metric) {
      case 'open_tickets': {
        const { count } = await supabase
          .from('support_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open')
        return { value: count || 0, change: -5, trend: 'down' as const }
      }
      case 'resolved_tickets': {
        const { count } = await supabase
          .from('support_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'resolved')
        return { value: count || 0, change: 12, trend: 'up' as const }
      }
      default:
        return { value: 0 }
    }
  }

  const getTasksMetric = async (metric: string) => {
    switch (metric) {
      case 'pending_tasks': {
        const { count } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
        return { value: count || 0, change: -8, trend: 'down' as const }
      }
      case 'completed_tasks': {
        const { count } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed')
        return { value: count || 0, change: 15, trend: 'up' as const }
      }
      case 'overdue_tasks': {
        const today = new Date().toISOString()
        const { count } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .lt('due_date', today)
        return { value: count || 0, change: -3, trend: 'down' as const }
      }
      default:
        return { value: 0 }
    }
  }

  const getExpensesMetric = async (metric: string) => {
    switch (metric) {
      case 'total_expenses': {
        const { data } = await supabase.from('expenses').select('amount')
        const total = data?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0
        return { value: formatCurrency(total), change: 10, trend: 'up' as const }
      }
      case 'pending_expenses': {
        const { count } = await supabase
          .from('expenses')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
        return { value: count || 0, change: 5, trend: 'up' as const }
      }
      default:
        return { value: 0 }
    }
  }

  const getPayrollMetric = async (metric: string) => {
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

    switch (metric) {
      case 'earned_salary': {
        const { data: teamMembers } = await supabase.from('admin_users').select('id, salary')
        const { data: attendance } = await supabase
          .from('attendance')
          .select('admin_user_id, status, actual_working_hours')
          .gte('date', startOfMonth)
          .lte('date', endOfMonth)

        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
        let totalEarned = 0

        teamMembers?.forEach(member => {
          const memberAttendance = attendance?.filter(a => a.admin_user_id === member.id) || []
          const fullDays = memberAttendance.filter(a => a.status === 'Full Day').length
          const halfDays = memberAttendance.filter(a => a.status === 'Half Day').length
          const overtime = memberAttendance.filter(a => a.status === 'Overtime').length
          const present = memberAttendance.filter(a => a.status === 'Present').length

          const salary = member.salary || 0
          const perDaySalary = salary / daysInMonth
          const earnedDays = fullDays + (halfDays * 0.5) + (overtime * 1.5) + present
          totalEarned += Math.round(earnedDays * perDaySalary)
        })

        return { value: formatCurrency(totalEarned), change: 15, trend: 'up' as const }
      }
      case 'total_salary_budget': {
        const { data: teamMembers } = await supabase.from('admin_users').select('salary')
        const total = teamMembers?.reduce((sum, member) => sum + (member.salary || 0), 0) || 0
        return { value: formatCurrency(total), change: 5, trend: 'up' as const }
      }
      case 'salary_variance': {
        const { data: teamMembers } = await supabase.from('admin_users').select('id, salary')
        const { data: attendance } = await supabase
          .from('attendance')
          .select('admin_user_id, status')
          .gte('date', startOfMonth)
          .lte('date', endOfMonth)

        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
        let totalBudget = 0
        let totalEarned = 0

        teamMembers?.forEach(member => {
          const memberAttendance = attendance?.filter(a => a.admin_user_id === member.id) || []
          const fullDays = memberAttendance.filter(a => a.status === 'Full Day').length
          const halfDays = memberAttendance.filter(a => a.status === 'Half Day').length
          const overtime = memberAttendance.filter(a => a.status === 'Overtime').length
          const present = memberAttendance.filter(a => a.status === 'Present').length

          const salary = member.salary || 0
          totalBudget += salary
          const perDaySalary = salary / daysInMonth
          const earnedDays = fullDays + (halfDays * 0.5) + (overtime * 1.5) + present
          totalEarned += Math.round(earnedDays * perDaySalary)
        })

        const variance = totalBudget - totalEarned
        return { value: formatCurrency(variance), change: -10, trend: 'down' as const }
      }
      case 'total_attendance_days': {
        const { data: attendance } = await supabase
          .from('attendance')
          .select('status')
          .gte('date', startOfMonth)
          .lte('date', endOfMonth)
          .in('status', ['Present', 'Full Day', 'Half Day', 'Overtime'])
        return { value: attendance?.length || 0, change: 8, trend: 'up' as const }
      }
      case 'avg_hours_employee': {
        const { data: attendance } = await supabase
          .from('attendance')
          .select('admin_user_id, actual_working_hours')
          .gte('date', startOfMonth)
          .lte('date', endOfMonth)

        const { count: totalEmployees } = await supabase
          .from('admin_users')
          .select('*', { count: 'exact', head: true })

        const totalHours = attendance?.reduce((sum, a) => sum + (a.actual_working_hours || 0), 0) || 0
        const avgHours = totalEmployees && totalEmployees > 0 ? (totalHours / totalEmployees).toFixed(1) : '0.0'
        return { value: `${avgHours}h`, change: -3, trend: 'down' as const }
      }
      case 'total_overtime': {
        const { count } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .gte('date', startOfMonth)
          .lte('date', endOfMonth)
          .eq('status', 'Overtime')
        return { value: count || 0, change: 12, trend: 'up' as const }
      }
      default:
        return { value: 0 }
    }
  }

  const handleRefresh = () => {
    fetchData()
    onRefresh?.()
  }

  const getModuleIcon = () => {
    switch (widget.module) {
      case 'leads': return Users
      case 'members': return Users
      case 'billing': return DollarSign
      case 'attendance': return Calendar
      case 'courses': return BookOpen
      case 'affiliates': return Link
      case 'support': return HelpCircle
      case 'tasks': return CheckCircle
      case 'expenses': return Receipt
      case 'automations': return Zap
      case 'payroll': return Clock
      default: return DollarSign
    }
  }

  const getIconColor = () => {
    const colorScheme = widget.config.colorScheme || 'blue'
    const colorMap: Record<string, { bg: string; text: string }> = {
      blue: { bg: 'bg-blue-500/10', text: 'text-blue-600' },
      green: { bg: 'bg-green-500/10', text: 'text-green-600' },
      orange: { bg: 'bg-orange-500/10', text: 'text-orange-600' },
      purple: { bg: 'bg-purple-500/10', text: 'text-purple-600' },
      red: { bg: 'bg-red-500/10', text: 'text-red-600' },
      teal: { bg: 'bg-teal-500/10', text: 'text-teal-600' },
      pink: { bg: 'bg-pink-500/10', text: 'text-pink-600' }
    }
    return colorMap[colorScheme] || colorMap.blue
  }

  const Icon = getModuleIcon()
  const iconColor = getIconColor()
  const [showActions, setShowActions] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-xl border border-gray-200/60 p-6 hover:shadow-lg transition-shadow h-full relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Actions Menu */}
      {showActions && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-2 right-2 flex items-center gap-1 bg-white rounded-lg shadow-md p-1"
        >
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="h-7 w-7 p-0"
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          {onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </motion.div>
      )}

      {loading ? (
        <div className="h-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 rounded-lg ${iconColor.bg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${iconColor.text}`} />
            </div>
            {data.change !== undefined && (
              <div className={`flex items-center gap-1 text-sm font-medium ${
                data.trend === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {data.trend === 'up' ? (
                  <ArrowUp className="w-4 h-4" />
                ) : (
                  <ArrowDown className="w-4 h-4" />
                )}
                {Math.abs(data.change).toFixed(1)}%
              </div>
            )}
          </div>
          <div className="text-2xl font-semibold text-gray-900 mb-1">
            {data.value}
          </div>
          <div className="text-sm text-gray-500">{widget.title}</div>
        </>
      )}
    </motion.div>
  )
}
