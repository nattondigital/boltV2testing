import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, Users, DollarSign, Calendar,
  Briefcase, Search, Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/Common/PageHeader'

interface DashboardTemplate {
  id: string
  name: string
  description: string
  category: string
  icon: React.ElementType
  color: string
  bgColor: string
  widgets_count: number
}

const templates: DashboardTemplate[] = [
  {
    id: 'executive',
    name: 'Executive Dashboard',
    description: 'High-level overview with key business metrics, revenue trends, and performance indicators',
    category: 'executive',
    icon: TrendingUp,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    widgets_count: 8
  },
  {
    id: 'sales',
    name: 'Sales Dashboard',
    description: 'Track leads, conversion funnel, revenue by source, and sales team performance',
    category: 'sales',
    icon: DollarSign,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    widgets_count: 8
  },
  {
    id: 'hr',
    name: 'HR & Payroll Dashboard',
    description: 'Monitor attendance, leave requests, payroll metrics, and team productivity',
    category: 'hr',
    icon: Users,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    widgets_count: 9
  },
  {
    id: 'finance',
    name: 'Finance Dashboard',
    description: 'Financial overview with revenue, expenses, invoices, and cash flow analysis',
    category: 'finance',
    icon: DollarSign,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    widgets_count: 6
  },
  {
    id: 'operations',
    name: 'Operations Dashboard',
    description: 'Track tasks, support tickets, automations, and operational efficiency metrics',
    category: 'operations',
    icon: Briefcase,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    widgets_count: 7
  },
  {
    id: 'custom',
    name: 'Blank Dashboard',
    description: 'Start from scratch and build your own custom dashboard with any widgets you need',
    category: 'custom',
    icon: LayoutDashboard,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    widgets_count: 0
  }
]

