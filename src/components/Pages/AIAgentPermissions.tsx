import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Save, ArrowLeft, Check, X as XIcon, Server } from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

interface MCPServerConfig {
  enabled: boolean
  tools: string[]
}

interface MCPPermissions {
  [serverName: string]: MCPServerConfig
}

// Define available MCP servers and their tools
const MCP_SERVERS = {
  'tasks-server': {
    name: 'Tasks Server',
    description: 'Manage tasks, assignments, and workflow tracking',
    tools: [
      { id: 'get_tasks', name: 'Get Tasks', description: 'View and search tasks' },
      { id: 'create_task', name: 'Create Task', description: 'Create new tasks' },
      { id: 'update_task', name: 'Update Task', description: 'Modify existing tasks' },
      { id: 'delete_task', name: 'Delete Task', description: 'Remove tasks' },
    ],
  },
  'contacts-server': {
    name: 'Contacts Server',
    description: 'Manage contacts and customer relationships',
    tools: [
      { id: 'get_contacts', name: 'Get Contacts', description: 'View and search contacts' },
      { id: 'create_contact', name: 'Create Contact', description: 'Add new contacts' },
      { id: 'update_contact', name: 'Update Contact', description: 'Modify contact details' },
      { id: 'delete_contact', name: 'Delete Contact', description: 'Remove contacts' },
    ],
  },
  'leads-server': {
    name: 'Leads Server',
    description: 'Track and manage sales leads',
    tools: [
      { id: 'get_pipelines', name: 'Get Pipelines', description: 'View available pipelines' },
      { id: 'get_pipeline_stages', name: 'Get Pipeline Stages', description: 'View stages for a pipeline' },
      { id: 'get_leads', name: 'Get Leads', description: 'View and search leads' },
      { id: 'create_lead', name: 'Create Lead', description: 'Add new leads' },
      { id: 'update_lead', name: 'Update Lead', description: 'Modify lead information' },
      { id: 'delete_lead', name: 'Delete Lead', description: 'Remove leads' },
      { id: 'get_custom_fields', name: 'Get Custom Fields', description: 'View custom fields for a pipeline' },
      { id: 'get_lead_custom_values', name: 'Get Lead Custom Values', description: 'View custom field values for a lead' },
      { id: 'update_lead_custom_values', name: 'Update Lead Custom Values', description: 'Update custom field values for a lead' },
    ],
  },
  'appointments-server': {
    name: 'Appointments Server',
    description: 'Schedule and manage appointments',
    tools: [
      { id: 'get_appointments', name: 'Get Appointments', description: 'View and search appointments' },
      { id: 'create_appointment', name: 'Create Appointment', description: 'Schedule new appointments' },
      { id: 'update_appointment', name: 'Update Appointment', description: 'Modify appointment details' },
      { id: 'delete_appointment', name: 'Delete Appointment', description: 'Cancel appointments' },
    ],
  },
  'support-server': {
    name: 'Support Server',
    description: 'Manage support tickets and customer issues',
    tools: [
      { id: 'get_support_tickets', name: 'Get Support Tickets', description: 'View and search support tickets' },
      { id: 'get_support_summary', name: 'Get Support Summary', description: 'Get aggregated support statistics' },
      { id: 'create_support_ticket', name: 'Create Support Ticket', description: 'Create new support tickets' },
      { id: 'update_support_ticket', name: 'Update Support Ticket', description: 'Update existing tickets' },
      { id: 'delete_support_ticket', name: 'Delete Support Ticket', description: 'Remove support tickets' },
    ],
  },
  'expenses-server': {
    name: 'Expenses Server',
    description: 'Track and manage business expenses',
    tools: [
      { id: 'get_expenses', name: 'Get Expenses', description: 'View and search expense records' },
      { id: 'get_expense_summary', name: 'Get Expense Summary', description: 'Get aggregated expense statistics' },
      { id: 'create_expense', name: 'Create Expense', description: 'Add new expense records' },
      { id: 'update_expense', name: 'Update Expense', description: 'Modify existing expenses' },
      { id: 'delete_expense', name: 'Delete Expense', description: 'Remove expense records' },
    ],
  },
  'products-server': {
    name: 'Products Server',
    description: 'Manage products, services, and pricing',
    tools: [
      { id: 'get_products', name: 'Get Products', description: 'View and search products' },
      { id: 'get_product_summary', name: 'Get Product Summary', description: 'Get aggregated product statistics' },
      { id: 'create_product', name: 'Create Product', description: 'Add new products' },
      { id: 'update_product', name: 'Update Product', description: 'Modify product details' },
      { id: 'delete_product', name: 'Delete Product', description: 'Remove products' },
    ],
  },
  'billing-server': {
    name: 'Billing Server',
    description: 'Manage estimates, invoices, subscriptions, and receipts',
    tools: [
      { id: 'get_estimates', name: 'Get Estimates', description: 'View and search estimates' },
      { id: 'create_estimate', name: 'Create Estimate', description: 'Create new estimates' },
      { id: 'update_estimate', name: 'Update Estimate', description: 'Modify estimates' },
      { id: 'delete_estimate', name: 'Delete Estimate', description: 'Remove estimates' },
      { id: 'get_invoices', name: 'Get Invoices', description: 'View and search invoices' },
      { id: 'get_invoice_summary', name: 'Get Invoice Summary', description: 'Get invoice statistics and revenue data' },
      { id: 'create_invoice', name: 'Create Invoice', description: 'Create new invoices' },
      { id: 'update_invoice', name: 'Update Invoice', description: 'Modify invoices' },
      { id: 'delete_invoice', name: 'Delete Invoice', description: 'Remove invoices' },
      { id: 'get_subscriptions', name: 'Get Subscriptions', description: 'View and search subscriptions' },
      { id: 'get_subscription_summary', name: 'Get Subscription Summary', description: 'Get subscription statistics and MRR' },
      { id: 'create_subscription', name: 'Create Subscription', description: 'Create new subscriptions' },
      { id: 'update_subscription', name: 'Update Subscription', description: 'Modify subscriptions' },
      { id: 'delete_subscription', name: 'Delete Subscription', description: 'Remove subscriptions' },
      { id: 'get_receipts', name: 'Get Receipts', description: 'View and search receipts' },
      { id: 'create_receipt', name: 'Create Receipt', description: 'Create new receipts' },
      { id: 'update_receipt', name: 'Update Receipt', description: 'Modify receipts' },
      { id: 'delete_receipt', name: 'Delete Receipt', description: 'Remove receipts' },
    ],
  },
}

