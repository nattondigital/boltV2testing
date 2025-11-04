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

    if (!agent.use_mcp || !agent.mcp_config?.enabled) {
      return new Response(
        JSON.stringify({
          error: 'MCP server is required but not enabled for this agent. Please enable MCP in agent settings.',
          mcp_enabled: false
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

    console.log('Using MCP server ONLY mode for agent:', agent.name)
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
      console.log(`Loaded ${tools.length} MCP tools for modules: ${useForModules.join(', ')}`)
    } catch (error) {
      console.error('Failed to initialize MCP client:', error)
      return new Response(
        JSON.stringify({
          error: 'Failed to connect to MCP server',
          details: error instanceof Error ? error.message : 'Unknown error'
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    console.log(`Total MCP tools available: ${tools.length}`)

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

          console.log(`Executing MCP tool: ${functionName}`)
          try {
            const result = await mcpClient!.callTool(functionName, functionArgs)
            toolResults.push(result)
          } catch (error) {
            console.error(`MCP tool execution failed for ${functionName}:`, error)
            toolResults.push(`❌ Failed to execute ${functionName}: ${error instanceof Error ? error.message : 'Unknown error'}`)
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