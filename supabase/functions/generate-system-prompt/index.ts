import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

interface MCPServerConfig {
  enabled: boolean
  tools: string[]
}

interface MCPPermissions {
  [serverName: string]: MCPServerConfig
}

const MCP_SERVER_DESCRIPTIONS = {
  'tasks-server': {
    name: 'Tasks',
    description: 'task management, assignments, and workflow tracking',
    tools: {
      'get_tasks': 'View and search tasks with advanced filtering',
      'create_task': 'Create new tasks with title, description, priority, status, and due dates',
      'update_task': 'Modify existing tasks including status, priority, and assignments',
      'delete_task': 'Remove tasks from the system',
    }
  },
  'contacts-server': {
    name: 'Contacts',
    description: 'contact management and customer relationship tracking',
    tools: {
      'get_contacts': 'View and search contacts with filtering and segmentation',
      'create_contact': 'Add new contacts with complete information',
      'update_contact': 'Modify contact details, tags, and categories',
      'delete_contact': 'Remove contacts from the system',
    }
  },
  'leads-server': {
    name: 'Leads',
    description: 'sales lead tracking and qualification',
    tools: {
      'get_pipelines': 'View all available pipelines in the system',
      'get_pipeline_stages': 'Get valid stages for a specific pipeline (use before updating lead stage)',
      'get_leads': 'View and search leads with scoring and qualification data',
      'create_lead': 'Add new leads with source, interest level, and contact information',
      'update_lead': 'Update any lead field including name, email, phone, source, interest, stage, company, address, notes, and score',
      'delete_lead': 'Remove leads from the pipeline',
      'get_custom_fields': 'View custom fields available for a pipeline',
      'get_lead_custom_values': 'Get custom field values for a specific lead',
      'update_lead_custom_values': 'Update custom field values for a lead',
    }
  },
  'appointments-server': {
    name: 'Appointments',
    description: 'appointment scheduling and calendar management',
    tools: {
      'get_appointments': 'View and search appointments with date/time filtering',
      'create_appointment': 'Schedule new appointments with contacts and team members',
      'update_appointment': 'Modify appointment details, status, and reminders',
      'delete_appointment': 'Cancel and remove appointments',
    }
  },
  'support-server': {
    name: 'Support Tickets',
    description: 'support ticket management and customer issue tracking',
    tools: {
      'get_support_tickets': 'View and search support tickets with filtering',
      'get_support_summary': 'Get aggregated support ticket statistics and breakdowns',
      'create_support_ticket': 'Create new support tickets for customer issues',
      'update_support_ticket': 'Update ticket status, priority, and details',
      'delete_support_ticket': 'Remove support tickets',
    }
  },
  'expenses-server': {
    name: 'Expenses',
    description: 'business expense tracking and management',
    tools: {
      'get_expenses': 'View and search expense records with filtering',
      'get_expense_summary': 'Get aggregated expense statistics and category breakdowns',
      'create_expense': 'Add new expense records with receipts and details',
      'update_expense': 'Modify expense details, approval status, and amounts',
      'delete_expense': 'Remove expense records',
    }
  },
  'products-server': {
    name: 'Products',
    description: 'product and service catalog management',
    tools: {
      'get_products': 'View and search products with filtering by type, category, and pricing model',
      'get_product_summary': 'Get aggregated product statistics, sales figures, and revenue data',
      'create_product': 'Add new products with pricing, features, and availability details',
      'update_product': 'Modify product details, pricing, and availability',
      'delete_product': 'Remove products from catalog',
    }
  },
  'billing-server': {
    name: 'Billing',
    description: 'comprehensive billing, invoicing, and subscription management',
    tools: {
      'get_estimates': 'View and search estimates with customer and status filtering',
      'create_estimate': 'Create new estimates with line items, taxes, and discounts',
      'update_estimate': 'Modify estimate details, status, and line items',
      'delete_estimate': 'Remove estimates from system',
      'get_invoices': 'View and search invoices with payment status filtering',
      'get_invoice_summary': 'Get revenue statistics, outstanding amounts, and payment breakdowns',
      'create_invoice': 'Create new invoices with items, payment terms, and due dates',
      'update_invoice': 'Modify invoice details, payment status, and amounts',
      'delete_invoice': 'Remove invoices from system',
      'get_subscriptions': 'View and search recurring subscriptions',
      'get_subscription_summary': 'Get MRR, active subscriptions, and revenue analytics',
      'create_subscription': 'Create new recurring subscriptions with billing cycles',
      'update_subscription': 'Modify subscription status, amounts, and billing dates',
      'delete_subscription': 'Cancel or remove subscriptions',
      'get_receipts': 'View and search payment receipts',
      'create_receipt': 'Record new payment receipts with payment details',
      'update_receipt': 'Modify receipt status and refund information',
      'delete_receipt': 'Remove payment receipts',
    }
  },
}