export function AIAgentPermissions() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(false)
  const [agentName, setAgentName] = useState('')
  const [permissions, setPermissions] = useState<MCPPermissions>({})

  useEffect(() => {
    if (id) {
      fetchAgentAndPermissions()
    }
  }, [id])

  const fetchAgentAndPermissions = async () => {
    try {
      setLoading(true)

      const { data: agentData, error: agentError } = await supabase
        .from('ai_agents')
        .select('name')
        .eq('id', id)
        .single()

      if (agentError) throw agentError
      setAgentName(agentData.name)

      const { data: permData, error: permError } = await supabase
        .from('ai_agent_permissions')
        .select('*')
        .eq('agent_id', id)
        .maybeSingle()

      if (permError) throw permError

      // Initialize with default structure
      const defaultPermissions: MCPPermissions = {}
      Object.keys(MCP_SERVERS).forEach(serverKey => {
        defaultPermissions[serverKey] = {
          enabled: false,
          tools: []
        }
      })

      if (permData && permData.permissions) {
        const existingPerms = permData.permissions as MCPPermissions
        Object.keys(existingPerms).forEach(serverKey => {
          if (defaultPermissions[serverKey]) {
            defaultPermissions[serverKey] = existingPerms[serverKey]
          }
        })
      }

      setPermissions(defaultPermissions)
    } catch (error) {
      console.error('Error fetching permissions:', error)
      alert('Failed to load permissions')
      navigate('/ai-agents')
    } finally {
      setLoading(false)
    }
  }

  const handleServerToggle = (serverKey: string) => {
    setPermissions(prev => ({
      ...prev,
      [serverKey]: {
        ...prev[serverKey],
        enabled: !prev[serverKey].enabled,
        tools: !prev[serverKey].enabled ? [] : prev[serverKey].tools
      }
    }))
  }

  const handleToolToggle = (serverKey: string, toolId: string) => {
    setPermissions(prev => {
      const currentTools = prev[serverKey].tools || []
      const hasTool = currentTools.includes(toolId)

      return {
        ...prev,
        [serverKey]: {
          ...prev[serverKey],
          tools: hasTool
            ? currentTools.filter(t => t !== toolId)
            : [...currentTools, toolId]
        }
      }
    })
  }

  const handleSelectAllTools = (serverKey: string) => {
    const allTools = MCP_SERVERS[serverKey as keyof typeof MCP_SERVERS].tools.map(t => t.id)
    setPermissions(prev => ({
      ...prev,
      [serverKey]: {
        ...prev[serverKey],
        enabled: true,
        tools: allTools
      }
    }))
  }

  const handleDeselectAllTools = (serverKey: string) => {
    setPermissions(prev => ({
      ...prev,
      [serverKey]: {
        ...prev[serverKey],
        tools: []
      }
    }))
  }

  const handleSavePermissions = async () => {
    if (!id) return

    try {
      setLoading(true)

      const { data: existingData } = await supabase
        .from('ai_agent_permissions')
        .select('id')
        .eq('agent_id', id)
        .maybeSingle()

      if (existingData) {
        const { error: updateError } = await supabase
          .from('ai_agent_permissions')
          .update({ permissions, updated_at: new Date().toISOString() })
          .eq('agent_id', id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('ai_agent_permissions')
          .insert({ agent_id: id, permissions })

        if (insertError) throw insertError
      }

      alert('MCP permissions saved successfully')
      navigate('/ai-agents')
    } catch (error) {
      console.error('Error saving permissions:', error)
      alert('Failed to save permissions')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => navigate('/ai-agents')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Agents
        </Button>
        <PageHeader
          title="MCP Server Permissions"
          subtitle={`Configure Model Context Protocol server access for ${agentName}`}
          icon={Shield}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {Object.entries(MCP_SERVERS).map(([serverKey, serverConfig]) => {
          const serverPerms = permissions[serverKey]
          if (!serverPerms) return null

          const enabledTools = serverPerms.tools?.length || 0
          const totalTools = serverConfig.tools.length

          return (
            <Card key={serverKey}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`
                      p-3 rounded-lg transition-colors
                      ${serverPerms.enabled
                        ? 'bg-green-100 text-green-600'
                        : 'bg-gray-100 text-gray-400'
                      }
                    `}>
                      <Server className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-3">
                        {serverConfig.name}
                        <button
                          onClick={() => handleServerToggle(serverKey)}
                          className={`
                            px-3 py-1 rounded-full text-xs font-semibold transition-colors
                            ${serverPerms.enabled
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }
                          `}
                        >
                          {serverPerms.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        {serverConfig.description}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        {enabledTools} of {totalTools} tools enabled
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectAllTools(serverKey)}
                      disabled={!serverPerms.enabled}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeselectAllTools(serverKey)}
                      disabled={!serverPerms.enabled}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {serverConfig.tools.map(tool => {
                    const isEnabled = serverPerms.tools?.includes(tool.id) || false
                    const canToggle = serverPerms.enabled

                    return (
                      <button
                        key={tool.id}
                        onClick={() => canToggle && handleToolToggle(serverKey, tool.id)}
                        disabled={!canToggle}
                        className={`
                          p-4 rounded-lg border-2 text-left transition-all
                          ${!canToggle
                            ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
                            : isEnabled
                              ? 'bg-blue-50 border-blue-300 hover:border-blue-400'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }
                        `}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`
                                text-sm font-semibold
                                ${isEnabled && canToggle ? 'text-blue-700' : 'text-gray-700'}
                              `}>
                                {tool.name}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">
                              {tool.description}
                            </p>
                          </div>
                          <div className={`
                            w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ml-2
                            ${isEnabled && canToggle
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-400'
                            }
                          `}>
                            {isEnabled ? <Check className="w-4 h-4" /> : <XIcon className="w-4 h-4" />}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Button
                onClick={handleSavePermissions}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save MCP Permissions
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/ai-agents')}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
