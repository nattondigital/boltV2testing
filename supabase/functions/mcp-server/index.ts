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
        const clientInfo = params?.clientInfo
        const agentId = clientInfo?.agentId || params?.agentId

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
              description: 'Tasks with status \"To Do\" or \"In Progress\"',
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
              description: 'Tasks with priority \"High\" or \"Urgent\"',
              mimeType: 'application/json',
            },
            {
              uri: 'tasks://statistics',
              name: 'Task Statistics',
              description: 'Aggregated statistics about tasks (counts by status, priority, overdue, etc.)',
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

        if (uri === 'tasks://statistics') {
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
              description: 'Provides a comprehensive summary of tasks including pending, overdue, and completed',
              arguments: [],
            },
            {
              name: 'task_creation_guide',
              description: 'Best practices and guidelines for creating well-structured tasks',
              arguments: [],
            },
            {
              name: 'task_prioritization',
              description: 'Recommendations for prioritizing and organizing tasks',
              arguments: [
                {
                  name: 'user_context',
                  description: 'Information about the user or team to personalize recommendations',
                  required: false,
                },
              ],
            },
            {
              name: 'overdue_alert',
              description: 'Generate an alert message for overdue tasks that need attention',
              arguments: [],
            },
            {
              name: 'get_task_by_id',
              description: 'Instructions for retrieving a specific task by its task_id (e.g., TASK-10031)',
              arguments: [
                {
                  name: 'task_id',
                  description: 'The task ID to retrieve (e.g., TASK-10031)',
                  required: true,
                },
              ],
            },
          ],
        }
        break
      }

      case 'prompts/get': {
        const { name, arguments: args = {} } = params

        if (!name) {
          throw new Error('prompt name is required')
        }

        if (name === 'task_summary') {
          const { data: allTasks } = await supabase.from('tasks').select('*')

          const today = new Date().toISOString().split('T')[0]
          const pending = allTasks?.filter((t: any) => t.status === 'To Do' || t.status === 'In Progress') || []
          const overdue = allTasks?.filter((t: any) => t.due_date < today && (t.status === 'To Do' || t.status === 'In Progress')) || []
          const completed = allTasks?.filter((t: any) => t.status === 'Completed') || []

          let summary = `# Task Summary Report\n\n`
          summary += `**Total Tasks:** ${allTasks?.length || 0}\n\n`
          summary += `## Status Breakdown\n`
          summary += `- ✅ Completed: ${completed.length}\n`
          summary += `- 🚧 Pending: ${pending.length}\n`
          summary += `- ⚠️ Overdue: ${overdue.length}\n\n`

          if (overdue.length > 0) {
            summary += `## ⚠️ Overdue Tasks (Immediate Attention)\n`
            overdue.forEach((task: any) => {
              summary += `- **${task.title}** (${task.priority}) - Due: ${task.due_date}\n`
            })
            summary += `\n`
          }

          if (pending.length > 0) {
            summary += `## 🚧 Pending Tasks\n`
            pending.slice(0, 10).forEach((task: any) => {
              summary += `- **${task.title}** (${task.status}) - Priority: ${task.priority}\n`
            })
            if (pending.length > 10) {
              summary += `\n_... and ${pending.length - 10} more pending tasks_\n`
            }
          }

          response.result = {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: summary,
                },
              },
            ],
          }
        } else if (name === 'task_creation_guide') {
          const guide = `# Task Creation Guide\n\n## Best Practices\n\n1. **Clear Title**: Use descriptive, action-oriented titles\n   - Good: \"Review Q1 financial report\"\n   - Bad: \"Financial stuff\"\n\n2. **Detailed Description**: Include context, requirements, and success criteria\n\n3. **Priority Setting**:\n   - Urgent: Must be done today\n   - High: Important, should be done this week\n   - Medium: Regular priority\n   - Low: Nice to have\n\n4. **Due Dates**: Set realistic deadlines considering complexity\n\n5. **Assignment**: Assign to the most appropriate team member\n\n6. **Status Updates**: Keep tasks current\n   - To Do: Not started\n   - In Progress: Actively working\n   - Completed: Finished\n   - Cancelled: No longer needed\n\n## Example Task\n\n**Title:** Review and approve Q1 marketing budget\n**Description:** Review the proposed Q1 marketing budget, verify alignment with strategic goals, and approve or request revisions. Include feedback on specific line items.\n**Priority:** High\n**Due Date:** Next Friday\n**Assigned To:** Marketing Director`

          response.result = {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: guide,
                },
              },
            ],
          }
        } else if (name === 'task_prioritization') {
          const context = args.user_context ? `\n\nUser Context: ${args.user_context}\n` : ''

          const prioritization = `# Task Prioritization Guidelines${context}\n\n## Priority Matrix\n\n### 1. Urgent + Important (Do First)\n- Tasks with imminent deadlines\n- Critical business operations\n- Customer-facing issues\n\n### 2. Important + Not Urgent (Schedule)\n- Strategic planning\n- Relationship building\n- Professional development\n\n### 3. Urgent + Not Important (Delegate)\n- Some meetings\n- Many emails\n- Routine tasks that others can handle\n\n### 4. Not Urgent + Not Important (Eliminate)\n- Time wasters\n- Unnecessary activities\n- Busy work\n\n## Practical Tips\n\n1. **Start with High-Priority Tasks**\n   - Begin each day with your most important task\n   - Don't let urgent-but-unimportant tasks hijack your day\n\n2. **Use the 2-Minute Rule**\n   - If it takes less than 2 minutes, do it now\n   - Otherwise, schedule or delegate it\n\n3. **Batch Similar Tasks**\n   - Group similar activities together\n   - Reduces context switching\n   - Increases efficiency\n\n4. **Review Regularly**\n   - Daily: Review today's tasks\n   - Weekly: Plan the week ahead\n   - Monthly: Adjust long-term priorities`

          response.result = {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: prioritization,
                },
              },
            ],
          }
        } else if (name === 'overdue_alert') {
          const today = new Date().toISOString().split('T')[0]
          const { data: overdueTasks } = await supabase
            .from('tasks')
            .select('*')
            .lt('due_date', today)
            .in('status', ['To Do', 'In Progress'])
            .order('due_date', { ascending: true })

          if (!overdueTasks || overdueTasks.length === 0) {
            response.result = {
              messages: [
                {
                  role: 'user',
                  content: {
                    type: 'text',
                    text: '# Task Status: All Clear!\n\n✅ Great news! You have no overdue tasks at the moment.\n\nKeep up the excellent work on staying on top of your deadlines!',
                  },
                },
              ],
            }
          } else {
            let alert = `# ⚠️ Overdue Tasks Alert\n\n`
            alert += `You have **${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}** that need immediate attention:\n\n`

            overdueTasks.forEach((task: any, index: number) => {
              const daysOverdue = Math.floor((new Date().getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24))
              alert += `${index + 1}. **${task.title}**\n`
              alert += `   - Priority: ${task.priority}\n`
              alert += `   - Due Date: ${task.due_date} (${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue)\n`
              alert += `   - Status: ${task.status}\n`
              if (task.assigned_to_name) {
                alert += `   - Assigned to: ${task.assigned_to_name}\n`
              }
              alert += `\n`
            })

            alert += `## Recommended Actions\n\n`
            alert += `1. Review each overdue task and update status if completed\n`
            alert += `2. For active tasks, assess if deadlines need adjustment\n`
            alert += `3. Prioritize overdue high-priority items immediately\n`
            alert += `4. Consider reassigning tasks if assignees are overloaded\n`
            alert += `5. Break down large overdue tasks into smaller, manageable pieces\n`

            response.result = {
              messages: [
                {
                  role: 'user',
                  content: {
                    type: 'text',
                    text: alert,
                  },
                },
              ],
            }
          }
        } else if (name === 'get_task_by_id') {
          const taskId = args.task_id
          if (!taskId) {
            response.result = {
              messages: [
                {
                  role: 'user',
                  content: {
                    type: 'text',
                    text: '# How to Retrieve a Task by ID\n\nTo get details of a specific task, use the `get_tasks` tool with the `task_id` parameter:\n\n```json\n{\n  \"task_id\": \"TASK-10031\"\n}\n```\n\nThis will return the complete task details including:\n- Task title and description\n- Status and priority\n- Assigned user and contact information\n- Due dates and progress\n- Supporting documents',
                  },
                },
              ],
            }
          } else {
            const { data: tasks } = await supabase
              .from('tasks')
              .select('*')
              .eq('task_id', taskId)

            if (!tasks || tasks.length === 0) {
              response.result = {
                messages: [
                  {
                    role: 'user',
                    content: {
                      type: 'text',
                      text: `# Task Not Found\n\nTask **${taskId}** was not found in the system.\n\nPlease verify the task ID and try again.`,
                    },
                  },
                ],
              }
            } else {
              const task = tasks[0]
              let details = `# Task Details: ${task.task_id}\n\n`
              details += `## ${task.title}\n\n`

              if (task.description) {
                details += `**Description:** ${task.description}\n\n`
              }

              details += `### Status & Priority\n`
              details += `- **Status:** ${task.status}\n`
              details += `- **Priority:** ${task.priority}\n`
              details += `- **Progress:** ${task.progress_percentage}%\n\n`

              details += `### Assignment\n`
              details += `- **Assigned to:** ${task.assigned_to_name || 'Unassigned'}\n`
              details += `- **Assigned by:** ${task.assigned_by_name || 'N/A'}\n\n`

              if (task.contact_phone || task.contact_name) {
                details += `### Contact\n`
                if (task.contact_name) {
                  details += `- **Name:** ${task.contact_name}\n`
                }
                if (task.contact_phone) {
                  details += `- **Phone:** ${task.contact_phone}\n`
                }
                details += `\n`
              }

              if (task.due_date) {
                details += `### Dates\n`
                details += `- **Due:** ${task.due_date}\n`
                details += `- **Created:** ${task.created_at}\n\n`
              }

              if (task.supporting_documents && task.supporting_documents.length > 0) {
                details += `### Supporting Documents\n`
                task.supporting_documents.forEach((doc: string) => {
                  details += `- ${doc}\n`
                })
              }

              response.result = {
                messages: [
                  {
                    role: 'user',
                    content: {
                      type: 'text',
                      text: details,
                    },
                  },
                ],
              }
            }
          }
        } else {
          throw new Error(`Unknown prompt: ${name}`)
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
                    description: 'Name of assigned team member (e.g., \"Amit\", \"Prince\")',
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
                  phone_number: {
                    type: 'string',
                    description: 'User phone number for logging',
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
                  due_date: {
                    type: 'string',
                    description: 'Due date (YYYY-MM-DD format)',
                  },
                  due_time: {
                    type: 'string',
                    description: 'Due time (HH:MM format, 24-hour)',
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
                    description: 'Task ID to delete (e.g., TASK-10031)',
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

        const taskPerms = permissions.permissions?.Tasks || {}

        switch (name) {
          case 'get_tasks': {
            try {
              if (!taskPerms.can_view) {
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
                    text: JSON.stringify(data, null, 2),
                  },
                ],
              }
            } catch (error) {
              throw error
            }
            break
          }

          case 'create_task': {
            try {
              if (!taskPerms.can_create) {
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
            } catch (error) {
              throw error
            }
            break
          }

          case 'update_task': {
            try {
              if (!taskPerms.can_edit) {
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
                    text: JSON.stringify({ success: true, message: 'Task updated successfully', task: data }),
                  },
                ],
              }
            } catch (error) {
              throw error
            }
            break
          }

          case 'delete_task': {
            try {
              if (!taskPerms.can_delete) {
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
                    text: JSON.stringify({ success: true, message: 'Task deleted successfully', task_id: args.task_id }),
                  },
                ],
              }
            } catch (error) {
              throw error
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
    console.error('MCP Server Error:', error)
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
