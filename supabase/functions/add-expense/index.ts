import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

interface ExpensePayload {
  admin_user_id: string
  category: string
  amount: number
  currency?: string
  description?: string
  expense_date?: string
  payment_method?: string
  receipt_url?: string
  status?: string
  approved_by?: string
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

    const payload: ExpensePayload = await req.json()

    if (!payload.admin_user_id || !payload.category || !payload.amount) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          required: ['admin_user_id', 'category', 'amount'],
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

    if (payload.status) {
      const validStatuses = ['Pending', 'Approved', 'Rejected', 'Paid']
      if (!validStatuses.includes(payload.status)) {
        return new Response(
          JSON.stringify({
            error: 'Invalid status',
            valid_values: validStatuses,
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

    const validCategories = ['Travel', 'Office Supplies', 'Marketing', 'Software', 'Meals', 'Entertainment', 'Training', 'Other']
    if (!validCategories.includes(payload.category)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid category',
          valid_values: validCategories,
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

    if (payload.payment_method) {
      const validPaymentMethods = ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Digital Wallet', 'Other']
      if (!validPaymentMethods.includes(payload.payment_method)) {
        return new Response(
          JSON.stringify({
            error: 'Invalid payment_method',
            valid_values: validPaymentMethods,
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

    if (payload.amount <= 0) {
      return new Response(
        JSON.stringify({
          error: 'Invalid amount',
          message: 'Amount must be greater than 0',
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

    const { data: adminUser, error: adminUserError } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', payload.admin_user_id)
      .maybeSingle()

    if (!adminUser || adminUserError) {
      return new Response(
        JSON.stringify({
          error: 'Invalid admin_user_id',
          message: 'User ID not found in admin_users table',
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

    if (payload.approved_by) {
      const { data: approver, error: approverError } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', payload.approved_by)
        .maybeSingle()

      if (!approver || approverError) {
        return new Response(
          JSON.stringify({
            error: 'Invalid approved_by',
            message: 'User ID not found in admin_users table',
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

    const insertData: any = {
      admin_user_id: payload.admin_user_id,
      category: payload.category,
      amount: payload.amount,
      currency: payload.currency || 'USD',
      description: payload.description || null,
      expense_date: payload.expense_date || new Date().toISOString().split('T')[0],
      payment_method: payload.payment_method || 'Cash',
      receipt_url: payload.receipt_url || null,
      status: payload.status || 'Pending',
      approved_by: payload.approved_by || null,
      approved_at: payload.approved_by && payload.status === 'Approved' ? new Date().toISOString() : null,
    }

    const { data: newExpense, error: insertError } = await supabase
      .from('expenses')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting expense:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to create expense', details: insertError.message }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Expense created successfully',
        data: newExpense,
      }),
      {
        status: 201,
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
