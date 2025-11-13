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

        console.log('MCP Tasks Server session initialized', { sessionId, agentId })

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
              description: 'Aggregated statistics about tasks',
              mimeType: 'application/json',
            },
            {
              uri: 'tasks://recurring',
              name: 'Recurring Tasks',
              description: 'All recurring task templates',
              mimeType: 'application/json',
            },
            {
              uri: 'tasks://recurring-active',
              name: 'Active Recurring Tasks',
              description: 'Active recurring task templates',
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

        if (uri === 'tasks://recurring' || uri === 'tasks://recurring-active') {
          let query = supabase.from('recurring_tasks').select('*')

          if (uri === 'tasks://recurring-active') {
            query = query.eq('is_active', true)
          }

          const { data, error } = await query.order('created_at', { ascending: false })

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
        } else if (uri === 'tasks://statistics') {
          const { data: allTasks, error: allError } = await supabase.from('tasks').select('*')
          if (allError) throw allError

          const today = new Date().toISOString().split('T')[0]
          const stats = {
            total: allTasks?.length || 0,
            by_status: {
              'To Do': allTasks?.filter((t: any) => t.status === 'To Do').length || 0,
              'In Progress': allTasks?.filter((t: any) => t.status === 'In Progress').length || 0,
              'Completed': allTasks?.filter((t: any) => t.status === 'Completed').length || 0,
              'Cancelled': allTasks?.filter((t: any) => t.status === 'Cancelled').length || 0,
            },
            by_priority: {
              'Low': allTasks?.filter((t: any) => t.priority === 'Low').length || 0,
              'Medium': allTasks?.filter((t: any) => t.priority === 'Medium').length || 0,
              'High': allTasks?.filter((t: any) => t.priority === 'High').length || 0,
              'Urgent': allTasks?.filter((t: any) => t.priority === 'Urgent').length || 0,
            },
            pending: allTasks?.filter((t: any) => t.status === 'To Do' || t.status === 'In Progress').length || 0,
            completed: allTasks?.filter((t: any) => t.status === 'Completed').length || 0,
            overdue: allTasks?.filter((t: any) => t.due_date && t.due_date < today && (t.status === 'To Do' || t.status === 'In Progress')).length || 0,
            high_priority: allTasks?.filter((t: any) => t.priority === 'High' || t.priority === 'Urgent').length || 0,
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
          let query = supabase.from('tasks').select('*')

          if (uri === 'tasks://pending') {
            query = query.in('status', ['To Do', 'In Progress'])
          } else if (uri === 'tasks://overdue') {
            const today = new Date().toISOString().split('T')[0]
            query = query
              .lt('due_date', today)
              .in('status', ['To Do', 'In Progress'])
          } else if (uri === 'tasks://high-priority') {
            query = query.in('priority', ['High', 'Urgent'])
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
              name: 'task_summary',
              description: 'Provides a comprehensive summary of tasks',
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
              name: 'get_tasks',
              description: 'Retrieve tasks with advanced filtering. Use task_id to get a specific task.',
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
                    description: 'Maximum number of tasks to return (default: 100)',
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
                  phone_number: {
                    type: 'string',
                    description: 'User phone number for logging',
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
                    description: 'Name of assigned team member',
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
                    description: 'Due time in UTC (HH:MM format, 24-hour). MUST be UTC, not IST. Example: 10 AM IST = 04:30 UTC',
                  },
                  supporting_docs: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of document URLs',
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
                  phone_number: {
                    type: 'string',
                    description: 'User phone number for logging',
                  },
                  task_id: {
                    type: 'string',
                    description: 'Task ID to update',
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
                  due_date: {
                    type: 'string',
                    description: 'Due date (YYYY-MM-DD format)',
                  },
                  due_time: {
                    type: 'string',
                    description: 'Due time in UTC (HH:MM format). MUST be UTC, not IST. Example: 3 PM IST = 09:30 UTC',
                  },
                },
                required: ['task_id'],
              },
            },
            {
              name: 'delete_task',
              description: 'Delete a task by task_id',
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
                  task_id: {
                    type: 'string',
                    description: 'Task ID to delete',
                  },
                },
                required: ['task_id'],
              },
            },
            {
              name: 'get_recurring_tasks',
              description: 'Retrieve recurring tasks with filtering. Use recurrence_task_id to get a specific recurring task.',
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
                  recurrence_task_id: {
                    type: 'string',
                    description: 'Get a specific recurring task by its ID (e.g., RETASK-0001)',
                  },
                  is_active: {
                    type: 'boolean',
                    description: 'Filter by active status',
                  },
                  recurrence_type: {
                    type: 'string',
                    enum: ['daily', 'weekly', 'monthly'],
                    description: 'Filter by recurrence type',
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum number of recurring tasks to return (default: 100)',
                  },
                },
              },
            },
            {
              name: 'create_recurring_task',
              description: 'Create a new recurring task template',
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
                  assigned_to: {
                    type: 'string',
                    description: 'UUID of assigned team member',
                  },
                  contact_id: {
                    type: 'string',
                    description: 'UUID of related contact',
                  },
                  recurrence_type: {
                    type: 'string',
                    enum: ['daily', 'weekly', 'monthly'],
                    description: 'Recurrence pattern type',
                  },
                  start_time: {
                    type: 'string',
                    description: 'Start time (HH:MM format, 24-hour)',
                  },
                  start_days: {
                    type: 'array',
                    items: { type: 'integer', minimum: 0, maximum: 6 },
                    description: 'Days of week for start (0=Sunday, 6=Saturday). Required for weekly tasks.',
                  },
                  start_day_of_month: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 31,
                    description: 'Day of month for start (1-31). Required for monthly tasks.',
                  },
                  due_time: {
                    type: 'string',
                    description: 'Due time in UTC (HH:MM format, 24-hour). MUST be UTC, not IST. Example: 9 AM IST = 03:30 UTC',
                  },
                  due_days: {
                    type: 'array',
                    items: { type: 'integer', minimum: 0, maximum: 6 },
                    description: 'Days of week for due (0=Sunday, 6=Saturday). Required for weekly tasks.',
                  },
                  due_day_of_month: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 31,
                    description: 'Day of month for due (1-31). Required for monthly tasks.',
                  },
                  supporting_docs: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of document URLs',
                  },
                },
                required: ['title', 'recurrence_type', 'start_time', 'due_time'],
              },
            },
            {
              name: 'update_recurring_task',
              description: 'Update an existing recurring task template',
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
                  recurrence_task_id: {
                    type: 'string',
                    description: 'Recurring task ID to update',
                  },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  priority: {
                    type: 'string',
                    enum: ['Low', 'Medium', 'High', 'Urgent'],
                  },
                  assigned_to: { type: 'string' },
                  is_active: { type: 'boolean' },
                  start_time: { type: 'string', description: 'Start time in UTC (HH:MM). MUST be UTC, not IST' },
                  due_time: { type: 'string', description: 'Due time in UTC (HH:MM). MUST be UTC, not IST' },
                  start_days: {
                    type: 'array',
                    items: { type: 'integer' },
                  },
                  due_days: {
                    type: 'array',
                    items: { type: 'integer' },
                  },
                },
                required: ['recurrence_task_id'],
              },
            },
            {
              name: 'delete_recurring_task',
              description: 'Delete a recurring task template by recurrence_task_id',
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
                  recurrence_task_id: {
                    type: 'string',
                    description: 'Recurring task ID to delete',
                  },
                },
                required: ['recurrence_task_id'],
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
        const tasksServerPerms = allPermissions['tasks-server'] || { enabled: false, tools: [] }
        const enabledTools = tasksServerPerms.tools || []

        switch (name) {
          case 'get_tasks': {
            if (!enabledTools.includes('get_tasks')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Tasks',
                action: 'get_tasks',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to view tasks' },
              })
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

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Tasks',
                action: 'get_tasks',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Tasks',
              action: 'get_tasks',
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

          case 'create_task': {
            if (!enabledTools.includes('create_task')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Tasks',
                action: 'create_task',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to create tasks' },
              })
              throw new Error('Agent does not have permission to create tasks')
            }

            let dueDateTimestamp = null
            if (args.due_date) {
              if (args.due_time) {
                dueDateTimestamp = `${args.due_date}T${args.due_time}:00`
              } else {
                dueDateTimestamp = `${args.due_date}T00:00:00`
              }
            }

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

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Tasks',
                action: 'create_task',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, task_data: args },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Tasks',
              action: 'create_task',
              result: 'Success',
              user_context: args.phone_number || null,
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
            if (!enabledTools.includes('update_task')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Tasks',
                action: 'update_task',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to edit tasks' },
              })
              throw new Error('Agent does not have permission to edit tasks')
            }

            const { task_id, due_time, ...updates } = args
            delete updates.agent_id
            delete updates.phone_number

            if (args.due_date || due_time) {
              let dueDateTimestamp = null
              if (args.due_date) {
                if (due_time) {
                  dueDateTimestamp = `${args.due_date}T${due_time}:00`
                } else {
                  dueDateTimestamp = `${args.due_date}T00:00:00`
                }
                updates.due_date = dueDateTimestamp
              }
            }

            const { data, error } = await supabase
              .from('tasks')
              .update(updates)
              .eq('task_id', task_id)
              .select()
              .single()

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Tasks',
                action: 'update_task',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, task_id, updates },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Tasks',
              action: 'update_task',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { task_id, updates },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, message: 'Task updated successfully', task: data }, null, 2),
                },
              ],
            }
            break
          }

          case 'delete_task': {
            if (!enabledTools.includes('delete_task')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Tasks',
                action: 'delete_task',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to delete tasks' },
              })
              throw new Error('Agent does not have permission to delete tasks')
            }

            const { error } = await supabase
              .from('tasks')
              .delete()
              .eq('task_id', args.task_id)

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Tasks',
                action: 'delete_task',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, task_id: args.task_id },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Tasks',
              action: 'delete_task',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { task_id: args.task_id },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, message: 'Task deleted successfully', task_id: args.task_id }, null, 2),
                },
              ],
            }
            break
          }

          case 'get_recurring_tasks': {
            if (!enabledTools.includes('get_recurring_tasks')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Tasks',
                action: 'get_recurring_tasks',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to view recurring tasks' },
              })
              throw new Error('Agent does not have permission to view recurring tasks')
            }

            let query = supabase
              .from('recurring_tasks')
              .select('*')
              .order('created_at', { ascending: false })

            if (args.recurrence_task_id) {
              query = query.eq('recurrence_task_id', args.recurrence_task_id)
            }
            if (args.is_active !== undefined) {
              query = query.eq('is_active', args.is_active)
            }
            if (args.recurrence_type) {
              query = query.eq('recurrence_type', args.recurrence_type)
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
                module: 'Tasks',
                action: 'get_recurring_tasks',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Tasks',
              action: 'get_recurring_tasks',
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

          case 'create_recurring_task': {
            if (!enabledTools.includes('create_recurring_task')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Tasks',
                action: 'create_recurring_task',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to create recurring tasks' },
              })
              throw new Error('Agent does not have permission to create recurring tasks')
            }

            const taskData: any = {
              title: args.title,
              description: args.description || null,
              priority: args.priority || 'Medium',
              assigned_to: args.assigned_to || null,
              contact_id: args.contact_id || null,
              recurrence_type: args.recurrence_type,
              start_time: args.start_time,
              due_time: args.due_time,
              start_days: args.start_days || null,
              start_day_of_month: args.start_day_of_month || null,
              due_days: args.due_days || null,
              due_day_of_month: args.due_day_of_month || null,
              supporting_docs: args.supporting_docs ? JSON.stringify(args.supporting_docs) : null,
              is_active: true,
            }

            const { data, error } = await supabase
              .from('recurring_tasks')
              .insert(taskData)
              .select()
              .single()

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Tasks',
                action: 'create_recurring_task',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, task_data: args },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Tasks',
              action: 'create_recurring_task',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { recurrence_task_id: data.recurrence_task_id, title: args.title },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: 'Recurring task created successfully',
                    recurring_task: data
                  }, null, 2),
                },
              ],
            }
            break
          }

          case 'update_recurring_task': {
            if (!enabledTools.includes('update_recurring_task')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Tasks',
                action: 'update_recurring_task',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to edit recurring tasks' },
              })
              throw new Error('Agent does not have permission to edit recurring tasks')
            }

            const { recurrence_task_id, ...updates } = args
            delete updates.agent_id
            delete updates.phone_number

            const { data, error } = await supabase
              .from('recurring_tasks')
              .update(updates)
              .eq('recurrence_task_id', recurrence_task_id)
              .select()
              .single()

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Tasks',
                action: 'update_recurring_task',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, recurrence_task_id, updates },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Tasks',
              action: 'update_recurring_task',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { recurrence_task_id, updates },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, message: 'Recurring task updated successfully', recurring_task: data }, null, 2),
                },
              ],
            }
            break
          }

          case 'delete_recurring_task': {
            if (!enabledTools.includes('delete_recurring_task')) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Tasks',
                action: 'delete_recurring_task',
                result: 'Denied',
                user_context: args.phone_number || null,
                details: { reason: 'No permission to delete recurring tasks' },
              })
              throw new Error('Agent does not have permission to delete recurring tasks')
            }

            const { error } = await supabase
              .from('recurring_tasks')
              .delete()
              .eq('recurrence_task_id', args.recurrence_task_id)

            if (error) {
              await supabase.from('ai_agent_logs').insert({
                agent_id: agentId,
                agent_name: agentName,
                module: 'Tasks',
                action: 'delete_recurring_task',
                result: 'Error',
                user_context: args.phone_number || null,
                details: { error: error.message, recurrence_task_id: args.recurrence_task_id },
              })
              throw error
            }

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              agent_name: agentName,
              module: 'Tasks',
              action: 'delete_recurring_task',
              result: 'Success',
              user_context: args.phone_number || null,
              details: { recurrence_task_id: args.recurrence_task_id },
            })

            response.result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, message: 'Recurring task deleted successfully', recurrence_task_id: args.recurrence_task_id }, null, 2),
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
    console.error('MCP Tasks Server Error:', error)
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
