import { WidgetDefinition } from '@/types/dashboard'

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    type: 'kpi_card',
    module: 'leads',
    label: 'Leads KPI Card',
    description: 'Display key lead metrics like total leads, conversion rate, etc.',
    icon: 'Users',
    defaultSize: { x: 0, y: 0, w: 3, h: 2 },
    defaultConfig: {
      metric: 'total_leads',
      timeRange: '30d',
      colorScheme: 'blue'
    },
    configOptions: [
      {
        name: 'metric',
        label: 'Metric',
        type: 'select',
        options: [
          { value: 'total_leads', label: 'Total Leads' },
          { value: 'new_leads', label: 'New Leads' },
          { value: 'hot_leads', label: 'Hot Leads' },
          { value: 'conversion_rate', label: 'Conversion Rate' },
          { value: 'contacted_leads', label: 'Contacted Leads' }
        ],
        default: 'total_leads'
      },
      {
        name: 'timeRange',
        label: 'Time Range',
        type: 'select',
        options: [
          { value: '7d', label: 'Last 7 Days' },
          { value: '30d', label: 'Last 30 Days' },
          { value: '90d', label: 'Last 90 Days' },
          { value: 'all', label: 'All Time' }
        ],
        default: '30d'
      }
    ]
  },
  {
    type: 'funnel',
    module: 'leads',
    label: 'Lead Conversion Funnel',
    description: 'Visualize lead progression through stages',
    icon: 'TrendingUp',
    defaultSize: { x: 0, y: 0, w: 6, h: 4 },
    defaultConfig: {
      timeRange: '30d',
      showPercentages: true
    }
  },
  {
    type: 'bar_chart',
    module: 'leads',
    label: 'Lead Sources Chart',
    description: 'Bar chart showing leads by source',
    icon: 'BarChart3',
    defaultSize: { x: 0, y: 0, w: 6, h: 4 },
    defaultConfig: {
      metric: 'lead_sources',
      timeRange: '30d',
      chartType: 'bar'
    }
  },
  {
    type: 'kpi_card',
    module: 'members',
    label: 'Members KPI Card',
    description: 'Display member metrics',
    icon: 'UserPlus',
    defaultSize: { x: 0, y: 0, w: 3, h: 2 },
    defaultConfig: {
      metric: 'total_members',
      timeRange: '30d',
      colorScheme: 'green'
    },
    configOptions: [
      {
        name: 'metric',
        label: 'Metric',
        type: 'select',
        options: [
          { value: 'total_members', label: 'Total Members' },
          { value: 'active_members', label: 'Active Members' },
          { value: 'new_members', label: 'New Members' },
          { value: 'churn_rate', label: 'Churn Rate' }
        ],
        default: 'total_members'
      }
    ]
  },
  {
    type: 'pie_chart',
    module: 'members',
    label: 'Member Plans Distribution',
    description: 'Pie chart showing members by plan',
    icon: 'PieChart',
    defaultSize: { x: 0, y: 0, w: 4, h: 4 },
    defaultConfig: {
      metric: 'plans_distribution',
      showLegend: true
    }
  },
  {
    type: 'kpi_card',
    module: 'billing',
    label: 'Revenue KPI Card',
    description: 'Display revenue metrics',
    icon: 'DollarSign',
    defaultSize: { x: 0, y: 0, w: 3, h: 2 },
    defaultConfig: {
      metric: 'total_revenue',
      timeRange: '30d',
      colorScheme: 'green'
    },
    configOptions: [
      {
        name: 'metric',
        label: 'Metric',
        type: 'select',
        options: [
          { value: 'total_revenue', label: 'Total Revenue' },
          { value: 'monthly_revenue', label: 'Monthly Revenue' },
          { value: 'outstanding_amount', label: 'Outstanding Amount' },
          { value: 'paid_invoices', label: 'Paid Invoices' },
          { value: 'pending_invoices', label: 'Pending Invoices' }
        ],
        default: 'total_revenue'
      }
    ]
  },
  {
    type: 'area_chart',
    module: 'billing',
    label: 'Revenue Trend Chart',
    description: 'Area chart showing revenue over time',
    icon: 'TrendingUp',
    defaultSize: { x: 0, y: 0, w: 6, h: 4 },
    defaultConfig: {
      metric: 'revenue_trend',
      timeRange: '90d',
      showGrid: true
    }
  },
  {
    type: 'table',
    module: 'billing',
    label: 'Invoices Table',
    description: 'Table showing invoice details',
    icon: 'FileText',
    defaultSize: { x: 0, y: 0, w: 12, h: 5 },
    defaultConfig: {
      limit: 10,
      sortBy: 'date',
      sortOrder: 'desc',
      filters: { status: 'all' }
    }
  },
  {
    type: 'table',
    module: 'leads',
    label: 'Leads Table',
    description: 'Table showing leads details',
    icon: 'FileText',
    defaultSize: { x: 0, y: 0, w: 12, h: 5 },
    defaultConfig: {
      limit: 10,
      sortBy: 'created_at',
      sortOrder: 'desc'
    }
  },
  {
    type: 'table',
    module: 'support',
    label: 'Support Tickets Table',
    description: 'Table showing support ticket details',
    icon: 'FileText',
    defaultSize: { x: 0, y: 0, w: 12, h: 5 },
    defaultConfig: {
      limit: 10,
      sortBy: 'created_at',
      sortOrder: 'desc'
    }
  },
  {
    type: 'table',
    module: 'tasks',
    label: 'Tasks Table',
    description: 'Table showing task details',
    icon: 'FileText',
    defaultSize: { x: 0, y: 0, w: 12, h: 5 },
    defaultConfig: {
      limit: 10,
      sortBy: 'created_at',
      sortOrder: 'desc'
    }
  },
  {
    type: 'table',
    module: 'expenses',
    label: 'Expenses Table',
    description: 'Table showing expense details',
    icon: 'FileText',
    defaultSize: { x: 0, y: 0, w: 12, h: 5 },
    defaultConfig: {
      limit: 10,
      sortBy: 'expense_date',
      sortOrder: 'desc'
    }
  },
  {
    type: 'table',
    module: 'members',
    label: 'Members Table',
    description: 'Table showing enrolled members details',
    icon: 'FileText',
    defaultSize: { x: 0, y: 0, w: 12, h: 5 },
    defaultConfig: {
      limit: 10,
      sortBy: 'enrollment_date',
      sortOrder: 'desc'
    }
  },
  {
    type: 'kpi_card',
    module: 'attendance',
    label: 'Attendance KPI Card',
    description: 'Display attendance metrics',
    icon: 'Calendar',
    defaultSize: { x: 0, y: 0, w: 3, h: 2 },
    defaultConfig: {
      metric: 'present_today',
      colorScheme: 'blue'
    },
    configOptions: [
      {
        name: 'metric',
        label: 'Metric',
        type: 'select',
        options: [
          { value: 'present_today', label: 'Present Today' },
          { value: 'absent_today', label: 'Absent Today' },
          { value: 'total_hours', label: 'Total Hours' },
          { value: 'overtime_hours', label: 'Overtime Hours' }
        ],
        default: 'present_today'
      }
    ]
  },
  {
    type: 'bar_chart',
    module: 'attendance',
    label: 'Weekly Attendance Chart',
    description: 'Bar chart showing attendance by day',
    icon: 'BarChart3',
    defaultSize: { x: 0, y: 0, w: 6, h: 4 },
    defaultConfig: {
      timeRange: '7d',
      chartType: 'bar'
    }
  },
  {
    type: 'kpi_card',
    module: 'courses',
    label: 'Courses KPI Card',
    description: 'Display course metrics',
    icon: 'BookOpen',
    defaultSize: { x: 0, y: 0, w: 3, h: 2 },
    defaultConfig: {
      metric: 'total_students',
      colorScheme: 'purple'
    },
    configOptions: [
      {
        name: 'metric',
        label: 'Metric',
        type: 'select',
        options: [
          { value: 'total_students', label: 'Total Students' },
          { value: 'active_courses', label: 'Active Courses' },
          { value: 'completion_rate', label: 'Completion Rate' },
          { value: 'avg_rating', label: 'Average Rating' }
        ],
        default: 'total_students'
      }
    ]
  },
  {
    type: 'list',
    module: 'courses',
    label: 'Top Courses List',
    description: 'List of top performing courses',
    icon: 'List',
    defaultSize: { x: 0, y: 0, w: 4, h: 4 },
    defaultConfig: {
      limit: 5,
      sortBy: 'students',
      sortOrder: 'desc'
    }
  },
  {
    type: 'kpi_card',
    module: 'affiliates',
    label: 'Affiliates KPI Card',
    description: 'Display affiliate metrics',
    icon: 'Link',
    defaultSize: { x: 0, y: 0, w: 3, h: 2 },
    defaultConfig: {
      metric: 'total_affiliates',
      colorScheme: 'purple'
    },
    configOptions: [
      {
        name: 'metric',
        label: 'Metric',
        type: 'select',
        options: [
          { value: 'total_affiliates', label: 'Total Affiliates' },
          { value: 'active_affiliates', label: 'Active Affiliates' },
          { value: 'total_referrals', label: 'Total Referrals' },
          { value: 'total_earnings', label: 'Total Earnings' }
        ],
        default: 'total_affiliates'
      }
    ]
  },
  {
    type: 'kpi_card',
    module: 'support',
    label: 'Support KPI Card',
    description: 'Display support metrics',
    icon: 'HelpCircle',
    defaultSize: { x: 0, y: 0, w: 3, h: 2 },
    defaultConfig: {
      metric: 'open_tickets',
      colorScheme: 'orange'
    },
    configOptions: [
      {
        name: 'metric',
        label: 'Metric',
        type: 'select',
        options: [
          { value: 'open_tickets', label: 'Open Tickets' },
          { value: 'resolved_tickets', label: 'Resolved Tickets' },
          { value: 'avg_response_time', label: 'Avg Response Time' },
          { value: 'satisfaction_score', label: 'Satisfaction Score' }
        ],
        default: 'open_tickets'
      }
    ]
  },
  {
    type: 'pie_chart',
    module: 'support',
    label: 'Tickets by Status',
    description: 'Pie chart showing ticket distribution',
    icon: 'PieChart',
    defaultSize: { x: 0, y: 0, w: 4, h: 4 },
    defaultConfig: {
      metric: 'tickets_by_status',
      showLegend: true
    }
  },
  {
    type: 'kpi_card',
    module: 'tasks',
    label: 'Tasks KPI Card',
    description: 'Display task metrics',
    icon: 'CheckCircle',
    defaultSize: { x: 0, y: 0, w: 3, h: 2 },
    defaultConfig: {
      metric: 'pending_tasks',
      colorScheme: 'blue'
    },
    configOptions: [
      {
        name: 'metric',
        label: 'Metric',
        type: 'select',
        options: [
          { value: 'pending_tasks', label: 'Pending Tasks' },
          { value: 'completed_tasks', label: 'Completed Tasks' },
          { value: 'overdue_tasks', label: 'Overdue Tasks' },
          { value: 'tasks_due_today', label: 'Due Today' }
        ],
        default: 'pending_tasks'
      }
    ]
  },
  {
    type: 'activity_feed',
    module: 'leads',
    label: 'Recent Activity Feed',
    description: 'Live feed of recent activities',
    icon: 'Activity',
    defaultSize: { x: 0, y: 0, w: 4, h: 6 },
    defaultConfig: {
      limit: 10,
      modules: ['leads', 'members', 'support']
    }
  },
  {
    type: 'kpi_card',
    module: 'expenses',
    label: 'Expenses KPI Card',
    description: 'Display expense metrics',
    icon: 'Receipt',
    defaultSize: { x: 0, y: 0, w: 3, h: 2 },
    defaultConfig: {
      metric: 'total_expenses',
      timeRange: '30d',
      colorScheme: 'red'
    },
    configOptions: [
      {
        name: 'metric',
        label: 'Metric',
        type: 'select',
        options: [
          { value: 'total_expenses', label: 'Total Expenses' },
          { value: 'pending_expenses', label: 'Pending Expenses' },
          { value: 'approved_expenses', label: 'Approved Expenses' },
          { value: 'rejected_expenses', label: 'Rejected Expenses' }
        ],
        default: 'total_expenses'
      }
    ]
  },
  {
    type: 'kpi_card',
    module: 'automations',
    label: 'Automations KPI Card',
    description: 'Display automation metrics',
    icon: 'Zap',
    defaultSize: { x: 0, y: 0, w: 3, h: 2 },
    defaultConfig: {
      metric: 'active_automations',
      colorScheme: 'orange'
    },
    configOptions: [
      {
        name: 'metric',
        label: 'Metric',
        type: 'select',
        options: [
          { value: 'active_automations', label: 'Active Automations' },
          { value: 'total_runs', label: 'Total Runs' },
          { value: 'success_rate', label: 'Success Rate' },
          { value: 'runs_today', label: 'Runs Today' }
        ],
        default: 'active_automations'
      }
    ]
  }
]

export function getWidgetDefinition(type: string, module: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY.find(w => w.type === type && w.module === module)
}

export function getWidgetsByModule(module: string): WidgetDefinition[] {
  return WIDGET_REGISTRY.filter(w => w.module === module)
}

export function getAllModules(): string[] {
  const modules = new Set(WIDGET_REGISTRY.map(w => w.module))
  return Array.from(modules)
}
