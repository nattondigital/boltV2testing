import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Users, UserCheck, Link as LinkIcon, Shield,
  Library, Zap, FileText, HelpCircle, Settings, Sparkles, CreditCard, GraduationCap, Wrench, ChevronDown, Clock, Receipt, Package, CalendarOff, Contact, FolderOpen, Menu, X, Calendar, CheckSquare, Bot, MessageSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sidebar as SidebarContainer } from '@/components/ui/sidebar'

const navigation = [
  { icon: BarChart, label: 'Dashboard', to: '/dashboard' },
]

const otherModulesNavigation = [
  { icon: FolderOpen, label: 'Media Storage', to: '/media-storage' },
  { icon: FileText, label: 'Templates', to: '/templates' },
  { icon: Zap, label: 'Automations', to: '/automations' },
]

const settingsNavigation = [
  { icon: Settings, label: 'Settings', to: '/settings' },
]

const salesManagementNavigation = [
  { icon: Users, label: 'Leads CRM', to: '/leads' },
  { icon: Calendar, label: 'Appointments', to: '/appointments' },
  { icon: MessageSquare, label: 'Followups', to: '/followups' },
]

const mastersNavigation = [
  { icon: Package, label: 'Products', to: '/products' },
  { icon: Contact, label: 'Contacts', to: '/contacts' },
  { icon: LinkIcon, label: 'Affiliates', to: '/affiliates' },
  { icon: Shield, label: 'Team', to: '/team' },
  { icon: Library, label: 'Courses', to: '/courses' },
  { icon: GraduationCap, label: 'LMS', to: '/lms' },
]

const membersManagementNavigation = [
  { icon: UserCheck, label: 'Enrolled Members', to: '/members' },
  { icon: Wrench, label: 'Tools Access', to: '/tools-access' },
  { icon: CreditCard, label: 'Billing', to: '/billing' },
  { icon: HelpCircle, label: 'Support', to: '/support' }
]

const teamManagementNavigation = [
  { icon: Clock, label: 'Attendance', to: '/attendance' },
  { icon: Receipt, label: 'Expenses', to: '/expenses' },
  { icon: CalendarOff, label: 'Leave', to: '/leave' },
  { icon: CheckSquare, label: 'Tasks', to: '/tasks' }
]

const aiAgentsNavigation = [
  { icon: Bot, label: 'Agents List', to: '/ai-agents' },
  { icon: Zap, label: 'Activity Logs', to: '/ai-agents/logs' }
]

interface SidebarProps {
  collapsed?: boolean
  onClose?: () => void
}

export function Sidebar({ collapsed = false, onClose }: SidebarProps) {
  const location = useLocation()
  const [salesExpanded, setSalesExpanded] = useState(false)
  const [mastersExpanded, setMastersExpanded] = useState(false)
  const [membersExpanded, setMembersExpanded] = useState(false)
  const [teamExpanded, setTeamExpanded] = useState(false)
  const [aiAgentsExpanded, setAiAgentsExpanded] = useState(true)
  const [otherModulesExpanded, setOtherModulesExpanded] = useState(false)

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
              AIA Coach
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
        {!collapsed && (
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
          {salesExpanded && salesManagementNavigation.map((item) => {
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
        {!collapsed && (
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
          {mastersExpanded && mastersNavigation.map((item) => {
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

        {/* Members Management Section */}
        {!collapsed && (
          <div className="pt-4">
            <button
              onClick={() => setMembersExpanded(!membersExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
            >
              <span>Members Management</span>
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
          {membersExpanded && membersManagementNavigation.map((item) => {
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
        {!collapsed && (
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
          {teamExpanded && teamManagementNavigation.map((item) => {
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
        {!collapsed && (
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
          {aiAgentsExpanded && aiAgentsNavigation.map((item) => {
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
        {!collapsed && (
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
          {otherModulesExpanded && otherModulesNavigation.map((item) => {
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
          {settingsNavigation.map((item) => {
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