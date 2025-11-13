import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

interface UpdateExpensePayload {
  expense_id: string
  admin_user_id?: string
  category?: string
  amount?: number
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

    const payload: UpdateExpensePayload = await req.json()

    if (!payload.expense_id) {
      return new Response(
        JSON.stringify({
          error: 'Missing required field',
          required: ['expense_id'],
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

    if (payload.category) {
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

    if (payload.amount !== undefined && payload.amount <= 0) {
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

    const { data: existingExpense, error: checkError } = await supabase
      .from('expenses')
      .select('id, expense_id')
      .eq('expense_id', payload.expense_id)
      .maybeSingle()

    if (checkError) {
      console.error('Error checking existing expense:', checkError)
      return new Response(
        JSON.stringify({ error: 'Failed to check existing expense', details: checkError.message }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    if (!existingExpense) {
      return new Response(
        JSON.stringify({
          error: 'Expense not found',
          expense_id: payload.expense_id,
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

    if (payload.admin_user_id) {
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

    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (payload.admin_user_id !== undefined) updateData.admin_user_id = payload.admin_user_id
    if (payload.category !== undefined) updateData.category = payload.category
    if (payload.amount !== undefined) updateData.amount = payload.amount
    if (payload.currency !== undefined) updateData.currency = payload.currency
    if (payload.description !== undefined) updateData.description = payload.description
    if (payload.expense_date !== undefined) updateData.expense_date = payload.expense_date
    if (payload.payment_method !== undefined) updateData.payment_method = payload.payment_method
    if (payload.receipt_url !== undefined) updateData.receipt_url = payload.receipt_url
    if (payload.status !== undefined) updateData.status = payload.status
    if (payload.approved_by !== undefined) {
      updateData.approved_by = payload.approved_by
      if (payload.status === 'Approved') {
        updateData.approved_at = new Date().toISOString()
      }
    }

    const { data: updatedExpense, error: updateError } = await supabase
      .from('expenses')
      .update(updateData)
      .eq('expense_id', payload.expense_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating expense:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update expense', details: updateError.message }),
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
        message: 'Expense updated successfully',
        data: updatedExpense,
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
