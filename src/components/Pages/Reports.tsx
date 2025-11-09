import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { DollarSign, TrendingUp, BarChart3, FileText, CheckSquare, Target } from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ReportCard {
  id: string
  title: string
  description: string
  icon: React.ElementType
  color: string
  bgColor: string
  route: string
  available: boolean
}

const reportCards: ReportCard[] = [
  {
    id: 'payroll-mis',
    title: 'Payroll MIS',
    description: 'Comprehensive attendance and payroll management reports with employee metrics',
    icon: DollarSign,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    route: '/reports/payroll-mis',
    available: true
  },
  {
    id: 'sales-report',
    title: 'Sales Report',
    description: 'Track sales performance, revenue, and conversion metrics',
    icon: TrendingUp,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    route: '/reports/sales',
    available: true
  },
  {
    id: 'tasks-mis',
    title: 'Tasks MIS',
    description: 'Task management analytics with team performance insights and productivity metrics',
    icon: CheckSquare,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    route: '/reports/tasks-mis',
    available: true
  },
  {
    id: 'leads-mis',
    title: 'Leads MIS',
    description: 'Lead analytics with pipeline performance, conversion metrics, and sales team insights',
    icon: Target,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    route: '/reports/leads-mis',
    available: true
  },
  {
    id: 'analytics',
    title: 'Business Analytics',
    description: 'Detailed business insights and KPI tracking',
    icon: BarChart3,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    route: '/reports/analytics',
    available: false
  },
  {
    id: 'financial',
    title: 'Financial Report',
    description: 'Comprehensive financial statements and expense analysis',
    icon: FileText,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    route: '/reports/financial',
    available: false
  }
]

export function Reports() {
  const navigate = useNavigate()

  const handleCardClick = (report: ReportCard) => {
    if (report.available) {
      navigate(report.route)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="MIS Reports"
        description="Access comprehensive reports and analytics for business insights"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportCards.map((report, index) => {
            const Icon = report.icon
            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={report.available ? { scale: 1.02, y: -4 } : {}}
                whileTap={report.available ? { scale: 0.98 } : {}}
              >
                <Card
                  className={`h-full cursor-pointer transition-all duration-200 ${
                    report.available
                      ? 'hover:shadow-xl border-2 border-transparent hover:border-brand-primary'
                      : 'opacity-60 cursor-not-allowed'
                  }`}
                  onClick={() => handleCardClick(report)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className={`p-3 rounded-xl ${report.bgColor}`}>
                        <Icon className={`h-8 w-8 ${report.color}`} />
                      </div>
                      {!report.available && (
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <CardTitle className="mt-4 text-xl">{report.title}</CardTitle>
                    <CardDescription className="text-sm mt-2">
                      {report.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {report.available ? (
                      <div className="flex items-center text-sm text-brand-primary font-medium">
                        View Report
                        <svg
                          className="ml-1 w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400">
                        This report will be available soon
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        <div className="mt-12 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">About MIS Reports</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-3xl font-bold text-brand-primary">6+</div>
              <div className="text-sm text-gray-600 mt-1">Total Reports</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">4</div>
              <div className="text-sm text-gray-600 mt-1">Active Reports</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-orange-600">2</div>
              <div className="text-sm text-gray-600 mt-1">Coming Soon</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
