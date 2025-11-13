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

        console.log('MCP Appointments Server session initialized', { sessionId, agentId })

        response.result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
          serverInfo: {
            name: 'crm-appointments-mcp-server',
            version: '1.0.0',
          },
        }
        break
      }

      case 'resources/list': {
        response.result = {
          resources: [
            {
              uri: 'appointments://all',
              name: 'All Appointments',
              description: 'Complete list of all appointments',
              mimeType: 'application/json',
            },
            {
              uri: 'appointments://today',
              name: "Today's Appointments",
              description: 'Appointments scheduled for today',
              mimeType: 'application/json',
            },
            {
              uri: 'appointments://upcoming',
              name: 'Upcoming Appointments',
              description: 'Appointments scheduled in the future',
              mimeType: 'application/json',
            },
            {
              uri: 'appointments://scheduled',
              name: 'Scheduled Appointments',
              description: 'Appointments with status "Scheduled"',
              mimeType: 'application/json',
            },
            {
              uri: 'appointments://confirmed',
              name: 'Confirmed Appointments',
              description: 'Appointments with status "Confirmed"',
              mimeType: 'application/json',
            },
            {
              uri: 'appointments://statistics',
              name: 'Appointment Statistics',
              description: 'Aggregated statistics about appointments',
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

        if (uri === 'appointments://statistics') {
          const { data: allAppts, error: allError } = await supabase.from('appointments').select('*')
          if (allError) throw allError

          const today = new Date().toISOString().split('T')[0]

          const stats = {
            total: allAppts?.length || 0,
            by_status: {
              'Scheduled': allAppts?.filter((a: any) => a.status === 'Scheduled').length || 0,
              'Confirmed': allAppts?.filter((a: any) => a.status === 'Confirmed').length || 0,
              'Completed': allAppts?.filter((a: any) => a.status === 'Completed').length || 0,
              'Cancelled': allAppts?.filter((a: any) => a.status === 'Cancelled').length || 0,
              'No-Show': allAppts?.filter((a: any) => a.status === 'No-Show').length || 0,
            },
            by_type: {
              'In-Person': allAppts?.filter((a: any) => a.meeting_type === 'In-Person').length || 0,
              'Video Call': allAppts?.filter((a: any) => a.meeting_type === 'Video Call').length || 0,
              'Phone Call': allAppts?.filter((a: any) => a.meeting_type === 'Phone Call').length || 0,
            },
            by_purpose: {} as Record<string, number>,
            today: allAppts?.filter((a: any) => a.appointment_date === today).length || 0,
            upcoming: allAppts?.filter((a: any) => a.appointment_date >= today).length || 0,
          }

          // Count by purpose
          allAppts?.forEach((appt: any) => {
            const purpose = appt.purpose || 'Other'
            stats.by_purpose[purpose] = (stats.by_purpose[purpose] || 0) + 1
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
          let query = supabase.from('appointments').select('*')

          const today = new Date().toISOString().split('T')[0]

          if (uri === 'appointments://today') {
            query = query.eq('appointment_date', today)
          } else if (uri === 'appointments://upcoming') {
            query = query.gte('appointment_date', today)
          } else if (uri === 'appointments://scheduled') {
            query = query.eq('status', 'Scheduled')
          } else if (uri === 'appointments://confirmed') {
            query = query.eq('status', 'Confirmed')
          }

          query = query.order('appointment_date', { ascending: true }).order('appointment_time', { ascending: true })

          const { data, error} = await query

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
              name: 'appointment_summary',
              description: 'Provides a comprehensive summary of appointments',
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
              name: 'get_appointments',
              description: 'Retrieve appointments with advanced filtering. Use appointment_id to get a specific appointment.',
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
                  appointment_id: {
                    type: 'string',
                    description: 'Get specific appointment by ID (e.g., APT-123456789)',
                  },
                  contact_phone: {
                    type: 'string',
                    description: 'Filter by contact phone number',
                  },
                  contact_email: {
                    type: 'string',
                    description: 'Filter by contact email',
                  },
                  appointment_date: {
                    type: 'string',
                    description: 'Filter by date (YYYY-MM-DD)',
                  },
                  status: {
                    type: 'string',
                    enum: ['Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No-Show'],
                    description: 'Filter by appointment status',
                  },
                  meeting_type: {
                    type: 'string',
                    enum: ['In-Person', 'Video Call', 'Phone Call'],
                    description: 'Filter by meeting type',
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum number of appointments (default: 100)',
                  },
                },
              },
            },
            {
              name: 'create_appointment',
              description: 'Create a new appointment',
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
                  title: {
                    type: 'string',
                    description: 'Appointment title',
                  },
                  contact_name: {
                    type: 'string',
                    description: 'Contact full name',
                  },
                  contact_phone: {
                    type: 'string',
                    description: 'Contact phone number (required)',
                  },
                  contact_email: {
                    type: 'string',
                    description: 'Contact email',
                  },
                  appointment_date: {
                    type: 'string',
                    description: 'Appointment date (YYYY-MM-DD)',
                  },
                  appointment_time: {
                    type: 'string',
                    description: 'Appointment time in UTC (HH:MM, 24-hour). MUST be UTC, not IST. Example: 2 PM IST = 08:30 UTC',
                  },
                  duration_minutes: {
                    type: 'number',
                    description: 'Duration in minutes (default: 30)',
                  },
                  location: {
                    type: 'string',
                    description: 'Meeting location',
                  },
                  meeting_type: {
                    type: 'string',
                    enum: ['In-Person', 'Video Call', 'Phone Call'],
                    description: 'Type of meeting',
                  },
                  purpose: {
                    type: 'string',
                    enum: ['Sales Meeting', 'Product Demo', 'Follow-up', 'Consultation', 'Other'],
                    description: 'Purpose of appointment',
                  },
                  notes: {
                    type: 'string',
                    description: 'Additional notes',
                  },
                },
                required: ['title', 'contact_name', 'contact_phone', 'appointment_date', 'appointment_time', 'meeting_type', 'purpose'],
              },
            },
            {
              name: 'update_appointment',
              description: 'Update an existing appointment',
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
                  appointment_id: {
                    type: 'string',
                    description: 'Appointment ID to update',
                  },
                  title: { type: 'string' },
                  contact_name: { type: 'string' },
                  contact_phone: { type: 'string' },
                  contact_email: { type: 'string' },
                  appointment_date: {
                    type: 'string',
                    description: 'New date (YYYY-MM-DD)',
                  },
                  appointment_time: {
                    type: 'string',
                    description: 'New time in UTC (HH:MM). MUST be UTC, not IST. Example: 11 AM IST = 05:30 UTC',
                  },
                  duration_minutes: { type: 'number' },
                  location: { type: 'string' },
                  meeting_type: {
                    type: 'string',
                    enum: ['In-Person', 'Video Call', 'Phone Call'],
                  },
                  status: {
                    type: 'string',
                    enum: ['Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No-Show'],
                  },
                  purpose: {
                    type: 'string',
                    enum: ['Sales Meeting', 'Product Demo', 'Follow-up', 'Consultation', 'Other'],
                  },
                  notes: { type: 'string' },
                },
                required: ['appointment_id'],
              },
            },
            {
              name: 'delete_appointment',
              description: 'Delete an appointment by appointment_id',
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
                  appointment_id: {
                    type: 'string',
                    description: 'Appointment ID to delete',
                  },
                },
                required: ['appointment_id'],
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
        const appointmentsServerPerms = allPermissions['appointments-server'] || { enabled: false, tools: [] }
        const enabledTools = appointmentsServerPerms.tools || []

        switch (name) {
          case 'get_appointments': {
            if (!enabledTools.includes('get_appointments')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Appointments',
                action: 'get_appointments',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to view appointments' },
              })
              throw new Error('Agent does not have permission to view appointments')
            }

            let query = supabase
              .from('appointments')
              .select('*')
              .order('appointment_date', { ascending: true })
              .order('appointment_time', { ascending: true })

            if (args.appointment_id) {
              query = query.eq('appointment_id', args.appointment_id)
            }
            if (args.contact_phone) {
              query = query.eq('contact_phone', args.contact_phone)
            }
            if (args.contact_email) {
              query = query.eq('contact_email', args.contact_email)
            }
            if (args.appointment_date) {
              query = query.eq('appointment_date', args.appointment_date)
            }
            if (args.status) {
              query = query.eq('status', args.status)
            }
            if (args.meeting_type) {
              query = query.eq('meeting_type', args.meeting_type)
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
                module: 'Appointments',
                action: 'get_appointments',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Appointments',
              action: 'get_appointments',
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

          case 'create_appointment': {
            if (!enabledTools.includes('create_appointment')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Appointments',
                action: 'create_appointment',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to create appointments' },
              })
              throw new Error('Agent does not have permission to create appointments')
            }

            const appointmentData = {
              title: args.title,
              contact_name: args.contact_name,
              contact_phone: args.contact_phone,
              contact_email: args.contact_email || null,
              appointment_date: args.appointment_date,
              appointment_time: args.appointment_time,
              duration_minutes: args.duration_minutes || 30,
              location: args.location || null,
              meeting_type: args.meeting_type,
              purpose: args.purpose,
              notes: args.notes || null,
              status: 'Scheduled',
            }

            const { data, error } = await supabase
              .from('appointments')
              .insert(appointmentData)
              .select()
              .single()

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Appointments',
                action: 'create_appointment',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, appointment_data: args },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Appointments',
              action: 'create_appointment',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { appointment_id: data.appointment_id, title: args.title },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: 'Appointment created successfully',
                    appointment: data
                  }, null, 2),
                },
              ],
            }
            break
          }

          case 'update_appointment': {
            if (!enabledTools.includes('update_appointment')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Appointments',
                action: 'update_appointment',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to edit appointments' },
              })
              throw new Error('Agent does not have permission to edit appointments')
            }

            const { appointment_id, ...updates } = args
            delete updates.agent_id
            delete updates.phone_number

            const { data, error } = await supabase
              .from('appointments')
              .update(updates)
              .eq('appointment_id', appointment_id)
              .select()
              .single()

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Appointments',
                action: 'update_appointment',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, appointment_id, updates },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Appointments',
              action: 'update_appointment',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { appointment_id, updates },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, message: 'Appointment updated successfully', appointment: data }, null, 2),
                },
              ],
            }
            break
          }

          case 'delete_appointment': {
            if (!enabledTools.includes('delete_appointment')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Appointments',
                action: 'delete_appointment',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to delete appointments' },
              })
              throw new Error('Agent does not have permission to delete appointments')
            }

            const { error } = await supabase
              .from('appointments')
              .delete()
              .eq('appointment_id', args.appointment_id)

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Appointments',
                action: 'delete_appointment',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, appointment_id: args.appointment_id },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Appointments',
              action: 'delete_appointment',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { appointment_id: args.appointment_id },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, message: 'Appointment deleted successfully', appointment_id: args.appointment_id }, null, 2),
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
    console.error('MCP Appointments Server Error:', error)
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
