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

    let aiResponse: string

    try {
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
        aiResponse = `Hello! I'm ${agent.name}. I'm currently in setup mode. To enable full AI functionality, please configure OpenRouter integration in Settings > Integrations.`
      } else {
        const messages = [
          {
            role: 'system',
            content: agent.system_prompt
          },
          ...conversationMessages
        ]

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': supabaseUrl,
            'X-Title': 'CRM AI Agent'
          },
          body: JSON.stringify({
            model: agent.model,
            messages: messages,
          })
        })

        if (!response.ok) {
          const errorData = await response.text()
          console.error('OpenRouter API error:', errorData)
          aiResponse = `I apologize, but I encountered an error connecting to my AI service. Please try again later.`
        } else {
          const data = await response.json()
          aiResponse = data.choices[0].message.content
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
