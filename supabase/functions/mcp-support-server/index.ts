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

        console.log('MCP Support Server session initialized', { sessionId, agentId })

        response.result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
          serverInfo: {
            name: 'crm-support-mcp-server',
            version: '1.0.0',
          },
        }
        break
      }

      case 'resources/list': {
        response.result = {
          resources: [
            {
              uri: 'support://all',
              name: 'All Support Tickets',
              description: 'Complete list of all support tickets',
              mimeType: 'application/json',
            },
            {
              uri: 'support://open',
              name: 'Open Tickets',
              description: 'Support tickets with status Open',
              mimeType: 'application/json',
            },
            {
              uri: 'support://resolved',
              name: 'Resolved Tickets',
              description: 'Support tickets with status Resolved',
              mimeType: 'application/json',
            },
            {
              uri: 'support://high-priority',
              name: 'High Priority Tickets',
              description: 'Critical and High priority tickets',
              mimeType: 'application/json',
            },
            {
              uri: 'support://statistics',
              name: 'Support Statistics',
              description: 'Aggregated statistics about support tickets',
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

        if (uri === 'support://statistics') {
          const { data: allTickets, error: allError } = await supabase
            .from('support_tickets')
            .select('*, contacts_master(full_name, email, phone)')

          if (allError) throw allError

          const stats = {
            total: allTickets?.length || 0,
            by_status: {} as Record<string, number>,
            by_priority: {} as Record<string, number>,
            by_category: {} as Record<string, number>,
            avg_satisfaction: 0,
            resolution_rate: 0,
          }

          let totalSatisfaction = 0
          let satisfactionCount = 0
          let resolvedCount = 0

          allTickets?.forEach((ticket: any) => {
            const status = ticket.status || 'Unknown'
            const priority = ticket.priority || 'Unknown'
            const category = ticket.category || 'Unknown'

            stats.by_status[status] = (stats.by_status[status] || 0) + 1
            stats.by_priority[priority] = (stats.by_priority[priority] || 0) + 1
            stats.by_category[category] = (stats.by_category[category] || 0) + 1

            if (ticket.satisfaction) {
              totalSatisfaction += ticket.satisfaction
              satisfactionCount++
            }

            if (status === 'Resolved') {
              resolvedCount++
            }
          })

          stats.avg_satisfaction = satisfactionCount > 0 ? totalSatisfaction / satisfactionCount : 0
          stats.resolution_rate = stats.total > 0 ? (resolvedCount / stats.total) * 100 : 0

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
          let query = supabase
            .from('support_tickets')
            .select('*, contacts_master(full_name, email, phone)')
            .order('created_at', { ascending: false })

          if (uri === 'support://open') {
            query = query.eq('status', 'Open')
          } else if (uri === 'support://resolved') {
            query = query.eq('status', 'Resolved')
          } else if (uri === 'support://high-priority') {
            query = query.in('priority', ['Critical', 'High'])
          }

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
              name: 'support_summary',
              description: 'Provides a comprehensive summary of support tickets',
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
              name: 'get_support_tickets',
              description: 'Retrieve individual support ticket records with filtering. Returns full ticket details including ticket_id, contact info, subject, description, status, priority, category, attachments. Use this to get specific tickets or filtered lists. For statistics and summaries, use get_support_summary instead.',
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
                  ticket_id: {
                    type: 'string',
                    description: 'Get a specific ticket by ticket_id',
                  },
                  status: {
                    type: 'string',
                    enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
                    description: 'Filter by ticket status',
                  },
                  priority: {
                    type: 'string',
                    enum: ['Low', 'Medium', 'High', 'Critical'],
                    description: 'Filter by priority level',
                  },
                  category: {
                    type: 'string',
                    description: 'Filter by category (e.g., Technical, General, Feature Request, Refund)',
                  },
                  contact_email: {
                    type: 'string',
                    description: 'Filter by contact email address',
                  },
                  contact_phone: {
                    type: 'string',
                    description: 'Filter by contact phone number',
                  },
                  from_date: {
                    type: 'string',
                    description: 'Start date for filtering (YYYY-MM-DD format)',
                  },
                  to_date: {
                    type: 'string',
                    description: 'End date for filtering (YYYY-MM-DD format)',
                  },
                  assigned_to: {
                    type: 'string',
                    description: 'Filter by assigned team member ID',
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum number of tickets to return (default: 100)',
                  },
                },
              },
            },
            {
              name: 'get_support_summary',
              description: 'Get aggregated support ticket statistics and breakdowns. Returns total count, breakdown by status/priority/category, average satisfaction score, resolution rate, and latest tickets. Use this for questions about support summaries, statistics, or ticket counts.',
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
                  from_date: {
                    type: 'string',
                    description: 'Start date for summary (YYYY-MM-DD format, optional)',
                  },
                  to_date: {
                    type: 'string',
                    description: 'End date for summary (YYYY-MM-DD format, optional)',
                  },
                  status: {
                    type: 'string',
                    description: 'Filter summary by specific status (optional)',
                  },
                  priority: {
                    type: 'string',
                    description: 'Filter summary by specific priority (optional)',
                  },
                },
              },
            },
            {
              name: 'create_support_ticket',
              description: 'Create a new support ticket. IMPORTANT: Infer the category from the description. Common mappings: technical issue/bug/error → Technical, question/how to → General, new feature/improvement → Feature Request, refund/payment → Refund. Set priority based on urgency indicators: urgent/asap/critical → High, important → Medium, general → Low.',
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
                  contact_phone: {
                    type: 'string',
                    description: 'Contact phone number (required) - will look up or create contact',
                  },
                  contact_email: {
                    type: 'string',
                    description: 'Contact email (optional)',
                  },
                  contact_name: {
                    type: 'string',
                    description: 'Contact name (optional)',
                  },
                  subject: {
                    type: 'string',
                    description: 'Ticket subject/title (required)',
                  },
                  description: {
                    type: 'string',
                    description: 'Detailed ticket description (required)',
                  },
                  priority: {
                    type: 'string',
                    enum: ['Low', 'Medium', 'High', 'Critical'],
                    description: 'Priority level - infer from description. Default: Medium',
                  },
                  category: {
                    type: 'string',
                    description: 'Ticket category - infer from description. Common: Technical, General, Feature Request, Refund. Default: General',
                  },
                  status: {
                    type: 'string',
                    enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
                    description: 'Ticket status (default: Open)',
                  },
                },
                required: ['contact_phone', 'subject', 'description'],
              },
            },
            {
              name: 'update_support_ticket',
              description: 'Update an existing support ticket. Can update status, priority, category, description, assigned team member, and add satisfaction ratings.',
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
                  ticket_id: {
                    type: 'string',
                    description: 'Ticket ID to update (required)',
                  },
                  status: {
                    type: 'string',
                    enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
                  },
                  priority: {
                    type: 'string',
                    enum: ['Low', 'Medium', 'High', 'Critical'],
                  },
                  category: { type: 'string' },
                  subject: { type: 'string' },
                  description: { type: 'string' },
                  assigned_to: { type: 'string' },
                  satisfaction: {
                    type: 'number',
                    description: 'Satisfaction rating (1-5)',
                  },
                  response_time: { type: 'string' },
                },
                required: ['ticket_id'],
              },
            },
            {
              name: 'delete_support_ticket',
              description: 'Delete a support ticket by ticket_id',
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
                  ticket_id: {
                    type: 'string',
                    description: 'Ticket ID to delete',
                  },
                },
                required: ['ticket_id'],
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
        const supportServerPerms = allPermissions['support-server'] || { enabled: false, tools: [] }
        const enabledTools = supportServerPerms.tools || []

        switch (name) {
          case 'get_support_tickets': {
            if (!enabledTools.includes('get_support_tickets')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Support',
                action: 'get_support_tickets',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to view support tickets' },
              })
              throw new Error('Agent does not have permission to view support tickets')
            }

            let query = supabase
              .from('support_tickets')
              .select('*, contacts_master(full_name, email, phone)')
              .order('created_at', { ascending: false })

            if (args.ticket_id) {
              query = query.eq('ticket_id', args.ticket_id)
            }
            if (args.status) {
              query = query.eq('status', args.status)
            }
            if (args.priority) {
              query = query.eq('priority', args.priority)
            }
            if (args.category) {
              query = query.ilike('category', `%${args.category}%`)
            }
            if (args.assigned_to) {
              query = query.eq('assigned_to', args.assigned_to)
            }
            if (args.from_date) {
              query = query.gte('created_at', args.from_date)
            }
            if (args.to_date) {
              query = query.lte('created_at', args.to_date)
            }

            if (args.contact_email || args.contact_phone) {
              const contactQuery = supabase.from('contacts_master').select('id')
              if (args.contact_email) {
                contactQuery.eq('email', args.contact_email)
              }
              if (args.contact_phone) {
                contactQuery.eq('phone', args.contact_phone)
              }
              const { data: contactData } = await contactQuery.maybeSingle()
              if (contactData) {
                query = query.eq('contact_id', contactData.id)
              }
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
                module: 'Support',
                action: 'get_support_tickets',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Support',
              action: 'get_support_tickets',
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

          case 'get_support_summary': {
            if (!enabledTools.includes('get_support_tickets')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Support',
                action: 'get_support_summary',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to view support tickets' },
              })
              throw new Error('Agent does not have permission to view support tickets')
            }

            let query = supabase.from('support_tickets').select('*')

            if (args.from_date) {
              query = query.gte('created_at', args.from_date)
            }
            if (args.to_date) {
              query = query.lte('created_at', args.to_date)
            }
            if (args.status) {
              query = query.eq('status', args.status)
            }
            if (args.priority) {
              query = query.eq('priority', args.priority)
            }

            const { data: tickets, error } = await query

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Support',
                action: 'get_support_summary',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message },
              })
              throw error
            }

            const summary = {
              total_count: tickets?.length || 0,
              by_status: {} as Record<string, { count: number }>,
              by_priority: {} as Record<string, { count: number }>,
              by_category: {} as Record<string, { count: number }>,
              avg_satisfaction: 0,
              resolution_rate: 0,
              latest_tickets: tickets?.slice(0, 5).map(t => ({
                ticket_id: t.ticket_id,
                subject: t.subject,
                status: t.status,
                priority: t.priority,
                category: t.category,
                created_at: t.created_at,
              })) || [],
            }

            let totalSatisfaction = 0
            let satisfactionCount = 0
            let resolvedCount = 0

            tickets?.forEach((ticket) => {
              const status = ticket.status || 'Unknown'
              const priority = ticket.priority || 'Unknown'
              const category = ticket.category || 'Unknown'

              if (!summary.by_status[status]) {
                summary.by_status[status] = { count: 0 }
              }
              summary.by_status[status].count += 1

              if (!summary.by_priority[priority]) {
                summary.by_priority[priority] = { count: 0 }
              }
              summary.by_priority[priority].count += 1

              if (!summary.by_category[category]) {
                summary.by_category[category] = { count: 0 }
              }
              summary.by_category[category].count += 1

              if (ticket.satisfaction) {
                totalSatisfaction += ticket.satisfaction
                satisfactionCount++
              }

              if (status === 'Resolved') {
                resolvedCount++
              }
            })

            summary.avg_satisfaction = satisfactionCount > 0 ? totalSatisfaction / satisfactionCount : 0
            summary.resolution_rate = summary.total_count > 0 ? (resolvedCount / summary.total_count) * 100 : 0

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Support',
              action: 'get_support_summary',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { filters: args, total_tickets: summary.total_count },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, summary }, null, 2),
                },
              ],
            }
            break
          }

          case 'create_support_ticket': {
            if (!enabledTools.includes('create_support_ticket')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Support',
                action: 'create_support_ticket',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to create support tickets' },
              })
              throw new Error('Agent does not have permission to create support tickets')
            }

            let contactId: string | null = null

            const { data: existingContact } = await supabase
              .from('contacts_master')
              .select('id')
              .eq('phone', args.contact_phone)
              .maybeSingle()

            if (existingContact) {
              contactId = existingContact.id
            } else {
              const { data: newContact, error: contactError } = await supabase
                .from('contacts_master')
                .insert({
                  phone: args.contact_phone,
                  email: args.contact_email || null,
                  full_name: args.contact_name || null,
                })
                .select('id')
                .single()

              if (contactError) {
                throw new Error(`Failed to create contact: ${contactError.message}`)
              }
              contactId = newContact.id
            }

            const ticketData = {
              contact_id: contactId,
              subject: args.subject,
              description: args.description,
              priority: args.priority || 'Medium',
              category: args.category || 'General',
              status: args.status || 'Open',
            }

            const { data, error } = await supabase
              .from('support_tickets')
              .insert(ticketData)
              .select('*, contacts_master(full_name, email, phone)')
              .single()

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Support',
                action: 'create_support_ticket',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, ticket_data: args },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Support',
              action: 'create_support_ticket',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { ticket_id: data.ticket_id, subject: args.subject },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: 'Support ticket created successfully',
                    ticket: data
                  }, null, 2),
                },
              ],
            }
            break
          }

          case 'update_support_ticket': {
            if (!enabledTools.includes('update_support_ticket')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Support',
                action: 'update_support_ticket',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to update support tickets' },
              })
              throw new Error('Agent does not have permission to update support tickets')
            }

            const { ticket_id, ...updates } = args
            delete updates.agent_id
            delete updates.phone_number

            const { data, error } = await supabase
              .from('support_tickets')
              .update(updates)
              .eq('ticket_id', ticket_id)
              .select('*, contacts_master(full_name, email, phone)')
              .single()

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Support',
                action: 'update_support_ticket',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, ticket_id, updates },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Support',
              action: 'update_support_ticket',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { ticket_id, updates },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, message: 'Support ticket updated successfully', ticket: data }, null, 2),
                },
              ],
            }
            break
          }

          case 'delete_support_ticket': {
            if (!enabledTools.includes('delete_support_ticket')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Support',
                action: 'delete_support_ticket',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to delete support tickets' },
              })
              throw new Error('Agent does not have permission to delete support tickets')
            }

            const { error } = await supabase
              .from('support_tickets')
              .delete()
              .eq('ticket_id', args.ticket_id)

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Support',
                action: 'delete_support_ticket',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, ticket_id: args.ticket_id },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Support',
              action: 'delete_support_ticket',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { ticket_id: args.ticket_id },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, message: 'Support ticket deleted successfully', ticket_id: args.ticket_id }, null, 2),
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
    console.error('MCP Support Server Error:', error)
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
