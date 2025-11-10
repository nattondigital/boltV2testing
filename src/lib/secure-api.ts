import { supabase, getUserPhone } from './supabase'

interface SecureApiResponse<T = any> {
  data?: T
  error?: string
  code?: string
  success?: boolean
  message?: string
}

async function callSecureFunction<T>(
  functionName: string,
  params: Record<string, any>
): Promise<SecureApiResponse<T>> {
  const userPhone = getUserPhone()

  if (!userPhone) {
    return {
      error: 'Not authenticated',
      code: 'NOT_AUTHENTICATED'
    }
  }

  try {
    const { data, error } = await supabase.rpc(functionName, {
      user_phone: userPhone,
      ...params
    })

    if (error) {
      console.error(`Error calling ${functionName}:`, error)
      return {
        error: error.message,
        code: 'RPC_ERROR'
      }
    }

    if (data && typeof data === 'object' && 'error' in data) {
      return data as SecureApiResponse<T>
    }

    return { data }
  } catch (err) {
    console.error(`Exception calling ${functionName}:`, err)
    return {
      error: err instanceof Error ? err.message : 'Unknown error',
      code: 'EXCEPTION'
    }
  }
}

export const SecureExpenseAPI = {
  create: async (expenseData: any) => {
    return callSecureFunction('secure_create_expense', {
      expense_data: expenseData
    })
  },

  update: async (expenseId: string, expenseData: any) => {
    return callSecureFunction('secure_update_expense', {
      expense_id: expenseId,
      expense_data: expenseData
    })
  },

  delete: async (expenseId: string) => {
    return callSecureFunction('secure_delete_expense', {
      expense_id: expenseId
    })
  }
}

export const SecureLeaveAPI = {
  create: async (leaveData: any) => {
    return callSecureFunction('secure_create_leave_request', {
      leave_data: leaveData
    })
  },

  update: async (leaveId: string, leaveData: any) => {
    return callSecureFunction('secure_update_leave_request', {
      leave_id: leaveId,
      leave_data: leaveData
    })
  },

  delete: async (leaveId: string) => {
    return callSecureFunction('secure_delete_leave_request', {
      leave_id: leaveId
    })
  }
}

export const SecureTaskAPI = {
  create: async (taskData: any) => {
    return callSecureFunction('secure_create_task', {
      task_data: taskData
    })
  },

  update: async (taskId: string, taskData: any) => {
    return callSecureFunction('secure_update_task', {
      task_id: taskId,
      task_data: taskData
    })
  },

  delete: async (taskId: string) => {
    return callSecureFunction('secure_delete_task', {
      task_id: taskId
    })
  }
}

export function isPermissionError(response: SecureApiResponse): boolean {
  return response.code === 'PERMISSION_DENIED'
}

export function handleSecureApiError(response: SecureApiResponse): void {
  if (response.error) {
    if (isPermissionError(response)) {
      alert('Permission Denied: ' + response.error)
    } else {
      alert('Error: ' + response.error)
    }
  }
}
