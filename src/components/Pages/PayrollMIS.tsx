import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Users, DollarSign, Clock, TrendingUp, Calendar,
  Download, Filter, Search, ChevronDown, Award, AlertCircle, Target
} from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { KPICard } from '@/components/Common/KPICard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
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

    // Mock salary data
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

      // Calculate earned salary: Full Day = 1 day, Half Day = 0.5 day, Overtime = 1.5 day, Present = based on hours
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

  // Prepare chart data
  const totalPresent = payrollData.reduce((sum, emp) => sum + emp.presentDays, 0)
  const totalHalfDays = payrollData.reduce((sum, emp) => sum + emp.halfDays, 0)
  const totalFullDays = payrollData.reduce((sum, emp) => sum + emp.fullDays, 0)
  const totalOvertime = payrollData.reduce((sum, emp) => sum + emp.overtime, 0)

  const attendanceDistributionData = [
    { name: 'Full Day', value: totalFullDays, color: '#10b981' },
    { name: 'Half Day', value: totalHalfDays, color: '#f59e0b' },
    { name: 'Present', value: totalPresent, color: '#3b82f6' },
    { name: 'Overtime', value: totalOvertime, color: '#8b5cf6' },
    { name: 'Absent', value: totalAbsent, color: '#ef4444' }
  ]

  const topEmployeesByHours = [...payrollData]
    .sort((a, b) => b.totalHours - a.totalHours)
    .slice(0, 5)
    .map(emp => ({
      name: emp.name.split(' ')[0],
      hours: emp.totalHours
    }))

  const salaryComparisonData = payrollData.map(emp => ({
    name: emp.name.split(' ')[0],
    budgeted: emp.salary,
    earned: emp.earnedSalary
  })).slice(0, 8)

  const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444']

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold">{payload[0].payload.name}</p>
          <p className="text-sm text-gray-600">
            {payload[0].name}: {payload[0].value.toLocaleString()}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Button
              onClick={() => navigate('/reports')}
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Reports
            </Button>
          </div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Payroll MIS Dashboard</h1>
              <p className="text-gray-500 mt-1">Comprehensive attendance and payroll management</p>
            </div>
            <div className="flex items-center gap-3 mt-4 md:mt-0">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
              <Button onClick={exportToCSV} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <KPICard
              title="Total Employees"
              value={payrollData.length}
              icon={Users}
              trend={{ value: 0, isPositive: true }}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <KPICard
              title="Total Salary Budget"
              value={`₹${(totalSalary / 1000).toFixed(0)}K`}
              icon={DollarSign}
              trend={{ value: 0, isPositive: true }}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <KPICard
              title="Earned Salary"
              value={`₹${(totalEarnedSalary / 1000).toFixed(0)}K`}
              icon={TrendingUp}
              trend={{ value: ((totalEarnedSalary / totalSalary) * 100).toFixed(1), isPositive: true }}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <KPICard
              title="Total Working Hours"
              value={`${totalHours.toFixed(0)}h`}
              icon={Clock}
              trend={{ value: 0, isPositive: true }}
            />
          </motion.div>
        </div>

        {/* Analytics Graphs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Attendance Distribution Pie Chart */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="shadow-lg border-2 border-gray-100 hover:shadow-xl transition-shadow">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardTitle className="flex items-center gap-2 text-gray-800">
                  <Target className="w-5 h-5 text-blue-600" />
                  Attendance Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={attendanceDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {attendanceDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {attendanceDistributionData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-gray-600">
                        {item.name}: <strong>{item.value}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Top Performers by Hours */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="shadow-lg border-2 border-gray-100 hover:shadow-xl transition-shadow">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                <CardTitle className="flex items-center gap-2 text-gray-800">
                  <Award className="w-5 h-5 text-green-600" />
                  Top 5 Performers (Hours)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topEmployeesByHours} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" stroke="#888" />
                    <YAxis dataKey="name" type="category" width={80} stroke="#888" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="hours" fill="#10b981" radius={[0, 8, 8, 0]}>
                      {topEmployeesByHours.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={`hsl(${142 - index * 10}, 70%, ${50 - index * 5}%)`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Salary Comparison Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mb-8"
        >
          <Card className="shadow-lg border-2 border-gray-100 hover:shadow-xl transition-shadow">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <DollarSign className="w-5 h-5 text-purple-600" />
                Salary Comparison: Budgeted vs Earned
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={salaryComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                            <p className="font-semibold text-gray-900">{payload[0].payload.name}</p>
                            <p className="text-sm text-purple-600">
                              Budgeted: ₹{payload[0].value?.toLocaleString()}
                            </p>
                            <p className="text-sm text-green-600">
                              Earned: ₹{payload[1].value?.toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Utilization: {((payload[1].value! / payload[0].value!) * 100).toFixed(1)}%
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend />
                  <Bar dataKey="budgeted" name="Budgeted Salary" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="earned" name="Earned Salary" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">Total Attendance</p>
                    <p className="text-3xl font-bold mt-2">
                      {totalFullDays + totalHalfDays + totalPresent + totalOvertime}
                    </p>
                    <p className="text-green-100 text-xs mt-1">days recorded</p>
                  </div>
                  <div className="bg-white/20 p-3 rounded-full">
                    <Calendar className="w-8 h-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm font-medium">Total Absences</p>
                    <p className="text-3xl font-bold mt-2">{totalAbsent}</p>
                    <p className="text-orange-100 text-xs mt-1">days absent</p>
                  </div>
                  <div className="bg-white/20 p-3 rounded-full">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.0 }}
          >
            <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Avg Hours/Employee</p>
                    <p className="text-3xl font-bold mt-2">
                      {payrollData.length > 0 ? (totalHours / payrollData.length).toFixed(1) : 0}h
                    </p>
                    <p className="text-blue-100 text-xs mt-1">per employee</p>
                  </div>
                  <div className="bg-white/20 p-3 rounded-full">
                    <Clock className="w-8 h-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Search Bar */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by employee name or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payroll Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
        >
          <Card className="shadow-lg border-2 border-gray-100">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
              <CardTitle className="text-gray-800">
                Employee Payroll Details - {format(new Date(selectedMonth), 'MMMM yyyy')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-100 to-gray-50 border-b-2 border-gray-300">
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">Employee</th>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">Role</th>
                      <th className="text-center py-4 px-4 font-semibold text-blue-600">Present</th>
                      <th className="text-center py-4 px-4 font-semibold text-orange-600">Half Day</th>
                      <th className="text-center py-4 px-4 font-semibold text-green-600">Full Day</th>
                      <th className="text-center py-4 px-4 font-semibold text-purple-600">Overtime</th>
                      <th className="text-center py-4 px-4 font-semibold text-red-600">Absent</th>
                      <th className="text-center py-4 px-4 font-semibold text-gray-700">Total Hours</th>
                      <th className="text-right py-4 px-4 font-semibold text-gray-700">Monthly Salary</th>
                      <th className="text-right py-4 px-4 font-semibold text-green-700">Earned Salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={10} className="text-center py-8 text-gray-500">
                          <div className="flex items-center justify-center gap-2">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary"></div>
                            Loading...
                          </div>
                        </td>
                      </tr>
                    ) : filteredPayrollData.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-8 text-gray-500">
                          No employees found
                        </td>
                      </tr>
                    ) : (
                      filteredPayrollData.map((employee, index) => (
                        <motion.tr
                          key={employee.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * index }}
                          className="border-b hover:bg-blue-50 transition-colors duration-150"
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center text-white font-semibold text-sm">
                                {employee.name.charAt(0)}
                              </div>
                              <div className="font-medium text-gray-900">{employee.name}</div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {employee.role}
                            </Badge>
                          </td>
                          <td className="text-center py-4 px-4">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 text-blue-700 font-semibold">
                              {employee.presentDays}
                            </span>
                          </td>
                          <td className="text-center py-4 px-4">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-orange-100 text-orange-700 font-semibold">
                              {employee.halfDays}
                            </span>
                          </td>
                          <td className="text-center py-4 px-4">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 text-green-700 font-semibold">
                              {employee.fullDays}
                            </span>
                          </td>
                          <td className="text-center py-4 px-4">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 text-purple-700 font-semibold">
                              {employee.overtime}
                            </span>
                          </td>
                          <td className="text-center py-4 px-4">
                            <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg font-semibold ${
                              employee.absentDays > 5
                                ? 'bg-red-500 text-white ring-2 ring-red-300'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {employee.absentDays}
                            </span>
                          </td>
                          <td className="text-center py-4 px-4">
                            <span className="text-gray-700 font-medium">{employee.totalHours}h</span>
                          </td>
                          <td className="text-right py-4 px-4">
                            <span className="font-semibold text-gray-900">
                              ₹{employee.salary.toLocaleString()}
                            </span>
                          </td>
                          <td className="text-right py-4 px-4">
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-green-600 text-lg">
                                ₹{employee.earnedSalary.toLocaleString()}
                              </span>
                              <span className="text-xs text-gray-500">
                                {((employee.earnedSalary / employee.salary) * 100).toFixed(0)}% utilized
                              </span>
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                  {filteredPayrollData.length > 0 && (
                    <tfoot className="bg-gradient-to-r from-gray-100 to-gray-50 border-t-2 border-gray-300">
                      <tr>
                        <td colSpan={2} className="py-4 px-4 text-right font-bold text-gray-800">Grand Total:</td>
                        <td className="text-center py-4 px-4">
                          <span className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-200 text-blue-800 font-bold text-lg">
                            {filteredPayrollData.reduce((sum, emp) => sum + emp.presentDays, 0)}
                          </span>
                        </td>
                        <td className="text-center py-4 px-4">
                          <span className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-orange-200 text-orange-800 font-bold text-lg">
                            {filteredPayrollData.reduce((sum, emp) => sum + emp.halfDays, 0)}
                          </span>
                        </td>
                        <td className="text-center py-4 px-4">
                          <span className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-green-200 text-green-800 font-bold text-lg">
                            {filteredPayrollData.reduce((sum, emp) => sum + emp.fullDays, 0)}
                          </span>
                        </td>
                        <td className="text-center py-4 px-4">
                          <span className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-purple-200 text-purple-800 font-bold text-lg">
                            {filteredPayrollData.reduce((sum, emp) => sum + emp.overtime, 0)}
                          </span>
                        </td>
                        <td className="text-center py-4 px-4">
                          <span className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-red-200 text-red-800 font-bold text-lg">
                            {filteredPayrollData.reduce((sum, emp) => sum + emp.absentDays, 0)}
                          </span>
                        </td>
                        <td className="text-center py-4 px-4">
                          <span className="text-gray-800 font-bold text-lg">
                            {filteredPayrollData.reduce((sum, emp) => sum + emp.totalHours, 0).toFixed(0)}h
                          </span>
                        </td>
                        <td className="text-right py-4 px-4">
                          <span className="font-bold text-gray-900 text-lg">
                            ₹{filteredPayrollData.reduce((sum, emp) => sum + emp.salary, 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="text-right py-4 px-4">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-green-700 text-xl">
                              ₹{filteredPayrollData.reduce((sum, emp) => sum + emp.earnedSalary, 0).toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-600 font-medium">
                              {((filteredPayrollData.reduce((sum, emp) => sum + emp.earnedSalary, 0) /
                                filteredPayrollData.reduce((sum, emp) => sum + emp.salary, 0)) * 100).toFixed(1)}% total utilization
                            </span>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Salary Calculation Info */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Salary Calculation Logic</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Attendance Status Weight:</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Full Day = 1.0 day</li>
                  <li>• Half Day = 0.5 day</li>
                  <li>• Overtime = 1.5 day</li>
                  <li>• Present = 1.0 day (based on hours worked)</li>
                  <li>• Absent = 0.0 day</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Calculation Formula:</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Per Day Salary = Monthly Salary ÷ Total Days in Month</li>
                  <li>• Earned Days = (Full Days × 1) + (Half Days × 0.5) + (Overtime × 1.5) + Present</li>
                  <li>• Earned Salary = Earned Days × Per Day Salary</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This is a mock payroll calculation using random salary data for demonstration purposes.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
