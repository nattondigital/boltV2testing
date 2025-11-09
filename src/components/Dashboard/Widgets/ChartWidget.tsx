import React, { useState, useEffect } from 'react'
import { BaseWidget } from '../BaseWidget'
import { Widget } from '@/types/dashboard'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

interface ChartWidgetProps {
  widget: Widget
  onRefresh?: () => void
  onRemove?: () => void
  onConfig?: () => void
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

export function ChartWidget({ widget, onRefresh, onRemove, onConfig }: ChartWidgetProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    fetchData()
  }, [widget.config])

  const fetchData = async () => {
    setLoading(true)
    try {
      const chartData = await getChartData(widget.module, widget.config.metric || '', widget.widget_type)
      setData(chartData)
    } catch (error) {
      console.error('Error fetching chart data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getChartData = async (module: string, metric: string, chartType: string) => {
    switch (module) {
      case 'leads':
        return await getLeadsChartData(metric, chartType)
      case 'billing':
        return await getBillingChartData(metric, chartType)
      case 'attendance':
        return await getAttendanceChartData(metric, chartType)
      case 'members':
        return await getMembersChartData(metric, chartType)
      case 'support':
        return await getSupportChartData(metric, chartType)
      case 'payroll':
        return await getPayrollChartData(metric, chartType)
      default:
        return []
    }
  }

  const getLeadsChartData = async (metric: string, chartType: string) => {
    if (metric === 'lead_sources') {
      return [
        { name: 'Facebook Ads', value: 45 },
        { name: 'Website', value: 32 },
        { name: 'Referrals', value: 28 },
        { name: 'LinkedIn', value: 21 },
        { name: 'Webinars', value: 18 }
      ]
    }
    return [
      { date: 'Mon', leads: 12 },
      { date: 'Tue', leads: 19 },
      { date: 'Wed', leads: 15 },
      { date: 'Thu', leads: 22 },
      { date: 'Fri', leads: 18 },
      { date: 'Sat', leads: 8 },
      { date: 'Sun', leads: 5 }
    ]
  }

  const getBillingChartData = async (metric: string, chartType: string) => {
    if (metric === 'revenue_trend') {
      return [
        { month: 'Jan', revenue: 245 },
        { month: 'Feb', revenue: 289 },
        { month: 'Mar', revenue: 315 },
        { month: 'Apr', revenue: 298 },
        { month: 'May', revenue: 345 },
        { month: 'Jun', revenue: 378 }
      ]
    }
    return []
  }

  const getAttendanceChartData = async (metric: string, chartType: string) => {
    return [
      { date: 'Mon', present: 45, absent: 3 },
      { date: 'Tue', present: 47, absent: 1 },
      { date: 'Wed', present: 44, absent: 4 },
      { date: 'Thu', present: 46, absent: 2 },
      { date: 'Fri', present: 43, absent: 5 },
      { date: 'Sat', present: 25, absent: 23 },
      { date: 'Sun', present: 12, absent: 36 }
    ]
  }

  const getMembersChartData = async (metric: string, chartType: string) => {
    if (metric === 'plans_distribution') {
      return [
        { name: 'Basic', value: 89 },
        { name: 'Pro', value: 98 },
        { name: 'Premium', value: 47 }
      ]
    }
    return []
  }

  const getSupportChartData = async (metric: string, chartType: string) => {
    if (metric === 'tickets_by_status') {
      return [
        { name: 'Open', value: 23 },
        { name: 'In Progress', value: 34 },
        { name: 'Resolved', value: 56 },
        { name: 'Closed', value: 12 }
      ]
    }
    return []
  }

  const getPayrollChartData = async (metric: string, chartType: string) => {
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

    if (metric === 'attendance_stats') {
      const { data: attendance } = await supabase
        .from('attendance')
        .select('date, status')
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)
        .order('date')

      const weeklyData = [
        { date: 'Week 1', present: 0, absent: 0 },
        { date: 'Week 2', present: 0, absent: 0 },
        { date: 'Week 3', present: 0, absent: 0 },
        { date: 'Week 4', present: 0, absent: 0 }
      ]

      attendance?.forEach(record => {
        const day = new Date(record.date).getDate()
        const weekIndex = Math.min(Math.floor((day - 1) / 7), 3)

        if (['Present', 'Full Day', 'Half Day', 'Overtime'].includes(record.status)) {
          weeklyData[weekIndex].present++
        } else if (record.status === 'Absent') {
          weeklyData[weekIndex].absent++
        }
      })

      return weeklyData
    }

    if (metric === 'salary_overview') {
      const { data: teamMembers } = await supabase.from('admin_users').select('id, full_name, salary').limit(7)
      const { data: attendance } = await supabase
        .from('attendance')
        .select('admin_user_id, status')
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)

      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()

      return teamMembers?.map(member => {
        const memberAttendance = attendance?.filter(a => a.admin_user_id === member.id) || []
        const fullDays = memberAttendance.filter(a => a.status === 'Full Day').length
        const halfDays = memberAttendance.filter(a => a.status === 'Half Day').length
        const overtime = memberAttendance.filter(a => a.status === 'Overtime').length
        const present = memberAttendance.filter(a => a.status === 'Present').length

        const salary = typeof member.salary === 'string' ? parseFloat(member.salary) : (member.salary || 0)
        const perDaySalary = salary / daysInMonth
        const earnedDays = fullDays + (halfDays * 0.5) + (overtime * 1.5) + present
        const earned = Math.round(earnedDays * perDaySalary)

        return {
          name: member.full_name?.split(' ')[0] || 'Employee',
          earned: Math.round(earned / 1000),
          budget: Math.round(salary / 1000)
        }
      }) || []
    }

    if (metric === 'salary_by_employee') {
      const { data: teamMembers } = await supabase
        .from('admin_users')
        .select('id, full_name, salary')
        .limit(widget.config.limit || 10)

      const { data: attendance } = await supabase
        .from('attendance')
        .select('admin_user_id, status')
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)

      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()

      return teamMembers?.map(member => {
        const memberAttendance = attendance?.filter(a => a.admin_user_id === member.id) || []
        const fullDays = memberAttendance.filter(a => a.status === 'Full Day').length
        const halfDays = memberAttendance.filter(a => a.status === 'Half Day').length
        const overtime = memberAttendance.filter(a => a.status === 'Overtime').length
        const present = memberAttendance.filter(a => a.status === 'Present').length

        const salary = typeof member.salary === 'string' ? parseFloat(member.salary) : (member.salary || 0)
        const perDaySalary = salary / daysInMonth
        const earnedDays = fullDays + (halfDays * 0.5) + (overtime * 1.5) + present
        const earned = Math.round(earnedDays * perDaySalary)

        return {
          name: member.full_name?.split(' ')[0] || 'Employee',
          earned,
          budget: salary
        }
      }) || []
    }

    return []
  }

  const renderChart = () => {
    const metric = widget.config.metric || ''

    switch (widget.widget_type) {
      case 'bar_chart':
        // Handle payroll attendance stats differently
        if (metric === 'attendance_stats') {
          return (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                  iconType="circle"
                  formatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
                />
                <Bar dataKey="present" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Present" />
                <Bar dataKey="absent" fill="#f87171" radius={[8, 8, 0, 0]} name="Absent" />
              </BarChart>
            </ResponsiveContainer>
          )
        }
        // Handle payroll salary by employee
        if (metric === 'salary_by_employee') {
          return (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="earned" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Earned" />
                <Bar dataKey="budget" fill="#10b981" radius={[8, 8, 0, 0]} name="Budget" />
              </BarChart>
            </ResponsiveContainer>
          )
        }
        // Default bar chart
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )

      case 'line_chart':
        // Handle payroll salary overview with area chart
        if (metric === 'salary_overview' && widget.config.chartType === 'area') {
          return (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorEarnedPayroll" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorBudgetPayroll" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                  iconType="circle"
                />
                <Area
                  type="monotone"
                  dataKey="earned"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorEarnedPayroll)"
                  name="Earned"
                />
                <Area
                  type="monotone"
                  dataKey="budget"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorBudgetPayroll)"
                  name="Budget"
                />
              </AreaChart>
            </ResponsiveContainer>
          )
        }
        // Default line chart
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} />
              <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )

      case 'area_chart':
        // Handle payroll salary overview
        if (metric === 'salary_overview') {
          return (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorEarned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorBudget" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="earned"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorEarned)"
                  name="Earned"
                />
                <Area
                  type="monotone"
                  dataKey="budget"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorBudget)"
                  name="Budget"
                />
              </AreaChart>
            </ResponsiveContainer>
          )
        }
        // Default area chart
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )

      case 'pie_chart':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )

      default:
        return <div className="text-center text-gray-500">Chart type not supported</div>
    }
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
      <div className="w-full h-full">
        {renderChart()}
      </div>
    </BaseWidget>
  )
}
