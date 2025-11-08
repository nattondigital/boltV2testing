import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import {
  Plus, Save, Layout, Grid, Settings, X, ChevronRight, Search,
  LayoutDashboard, RefreshCw
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
  const [searchParams] = useSearchParams()
  const dashboardId = searchParams.get('id')

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
      let dashboardData = null

      // If ID is provided, load that specific dashboard
      if (dashboardId) {
        const { data } = await supabase
          .from('custom_dashboards')
          .select('*')
          .eq('id', dashboardId)
          .single()
        dashboardData = data
      } else {
        // Otherwise load the default dashboard
        const { data } = await supabase
          .from('custom_dashboards')
          .select('*')
          .eq('is_default', true)
          .single()
        dashboardData = data
      }

      if (dashboardData) {
        setDashboard(dashboardData)
        setDashboardName(dashboardData.name)
        await loadWidgets(dashboardData.id)
      } else {
        await createDefaultDashboard()
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const createDefaultDashboard = async () => {
    const { data: newDashboard, error } = await supabase
      .from('custom_dashboards')
      .insert({
        name: 'My Dashboard',
        description: 'Custom MIS Dashboard',
        is_default: true,
        layout_config: { cols: 12, rowHeight: 100 }
      })
      .select()
      .single()

    if (newDashboard) {
      setDashboard(newDashboard)
      setDashboardName(newDashboard.name)
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
                  className={`col-span-${gridWidth > 12 ? 12 : gridWidth} row-span-${gridHeight}`}
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
