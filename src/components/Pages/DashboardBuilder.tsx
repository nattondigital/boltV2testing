import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, Sparkles, Plus } from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface BuilderCard {
  id: string
  title: string
  description: string
  icon: React.ElementType
  color: string
  bgColor: string
  route: string
}

const builderCards: BuilderCard[] = [
  {
    id: 'custom-dashboard',
    title: 'Custom Dashboard Builder',
    description: 'Build your own custom MIS dashboard with module-wise widgets tailored to your needs',
    icon: LayoutDashboard,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    route: '/dashboard-builder/custom'
  },
  {
    id: 'dashboard-templates',
    title: 'Dashboard Templates',
    description: 'Choose from pre-built dashboard templates for Executive, Sales, HR, Finance, and Operations',
    icon: Sparkles,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    route: '/dashboard-builder/templates'
  }
]

export function DashboardBuilder() {
  const navigate = useNavigate()

  const handleCardClick = (card: BuilderCard) => {
    navigate(card.route)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Dashboard Builder"
        description="Create custom MIS dashboards with powerful widgets or choose from templates"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {builderCards.map((card, index) => {
            const Icon = card.icon
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card
                  className="h-full cursor-pointer transition-all duration-200 hover:shadow-xl border-2 border-blue-200 hover:border-blue-500 bg-gradient-to-br from-white to-blue-50"
                  onClick={() => handleCardClick(card)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className={`p-4 rounded-xl ${card.bgColor} ring-2 ring-blue-200`}>
                        <Icon className={`h-10 w-10 ${card.color}`} />
                      </div>
                    </div>
                    <CardTitle className="mt-4 text-xl">{card.title}</CardTitle>
                    <CardDescription className="text-sm mt-2">
                      {card.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" />
                      Get Started
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl shadow-sm border border-blue-200 p-8">
          <h3 className="text-2xl font-semibold text-gray-900 mb-6">About Dashboard Builder</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="text-4xl font-bold text-blue-600 mb-2">50+</div>
              <div className="text-sm text-gray-600">Available Widgets</div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="text-4xl font-bold text-purple-600 mb-2">6</div>
              <div className="text-sm text-gray-600">Dashboard Templates</div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="text-4xl font-bold text-green-600 mb-2">12</div>
              <div className="text-sm text-gray-600">Module Categories</div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h4 className="font-semibold text-gray-900 mb-3">Key Features</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Drag and drop widgets to create custom layouts</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Real-time data from all your business modules</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Pre-built templates for common use cases</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>KPI cards, charts, tables, and activity feeds</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Save and share dashboards with your team</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
