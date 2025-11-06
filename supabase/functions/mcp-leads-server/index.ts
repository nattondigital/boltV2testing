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

        console.log('MCP Leads Server session initialized', { sessionId, agentId })

        response.result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
          serverInfo: {
            name: 'crm-leads-mcp-server',
            version: '1.0.0',
          },
        }
        break
      }

      case 'resources/list': {
        response.result = {
          resources: [
            {
              uri: 'leads://all',
              name: 'All Leads',
              description: 'Complete list of all leads in the system',
              mimeType: 'application/json',
            },
            {
              uri: 'leads://new',
              name: 'New Leads',
              description: 'Leads with stage "New"',
              mimeType: 'application/json',
            },
            {
              uri: 'leads://hot',
              name: 'Hot Leads',
              description: 'Leads with interest "Hot"',
              mimeType: 'application/json',
            },
            {
              uri: 'leads://won',
              name: 'Won Leads',
              description: 'Leads with stage "Won"',
              mimeType: 'application/json',
            },
            {
              uri: 'leads://lost',
              name: 'Lost Leads',
              description: 'Leads with stage "Lost"',
              mimeType: 'application/json',
            },
            {
              uri: 'leads://statistics',
              name: 'Lead Statistics',
              description: 'Aggregated statistics about leads',
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

        if (uri === 'leads://statistics') {
          const { data: allLeads, error: allError } = await supabase.from('leads').select('*')
          if (allError) throw allError

          const stats = {
            total: allLeads?.length || 0,
            by_stage: {
              'New': allLeads?.filter((l: any) => l.stage === 'New').length || 0,
              'Contacted': allLeads?.filter((l: any) => l.stage === 'Contacted').length || 0,
              'Demo Booked': allLeads?.filter((l: any) => l.stage === 'Demo Booked').length || 0,
              'No Show': allLeads?.filter((l: any) => l.stage === 'No Show').length || 0,
              'Won': allLeads?.filter((l: any) => l.stage === 'Won').length || 0,
              'Lost': allLeads?.filter((l: any) => l.stage === 'Lost').length || 0,
            },
            by_interest: {
              'Hot': allLeads?.filter((l: any) => l.interest === 'Hot').length || 0,
              'Warm': allLeads?.filter((l: any) => l.interest === 'Warm').length || 0,
              'Cold': allLeads?.filter((l: any) => l.interest === 'Cold').length || 0,
            },
            by_source: {} as Record<string, number>,
            average_score: allLeads?.reduce((sum: number, l: any) => sum + (l.lead_score || 0), 0) / (allLeads?.length || 1),
          }

          allLeads?.forEach((lead: any) => {
            const source = lead.source || 'Unknown'
            stats.by_source[source] = (stats.by_source[source] || 0) + 1
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
          let query = supabase.from('leads').select('*')

          if (uri === 'leads://new') {
            query = query.eq('stage', 'New')
          } else if (uri === 'leads://hot') {
            query = query.eq('interest', 'Hot')
          } else if (uri === 'leads://won') {
            query = query.eq('stage', 'Won')
          } else if (uri === 'leads://lost') {
            query = query.eq('stage', 'Lost')
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
              name: 'lead_summary',
              description: 'Provides a comprehensive summary of leads',
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
              name: 'get_pipelines',
              description: 'Get all available pipelines. Use this BEFORE updating a lead to see which pipelines exist.',
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
                },
              },
            },
            {
              name: 'get_pipeline_stages',
              description: 'Get all valid stages for a specific pipeline. ALWAYS use this before updating a lead stage to ensure you use a valid stage name.',
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
                  pipeline_id: {
                    type: 'string',
                    description: 'Pipeline ID to get stages for (get from lead.pipeline_id or use get_pipelines first)',
                  },
                },
                required: ['pipeline_id'],
              },
            },
            {
              name: 'get_leads',
              description: 'Retrieve leads with advanced filtering. Use lead_id to get a specific lead. Can filter by name, stage, and other fields. Returns pipeline_id which you can use with get_pipeline_stages.',
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
                  lead_id: {
                    type: 'string',
                    description: 'Get a specific lead by lead_id (e.g., LEAD0001, L034)',
                  },
                  name: {
                    type: 'string',
                    description: 'Search by lead name (partial match supported)',
                  },
                  email: {
                    type: 'string',
                    description: 'Search by email address',
                  },
                  phone: {
                    type: 'string',
                    description: 'Search by phone number',
                  },
                  stage: {
                    type: 'string',
                    description: 'Filter by lead stage (e.g., New, Contacted, computation, Won, Lost)',
                  },
                  interest: {
                    type: 'string',
                    enum: ['Hot', 'Warm', 'Cold'],
                    description: 'Filter by interest level',
                  },
                  source: {
                    type: 'string',
                    description: 'Filter by lead source',
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum number of leads to return (default: 100)',
                  },
                },
              },
            },
            {
              name: 'create_lead',
              description: 'Create a new lead',
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
                  name: {
                    type: 'string',
                    description: 'Lead full name',
                  },
                  email: {
                    type: 'string',
                    description: 'Email address (required)',
                  },
                  phone: {
                    type: 'string',
                    description: 'Phone number',
                  },
                  source: {
                    type: 'string',
                    description: 'Lead source (e.g., Website, Ad, Referral, FB ADS)',
                  },
                  interest: {
                    type: 'string',
                    enum: ['Hot', 'Warm', 'Cold'],
                    description: 'Interest level (default: Warm)',
                  },
                  stage: {
                    type: 'string',
                    description: 'Lead stage (default: New)',
                  },
                  company: {
                    type: 'string',
                    description: 'Company name',
                  },
                  address: {
                    type: 'string',
                    description: 'Address',
                  },
                  notes: {
                    type: 'string',
                    description: 'Additional notes',
                  },
                  lead_score: {
                    type: 'number',
                    description: 'Lead score 0-100 (default: 50)',
                  },
                },
                required: ['name', 'email'],
              },
            },
            {
              name: 'update_lead',
              description: 'Update any field of an existing lead including name, email, phone, source, interest, stage, company, address, notes, and lead_score. You can update one or multiple fields in a single call. IMPORTANT: Before updating stage, you MUST first use get_leads to get the lead\'s pipeline_id, then use get_pipeline_stages to see valid stages. Only use stage names that exist in that pipeline.',
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
                  lead_id: {
                    type: 'string',
                    description: 'Lead ID to update',
                  },
                  name: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  source: { type: 'string' },
                  interest: {
                    type: 'string',
                    enum: ['Hot', 'Warm', 'Cold'],
                  },
                  stage: {
                    type: 'string',
                    description: 'Must be a valid stage from the lead\'s pipeline. Use get_pipeline_stages first to see valid options.',
                  },
                  company: { type: 'string' },
                  address: { type: 'string' },
                  notes: { type: 'string' },
                  lead_score: { type: 'number' },
                },
                required: ['lead_id'],
              },
            },
            {
              name: 'delete_lead',
              description: 'Delete a lead by lead_id',
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
                  lead_id: {
                    type: 'string',
                    description: 'Lead ID to delete',
                  },
                },
                required: ['lead_id'],
              },
            },
            {
              name: 'get_custom_fields',
              description: 'Get custom fields for a specific pipeline. Use this to see what custom fields exist for a lead\'s pipeline before updating custom field values.',
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
                  pipeline_id: {
                    type: 'string',
                    description: 'Pipeline ID to get custom fields for',
                  },
                },
                required: ['pipeline_id'],
              },
            },
            {
              name: 'get_lead_custom_values',
              description: 'Get custom field values for a specific lead',
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
                  lead_id: {
                    type: 'string',
                    description: 'Lead ID to get custom field values for',
                  },
                },
                required: ['lead_id'],
              },
            },
            {
              name: 'update_lead_custom_values',
              description: 'Update custom field values for a lead. Use get_custom_fields first to see available fields and their types.',
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
                  lead_id: {
                    type: 'string',
                    description: 'Lead ID to update custom values for',
                  },
                  custom_values: {
                    type: 'object',
                    description: 'Object with field_key as keys and field values as values. Example: {"custom_1234_status": "Active", "custom_5678_notes": "Important client"}',
                  },
                },
                required: ['lead_id', 'custom_values'],
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
        const leadsServerPerms = allPermissions['leads-server'] || { enabled: false, tools: [] }
        const enabledTools = leadsServerPerms.tools || []

        switch (name) {
          case 'get_pipelines': {
            if (!enabledTools.includes('get_pipelines')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Leads',
                action: 'get_pipelines',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to view pipelines' },
              })
              throw new Error('Agent does not have permission to view pipelines')
            }

            const { data, error } = await supabase
              .from('pipelines')
              .select('*')
              .eq('entity_type', 'lead')
              .eq('is_active', true)
              .order('display_order')

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Leads',
                action: 'get_pipelines',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Leads',
              action: 'get_pipelines',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { count: data?.length || 0 },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    pipelines: data,
                    count: data?.length || 0
                  }, null, 2),
                },
              ],
            }
            break
          }

          case 'get_pipeline_stages': {
            if (!enabledTools.includes('get_pipeline_stages')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Leads',
                action: 'get_pipeline_stages',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to view pipeline stages' },
              })
              throw new Error('Agent does not have permission to view pipeline stages')
            }

            if (!args.pipeline_id) {
              throw new Error('pipeline_id is required')
            }

            const { data, error } = await supabase
              .from('pipeline_stages')
              .select('*')
              .eq('pipeline_id', args.pipeline_id)
              .eq('is_active', true)
              .order('display_order')

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Leads',
                action: 'get_pipeline_stages',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, pipeline_id: args.pipeline_id },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Leads',
              action: 'get_pipeline_stages',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { pipeline_id: args.pipeline_id, stage_count: data?.length || 0 },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    pipeline_id: args.pipeline_id,
                    stages: data,
                    count: data?.length || 0,
                    stage_names: data?.map((s: any) => s.name) || []
                  }, null, 2),
                },
              ],
            }
            break
          }

          case 'get_leads': {
            if (!enabledTools.includes('get_leads')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Leads',
                action: 'get_leads',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to view leads' },
              })
              throw new Error('Agent does not have permission to view leads')
            }

            let query = supabase
              .from('leads')
              .select('*')
              .order('created_at', { ascending: false })

            if (args.lead_id) {
              query = query.eq('lead_id', args.lead_id)
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
            if (args.stage) {
              query = query.ilike('stage', `%${args.stage}%`)
            }
            if (args.interest) {
              query = query.eq('interest', args.interest)
            }
            if (args.source) {
              query = query.eq('source', args.source)
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
                module: 'Leads',
                action: 'get_leads',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Leads',
              action: 'get_leads',
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

          case 'create_lead': {
            if (!enabledTools.includes('create_lead')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Leads',
                action: 'create_lead',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to create leads' },
              })
              throw new Error('Agent does not have permission to create leads')
            }

            const leadData = {
              name: args.name,
              email: args.email,
              phone: args.phone || null,
              source: args.source || 'Website',
              interest: args.interest || 'Warm',
              stage: args.stage || 'New',
              company: args.company || null,
              address: args.address || null,
              notes: args.notes || null,
              lead_score: args.lead_score || 50,
            }

            const { data, error } = await supabase
              .from('leads')
              .insert(leadData)
              .select()
              .single()

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Leads',
                action: 'create_lead',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, lead_data: args },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Leads',
              action: 'create_lead',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { lead_id: data.lead_id, name: args.name },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: 'Lead created successfully',
                    lead: data
                  }, null, 2),
                },
              ],
            }
            break
          }

          case 'update_lead': {
            if (!enabledTools.includes('update_lead')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Leads',
                action: 'update_lead',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to edit leads' },
              })
              throw new Error('Agent does not have permission to edit leads')
            }

            const { lead_id, ...updates } = args
            delete updates.agent_id
            delete updates.phone_number

            // CRITICAL: Validate stage if it's being updated
            if (updates.stage) {
              // First get the lead to find its pipeline
              const { data: existingLead, error: leadError } = await supabase
                .from('leads')
                .select('pipeline_id, name')
                .eq('lead_id', lead_id)
                .maybeSingle()

              if (leadError || !existingLead) {
                throw new Error(`Lead ${lead_id} not found`)
              }

              // Get valid stages for this pipeline
              const { data: validStages, error: stagesError } = await supabase
                .from('pipeline_stages')
                .select('name')
                .eq('pipeline_id', existingLead.pipeline_id)
                .eq('is_active', true)

              if (stagesError) {
                throw new Error(`Failed to validate stage: ${stagesError.message}`)
              }

              const validStageNames = validStages?.map((s: any) => s.name.toLowerCase()) || []
              const requestedStage = updates.stage.toLowerCase()

              // Check if requested stage is valid
              const matchedStage = validStages?.find((s: any) => s.name.toLowerCase() === requestedStage)

              if (!matchedStage) {
                const errorMsg = `Invalid stage "${updates.stage}" for lead ${existingLead.name}. Valid stages: ${validStages?.map((s: any) => s.name).join(', ')}`

                await supabase.from('ai_agent_logs').insert({
                  agent_id: agentId,
                  agent_name: agentName,
                  module: 'Leads',
                  action: 'update_lead',
                  result: 'Error',
                  user_context: args.phone_number || null,
                  details: {
                    error: 'Invalid stage',
                    lead_id,
                    requested_stage: updates.stage,
                    valid_stages: validStages?.map((s: any) => s.name),
                    pipeline_id: existingLead.pipeline_id
                  },
                })

                throw new Error(errorMsg)
              }

              // Use the exact case from the database
              updates.stage = matchedStage.name
            }

            const { data, error } = await supabase
              .from('leads')
              .update(updates)
              .eq('lead_id', lead_id)
              .select()
              .single()

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Leads',
                action: 'update_lead',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, lead_id, updates },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Leads',
              action: 'update_lead',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { lead_id, updates },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, message: 'Lead updated successfully', lead: data }, null, 2),
                },
              ],
            }
            break
          }

          case 'delete_lead': {
            if (!enabledTools.includes('delete_lead')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Leads',
                action: 'delete_lead',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to delete leads' },
              })
              throw new Error('Agent does not have permission to delete leads')
            }

            const { error } = await supabase
              .from('leads')
              .delete()
              .eq('lead_id', args.lead_id)

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Leads',
                action: 'delete_lead',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, lead_id: args.lead_id },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Leads',
              action: 'delete_lead',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { lead_id: args.lead_id },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, message: 'Lead deleted successfully', lead_id: args.lead_id }, null, 2),
                },
              ],
            }
            break
          }

          case 'get_custom_fields': {
            if (!enabledTools.includes('get_custom_fields')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Leads',
                action: 'get_custom_fields',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to view custom fields' },
              })
              throw new Error('Agent does not have permission to view custom fields')
            }

            if (!args.pipeline_id) {
              throw new Error('pipeline_id is required')
            }

            // Get custom tabs for the pipeline
            const { data: tabs, error: tabsError } = await supabase
              .from('custom_lead_tabs')
              .select('id, tab_id, tab_name, tab_order')
              .eq('pipeline_id', args.pipeline_id)
              .eq('is_active', true)
              .order('tab_order')

            if (tabsError) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Leads',
                action: 'get_custom_fields',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: tabsError.message, pipeline_id: args.pipeline_id },
              })
              throw tabsError
            }

            // Get custom fields for all tabs
            const tabIds = tabs?.map((t: any) => t.id) || []
            let fields = []

            if (tabIds.length > 0) {
              const { data: fieldsData, error: fieldsError } = await supabase
                .from('custom_fields')
                .select('*')
                .in('custom_tab_id', tabIds)
                .eq('is_active', true)
                .order('display_order')

              if (fieldsError) {
                await supabase.from('ai_agent_logs').insert({
                  agent_id: agentId,
                  agent_name: agentName,
                  module: 'Leads',
                  action: 'get_custom_fields',
                  result: 'Error',
                  user_context: args.phone_number || null,
                  details: { error: fieldsError.message, pipeline_id: args.pipeline_id },
                })
                throw fieldsError
              }

              fields = fieldsData || []
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Leads',
              action: 'get_custom_fields',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { pipeline_id: args.pipeline_id, tabs_count: tabs?.length || 0, fields_count: fields.length },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    pipeline_id: args.pipeline_id,
                    tabs,
                    fields,
                    tabs_count: tabs?.length || 0,
                    fields_count: fields.length
                  }, null, 2),
                },
              ],
            }
            break
          }

          case 'get_lead_custom_values': {
            if (!enabledTools.includes('get_lead_custom_values')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Leads',
                action: 'get_lead_custom_values',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to view lead custom values' },
              })
              throw new Error('Agent does not have permission to view lead custom values')
            }

            if (!args.lead_id) {
              throw new Error('lead_id is required')
            }

            // Get lead to get its UUID
            const { data: lead, error: leadError } = await supabase
              .from('leads')
              .select('id, lead_id, name, pipeline_id')
              .eq('lead_id', args.lead_id)
              .maybeSingle()

            if (leadError || !lead) {
              throw new Error(`Lead ${args.lead_id} not found`)
            }

            // Get custom field values
            const { data: values, error: valuesError } = await supabase
              .from('custom_field_values')
              .select(`
                id,
                field_value,
                custom_field_id,
                custom_fields!inner (
                  field_key,
                  field_name,
                  field_type,
                  dropdown_options
                )
              `)
              .eq('lead_id', lead.id)

            if (valuesError) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Leads',
                action: 'get_lead_custom_values',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: valuesError.message, lead_id: args.lead_id },
              })
              throw valuesError
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Leads',
              action: 'get_lead_custom_values',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { lead_id: args.lead_id, values_count: values?.length || 0 },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    lead_id: args.lead_id,
                    lead_name: lead.name,
                    pipeline_id: lead.pipeline_id,
                    custom_values: values || [],
                    count: values?.length || 0
                  }, null, 2),
                },
              ],
            }
            break
          }

          case 'update_lead_custom_values': {
            if (!enabledTools.includes('update_lead_custom_values')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Leads',
                action: 'update_lead_custom_values',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to update lead custom values' },
              })
              throw new Error('Agent does not have permission to update lead custom values')
            }

            if (!args.lead_id || !args.custom_values) {
              throw new Error('lead_id and custom_values are required')
            }

            // Get lead to get its UUID
            const { data: lead, error: leadError } = await supabase
              .from('leads')
              .select('id, lead_id, name, pipeline_id')
              .eq('lead_id', args.lead_id)
              .maybeSingle()

            if (leadError || !lead) {
              throw new Error(`Lead ${args.lead_id} not found`)
            }

            const customValues = args.custom_values
            const fieldKeys = Object.keys(customValues)

            if (fieldKeys.length === 0) {
              throw new Error('No custom field values provided')
            }

            // Get custom fields to validate
            const { data: fields, error: fieldsError } = await supabase
              .from('custom_fields')
              .select('id, field_key, field_name, field_type, dropdown_options, is_required')
              .in('field_key', fieldKeys)

            if (fieldsError) {
              throw new Error(`Failed to fetch custom fields: ${fieldsError.message}`)
            }

            if (!fields || fields.length === 0) {
              throw new Error(`No valid custom fields found for the provided field keys: ${fieldKeys.join(', ')}`)
            }

            // Validate field keys
            const validFieldKeys = fields.map((f: any) => f.field_key)
            const invalidKeys = fieldKeys.filter(k => !validFieldKeys.includes(k))

            if (invalidKeys.length > 0) {
              throw new Error(`Invalid field keys: ${invalidKeys.join(', ')}. Valid keys: ${validFieldKeys.join(', ')}`)
            }

            // Upsert custom field values
            const updates = []
            for (const field of fields) {
              const value = customValues[field.field_key]

              // Validate dropdown values
              if (field.field_type === 'dropdown_single' && field.dropdown_options) {
                const options = field.dropdown_options as string[]
                if (value && !options.includes(value)) {
                  throw new Error(`Invalid value "${value}" for field "${field.field_name}". Valid options: ${options.join(', ')}`)
                }
              }

              if (field.field_type === 'dropdown_multiple' && field.dropdown_options) {
                const options = field.dropdown_options as string[]
                const values = Array.isArray(value) ? value : (value ? [value] : [])
                const invalidValues = values.filter(v => !options.includes(v))
                if (invalidValues.length > 0) {
                  throw new Error(`Invalid values for field "${field.field_name}": ${invalidValues.join(', ')}. Valid options: ${options.join(', ')}`)
                }
              }

              updates.push({
                custom_field_id: field.id,
                lead_id: lead.id,
                field_value: typeof value === 'object' ? JSON.stringify(value) : String(value)
              })
            }

            // Upsert values
            const { error: upsertError } = await supabase
              .from('custom_field_values')
              .upsert(updates, {
                onConflict: 'custom_field_id,lead_id'
              })

            if (upsertError) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Leads',
                action: 'update_lead_custom_values',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: upsertError.message, lead_id: args.lead_id },
              })
              throw upsertError
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Leads',
              action: 'update_lead_custom_values',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { lead_id: args.lead_id, fields_updated: updates.length },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: 'Custom field values updated successfully',
                    lead_id: args.lead_id,
                    lead_name: lead.name,
                    fields_updated: updates.length
                  }, null, 2),
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
    console.error('MCP Leads Server Error:', error)
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
