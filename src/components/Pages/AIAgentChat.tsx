import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Send, ArrowLeft, Paperclip, User, Loader2, X, Zap } from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getMCPTools, executeMCPTool, shouldUseMCP } from '@/lib/mcp-tool-executor'
import { useAuth } from '@/contexts/AuthContext'

interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: string
  imageUrl?: string
  action?: string
  module?: string
  result?: string
  usedMCP?: boolean
}

interface Agent {
  id: string
  name: string
  model: string
  status: string
  system_prompt?: string
  use_mcp?: boolean
  mcp_config?: any
}

export function AIAgentChat() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { userProfile } = useAuth()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [loading, setLoading] = useState(true)
  const [openRouterApiKey, setOpenRouterApiKey] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>('')
  const [availablePhoneNumbers, setAvailablePhoneNumbers] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (id) {
      fetchAgent()
      fetchOpenRouterKey()
    }
  }, [id])

  useEffect(() => {
    if (userProfile?.phone) {
      if (!selectedPhoneNumber) {
        setSelectedPhoneNumber(userProfile.phone)
      }
      fetchPhoneNumbers()
    }
  }, [userProfile, id])

  useEffect(() => {
    if (id && selectedPhoneNumber) {
      loadChatHistory(selectedPhoneNumber)
    }
  }, [id, selectedPhoneNumber])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchAgent = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, model, status, system_prompt, use_mcp, mcp_config')
        .eq('id', id)
        .single()

      if (error) throw error
      setAgent(data)
    } catch (error) {
      console.error('Error fetching agent:', error)
      alert('Failed to load agent')
      navigate('/ai-agents')
    } finally {
      setLoading(false)
    }
  }

  const fetchOpenRouterKey = async () => {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('config')
        .eq('integration_type', 'openrouter')
        .maybeSingle()

      if (error) throw error

      if (data && data.config) {
        const config = data.config as any
        setOpenRouterApiKey(config.apiKey || '')
      }
    } catch (error) {
      console.error('Error fetching OpenRouter key:', error)
    }
  }

  const fetchPhoneNumbers = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_agent_chat_memory')
        .select('phone_number')
        .eq('agent_id', id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const uniquePhones = Array.from(new Set(data.map(d => d.phone_number).filter(p => p)))

      // Add logged-in user's phone if available
      if (userProfile?.phone && !uniquePhones.includes(userProfile.phone)) {
        uniquePhones.unshift(userProfile.phone)
      }

      setAvailablePhoneNumbers(uniquePhones)
    } catch (error) {
      console.error('Error fetching phone numbers:', error)
    }
  }

  const loadChatHistory = async (phoneNumber: string) => {
    try {
      const { data, error } = await supabase
        .from('ai_agent_chat_memory')
        .select('*')
        .eq('agent_id', id)
        .eq('phone_number', phoneNumber)
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) throw error

      const historyMessages: Message[] = data.map(msg => ({
        id: msg.id,
        role: msg.role === 'user' ? 'user' : 'agent',
        content: msg.message,
        timestamp: msg.created_at,
        imageUrl: msg.metadata?.image_url
      }))

      setMessages(historyMessages)
    } catch (error) {
      console.error('Error loading chat history:', error)
    }
  }

  const checkPermission = async (module: string, action: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('ai_agent_permissions')
        .select('permissions')
        .eq('agent_id', id)
        .maybeSingle()

      if (error || !data || !data.permissions) return false

      const permissions = data.permissions as any
      const modulePerms = permissions[module]

      if (!modulePerms) return false

      const actionMap: Record<string, string> = {
        'create': 'can_create',
        'update': 'can_edit',
        'edit': 'can_edit',
        'delete': 'can_delete',
        'fetch': 'can_view',
        'view': 'can_view',
        'read': 'can_view'
      }

      const permissionKey = actionMap[action.toLowerCase()]
      return modulePerms[permissionKey] === true
    } catch (error) {
      console.error('Error checking permission:', error)
      return false
    }
  }

  const getAvailableTools = async () => {
    const { data: permData } = await supabase
      .from('ai_agent_permissions')
      .select('permissions')
      .eq('agent_id', id)
      .maybeSingle()

    const permissions = permData?.permissions || {}

    const tools: any[] = []

    // Check which modules are handled by MCP
    let mcpHandledModules: string[] = []
    if (agent?.use_mcp && id) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      try {
        const mcpTools = await getMCPTools(id, supabaseUrl, supabaseAnonKey)
        tools.push(...mcpTools)

        // Track which modules are handled by MCP
        const mcpConfig = agent.mcp_config as any
        if (mcpConfig?.use_for_modules) {
          mcpHandledModules = mcpConfig.use_for_modules
        }
      } catch (error) {
        console.error('Error fetching MCP tools:', error)
      }
    }

    // Expenses tools removed - use MCP server instead

    // Task tools removed - use MCP server instead

    // Lead tools removed - use MCP server instead

    // Lead view tools removed - use MCP server instead

    // Expense view tools removed - use MCP server instead

    // Appointment view tools removed - use MCP server instead

    // Appointment create tools removed - use MCP server instead

    // Calendar tools removed - use MCP server instead

    tools.push({
      type: 'function',
      function: {
        name: 'generate_image',
        description: 'Generate or edit an image using AI. Can create images from text descriptions or modify existing images.',
        parameters: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Detailed description of the image to generate or how to modify the existing image'
            },
            reference_image_url: {
              type: 'string',
              description: 'Optional URL of an existing image to use as reference or to modify'
            }
          },
          required: ['prompt']
        }
      }
    })

    // Support ticket tools removed - use MCP server instead

    // Contact tools removed - use MCP server instead

    // Task view tools removed - use MCP server instead

    // Add MCP resource and prompt tools if MCP is enabled
    if (agent?.use_mcp && id) {
      tools.push({
        type: 'function',
        function: {
          name: 'read_mcp_resource',
          description: 'Read data from an MCP resource. Use this for getting task lists and summaries without filtering.',
          parameters: {
            type: 'object',
            properties: {
              uri: {
                type: 'string',
                description: 'The resource URI to read. Available URIs: "tasks://all" (all tasks), "tasks://pending" (To Do/In Progress), "tasks://overdue" (past due date), "tasks://high-priority" (High/Urgent priority), "tasks://statistics" (aggregated stats)',
              },
            },
            required: ['uri'],
          },
        },
      })

      tools.push({
        type: 'function',
        function: {
          name: 'get_mcp_prompt',
          description: 'Get a pre-built prompt template (e.g., task summary, task creation guide, prioritization tips)',
          parameters: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'The prompt name (e.g., "task_summary", "task_creation_guide", "overdue_alert")',
              },
              arguments: {
                type: 'object',
                description: 'Optional arguments for the prompt',
              },
            },
            required: ['name'],
          },
        },
      })
    }

    return tools
  }

  const executeFunction = async (functionName: string, args: any, model?: string): Promise<any> => {
    try {
      switch (functionName) {
        case 'create_expense':
          return { success: false, message: 'create_expense has been removed. Please use MCP server instead.' }

        case 'create_task':
          return { success: false, message: 'create_task has been removed. Please use MCP server instead.' }

        case 'create_lead':
          return { success: false, message: 'create_lead has been removed. Please use MCP server instead.' }

        case 'get_leads':
          return { success: false, message: 'get_leads has been removed. Please use MCP server instead.' }

        case 'get_expenses':
          return { success: false, message: 'get_expenses has been removed. Please use MCP server instead.' }

        case 'get_appointments':
          return { success: false, message: 'get_appointments has been removed. Please use MCP server instead.' }

        case 'create_appointment':
          return { success: false, message: 'create_appointment has been removed. Please use MCP server instead.' }

        case 'get_calendars':
          return { success: false, message: 'get_calendars has been removed. Please use MCP server instead.' }

        case 'get_support_tickets':
          return { success: false, message: 'get_support_tickets has been removed. Please use MCP server instead.' }

        case 'get_contacts':
          return { success: false, message: 'get_contacts has been removed. Please use MCP server instead.' }

        case 'update_task':
          return { success: false, message: 'update_task has been removed. Please use MCP server instead.' }

        case 'delete_task':
          return { success: false, message: 'delete_task has been removed. Please use MCP server instead.' }

        case 'get_tasks':
          return { success: false, message: 'get_tasks has been removed. Please use MCP server instead.' }

        case 'generate_image':
          if (!openRouterApiKey) {
            return { success: false, message: 'OpenRouter API key is not configured' }
          }

          const imageGenMessages: any[] = [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: args.prompt
                }
              ]
            }
          ]

          if (args.reference_image_url) {
            imageGenMessages[0].content.push({
              type: 'image_url',
              image_url: {
                url: args.reference_image_url
              }
            })
          }

          const modelToUse = model || agent?.model || 'google/gemini-2.0-flash-exp'

          const imageGenResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openRouterApiKey}`
            },
            body: JSON.stringify({
              model: modelToUse,
              messages: imageGenMessages
            })
          })

          if (!imageGenResponse.ok) {
            const errorData = await imageGenResponse.json().catch(() => ({}))
            return { success: false, message: `Image generation failed: ${errorData.error?.message || imageGenResponse.statusText}` }
          }

          const imageGenData = await imageGenResponse.json()
          const imageContent = imageGenData.choices[0]?.message?.content || ''

          const imageUrlMatch = imageContent.match(/https?:\/\/[^\s)]+\.(jpg|jpeg|png|gif|webp)/i)
          const imageUrl = imageUrlMatch ? imageUrlMatch[0] : null

          if (imageUrl) {
            return { success: true, message: `Image generated successfully`, image_url: imageUrl }
          } else {
            return { success: false, message: 'Failed to extract image URL from response', response: imageContent }
          }

        case 'read_mcp_resource':
          if (id && agent?.use_mcp) {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

            try {
              const { createMCPClient } = await import('@/lib/mcp-client')
              const client = createMCPClient({
                serverUrl: `${supabaseUrl}/functions/v1/mcp-server`,
                authToken: supabaseAnonKey,
                agentId: id
              })

              await client.initialize()
              const result = await client.readResource(args.uri)

              if (result?.contents && result.contents[0]?.text) {
                return {
                  success: true,
                  message: `Retrieved resource: ${args.uri}`,
                  data: JSON.parse(result.contents[0].text),
                  usedMCP: true
                }
              } else {
                return { success: false, error: 'No data returned from resource', usedMCP: true }
              }
            } catch (error: any) {
              return { success: false, error: error.message, usedMCP: true }
            }
          }
          return { success: false, error: 'MCP is not enabled for this agent' }

        case 'get_mcp_prompt':
          if (id && agent?.use_mcp) {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

            try {
              const { createMCPClient } = await import('@/lib/mcp-client')
              const client = createMCPClient({
                serverUrl: `${supabaseUrl}/functions/v1/mcp-server`,
                authToken: supabaseAnonKey,
                agentId: id
              })

              await client.initialize()
              const result = await client.getPrompt(args.name, args.arguments || {})

              if (result?.messages && result.messages[0]?.content?.text) {
                return {
                  success: true,
                  message: result.messages[0].content.text,
                  usedMCP: true
                }
              } else {
                return { success: false, error: 'No prompt data returned', usedMCP: true }
              }
            } catch (error: any) {
              return { success: false, error: error.message, usedMCP: true }
            }
          }
          return { success: false, error: 'MCP is not enabled for this agent' }

        default:
          return { success: false, message: `Unknown function: ${functionName}` }
      }
    } catch (error: any) {
      return { success: false, message: `Error: ${error.message}` }
    }
  }

  const callOpenRouter = async (userMessage: string, imageUrl?: string): Promise<string> => {
    if (!openRouterApiKey) {
      return "OpenRouter API key is not configured. Please configure it in Settings > Integrations."
    }

    if (!agent?.model) {
      return "AI model is not configured for this agent."
    }

    // If MCP is enabled, use the ai-chat edge function instead
    if (agent.use_mcp && agent.mcp_config?.enabled) {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

        const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'apikey': supabaseAnonKey
          },
          body: JSON.stringify({
            agent_id: id,
            phone_number: selectedPhoneNumber || 'web-user',
            message: userMessage
          })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `AI Chat API request failed with status ${response.status}`)
        }

        const data = await response.json()
        return data.response || 'No response from AI'
      } catch (error: any) {
        console.error('Error calling ai-chat function:', error)
        return `Error communicating with AI: ${error.message}`
      }
    }

    try {
      const messageContent: any[] = [
        {
          type: "text",
          text: userMessage
        }
      ]

      if (imageUrl) {
        messageContent.push({
          type: "image_url",
          image_url: {
            url: imageUrl
          }
        })
      }

      const tools = await getAvailableTools()

      // Fetch MCP resources and prompts info if MCP is enabled
      let mcpResourcesInfo = ''
      let mcpPromptsInfo = ''
      if (agent.use_mcp && id) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

        try {
          const { createMCPClient } = await import('@/lib/mcp-client')
          const client = createMCPClient({
            serverUrl: `${supabaseUrl}/functions/v1/mcp-server`,
            authToken: supabaseAnonKey,
            agentId: id
          })

          await client.initialize()

          // Get resources
          const resources = await client.listResources()
          if (resources && resources.length > 0) {
            mcpResourcesInfo = `\n\n## Available MCP Resources\nYou have access to the following task data resources:\n`
            resources.forEach((r: any) => {
              mcpResourcesInfo += `- **${r.uri}**: ${r.description}\n`
            })
            mcpResourcesInfo += `\n**When to use Resources:**\n- User asks "how many tasks..." → use read_mcp_resource with tasks://all or tasks://statistics\n- User asks "show pending tasks" → use read_mcp_resource with tasks://pending\n- User asks "what's overdue" → use read_mcp_resource with tasks://overdue\n- User asks "high priority tasks" → use read_mcp_resource with tasks://high-priority\n\nResources give you raw data to analyze and summarize for the user.`
          }

          // Get prompts
          const prompts = await client.listPrompts()
          if (prompts && prompts.length > 0) {
            mcpPromptsInfo = `\n\n## Available MCP Prompts\nYou can use these pre-built templates:\n`
            prompts.forEach((p: any) => {
              mcpPromptsInfo += `- **${p.name}**: ${p.description}\n`
            })
            mcpPromptsInfo += `\n**When to use Prompts:**\n- User asks "give me a summary" → use get_mcp_prompt('task_summary')\n- User asks "how to create a task" → use get_mcp_prompt('task_creation_guide')\n- User asks "how to prioritize" → use get_mcp_prompt('task_prioritization')\n- User asks "any overdue tasks?" → use get_mcp_prompt('overdue_alert')\n- User asks "how to find a task" → use get_mcp_prompt('get_task_by_id')\n\nPrompts provide pre-formatted, user-friendly responses with guidance and recommendations.`
          }
        } catch (error) {
          console.error('Error fetching MCP resources/prompts:', error)
        }
      }

      const todayDate = new Date().toISOString().split('T')[0]
      const tomorrowDate = new Date(Date.now() + 86400000).toISOString().split('T')[0]
      const systemPrompt = agent.system_prompt || 'You are a helpful AI assistant with access to CRM functions.'
      let enhancedSystemPrompt = `${systemPrompt}\n\nToday's date is ${todayDate}. Tomorrow's date is ${tomorrowDate}. Use these exact dates when users say "tomorrow", "today", etc.${mcpResourcesInfo}${mcpPromptsInfo}

CRITICAL RESPONSE GUIDELINES:
- ONLY respond to the current user message
- DO NOT repeat or summarize previous actions in your response
- DO NOT include confirmations from earlier messages
- Each response should ONLY address what the user just asked
- Be concise and direct - just answer the current question

IMPORTANT TIMEZONE HANDLING:
- All dates/times in the database are stored in UTC
- When displaying dates/times to users, ALWAYS convert from UTC to Asia/Kolkata timezone (IST)
- IST is UTC+5:30
- Format dates as: "DD MMM YYYY, hh:mm AM/PM IST"
- Example: "05 Nov 2025, 03:30 PM IST" (not UTC)

IMPORTANT: When you create a task and receive a response, you MUST parse the JSON response and display the task details in a formatted way. Convert all UTC timestamps to IST before displaying. For example, after creating a task, show:

Task has been created successfully. Here are the details:

* **Task ID**: TASK-XXXXX
* **Title**: [title]
* **Assigned To**: [assigned_to_name]
* **Priority**: [priority]
* **Status**: [status]
* **Due Date**: [due_date in IST format]
* **Created At**: [created_at in IST format]

You have access to CRM tools. When a user asks you to perform actions like creating expenses, tasks, or retrieving data, use the available tools to execute those actions immediately. DO NOT ask for confirmation or additional details if you have enough information to proceed.

CRITICAL TASK CREATION EXAMPLES - Follow these patterns EXACTLY:
NOTE: When users provide times, they are in IST. Convert to UTC (subtract 5:30) before storing.

- "create a task for Khushi to create a voice Bot for Automation saathi client by tomorrow 10 AM"
  → User time: 10:00 AM IST = 04:30 UTC
  → IMMEDIATELY use create_task with: title="Create a voice Bot for Automation saathi client", assigned_to_name="Khushi", due_date="${tomorrowDate}", due_time="04:30"

- "create a task for Amit tomorrow 3pm to send whatsapp broadcast"
  → User time: 3:00 PM IST = 09:30 UTC
  → IMMEDIATELY use create_task with: title="Send WhatsApp broadcast", assigned_to_name="Amit", due_date="${tomorrowDate}", due_time="09:30"

- "create unassigned task to follow up with client"
  → IMMEDIATELY use create_task with: title="Follow up with client", no assigned_to_name (leave empty)

NEVER ask for user IDs - use the person's name in assigned_to_name and the system will find them.
NEVER ask the user to provide a title if they already described what needs to be done - extract the title from their description.
Only ask clarifying questions if critical required information is truly missing.

Other examples:
- If a user provides a ticket ID like "TKT-2025-061", immediately use get_support_tickets with that ticket_id
- If a user provides a task ID like "TASK-10028", immediately use get_tasks with task_id="TASK-10028"
- If a user says "create an expense of 2800 for mumbai flight", immediately use create_expense with the provided details

ALWAYS use tools when appropriate instead of just describing what you would do or asking unnecessary questions.

IMPORTANT: If you ask the user for additional information (like a category, date, etc.) and they provide it in their next message, use that information to complete the original action. For example, if you asked "What is the category?" and they reply "travel", use "travel" as the category parameter for the create_expense function.

When users ask about TASKS:
- "get details of task TASK-10028" → get_tasks with task_id="TASK-10028" (display dates in IST)
- "show me task TASK-10031" → get_tasks with task_id="TASK-10031" (display dates in IST)
- "last 5 tasks" → get_tasks with limit=5 (display dates in IST)
- "high priority tasks" → get_tasks with priority="High" (display dates in IST)
- "update task TASK-10028 status to completed" → update_task with task_id="TASK-10028" and status="Completed"
- "mark task 10028 as done" → update_task with task_id="TASK-10028" and status="Completed"

REMEMBER: Always convert UTC timestamps to IST (UTC+5:30) when displaying to users.

When updating tasks:
- If user says just a number like "10037", interpret it as "TASK-10037"
- Status values: "To Do", "In Progress", "Completed", "Cancelled"
- Priority values: "Low", "Medium", "High", "Urgent"

When users ask about expenses with time periods (like "this month", "today", "last month"), use the get_expenses tool with the date_filter parameter. When they ask for category-wise totals or breakdowns, set group_by_category to true. Examples:\n- "expenses this month" → get_expenses with date_filter="this_month"\n- "category wise expenses" → get_expenses with group_by_category=true\n- "travel expenses this month" → get_expenses with date_filter="this_month" and category="Travel"`

      if (imageUrl) {
        enhancedSystemPrompt += `\n\nIMPORTANT: The user has uploaded an image. When they ask you to create, generate, or modify an image, you MUST use the generate_image tool and pass the uploaded image URL as the reference_image_url parameter. The uploaded image is available at: ${imageUrl}`
      }

      const conversationMessages = [
        {
          role: 'system',
          content: enhancedSystemPrompt
        }
      ]

      const recentMessages = messages.slice(-10)
      recentMessages.forEach(msg => {
        conversationMessages.push({
          role: msg.role === 'agent' ? 'assistant' : 'user',
          content: msg.role === 'user' && msg.imageUrl
            ? [
                { type: 'text', text: msg.content },
                { type: 'image_url', image_url: { url: msg.imageUrl } }
              ]
            : msg.content
        })
      })

      conversationMessages.push({
        role: 'user',
        content: messageContent
      })

      const requestBody: any = {
        model: agent.model,
        messages: conversationMessages
      }

      if (tools.length > 0) {
        requestBody.tools = tools
        requestBody.tool_choice = 'auto'
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openRouterApiKey}`
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `API request failed with status ${response.status}`)
      }

      const data = await response.json()
      const message = data.choices[0]?.message

      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolResults: string[] = []
        let generatedImageUrl: string | null = null

        for (const toolCall of message.tool_calls) {
          const functionName = toolCall.function.name
          const functionArgs = JSON.parse(toolCall.function.arguments)

          const result = await executeFunction(functionName, functionArgs, agent.model)

          let toolResultContent = ''

          if (result.success) {
            const mcpIndicator = result.usedMCP ? ' 🔌 (via MCP)' : ''
            toolResultContent = `✅ ${result.message}${mcpIndicator}`

            if (result.image_url) {
              generatedImageUrl = result.image_url
              toolResultContent += `\n![Generated Image](${result.image_url})`
            }

            if (result.data) {
              toolResultContent += `\n\nData:\n${JSON.stringify(result.data, null, 2)}`
            }
          } else {
            const mcpIndicator = result.usedMCP ? ' 🔌 (via MCP)' : ''
            toolResultContent = `❌ ${result.error || result.message}${mcpIndicator}`
          }

          toolResults.push(toolResultContent)
        }

        // Build tool response messages - one for each tool call
        const toolResponseMessages = message.tool_calls.map((toolCall: any, index: number) => ({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResults[index] || 'No response'
        }))

        const finalResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openRouterApiKey}`
          },
          body: JSON.stringify({
            model: agent.model,
            messages: [
              ...conversationMessages,
              message,
              ...toolResponseMessages
            ]
          })
        })

        if (finalResponse.ok) {
          const finalData = await finalResponse.json()
          return finalData.choices[0]?.message?.content || toolResults.join('\n')
        }

        return toolResults.join('\n')
      }

      return message.content || 'No response from AI'
    } catch (error: any) {
      console.error('Error calling OpenRouter:', error)
      return `Error communicating with AI: ${error.message}`
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploadImageToStorage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `chat-images/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('media-files')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('media-files')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      return null
    }
  }

  const saveMessageToMemory = async (message: string, role: 'user' | 'assistant', action: string, module: string, result: string, imageUrl?: string, phoneNumber?: string) => {
    const finalPhoneNumber = phoneNumber || selectedPhoneNumber
    try {
      await supabase
        .from('ai_agent_chat_memory')
        .insert({
          agent_id: id,
          phone_number: finalPhoneNumber,
          message: message,
          role: role,
          user_context: 'Internal',
          action: action,
          result: result,
          module: module,
          metadata: {
            image_url: imageUrl,
            timestamp: new Date().toISOString()
          }
        })

      await supabase
        .from('ai_agent_logs')
        .insert({
          agent_id: id,
          agent_name: agent?.name || 'Unknown',
          module,
          action,
          result,
          user_context: 'Internal',
          details: {
            user_message: message,
            image_url: imageUrl
          }
        })
    } catch (error) {
      console.error('Error saving message to memory:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !agent) return

    const messageText = inputMessage
    let uploadedImageUrl: string | null = null

    if (selectedImage) {
      uploadedImageUrl = await uploadImageToStorage(selectedImage)
      if (!uploadedImageUrl) {
        alert('Failed to upload image. Please try again.')
        return
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      imageUrl: uploadedImageUrl || undefined,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    removeImage()
    setIsTyping(true)

    const action = messageText.toLowerCase().includes('create') ? 'Create' :
                   messageText.toLowerCase().includes('update') ? 'Update' :
                   messageText.toLowerCase().includes('delete') ? 'Delete' : 'Chat'

    const module = messageText.toLowerCase().includes('task') ? 'Tasks' :
                   messageText.toLowerCase().includes('appointment') ? 'Appointments' :
                   messageText.toLowerCase().includes('ticket') ? 'Support Tickets' :
                   messageText.toLowerCase().includes('lead') ? 'Leads' : 'General'

    try {
      // Only save to memory if MCP is NOT enabled (ai-chat function handles saving when MCP is enabled)
      const useMCP = agent?.use_mcp && agent.mcp_config?.enabled

      if (!useMCP) {
        await saveMessageToMemory(messageText, 'user', action, module, 'Success', uploadedImageUrl || undefined)
      }

      const agentResponse = await callOpenRouter(messageText, uploadedImageUrl || undefined)

      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: agentResponse,
        timestamp: new Date().toISOString(),
        result: agentResponse.includes('Error') ? 'Error' : 'Success'
      }

      setMessages(prev => [...prev, agentMessage])

      if (!useMCP) {
        await saveMessageToMemory(agentResponse, 'assistant', action, module, agentMessage.result || 'Success', uploadedImageUrl || undefined)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: 'An error occurred while processing your message. Please try again.',
        timestamp: new Date().toISOString(),
        result: 'Error'
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading chat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="p-8 pb-4">
        <Button
          variant="outline"
          onClick={() => navigate('/ai-agents')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Agents
        </Button>
        <div className="flex items-center justify-between">
          <PageHeader
            title={`Chat with ${agent?.name}`}
            subtitle={`Powered by ${agent?.model}`}
            icon={Bot}
          />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Phone:</label>
              <select
                value={selectedPhoneNumber}
                onChange={(e) => setSelectedPhoneNumber(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availablePhoneNumbers.map((phone) => (
                  <option key={phone} value={phone}>
                    {phone}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              {agent?.use_mcp && (
                <Badge className="bg-blue-100 text-blue-800 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  MCP Enabled
                </Badge>
              )}
              <Badge className={agent?.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                {agent?.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-8 pb-8">
        <Card className="h-full flex flex-col">
          <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'agent' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-blue-600" />
                    </div>
                  )}
                  <div className={`max-w-[70%] ${message.role === 'user' ? 'order-1' : ''}`}>
                    <div
                      className={`
                        rounded-2xl px-4 py-3
                        ${message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                        }
                      `}
                    >
                      {message.imageUrl && (
                        <img
                          src={message.imageUrl}
                          alt="User uploaded"
                          className="max-w-full rounded-lg mb-2"
                          style={{ maxHeight: '300px' }}
                        />
                      )}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 px-2">
                      <span className="text-xs text-gray-400">
                        {formatDateTime(message.timestamp)}
                      </span>
                      {message.result && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            message.result === 'Success'
                              ? 'border-green-500 text-green-700'
                              : 'border-red-500 text-red-700'
                          }`}
                        >
                          {message.result}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-blue-600" />
                </div>
                <div className="bg-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    <span className="text-sm text-gray-500">Thinking...</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </CardContent>

          <div className="p-4 border-t">
            {imagePreview && (
              <div className="mb-3 relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-32 rounded-lg border border-gray-300"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Attach image"
              >
                <Paperclip className="w-5 h-5 text-gray-500" />
              </button>
              <Input
                placeholder="Type your message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isTyping}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2 px-2">
              Powered by OpenRouter AI. You can attach images for vision models.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
