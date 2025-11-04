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

// Session storage (in-memory for demo, use Supabase for production)
const sessions = new Map<string, { agentId?: string; initialized: boolean }>()

function generateSessionId(): string {
  return `mcp-session-${Date.now()}-${Math.random().toString(36).substring(7)}`
}

function createSSEMessage(message: MCPMessage): string {
  return `data: ${JSON.stringify(message)}\n\n`
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
        // Extract agent_id from client info if provided
        const clientInfo = params?.clientInfo
        const agentId = clientInfo?.agentId || params?.agentId

        // Store session with agent_id
        sessions.set(sessionId, {
          initialized: true,
          agentId: agentId
        })

        console.log('MCP session initialized', { sessionId, agentId })

        response.result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
          serverInfo: {
            name: 'crm-tasks-mcp-server',
            version: '1.0.0',
          },
        }
        break
      }

      case 'tools/list': {
        response.result = {
          tools: [
            {
              name: 'get_tasks',
              description: 'Retrieve tasks with advanced filtering. Use task_id to get a specific task.',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: {
                    type: 'string',
                    description: 'AI Agent ID for permission checking',
                  },
                  task_id: {
                    type: 'string',
                    description: 'Get a specific task by its task_id (e.g., TASK-10031)',
                  },
                  status: {
                    type: 'string',
                    enum: ['To Do', 'In Progress', 'Completed', 'Cancelled'],
                  },
                  priority: {
                    type: 'string',
                    enum: ['Low', 'Medium', 'High', 'Urgent'],
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum number of tasks (default: 100)',
                  },
                },
              },
            },
            {
              name: 'create_task',
              description: 'Create a new task',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: {
                    type: 'string',
                    description: 'AI Agent ID for permission checking',
                  },
                  title: {
                    type: 'string',
                    description: 'Task title',
                  },
                  description: {
                    type: 'string',
                    description: 'Task description',
                  },
                  priority: {
                    type: 'string',
                    enum: ['Low', 'Medium', 'High', 'Urgent'],
                    description: 'Task priority (default: Medium)',
                  },
                  status: {
                    type: 'string',
                    enum: ['To Do', 'In Progress', 'Completed', 'Cancelled'],
                    description: 'Task status (default: To Do)',
                  },
                  assigned_to: {
                    type: 'string',
                    description: 'UUID of assigned team member',
                  },
                  assigned_to_name: {
                    type: 'string',
                    description: 'Name of assigned team member (e.g., "Amit", "Prince")',
                  },
                  contact_id: {
                    type: 'string',
                    description: 'UUID of related contact',
                  },
                  due_date: {
                    type: 'string',
                    description: 'Due date (YYYY-MM-DD format)',
                  },
                  due_time: {
                    type: 'string',
                    description: 'Due time (HH:MM format, 24-hour)',
                  },
                  supporting_docs: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of document URLs or file paths',
                  },
                },
                required: ['title'],
              },
            },
            {
              name: 'update_task',
              description: 'Update an existing task',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: {
                    type: 'string',
                    description: 'AI Agent ID for permission checking',
                  },
                  task_id: {
                    type: 'string',
                    description: 'Task ID to update (e.g., TASK-10031)',
                  },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  status: {
                    type: 'string',
                    enum: ['To Do', 'In Progress', 'Completed', 'Cancelled'],
                  },
                  priority: {
                    type: 'string',
                    enum: ['Low', 'Medium', 'High', 'Urgent'],
                  },
                  assigned_to: { type: 'string' },
                  due_date: { type: 'string' },
                },
                required: ['task_id'],
              },
            },
            {
              name: 'delete_task',
              description: 'Delete a task',
              inputSchema: {
                type: 'object',
                properties: {
                  agent_id: {
                    type: 'string',
                    description: 'AI Agent ID for permission checking',
                  },
                  task_id: {
                    type: 'string',
                    description: 'Task ID to delete',
                  },
                },
                required: ['task_id'],
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

        // Check agent permissions
        const { data: permissions, error: permError } = await supabase
          .from('ai_agent_permissions')
          .select('permissions')
          .eq('agent_id', agentId)
          .maybeSingle()

        if (permError || !permissions) {
          throw new Error('Agent not found or no permissions set')
        }

        const taskPerms = permissions.permissions?.Tasks || {}

        switch (name) {
          case 'get_tasks': {
            if (!taskPerms.can_view) {
              throw new Error('Agent does not have permission to view tasks')
            }

            let query = supabase
              .from('tasks')
              .select('*')
              .order('created_at', { ascending: false })

            if (args.task_id) {
              query = query.eq('task_id', args.task_id)
            }
            if (args.status) {
              query = query.eq('status', args.status)
            }
            if (args.priority) {
              query = query.eq('priority', args.priority)
            }
            if (args.limit) {
              query = query.limit(args.limit)
            } else {
              query = query.limit(100)
            }

            const { data, error } = await query

            if (error) throw error

            // Log action
            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              action: 'get_tasks',
              details: { filters: args, result_count: data?.length || 0 },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            }
            break
          }

          case 'create_task': {
            if (!taskPerms.can_create) {
              throw new Error('Agent does not have permission to create tasks')
            }

            // Combine due_date and due_time into a single timestamp
            let dueDateTimestamp = null
            if (args.due_date) {
              if (args.due_time) {
                // Combine date and time: "2025-11-06" + "15:00" = "2025-11-06T15:00:00"
                dueDateTimestamp = `${args.due_date}T${args.due_time}:00`
              } else {
                // Just date, set to start of day
                dueDateTimestamp = `${args.due_date}T00:00:00`
              }
            }

            // If assigned_to_name is provided but not assigned_to UUID, look it up
            let assignedToUuid = args.assigned_to || null
            if (args.assigned_to_name && !assignedToUuid) {
              const { data: userData } = await supabase
                .from('admin_users')
                .select('id')
                .ilike('full_name', `%${args.assigned_to_name}%`)
                .limit(1)
                .maybeSingle()

              if (userData) {
                assignedToUuid = userData.id
              }
            }

            const taskData = {
              title: args.title,
              description: args.description || null,
              priority: args.priority || 'Medium',
              status: args.status || 'To Do',
              assigned_to: assignedToUuid,
              contact_id: args.contact_id || null,
              due_date: dueDateTimestamp,
              supporting_documents: args.supporting_docs || null,
            }

            const { data, error } = await supabase
              .from('tasks')
              .insert(taskData)
              .select()
              .single()

            if (error) throw error

            // Log action
            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              action: 'create_task',
              details: { task_id: data.task_id, title: args.title },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: 'Task created successfully',
                    task: data
                  }, null, 2),
                },
              ],
            }
            break
          }

          case 'update_task': {
            if (!taskPerms.can_edit) {
              throw new Error('Agent does not have permission to edit tasks')
            }

            const { task_id, ...updates } = args
            delete updates.agent_id

            const { data, error } = await supabase
              .from('tasks')
              .update(updates)
              .eq('task_id', task_id)
              .select()
              .single()

            if (error) throw error

            // Log action
            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              action: 'update_task',
              details: { task_id, updates },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: `Task updated successfully: ${task_id}`,
                },
              ],
            }
            break
          }

          case 'delete_task': {
            if (!taskPerms.can_delete) {
              throw new Error('Agent does not have permission to delete tasks')
            }

            const { task_id } = args

            const { error } = await supabase
              .from('tasks')
              .delete()
              .eq('task_id', task_id)

            if (error) throw error

            // Log action
            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              action: 'delete_task',
              details: { task_id },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: `Task deleted successfully: ${task_id}`,
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

      case 'resources/list': {
        response.result = {
          resources: [
            {
              uri: 'tasks://all',
              name: 'All Tasks',
              description: 'Complete list of all tasks in the system',
              mimeType: 'application/json',
            },
            {
              uri: 'tasks://pending',
              name: 'Pending Tasks',
              description: 'Tasks with status "To Do" or "In Progress"',
              mimeType: 'application/json',
            },
            {
              uri: 'tasks://overdue',
              name: 'Overdue Tasks',
              description: 'Tasks that are past their due date',
              mimeType: 'application/json',
            },
            {
              uri: 'tasks://high-priority',
              name: 'High Priority Tasks',
              description: 'Tasks with priority "High" or "Urgent"',
              mimeType: 'application/json',
            },
            {
              uri: 'tasks://statistics',
              name: 'Task Statistics',
              description: 'Aggregate statistics about tasks',
              mimeType: 'application/json',
            },
          ],
        }
        break
      }

      case 'resources/read': {
        const { uri } = params
        const agentId = sessions.get(sessionId)?.agentId

        if (!agentId) {
          throw new Error('Agent not initialized')
        }

        // Check view permissions
        const { data: permissions } = await supabase
          .from('ai_agent_permissions')
          .select('permissions')
          .eq('agent_id', agentId)
          .maybeSingle()

        const taskPerms = permissions?.permissions?.Tasks || {}
        if (!taskPerms.can_view) {
          throw new Error('Agent does not have permission to view tasks')
        }

        let resourceData: any = null

        if (uri === 'tasks://all') {
          const { data } = await supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false })
          resourceData = { tasks: data || [], count: data?.length || 0 }
        } else if (uri === 'tasks://pending') {
          const { data } = await supabase
            .from('tasks')
            .select('*')
            .in('status', ['To Do', 'In Progress'])
            .order('priority', { ascending: false })
          resourceData = { tasks: data || [], count: data?.length || 0 }
        } else if (uri === 'tasks://overdue') {
          const today = new Date().toISOString().split('T')[0]
          const { data } = await supabase
            .from('tasks')
            .select('*')
            .lt('due_date', today)
            .in('status', ['To Do', 'In Progress'])
            .order('due_date', { ascending: true })
          resourceData = { tasks: data || [], count: data?.length || 0 }
        } else if (uri === 'tasks://high-priority') {
          const { data } = await supabase
            .from('tasks')
            .select('*')
            .in('priority', ['High', 'Urgent'])
            .in('status', ['To Do', 'In Progress'])
            .order('priority', { ascending: false })
          resourceData = { tasks: data || [], count: data?.length || 0 }
        } else if (uri === 'tasks://statistics') {
          const { data: allTasks } = await supabase
            .from('tasks')
            .select('status, priority, due_date')

          const today = new Date().toISOString().split('T')[0]
          const statistics = {
            total: allTasks?.length || 0,
            by_status: { 'To Do': 0, 'In Progress': 0, 'Completed': 0, 'Cancelled': 0 },
            by_priority: { 'Low': 0, 'Medium': 0, 'High': 0, 'Urgent': 0 },
            overdue: 0,
            due_today: 0,
          }

          allTasks?.forEach((task: any) => {
            if (task.status) statistics.by_status[task.status]++
            if (task.priority) statistics.by_priority[task.priority]++
            if (task.due_date < today && ['To Do', 'In Progress'].includes(task.status)) {
              statistics.overdue++
            }
            if (task.due_date === today) statistics.due_today++
          })

          resourceData = statistics
        } else {
          throw new Error(`Unknown resource URI: ${uri}`)
        }

        response.result = {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(resourceData, null, 2),
          }],
        }
        break
      }

      case 'prompts/list': {
        response.result = {
          prompts: [
            {
              name: 'task_summary',
              description: 'Generate a comprehensive summary of current tasks with statistics and insights',
              arguments: [
                {
                  name: 'include_overdue',
                  description: 'Whether to include overdue tasks in the summary',
                  required: false,
                },
                {
                  name: 'include_high_priority',
                  description: 'Whether to include high-priority tasks in the summary',
                  required: false,
                },
              ],
            },
            {
              name: 'task_creation_guide',
              description: 'Best practices and guidelines for creating well-structured tasks',
              arguments: [],
            },
            {
              name: 'overdue_alert',
              description: 'Generate an alert message for overdue tasks that need attention',
              arguments: [],
            },
          ],
        }
        break
      }

      case 'prompts/get': {
        const { name: promptName, arguments: promptArgs = {} } = params

        if (promptName === 'task_summary') {
          const { data: allTasks } = await supabase.from('tasks').select('*')
          const today = new Date().toISOString().split('T')[0]
          const pending = allTasks?.filter((t: any) => ['To Do', 'In Progress'].includes(t.status)) || []
          const overdue = allTasks?.filter((t: any) => t.due_date < today && ['To Do', 'In Progress'].includes(t.status)) || []
          const highPriority = allTasks?.filter((t: any) => ['High', 'Urgent'].includes(t.priority) && ['To Do', 'In Progress'].includes(t.status)) || []

          let summary = `# Task Management Summary\n\n`
          summary += `## Overview\n- **Total Tasks**: ${allTasks?.length || 0}\n- **Pending Tasks**: ${pending.length}\n- **Completed**: ${allTasks?.filter((t: any) => t.status === 'Completed').length || 0}\n\n`

          if (promptArgs.include_overdue !== false && overdue.length > 0) {
            summary += `## ⚠️ Overdue Tasks (${overdue.length})\n\n`
            overdue.slice(0, 5).forEach((task: any) => {
              summary += `- **${task.title}** (Due: ${task.due_date}, Priority: ${task.priority})\n`
            })
            summary += `\n`
          }

          if (promptArgs.include_high_priority !== false && highPriority.length > 0) {
            summary += `## 🔥 High Priority Tasks (${highPriority.length})\n\n`
            highPriority.slice(0, 5).forEach((task: any) => {
              summary += `- **${task.title}** (Priority: ${task.priority}, Due: ${task.due_date || 'Not set'})\n`
            })
            summary += `\n`
          }

          response.result = {
            messages: [{ role: 'user', content: { type: 'text', text: summary } }],
          }
        } else if (promptName === 'task_creation_guide') {
          const guide = `# Task Creation Best Practices\n\n## Essential Components\n\n1. **Clear Title**: Start with action verb, be specific\n2. **Detailed Description**: Context, requirements, links\n3. **Appropriate Priority**: Urgent/High/Medium/Low\n4. **Realistic Due Date**: Consider complexity\n5. **Clear Assignment**: Right person, right skills\n6. **Supporting Docs**: Attach relevant files\n\n## Tips\n- Break down tasks >8 hours\n- Update status regularly\n- Use comments for communication\n- Review and reprioritize weekly`

          response.result = {
            messages: [{ role: 'user', content: { type: 'text', text: guide } }],
          }
        } else if (promptName === 'overdue_alert') {
          const today = new Date().toISOString().split('T')[0]
          const { data: overdueTasks } = await supabase
            .from('tasks')
            .select('*')
            .lt('due_date', today)
            .in('status', ['To Do', 'In Progress'])
            .order('due_date', { ascending: true })

          if (!overdueTasks || overdueTasks.length === 0) {
            response.result = {
              messages: [{ role: 'user', content: { type: 'text', text: '# All Clear!\n\n✅ No overdue tasks.' } }],
            }
          } else {
            let alert = `# ⚠️ Overdue Tasks Alert\n\n${overdueTasks.length} overdue task(s):\n\n`
            overdueTasks.forEach((task: any, i: number) => {
              const daysOverdue = Math.floor((Date.now() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24))
              alert += `${i + 1}. **${task.title}** - ${daysOverdue} days overdue (Priority: ${task.priority})\n`
            })
            response.result = {
              messages: [{ role: 'user', content: { type: 'text', text: alert } }],
            }
          }
        } else {
          throw new Error(`Unknown prompt: ${promptName}`)
        }
        break
      }

      default:
        throw new Error(`Method not found: ${method}`)
    }
  } catch (error) {
    response.error = {
      code: -32603,
      message: error instanceof Error ? error.message : 'Internal error',
    }
    delete response.result
  }

  return response
}

