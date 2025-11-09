import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AppearanceProvider } from '@/contexts/AppearanceContext'
import { OTPLogin } from '@/components/Auth/OTPLogin'
import { Layout } from '@/components/Layout/Layout'
import { Dashboard } from '@/components/Pages/Dashboard'
import { Leads } from '@/components/Pages/Leads'
import { Affiliates } from '@/components/Pages/Affiliates'
import { Team } from '@/components/Pages/Team'
import { LMS } from '@/components/Pages/LMS'
import { Templates } from '@/components/Pages/Templates'
import { Billing } from '@/components/Pages/Billing'
import { Support } from '@/components/Pages/Support'
import { Settings } from '@/components/Pages/Settings'
import { Automations } from '@/components/Pages/Automations'
import { AIAutomationLanding } from '@/components/Pages/AIAutomationLanding'
import { AIAutomationMasteryLanding } from '@/components/Pages/AIAutomationMasteryLanding'
import { Members } from '@/components/Pages/Members'
import { ToolsAccess } from '@/components/Pages/ToolsAccess'
import { PartnerPortal } from '@/components/Pages/PartnerPortal'
import { Attendance } from '@/components/Pages/Attendance'
import { Expenses } from '@/components/Pages/Expenses'
import { Products } from '@/components/Pages/Products'
import { Leave } from '@/components/Pages/Leave'
import { Contacts } from '@/components/Pages/Contacts'
import { MediaStorage } from '@/components/Pages/MediaStorage'
import { Appointments } from '@/components/Pages/Appointments'
import { Tasks } from '@/components/Pages/Tasks'
import { AIAgents } from '@/components/Pages/AIAgents'
import { AIAgentForm } from '@/components/Pages/AIAgentForm'
import { AIAgentPermissions } from '@/components/Pages/AIAgentPermissions'
import { AIAgentChat } from '@/components/Pages/AIAgentChat'
import { AIAgentLogs } from '@/components/Pages/AIAgentLogs'
import { Followups } from '@/components/Pages/Followups'
import { Reports } from '@/components/Pages/Reports'
import { PayrollMIS } from '@/components/Pages/PayrollMIS'
import { SalesReport } from '@/components/Pages/SalesReport'
import { TasksMIS } from '@/components/Pages/TasksMIS'
import { LeadsMIS } from '@/components/Pages/LeadsMIS'
import { DashboardBuilder } from '@/components/Pages/DashboardBuilder'
import { CustomDashboard } from '@/components/Dashboard/CustomDashboard'
import { DashboardTemplates } from '@/components/Dashboard/DashboardTemplates'

function ProtectedRoutes() {
  const { isAuthenticated, isLoading, login } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <OTPLogin onAuthenticated={login} />
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="affiliates" element={<Affiliates />} />
        <Route path="team" element={<Team />} />
        <Route path="members" element={<Members />} />
        <Route path="lms" element={<LMS />} />
        <Route path="templates" element={<Templates />} />
        <Route path="tools-access" element={<ToolsAccess />} />
        <Route path="billing" element={<Billing />} />
        <Route path="support" element={<Support />} />
        <Route path="automations" element={<Automations />} />
        <Route path="settings" element={<Settings />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="products" element={<Products />} />
        <Route path="leave" element={<Leave />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="media-storage" element={<MediaStorage />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="ai-agents" element={<AIAgents />} />
        <Route path="ai-agents/add" element={<AIAgentForm />} />
        <Route path="ai-agents/edit/:id" element={<AIAgentForm />} />
        <Route path="ai-agents/permissions/:id" element={<AIAgentPermissions />} />
        <Route path="ai-agents/chat/:id" element={<AIAgentChat />} />
        <Route path="ai-agents/logs" element={<AIAgentLogs />} />
        <Route path="followups" element={<Followups />} />
        <Route path="dashboard-builder" element={<DashboardBuilder />} />
        <Route path="dashboard-builder/custom" element={<CustomDashboard />} />
        <Route path="dashboard-builder/templates" element={<DashboardTemplates />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reports/payroll-mis" element={<PayrollMIS />} />
        <Route path="reports/sales" element={<SalesReport />} />
        <Route path="reports/tasks-mis" element={<TasksMIS />} />
        <Route path="reports/leads-mis" element={<LeadsMIS />} />
      </Route>
      <Route path="/ai-automation-mastery" element={<AIAutomationLanding />} />
      <Route path="/templates/landing-pages1" element={<AIAutomationMasteryLanding />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppearanceProvider>
        <Router>
          <Routes>
            <Route path="/partner" element={<PartnerPortal />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </Router>
      </AppearanceProvider>
    </AuthProvider>
  )
}

export default App