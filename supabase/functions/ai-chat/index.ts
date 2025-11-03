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
      .maybeSingle()

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({
          error: 'AI Agent not found',
          agent_id: payload.agent_id,
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    if (agent.status !== 'Active') {
      return new Response(
        JSON.stringify({
          error: 'AI Agent is not active',
          agent_name: agent.name,
          status: agent.status,
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    const { error: userMessageError } = await supabase
      .from('ai_agent_chat_memory')
      .insert({
        agent_id: payload.agent_id,
        phone_number: payload.phone_number,
        message: payload.message,
        role: 'user',
        user_context: 'External',
        action: 'Chat',
        result: 'Success',
        module: 'General',
        metadata: {
          user_context: payload.user_context || null,
          timestamp: new Date().toISOString(),
        },
      })

    if (userMessageError) {
      console.error('Error saving user message:', userMessageError)
      return new Response(
        JSON.stringify({
          error: 'Failed to save user message',
          details: userMessageError.message
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

    const { data: chatHistory, error: historyError } = await supabase
      .from('ai_agent_chat_memory')
      .select('*')
      .eq('phone_number', payload.phone_number)
      .order('created_at', { ascending: true })
      .limit(100)

    if (historyError) {
      console.error('Error fetching chat history:', historyError)
    }

    const conversationMessages = chatHistory
      ? chatHistory.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.message
        }))
      : []

    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('config')
      .eq('integration_type', 'openrouter')
      .eq('status', 'Connected')
      .maybeSingle()

    if (integrationError) {
      console.error('Error fetching OpenRouter integration:', integrationError)
    }

    const openRouterApiKey = integration?.config?.apiKey

    if (!openRouterApiKey) {
      const setupResponse = `Hello! I'm ${agent.name}. I'm currently in setup mode. To enable full AI functionality, please configure OpenRouter integration in Settings > Integrations.`

      const { error: assistantMessageError } = await supabase
        .from('ai_agent_chat_memory')
        .insert({
          agent_id: payload.agent_id,
          phone_number: payload.phone_number,
          message: setupResponse,
          role: 'assistant',
          user_context: 'External',
          action: 'Chat',
          result: 'Success',
          module: 'General',
          metadata: {
            model: agent.model,
            timestamp: new Date().toISOString(),
          },
        })

      if (assistantMessageError) {
        console.error('Error saving assistant message:', assistantMessageError)
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Chat message processed successfully',
          data: {
            agent_name: agent.name,
            agent_model: agent.model,
            user_message: payload.message,
            assistant_response: setupResponse,
            phone_number: payload.phone_number,
            timestamp: new Date().toISOString(),
          },
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    const { data: permData } = await supabase
      .from('ai_agent_permissions')
      .select('permissions')
      .eq('agent_id', payload.agent_id)
      .maybeSingle()

    const permissions = permData?.permissions || {}
    const tools: any[] = []

    if (permissions['Expenses']?.can_create) {
      tools.push({
        type: 'function',
        function: {
          name: 'create_expense',
          description: 'Create a new expense entry in the CRM',
          parameters: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'Description of the expense' },
              amount: { type: 'number', description: 'Amount of the expense' },
              category: { type: 'string', description: 'Category of the expense (e.g., Marketing, Software, Travel, Food, Transportation). If not specified in the request, infer from the description (e.g., "flight" -> Travel, "lunch" -> Food)' },
              date: { type: 'string', description: 'Date of expense in YYYY-MM-DD format' }
            },
            required: ['description', 'amount']
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
              title: { type: 'string', description: 'Title of the task' },
              description: { type: 'string', description: 'Detailed description of the task' },
              due_date: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
              priority: { type: 'string', enum: ['Low', 'Medium', 'High'], description: 'Priority level of the task' }
            },
            required: ['title']
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
              name: { type: 'string', description: 'Name of the lead' },
              phone: { type: 'string', description: 'Phone number of the lead' },
              email: { type: 'string', description: 'Email address of the lead' },
              company: { type: 'string', description: 'Company name' },
              interest: { type: 'string', enum: ['Hot', 'Warm', 'Cold'], description: 'Interest level of the lead' },
              source: { type: 'string', description: 'Source of the lead (e.g., Website, Referral, Phone)' }
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

    const enhancedSystemPrompt = `${agent.system_prompt}\n\nYou have access to CRM tools. When a user asks you to perform actions like creating expenses, tasks, or retrieving data, use the available tools to execute those actions. Always use tools when appropriate instead of just describing what you would do.`

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
          'Authorization': `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': supabaseUrl,
          'X-Title': 'CRM AI Agent'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('OpenRouter API error:', errorData)
        aiResponse = `I apologize, but I encountered an error connecting to my AI service. Please try again later.`
      } else {
        const data = await response.json()
        const message = data.choices[0]?.message

        if (message.tool_calls && message.tool_calls.length > 0) {
          const toolResults: string[] = []

          for (const toolCall of message.tool_calls) {
            const functionName = toolCall.function.name
            const functionArgs = JSON.parse(toolCall.function.arguments)

            if (functionName === 'create_expense') {
              const { error: expenseError } = await supabase
                .from('expenses')
                .insert({
                  description: functionArgs.description,
                  amount: functionArgs.amount,
                  category: functionArgs.category || 'Other',
                  expense_date: functionArgs.date || new Date().toISOString().split('T')[0],
                  status: 'Pending'
                })

              if (expenseError) {
                toolResults.push(`❌ Failed to create expense: ${expenseError.message}`)
              } else {
                toolResults.push(`✅ Expense created: ${functionArgs.description} for ₹${functionArgs.amount} (Category: ${functionArgs.category || 'Other'})`)
              }
            } else if (functionName === 'create_task') {
              const { error: taskError } = await supabase
                .from('tasks')
                .insert({
                  title: functionArgs.title,
                  description: functionArgs.description,
                  due_date: functionArgs.due_date,
                  priority: functionArgs.priority || 'Medium',
                  status: 'Pending'
                })

              if (taskError) {
                toolResults.push(`❌ Failed to create task: ${taskError.message}`)
              } else {
                toolResults.push(`✅ Task created: ${functionArgs.title}`)
              }
            } else if (functionName === 'create_lead') {
              const { data: pipelines, error: pipelineError } = await supabase
                .from('pipelines')
                .select('id, name, is_default')

              if (pipelineError) {
                toolResults.push(`❌ Failed to create lead: ${pipelineError.message}`)
                continue
              }

              const pipelineId = pipelines?.find(p => p.is_default)?.id || pipelines?.[0]?.id

              const { data: stages, error: stageError } = await supabase
                .from('pipeline_stages')
                .select('stage_id')
                .eq('pipeline_id', pipelineId)
                .order('display_order', { ascending: true })
                .limit(1)

              if (stageError) {
                toolResults.push(`❌ Failed to create lead: ${stageError.message}`)
                continue
              }

              const firstStageId = stages?.[0]?.stage_id || 'new_lead'

              const { error: leadError } = await supabase
                .from('leads')
                .insert({
                  name: functionArgs.name,
                  phone: functionArgs.phone,
                  email: functionArgs.email,
                  company: functionArgs.company,
                  pipeline_id: pipelineId,
                  stage: firstStageId,
                  interest: functionArgs.interest || 'Warm',
                  source: functionArgs.source || 'Manual Entry'
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
            }
          }

          const finalResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openRouterApiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': supabaseUrl,
              'X-Title': 'CRM AI Agent'
            },
            body: JSON.stringify({
              model: agent.model,
              messages: [
                { role: 'system', content: enhancedSystemPrompt },
                ...conversationMessages,
                message,
                { role: 'tool', content: toolResults.join('\n') }
              ]
            })
          })

          if (finalResponse.ok) {
            const finalData = await finalResponse.json()
            aiResponse = finalData.choices[0]?.message?.content || toolResults.join('\n')
          } else {
            aiResponse = toolResults.join('\n')
          }
        } else {
          aiResponse = message.content
        }
      }
    } catch (error) {
      console.error('Error calling AI API:', error)
      aiResponse = `I apologize, but I encountered an error processing your message. Please try again.`
    }

    const { data: assistantMessage, error: assistantMessageError } = await supabase
      .from('ai_agent_chat_memory')
      .insert({
        agent_id: payload.agent_id,
        phone_number: payload.phone_number,
        message: aiResponse,
        role: 'assistant',
        user_context: 'External',
        action: 'Chat',
        result: aiResponse.includes('error') || aiResponse.includes('Error') ? 'Error' : 'Success',
        module: 'General',
        metadata: {
          model: agent.model,
          timestamp: new Date().toISOString(),
        },
      })
      .select()
      .single()

    if (assistantMessageError) {
      console.error('Error saving assistant message:', assistantMessageError)
      return new Response(
        JSON.stringify({
          error: 'Failed to save assistant message',
          details: assistantMessageError.message
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

    const { error: updateActivityError } = await supabase
      .from('ai_agents')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', payload.agent_id)

    if (updateActivityError) {
      console.error('Error updating agent activity:', updateActivityError)
    }

    const { error: logError } = await supabase
      .from('ai_agent_logs')
      .insert({
        agent_id: payload.agent_id,
        agent_name: agent.name,
        module: 'General',
        action: 'Chat',
        result: aiResponse.includes('error') || aiResponse.includes('Error') ? 'Error' : 'Success',
        user_context: 'External - ' + payload.phone_number,
        details: {
          phone_number: payload.phone_number,
          user_message: payload.message,
          agent_response: aiResponse.substring(0, 200),
          response_length: aiResponse.length,
          chat_history_length: chatHistory?.length || 0,
        },
      })

    if (logError) {
      console.error('Error logging chat activity:', logError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Chat message processed successfully',
        data: {
          agent_name: agent.name,
          agent_model: agent.model,
          user_message: payload.message,
          assistant_response: aiResponse,
          phone_number: payload.phone_number,
          message_id: assistantMessage.id,
          timestamp: assistantMessage.created_at,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
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
})
