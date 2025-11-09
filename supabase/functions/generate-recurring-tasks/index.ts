import { createClient } from 'npm:@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

interface RecurringTask {
  id: string
  title: string
  description: string
  contact_id: string | null
  assigned_to: string | null
  priority: string
  recurrence_type: 'daily' | 'weekly' | 'monthly'
  start_time: string
  start_days: string[] | null
  start_day_of_month: number | null
  due_time: string
  due_days: string[] | null
  due_day_of_month: number | null
  supporting_docs: any
  category?: string
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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get current date in IST
    const now = new Date()
    const currentDayOfWeek = now.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()
    const currentDayOfMonth = now.getDate()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()

    // Fetch all active recurring tasks
    const { data: recurringTasks, error: fetchError } = await supabase
      .from('recurring_tasks')
      .select('*')
      .eq('is_active', true)

    if (fetchError) {
      throw fetchError
    }

    const tasksCreated: any[] = []
    const errors: any[] = []

    for (const task of recurringTasks as RecurringTask[]) {
      try {
        let shouldCreateTask = false
        let startDateTime: Date | null = null
        let dueDateTime: Date | null = null

        if (task.recurrence_type === 'daily') {
          // For daily tasks, create if we're at or past the start time
          const [startHour, startMinute] = task.start_time.split(':').map(Number)
          const [dueHour, dueMinute] = task.due_time.split(':').map(Number)

          if (currentHour === startHour && currentMinute === startMinute) {
            shouldCreateTask = true

            startDateTime = new Date(now)
            startDateTime.setHours(startHour, startMinute, 0, 0)

            dueDateTime = new Date(now)
            dueDateTime.setHours(dueHour, dueMinute, 0, 0)
          }
        } else if (task.recurrence_type === 'weekly') {
          // For weekly tasks, check if today is a start day
          const startDays = task.start_days || []
          const dueDays = task.due_days || []

          if (startDays.includes(currentDayOfWeek)) {
            const [startHour, startMinute] = task.start_time.split(':').map(Number)

            if (currentHour === startHour && currentMinute === startMinute) {
              shouldCreateTask = true

              startDateTime = new Date(now)
              startDateTime.setHours(startHour, startMinute, 0, 0)

              // Calculate due date
              const [dueHour, dueMinute] = task.due_time.split(':').map(Number)
              dueDateTime = new Date(now)

              // Find the next due day
              const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
              const currentDayIndex = daysOfWeek.indexOf(currentDayOfWeek)

              // Find the closest due day
              let daysToAdd = 0
              for (const dueDay of dueDays) {
                const dueDayIndex = daysOfWeek.indexOf(dueDay)
                let diff = dueDayIndex - currentDayIndex
                if (diff < 0) diff += 7
                if (daysToAdd === 0 || diff < daysToAdd) {
                  daysToAdd = diff
                }
              }

              dueDateTime.setDate(dueDateTime.getDate() + daysToAdd)
              dueDateTime.setHours(dueHour, dueMinute, 0, 0)
            }
          }
        } else if (task.recurrence_type === 'monthly') {
          // For monthly tasks, check if today is the start day
          let startDay = task.start_day_of_month
          let dueDay = task.due_day_of_month

          // Handle "last day of month" (0 means last day)
          if (startDay === 0) {
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
            startDay = lastDay
          }

          if (currentDayOfMonth === startDay) {
            const [startHour, startMinute] = task.start_time.split(':').map(Number)

            if (currentHour === startHour && currentMinute === startMinute) {
              shouldCreateTask = true

              startDateTime = new Date(now)
              startDateTime.setHours(startHour, startMinute, 0, 0)

              // Calculate due date
              const [dueHour, dueMinute] = task.due_time.split(':').map(Number)
              dueDateTime = new Date(now)

              if (dueDay === 0) {
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
                dueDay = lastDay
              }

              dueDateTime.setDate(dueDay!)
              dueDateTime.setHours(dueHour, dueMinute, 0, 0)

              // If due day is before start day, it's in the next month
              if (dueDay! < startDay!) {
                dueDateTime.setMonth(dueDateTime.getMonth() + 1)
              }
            }
          }
        }

        if (shouldCreateTask && startDateTime && dueDateTime) {
          // Check if a task already exists for this recurring task today
          const startOfDay = new Date(now)
          startOfDay.setHours(0, 0, 0, 0)
          const endOfDay = new Date(now)
          endOfDay.setHours(23, 59, 59, 999)

          const { data: existingTasks } = await supabase
            .from('tasks')
            .select('id')
            .eq('title', task.title)
            .gte('start_date', startOfDay.toISOString())
            .lte('start_date', endOfDay.toISOString())

          if (existingTasks && existingTasks.length > 0) {
            continue // Skip if task already exists today
          }

          // Create the task
          const newTask = {
            title: task.title,
            description: task.description,
            contact_id: task.contact_id,
            assigned_to: task.assigned_to,
            priority: task.priority.charAt(0).toUpperCase() + task.priority.slice(1),
            status: 'To Do',
            category: task.category || 'Other',
            start_date: startDateTime.toISOString(),
            due_date: dueDateTime.toISOString(),
            supporting_documents: Array.isArray(task.supporting_docs) ? task.supporting_docs : [],
            progress_percentage: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }

          const { data: createdTask, error: createError } = await supabase
            .from('tasks')
            .insert([newTask])
            .select()
            .single()

          if (createError) {
            errors.push({
              recurringTaskId: task.id,
              error: createError.message
            })
          } else {
            tasksCreated.push({
              recurringTaskId: task.id,
              taskId: createdTask.id,
              title: task.title
            })
          }
        }
      } catch (err) {
        errors.push({
          recurringTaskId: task.id,
          error: err.message
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tasksCreated: tasksCreated.length,
        tasks: tasksCreated,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString()
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    console.error('Error generating recurring tasks:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
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
