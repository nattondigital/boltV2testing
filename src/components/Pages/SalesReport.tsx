import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Users,
  FileText,
  Download,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Percent
} from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

interface SalesMetrics {
  totalRevenue: number
  totalSales: number
  totalEstimates: number
  totalInvoices: number
  conversionRate: number
  averageOrderValue: number
  previousRevenue: number
  previousSales: number
}

interface ProductSales {
  product_name: string
  product_type: string
  total_sales: number
  total_revenue: number
}

interface MonthlySales {
  month: string
  revenue: number
  sales_count: number
}

export function SalesReport() {
  const [metrics, setMetrics] = useState<SalesMetrics>({
    totalRevenue: 0,
    totalSales: 0,
    totalEstimates: 0,
    totalInvoices: 0,
    conversionRate: 0,
    averageOrderValue: 0,
    previousRevenue: 0,
    previousSales: 0
  })
  const [productSales, setProductSales] = useState<ProductSales[]>([])
  const [monthlySales, setMonthlySales] = useState<MonthlySales[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('thisMonth')

  useEffect(() => {
    fetchSalesData()
  }, [dateRange])

  const getDateRange = () => {
    const now = new Date()
    const start = new Date()
    const previousStart = new Date()
    const previousEnd = new Date()

    switch (dateRange) {
      case 'today':
        start.setHours(0, 0, 0, 0)
        previousStart.setDate(start.getDate() - 1)
        previousStart.setHours(0, 0, 0, 0)
        previousEnd.setDate(previousStart.getDate() + 1)
        break
      case 'thisWeek':
        const dayOfWeek = start.getDay()
        start.setDate(start.getDate() - dayOfWeek)
        start.setHours(0, 0, 0, 0)
        previousStart.setDate(start.getDate() - 7)
        previousEnd.setDate(previousStart.getDate() + 7)
        break
      case 'thisMonth':
        start.setDate(1)
        start.setHours(0, 0, 0, 0)
        previousStart.setMonth(start.getMonth() - 1)
        previousStart.setDate(1)
        previousEnd.setMonth(previousStart.getMonth() + 1)
        previousEnd.setDate(0)
        break
      case 'thisQuarter':
        const quarter = Math.floor(start.getMonth() / 3)
        start.setMonth(quarter * 3, 1)
        start.setHours(0, 0, 0, 0)
        previousStart.setMonth(start.getMonth() - 3)
        previousEnd.setMonth(previousStart.getMonth() + 3)
        previousEnd.setDate(0)
        break
      case 'thisYear':
        start.setMonth(0, 1)
        start.setHours(0, 0, 0, 0)
        previousStart.setFullYear(start.getFullYear() - 1)
        previousStart.setMonth(0, 1)
        previousEnd.setFullYear(previousStart.getFullYear() + 1)
        previousEnd.setMonth(0, 0)
        break
      default:
        start.setDate(1)
        start.setHours(0, 0, 0, 0)
        previousStart.setMonth(start.getMonth() - 1)
        previousStart.setDate(1)
        previousEnd.setMonth(previousStart.getMonth() + 1)
        previousEnd.setDate(0)
    }

    return {
      start: start.toISOString(),
      end: now.toISOString(),
      previousStart: previousStart.toISOString(),
      previousEnd: previousEnd.toISOString()
    }
  }

  const fetchSalesData = async () => {
    try {
      setLoading(true)
      const { start, end, previousStart, previousEnd } = getDateRange()

      const [receiptsRes, estimatesRes, invoicesRes, productsRes, previousReceiptsRes] = await Promise.all([
        supabase
          .from('receipts')
          .select('amount_paid, payment_date, status')
          .eq('status', 'Completed')
          .gte('payment_date', start.split('T')[0])
          .lte('payment_date', end.split('T')[0]),

        supabase
          .from('estimates')
          .select('status')
          .gte('created_at', start)
          .lte('created_at', end),

        supabase
          .from('invoices')
          .select('status, total_amount')
          .gte('created_at', start)
          .lte('created_at', end),

        supabase
          .from('products')
          .select('product_name, product_type, total_sales, total_revenue')
          .eq('is_active', true)
          .order('total_revenue', { ascending: false }),

        supabase
          .from('receipts')
          .select('amount_paid')
          .eq('status', 'Completed')
          .gte('payment_date', previousStart.split('T')[0])
          .lte('payment_date', previousEnd.split('T')[0])
      ])

      const receipts = receiptsRes.data || []
      const estimates = estimatesRes.data || []
      const invoices = invoicesRes.data || []
      const products = productsRes.data || []
      const previousReceipts = previousReceiptsRes.data || []

      const totalRevenue = receipts.reduce((sum, r) => sum + Number(r.amount_paid), 0)
      const totalSales = receipts.length
      const previousRevenue = previousReceipts.reduce((sum, r) => sum + Number(r.amount_paid), 0)
      const previousSales = previousReceipts.length

      const acceptedEstimates = estimates.filter(e => e.status === 'Accepted').length
      const conversionRate = estimates.length > 0 ? (acceptedEstimates / estimates.length) * 100 : 0

      setMetrics({
        totalRevenue,
        totalSales,
        totalEstimates: estimates.length,
        totalInvoices: invoices.length,
        conversionRate,
        averageOrderValue: totalSales > 0 ? totalRevenue / totalSales : 0,
        previousRevenue,
        previousSales
      })

      setProductSales(products)

      const monthlyData = receipts.reduce((acc, receipt) => {
        const month = new Date(receipt.payment_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        const existing = acc.find(m => m.month === month)
        if (existing) {
          existing.revenue += Number(receipt.amount_paid)
          existing.sales_count += 1
        } else {
          acc.push({
            month,
            revenue: Number(receipt.amount_paid),
            sales_count: 1
          })
        }
        return acc
      }, [] as MonthlySales[])

      setMonthlySales(monthlyData.sort((a, b) => {
        return new Date(a.month).getTime() - new Date(b.month).getTime()
      }))

    } catch (error) {
      console.error('Error fetching sales data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  const exportToExcel = () => {
    const summaryData = [
      ['Sales Report Summary'],
      ['Date Range', dateRange],
      [''],
      ['Metric', 'Value'],
      ['Total Revenue', `₹${metrics.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
      ['Total Sales', metrics.totalSales],
      ['Total Estimates', metrics.totalEstimates],
      ['Total Invoices', metrics.totalInvoices],
      ['Conversion Rate', `${metrics.conversionRate.toFixed(1)}%`],
      ['Average Order Value', `₹${metrics.averageOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
      [''],
      ['Product Performance'],
      ['Product Name', 'Product Type', 'Total Sales', 'Total Revenue'],
      ...productSales.map(p => [
        p.product_name,
        p.product_type,
        p.total_sales,
        `₹${Number(p.total_revenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      ]),
      [''],
      ['Monthly Sales'],
      ['Month', 'Revenue', 'Sales Count'],
      ...monthlySales.map(m => [
        m.month,
        `₹${m.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        m.sales_count
      ])
    ]

    const ws = XLSX.utils.aoa_to_sheet(summaryData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Report')
    XLSX.writeFile(wb, `Sales_Report_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const revenueChange = calculateChange(metrics.totalRevenue, metrics.previousRevenue)
  const salesChange = calculateChange(metrics.totalSales, metrics.previousSales)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading sales data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Sales Report"
        description="Comprehensive sales performance and revenue analytics"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="today">Today</option>
                <option value="thisWeek">This Week</option>
                <option value="thisMonth">This Month</option>
                <option value="thisQuarter">This Quarter</option>
                <option value="thisYear">This Year</option>
              </select>
            </div>
          </div>
          <Button onClick={exportToExcel} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription>Total Revenue</CardDescription>
                  <div className="p-2 bg-green-50 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  ₹{metrics.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className={`flex items-center gap-1 text-sm mt-1 ${revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {revenueChange >= 0 ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  <span>{Math.abs(revenueChange).toFixed(1)}% vs previous period</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription>Total Sales</CardDescription>
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {metrics.totalSales}
                </div>
                <div className={`flex items-center gap-1 text-sm mt-1 ${salesChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {salesChange >= 0 ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  <span>{Math.abs(salesChange).toFixed(1)}% vs previous period</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription>Average Order Value</CardDescription>
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  ₹{metrics.averageOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-sm text-gray-500 mt-1">Per transaction</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription>Conversion Rate</CardDescription>
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Percent className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {metrics.conversionRate.toFixed(1)}%
                </div>
                <p className="text-sm text-gray-500 mt-1">Estimates to sales</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
              <CardDescription>Overview of sales activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-blue-600" />
                    <div>
                      <div className="font-semibold text-gray-900">Total Estimates</div>
                      <div className="text-sm text-gray-600">Generated in period</div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{metrics.totalEstimates}</div>
                </div>

                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-green-600" />
                    <div>
                      <div className="font-semibold text-gray-900">Total Invoices</div>
                      <div className="text-sm text-gray-600">Issued in period</div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{metrics.totalInvoices}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Trend</CardTitle>
              <CardDescription>Revenue and sales by month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {monthlySales.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No sales data available</p>
                ) : (
                  monthlySales.slice(-3).map((month, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">{month.month}</div>
                        <div className="text-sm text-gray-600">{month.sales_count} sales</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">
                          ₹{month.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Product Performance</CardTitle>
            <CardDescription>Sales breakdown by product</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Product Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Sales</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {productSales.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-gray-500">
                        No product sales data available
                      </td>
                    </tr>
                  ) : (
                    productSales.map((product, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{product.product_name}</td>
                        <td className="py-3 px-4 text-gray-600">
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                            {product.product_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-900">{product.total_sales}</td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900">
                          ₹{Number(product.total_revenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
