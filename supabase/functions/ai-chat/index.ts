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
  private phoneNumber: string
  private requestId: number = 0
  private sessionId?: string

  constructor(serverUrl: string, authToken: string, agentId: string, phoneNumber: string) {
    this.serverUrl = serverUrl
    this.authToken = authToken
    this.agentId = agentId
    this.phoneNumber = phoneNumber
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
    const toolArgs = { ...args, agent_id: this.agentId, phone_number: this.phoneNumber }

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
  // Safely extract properties, ensuring it's always an object
  const rawProperties = mcpTool.inputSchema?.properties || {}
  const properties: Record<string, any> = {}

  // Copy all properties except agent_id and phone_number
  for (const [key, value] of Object.entries(rawProperties)) {
    if (key !== 'agent_id' && key !== 'phone_number') {
      properties[key] = value
    }
  }

  // Safely extract and filter required fields
  const rawRequired = mcpTool.inputSchema?.required || []
  const required = rawRequired.filter(
    (field: string) => field !== 'agent_id' && field !== 'phone_number'
  )

  // Build OpenAI/Gemini-compatible parameters object
  // CRITICAL: Always include "type" and "properties", even if empty
  const parameters: any = {
    type: mcpTool.inputSchema?.type || 'object',
    properties: properties, // Always include, even if empty {}
  }

  // Only add "required" if it's not empty (OpenAI/Gemini prefer this)
  if (required.length > 0) {
    parameters.required = required
  }

  // Add additionalProperties: false for strict validation
  parameters.additionalProperties = false

  return {
    type: 'function',
    function: {
      name: mcpTool.name,
      description: mcpTool.description || 'No description provided',
      parameters: parameters,
    },
  }
}

