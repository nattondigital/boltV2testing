import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Users, UserCheck, Link as LinkIcon, Shield,
  Library, Zap, FileText, HelpCircle, Settings, Sparkles, CreditCard, GraduationCap, Wrench, ChevronDown, Clock, Receipt, Package, CalendarOff, Contact, FolderOpen, Menu, X, Calendar, CheckSquare, Bot, MessageSquare, TrendingUp, LayoutDashboard
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sidebar as SidebarContainer } from '@/components/ui/sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { ModuleName } from '@/lib/permissions'

const navigation = [
  { icon: BarChart, label: 'Dashboard', to: '/dashboard' },
]

const otherModulesNavigation = [
  { icon: FolderOpen, label: 'Media Storage', to: '/media-storage', module: 'media' as ModuleName },
  { icon: FileText, label: 'Templates', to: '/templates' },
  { icon: Zap, label: 'Automations', to: '/automations', module: 'automations' as ModuleName },
]

const settingsNavigation = [
  { icon: Settings, label: 'Settings', to: '/settings', module: 'settings' as ModuleName },
]

const salesManagementNavigation = [
  { icon: Users, label: 'Leads CRM', to: '/leads', module: 'leads' as ModuleName },
  { icon: Calendar, label: 'Appointments', to: '/appointments', module: 'appointments' as ModuleName },
  { icon: MessageSquare, label: 'Followups', to: '/followups', module: 'leads' as ModuleName },
]

const mastersNavigation = [
  { icon: Package, label: 'Products', to: '/products', module: 'products' as ModuleName },
  { icon: Contact, label: 'Contacts', to: '/contacts', module: 'contacts' as ModuleName },
  { icon: LinkIcon, label: 'Affiliates', to: '/affiliates', module: 'affiliates' as ModuleName },
  { icon: Shield, label: 'Team', to: '/team', module: 'team' as ModuleName },
  { icon: GraduationCap, label: 'LMS', to: '/lms', module: 'lms' as ModuleName },
]

const membersManagementNavigation = [
  { icon: UserCheck, label: 'Enrolled Members', to: '/members', module: 'enrolled_members' as ModuleName },
  { icon: Wrench, label: 'Tools Access', to: '/tools-access', module: 'enrolled_members' as ModuleName },
  { icon: CreditCard, label: 'Billing', to: '/billing', module: 'billing' as ModuleName },
  { icon: HelpCircle, label: 'Support', to: '/support', module: 'support' as ModuleName }
]

const teamManagementNavigation = [
  { icon: Clock, label: 'Attendance', to: '/attendance', module: 'attendance' as ModuleName },
  { icon: Receipt, label: 'Expenses', to: '/expenses', module: 'expenses' as ModuleName },
  { icon: CalendarOff, label: 'Leave', to: '/leave', module: 'leave' as ModuleName },
  { icon: CheckSquare, label: 'Tasks', to: '/tasks', module: 'tasks' as ModuleName }
]

const aiAgentsNavigation = [
  { icon: Bot, label: 'Agents List', to: '/ai-agents', module: 'ai_agents' as ModuleName },
  { icon: Zap, label: 'Activity Logs', to: '/ai-agents/logs', module: 'ai_agents' as ModuleName }
]

const misReportingNavigation = [
  { icon: LayoutDashboard, label: 'Dashboard Builder', to: '/dashboard-builder' },
  { icon: TrendingUp, label: 'Reports', to: '/reports' }
]

interface SidebarProps {
  collapsed?: boolean
  onClose?: () => void
}