export function DashboardTemplates() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreateFromTemplate = async (template: DashboardTemplate) => {
    setCreating(true)
    try {
      // First, unset any existing default dashboard if creating a new default
      if (template.category !== 'custom') {
        await supabase
          .from('custom_dashboards')
          .update({ is_default: false })
          .eq('is_default', true)
      }

      const { data: newDashboard, error: dashboardError } = await supabase
        .from('custom_dashboards')
        .insert({
          name: template.name,
          description: template.description,
          is_default: template.category !== 'custom',
          layout_config: { cols: 12, rowHeight: 100 }
        })
        .select()
        .single()

      if (dashboardError) {
        console.error('Error creating dashboard:', dashboardError)
        alert('Failed to create dashboard. Please try again.')
        return
      }

      if (newDashboard) {
        await createTemplateWidgets(newDashboard.id, template.category)
        navigate(`/dashboard-builder/custom?id=${newDashboard.id}`)
      }
    } catch (error) {
      console.error('Error creating dashboard:', error)
      alert('Failed to create dashboard. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const createTemplateWidgets = async (dashboardId: string, category: string) => {
    const widgets = getTemplateWidgets(category)

    if (widgets.length > 0) {
      await supabase.from('dashboard_widgets').insert(
        widgets.map(w => ({ ...w, dashboard_id: dashboardId }))
      )
    }
  }

  const getTemplateWidgets = (category: string) => {
    switch (category) {
      case 'executive':
        return [
          { widget_type: 'kpi_card', module: 'billing', title: 'Total Revenue', config: { metric: 'total_revenue', colorScheme: 'green' }, position: { x: 0, y: 0, w: 3, h: 2 } },
          { widget_type: 'kpi_card', module: 'leads', title: 'Total Leads', config: { metric: 'total_leads', colorScheme: 'blue' }, position: { x: 3, y: 0, w: 3, h: 2 } },
          { widget_type: 'kpi_card', module: 'members', title: 'Active Members', config: { metric: 'active_members', colorScheme: 'purple' }, position: { x: 6, y: 0, w: 3, h: 2 } },
          { widget_type: 'kpi_card', module: 'support', title: 'Open Tickets', config: { metric: 'open_tickets', colorScheme: 'orange' }, position: { x: 9, y: 0, w: 3, h: 2 } },
          { widget_type: 'funnel', module: 'leads', title: 'Lead Conversion Funnel', config: {}, position: { x: 0, y: 2, w: 6, h: 4 } },
          { widget_type: 'area_chart', module: 'billing', title: 'Revenue Trend', config: { metric: 'revenue_trend' }, position: { x: 6, y: 2, w: 6, h: 4 } },
          { widget_type: 'pie_chart', module: 'members', title: 'Member Plans Distribution', config: { metric: 'plans_distribution' }, position: { x: 0, y: 6, w: 4, h: 4 } },
          { widget_type: 'activity_feed', module: 'leads', title: 'Recent Activity', config: { limit: 8 }, position: { x: 8, y: 6, w: 4, h: 6 } }
        ]

      case 'sales':
        return [
          { widget_type: 'kpi_card', module: 'leads', title: 'Total Leads', config: { metric: 'total_leads', colorScheme: 'blue' }, position: { x: 0, y: 0, w: 3, h: 2 } },
          { widget_type: 'kpi_card', module: 'leads', title: 'Hot Leads', config: { metric: 'hot_leads', colorScheme: 'red' }, position: { x: 3, y: 0, w: 3, h: 2 } },
          { widget_type: 'kpi_card', module: 'leads', title: 'Conversion Rate', config: { metric: 'conversion_rate', colorScheme: 'green' }, position: { x: 6, y: 0, w: 3, h: 2 } },
          { widget_type: 'kpi_card', module: 'billing', title: 'Monthly Revenue', config: { metric: 'monthly_revenue', colorScheme: 'green' }, position: { x: 9, y: 0, w: 3, h: 2 } },
          { widget_type: 'funnel', module: 'leads', title: 'Sales Funnel', config: {}, position: { x: 0, y: 2, w: 8, h: 4 } },
          { widget_type: 'bar_chart', module: 'leads', title: 'Leads by Source', config: { metric: 'lead_sources' }, position: { x: 0, y: 6, w: 6, h: 4 } },
          { widget_type: 'area_chart', module: 'billing', title: 'Revenue Trend', config: { metric: 'revenue_trend' }, position: { x: 6, y: 6, w: 6, h: 4 } },
          { widget_type: 'table', module: 'leads', title: 'Recent Leads', config: { limit: 10 }, position: { x: 0, y: 10, w: 12, h: 5 } }
        ]

      case 'hr':
        return [
          { widget_type: 'kpi_card', module: 'attendance', title: 'Present Today', config: { metric: 'present_today', colorScheme: 'blue' }, position: { x: 0, y: 0, w: 3, h: 2 } },
          { widget_type: 'kpi_card', module: 'attendance', title: 'Total Hours', config: { metric: 'total_hours', colorScheme: 'green' }, position: { x: 3, y: 0, w: 3, h: 2 } },
          { widget_type: 'kpi_card', module: 'members', title: 'Total Employees', config: { metric: 'total_members', colorScheme: 'purple' }, position: { x: 6, y: 0, w: 3, h: 2 } },
          { widget_type: 'kpi_card', module: 'expenses', title: 'Pending Expenses', config: { metric: 'pending_expenses', colorScheme: 'orange' }, position: { x: 9, y: 0, w: 3, h: 2 } },
          { widget_type: 'bar_chart', module: 'attendance', title: 'Weekly Attendance', config: {}, position: { x: 0, y: 2, w: 8, h: 4 } }
        ]

      case 'finance':
        return [
          { widget_type: 'kpi_card', module: 'billing', title: 'Total Revenue', config: { metric: 'total_revenue', colorScheme: 'green' }, position: { x: 0, y: 0, w: 3, h: 2 } },
          { widget_type: 'kpi_card', module: 'billing', title: 'Paid Invoices', config: { metric: 'paid_invoices', colorScheme: 'blue' }, position: { x: 3, y: 0, w: 3, h: 2 } },
          { widget_type: 'kpi_card', module: 'billing', title: 'Pending Invoices', config: { metric: 'pending_invoices', colorScheme: 'orange' }, position: { x: 6, y: 0, w: 3, h: 2 } },
          { widget_type: 'kpi_card', module: 'expenses', title: 'Total Expenses', config: { metric: 'total_expenses', colorScheme: 'red' }, position: { x: 9, y: 0, w: 3, h: 2 } },
          { widget_type: 'area_chart', module: 'billing', title: 'Revenue Trend', config: { metric: 'revenue_trend' }, position: { x: 0, y: 2, w: 12, h: 4 } },
          { widget_type: 'table', module: 'billing', title: 'Recent Invoices', config: { limit: 10 }, position: { x: 0, y: 6, w: 12, h: 5 } }
        ]

      case 'operations':
        return [
          { widget_type: 'kpi_card', module: 'tasks', title: 'Pending Tasks', config: { metric: 'pending_tasks', colorScheme: 'blue' }, position: { x: 0, y: 0, w: 3, h: 2 } },
          { widget_type: 'kpi_card', module: 'support', title: 'Open Tickets', config: { metric: 'open_tickets', colorScheme: 'orange' }, position: { x: 3, y: 0, w: 3, h: 2 } },
          { widget_type: 'kpi_card', module: 'automations', title: 'Active Automations', config: { metric: 'active_automations', colorScheme: 'purple' }, position: { x: 6, y: 0, w: 3, h: 2 } },
          { widget_type: 'activity_feed', module: 'leads', title: 'Recent Activity', config: { limit: 10 }, position: { x: 0, y: 2, w: 6, h: 6 } },
          { widget_type: 'pie_chart', module: 'support', title: 'Tickets by Status', config: { metric: 'tickets_by_status' }, position: { x: 6, y: 2, w: 6, h: 4 } },
          { widget_type: 'table', module: 'tasks', title: 'Active Tasks', config: { limit: 10 }, position: { x: 0, y: 8, w: 6, h: 5 } },
          { widget_type: 'table', module: 'support', title: 'Recent Tickets', config: { limit: 10 }, position: { x: 6, y: 8, w: 6, h: 5 } }
        ]

      default:
        return []
    }
  }

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Dashboard Templates"
        description="Choose a pre-built template or start from scratch"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template, index) => {
            const Icon = template.icon
            return (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-xl ${template.bgColor}`}>
                        <Icon className={`h-8 w-8 ${template.color}`} />
                      </div>
                      {template.widgets_count > 0 && (
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                          {template.widgets_count} widgets
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-xl">{template.name}</CardTitle>
                    <CardDescription className="text-sm mt-2">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => handleCreateFromTemplate(template)}
                      disabled={creating}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Use This Template
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
