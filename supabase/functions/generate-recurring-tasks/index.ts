import { createClient } from 'npm:@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

interface RecurringTask {
  id: string
  recurrence_task_id: string
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
  next_recurrence: string | null
}

function calculateNextRecurrence(task: RecurringTask, fromDate: Date): Date {
  const kolkataTime = new Date(fromDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  let nextRecurrence = new Date(kolkataTime)

  const [startHour, startMinute] = task.start_time.split(':').map(Number)
  const istOffset = 5.5 * 60 * 60 * 1000

  if (task.recurrence_type === 'daily') {
    nextRecurrence = new Date(kolkataTime.getFullYear(), kolkataTime.getMonth(), kolkataTime.getDate() + 1, startHour, startMinute, 0, 0)
    nextRecurrence = new Date(nextRecurrence.getTime() - istOffset)
  } else if (task.recurrence_type === 'weekly') {
    const startDays = task.start_days || []
    const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    const currentDayIndex = daysOfWeek.indexOf(
      kolkataTime.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' }).toLowerCase()
    )

    let daysToAdd = 7
    for (const startDay of startDays) {
      const startDayIndex = daysOfWeek.indexOf(startDay)
      let diff = startDayIndex - currentDayIndex
      if (diff <= 0) diff += 7
      if (diff < daysToAdd) {
        daysToAdd = diff
      }
    }

    nextRecurrence = new Date(kolkataTime.getFullYear(), kolkataTime.getMonth(), kolkataTime.getDate() + daysToAdd, startHour, startMinute, 0, 0)
    nextRecurrence = new Date(nextRecurrence.getTime() - istOffset)
  } else if (task.recurrence_type === 'monthly') {
    let startDay = task.start_day_of_month || 1

    if (startDay === 0) {
      const lastDay = new Date(kolkataTime.getFullYear(), kolkataTime.getMonth() + 2, 0).getDate()
      startDay = lastDay
    }

    const nextMonth = kolkataTime.getMonth() + 1
    const nextYear = nextMonth > 11 ? kolkataTime.getFullYear() + 1 : kolkataTime.getFullYear()
    const adjustedMonth = nextMonth > 11 ? 0 : nextMonth
    const maxDay = new Date(nextYear, adjustedMonth + 1, 0).getDate()

    nextRecurrence = new Date(nextYear, adjustedMonth, Math.min(startDay, maxDay), startHour, startMinute, 0, 0)
    nextRecurrence = new Date(nextRecurrence.getTime() - istOffset)
  }

  return nextRecurrence
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

    const now = new Date()
    const kolkataTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))

    console.log('Running task generation at (UTC):', now.toISOString())
    console.log('Running task generation at (Kolkata):', kolkataTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))

    const { data: recurringTasks, error: fetchError } = await supabase
      .from('recurring_tasks')
      .select('*')
      .eq('is_active', true)
      .or('next_recurrence.is.null,next_recurrence.lte.' + now.toISOString())

    if (fetchError) {
      throw fetchError
    }

    console.log('Found recurring tasks to process:', recurringTasks?.length || 0)

    const tasksCreated: any[] = []
    const errors: any[] = []

    for (const task of recurringTasks as RecurringTask[]) {
      try {
        let startDateTime: Date
        let dueDateTime: Date

        const [startHour, startMinute] = task.start_time.split(':').map(Number)
        const [dueHour, dueMinute] = task.due_time.split(':').map(Number)

        if (task.recurrence_type === 'daily') {
          startDateTime = new Date(kolkataTime.getFullYear(), kolkataTime.getMonth(), kolkataTime.getDate(), startHour, startMinute, 0, 0)
          const istOffset = 5.5 * 60 * 60 * 1000
          startDateTime = new Date(startDateTime.getTime() - istOffset)

          dueDateTime = new Date(kolkataTime.getFullYear(), kolkataTime.getMonth(), kolkataTime.getDate(), dueHour, dueMinute, 0, 0)
          dueDateTime = new Date(dueDateTime.getTime() - istOffset)
        } else if (task.recurrence_type === 'weekly') {
          const currentDayOfWeek = kolkataTime.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' }).toLowerCase()
          const istOffset = 5.5 * 60 * 60 * 1000

          startDateTime = new Date(kolkataTime.getFullYear(), kolkataTime.getMonth(), kolkataTime.getDate(), startHour, startMinute, 0, 0)
          startDateTime = new Date(startDateTime.getTime() - istOffset)

          const dueDays = task.due_days || []
          const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
          const currentDayIndex = daysOfWeek.indexOf(currentDayOfWeek)

          let daysToAdd = 0
          for (const dueDay of dueDays) {
            const dueDayIndex = daysOfWeek.indexOf(dueDay)
            let diff = dueDayIndex - currentDayIndex
            if (diff < 0) diff += 7
            if (daysToAdd === 0 || diff < daysToAdd) {
              daysToAdd = diff
            }
          }

          dueDateTime = new Date(kolkataTime.getFullYear(), kolkataTime.getMonth(), kolkataTime.getDate() + daysToAdd, dueHour, dueMinute, 0, 0)
          dueDateTime = new Date(dueDateTime.getTime() - istOffset)
        } else if (task.recurrence_type === 'monthly') {
          const istOffset = 5.5 * 60 * 60 * 1000

          startDateTime = new Date(kolkataTime.getFullYear(), kolkataTime.getMonth(), kolkataTime.getDate(), startHour, startMinute, 0, 0)
          startDateTime = new Date(startDateTime.getTime() - istOffset)

          let dueDay = task.due_day_of_month || 1

          if (dueDay === 0) {
            const lastDay = new Date(kolkataTime.getFullYear(), kolkataTime.getMonth() + 1, 0).getDate()
            dueDay = lastDay
          }

          dueDateTime = new Date(kolkataTime.getFullYear(), kolkataTime.getMonth(), dueDay, dueHour, dueMinute, 0, 0)

          const startDay = task.start_day_of_month === 0
            ? new Date(kolkataTime.getFullYear(), kolkataTime.getMonth() + 1, 0).getDate()
            : task.start_day_of_month || 1

          if (dueDay < startDay) {
            dueDateTime = new Date(kolkataTime.getFullYear(), kolkataTime.getMonth() + 1, dueDay, dueHour, dueMinute, 0, 0)
          }

          dueDateTime = new Date(dueDateTime.getTime() - istOffset)
        } else {
          throw new Error(`Unknown recurrence type: ${task.recurrence_type}`)
        }

        const startOfDay = new Date(kolkataTime)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(kolkataTime)
        endOfDay.setHours(23, 59, 59, 999)

        const { data: existingTasks } = await supabase
          .from('tasks')
          .select('id')
          .eq('recurrence_task_id', task.recurrence_task_id)
          .gte('start_date', startOfDay.toISOString())
          .lte('start_date', endOfDay.toISOString())

        if (existingTasks && existingTasks.length > 0) {
          console.log(`Task "${task.title}" (${task.recurrence_task_id}) already exists today, skipping`)

          if (!task.next_recurrence) {
            const nextRecurrence = calculateNextRecurrence(task, kolkataTime)
            await supabase
              .from('recurring_tasks')
              .update({ next_recurrence: nextRecurrence.toISOString() })
              .eq('id', task.id)
            console.log(`Updated next_recurrence for existing task "${task.title}" (${task.recurrence_task_id}) to ${nextRecurrence.toISOString()}`)
          }
          continue
        }

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
          recurrence_task_id: task.recurrence_task_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        console.log(`Creating task "${task.title}" (${task.recurrence_task_id})...`)

        const { data: createdTask, error: createError } = await supabase
          .from('tasks')
          .insert([newTask])
          .select()
          .single()

        if (createError) {
          console.error(`Error creating task "${task.title}" (${task.recurrence_task_id}):`, createError)
          errors.push({
            recurringTaskId: task.id,
            recurrenceTaskId: task.recurrence_task_id,
            taskTitle: task.title,
            error: createError.message
          })
        } else {
          console.log(`Successfully created task "${task.title}" (${task.recurrence_task_id}) with ID:`, createdTask.id)

          const nextRecurrence = calculateNextRecurrence(task, kolkataTime)

          const { error: updateError } = await supabase
            .from('recurring_tasks')
            .update({
              next_recurrence: nextRecurrence.toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', task.id)

          if (updateError) {
            console.error(`Error updating next_recurrence for "${task.title}" (${task.recurrence_task_id}):`, updateError)
          } else {
            console.log(`Updated next_recurrence for "${task.title}" (${task.recurrence_task_id}) to ${nextRecurrence.toISOString()}`)
          }

          tasksCreated.push({
            recurringTaskId: task.id,
            recurrenceTaskId: task.recurrence_task_id,
            taskId: createdTask.id,
            title: task.title,
            nextRecurrence: nextRecurrence.toISOString()
          })
        }
      } catch (err) {
        console.error(`Error processing task ${task.id}:`, err)
        errors.push({
          recurringTaskId: task.id,
          taskTitle: task.title,
          error: err.message
        })
      }
    }

    console.log(`Task generation complete. Created: ${tasksCreated.length}, Errors: ${errors.length}`)

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