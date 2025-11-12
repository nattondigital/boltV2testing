import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

interface LeadPayload {
  phone: string
  pipeline_id?: string
  name?: string
  email?: string
  source?: string
  interest?: string
  stage?: string
  contact_id?: string
  owner?: string
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

    if (!payload.phone) {
      return new Response(
        JSON.stringify({
          error: 'Missing required field: phone',
          required: ['phone'],
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

    const { data: existingLead, error: checkError } = await supabase
      .from('leads')
      .select('*')
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

    let leadData
    let operationType

    if (existingLead) {
      const updateData: any = {}

      if (payload.name !== undefined) updateData.name = payload.name
      if (payload.email !== undefined) updateData.email = payload.email
      if (payload.source !== undefined) updateData.source = payload.source
      if (payload.interest !== undefined) updateData.interest = payload.interest
      if (payload.stage !== undefined) updateData.stage = payload.stage
      if (payload.owner !== undefined) updateData.owner = payload.owner
      if (payload.address !== undefined) updateData.address = payload.address
      if (payload.company !== undefined) updateData.company = payload.company
      if (payload.notes !== undefined) updateData.notes = payload.notes
      if (payload.lead_score !== undefined) updateData.lead_score = payload.lead_score
      if (payload.affiliate_id !== undefined) updateData.affiliate_id = payload.affiliate_id

      if (payload.pipeline_id !== undefined) {
        const { data: pipeline } = await supabase
          .from('pipelines')
          .select('id')
          .eq('id', payload.pipeline_id)
          .maybeSingle()

        if (pipeline) {
          updateData.pipeline_id = pipeline.id
        } else {
          return new Response(
            JSON.stringify({
              error: 'Invalid pipeline_id',
              details: 'Pipeline not found with the provided UUID',
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
      }

      if (payload.contact_id !== undefined) {
        const { data: contact } = await supabase
          .from('contacts_master')
          .select('id')
          .eq('contact_id', payload.contact_id)
          .maybeSingle()

        updateData.contact_id = contact?.id || null
      }

      if (payload.assigned_to !== undefined) {
        const { data: teamMember } = await supabase
          .from('admin_users')
          .select('id')
          .eq('phone', payload.assigned_to)
          .maybeSingle()

        updateData.assigned_to = teamMember?.id || null
      }

      updateData.updated_at = new Date().toISOString()

      const { data: updatedLead, error: updateError } = await supabase
        .from('leads')
        .update(updateData)
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

      if (payload.custom_fields && Object.keys(payload.custom_fields).length > 0) {
        await upsertCustomFields(supabase, updatedLead.id, updatedLead.pipeline_id, payload.custom_fields)
      }
    } else {
      if (!payload.pipeline_id) {
        return new Response(
          JSON.stringify({
            error: 'Missing required field for new lead',
            required: ['phone', 'pipeline_id'],
            message: 'For new leads, both phone and pipeline_id are required',
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

      const { data: pipeline } = await supabase
        .from('pipelines')
        .select('id')
        .eq('id', payload.pipeline_id)
        .maybeSingle()

      if (!pipeline) {
        return new Response(
          JSON.stringify({
            error: 'Invalid pipeline_id',
            details: 'Pipeline not found with the provided UUID',
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

      const pipelineUuid = pipeline.id

      let stageToUse = payload.stage

      if (!stageToUse) {
        const { data: firstStage } = await supabase
          .from('pipeline_stages')
          .select('name')
          .eq('pipeline_id', pipelineUuid)
          .order('display_order', { ascending: true })
          .limit(1)
          .maybeSingle()

        stageToUse = firstStage?.name || 'New'
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

      const leadName = payload.name || payload.phone

      const { data: newLead, error: insertError } = await supabase
        .from('leads')
        .insert({
          name: leadName,
          phone: payload.phone,
          email: payload.email || null,
          source: payload.source || 'Website',
          interest: payload.interest || 'Warm',
          stage: stageToUse,
          pipeline_id: pipelineUuid,
          contact_id: contactUuid,
          owner: payload.owner || 'Sales Team',
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

      if (payload.custom_fields && Object.keys(payload.custom_fields).length > 0) {
        await upsertCustomFields(supabase, newLead.id, pipelineUuid, payload.custom_fields)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Lead ${operationType} successfully`,
        operation: operationType,
        data: leadData,
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
