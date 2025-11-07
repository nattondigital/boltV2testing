import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Users, DollarSign, Clock, TrendingUp, Calendar,
  Download, Search, ArrowUp, ArrowDown, MoreVertical, ChevronDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

interface TeamMember {
  id: string
  full_name: string
  email: string
  role: string
  salary: number
}

interface AttendanceRecord {
  id: string
  admin_user_id: string
  date: string
  check_in_time: string
  check_out_time: string | null
  status: string
  actual_working_hours: number
  admin_user?: TeamMember
}

interface EmployeePayrollData {
  id: string
  name: string
  role: string
  totalDays: number
  presentDays: number
  halfDays: number
  fullDays: number
  overtime: number
  absentDays: number
  totalHours: number
  salary: number
  perDaySalary: number
  earnedSalary: number
}

export function PayrollMIS() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [payrollData, setPayrollData] = useState<EmployeePayrollData[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchData()
  }, [selectedMonth])

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchTeamMembers(), fetchAttendance()])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTeamMembers = async () => {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, full_name, email, role')
      .order('full_name')

    if (error) {
      console.error('Error fetching team members:', error)
      return
    }

    const membersWithSalary = (data || []).map(member => ({
      ...member,
      salary: Math.floor(Math.random() * (80000 - 30000 + 1)) + 30000
    }))

    setTeamMembers(membersWithSalary)
  }

  const fetchAttendance = async () => {
    const startDate = format(startOfMonth(new Date(selectedMonth)), 'yyyy-MM-dd')
    const endDate = format(endOfMonth(new Date(selectedMonth)), 'yyyy-MM-dd')

    const { data, error } = await supabase
      .from('attendance')
      .select(`
        *,
        admin_user:admin_users(id, full_name, email, role)
      `)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })

    if (error) {
      console.error('Error fetching attendance:', error)
      return
    }

    setAttendance(data || [])
  }

  useEffect(() => {
    if (teamMembers.length > 0 && attendance.length >= 0) {
      calculatePayrollData()
    }
  }, [teamMembers, attendance, selectedMonth])

  const calculatePayrollData = () => {
    const monthStart = startOfMonth(new Date(selectedMonth))
    const monthEnd = endOfMonth(new Date(selectedMonth))
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd }).length

    const payroll: EmployeePayrollData[] = teamMembers.map(member => {
      const memberAttendance = attendance.filter(a => a.admin_user_id === member.id)

      const presentDays = memberAttendance.filter(a => a.status === 'Present').length
      const halfDays = memberAttendance.filter(a => a.status === 'Half Day').length
      const fullDays = memberAttendance.filter(a => a.status === 'Full Day').length
      const overtime = memberAttendance.filter(a => a.status === 'Overtime').length
      const absentDays = daysInMonth - (presentDays + halfDays + fullDays + overtime)

      const totalHours = memberAttendance.reduce((sum, a) => sum + (a.actual_working_hours || 0), 0)

      const perDaySalary = member.salary / daysInMonth

      const earnedDays = fullDays + (halfDays * 0.5) + (overtime * 1.5) + presentDays
      const earnedSalary = Math.round(earnedDays * perDaySalary)

      return {
        id: member.id,
        name: member.full_name,
        role: member.role,
        totalDays: daysInMonth,
        presentDays,
        halfDays,
        fullDays,
        overtime,
        absentDays,
        totalHours: Math.round(totalHours * 10) / 10,
        salary: member.salary,
        perDaySalary: Math.round(perDaySalary),
        earnedSalary
      }
    })

    setPayrollData(payroll)
  }

  const filteredPayrollData = payrollData.filter(employee =>
    employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalSalary = payrollData.reduce((sum, emp) => sum + emp.salary, 0)
  const totalEarnedSalary = payrollData.reduce((sum, emp) => sum + emp.earnedSalary, 0)
  const totalAbsent = payrollData.reduce((sum, emp) => sum + emp.absentDays, 0)
  const totalHours = payrollData.reduce((sum, emp) => sum + emp.totalHours, 0)
  const totalPresent = payrollData.reduce((sum, emp) => sum + emp.presentDays, 0)
  const totalHalfDays = payrollData.reduce((sum, emp) => sum + emp.halfDays, 0)
  const totalFullDays = payrollData.reduce((sum, emp) => sum + emp.fullDays, 0)
  const totalOvertime = payrollData.reduce((sum, emp) => sum + emp.overtime, 0)

  const attendanceTrendData = [
    { date: 'Week 1', present: Math.round(totalPresent * 0.2), absent: Math.round(totalAbsent * 0.3) },
    { date: 'Week 2', present: Math.round(totalPresent * 0.25), absent: Math.round(totalAbsent * 0.2) },
    { date: 'Week 3', present: Math.round(totalPresent * 0.3), absent: Math.round(totalAbsent * 0.25) },
    { date: 'Week 4', present: Math.round(totalPresent * 0.25), absent: Math.round(totalAbsent * 0.25) }
  ]

  const salaryTrendData = payrollData.slice(0, 7).map(emp => ({
    name: emp.name.split(' ')[0],
    earned: Math.round(emp.earnedSalary / 1000),
    budget: Math.round(emp.salary / 1000)
  }))

  const exportToCSV = () => {
    const headers = ['Employee', 'Role', 'Total Days', 'Present', 'Half Day', 'Full Day', 'Overtime', 'Absent', 'Total Hours', 'Monthly Salary', 'Per Day Salary', 'Earned Salary']
    const rows = filteredPayrollData.map(emp => [
      emp.name,
      emp.role,
      emp.totalDays,
      emp.presentDays,
      emp.halfDays,
      emp.fullDays,
      emp.overtime,
      emp.absentDays,
      emp.totalHours,
      emp.salary,
      emp.perDaySalary,
      emp.earnedSalary
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payroll-mis-${selectedMonth}.csv`
    a.click()
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Modern Header */}
      <div className="bg-white border-b border-gray-200/60">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/reports')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back</span>
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <Button
                onClick={exportToCSV}
                variant="outline"
                className="flex items-center gap-2 border-gray-200 hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Payroll Statistics</h1>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 py-8 space-y-6">
        {/* Modern KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl border border-gray-200/60 p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex items-center gap-1 text-sm font-medium text-green-600">
                <ArrowUp className="w-4 h-4" />
                {((totalEarnedSalary / totalSalary) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              ₹{(totalEarnedSalary / 1000).toFixed(0)}K
            </div>
            <div className="text-sm text-gray-500">Today's earned salary</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl border border-gray-200/60 p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex items-center gap-1 text-sm font-medium text-green-600">
                <ArrowUp className="w-4 h-4" />
                {totalFullDays > 0 ? ((totalFullDays / payrollData.length).toFixed(1)) : 0}%
              </div>
            </div>
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              {totalFullDays + totalPresent + totalHalfDays + totalOvertime}
            </div>
            <div className="text-sm text-gray-500">Total attendance days</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl border border-gray-200/60 p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex items-center gap-1 text-sm font-medium text-green-600">
                <ArrowUp className="w-4 h-4" />
                20%
              </div>
            </div>
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              ₹{(totalSalary / 1000).toFixed(0)}K
            </div>
            <div className="text-sm text-gray-500">Total salary budget</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl border border-gray-200/60 p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex items-center gap-1 text-sm font-medium text-red-600">
                <ArrowDown className="w-4 h-4" />
                2.9%
              </div>
            </div>
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              {payrollData.length > 0 ? (totalHours / payrollData.length).toFixed(1) : 0}h
            </div>
            <div className="text-sm text-gray-500">Avg hours/employee</div>
          </motion.div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl border border-gray-200/60 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-semibold text-gray-900">Attendance Statistics</h3>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-gray-600">Present</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <span className="text-gray-600">Absent</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={attendanceTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="present" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                <Bar dataKey="absent" fill="#f87171" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Salary Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-xl border border-gray-200/60 p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold text-gray-900">Salary overview</h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-sm font-medium text-red-600">
                  <ArrowDown className="w-4 h-4" />
                  3.9%
                </div>
                <div className="text-2xl font-semibold text-blue-600">26%</div>
              </div>
            </div>
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              ₹{(totalEarnedSalary / 1000).toFixed(2)}K
            </div>
            <div className="flex items-center gap-1 text-sm text-green-600 mb-6">
              <ArrowUp className="w-3 h-3" />
              20%
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={salaryTrendData}>
                <defs>
                  <linearGradient id="colorEarned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorBudget" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#9ca3af"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide />
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
                />
                <Area
                  type="monotone"
                  dataKey="budget"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorBudget)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Modern Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white rounded-xl border border-gray-200/60"
        >
          <div className="p-6 border-b border-gray-200/60">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Employee Payroll</h3>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <MoreVertical className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200/60">
                  <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input type="checkbox" className="rounded border-gray-300" />
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee Name
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-center py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Full Days
                  </th>
                  <th className="text-center py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Half Days
                  </th>
                  <th className="text-center py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Absent
                  </th>
                  <th className="text-right py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="text-right py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Earned
                  </th>
                  <th className="text-center py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        <span className="text-sm">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredPayrollData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-500 text-sm">
                      No employees found
                    </td>
                  </tr>
                ) : (
                  filteredPayrollData.map((employee, index) => (
                    <motion.tr
                      key={employee.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.05 * index }}
                      className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-medium">
                            {employee.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-gray-900">{employee.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-600">{employee.role}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-sm font-medium text-gray-900">{employee.fullDays}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-sm font-medium text-gray-900">{employee.halfDays}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-sm font-medium text-gray-900">{employee.absentDays}</span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="text-sm font-medium text-gray-900">
                          ₹{employee.salary.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          ₹{employee.earnedSalary.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
