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

        console.log('MCP Expenses Server session initialized', { sessionId, agentId })

        response.result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
          serverInfo: {
            name: 'crm-expenses-mcp-server',
            version: '1.0.0',
          },
        }
        break
      }

      case 'resources/list': {
        response.result = {
          resources: [
            {
              uri: 'expenses://all',
              name: 'All Expenses',
              description: 'Complete list of all expenses in the system',
              mimeType: 'application/json',
            },
            {
              uri: 'expenses://pending',
              name: 'Pending Expenses',
              description: 'Expenses with status Pending',
              mimeType: 'application/json',
            },
            {
              uri: 'expenses://approved',
              name: 'Approved Expenses',
              description: 'Expenses with status Approved',
              mimeType: 'application/json',
            },
            {
              uri: 'expenses://rejected',
              name: 'Rejected Expenses',
              description: 'Expenses with status Rejected',
              mimeType: 'application/json',
            },
            {
              uri: 'expenses://statistics',
              name: 'Expense Statistics',
              description: 'Aggregated statistics about expenses',
              mimeType: 'application/json',
            },
          ],
        }
        break
      }

      case 'resources/read': {
        const { uri } = params

        if (!uri) {
          throw new Error('URI is required')
        }

        if (uri === 'expenses://statistics') {
          const { data: allExpenses, error: allError } = await supabase.from('expenses').select('*')
          if (allError) throw allError

          const stats = {
            total: allExpenses?.length || 0,
            total_amount: allExpenses?.reduce((sum: number, e: any) => sum + parseFloat(e.amount || 0), 0) || 0,
            by_status: {
              'Pending': allExpenses?.filter((e: any) => e.status === 'Pending').length || 0,
              'Approved': allExpenses?.filter((e: any) => e.status === 'Approved').length || 0,
              'Rejected': allExpenses?.filter((e: any) => e.status === 'Rejected').length || 0,
            },
            by_category: {} as Record<string, number>,
            by_payment_method: {} as Record<string, number>,
          }

          allExpenses?.forEach((expense: any) => {
            const category = expense.category || 'Unknown'
            const method = expense.payment_method || 'Unknown'
            stats.by_category[category] = (stats.by_category[category] || 0) + 1
            stats.by_payment_method[method] = (stats.by_payment_method[method] || 0) + 1
          })

          response.result = {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(stats, null, 2),
              },
            ],
          }
        } else {
          let query = supabase.from('expenses').select('*')

          if (uri === 'expenses://pending') {
            query = query.eq('status', 'Pending')
          } else if (uri === 'expenses://approved') {
            query = query.eq('status', 'Approved')
          } else if (uri === 'expenses://rejected') {
            query = query.eq('status', 'Rejected')
          }

          query = query.order('expense_date', { ascending: false })

          const { data, error } = await query

          if (error) throw error

          response.result = {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(data, null, 2),
              },
            ],
          }
        }
        break
      }

      case 'prompts/list': {
        response.result = {
          prompts: [
            {
              name: 'expense_summary',
              description: 'Provides a comprehensive summary of expenses',
              arguments: [],
            },
          ],
        }
        break
      }

      case 'tools/list': {
        response.result = {
          tools: [
            {
              name: 'get_expenses',
              description: 'Retrieve expenses with advanced filtering. Use expense_id to get a specific expense. Can filter by category, status, date range, and other fields.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: {
                    type: 'string',
                    description: 'AI Agent ID for permission checking',
                  },
                  phone_number: {
                    type: 'string',
                    description: 'User phone number for logging',
                  },
                  expense_id: {
                    type: 'string',
                    description: 'Get a specific expense by expense_id (e.g., EXP027)',
                  },
                  category: {
                    type: 'string',
                    description: 'Filter by category (e.g., Travel, Office Supplies, Equipment)',
                  },
                  status: {
                    type: 'string',
                    enum: ['Pending', 'Approved', 'Rejected'],
                    description: 'Filter by approval status',
                  },
                  min_amount: {
                    type: 'number',
                    description: 'Minimum expense amount',
                  },
                  max_amount: {
                    type: 'number',
                    description: 'Maximum expense amount',
                  },
                  from_date: {
                    type: 'string',
                    description: 'Start date (YYYY-MM-DD format)',
                  },
                  to_date: {
                    type: 'string',
                    description: 'End date (YYYY-MM-DD format)',
                  },
                  payment_method: {
                    type: 'string',
                    description: 'Filter by payment method',
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum number of expenses to return (default: 100)',
                  },
                },
              },
            },
            {
              name: 'create_expense',
              description: 'Create a new expense record',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: {
                    type: 'string',
                    description: 'AI Agent ID for permission checking',
                  },
                  phone_number: {
                    type: 'string',
                    description: 'User phone number for logging',
                  },
                  category: {
                    type: 'string',
                    description: 'Expense category (required)',
                  },
                  amount: {
                    type: 'number',
                    description: 'Expense amount (required)',
                  },
                  currency: {
                    type: 'string',
                    description: 'Currency code (default: INR)',
                  },
                  description: {
                    type: 'string',
                    description: 'Expense description',
                  },
                  expense_date: {
                    type: 'string',
                    description: 'Date of expense (YYYY-MM-DD, required)',
                  },
                  payment_method: {
                    type: 'string',
                    description: 'Payment method used',
                  },
                  receipt_url: {
                    type: 'string',
                    description: 'URL to receipt/invoice',
                  },
                  status: {
                    type: 'string',
                    enum: ['Pending', 'Approved', 'Rejected'],
                    description: 'Approval status (default: Pending)',
                  },
                  notes: {
                    type: 'string',
                    description: 'Additional notes',
                  },
                },
                required: ['category', 'amount', 'expense_date'],
              },
            },
            {
              name: 'update_expense',
              description: 'Update an existing expense',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: {
                    type: 'string',
                    description: 'AI Agent ID for permission checking',
                  },
                  phone_number: {
                    type: 'string',
                    description: 'User phone number for logging',
                  },
                  expense_id: {
                    type: 'string',
                    description: 'Expense ID to update',
                  },
                  category: { type: 'string' },
                  amount: { type: 'number' },
                  currency: { type: 'string' },
                  description: { type: 'string' },
                  expense_date: { type: 'string' },
                  payment_method: { type: 'string' },
                  receipt_url: { type: 'string' },
                  status: {
                    type: 'string',
                    enum: ['Pending', 'Approved', 'Rejected'],
                  },
                  notes: { type: 'string' },
                },
                required: ['expense_id'],
              },
            },
            {
              name: 'delete_expense',
              description: 'Delete an expense by expense_id',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: {
                    type: 'string',
                    description: 'AI Agent ID for permission checking',
                  },
                  phone_number: {
                    type: 'string',
                    description: 'User phone number for logging',
                  },
                  expense_id: {
                    type: 'string',
                    description: 'Expense ID to delete',
                  },
                },
                required: ['expense_id'],
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
        const expensesServerPerms = allPermissions['expenses-server'] || { enabled: false, tools: [] }
        const enabledTools = expensesServerPerms.tools || []

        switch (name) {
          case 'get_expenses': {
            if (!enabledTools.includes('get_expenses')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Expenses',
                action: 'get_expenses',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to view expenses' },
              })
              throw new Error('Agent does not have permission to view expenses')
            }

            let query = supabase
              .from('expenses')
              .select('*')
              .order('expense_date', { ascending: false })

            if (args.expense_id) {
              query = query.eq('expense_id', args.expense_id)
            }
            if (args.category) {
              query = query.ilike('category', `%${args.category}%`)
            }
            if (args.status) {
              query = query.eq('status', args.status)
            }
            if (args.min_amount) {
              query = query.gte('amount', args.min_amount)
            }
            if (args.max_amount) {
              query = query.lte('amount', args.max_amount)
            }
            if (args.from_date) {
              query = query.gte('expense_date', args.from_date)
            }
            if (args.to_date) {
              query = query.lte('expense_date', args.to_date)
            }
            if (args.payment_method) {
              query = query.eq('payment_method', args.payment_method)
            }
            if (args.limit) {
              query = query.limit(args.limit)
            } else {
              query = query.limit(100)
            }

            const { data, error } = await query

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Expenses',
                action: 'get_expenses',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Expenses',
              action: 'get_expenses',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { filters: args, result_count: data?.length || 0 },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, data, count: data?.length || 0 }, null, 2),
                },
              ],
            }
            break
          }

          case 'create_expense': {
            if (!enabledTools.includes('create_expense')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Expenses',
                action: 'create_expense',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to create expenses' },
              })
              throw new Error('Agent does not have permission to create expenses')
            }

            const expenseData = {
              category: args.category,
              amount: args.amount,
              currency: args.currency || 'INR',
              description: args.description || null,
              expense_date: args.expense_date,
              payment_method: args.payment_method || null,
              receipt_url: args.receipt_url || null,
              status: args.status || 'Pending',
              notes: args.notes || null,
            }

            const { data, error } = await supabase
              .from('expenses')
              .insert(expenseData)
              .select()
              .single()

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Expenses',
                action: 'create_expense',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, expense_data: args },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Expenses',
              action: 'create_expense',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { expense_id: data.expense_id, category: args.category, amount: args.amount },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: 'Expense created successfully',
                    expense: data
                  }, null, 2),
                },
              ],
            }
            break
          }

          case 'update_expense': {
            if (!enabledTools.includes('update_expense')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Expenses',
                action: 'update_expense',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to edit expenses' },
              })
              throw new Error('Agent does not have permission to edit expenses')
            }

            const { expense_id, ...updates } = args
            delete updates.agent_id
            delete updates.phone_number

            const { data, error } = await supabase
              .from('expenses')
              .update(updates)
              .eq('expense_id', expense_id)
              .select()
              .single()

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Expenses',
                action: 'update_expense',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, expense_id, updates },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Expenses',
              action: 'update_expense',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { expense_id, updates },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, message: 'Expense updated successfully', expense: data }, null, 2),
                },
              ],
            }
            break
          }

          case 'delete_expense': {
            if (!enabledTools.includes('delete_expense')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Expenses',
                action: 'delete_expense',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to delete expenses' },
              })
              throw new Error('Agent does not have permission to delete expenses')
            }

            const { error } = await supabase
              .from('expenses')
              .delete()
              .eq('expense_id', args.expense_id)

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Expenses',
                action: 'delete_expense',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, expense_id: args.expense_id },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Expenses',
              action: 'delete_expense',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { expense_id: args.expense_id },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, message: 'Expense deleted successfully', expense_id: args.expense_id }, null, 2),
                },
              ],
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
    console.error('MCP Expenses Server Error:', error)
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