function cleanMessageForMemory(message: string): string {
  if (!message || typeof message !== 'string') {
    return ''
  }

  let cleaned = message

  // Remove JSON code blocks
  cleaned = cleaned.replace(/```json\s*\n[\s\S]*?\n```/gi, '')

  // Remove all code blocks (any language)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '')

  // Remove inline code with JSON-like content
  cleaned = cleaned.replace(/`\{[\s\S]*?\}`/g, '')

  // Remove tool execution markers and their lines
  cleaned = cleaned.replace(/^[\s]*[✅❌⚠️🔧⚡🔌]\s*.*/gm, '')

  // Remove "Data:" sections with JSON
  cleaned = cleaned.replace(/\n\s*Data:\s*\n\{[\s\S]*?\}/gi, '')

  // Remove technical execution logs
  cleaned = cleaned.replace(/\(via MCP\)/gi, '')
  cleaned = cleaned.replace(/MCP Server:/gi, '')
  cleaned = cleaned.replace(/Tool execution:/gi, '')

  // Remove markdown tables (often contain raw data)
  // Match lines that start with | or contain multiple | characters
  cleaned = cleaned.replace(/^.*\|.*\|.*$/gm, '')
  cleaned = cleaned.replace(/^[\s]*[-:| ]+$/gm, '') // Remove table separator lines

  // Remove excessive headers and formatting
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '')

  // Remove excessive bullet points with technical data
  cleaned = cleaned.replace(/^\s*[-*+]\s+\*\*[^:]+:\*\*\s+`[^`]+`\s*$/gm, '')

  // Remove empty lines and excessive whitespace
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n')

  // Remove leading/trailing whitespace
  cleaned = cleaned.trim()

  // If the message is too short or looks like just data, return empty
  if (cleaned.length < 10 || /^[\s\{\}\[\],:"']+$/.test(cleaned)) {
    return ''
  }

  // If message contains only technical keywords, filter it out
  const technicalOnlyPattern = /^(success|error|failed|null|undefined|true|false|\d+)$/i
  if (technicalOnlyPattern.test(cleaned)) {
    return ''
  }

  return cleaned
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

    console.log(`Agent ${agent.name} - Type: ${agent.agent_type || 'BACKEND'} - Status: ${agent.status} - MCP Architecture: Enabled`)

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

    // Conditionally load chat memory based on agent type
    // FRONTEND agents: Load last 20 messages for full conversation context
    // BACKEND agents: Load last 5 messages for immediate context (multi-turn task completion)
    const agentType = agent.agent_type || 'BACKEND'

    const conversationMessages: any[] = []

    if (agentType === 'FRONTEND') {
      console.log('FRONTEND agent: Loading last 20 chat messages for context')

      // First get the IDs of the last N messages (most recent)
      const { data: recentIds } = await supabase
        .from('ai_agent_chat_memory')
        .select('id')
        .eq('agent_id', payload.agent_id)
        .eq('phone_number', payload.phone_number)
        .order('created_at', { ascending: false })
        .limit(20)

      if (recentIds && recentIds.length > 0) {
        // Now fetch those messages in chronological order (oldest to newest)
        const ids = recentIds.map(r => r.id)
        const { data: existingMemory } = await supabase
          .from('ai_agent_chat_memory')
          .select('*')
          .in('id', ids)
          .order('created_at', { ascending: true })

        if (existingMemory && existingMemory.length > 0) {
          existingMemory.forEach(msg => {
            conversationMessages.push({ role: msg.role, content: msg.message })
          })
          console.log(`Loaded ${existingMemory.length} previous messages in chronological order`)
        }
      } else {
        console.log('No previous chat history found')
      }
    } else {
      console.log('BACKEND agent: Loading last 5 chat messages for immediate context')

      // First get the IDs of the last N messages (most recent)
      const { data: recentIds } = await supabase
        .from('ai_agent_chat_memory')
        .select('id')
        .eq('agent_id', payload.agent_id)
        .eq('phone_number', payload.phone_number)
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentIds && recentIds.length > 0) {
        // Now fetch those messages in chronological order (oldest to newest)
        const ids = recentIds.map(r => r.id)
        const { data: existingMemory } = await supabase
          .from('ai_agent_chat_memory')
          .select('*')
          .in('id', ids)
          .order('created_at', { ascending: true })

        if (existingMemory && existingMemory.length > 0) {
          existingMemory.forEach(msg => {
            conversationMessages.push({ role: msg.role, content: msg.message })
          })
          console.log(`Loaded ${existingMemory.length} previous messages in chronological order for task context`)
        }
      } else {
        console.log('No previous chat history - starting fresh')
      }
    }

    conversationMessages.push({ role: 'user', content: payload.message })

    const { data: agentPerms } = await supabase
      .from('ai_agent_permissions')
      .select('permissions')
      .eq('agent_id', payload.agent_id)
      .maybeSingle()

    const permissions: Record<string, any> = agentPerms?.permissions || {}

    console.log(`Agent permissions loaded: ${Object.keys(permissions).length} modules`)

    let tools: any[] = []
    let mcpClient: MCPClient | null = null
    let toolToServerMap: Record<string, string> = {}

    console.log('Using MODULAR MCP architecture for agent:', agent.name)

    // Map of MCP servers to their endpoints
    const mcpServers: Record<string, string> = {
      'tasks-server': `${supabaseUrl}/functions/v1/mcp-tasks-server`,
      'contacts-server': `${supabaseUrl}/functions/v1/mcp-contacts-server`,
      'leads-server': `${supabaseUrl}/functions/v1/mcp-leads-server`,
      'appointments-server': `${supabaseUrl}/functions/v1/mcp-appointments-server`,
      'expenses-server': `${supabaseUrl}/functions/v1/mcp-expenses-server`,
      'support-server': `${supabaseUrl}/functions/v1/mcp-support-server`,
      'products-server': `${supabaseUrl}/functions/v1/mcp-products-server`,
      'billing-server': `${supabaseUrl}/functions/v1/mcp-billing-server`,
    }

    try {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
      const allMCPTools: MCPTool[] = []

      // Connect to each enabled MCP server and collect tools
      for (const [serverKey, serverUrl] of Object.entries(mcpServers)) {
        const serverConfig = permissions[serverKey]

        if (!serverConfig?.enabled) {
          console.log(`Server ${serverKey} is disabled, skipping`)
          continue
        }

        console.log(`Connecting to ${serverKey} at ${serverUrl}`)

        try {
          const client = new MCPClient(serverUrl, anonKey, payload.agent_id, payload.phone_number)
          await client.initialize()

          const serverTools = await client.listTools()
          console.log(`${serverKey} returned ${serverTools.length} tools:`, serverTools.map(t => t.name))

          // Filter tools based on permissions
          const enabledToolNames = serverConfig.tools || []
          const filteredServerTools = serverTools.filter(tool => enabledToolNames.includes(tool.name))

          console.log(`${serverKey} enabled tools:`, filteredServerTools.map(t => t.name))
          allMCPTools.push(...filteredServerTools)
        } catch (error) {
          console.error(`Failed to connect to ${serverKey}:`, error)
        }
      }

      console.log(`Total MCP tools collected from all servers: ${allMCPTools.length}`, allMCPTools.map(t => t.name))

      // Build dynamic tool-to-server mapping from permissions
      // This is the SINGLE SOURCE OF TRUTH for routing
      toolToServerMap = {}

      for (const [serverKey, serverConfig] of Object.entries(permissions)) {
        if (!serverConfig?.enabled) continue

        const toolList = serverConfig.tools || []
        for (const toolName of toolList) {
          toolToServerMap[toolName] = serverKey
        }
      }

      console.log(`✅ Built tool-to-server mapping for ${Object.keys(toolToServerMap).length} tools`)
      console.log('Tool routing map:', JSON.stringify(toolToServerMap, null, 2))

      tools = allMCPTools.map(convertMCPToolToOpenRouterFunction)
      console.log(`✅ Converted ${tools.length} MCP tools for OpenRouter`)

      // Validate tool schemas (debug logging)
      tools.forEach(tool => {
        const params = tool.function?.parameters
        if (!params || !params.type || typeof params.properties !== 'object') {
          console.error(`⚠️ Invalid schema for tool ${tool.function?.name}:`, JSON.stringify(params))
        }
      })
      console.log('All tool schemas validated successfully')
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
    console.log(`Tool names being sent to OpenRouter:`, tools.map((t: any) => t.function?.name))

    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istDate = new Date(now.getTime() + istOffset)
    const todayDate = istDate.toISOString().split('T')[0]
    const tomorrowDate = new Date(istDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const currentTime = istDate.toTimeString().split(' ')[0].substring(0, 5)

    const daysUntilSunday = (7 - istDate.getDay()) % 7 || 7
    const nextSunday = new Date(istDate.getTime() + daysUntilSunday * 24 * 60 * 60 * 1000)
    const sundayDate = nextSunday.toISOString().split('T')[0]

    // Fetch dynamic system prompt based on MCP permissions
    const systemPromptResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-system-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ agent_id: payload.agent_id }),
    })

    const systemPromptData = await systemPromptResponse.json()
    const baseSystemPrompt = systemPromptData.system_prompt || agent.system_prompt || 'You are a helpful AI assistant.'

    // Add agent type specific context
    const agentTypeContext = agentType === 'FRONTEND'
      ? `\n\n**AGENT TYPE: FRONTEND (Customer-Facing)**\nYou are interacting with customers/clients. You have access to the full conversation history with this user. Provide personalized, conversational assistance. Remember context from previous messages. Focus on:\n- Answering product queries\n- Booking appointments\n- Providing customer support\n- Building rapport with the customer\n- Maintaining conversational continuity`
      : `\n\n**AGENT TYPE: BACKEND (Internal CRM Assistant)**\nYou are assisting internal staff members with CRM operations. You have access to the last few messages for immediate context (for multi-turn tasks like clarifying questions). Focus on:\n- Executing tasks accurately\n- Creating/updating records\n- Processing data operations efficiently\n- Being precise and actionable\n- Completing multi-step requests that require follow-up questions\n- Using recent context to understand clarifications and confirmations`

    const enhancedSystemPrompt = `${baseSystemPrompt}${agentTypeContext}\n\n**CURRENT DATE & TIME CONTEXT (Asia/Kolkata IST - UTC+5:30):**\n- Today's date: ${todayDate}\n- Tomorrow's date: ${tomorrowDate}\n- Current time: ${currentTime} IST\n- Next Sunday: ${sundayDate}\n- Current day: ${istDate.toLocaleDateString('en-US', { weekday: 'long' })}\n\n## Date/Time Handling:\n\n**IMPORTANT:** When users provide times, they are in IST. You MUST convert to UTC (subtract 5:30) before passing to tools.\n\nExamples:\n- User says "tomorrow 10 AM" → due_date: "${tomorrowDate}", due_time: "04:30" (10:00 AM IST = 04:30 UTC)\n- User says "today 3 PM" → due_date: "${todayDate}", due_time: "09:30" (3:00 PM IST = 09:30 UTC)\n- User says "this Sunday 12 PM" → due_date: "${sundayDate}", due_time: "06:30" (12:00 PM IST = 06:30 UTC)\n\n**Common time conversions (IST to UTC):**\n- 12:00 AM IST = 18:30 UTC (previous day)\n- 6:00 AM IST = 00:30 UTC\n- 12:00 PM IST = 06:30 UTC\n- 6:00 PM IST = 12:30 UTC\n- 11:59 PM IST = 18:29 UTC`

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
      console.log(`Sending ${tools.length} tools to OpenRouter:`, JSON.stringify(tools, null, 2))
    } else {
      console.log('WARNING: No tools available to send to OpenRouter!')
    }

    let aiResponse: string

    try {
      console.log('Sending request to OpenRouter with model:', agent.model)
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

      console.log('OpenRouter response:', JSON.stringify({
        hasToolCalls: !!assistantMessage.tool_calls,
        toolCallsCount: assistantMessage.tool_calls?.length || 0,
        content: assistantMessage.content?.substring(0, 200)
      }))

      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        const toolResults: string[] = []

        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name

          let functionArgs: any
          try {
            functionArgs = typeof toolCall.function.arguments === 'string'
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments
          } catch (parseError) {
            console.error(`Failed to parse tool arguments for ${functionName}:`, parseError)
            console.error(`Raw arguments:`, toolCall.function.arguments)
            toolResults.push(`❌ Failed to parse arguments for ${functionName}`)
            continue
          }

          functionArgs.agent_id = payload.agent_id

          console.log(`Executing MCP tool: ${functionName} with args:`, functionArgs)
          try {
            // Use the dynamic tool-to-server map (SINGLE SOURCE OF TRUTH)
            const serverKey = toolToServerMap[functionName]

            if (!serverKey) {
              const errorMsg = `❌ No server mapping found for tool: ${functionName}. Available tools: ${Object.keys(toolToServerMap).join(', ')}`
              console.error(errorMsg)
              toolResults.push(errorMsg)
              continue
            }

            const targetServerUrl = mcpServers[serverKey]

            if (!targetServerUrl) {
              const errorMsg = `❌ Invalid server key: ${serverKey} for tool: ${functionName}`
              console.error(errorMsg)
              toolResults.push(errorMsg)
              continue
            }

            console.log(`✅ Routing ${functionName} → ${serverKey} → ${targetServerUrl}`)

            const targetClient = new MCPClient(targetServerUrl, Deno.env.get('SUPABASE_ANON_KEY')!, payload.agent_id, payload.phone_number)
            await targetClient.initialize()
            const result = await targetClient.callTool(functionName, functionArgs)
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

    // Clean messages before storing to memory
    const cleanedUserMessage = payload.message.trim()
    const cleanedAssistantMessage = cleanMessageForMemory(aiResponse)

    // Log cleaning results for debugging
    if (aiResponse.length !== cleanedAssistantMessage.length) {
      console.log(`Message cleaned: ${aiResponse.length} chars → ${cleanedAssistantMessage.length} chars`)
      console.log(`Original preview: ${aiResponse.substring(0, 100)}...`)
      console.log(`Cleaned preview: ${cleanedAssistantMessage.substring(0, 100)}...`)
    }

    // Only save to memory if both messages are valid
    const memoryRecords = []

    if (cleanedUserMessage) {
      memoryRecords.push({
        agent_id: payload.agent_id,
        phone_number: payload.phone_number,
        role: 'user',
        message: cleanedUserMessage,
      })
    }

    if (cleanedAssistantMessage) {
      memoryRecords.push({
        agent_id: payload.agent_id,
        phone_number: payload.phone_number,
        role: 'assistant',
        message: cleanedAssistantMessage,
      })
    }

    // Save to memory only if we have valid messages
    if (memoryRecords.length > 0) {
      await supabase
        .from('ai_agent_chat_memory')
        .insert(memoryRecords)

      console.log(`✅ Saved ${memoryRecords.length} clean messages to memory`)
    } else {
      console.log('⚠️ Skipped saving to memory: no clean messages to store (likely only technical data)')
    }

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
