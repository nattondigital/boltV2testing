import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

interface MCPRequest {
  method: string
  params?: {
    name?: string
    uri?: string
    arguments?: Record<string, any>
  }
}

interface MCPResponse {
  jsonrpc: string
  id: string | number
  result?: any
  error?: {
    code: number
    message: string
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const mcpRequest: MCPRequest = await req.json()

    console.log('MCP Request:', JSON.stringify(mcpRequest, null, 2))

    const { method, params } = mcpRequest

    let response: MCPResponse = {
      jsonrpc: '2.0',
      id: (mcpRequest as any).id || 1,
    }

    switch (method) {
      case 'initialize':
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

      case 'tools/list':
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
                  contact_id: {
                    type: 'string',
                    description: 'UUID of related contact',
                  },
                  due_date: {
                    type: 'string',
                    description: 'Due date (YYYY-MM-DD)',
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

      case 'tools/call':
        const toolName = params?.name
        const args = params?.arguments || {}

        // Get agent_id from args
        const agentId = args.agent_id
        if (!agentId) {
          response.error = {
            code: -32602,
            message: 'agent_id is required in arguments',
          }
          break
        }

        // Check permissions
        const { data: permData } = await supabase
          .from('ai_agent_permissions')
          .select('permissions')
          .eq('agent_id', agentId)
          .maybeSingle()

        const permissions = permData?.permissions || {}

        switch (toolName) {
          case 'get_tasks':
            if (!permissions['Tasks']?.can_view) {
              response.result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: 'Agent does not have permission to view tasks',
                  }),
                }],
              }
              break
            }

            let query = supabase.from('tasks').select('*')

            if (args.task_id) {
              query = query.eq('task_id', args.task_id)
            }
            if (args.status) {
              query = query.eq('status', args.status)
            }
            if (args.priority) {
              query = query.eq('priority', args.priority)
            }

            query = query.limit(args.limit || 100).order('created_at', { ascending: false })

            const { data: tasks, error: tasksError } = await query

            // Log action
            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              module: 'Tasks',
              action: 'get_tasks',
              result: tasksError ? 'Error' : 'Success',
              error_message: tasksError?.message || null,
              user_context: 'MCP Server HTTP',
              details: { filters: args, count: tasks?.length || 0 },
            })

            if (tasksError) {
              response.result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: tasksError.message,
                  }),
                }],
              }
            } else {
              response.result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    data: tasks,
                    count: tasks.length,
                  }, null, 2),
                }],
              }
            }
            break

          case 'create_task':
            if (!permissions['Tasks']?.can_create) {
              response.result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: 'Agent does not have permission to create tasks',
                  }),
                }],
              }
              break
            }

            const newTask = {
              title: args.title,
              description: args.description || '',
              status: args.status || 'To Do',
              priority: args.priority || 'Medium',
              assigned_to: args.assigned_to || null,
              contact_id: args.contact_id || null,
              due_date: args.due_date || null,
              assigned_by: agentId,
            }

            const { data: createdTask, error: createError } = await supabase
              .from('tasks')
              .insert(newTask)
              .select()
              .single()

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              module: 'Tasks',
              action: 'create_task',
              result: createError ? 'Error' : 'Success',
              error_message: createError?.message || null,
              user_context: 'MCP Server HTTP',
              details: { task: newTask },
            })

            if (createError) {
              response.result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: createError.message,
                  }),
                }],
              }
            } else {
              response.result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    data: createdTask,
                    message: `Task created successfully with ID: ${createdTask.task_id}`,
                  }, null, 2),
                }],
              }
            }
            break

          case 'update_task':
            if (!permissions['Tasks']?.can_edit) {
              response.result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: 'Agent does not have permission to update tasks',
                  }),
                }],
              }
              break
            }

            const updates: any = {}
            if (args.title) updates.title = args.title
            if (args.description !== undefined) updates.description = args.description
            if (args.status) updates.status = args.status
            if (args.priority) updates.priority = args.priority
            if (args.assigned_to !== undefined) updates.assigned_to = args.assigned_to
            if (args.due_date !== undefined) updates.due_date = args.due_date

            const { data: updatedTask, error: updateError } = await supabase
              .from('tasks')
              .update(updates)
              .eq('task_id', args.task_id)
              .select()
              .single()

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              module: 'Tasks',
              action: 'update_task',
              result: updateError ? 'Error' : 'Success',
              error_message: updateError?.message || null,
              user_context: 'MCP Server HTTP',
              details: { task_id: args.task_id, updates },
            })

            if (updateError) {
              response.result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: updateError.message,
                  }),
                }],
              }
            } else {
              response.result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    data: updatedTask,
                    message: `Task ${args.task_id} updated successfully`,
                  }, null, 2),
                }],
              }
            }
            break

          case 'delete_task':
            if (!permissions['Tasks']?.can_delete) {
              response.result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: 'Agent does not have permission to delete tasks',
                  }),
                }],
              }
              break
            }

            const { error: deleteError } = await supabase
              .from('tasks')
              .delete()
              .eq('task_id', args.task_id)

            await supabase.from('ai_agent_logs').insert({
              agent_id: agentId,
              module: 'Tasks',
              action: 'delete_task',
              result: deleteError ? 'Error' : 'Success',
              error_message: deleteError?.message || null,
              user_context: 'MCP Server HTTP',
              details: { task_id: args.task_id },
            })

            if (deleteError) {
              response.result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: deleteError.message,
                  }),
                }],
              }
            } else {
              response.result = {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: `Task ${args.task_id} deleted successfully`,
                  }, null, 2),
                }],
              }
            }
            break

          default:
            response.error = {
              code: -32601,
              message: `Tool not found: ${toolName}`,
            }
        }
        break

      case 'resources/list':
        response.result = {
          resources: [
            {
              uri: 'task://tasks/all',
              name: 'All Tasks',
              mimeType: 'application/json',
              description: 'Complete list of all tasks',
            },
            {
              uri: 'task://tasks/pending',
              name: 'Pending Tasks',
              mimeType: 'application/json',
              description: 'Tasks with status To Do or In Progress',
            },
          ],
        }
        break

      case 'prompts/list':
        response.result = {
          prompts: [
            {
              name: 'task_summary',
              description: 'Generate a summary of tasks',
            },
          ],
        }
        break

      default:
        response.error = {
          code: -32601,
          message: `Method not found: ${method}`,
        }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('MCP Server Error:', error)
    const errorResponse: MCPResponse = {
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