Deno.serve(async (req: Request) => {
  // Log incoming request details for debugging
  console.log('=== MCP Server Request ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)
  console.log('Headers:', Object.fromEntries(req.headers.entries()))

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request - returning CORS headers')
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get or create session ID
    let sessionId = req.headers.get('Mcp-Session-Id')
    if (!sessionId) {
      sessionId = generateSessionId()
    }
    console.log('Session ID:', sessionId)

    // GET request - establish SSE stream (Streamable HTTP)
    if (req.method === 'GET') {
      console.log('GET request - establishing SSE stream')
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()

          // Send initial connection message
          const welcomeMessage: MCPMessage = {
            jsonrpc: '2.0',
            method: 'notifications/message',
            params: {
              level: 'info',
              message: 'MCP Streamable HTTP connection established',
            },
          }

          controller.enqueue(encoder.encode(createSSEMessage(welcomeMessage)))

          // Keep connection alive with heartbeat
          const heartbeat = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(': heartbeat\n\n'))
            } catch {
              clearInterval(heartbeat)
            }
          }, 30000)

          // Store cleanup function
          ;(controller as any).cleanup = () => {
            clearInterval(heartbeat)
          }
        },
        cancel() {
          if ((this as any).cleanup) {
            ;(this as any).cleanup()
          }
        },
      })

      return new Response(stream, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Mcp-Session-Id': sessionId,
        },
      })
    }

    // POST request - handle MCP messages
    if (req.method === 'POST') {
      console.log('POST request - handling MCP messages')
      const contentType = req.headers.get('Content-Type') || ''
      const acceptHeader = req.headers.get('Accept') || ''
      const supportsStreaming = acceptHeader.includes('text/event-stream')
      console.log('Content-Type:', contentType)
      console.log('Accept:', acceptHeader)
      console.log('Supports Streaming:', supportsStreaming)

      // Parse request
      const messages: MCPMessage[] = []

      if (contentType.includes('application/json')) {
        const body = await req.json()
        console.log('Raw body:', JSON.stringify(body))
        // Handle both single message and batch
        if (Array.isArray(body)) {
          messages.push(...body)
        } else {
          messages.push(body)
        }
      } else {
        console.error('Unsupported Content-Type:', contentType)
        throw new Error('Unsupported Content-Type. Expected application/json')
      }

      console.log('Parsed MCP Messages:', JSON.stringify(messages, null, 2))

      // Check if any message is an initialize request
      const hasInitialize = messages.some(msg => msg.method === 'initialize')

      // Per MCP spec: initialize MUST return plain JSON, not SSE stream
      // Only use SSE for subsequent requests if client supports it
      const useStreaming = supportsStreaming && !hasInitialize

      // If client supports streaming AND not initialize, return SSE stream
      if (useStreaming) {
        console.log('Using SSE stream for response')
        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder()

            try {
              for (const message of messages) {
                const response = await handleMCPRequest(message, sessionId!, supabase)
                controller.enqueue(encoder.encode(createSSEMessage(response)))
              }
            } catch (error) {
              const errorMessage: MCPMessage = {
                jsonrpc: '2.0',
                id: messages[0]?.id || 1,
                error: {
                  code: -32603,
                  message: error instanceof Error ? error.message : 'Internal error',
                },
              }
              controller.enqueue(encoder.encode(createSSEMessage(errorMessage)))
            } finally {
              controller.close()
            }
          },
        })

        return new Response(stream, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Mcp-Session-Id': sessionId,
          },
        })
      }

      // Return plain JSON (for initialize or if client doesn't support streaming)
      console.log('Using plain JSON response')
      const responses = []
      for (const message of messages) {
        const response = await handleMCPRequest(message, sessionId, supabase)
        responses.push(response)
      }

      // Return single response or batch
      const responseBody = messages.length === 1 ? responses[0] : responses

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Mcp-Session-Id': sessionId,
        },
      })
    }

    // Unsupported method
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: `Unsupported HTTP method: ${req.method}`,
      },
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })

  } catch (error) {
    console.error('=== MCP Server Error ===')
    console.error('Error:', error)
    console.error('Error type:', typeof error)
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack')

    const errorResponse: MCPMessage = {
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error',
      },
    }

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }
})
