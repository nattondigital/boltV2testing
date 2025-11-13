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

        console.log('MCP Contacts Server session initialized', { sessionId, agentId })

        response.result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
          serverInfo: {
            name: 'crm-contacts-mcp-server',
            version: '1.0.0',
          },
        }
        break
      }

      case 'resources/list': {
        response.result = {
          resources: [
            {
              uri: 'contacts://all',
              name: 'All Contacts',
              description: 'Complete list of all contacts in the system',
              mimeType: 'application/json',
            },
            {
              uri: 'contacts://active',
              name: 'Active Contacts',
              description: 'Contacts with status "Active"',
              mimeType: 'application/json',
            },
            {
              uri: 'contacts://customers',
              name: 'Customer Contacts',
              description: 'Contacts with type "Customer"',
              mimeType: 'application/json',
            },
            {
              uri: 'contacts://vendors',
              name: 'Vendor Contacts',
              description: 'Contacts with type "Vendor"',
              mimeType: 'application/json',
            },
            {
              uri: 'contacts://recent',
              name: 'Recently Added Contacts',
              description: 'Contacts added in the last 30 days',
              mimeType: 'application/json',
            },
            {
              uri: 'contacts://statistics',
              name: 'Contact Statistics',
              description: 'Aggregated statistics about contacts',
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

        if (uri === 'contacts://statistics') {
          const { data: allContacts, error: allError } = await supabase.from('contacts_master').select('*')
          if (allError) throw allError

          const stats = {
            total: allContacts?.length || 0,
            by_type: {
              'Customer': allContacts?.filter((c: any) => c.contact_type === 'Customer').length || 0,
              'Vendor': allContacts?.filter((c: any) => c.contact_type === 'Vendor').length || 0,
              'Partner': allContacts?.filter((c: any) => c.contact_type === 'Partner').length || 0,
              'Lead': allContacts?.filter((c: any) => c.contact_type === 'Lead').length || 0,
            },
            by_status: {
              'Active': allContacts?.filter((c: any) => c.status === 'Active').length || 0,
              'Inactive': allContacts?.filter((c: any) => c.status === 'Inactive').length || 0,
            },
            with_email: allContacts?.filter((c: any) => c.email).length || 0,
            with_phone: allContacts?.filter((c: any) => c.phone).length || 0,
            with_business: allContacts?.filter((c: any) => c.business_name).length || 0,
          }

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
          let query = supabase.from('contacts_master').select('*')

          if (uri === 'contacts://active') {
            query = query.eq('status', 'Active')
          } else if (uri === 'contacts://customers') {
            query = query.eq('contact_type', 'Customer')
          } else if (uri === 'contacts://vendors') {
            query = query.eq('contact_type', 'Vendor')
          } else if (uri === 'contacts://recent') {
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
            query = query.gte('created_at', thirtyDaysAgo.toISOString())
          }

          query = query.order('created_at', { ascending: false })

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
              name: 'contact_summary',
              description: 'Provides a comprehensive summary of contacts',
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
              name: 'get_contacts',
              description: 'Retrieve contacts with advanced filtering. Use contact_id to get a specific contact. Use name to search by contact name.',
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
                  contact_id: {
                    type: 'string',
                    description: 'Get a specific contact by contact_id (e.g., CONT0001)',
                  },
                  name: {
                    type: 'string',
                    description: 'Search by contact name (case-insensitive partial match, e.g., "Amit" will find "Amit Kumar")',
                  },
                  email: {
                    type: 'string',
                    description: 'Search by email address',
                  },
                  phone: {
                    type: 'string',
                    description: 'Search by phone number',
                  },
                  contact_type: {
                    type: 'string',
                    enum: ['Customer', 'Vendor', 'Partner', 'Lead'],
                    description: 'Filter by contact type',
                  },
                  status: {
                    type: 'string',
                    enum: ['Active', 'Inactive'],
                    description: 'Filter by status',
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum number of contacts to return (default: 100)',
                  },
                },
              },
            },
            {
              name: 'create_contact',
              description: 'Create a new contact',
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
                  full_name: {
                    type: 'string',
                    description: 'Full name of the contact',
                  },
                  email: {
                    type: 'string',
                    description: 'Email address (required)',
                  },
                  phone: {
                    type: 'string',
                    description: 'Phone number',
                  },
                  contact_type: {
                    type: 'string',
                    enum: ['Customer', 'Vendor', 'Partner', 'Lead'],
                    description: 'Type of contact (default: Customer)',
                  },
                  status: {
                    type: 'string',
                    enum: ['Active', 'Inactive'],
                    description: 'Status (default: Active)',
                  },
                  business_name: {
                    type: 'string',
                    description: 'Business or company name',
                  },
                  address: {
                    type: 'string',
                    description: 'Full address',
                  },
                  city: {
                    type: 'string',
                    description: 'City',
                  },
                  state: {
                    type: 'string',
                    description: 'State',
                  },
                  pincode: {
                    type: 'string',
                    description: 'PIN/ZIP code',
                  },
                  gst_number: {
                    type: 'string',
                    description: 'GST number (for Indian businesses)',
                  },
                  profession: {
                    type: 'string',
                    description: 'Profession or job title',
                  },
                  notes: {
                    type: 'string',
                    description: 'Additional notes',
                  },
                },
                required: ['full_name', 'email'],
              },
            },
            {
              name: 'update_contact',
              description: 'Update an existing contact',
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
                  contact_id: {
                    type: 'string',
                    description: 'Contact ID to update',
                  },
                  full_name: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  contact_type: {
                    type: 'string',
                    enum: ['Customer', 'Vendor', 'Partner', 'Lead'],
                  },
                  status: {
                    type: 'string',
                    enum: ['Active', 'Inactive'],
                  },
                  business_name: { type: 'string' },
                  address: { type: 'string' },
                  city: { type: 'string' },
                  state: { type: 'string' },
                  pincode: { type: 'string' },
                  gst_number: { type: 'string' },
                  profession: { type: 'string' },
                  notes: { type: 'string' },
                },
                required: ['contact_id'],
              },
            },
            {
              name: 'delete_contact',
              description: 'Delete a contact by contact_id',
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
                  contact_id: {
                    type: 'string',
                    description: 'Contact ID to delete',
                  },
                },
                required: ['contact_id'],
              },
            },
            {
              name: 'add_contact_note',
              description: 'Add a note to a contact',
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
                  contact_id: {
                    type: 'string',
                    description: 'Contact ID',
                  },
                  note: {
                    type: 'string',
                    description: 'Note content',
                  },
                },
                required: ['contact_id', 'note'],
              },
            },
            {
              name: 'get_contact_notes',
              description: 'Get all notes for a contact',
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
                  contact_id: {
                    type: 'string',
                    description: 'Contact ID',
                  },
                },
                required: ['contact_id'],
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
        const contactsServerPerms = allPermissions['contacts-server'] || { enabled: false, tools: [] }
        const enabledTools = contactsServerPerms.tools || []

        switch (name) {
          case 'get_contacts': {
            if (!enabledTools.includes('get_contacts')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Contacts',
                action: 'get_contacts',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to view contacts' },
              })
              throw new Error('Agent does not have permission to view contacts')
            }

            let query = supabase
              .from('contacts_master')
              .select('*')
              .order('created_at', { ascending: false })

            if (args.contact_id) {
              query = query.eq('contact_id', args.contact_id)
            }
            if (args.name) {
              query = query.ilike('name', `%${args.name}%`)
            }
            if (args.email) {
              query = query.eq('email', args.email)
            }
            if (args.phone) {
              query = query.eq('phone', args.phone)
            }
            if (args.contact_type) {
              query = query.eq('contact_type', args.contact_type)
            }
            if (args.status) {
              query = query.eq('status', args.status)
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
                module: 'Contacts',
                action: 'get_contacts',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Contacts',
              action: 'get_contacts',
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

          case 'create_contact': {
            if (!enabledTools.includes('create_contact')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Contacts',
                action: 'create_contact',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to create contacts' },
              })
              throw new Error('Agent does not have permission to create contacts')
            }

            const contactData = {
              full_name: args.full_name,
              email: args.email,
              phone: args.phone || null,
              contact_type: args.contact_type || 'Customer',
              status: args.status || 'Active',
              business_name: args.business_name || null,
              address: args.address || null,
              city: args.city || null,
              state: args.state || null,
              pincode: args.pincode || null,
              gst_number: args.gst_number || null,
              profession: args.profession || null,
              notes: args.notes || null,
            }

            const { data, error } = await supabase
              .from('contacts_master')
              .insert(contactData)
              .select()
              .single()

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Contacts',
                action: 'create_contact',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, contact_data: args },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Contacts',
              action: 'create_contact',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { contact_id: data.contact_id, full_name: args.full_name },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: 'Contact created successfully',
                    contact: data
                  }, null, 2),
                },
              ],
            }
            break
          }

          case 'update_contact': {
            if (!enabledTools.includes('update_contact')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Contacts',
                action: 'update_contact',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to edit contacts' },
              })
              throw new Error('Agent does not have permission to edit contacts')
            }

            const { contact_id, ...updates } = args
            delete updates.agent_id
            delete updates.phone_number

            const { data, error } = await supabase
              .from('contacts_master')
              .update(updates)
              .eq('contact_id', contact_id)
              .select()
              .single()

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Contacts',
                action: 'update_contact',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, contact_id, updates },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Contacts',
              action: 'update_contact',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { contact_id, updates },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, message: 'Contact updated successfully', contact: data }, null, 2),
                },
              ],
            }
            break
          }

          case 'delete_contact': {
            if (!enabledTools.includes('delete_contact')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Contacts',
                action: 'delete_contact',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to delete contacts' },
              })
              throw new Error('Agent does not have permission to delete contacts')
            }

            const { error } = await supabase
              .from('contacts_master')
              .delete()
              .eq('contact_id', args.contact_id)

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Contacts',
                action: 'delete_contact',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, contact_id: args.contact_id },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Contacts',
              action: 'delete_contact',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { contact_id: args.contact_id },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, message: 'Contact deleted successfully', contact_id: args.contact_id }, null, 2),
                },
              ],
            }
            break
          }

          case 'add_contact_note': {
            if (!enabledTools.includes('add_contact_note')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Contacts',
                action: 'add_contact_note',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to add contact notes' },
              })
              throw new Error('Agent does not have permission to add contact notes')
            }

            // First get the contact UUID from contact_id
            const { data: contact, error: contactError } = await supabase
              .from('contacts_master')
              .select('id')
              .eq('contact_id', args.contact_id)
              .maybeSingle()

            if (contactError || !contact) {
              throw new Error('Contact not found')
            }

            const { data, error } = await supabase
              .from('contact_notes')
              .insert({
                contact_id: contact.id,
                note: args.note,
              })
              .select()
              .single()

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Contacts',
                action: 'add_contact_note',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, contact_id: args.contact_id },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Contacts',
              action: 'add_contact_note',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { contact_id: args.contact_id, note_id: data.id },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, message: 'Note added successfully', note: data }, null, 2),
                },
              ],
            }
            break
          }

          case 'get_contact_notes': {
            if (!enabledTools.includes('get_contact_notes')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Contacts',
                action: 'get_contact_notes',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to view contact notes' },
              })
              throw new Error('Agent does not have permission to view contact notes')
            }

            // First get the contact UUID from contact_id
            const { data: contact, error: contactError } = await supabase
              .from('contacts_master')
              .select('id')
              .eq('contact_id', args.contact_id)
              .maybeSingle()

            if (contactError || !contact) {
              throw new Error('Contact not found')
            }

            const { data, error } = await supabase
              .from('contact_notes')
              .select('*')
              .eq('contact_id', contact.id)
              .order('created_at', { ascending: false })

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Contacts',
                action: 'get_contact_notes',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, contact_id: args.contact_id },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Contacts',
              action: 'get_contact_notes',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { contact_id: args.contact_id, notes_count: data?.length || 0 },
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
    console.error('MCP Contacts Server Error:', error)
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