export function Sidebar({ collapsed = false, onClose }: SidebarProps) {
  const location = useLocation()
  const { hasAnyPermission } = useAuth()
  const [salesExpanded, setSalesExpanded] = useState(true)
  const [mastersExpanded, setMastersExpanded] = useState(false)
  const [membersExpanded, setMembersExpanded] = useState(false)
  const [teamExpanded, setTeamExpanded] = useState(false)
  const [aiAgentsExpanded, setAiAgentsExpanded] = useState(true)
  const [misReportingExpanded, setMisReportingExpanded] = useState(false)
  const [otherModulesExpanded, setOtherModulesExpanded] = useState(false)

  const filterNavByPermission = (navItems: any[]) => {
    return navItems.filter(item => {
      if (!item.module) return true
      return hasAnyPermission(item.module)
    })
  }

  const visibleSalesNav = filterNavByPermission(salesManagementNavigation)
  const visibleMastersNav = filterNavByPermission(mastersNavigation)
  const visibleMembersNav = filterNavByPermission(membersManagementNavigation)
  const visibleTeamNav = filterNavByPermission(teamManagementNavigation)
  const visibleAiAgentsNav = filterNavByPermission(aiAgentsNavigation)
  const visibleOtherModulesNav = filterNavByPermission(otherModulesNavigation)
  const visibleSettingsNav = filterNavByPermission(settingsNavigation)

  return (
    <SidebarContainer collapsed={collapsed}>
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-border bg-gradient-to-r from-brand-primary to-brand-accent">
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="flex items-center space-x-2 text-white"
        >
          <Sparkles className={cn("h-8 w-8", collapsed && "h-6 w-6")} />
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="text-xl font-bold tracking-tight whitespace-nowrap"
            >
              CA Dashboard
            </motion.span>
          )}
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className={cn(
        "flex-1 space-y-1 sidebar-nav overflow-y-auto",
        collapsed ? "p-2" : "p-4"
      )}>
        {navigation.map((item) => {
          const isActive = location.pathname === item.to
          const Icon = item.icon

          return (
            <motion.div
              key={item.to}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                to={item.to}
                onClick={onClose}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  collapsed && "justify-center px-2",
                  isActive
                    ? "bg-brand-primary text-white shadow-lg"
                    : "text-gray-600 hover:bg-brand-primary/10 hover:text-brand-primary"
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && (
                  <span className="ml-3 truncate">{item.label}</span>
                )}
                {isActive && !collapsed && (
                  <motion.div
                    className="ml-auto h-2 w-2 rounded-full bg-brand-accent"
                    layoutId="activeIndicator"
                  />
                )}
              </Link>
            </motion.div>
          )
        })}

        {/* Sales Management Section */}
        {!collapsed && visibleSalesNav.length > 0 && (
          <div className="pt-4">
            <button
              onClick={() => setSalesExpanded(!salesExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
            >
              <span>Sales Management</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  salesExpanded && "transform rotate-180"
                )}
              />
            </button>
          </div>
        )}

        <AnimatePresence>
          {salesExpanded && visibleSalesNav.map((item) => {
            const isActive = location.pathname === item.to
            const Icon = item.icon

            return (
              <motion.div
                key={item.to}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to={item.to}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    !collapsed && "ml-3",
                    collapsed && "justify-center px-2",
                    isActive
                      ? "bg-brand-primary text-white shadow-lg"
                      : "text-gray-600 hover:bg-brand-primary/10 hover:text-brand-primary"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="ml-3 truncate">{item.label}</span>
                  )}
                  {isActive && !collapsed && (
                    <motion.div
                      className="ml-auto h-2 w-2 rounded-full bg-brand-accent"
                      layoutId="activeIndicator"
                    />
                  )}
                </Link>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Client Management Section */}
        {!collapsed && visibleMembersNav.length > 0 && (
          <div className="pt-4">
            <button
              onClick={() => setMembersExpanded(!membersExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
            >
              <span>Client Management</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  membersExpanded && "transform rotate-180"
                )}
              />
            </button>
          </div>
        )}

        <AnimatePresence>
          {membersExpanded && visibleMembersNav.map((item) => {
            const isActive = location.pathname === item.to
            const Icon = item.icon

            return (
              <motion.div
                key={item.to}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to={item.to}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    !collapsed && "ml-3",
                    collapsed && "justify-center px-2",
                    isActive
                      ? "bg-brand-primary text-white shadow-lg"
                      : "text-gray-600 hover:bg-brand-primary/10 hover:text-brand-primary"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="ml-3 truncate">{item.label}</span>
                  )}
                  {isActive && !collapsed && (
                    <motion.div
                      className="ml-auto h-2 w-2 rounded-full bg-brand-accent"
                      layoutId="activeIndicator"
                    />
                  )}
                </Link>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Masters Section */}
        {!collapsed && visibleMastersNav.length > 0 && (
          <div className="pt-4">
            <button
              onClick={() => setMastersExpanded(!mastersExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
            >
              <span>Masters</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  mastersExpanded && "transform rotate-180"
                )}
              />
            </button>
          </div>
        )}

        <AnimatePresence>
          {mastersExpanded && visibleMastersNav.map((item) => {
            const isActive = location.pathname === item.to
            const Icon = item.icon

            return (
              <motion.div
                key={item.to}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to={item.to}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    !collapsed && "ml-3",
                    collapsed && "justify-center px-2",
                    isActive
                      ? "bg-brand-primary text-white shadow-lg"
                      : "text-gray-600 hover:bg-brand-primary/10 hover:text-brand-primary"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="ml-3 truncate">{item.label}</span>
                  )}
                  {isActive && !collapsed && (
                    <motion.div
                      className="ml-auto h-2 w-2 rounded-full bg-brand-accent"
                      layoutId="activeIndicator"
                    />
                  )}
                </Link>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Team Management Section */}
        {!collapsed && visibleTeamNav.length > 0 && (
          <div className="pt-4">
            <button
              onClick={() => setTeamExpanded(!teamExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
            >
              <span>Team Management</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  teamExpanded && "transform rotate-180"
                )}
              />
            </button>
          </div>
        )}

        <AnimatePresence>
          {teamExpanded && visibleTeamNav.map((item) => {
            const isActive = location.pathname === item.to
            const Icon = item.icon

            return (
              <motion.div
                key={item.to}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to={item.to}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    !collapsed && "ml-3",
                    collapsed && "justify-center px-2",
                    isActive
                      ? "bg-brand-primary text-white shadow-lg"
                      : "text-gray-600 hover:bg-brand-primary/10 hover:text-brand-primary"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="ml-3 truncate">{item.label}</span>
                  )}
                  {isActive && !collapsed && (
                    <motion.div
                      className="ml-auto h-2 w-2 rounded-full bg-brand-accent"
                      layoutId="activeIndicator"
                    />
                  )}
                </Link>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* AI Agents Section */}
        {!collapsed && visibleAiAgentsNav.length > 0 && (
          <div className="pt-4">
            <button
              onClick={() => setAiAgentsExpanded(!aiAgentsExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
            >
              <span>AI Agents</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  aiAgentsExpanded && "transform rotate-180"
                )}
              />
            </button>
          </div>
        )}

        <AnimatePresence>
          {aiAgentsExpanded && visibleAiAgentsNav.map((item) => {
            const isActive = location.pathname === item.to
            const Icon = item.icon

            return (
              <motion.div
                key={item.to}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to={item.to}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    !collapsed && "ml-3",
                    collapsed && "justify-center px-2",
                    isActive
                      ? "bg-brand-primary text-white shadow-lg"
                      : "text-gray-600 hover:bg-brand-primary/10 hover:text-brand-primary"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="ml-3 truncate">{item.label}</span>
                  )}
                  {isActive && !collapsed && (
                    <motion.div
                      className="ml-auto h-2 w-2 rounded-full bg-brand-accent"
                      layoutId="activeIndicator"
                    />
                  )}
                </Link>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* MIS Reporting Section */}
        {!collapsed && (
          <div className="pt-4">
            <button
              onClick={() => setMisReportingExpanded(!misReportingExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
            >
              <span>MIS Reporting</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  misReportingExpanded && "transform rotate-180"
                )}
              />
            </button>
          </div>
        )}

        <AnimatePresence>
          {misReportingExpanded && misReportingNavigation.map((item) => {
            const isActive = location.pathname === item.to
            const Icon = item.icon

            return (
              <motion.div
                key={item.to}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to={item.to}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    !collapsed && "ml-3",
                    collapsed && "justify-center px-2",
                    isActive
                      ? "bg-brand-primary text-white shadow-lg"
                      : "text-gray-600 hover:bg-brand-primary/10 hover:text-brand-primary"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="ml-3 truncate">{item.label}</span>
                  )}
                  {isActive && !collapsed && (
                    <motion.div
                      className="ml-auto h-2 w-2 rounded-full bg-brand-accent"
                      layoutId="activeIndicator"
                    />
                  )}
                </Link>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Other Modules Section */}
        {!collapsed && visibleOtherModulesNav.length > 0 && (
          <div className="pt-4">
            <button
              onClick={() => setOtherModulesExpanded(!otherModulesExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
            >
              <span>Other Modules</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  otherModulesExpanded && "transform rotate-180"
                )}
              />
            </button>
          </div>
        )}

        <AnimatePresence>
          {otherModulesExpanded && visibleOtherModulesNav.map((item) => {
            const isActive = location.pathname === item.to
            const Icon = item.icon

            return (
              <motion.div
                key={item.to}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to={item.to}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    !collapsed && "ml-3",
                    collapsed && "justify-center px-2",
                    isActive
                      ? "bg-brand-primary text-white shadow-lg"
                      : "text-gray-600 hover:bg-brand-primary/10 hover:text-brand-primary"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="ml-3 truncate">{item.label}</span>
                  )}
                  {isActive && !collapsed && (
                    <motion.div
                      className="ml-auto h-2 w-2 rounded-full bg-brand-accent"
                      layoutId="activeIndicator"
                    />
                  )}
                </Link>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Settings Section */}
        <div className="pt-4">
          {visibleSettingsNav.map((item) => {
            const isActive = location.pathname === item.to
            const Icon = item.icon

            return (
              <motion.div
                key={item.to}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to={item.to}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    collapsed && "justify-center px-2",
                    isActive
                      ? "bg-brand-primary text-white shadow-lg"
                      : "text-gray-600 hover:bg-brand-primary/10 hover:text-brand-primary"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="ml-3 truncate">{item.label}</span>
                  )}
                  {isActive && !collapsed && (
                    <motion.div
                      className="ml-auto h-2 w-2 rounded-full bg-brand-accent"
                      layoutId="activeIndicator"
                    />
                  )}
                </Link>
              </motion.div>
            )
          })}
        </div>
      </nav>
      {/* Footer */}
      <div className={cn("border-t border-border", collapsed ? "p-2" : "p-4")}>
        <div className={cn(
          "flex items-center",
          collapsed ? "justify-center" : "justify-between"
        )}>
          <div className="flex items-center">
            <div
              className="h-8 w-8 rounded-full bg-gradient-to-r from-brand-primary to-brand-accent flex items-center justify-center"
              title={collapsed ? "AI Assistant - Ready to help" : undefined}
            >
              <span className="text-xs font-medium text-white">AI</span>
            </div>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="ml-3"
              >
                <p className="text-xs font-medium text-gray-900">AI Assistant</p>
                <p className="text-xs text-gray-500">Ready to help</p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </SidebarContainer>
  )
}