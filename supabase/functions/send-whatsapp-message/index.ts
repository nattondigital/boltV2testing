import { createClient } from 'npm:@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

interface WhatsAppMessageRequest {
  trigger_event: string
  contact_phone: string
  contact_name?: string
  trigger_data?: Record<string, any>
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { trigger_event, contact_phone, contact_name, trigger_data } = await req.json() as WhatsAppMessageRequest

    if (!trigger_event || !contact_phone) {
      throw new Error('trigger_event and contact_phone are required')
    }

    // Get the followup assignment for this trigger event
    const { data: assignment, error: assignmentError } = await supabase
      .from('followup_assignments')
      .select('whatsapp_template_id')
      .eq('trigger_event', trigger_event)
      .maybeSingle()

    if (assignmentError) {
      throw new Error(`Failed to get followup assignment: ${assignmentError.message}`)
    }

    // If no assignment or no template assigned, skip sending
    if (!assignment || !assignment.whatsapp_template_id) {
      return new Response(
        JSON.stringify({ success: true, message: 'No WhatsApp template assigned for this trigger event' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the WhatsApp template
    const { data: template, error: templateError } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('id', assignment.whatsapp_template_id)
      .maybeSingle()

    if (templateError || !template) {
      throw new Error('WhatsApp template not found')
    }

    // Get WhatsApp Business API credentials from integrations
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('config')
      .eq('integration_type', 'whatsapp')
      .maybeSingle()

    if (integrationError || !integration) {
      throw new Error('WhatsApp integration not configured')
    }

    const config = integration.config as { apiKey?: string; wabaNumber?: string }
    const apiKey = config.apiKey
    const senderNumber = config.wabaNumber

    if (!apiKey || !senderNumber) {
      throw new Error('WhatsApp API key or WABA number not configured')
    }

    // Send the WhatsApp message based on template type
    let messageBody: any
    let endpoint = 'https://public.doubletick.io/whatsapp/message/text'

    if (template.type === 'Text') {
      // Replace placeholders in message with trigger data
      let messageText = template.message || ''
      if (trigger_data) {
        messageText = replacePlaceholders(messageText, trigger_data)
      }
      if (contact_name) {
        messageText = messageText.replace(/\{\{contact_name\}\}/g, contact_name)
      }

      messageBody = {
        to: contact_phone,
        from: senderNumber,
        content: {
          text: messageText
        }
      }
    } else if (['Audio', 'Video', 'Image', 'Document'].includes(template.type)) {
      // For media messages
      messageBody = {
        to: contact_phone,
        from: senderNumber,
        messageId: crypto.randomUUID(),
        content: {
          mediaUrl: template.media_url || '',
          caption: template.message || ''
        }
      }
      
      // Use appropriate endpoint based on type
      const typeMap: Record<string, string> = {
        'Audio': 'audio',
        'Video': 'video',
        'Image': 'image',
        'Document': 'document'
      }
      endpoint = `https://public.doubletick.io/whatsapp/message/${typeMap[template.type]}`
    } else {
      throw new Error(`Unsupported template type: ${template.type}`)
    }

    // Send to DoubleTick API
    const requestHeaders = {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(messageBody)
    })

    const responseText = await response.text()
    const responseHeaders = Object.fromEntries(response.headers.entries())

    // Log the API request and response
    await supabase.from('whatsapp_api_logs').insert({
      trigger_event,
      contact_phone,
      contact_name,
      template_id: template.id,
      template_name: template.name,
      template_type: template.type,
      api_endpoint: endpoint,
      request_payload: messageBody,
      request_headers: { 'Authorization': '***REDACTED***', 'Content-Type': 'application/json' },
      response_status: response.status,
      response_body: responseText,
      response_headers: responseHeaders,
      success: response.ok,
      error_message: response.ok ? null : `HTTP ${response.status}: ${responseText}`
    })

    if (!response.ok) {
      throw new Error(`DoubleTick API error: ${response.status} ${responseText}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'WhatsApp message sent successfully',
        template_name: template.name,
        template_type: template.type,
        response: responseText
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('WhatsApp message error:', error)

    // Log the error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)

      const body = await req.json().catch(() => ({})) as WhatsAppMessageRequest

      await supabase.from('whatsapp_api_logs').insert({
        trigger_event: body.trigger_event || 'UNKNOWN',
        contact_phone: body.contact_phone || 'UNKNOWN',
        contact_name: body.contact_name,
        api_endpoint: 'N/A',
        request_payload: body,
        success: false,
        error_message: error.message,
        error_details: { stack: error.stack, name: error.name }
      })
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function replacePlaceholders(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? String(data[key]) : match
  })
}
