import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

interface ChatPayload {
  agent_id: string
  phone_number: string
  message: string
  user_context?: string
}

interface MCPMessage {
  jsonrpc: '2.0'
  id: string | number
  method?: string
  params?: any
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, any>
    required?: string[]
  }
}

class MCPClient {
  private serverUrl: string
  private authToken: string
  private agentId: string
  private requestId: number = 0
  private sessionId?: string

  constructor(serverUrl: string, authToken: string, agentId: string) {
    this.serverUrl = serverUrl
    this.authToken = authToken
    this.agentId = agentId
  }

  private getNextRequestId(): number {
    return ++this.requestId
  }

  private async sendRequest(message: MCPMessage): Promise<MCPMessage> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.authToken}`,
    }

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId
    }

    const response = await fetch(this.serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      throw new Error(`MCP request failed: ${response.statusText}`)
    }

    const sessionIdHeader = response.headers.get('Mcp-Session-Id')
    if (sessionIdHeader) {
      this.sessionId = sessionIdHeader
    }

    return await response.json()
  }

  async initialize(): Promise<any> {
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'initialize',
    }

    const response = await this.sendRequest(message)

    if (response.error) {
      throw new Error(response.error.message)
    }

    return response.result
  }

  async listTools(): Promise<MCPTool[]> {
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'tools/list',
    }

    const response = await this.sendRequest(message)

    if (response.error) {
      throw new Error(response.error.message)
    }

    return response.result?.tools || []
  }

  async callTool(toolName: string, args: any): Promise<any> {
    const toolArgs = { ...args, agent_id: this.agentId }

    const message: MCPMessage = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: toolArgs,
      },
    }

    const response = await this.sendRequest(message)

    if (response.error) {
      throw new Error(response.error.message)
    }

    if (response.result?.content && Array.isArray(response.result.content)) {
      const textContent = response.result.content.find((c: any) => c.type === 'text')
      if (textContent?.text) {
        return textContent.text
      }
    }

    return response.result
  }
}

function convertMCPToolToOpenRouterFunction(mcpTool: MCPTool): any {
  const properties = { ...mcpTool.inputSchema.properties }
  delete properties.agent_id

  const required = (mcpTool.inputSchema.required || []).filter(
    (field: string) => field !== 'agent_id'
  )

  return {
    type: 'function',
    function: {
      name: mcpTool.name,
      description: mcpTool.description,
      parameters: {
        type: mcpTool.inputSchema.type || 'object',
        properties,
        required,
      },
    },
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const payload: ChatPayload = await req.json()

    if (!payload.agent_id || !payload.phone_number || !payload.message) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          required: ['agent_id', 'phone_number', 'message'],
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

    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', payload.agent_id)
      .single()

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: 'Agent not found' }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    console.log(`Agent ${agent.name} - Status: ${agent.status} - MCP Enabled: ${agent.use_mcp}`)
    if (agent.use_mcp && agent.mcp_config) {
      console.log('MCP Config:', agent.mcp_config)
    }

    if (agent.status !== 'Active') {
      return new Response(
        JSON.stringify({ error: 'Agent is not active', current_status: agent.status }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Fetch OpenRouter API key from integrations table
    const { data: openrouterIntegration } = await supabase
      .from('integrations')
      .select('config')
      .eq('integration_type', 'openrouter')
      .maybeSingle()

    const apiKey = openrouterIntegration?.config?.apiKey

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'OpenRouter API key not configured. Please configure it in Settings > Integrations.'
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

    const { data: existingMemory } = await supabase
      .from('ai_agent_chat_memory')
      .select('*')
      .eq('agent_id', payload.agent_id)
      .eq('phone_number', payload.phone_number)
      .order('created_at', { ascending: false })
      .limit(20)

    const conversationMessages: any[] = []
    if (existingMemory && existingMemory.length > 0) {
      existingMemory.reverse().forEach(msg => {
        conversationMessages.push({ role: msg.role, content: msg.message })
      })
    }

    conversationMessages.push({ role: 'user', content: payload.message })

    // Fetch agent permissions from separate table
    const { data: agentPerms } = await supabase
      .from('ai_agent_permissions')
      .select('permissions')
      .eq('agent_id', payload.agent_id)
      .maybeSingle()

    // Permissions are stored as JSONB: { "Tasks": { can_view, can_create, can_edit, can_delete }, ... }
    const permissions: Record<string, any> = agentPerms?.permissions || {}

    console.log(`Agent permissions loaded: ${Object.keys(permissions).length} modules`)

    let tools: any[] = []
    let mcpClient: MCPClient | null = null
    const useMCP = agent.use_mcp && agent.mcp_config?.enabled

    if (useMCP) {
      console.log('Using MCP mode for agent:', agent.name)
      try {
        const mcpServerUrl = agent.mcp_config.server_url || `${supabaseUrl}/functions/v1/mcp-server`
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

        mcpClient = new MCPClient(mcpServerUrl, anonKey, payload.agent_id)
        await mcpClient.initialize()

        const mcpTools = await mcpClient.listTools()
        const useForModules = agent.mcp_config.use_for_modules || []

        const filteredTools = mcpTools.filter(tool => {
          if (useForModules.length === 0) return true
          return useForModules.some((module: string) =>
            tool.name.toLowerCase().includes(module.toLowerCase())
          )
        })

        tools = filteredTools.map(convertMCPToolToOpenRouterFunction)
        console.log(`Loaded ${tools.length} MCP tools for agent`)
      } catch (error) {
        console.error('Failed to initialize MCP client:', error)
        console.log('Falling back to hardcoded tools')
      }
    }

    if (!useMCP || tools.length === 0) {
      console.log('Using hardcoded tools mode for agent:', agent.name)

    if (permissions['Expenses']?.can_create) {
      tools.push({
        type: 'function',
        function: {
          name: 'create_expense',
          description: 'Create a new expense entry in the CRM',
          parameters: {
            type: 'object',
            properties: {
              amount: { type: 'number', description: 'Expense amount' },
              description: { type: 'string', description: 'Expense description' },
              category: { type: 'string', description: 'Expense category (e.g., Travel, Food, Office)' },
              expense_date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
              payment_method: { type: 'string', description: 'Payment method (e.g., Cash, Card, UPI)' },
              team_member_name: { type: 'string', description: 'Name of the team member' }
            },
            required: ['amount', 'description', 'category', 'expense_date']
          }
        }
      })
    }

    if (permissions['Tasks']?.can_create) {
      tools.push({
        type: 'function',
        function: {
          name: 'create_task',
          description: 'Create a new task in the CRM',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Task title' },
              description: { type: 'string', description: 'Task description' },
              status: { type: 'string', enum: ['Pending', 'In Progress', 'Completed'], description: 'Task status' },
              priority: { type: 'string', enum: ['Low', 'Medium', 'High'], description: 'Task priority' },
              due_date: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
              assigned_to_name: { type: 'string', description: 'Name of the person to assign the task to' },
              contact_name: { type: 'string', description: 'Associated contact name' },
              contact_phone: { type: 'string', description: 'Associated contact phone' }
            },
            required: ['title', 'status', 'priority']
          }
        }
      })
    }

    if (permissions['Support Tickets']?.can_create) {
      tools.push({
        type: 'function',
        function: {
          name: 'create_support_ticket',
          description: 'Create a new support ticket in the CRM',
          parameters: {
            type: 'object',
            properties: {
              subject: { type: 'string', description: 'Ticket subject' },
              description: { type: 'string', description: 'Detailed description of the issue' },
              priority: { type: 'string', enum: ['Low', 'Medium', 'High'], description: 'Ticket priority' },
              category: { type: 'string', description: 'Ticket category (e.g., General, Technical, Billing)' },
              reporter_name: { type: 'string', description: 'Name of the person reporting the issue' },
              reporter_phone: { type: 'string', description: 'Phone number of the reporter' },
              reporter_email: { type: 'string', description: 'Email of the reporter' }
            },
            required: ['subject', 'description', 'priority']
          }
        }
      })
    }

    if (permissions['Leads']?.can_create) {
      tools.push({
        type: 'function',
        function: {
          name: 'create_lead',
          description: 'Create a new lead in the CRM',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Lead name' },
              phone: { type: 'string', description: 'Phone number' },
              email: { type: 'string', description: 'Email address' },
              interest: { type: 'string', description: 'Area of interest' },
              source: { type: 'string', description: 'Lead source (e.g., Website, Referral, Social Media)' },
              stage: { type: 'string', description: 'Lead stage' },
              notes: { type: 'string', description: 'Additional notes' }
            },
            required: ['name', 'phone']
          }
        }
      })
    }

    if (permissions['Appointments']?.can_create) {
      tools.push({
        type: 'function',
        function: {
          name: 'create_appointment',
          description: 'Create a new appointment in the CRM',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Title of the appointment' },
              contact_name: { type: 'string', description: 'Name of the contact' },
              contact_phone: { type: 'string', description: 'Phone number of the contact' },
              contact_email: { type: 'string', description: 'Email of the contact' },
              appointment_date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
              appointment_time: { type: 'string', description: 'Time in HH:MM format (24-hour)' },
              duration_minutes: { type: 'number', description: 'Duration in minutes' },
              location: { type: 'string', description: 'Location of the appointment' },
              purpose: { type: 'string', description: 'Purpose of the appointment' }
            },
            required: ['title', 'appointment_date', 'appointment_time']
          }
        }
      })
    }

    if (permissions['Support Tickets']?.can_view) {
      tools.push({
        type: 'function',
        function: {
          name: 'get_support_tickets',
          description: 'Get support tickets from the CRM. Can search by ticket ID, reporter name, or filter by status.',
          parameters: {
            type: 'object',
            properties: {
              ticket_id: { type: 'string', description: 'Specific ticket ID to retrieve (e.g., TKT-2025-061)' },
              reporter_name: { type: 'string', description: 'Search by reporter/contact name' },
              status: { type: 'string', enum: ['Open', 'In Progress', 'Resolved', 'Closed'], description: 'Filter by ticket status' },
              limit: { type: 'number', description: 'Number of tickets to retrieve (default 10)' }
            }
          }
        }
      })
    }

    if (permissions['Expenses']?.can_view) {
      tools.push({
        type: 'function',
        function: {
          name: 'get_expenses',
          description: 'Get expenses from the CRM with optional filtering',
          parameters: {
            type: 'object',
            properties: {
              date_filter: { type: 'string', description: 'Filter by date: "today", "this_week", "this_month", "last_month"' },
              category: { type: 'string', description: 'Filter by category' },
              limit: { type: 'number', description: 'Number of expenses to retrieve' }
            }
          }
        }
      })
    }

    if (permissions['Tasks']?.can_view) {
      tools.push({
        type: 'function',
        function: {
          name: 'get_tasks',
          description: 'Get tasks from the CRM. Can retrieve specific task by task_id or filter by status/priority.',
          parameters: {
            type: 'object',
            properties: {
              task_id: { type: 'string', description: 'Get a specific task by its task_id (e.g., TASK-10031)' },
              status: { type: 'string', enum: ['Pending', 'In Progress', 'Completed'], description: 'Filter by task status' },
              priority: { type: 'string', enum: ['Low', 'Medium', 'High'], description: 'Filter by priority' },
              limit: { type: 'number', description: 'Number of tasks to retrieve' }
            }
          }
        }
      })
    }

    if (permissions['Leads']?.can_view) {
      tools.push({
        type: 'function',
        function: {
          name: 'get_leads',
          description: 'Get leads from the CRM',
          parameters: {
            type: 'object',
            properties: {
              stage: { type: 'string', description: 'Filter by lead stage' },
              limit: { type: 'number', description: 'Number of leads to retrieve' }
            }
          }
        }
      })
    }

    if (permissions['Appointments']?.can_view) {
      tools.push({
        type: 'function',
        function: {
          name: 'get_appointments',
          description: 'Get appointments from the CRM',
          parameters: {
            type: 'object',
            properties: {
              date_filter: { type: 'string', enum: ['today', 'upcoming', 'past', 'this_month', 'all'], description: 'Filter by date' },
              appointment_id: { type: 'string', description: 'Specific appointment ID' },
              limit: { type: 'number', description: 'Number of appointments to retrieve' }
            }
          }
        }
      })
    }

    if (permissions['Contacts']?.can_view) {
      tools.push({
        type: 'function',
        function: {
          name: 'get_contacts',
          description: 'Get contacts from the CRM',
          parameters: {
            type: 'object',
            properties: {
              search: { type: 'string', description: 'Search by name, email, or phone' },
              limit: { type: 'number', description: 'Number of contacts to retrieve' }
            }
          }
        }
      })
    }
    }

    console.log(`Total tools available: ${tools.length}`)

    const enhancedSystemPrompt = `${agent.system_prompt}\n\n**CRITICAL: You MUST use the provided tools to perform actions. NEVER pretend to complete an action without actually calling the tool.**\n\nYou have access to CRM tools. When a user asks you to perform actions like creating expenses, tasks, appointments, or retrieving data:\n\n1. **YOU MUST call the appropriate tool** - Do NOT respond as if you completed the action without calling the tool\n2. Execute actions immediately if you have enough information\n3. DO NOT ask for confirmation or additional details if you have sufficient information\n4. Only ask clarifying questions if critical required information is truly missing\n\nExamples of CORRECT behavior:\n- User: "create a task for tomorrow" → YOU MUST call create_task tool with the details\n- User: "show ticket TKT-2025-061" → YOU MUST call get_support_tickets tool\n- User: "create expense for mumbai flight 2800" → YOU MUST call create_expense tool\n\nExamples of INCORRECT behavior (DO NOT DO THIS):\n- User: "create a task" → Responding "I've created the task" WITHOUT calling create_task tool ❌\n- User: "add expense" → Saying "Expense added" WITHOUT calling create_expense tool ❌\n\n**Remember: If you don't call the tool, the action won't actually happen in the system. Always use tools for actions.**`

    const messages = [
      { role: 'system', content: enhancedSystemPrompt },
      ...conversationMessages
    ]

    const requestBody: any = {
      model: agent.model,
      messages: messages
    }

    if (tools.length > 0) {
      requestBody.tools = tools
      requestBody.tool_choice = 'auto'
    }

    let aiResponse: string

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const assistantMessage = data.choices[0].message

      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        const toolResults: string[] = []

        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name
          const functionArgs = JSON.parse(toolCall.function.arguments)

          if (useMCP && mcpClient) {
            console.log(`Executing MCP tool: ${functionName}`)
            try {
              const result = await mcpClient.callTool(functionName, functionArgs)
              toolResults.push(result)
            } catch (error) {
              console.error(`MCP tool execution failed for ${functionName}:`, error)
              toolResults.push(`❌ Failed to execute ${functionName}: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
            continue
          }

          if (functionName === 'create_expense') {
            let teamMemberId = null
            if (functionArgs.team_member_name) {
              const { data: teamMember } = await supabase
                .from('admin_users')
                .select('id')
                .ilike('full_name', `%${functionArgs.team_member_name}%`)
                .single()
              teamMemberId = teamMember?.id
            }

            const { error: expenseError } = await supabase
              .from('expenses')
              .insert({
                amount: functionArgs.amount,
                description: functionArgs.description,
                category: functionArgs.category,
                expense_date: functionArgs.expense_date,
                payment_method: functionArgs.payment_method || 'Cash',
                team_member_id: teamMemberId,
                status: 'Pending'
              })

            if (expenseError) {
              toolResults.push(`❌ Failed to create expense: ${expenseError.message}`)
            } else {
              toolResults.push(`✅ Expense created: ₹${functionArgs.amount} for ${functionArgs.description}`)
            }
          } else if (functionName === 'create_task') {
            let assignedToId = null
            if (functionArgs.assigned_to_name) {
              const { data: teamMember } = await supabase
                .from('admin_users')
                .select('id')
                .ilike('full_name', `%${functionArgs.assigned_to_name}%`)
                .single()
              assignedToId = teamMember?.id
            }

            let contactId = null
            if (functionArgs.contact_phone) {
              const { data: contact } = await supabase
                .from('contacts_master')
                .select('id')
                .eq('phone', functionArgs.contact_phone)
                .single()
              contactId = contact?.id
            }

            const { data: newTask, error: taskError } = await supabase
              .from('tasks')
              .insert({
                title: functionArgs.title,
                description: functionArgs.description,
                status: functionArgs.status || 'To Do',
                priority: functionArgs.priority || 'Medium',
                due_date: functionArgs.due_date,
                assigned_to: assignedToId,
                contact_id: contactId
              })
              .select('task_id, title, status, priority, due_date, assigned_to_name')
              .single()

            if (taskError) {
              toolResults.push(`❌ Failed to create task: ${taskError.message}`)
            } else {
              const assignedToText = newTask.assigned_to_name ? ` assigned to ${newTask.assigned_to_name}` : ''
              const dueDateText = newTask.due_date ? ` due on ${newTask.due_date}` : ''
              toolResults.push(`✅ Task created successfully:\n- ID: ${newTask.task_id}\n- Title: ${newTask.title}\n- Status: ${newTask.status}\n- Priority: ${newTask.priority}${assignedToText}${dueDateText}`)
            }
          } else if (functionName === 'create_support_ticket') {
            let contactId = null
            if (functionArgs.reporter_phone) {
              const { data: contact } = await supabase
                .from('contacts_master')
                .select('id')
                .eq('phone', functionArgs.reporter_phone)
                .maybeSingle()

              if (!contact && functionArgs.reporter_name) {
                const { data: newContact } = await supabase
                  .from('contacts_master')
                  .insert({
                    name: functionArgs.reporter_name,
                    phone: functionArgs.reporter_phone,
                    email: functionArgs.reporter_email
                  })
                  .select('id')
                  .single()
                contactId = newContact?.id
              } else {
                contactId = contact?.id
              }
            }

            const ticketId = `TKT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`

            const { error: ticketError } = await supabase
              .from('support_tickets')
              .insert({
                ticket_id: ticketId,
                subject: functionArgs.subject,
                description: functionArgs.description,
                priority: functionArgs.priority,
                category: functionArgs.category || 'General',
                status: 'Open',
                contact_id: contactId,
                reporter_name: functionArgs.reporter_name,
                reporter_phone: functionArgs.reporter_phone,
                reporter_email: functionArgs.reporter_email
              })

            if (ticketError) {
              toolResults.push(`❌ Failed to create ticket: ${ticketError.message}`)
            } else {
              toolResults.push(`✅ Support ticket created: ${ticketId} - ${functionArgs.subject}`)
            }
          } else if (functionName === 'create_lead') {
            const { data: existingContact } = await supabase
              .from('contacts_master')
              .select('id')
              .eq('phone', functionArgs.phone)
              .maybeSingle()

            let contactId = existingContact?.id

            if (!contactId) {
              const { data: newContact } = await supabase
                .from('contacts_master')
                .insert({
                  name: functionArgs.name,
                  phone: functionArgs.phone,
                  email: functionArgs.email
                })
                .select('id')
                .single()
              contactId = newContact?.id
            }

            const { error: leadError } = await supabase
              .from('leads')
              .insert({
                name: functionArgs.name,
                phone: functionArgs.phone,
                email: functionArgs.email,
                interest: functionArgs.interest,
                source: functionArgs.source,
                stage: functionArgs.stage || 'New',
                notes: functionArgs.notes,
                contact_id: contactId
              })

            if (leadError) {
              toolResults.push(`❌ Failed to create lead: ${leadError.message}`)
            } else {
              toolResults.push(`✅ Lead created: ${functionArgs.name} (${functionArgs.phone})`)
            }
          } else if (functionName === 'create_appointment') {
            const appointmentId = `APT-${Math.floor(Math.random() * 1000000000)}`
            const { error: appointmentError } = await supabase
              .from('appointments')
              .insert({
                appointment_id: appointmentId,
                title: functionArgs.title,
                contact_name: functionArgs.contact_name,
                contact_phone: functionArgs.contact_phone,
                contact_email: functionArgs.contact_email,
                appointment_date: functionArgs.appointment_date,
                appointment_time: functionArgs.appointment_time,
                duration_minutes: functionArgs.duration_minutes || 60,
                location: functionArgs.location,
                purpose: functionArgs.purpose,
                status: 'Scheduled',
                reminder_sent: false
              })

            if (appointmentError) {
              toolResults.push(`❌ Failed to create appointment: ${appointmentError.message}`)
            } else {
              toolResults.push(`✅ Appointment created: ${functionArgs.title} (${appointmentId})`)
            }
          } else if (functionName === 'get_support_tickets') {
            let ticketsQuery = supabase
              .from('support_tickets')
              .select(`
                *,
                contact:contacts_master!contact_id(full_name, phone, email),
                assigned_user:admin_users!assigned_to(full_name, email)
              `)
              .order('created_at', { ascending: false })

            if (functionArgs.ticket_id) {
              ticketsQuery = ticketsQuery.eq('ticket_id', functionArgs.ticket_id)
            } else if (functionArgs.reporter_name) {
              ticketsQuery = ticketsQuery.ilike('reporter_name', `%${functionArgs.reporter_name}%`)
            }

            if (functionArgs.status) {
              ticketsQuery = ticketsQuery.eq('status', functionArgs.status)
            }

            ticketsQuery = ticketsQuery.limit(functionArgs.limit || 10)

            const { data: tickets, error: ticketsError } = await ticketsQuery

            if (ticketsError) {
              toolResults.push(`❌ Failed to fetch tickets: ${ticketsError.message}`)
            } else if (tickets && tickets.length > 0) {
              const ticketSummary = tickets.map(t => {
                const contact = t.contact as any
                const assignedUser = t.assigned_user as any
                const contactName = contact?.full_name || 'Unknown'
                const assignedName = assignedUser?.full_name || 'Unassigned'

                let summary = `• Ticket: ${t.ticket_id}\n  Subject: ${t.subject}\n  Status: ${t.status}\n  Priority: ${t.priority}\n  Contact: ${contactName}`

                if (contact?.phone) summary += ` (${contact.phone})`
                if (contact?.email) summary += ` - ${contact.email}`

                summary += `\n  Assigned to: ${assignedName}`

                if (t.description) summary += `\n  Description: ${t.description}`
                if (t.created_at) {
                  const createdDate = new Date(t.created_at).toLocaleDateString()
                  summary += `\n  Created: ${createdDate}`
                }

                return summary
              }).join('\n\n')
              toolResults.push(`✅ Found ${tickets.length} ticket(s):\n\n${ticketSummary}`)
            } else {
              toolResults.push(`No tickets found matching the criteria`)
            }
          } else if (functionName === 'get_expenses') {
            let expensesQuery = supabase
              .from('expenses')
              .select('*')
              .order('expense_date', { ascending: false })

            if (functionArgs.date_filter) {
              const today = new Date().toISOString().split('T')[0]
              if (functionArgs.date_filter === 'today') {
                expensesQuery = expensesQuery.eq('expense_date', today)
              }
            }

            if (functionArgs.category) {
              expensesQuery = expensesQuery.eq('category', functionArgs.category)
            }

            expensesQuery = expensesQuery.limit(functionArgs.limit || 10)

            const { data: expenses, error: expensesError } = await expensesQuery

            if (expensesError) {
              toolResults.push(`❌ Failed to fetch expenses: ${expensesError.message}`)
            } else if (expenses && expenses.length > 0) {
              const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0)
              const expenseSummary = expenses.map(e =>
                `• ₹${e.amount} - ${e.description} (${e.category}) on ${e.expense_date}`
              ).join('\n')
              toolResults.push(`✅ Found ${expenses.length} expense(s) totaling ₹${total.toFixed(2)}:\n${expenseSummary}`)
            } else {
              toolResults.push(`No expenses found`)
            }
          } else if (functionName === 'get_tasks') {
            let tasksQuery = supabase
              .from('tasks')
              .select('*')
              .order('created_at', { ascending: false })

            if (functionArgs.task_id) {
              tasksQuery = tasksQuery.eq('task_id', functionArgs.task_id)
            }

            if (functionArgs.status) {
              tasksQuery = tasksQuery.eq('status', functionArgs.status)
            }

            if (functionArgs.priority) {
              tasksQuery = tasksQuery.eq('priority', functionArgs.priority)
            }

            tasksQuery = tasksQuery.limit(functionArgs.limit || 10)

            const { data: tasks, error: tasksError } = await tasksQuery

            if (tasksError) {
              toolResults.push(`❌ Failed to fetch tasks: ${tasksError.message}`)
            } else if (tasks && tasks.length > 0) {
              if (functionArgs.task_id && tasks.length === 1) {
                const t = tasks[0]
                let details = `✅ Task Details:\n\n**${t.task_id}: ${t.title}**\n`
                if (t.description) details += `Description: ${t.description}\n`
                details += `Status: ${t.status}\n`
                details += `Priority: ${t.priority}\n`
                if (t.assigned_to_name) details += `Assigned to: ${t.assigned_to_name}\n`
                if (t.assigned_by_name) details += `Assigned by: ${t.assigned_by_name}\n`
                if (t.contact_name) details += `Contact: ${t.contact_name}${t.contact_phone ? ` (${t.contact_phone})` : ''}\n`
                if (t.due_date) details += `Due date: ${t.due_date}\n`
                if (t.start_date) details += `Start date: ${t.start_date}\n`
                details += `Progress: ${t.progress_percentage || 0}%\n`
                if (t.category) details += `Category: ${t.category}\n`
                if (t.supporting_documents && t.supporting_documents.length > 0) {
                  details += `\nSupporting documents:\n${t.supporting_documents.map((doc, i) => `${i + 1}. ${doc}`).join('\n')}`
                }
                toolResults.push(details)
              } else {
                const taskSummary = tasks.map(t =>
                  `• ${t.task_id}: ${t.title} (${t.status}, ${t.priority} priority)${t.due_date ? ` - Due: ${t.due_date}` : ''}`
                ).join('\n')
                toolResults.push(`✅ Found ${tasks.length} task(s):\n${taskSummary}`)
              }
            } else {
              toolResults.push(`No tasks found`)
            }
          } else if (functionName === 'get_leads') {
            let leadsQuery = supabase
              .from('leads')
              .select('*')
              .order('created_at', { ascending: false })

            if (functionArgs.stage) {
              leadsQuery = leadsQuery.eq('stage', functionArgs.stage)
            }

            leadsQuery = leadsQuery.limit(functionArgs.limit || 10)

            const { data: leads, error: leadsError } = await leadsQuery

            if (leadsError) {
              toolResults.push(`❌ Failed to fetch leads: ${leadsError.message}`)
            } else if (leads && leads.length > 0) {
              const leadSummary = leads.map(l =>
                `• ${l.name} (${l.phone}) - ${l.interest} interest`
              ).join('\n')
              toolResults.push(`✅ Found ${leads.length} lead(s):\n${leadSummary}`)
            } else {
              toolResults.push(`No leads found`)
            }
          } else if (functionName === 'get_appointments') {
            let appointmentsQuery = supabase
              .from('appointments')
              .select('*')
              .order('appointment_date', { ascending: true })

            if (functionArgs.appointment_id) {
              appointmentsQuery = appointmentsQuery.eq('appointment_id', functionArgs.appointment_id)
            } else if (functionArgs.date_filter === 'today') {
              const today = new Date().toISOString().split('T')[0]
              appointmentsQuery = appointmentsQuery.eq('appointment_date', today)
            } else if (functionArgs.date_filter === 'upcoming') {
              const today = new Date().toISOString().split('T')[0]
              appointmentsQuery = appointmentsQuery.gte('appointment_date', today)
            }

            appointmentsQuery = appointmentsQuery.limit(functionArgs.limit || 10)

            const { data: appointments, error: appointmentsError } = await appointmentsQuery

            if (appointmentsError) {
              toolResults.push(`❌ Failed to fetch appointments: ${appointmentsError.message}`)
            } else if (appointments && appointments.length > 0) {
              const appointmentSummary = appointments.map(a =>
                `• ${a.title} on ${a.appointment_date} at ${a.appointment_time} (${a.status})`
              ).join('\n')
              toolResults.push(`✅ Found ${appointments.length} appointment(s):\n${appointmentSummary}`)
            } else {
              toolResults.push(`No appointments found`)
            }
          } else if (functionName === 'get_contacts') {
            let contactsQuery = supabase
              .from('contacts_master')
              .select('*')
              .order('created_at', { ascending: false })

            if (functionArgs.search) {
              contactsQuery = contactsQuery.or(`name.ilike.%${functionArgs.search}%,email.ilike.%${functionArgs.search}%,phone.ilike.%${functionArgs.search}%`)
            }

            contactsQuery = contactsQuery.limit(functionArgs.limit || 10)

            const { data: contacts, error: contactsError } = await contactsQuery

            if (contactsError) {
              toolResults.push(`❌ Failed to fetch contacts: ${contactsError.message}`)
            } else if (contacts && contacts.length > 0) {
              const contactSummary = contacts.map(c =>
                `• ${c.name} (${c.phone})${c.email ? ` - ${c.email}` : ''}`
              ).join('\n')
              toolResults.push(`✅ Found ${contacts.length} contact(s):\n${contactSummary}`)
            } else {
              toolResults.push(`No contacts found`)
            }
          }
        }

        console.log(`Tool execution completed. Results: ${toolResults.length} items`)

        const finalResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: agent.model,
            messages: [
              { role: 'system', content: enhancedSystemPrompt },
              ...conversationMessages,
              { role: 'assistant', content: toolResults.join('\n\n') },
              { role: 'user', content: 'Based on the tool execution results above, provide a natural, conversational response to the user. Keep it concise and friendly.' }
            ]
          }),
        })

        const finalData = await finalResponse.json()
        aiResponse = finalData.choices[0].message.content
      } else {
        aiResponse = assistantMessage.content
      }

    } catch (error: any) {
      console.error('AI Processing Error:', error)
      return new Response(
        JSON.stringify({ error: `AI processing failed: ${error.message}` }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    await supabase
      .from('ai_agent_chat_memory')
      .insert([
        {
          agent_id: payload.agent_id,
          phone_number: payload.phone_number,
          role: 'user',
          message: payload.message,
          user_context: 'External',
          module: 'Chat',
          action: 'User Message'
        },
        {
          agent_id: payload.agent_id,
          phone_number: payload.phone_number,
          role: 'assistant',
          message: aiResponse,
          user_context: 'External',
          module: 'Chat',
          action: 'AI Response'
        }
      ])

    return new Response(
      JSON.stringify({ response: aiResponse }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )

  } catch (error: any) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})