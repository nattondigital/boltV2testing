import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, Accept, Mcp-Session-Id',
}

interface MCPMessage {
  jsonrpc: '2.0'
  id?: string | number
  method?: string
  params?: any
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

const sessions = new Map<string, { agentId?: string; initialized: boolean }>()

function generateSessionId(): string {
  return `mcp-session-${Date.now()}-${Math.random().toString(36).substring(7)}`
}

async function handleMCPRequest(
  message: MCPMessage,
  sessionId: string,
  supabase: any
): Promise<MCPMessage> {
  const { method, params, id } = message

  const response: MCPMessage = {
    jsonrpc: '2.0',
    id: id || 1,
  }

  try {
    switch (method) {
      case 'initialize': {
        const clientInfo = params?.clientInfo
        const agentId = clientInfo?.agentId || params?.agentId

        sessions.set(sessionId, {
          initialized: true,
          agentId: agentId
        })

        console.log('MCP Billing Server session initialized', { sessionId, agentId })

        response.result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
          serverInfo: {
            name: 'crm-billing-mcp-server',
            version: '1.0.0',
          },
        }
        break
      }

      case 'resources/list': {
        response.result = {
          resources: [
            {
              uri: 'billing://estimates',
              name: 'All Estimates',
              description: 'Complete list of all estimates',
              mimeType: 'application/json',
            },
            {
              uri: 'billing://invoices',
              name: 'All Invoices',
              description: 'Complete list of all invoices',
              mimeType: 'application/json',
            },
            {
              uri: 'billing://subscriptions',
              name: 'All Subscriptions',
              description: 'Complete list of all subscriptions',
              mimeType: 'application/json',
            },
            {
              uri: 'billing://receipts',
              name: 'All Receipts',
              description: 'Complete list of all receipts',
              mimeType: 'application/json',
            },
          ],
        }
        break
      }

      case 'tools/list': {
        response.result = {
          tools: [
            // ESTIMATES TOOLS
            {
              name: 'get_estimates',
              description: 'Retrieve estimates with filtering. Returns estimate details including items, totals, status, and customer info.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: { type: 'string', description: 'AI Agent ID for permission checking' },
                  phone_number: { type: 'string', description: 'User phone number for logging' },
                  estimate_id: { type: 'string', description: 'Get specific estimate by estimate_id' },
                  customer_email: { type: 'string', description: 'Filter by customer email' },
                  status: { type: 'string', enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Invoiced'], description: 'Filter by status' },
                  limit: { type: 'number', description: 'Maximum number to return (default: 50)' },
                },
              },
            },
            {
              name: 'create_estimate',
              description: 'Create a new estimate. Estimate ID will be auto-generated.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: { type: 'string', description: 'AI Agent ID' },
                  phone_number: { type: 'string', description: 'User phone number' },
                  customer_name: { type: 'string', description: 'Customer name (required)' },
                  customer_email: { type: 'string', description: 'Customer email (required)' },
                  customer_phone: { type: 'string', description: 'Customer phone' },
                  title: { type: 'string', description: 'Estimate title (required)' },
                  items: { type: 'array', description: 'Line items: [{description, quantity, rate, amount}]' },
                  subtotal: { type: 'number', description: 'Subtotal amount' },
                  discount: { type: 'number', description: 'Discount amount' },
                  tax_rate: { type: 'number', description: 'Tax rate percentage' },
                  tax_amount: { type: 'number', description: 'Tax amount' },
                  total_amount: { type: 'number', description: 'Total amount' },
                  notes: { type: 'string', description: 'Additional notes' },
                  status: { type: 'string', description: 'Status (default: Draft)' },
                  valid_until: { type: 'string', description: 'Expiry date (YYYY-MM-DD)' },
                },
                required: ['customer_name', 'customer_email', 'title'],
              },
            },
            {
              name: 'update_estimate',
              description: 'Update an existing estimate. Can update all fields including items, status, and amounts.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: { type: 'string' },
                  phone_number: { type: 'string' },
                  estimate_id: { type: 'string', description: 'Estimate ID to update (required)' },
                  customer_name: { type: 'string' },
                  customer_email: { type: 'string' },
                  customer_phone: { type: 'string' },
                  title: { type: 'string' },
                  items: { type: 'array' },
                  subtotal: { type: 'number' },
                  discount: { type: 'number' },
                  tax_rate: { type: 'number' },
                  tax_amount: { type: 'number' },
                  total_amount: { type: 'number' },
                  notes: { type: 'string' },
                  status: { type: 'string' },
                  valid_until: { type: 'string' },
                },
                required: ['estimate_id'],
              },
            },
            {
              name: 'delete_estimate',
              description: 'Delete an estimate by estimate_id',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: { type: 'string' },
                  phone_number: { type: 'string' },
                  estimate_id: { type: 'string', description: 'Estimate ID to delete' },
                },
                required: ['estimate_id'],
              },
            },
            // INVOICES TOOLS
            {
              name: 'get_invoices',
              description: 'Retrieve invoices with filtering. Returns invoice details including items, payment status, and customer info.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: { type: 'string' },
                  phone_number: { type: 'string' },
                  invoice_id: { type: 'string', description: 'Get specific invoice by invoice_id' },
                  customer_email: { type: 'string', description: 'Filter by customer email' },
                  status: { type: 'string', enum: ['Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'], description: 'Filter by status' },
                  limit: { type: 'number', description: 'Maximum number to return (default: 50)' },
                },
              },
            },
            {
              name: 'get_invoice_summary',
              description: 'Get aggregated invoice statistics including revenue, outstanding amounts, and payment summaries.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: { type: 'string' },
                  phone_number: { type: 'string' },
                  status: { type: 'string', description: 'Filter by status' },
                },
              },
            },
            {
              name: 'create_invoice',
              description: 'Create a new invoice. Invoice ID will be auto-generated.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: { type: 'string' },
                  phone_number: { type: 'string' },
                  customer_name: { type: 'string', description: 'Customer name (required)' },
                  customer_email: { type: 'string', description: 'Customer email (required)' },
                  customer_phone: { type: 'string' },
                  title: { type: 'string', description: 'Invoice title (required)' },
                  items: { type: 'array', description: 'Line items' },
                  subtotal: { type: 'number' },
                  discount: { type: 'number' },
                  tax_rate: { type: 'number' },
                  tax_amount: { type: 'number' },
                  total_amount: { type: 'number' },
                  notes: { type: 'string' },
                  terms: { type: 'string' },
                  status: { type: 'string' },
                  issue_date: { type: 'string', description: 'Issue date (YYYY-MM-DD, required)' },
                  due_date: { type: 'string', description: 'Due date (YYYY-MM-DD, required)' },
                },
                required: ['customer_name', 'customer_email', 'title', 'issue_date', 'due_date'],
              },
            },
            {
              name: 'update_invoice',
              description: 'Update an existing invoice including status, payments, and amounts.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: { type: 'string' },
                  phone_number: { type: 'string' },
                  invoice_id: { type: 'string', description: 'Invoice ID (required)' },
                  customer_name: { type: 'string' },
                  customer_email: { type: 'string' },
                  title: { type: 'string' },
                  items: { type: 'array' },
                  subtotal: { type: 'number' },
                  discount: { type: 'number' },
                  tax_amount: { type: 'number' },
                  total_amount: { type: 'number' },
                  paid_amount: { type: 'number' },
                  balance_due: { type: 'number' },
                  status: { type: 'string' },
                  notes: { type: 'string' },
                },
                required: ['invoice_id'],
              },
            },
            {
              name: 'delete_invoice',
              description: 'Delete an invoice by invoice_id',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: { type: 'string' },
                  phone_number: { type: 'string' },
                  invoice_id: { type: 'string' },
                },
                required: ['invoice_id'],
              },
            },
            // SUBSCRIPTIONS TOOLS
            {
              name: 'get_subscriptions',
              description: 'Retrieve subscriptions with filtering. Returns subscription details including plan, billing cycle, and status.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: { type: 'string' },
                  phone_number: { type: 'string' },
                  subscription_id: { type: 'string', description: 'Get specific subscription' },
                  customer_email: { type: 'string', description: 'Filter by customer email' },
                  status: { type: 'string', enum: ['Active', 'Paused', 'Cancelled', 'Expired'], description: 'Filter by status' },
                  limit: { type: 'number', description: 'Maximum number to return (default: 50)' },
                },
              },
            },
            {
              name: 'get_subscription_summary',
              description: 'Get aggregated subscription statistics including MRR, active subscriptions, and revenue breakdown.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: { type: 'string' },
                  phone_number: { type: 'string' },
                  status: { type: 'string' },
                },
              },
            },
            {
              name: 'create_subscription',
              description: 'Create a new subscription. Subscription ID will be auto-generated.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: { type: 'string' },
                  phone_number: { type: 'string' },
                  customer_name: { type: 'string', description: 'Customer name (required)' },
                  customer_email: { type: 'string', description: 'Customer email (required)' },
                  customer_phone: { type: 'string' },
                  plan_name: { type: 'string', description: 'Plan name (required)' },
                  plan_type: { type: 'string', enum: ['Monthly', 'Quarterly', 'Yearly', 'Custom'], description: 'Plan type (required)' },
                  amount: { type: 'number', description: 'Amount (required)' },
                  currency: { type: 'string', description: 'Currency (default: INR)' },
                  start_date: { type: 'string', description: 'Start date YYYY-MM-DD (required)' },
                  billing_cycle_day: { type: 'number', description: 'Day of month for billing' },
                  notes: { type: 'string' },
                },
                required: ['customer_name', 'customer_email', 'plan_name', 'plan_type', 'amount', 'start_date'],
              },
            },
            {
              name: 'update_subscription',
              description: 'Update an existing subscription including status, amount, and billing dates.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: { type: 'string' },
                  phone_number: { type: 'string' },
                  subscription_id: { type: 'string', description: 'Subscription ID (required)' },
                  plan_name: { type: 'string' },
                  amount: { type: 'number' },
                  status: { type: 'string' },
                  next_billing_date: { type: 'string' },
                  auto_renew: { type: 'boolean' },
                  notes: { type: 'string' },
                },
                required: ['subscription_id'],
              },
            },
            {
              name: 'delete_subscription',
              description: 'Delete a subscription by subscription_id',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: { type: 'string' },
                  phone_number: { type: 'string' },
                  subscription_id: { type: 'string' },
                },
                required: ['subscription_id'],
              },
            },
            // RECEIPTS TOOLS
            {
              name: 'get_receipts',
              description: 'Retrieve payment receipts with filtering. Returns receipt details including payment method, amount, and status.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: { type: 'string' },
                  phone_number: { type: 'string' },
                  receipt_id: { type: 'string', description: 'Get specific receipt' },
                  customer_email: { type: 'string', description: 'Filter by customer email' },
                  invoice_id: { type: 'string', description: 'Filter by invoice UUID' },
                  limit: { type: 'number', description: 'Maximum number to return (default: 50)' },
                },
              },
            },
            {
              name: 'create_receipt',
              description: 'Create a new payment receipt. Receipt ID will be auto-generated.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: { type: 'string' },
                  phone_number: { type: 'string' },
                  customer_name: { type: 'string', description: 'Customer name (required)' },
                  customer_email: { type: 'string', description: 'Customer email (required)' },
                  payment_method: { type: 'string', description: 'Payment method (required)' },
                  amount_paid: { type: 'number', description: 'Amount paid (required)' },
                  payment_date: { type: 'string', description: 'Payment date YYYY-MM-DD (required)' },
                  description: { type: 'string' },
                  payment_reference: { type: 'string' },
                  currency: { type: 'string' },
                  notes: { type: 'string' },
                },
                required: ['customer_name', 'customer_email', 'payment_method', 'amount_paid', 'payment_date'],
              },
            },
            {
              name: 'update_receipt',
              description: 'Update a receipt including status and refund information.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: { type: 'string' },
                  phone_number: { type: 'string' },
                  receipt_id: { type: 'string', description: 'Receipt ID (required)' },
                  status: { type: 'string', enum: ['Completed', 'Failed', 'Refunded', 'Pending'] },
                  refund_amount: { type: 'number' },
                  refund_date: { type: 'string' },
                  refund_reason: { type: 'string' },
                  notes: { type: 'string' },
                },
                required: ['receipt_id'],
              },
            },
            {
              name: 'delete_receipt',
              description: 'Delete a receipt by receipt_id',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: { type: 'string' },
                  phone_number: { type: 'string' },
                  receipt_id: { type: 'string' },
                },
                required: ['receipt_id'],
              },
            },
          ],
        }
        break
      }

      case 'tools/call': {
        const { name, arguments: args } = params
        const agentId = args?.agent_id

        if (!agentId) {
          throw new Error('agent_id is required in arguments')
        }

        const { data: agent, error: agentError } = await supabase
          .from('ai_agents')
          .select('name')
          .eq('id', agentId)
          .maybeSingle()

        if (agentError || !agent) {
          throw new Error('Agent not found')
        }

        const agentName = agent.name

        const { data: permissions, error: permError } = await supabase
          .from('ai_agent_permissions')
          .select('permissions')
          .eq('agent_id', agentId)
          .maybeSingle()

        if (permError || !permissions) {
          throw new Error('Agent not found or no permissions set')
        }

        const allPermissions = permissions.permissions || {}
        const billingServerPerms = allPermissions['billing-server'] || { enabled: false, tools: [] }
        const enabledTools = billingServerPerms.tools || []

        switch (name) {
          // ESTIMATE OPERATIONS
          case 'get_estimates': {
            if (!enabledTools.includes('get_estimates')) {
              throw new Error('Agent does not have permission to view estimates')
            }

            let query = supabase.from('estimates').select('*').order('created_at', { ascending: false })

            if (args.estimate_id) query = query.eq('estimate_id', args.estimate_id)
            if (args.customer_email) query = query.eq('customer_email', args.customer_email)
            if (args.status) query = query.eq('status', args.status)
            if (args.limit) query = query.limit(args.limit)
            else query = query.limit(50)

            const { data, error } = await query

            if (error) throw error

            response.result = {
              content: [{ type: 'text', text: JSON.stringify({ success: true, data, count: data?.length || 0 }, null, 2) }],
            }
            break
          }

          case 'create_estimate': {
            if (!enabledTools.includes('create_estimate')) {
              throw new Error('Agent does not have permission to create estimates')
            }

            const estimateData: any = {
              customer_name: args.customer_name,
              customer_email: args.customer_email,
              title: args.title,
            }

            if (args.customer_phone) estimateData.customer_phone = args.customer_phone
            if (args.items) estimateData.items = JSON.stringify(args.items)
            if (args.subtotal !== undefined) estimateData.subtotal = args.subtotal
            if (args.discount !== undefined) estimateData.discount = args.discount
            if (args.tax_rate !== undefined) estimateData.tax_rate = args.tax_rate
            if (args.tax_amount !== undefined) estimateData.tax_amount = args.tax_amount
            if (args.total_amount !== undefined) estimateData.total_amount = args.total_amount
            if (args.notes) estimateData.notes = args.notes
            if (args.status) estimateData.status = args.status
            if (args.valid_until) estimateData.valid_until = args.valid_until

            const { data, error } = await supabase.from('estimates').insert(estimateData).select('*').single()

            if (error) throw error

            response.result = {
              content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Estimate created', estimate: data }, null, 2) }],
            }
            break
          }

          case 'update_estimate': {
            if (!enabledTools.includes('update_estimate')) {
              throw new Error('Agent does not have permission to update estimates')
            }

            const { estimate_id, ...updates } = args
            delete updates.agent_id
            delete updates.phone_number

            if (updates.items && Array.isArray(updates.items)) {
              updates.items = JSON.stringify(updates.items)
            }

            const { data, error } = await supabase.from('estimates').update(updates).eq('estimate_id', estimate_id).select('*').single()

            if (error) throw error

            response.result = {
              content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Estimate updated', estimate: data }, null, 2) }],
            }
            break
          }

          case 'delete_estimate': {
            if (!enabledTools.includes('delete_estimate')) {
              throw new Error('Agent does not have permission to delete estimates')
            }

            const { error } = await supabase.from('estimates').delete().eq('estimate_id', args.estimate_id)

            if (error) throw error

            response.result = {
              content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Estimate deleted' }, null, 2) }],
            }
            break
          }

          // INVOICE OPERATIONS
          case 'get_invoices': {
            if (!enabledTools.includes('get_invoices')) {
              throw new Error('Agent does not have permission to view invoices')
            }

            let query = supabase.from('invoices').select('*').order('created_at', { ascending: false })

            if (args.invoice_id) query = query.eq('invoice_id', args.invoice_id)
            if (args.customer_email) query = query.eq('customer_email', args.customer_email)
            if (args.status) query = query.eq('status', args.status)
            if (args.limit) query = query.limit(args.limit)
            else query = query.limit(50)

            const { data, error } = await query

            if (error) throw error

            response.result = {
              content: [{ type: 'text', text: JSON.stringify({ success: true, data, count: data?.length || 0 }, null, 2) }],
            }
            break
          }

          case 'get_invoice_summary': {
            if (!enabledTools.includes('get_invoices')) {
              throw new Error('Agent does not have permission to view invoices')
            }

            let query = supabase.from('invoices').select('*')
            if (args.status) query = query.eq('status', args.status)

            const { data: invoices, error } = await query

            if (error) throw error

            const summary = {
              total_count: invoices?.length || 0,
              total_revenue: invoices?.reduce((sum: number, inv: any) => sum + (parseFloat(inv.total_amount) || 0), 0) || 0,
              total_paid: invoices?.reduce((sum: number, inv: any) => sum + (parseFloat(inv.paid_amount) || 0), 0) || 0,
              total_outstanding: invoices?.reduce((sum: number, inv: any) => sum + (parseFloat(inv.balance_due) || 0), 0) || 0,
              by_status: {} as Record<string, { count: number; amount: number }>,
            }

            invoices?.forEach((invoice: any) => {
              const status = invoice.status || 'Unknown'
              if (!summary.by_status[status]) {
                summary.by_status[status] = { count: 0, amount: 0 }
              }
              summary.by_status[status].count += 1
              summary.by_status[status].amount += parseFloat(invoice.total_amount) || 0
            })

            response.result = {
              content: [{ type: 'text', text: JSON.stringify({ success: true, summary }, null, 2) }],
            }
            break
          }

          case 'create_invoice': {
            if (!enabledTools.includes('create_invoice')) {
              throw new Error('Agent does not have permission to create invoices')
            }

            const invoiceData: any = {
              customer_name: args.customer_name,
              customer_email: args.customer_email,
              title: args.title,
              issue_date: args.issue_date,
              due_date: args.due_date,
            }

            if (args.customer_phone) invoiceData.customer_phone = args.customer_phone
            if (args.items) invoiceData.items = JSON.stringify(args.items)
            if (args.subtotal !== undefined) invoiceData.subtotal = args.subtotal
            if (args.discount !== undefined) invoiceData.discount = args.discount
            if (args.tax_rate !== undefined) invoiceData.tax_rate = args.tax_rate
            if (args.tax_amount !== undefined) invoiceData.tax_amount = args.tax_amount
            if (args.total_amount !== undefined) invoiceData.total_amount = args.total_amount
            if (args.notes) invoiceData.notes = args.notes
            if (args.terms) invoiceData.terms = args.terms
            if (args.status) invoiceData.status = args.status

            const { data, error } = await supabase.from('invoices').insert(invoiceData).select('*').single()

            if (error) throw error

            response.result = {
              content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Invoice created', invoice: data }, null, 2) }],
            }
            break
          }

          case 'update_invoice': {
            if (!enabledTools.includes('update_invoice')) {
              throw new Error('Agent does not have permission to update invoices')
            }

            const { invoice_id, ...updates } = args
            delete updates.agent_id
            delete updates.phone_number

            if (updates.items && Array.isArray(updates.items)) {
              updates.items = JSON.stringify(updates.items)
            }

            const { data, error } = await supabase.from('invoices').update(updates).eq('invoice_id', invoice_id).select('*').single()

            if (error) throw error

            response.result = {
              content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Invoice updated', invoice: data }, null, 2) }],
            }
            break
          }

          case 'delete_invoice': {
            if (!enabledTools.includes('delete_invoice')) {
              throw new Error('Agent does not have permission to delete invoices')
            }

            const { error } = await supabase.from('invoices').delete().eq('invoice_id', args.invoice_id)

            if (error) throw error

            response.result = {
              content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Invoice deleted' }, null, 2) }],
            }
            break
          }

          // SUBSCRIPTION OPERATIONS
          case 'get_subscriptions': {
            if (!enabledTools.includes('get_subscriptions')) {
              throw new Error('Agent does not have permission to view subscriptions')
            }

            let query = supabase.from('subscriptions').select('*').order('created_at', { ascending: false })

            if (args.subscription_id) query = query.eq('subscription_id', args.subscription_id)
            if (args.customer_email) query = query.eq('customer_email', args.customer_email)
            if (args.status) query = query.eq('status', args.status)
            if (args.limit) query = query.limit(args.limit)
            else query = query.limit(50)

            const { data, error } = await query

            if (error) throw error

            response.result = {
              content: [{ type: 'text', text: JSON.stringify({ success: true, data, count: data?.length || 0 }, null, 2) }],
            }
            break
          }

          case 'get_subscription_summary': {
            if (!enabledTools.includes('get_subscriptions')) {
              throw new Error('Agent does not have permission to view subscriptions')
            }

            let query = supabase.from('subscriptions').select('*')
            if (args.status) query = query.eq('status', args.status)

            const { data: subscriptions, error } = await query

            if (error) throw error

            const activeSubs = subscriptions?.filter((s: any) => s.status === 'Active') || []
            const mrr = activeSubs.reduce((sum: number, sub: any) => {
              const amount = parseFloat(sub.amount) || 0
              if (sub.plan_type === 'Monthly') return sum + amount
              if (sub.plan_type === 'Quarterly') return sum + (amount / 3)
              if (sub.plan_type === 'Yearly') return sum + (amount / 12)
              return sum
            }, 0)

            const summary = {
              total_count: subscriptions?.length || 0,
              active_count: activeSubs.length,
              mrr: mrr.toFixed(2),
              total_value: subscriptions?.reduce((sum: number, sub: any) => sum + (parseFloat(sub.amount) || 0), 0) || 0,
              by_status: {} as Record<string, number>,
              by_plan_type: {} as Record<string, number>,
            }

            subscriptions?.forEach((sub: any) => {
              const status = sub.status || 'Unknown'
              const planType = sub.plan_type || 'Unknown'
              summary.by_status[status] = (summary.by_status[status] || 0) + 1
              summary.by_plan_type[planType] = (summary.by_plan_type[planType] || 0) + 1
            })

            response.result = {
              content: [{ type: 'text', text: JSON.stringify({ success: true, summary }, null, 2) }],
            }
            break
          }

          case 'create_subscription': {
            if (!enabledTools.includes('create_subscription')) {
              throw new Error('Agent does not have permission to create subscriptions')
            }

            const subData: any = {
              customer_name: args.customer_name,
              customer_email: args.customer_email,
              plan_name: args.plan_name,
              plan_type: args.plan_type,
              amount: args.amount,
              start_date: args.start_date,
            }

            if (args.customer_phone) subData.customer_phone = args.customer_phone
            if (args.currency) subData.currency = args.currency
            if (args.billing_cycle_day !== undefined) subData.billing_cycle_day = args.billing_cycle_day
            if (args.notes) subData.notes = args.notes

            const { data, error } = await supabase.from('subscriptions').insert(subData).select('*').single()

            if (error) throw error

            response.result = {
              content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Subscription created', subscription: data }, null, 2) }],
            }
            break
          }

          case 'update_subscription': {
            if (!enabledTools.includes('update_subscription')) {
              throw new Error('Agent does not have permission to update subscriptions')
            }

            const { subscription_id, ...updates } = args
            delete updates.agent_id
            delete updates.phone_number

            const { data, error } = await supabase.from('subscriptions').update(updates).eq('subscription_id', subscription_id).select('*').single()

            if (error) throw error

            response.result = {
              content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Subscription updated', subscription: data }, null, 2) }],
            }
            break
          }

          case 'delete_subscription': {
            if (!enabledTools.includes('delete_subscription')) {
              throw new Error('Agent does not have permission to delete subscriptions')
            }

            const { error } = await supabase.from('subscriptions').delete().eq('subscription_id', args.subscription_id)

            if (error) throw error

            response.result = {
              content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Subscription deleted' }, null, 2) }],
            }
            break
          }

          // RECEIPT OPERATIONS
          case 'get_receipts': {
            if (!enabledTools.includes('get_receipts')) {
              throw new Error('Agent does not have permission to view receipts')
            }

            let query = supabase.from('receipts').select('*').order('created_at', { ascending: false })

            if (args.receipt_id) query = query.eq('receipt_id', args.receipt_id)
            if (args.customer_email) query = query.eq('customer_email', args.customer_email)
            if (args.invoice_id) query = query.eq('invoice_id', args.invoice_id)
            if (args.limit) query = query.limit(args.limit)
            else query = query.limit(50)

            const { data, error } = await query

            if (error) throw error

            response.result = {
              content: [{ type: 'text', text: JSON.stringify({ success: true, data, count: data?.length || 0 }, null, 2) }],
            }
            break
          }

          case 'create_receipt': {
            if (!enabledTools.includes('create_receipt')) {
              throw new Error('Agent does not have permission to create receipts')
            }

            const receiptData: any = {
              customer_name: args.customer_name,
              customer_email: args.customer_email,
              payment_method: args.payment_method,
              amount_paid: args.amount_paid,
              payment_date: args.payment_date,
            }

            if (args.description) receiptData.description = args.description
            if (args.payment_reference) receiptData.payment_reference = args.payment_reference
            if (args.currency) receiptData.currency = args.currency
            if (args.notes) receiptData.notes = args.notes

            const { data, error } = await supabase.from('receipts').insert(receiptData).select('*').single()

            if (error) throw error

            response.result = {
              content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Receipt created', receipt: data }, null, 2) }],
            }
            break
          }

          case 'update_receipt': {
            if (!enabledTools.includes('update_receipt')) {
              throw new Error('Agent does not have permission to update receipts')
            }

            const { receipt_id, ...updates } = args
            delete updates.agent_id
            delete updates.phone_number

            const { data, error } = await supabase.from('receipts').update(updates).eq('receipt_id', receipt_id).select('*').single()

            if (error) throw error

            response.result = {
              content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Receipt updated', receipt: data }, null, 2) }],
            }
            break
          }

          case 'delete_receipt': {
            if (!enabledTools.includes('delete_receipt')) {
              throw new Error('Agent does not have permission to delete receipts')
            }

            const { error } = await supabase.from('receipts').delete().eq('receipt_id', args.receipt_id)

            if (error) throw error

            response.result = {
              content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Receipt deleted' }, null, 2) }],
            }
            break
          }

          default:
            throw new Error(`Unknown tool: ${name}`)
        }
        break
      }

      default:
        throw new Error(`Unknown method: ${method}`)
    }
  } catch (error: any) {
    response.error = {
      code: -32603,
      message: error.message || 'Internal error',
      data: error.stack,
    }
  }

  return response
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let sessionId = req.headers.get('Mcp-Session-Id')
    if (!sessionId) {
      sessionId = generateSessionId()
    }

    const message: MCPMessage = await req.json()
    const response = await handleMCPRequest(message, sessionId, supabase)

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Mcp-Session-Id': sessionId,
      },
    })
  } catch (error: any) {
    console.error('MCP Billing Server Error:', error)
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: 'Parse error',
          data: error.message,
        },
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
