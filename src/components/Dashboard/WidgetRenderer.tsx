import React from 'react'
import { Widget } from '@/types/dashboard'
import { KPIWidget } from './Widgets/KPIWidget'
import { ChartWidget } from './Widgets/ChartWidget'
import { FunnelWidget } from './Widgets/FunnelWidget'
import { ActivityFeedWidget } from './Widgets/ActivityFeedWidget'
import { TableWidget } from './Widgets/TableWidget'

interface WidgetRendererProps {
  widget: Widget
  onRefresh?: () => void
  onRemove?: () => void
  onConfig?: () => void
}

export function WidgetRenderer({ widget, onRefresh, onRemove, onConfig }: WidgetRendererProps) {
  switch (widget.widget_type) {
    case 'kpi_card':
      return <KPIWidget widget={widget} onRefresh={onRefresh} onRemove={onRemove} onConfig={onConfig} />

    case 'bar_chart':
    case 'line_chart':
    case 'area_chart':
    case 'pie_chart':
      return <ChartWidget widget={widget} onRefresh={onRefresh} onRemove={onRemove} onConfig={onConfig} />

    case 'funnel':
      return <FunnelWidget widget={widget} onRefresh={onRefresh} onRemove={onRemove} onConfig={onConfig} />

    case 'activity_feed':
      return <ActivityFeedWidget widget={widget} onRefresh={onRefresh} onRemove={onRemove} onConfig={onConfig} />

    case 'table':
      return <TableWidget widget={widget} onRefresh={onRefresh} onRemove={onRemove} onConfig={onConfig} />

    default:
      return (
        <div className="p-4 bg-gray-100 rounded-lg border border-gray-300">
          <p className="text-sm text-gray-600">Widget type "{widget.widget_type}" not implemented yet</p>
        </div>
      )
  }
}
