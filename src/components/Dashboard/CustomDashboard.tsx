import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Plus, Save, Layout, Grid, Settings, X, ChevronRight, Search,
  LayoutDashboard, RefreshCw, ArrowLeft, Home
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { Widget, Dashboard } from '@/types/dashboard'
import { WidgetRenderer } from './WidgetRenderer'
import { WIDGET_REGISTRY, getAllModules, getWidgetsByModule } from '@/lib/widget-registry'
import { PageHeader } from '@/components/Common/PageHeader'

export function CustomDashboard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const dashboardId = searchParams.get('id')
  const template = searchParams.get('template')

  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [showWidgetSelector, setShowWidgetSelector] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedModule, setSelectedModule] = useState<string>('all')
  const [dashboardName, setDashboardName] = useState('My Dashboard')
  const [isEditingName, setIsEditingName] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [dashboardId])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      // If ID is provided, load that specific dashboard
      if (dashboardId) {
        const { data } = await supabase
          .from('custom_dashboards')
          .select('*')
          .eq('id', dashboardId)
          .single()

        if (data) {
          setDashboard(data)
          setDashboardName(data.name)
          await loadWidgets(data.id)
        }
      } else {
        // Create a new blank dashboard when no ID is provided
        await createBlankDashboard()
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
      // If there's an error, create a blank dashboard
      await createBlankDashboard()
    } finally {
      setLoading(false)
    }
  }

  const createBlankDashboard = async () => {
    // Set dashboard name based on template
    const dashboardName = template === 'payroll-mis' ? 'Payroll MIS Dashboard' : 'My Dashboard'
    const dashboardDesc = template === 'payroll-mis' ? 'Customizable Payroll & Attendance Report' : 'Custom MIS Dashboard'

    const { data: newDashboard, error } = await supabase
      .from('custom_dashboards')
      .insert({
        name: dashboardName,
        description: dashboardDesc,
        is_default: false,
        layout_config: { cols: 12, rowHeight: 100 }
      })
      .select()
      .single()

    if (newDashboard) {
      setDashboard(newDashboard)
      setDashboardName(newDashboard.name)

      // If template is payroll-mis, create payroll widgets
      if (template === 'payroll-mis') {
        await createPayrollWidgets(newDashboard.id)
      } else {
        setWidgets([]) // Start with no widgets - blank dashboard
      }
    }
  }

  const createPayrollWidgets = async (dashboardId: string) => {
    // Define payroll MIS widgets layout - matching exact Payroll MIS dashboard
    // Grid: 12 columns, auto-rows-[100px]
    // Widths: KPI=25% (3/12), Charts=50% (6/12), Table=100% (12/12)
    // Heights: KPI=1.3 (130px natural content), Charts=4 (400px), Table=5 (500px)
    const payrollWidgets = [
      // KPI Cards - Row 1 (h=1.3 for natural content height matching PayrollMIS)
      { type: 'kpi', module: 'payroll', metric: 'earned_salary', title: "Today's earned salary", x: 0, y: 0, w: 3, h: 1.3, colorScheme: 'green' },
      { type: 'kpi', module: 'payroll', metric: 'total_attendance_days', title: 'Total attendance days', x: 3, y: 0, w: 3, h: 1.3, colorScheme: 'blue' },
      { type: 'kpi', module: 'payroll', metric: 'total_salary_budget', title: 'Total salary budget', x: 6, y: 0, w: 3, h: 1.3, colorScheme: 'orange' },
      { type: 'kpi', module: 'payroll', metric: 'avg_hours_employee', title: 'Avg hours/employee', x: 9, y: 0, w: 3, h: 1.3, colorScheme: 'blue' },

      // Charts - Row 2 & 3 (starting at y=1.3, h=4 for good chart visibility)
      { type: 'bar_chart', module: 'payroll', metric: 'attendance_stats', title: 'Attendance Statistics', x: 0, y: 1.3, w: 6, h: 4, colorScheme: 'blue' },
      { type: 'line_chart', module: 'payroll', metric: 'salary_overview', title: 'Salary Overview', x: 6, y: 1.3, w: 6, h: 4, colorScheme: 'green', chartType: 'area' },

      // Table - Row 4 (starting at y=5.3)
      { type: 'table', module: 'payroll', metric: 'employee_payroll', title: 'Employee Payroll Details', x: 0, y: 5.3, w: 12, h: 5, limit: 20 }
    ]

    const widgetsToInsert = payrollWidgets.map(w => ({
      dashboard_id: dashboardId,
      widget_type: w.type,
      module: w.module,
      title: w.title,
      position: { x: w.x, y: w.y, w: w.w, h: w.h },
      config: {
        metric: w.metric,
        colorScheme: w.colorScheme || 'blue',
        limit: w.limit,
        chartType: (w as any).chartType
      }
    }))

    const { data: createdWidgets } = await supabase
      .from('dashboard_widgets')
      .insert(widgetsToInsert)
      .select()

    if (createdWidgets) {
      setWidgets(createdWidgets)
    }
  }

  const loadWidgets = async (dashboardId: string) => {
    const { data, error } = await supabase
      .from('dashboard_widgets')
      .select('*')
      .eq('dashboard_id', dashboardId)
      .order('created_at', { ascending: true })

    if (data) {
      setWidgets(data)
    }
  }

  const handleAddWidget = async (widgetDef: any) => {
    if (!dashboard) return

    const newWidget: Omit<Widget, 'id' | 'created_at' | 'updated_at'> = {
      dashboard_id: dashboard.id,
      widget_type: widgetDef.type,
      module: widgetDef.module,
      title: widgetDef.label,
      config: widgetDef.defaultConfig,
      position: widgetDef.defaultSize
    }

    const { data, error } = await supabase
      .from('dashboard_widgets')
      .insert(newWidget)
      .select()
      .single()

    if (data) {
      setWidgets([...widgets, data])
      setShowWidgetSelector(false)
    }
  }

  const handleRemoveWidget = async (widgetId: string) => {
    await supabase
      .from('dashboard_widgets')
      .delete()
      .eq('id', widgetId)

    setWidgets(widgets.filter(w => w.id !== widgetId))
  }

  const handleSaveDashboard = async () => {
    if (!dashboard) return

    await supabase
      .from('custom_dashboards')
      .update({ name: dashboardName })
      .eq('id', dashboard.id)

    alert('Dashboard saved successfully!')
  }

  const handleSetAsDefault = async () => {
    if (!dashboard) return

    // Unset all other default dashboards
    await supabase
      .from('custom_dashboards')
      .update({ is_default: false })
      .neq('id', dashboard.id)

    // Set this one as default
    await supabase
      .from('custom_dashboards')
      .update({ is_default: true })
      .eq('id', dashboard.id)

    setDashboard({ ...dashboard, is_default: true })
    alert('Dashboard set as default successfully!')
  }

  const handleBackToTemplates = () => {
    navigate('/dashboard-builder/templates')
  }

  const handleBackToBuilder = () => {
    navigate('/dashboard-builder')
  }

  const handleRefreshAll = () => {
    loadWidgets(dashboard?.id || '')
  }

  const filteredWidgets = WIDGET_REGISTRY.filter(w => {
    const matchesSearch = w.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesModule = selectedModule === 'all' || w.module === selectedModule
    return matchesSearch && matchesModule
  })

  const modules = ['all', ...getAllModules()]

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={
          isEditingName ? (
            <Input
              value={dashboardName}
              onChange={(e) => setDashboardName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
              className="text-2xl font-bold w-96"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsEditingName(true)}>
              <span>{dashboardName}</span>
              <Settings className="w-4 h-4 text-gray-400" />
            </div>
          )
        }
        description="Build your custom MIS dashboard with module-wise widgets"
      />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {dashboardId && (
              <Button
                onClick={handleBackToTemplates}
                variant="outline"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Templates
              </Button>
            )}
            <Button
              onClick={handleBackToBuilder}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              Dashboard Home
            </Button>
            <Button
              onClick={() => setShowWidgetSelector(!showWidgetSelector)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Widget
            </Button>
            <Button
              onClick={handleRefreshAll}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh All
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {!dashboard?.is_default && dashboardId && (
              <Button
                onClick={handleSetAsDefault}
                variant="outline"
                className="flex items-center gap-2"
              >
                <LayoutDashboard className="w-4 h-4" />
                Set as Default
              </Button>
            )}
            {dashboard?.is_default && (
              <span className="text-sm text-gray-600 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200">
                Default Dashboard
              </span>
            )}
            <Button
              onClick={handleSaveDashboard}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Dashboard
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {showWidgetSelector && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Available Widgets</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowWidgetSelector(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="mb-4 flex items-center gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search widgets..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <select
                      value={selectedModule}
                      onChange={(e) => setSelectedModule(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {modules.map(module => (
                        <option key={module} value={module}>
                          {module === 'all' ? 'All Modules' : module.charAt(0).toUpperCase() + module.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                    {filteredWidgets.map((widgetDef) => (
                      <motion.div
                        key={`${widgetDef.type}-${widgetDef.module}`}
                        whileHover={{ scale: 1.02 }}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => handleAddWidget(widgetDef)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-gray-900 text-sm">{widgetDef.label}</h4>
                          <Plus className="w-4 h-4 text-blue-600" />
                        </div>
                        <p className="text-xs text-gray-600 mb-2">{widgetDef.description}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            {widgetDef.module}
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded">
                            {widgetDef.type.replace('_', ' ')}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : widgets.length === 0 ? (
          <div className="text-center py-16">
            <LayoutDashboard className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No widgets added yet</h3>
            <p className="text-gray-600 mb-4">Click "Add Widget" to start building your custom dashboard</p>
            <Button onClick={() => setShowWidgetSelector(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Widget
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 auto-rows-[100px]">
            {widgets.map((widget) => {
              const gridWidth = widget.position.w
              const gridHeight = widget.position.h

              return (
                <div
                  key={widget.id}
                  className="h-full"
                  style={{
                    gridColumn: `span ${gridWidth > 12 ? 12 : gridWidth}`,
                    gridRow: `span ${gridHeight}`
                  }}
                >
                  <WidgetRenderer
                    widget={widget}
                    onRemove={() => handleRemoveWidget(widget.id)}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
