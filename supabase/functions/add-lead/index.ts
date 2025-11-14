import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

interface LeadPayload {
  name: string
  phone: string
  pipeline_id: string
  email?: string
  source?: string
  interest?: string
  stage?: string
  contact_id?: string
  address?: string
  company?: string
  notes?: string
  lead_score?: number
  affiliate_id?: string
  assigned_to?: string
  custom_fields?: Record<string, any>
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

    const payload: LeadPayload = await req.json()

    if (!payload.name || !payload.phone || !payload.pipeline_id) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          required: ['name', 'phone', 'pipeline_id'],
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

    // Extract custom fields from the payload (any field starting with "custom_")
    const customFields: Record<string, any> = {}
    const rawPayload = payload as any
    for (const key in rawPayload) {
      if (key.startsWith('custom_')) {
        customFields[key] = rawPayload[key]
      }
    }

    // Merge with explicit custom_fields if provided
    if (payload.custom_fields) {
      Object.assign(customFields, payload.custom_fields)
    }

    const { data: existingLead, error: checkError } = await supabase
      .from('leads')
      .select('id, phone, lead_id')
      .eq('phone', payload.phone)
      .maybeSingle()

    if (checkError) {
      console.error('Error checking existing lead:', checkError)
      return new Response(
        JSON.stringify({ error: 'Failed to check existing lead', details: checkError.message }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    let pipelineUuid = null
    if (payload.pipeline_id) {
      const { data: pipeline } = await supabase
        .from('pipelines')
        .select('id')
        .eq('pipeline_id', payload.pipeline_id)
        .maybeSingle()

      pipelineUuid = pipeline?.id || null
    }

    if (!pipelineUuid) {
      return new Response(
        JSON.stringify({
          error: 'Invalid pipeline_id',
          details: 'Pipeline not found with the provided pipeline_id',
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

    let contactUuid = null
    if (payload.contact_id) {
      const { data: contact } = await supabase
        .from('contacts_master')
        .select('id')
        .eq('contact_id', payload.contact_id)
        .maybeSingle()

      contactUuid = contact?.id || null
    }

    let assignedToUuid = null
    if (payload.assigned_to) {
      const { data: teamMember } = await supabase
        .from('admin_users')
        .select('id')
        .eq('phone', payload.assigned_to)
        .maybeSingle()

      assignedToUuid = teamMember?.id || null
    }

    // Get the first stage for the pipeline if no stage is provided
    let stageToUse = payload.stage
    if (!stageToUse) {
      const { data: firstStage } = await supabase
        .from('pipeline_stages')
        .select('stage_id')
        .eq('pipeline_id', pipelineUuid)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .limit(1)
        .maybeSingle()

      stageToUse = firstStage?.stage_id || 'new'
    }

    let leadData
    let operationType

    if (existingLead) {
      const { data: updatedLead, error: updateError } = await supabase
        .from('leads')
        .update({
          name: payload.name,
          email: payload.email || null,
          source: payload.source || 'Website',
          interest: payload.interest || 'Warm',
          stage: stageToUse,
          pipeline_id: pipelineUuid,
          contact_id: contactUuid,
          address: payload.address || null,
          company: payload.company || null,
          notes: payload.notes || null,
          lead_score: payload.lead_score || 50,
          affiliate_id: payload.affiliate_id || null,
          assigned_to: assignedToUuid,
          updated_at: new Date().toISOString(),
        })
        .eq('phone', payload.phone)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating lead:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update lead', details: updateError.message }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        )
      }

      leadData = updatedLead
      operationType = 'updated'

      if (Object.keys(customFields).length > 0) {
        await upsertCustomFields(supabase, updatedLead.id, pipelineUuid, customFields)
      }
    } else {
      const { data: newLead, error: insertError } = await supabase
        .from('leads')
        .insert({
          name: payload.name,
          phone: payload.phone,
          email: payload.email || null,
          source: payload.source || 'Website',
          interest: payload.interest || 'Warm',
          stage: stageToUse,
          pipeline_id: pipelineUuid,
          contact_id: contactUuid,
          address: payload.address || null,
          company: payload.company || null,
          notes: payload.notes || null,
          lead_score: payload.lead_score || 50,
          affiliate_id: payload.affiliate_id || null,
          assigned_to: assignedToUuid,
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error inserting lead:', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to add lead', details: insertError.message }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        )
      }

      leadData = newLead
      operationType = 'created'

      if (Object.keys(customFields).length > 0) {
        await upsertCustomFields(supabase, newLead.id, pipelineUuid, customFields)
      }
    }

    // Fetch custom field values to include in the response
    let customFieldValues: Record<string, any> = {}
    if (Object.keys(customFields).length > 0) {
      const { data: fieldValues } = await supabase
        .from('custom_field_values')
        .select('custom_field_id, field_value, custom_fields(field_key, field_name)')
        .eq('lead_id', leadData.id)

      if (fieldValues && fieldValues.length > 0) {
        fieldValues.forEach((fv: any) => {
          if (fv.custom_fields) {
            customFieldValues[fv.custom_fields.field_key] = fv.field_value
          }
        })
      }
    }

    const responseData = {
      ...leadData,
      custom_fields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined
    }

    const n8nWebhookUrl = 'https://n8n.srv825961.hstgr.cloud/webhook/b9306df2-26cc-447e-abb4-b2cfe8e1acdd'

    try {
      await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(responseData),
      })
      console.log('Successfully sent lead to n8n webhook')
    } catch (n8nError) {
      console.error('Error sending to n8n webhook:', n8nError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Lead ${operationType} successfully`,
        operation: operationType,
        data: responseData,
      }),
      {
        status: operationType === 'created' ? 201 : 200,
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

async function upsertCustomFields(
  supabase: any,
  leadId: string,
  pipelineId: string,
  customFields: Record<string, any>
): Promise<void> {
  try {
    const { data: allCustomFields, error: fieldsError } = await supabase
      .from('custom_fields')
      .select('id, field_key, field_type, custom_tab_id')
      .eq('is_active', true)

    if (fieldsError) {
      console.error('Error fetching custom fields:', fieldsError)
      return
    }

    const { data: tabs, error: tabsError } = await supabase
      .from('custom_lead_tabs')
      .select('id, pipeline_id')
      .eq('pipeline_id', pipelineId)

    if (tabsError) {
      console.error('Error fetching tabs:', tabsError)
      return
    }

    const tabIds = tabs?.map((tab: any) => tab.id) || []
    const pipelineCustomFields = allCustomFields?.filter((field: any) =>
      tabIds.includes(field.custom_tab_id)
    ) || []

    const fieldKeyToIdMap: Record<string, { id: string; type: string }> = {}
    pipelineCustomFields.forEach((field: any) => {
      fieldKeyToIdMap[field.field_key] = {
        id: field.id,
        type: field.field_type,
      }
    })

    for (const [fieldKey, fieldValue] of Object.entries(customFields)) {
      const fieldInfo = fieldKeyToIdMap[fieldKey]

      if (!fieldInfo) {
        console.warn(`Custom field with key "${fieldKey}" not found for this pipeline`)
        continue
      }

      let formattedValue: string

      switch (fieldInfo.type) {
        case 'dropdown_multiple':
          formattedValue = Array.isArray(fieldValue)
            ? fieldValue.join(',')
            : String(fieldValue)
          break

        case 'file_upload':
          formattedValue = Array.isArray(fieldValue)
            ? fieldValue.join(',')
            : String(fieldValue)
          break

        case 'number':
        case 'currency':
          formattedValue = String(fieldValue)
          break

        case 'date':
          formattedValue = String(fieldValue)
          break

        case 'checkbox':
          formattedValue = fieldValue === true || fieldValue === 'true' ? 'true' : 'false'
          break

        case 'range':
          formattedValue = String(fieldValue)
          break

        default:
          formattedValue = String(fieldValue)
      }

      const { data: existingValue } = await supabase
        .from('custom_field_values')
        .select('id')
        .eq('custom_field_id', fieldInfo.id)
        .eq('lead_id', leadId)
        .maybeSingle()

      if (existingValue) {
        await supabase
          .from('custom_field_values')
          .update({
            field_value: formattedValue,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingValue.id)
      } else {
        await supabase
          .from('custom_field_values')
          .insert({
            custom_field_id: fieldInfo.id,
            lead_id: leadId,
            field_value: formattedValue,
          })
      }
    }

    console.log(`Successfully upserted custom fields for lead ${leadId}`)
  } catch (error) {
    console.error('Error upserting custom fields:', error)
  }
}