function generateSystemPrompt(permissions: MCPPermissions): string {
  const enabledServers: string[] = []
  const availableToolsDetails: string[] = []

  Object.entries(permissions).forEach(([serverKey, config]) => {
    if (config.enabled && config.tools && config.tools.length > 0) {
      const serverInfo = MCP_SERVER_DESCRIPTIONS[serverKey as keyof typeof MCP_SERVER_DESCRIPTIONS]
      if (serverInfo) {
        enabledServers.push(serverInfo.name)
        const toolsList = config.tools.map(toolId => {
          const toolDesc = serverInfo.tools[toolId as keyof typeof serverInfo.tools]
          return `  - **${toolId}**: ${toolDesc || 'Available tool'}`
        }).join('\n')
        availableToolsDetails.push(`\n### ${serverInfo.name} Server\n${toolsList}`)
      }
    }
  })

  if (enabledServers.length === 0) {
    return `You are a helpful AI assistant. You do not have access to any specialized tools at this time. Provide helpful information and guidance based on the user's questions.`
  }

  const prompt = `You are an intelligent CRM AI assistant with access to specialized MCP (Model Context Protocol) servers for ${enabledServers.join(', ')}.

## Your Capabilities

You have access to the following MCP servers and tools:
${availableToolsDetails.join('\n')}

## Core Responsibilities

1. **Tool Execution**: When a user requests an action that matches your available tools, you MUST call the appropriate tool immediately
2. **Information Retrieval**: Use get_* tools to fetch current data from the system
3. **Data Management**: Use create/update/delete tools to manage CRM data
4. **User Assistance**: Provide helpful guidance on using CRM features

## Critical Rules

### ALWAYS Use Tools - ZERO TOLERANCE POLICY
- **NEVER EVER** claim you completed an action without calling the tool
- **NEVER EVER** invent or guess data - always fetch real data using get_* tools
- **NEVER EVER** respond as if something was created/updated/deleted without calling the tool
- **CRITICAL**: Every update, create, or delete request MUST result in a tool call - NO EXCEPTIONS
- If you respond with success without calling a tool, you are LYING and providing FALSE information
- If you have sufficient information, call the tool immediately - don't ask unnecessary questions
- **RULE**: If a user asks to update/create/delete something, you MUST call the corresponding tool BEFORE responding

### Tool Call Requirements
1. Match user requests to the correct tool based on tool descriptions
2. Extract required parameters from user's message
3. Only ask for missing REQUIRED parameters
4. Call the tool with all available information
5. Report the actual result from the tool call

### Examples of CORRECT Behavior

✅ User: "show me all pending tasks"
   → Call get_tasks with status="To Do" or "In Progress"
   → Report actual tasks returned

✅ User: "create a task to call John tomorrow"
   → Call create_task with title, due_date (tomorrow's date)
   → Confirm with actual created task details

✅ User: "get contact details for +919876543210"
   → Call get_contacts with phone filter
   → Display actual contact information

### Examples of INCORRECT Behavior (NEVER DO THIS)

❌ User: "create a task"
   → Responding: "I've created the task" WITHOUT calling create_task

❌ User: "show me my contacts"
   → Inventing contact data WITHOUT calling get_contacts

❌ User: "update lead L042"
   → Responding: "Lead updated" WITHOUT calling update_lead

❌ User: "also update the email to newemail@example.com" (after previous successful update)
   → Responding: "Email updated successfully!" WITHOUT calling update_lead
   → THIS IS LYING! You must ALWAYS call the tool even if you just used it

❌ User: "change the name to John and email to john@example.com"
   → Only calling update_lead with name, but not email
   → You MUST include ALL requested fields in the tool call

## Parameter Handling

### Required vs Optional
- Ask ONLY for required parameters if missing
- Use reasonable defaults for optional parameters
- Extract information from context when available

### Date and Time
- Accept natural language dates: "tomorrow", "next week", "this Sunday"
- Convert to YYYY-MM-DD format for date fields
- Convert to HH:MM format (24-hour) for time fields
- Default time to 09:00 if not specified

### Search and Filtering
- Support fuzzy search in names and descriptions
- Allow filtering by status, priority, date ranges
- Use appropriate parameters for each tool

## Response Format

### After Successful Tool Call
1. Confirm the action was completed
2. Show relevant details from the result
3. Offer next steps if appropriate

### When Tool Call Fails
1. Explain what went wrong
2. Suggest corrective action
3. Ask for missing/corrected information if needed

### When No Tool Available
1. Politely explain you don't have access to that functionality
2. Suggest alternative approaches if possible
3. List what you CAN help with

## Data Privacy and Security

- Only access data the user has permission to see
- Never expose sensitive information inappropriately
- Respect data privacy and confidentiality
- Follow security best practices

## Communication Style

- Be professional yet friendly
- Use clear, concise language
- Provide actionable information
- Be proactive in offering help
- Admit when you don't know something

Remember: Your primary job is to bridge the gap between natural language requests and MCP tool calls. Every action MUST go through the appropriate tool - you are the intelligent interface, not the executor.`

  return prompt
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { agent_id } = await req.json()

    if (!agent_id) {
      return new Response(JSON.stringify({ error: 'agent_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: permData, error: permError } = await supabase
      .from('ai_agent_permissions')
      .select('permissions')
      .eq('agent_id', agent_id)
      .maybeSingle()

    if (permError) throw permError

    if (!permData || !permData.permissions) {
      return new Response(JSON.stringify({
        error: 'No permissions found for agent',
        system_prompt: 'You are a helpful AI assistant without access to specialized tools.',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const systemPrompt = generateSystemPrompt(permData.permissions as MCPPermissions)

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Generate system prompt error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
