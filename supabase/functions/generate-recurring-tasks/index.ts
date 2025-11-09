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

    // Get current time in Asia/Kolkata timezone (UTC+5:30)
    const now = new Date()
    const kolkataTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))

    const currentDayOfWeek = kolkataTime.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' }).toLowerCase()
    const currentDayOfMonth = kolkataTime.getDate()

    console.log('Running task generation at (UTC):', now.toISOString())
    console.log('Running task generation at (Kolkata):', kolkataTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))
    console.log('Current day of week:', currentDayOfWeek)
    console.log('Current day of month:', currentDayOfMonth)

    const { data: recurringTasks, error: fetchError } = await supabase
      .from('recurring_tasks')
      .select('*')
      .eq('is_active', true)

    if (fetchError) {
      throw fetchError
    }

    console.log('Found recurring tasks:', recurringTasks?.length || 0)

    const tasksCreated: any[] = []
    const errors: any[] = []

    for (const task of recurringTasks as RecurringTask[]) {
      try {
        let shouldCreateTask = false
        let startDateTime: Date | null = null
        let dueDateTime: Date | null = null

        if (task.recurrence_type === 'daily') {
          const [startHour, startMinute] = task.start_time.split(':').map(Number)
          const [dueHour, dueMinute] = task.due_time.split(':').map(Number)

          startDateTime = new Date(kolkataTime)
          startDateTime.setHours(startHour, startMinute, 0, 0)

          dueDateTime = new Date(kolkataTime)
          dueDateTime.setHours(dueHour, dueMinute, 0, 0)

          // Only create task if current time has reached or passed the start time
          const currentTime = kolkataTime.getHours() * 60 + kolkataTime.getMinutes()
          const startTime = startHour * 60 + startMinute

          if (currentTime >= startTime) {
            shouldCreateTask = true
            console.log(`Daily task "${task.title}": should create (current time ${kolkataTime.getHours()}:${kolkataTime.getMinutes()} >= start time ${startHour}:${startMinute})`)
          } else {
            console.log(`Daily task "${task.title}": skip (current time ${kolkataTime.getHours()}:${kolkataTime.getMinutes()} < start time ${startHour}:${startMinute})`)
          }
        } else if (task.recurrence_type === 'weekly') {
          const startDays = task.start_days || []

          if (startDays.includes(currentDayOfWeek)) {
            const [startHour, startMinute] = task.start_time.split(':').map(Number)
            const [dueHour, dueMinute] = task.due_time.split(':').map(Number)

            startDateTime = new Date(kolkataTime)
            startDateTime.setHours(startHour, startMinute, 0, 0)

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

            dueDateTime = new Date(kolkataTime)
            dueDateTime.setDate(dueDateTime.getDate() + daysToAdd)
            dueDateTime.setHours(dueHour, dueMinute, 0, 0)

            // Only create task if current time has reached or passed the start time
            const currentTime = kolkataTime.getHours() * 60 + kolkataTime.getMinutes()
            const startTime = startHour * 60 + startMinute

            if (currentTime >= startTime) {
              shouldCreateTask = true
              console.log(`Weekly task "${task.title}": should create (today is ${currentDayOfWeek}, current time ${kolkataTime.getHours()}:${kolkataTime.getMinutes()} >= start time ${startHour}:${startMinute})`)
            } else {
              console.log(`Weekly task "${task.title}": skip (today is ${currentDayOfWeek}, current time ${kolkataTime.getHours()}:${kolkataTime.getMinutes()} < start time ${startHour}:${startMinute})`)
            }
          } else {
            console.log(`Weekly task "${task.title}": skip (today is ${currentDayOfWeek}, start days: ${startDays.join(',')})`)
          }
        } else if (task.recurrence_type === 'monthly') {
          let startDay = task.start_day_of_month

          if (startDay === 0) {
            const lastDay = new Date(kolkataTime.getFullYear(), kolkataTime.getMonth() + 1, 0).getDate()
            startDay = lastDay
          }

          if (currentDayOfMonth === startDay) {
            const [startHour, startMinute] = task.start_time.split(':').map(Number)
            const [dueHour, dueMinute] = task.due_time.split(':').map(Number)

            startDateTime = new Date(kolkataTime)
            startDateTime.setHours(startHour, startMinute, 0, 0)

            let dueDay = task.due_day_of_month
            dueDateTime = new Date(kolkataTime)

            if (dueDay === 0) {
              const lastDay = new Date(kolkataTime.getFullYear(), kolkataTime.getMonth() + 1, 0).getDate()
              dueDay = lastDay
            }

            dueDateTime.setDate(dueDay!)
            dueDateTime.setHours(dueHour, dueMinute, 0, 0)

            if (dueDay! < startDay!) {
              dueDateTime.setMonth(dueDateTime.getMonth() + 1)
            }

            // Only create task if current time has reached or passed the start time
            const currentTime = kolkataTime.getHours() * 60 + kolkataTime.getMinutes()
            const startTime = startHour * 60 + startMinute

            if (currentTime >= startTime) {
              shouldCreateTask = true
              console.log(`Monthly task "${task.title}": should create (today is day ${currentDayOfMonth}, current time ${kolkataTime.getHours()}:${kolkataTime.getMinutes()} >= start time ${startHour}:${startMinute})`)
            } else {
              console.log(`Monthly task "${task.title}": skip (today is day ${currentDayOfMonth}, current time ${kolkataTime.getHours()}:${kolkataTime.getMinutes()} < start time ${startHour}:${startMinute})`)
            }
          } else {
            console.log(`Monthly task "${task.title}": skip (today is day ${currentDayOfMonth}, start day: ${startDay})`)
          }
        }

        if (shouldCreateTask && startDateTime && dueDateTime) {
          const startOfDay = new Date(kolkataTime)
          startOfDay.setHours(0, 0, 0, 0)
          const endOfDay = new Date(kolkataTime)
          endOfDay.setHours(23, 59, 59, 999)

          const { data: existingTasks } = await supabase
            .from('tasks')
            .select('id')
            .eq('title', task.title)
            .gte('start_date', startOfDay.toISOString())
            .lte('start_date', endOfDay.toISOString())

          if (existingTasks && existingTasks.length > 0) {
            console.log(`Task "${task.title}" already exists today, skipping`)
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
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }

          console.log(`Creating task "${task.title}"...`)

          const { data: createdTask, error: createError } = await supabase
            .from('tasks')
            .insert([newTask])
            .select()
            .single()

          if (createError) {
            console.error(`Error creating task "${task.title}":`, createError)
            errors.push({
              recurringTaskId: task.id,
              taskTitle: task.title,
              error: createError.message
            })
          } else {
            console.log(`Successfully created task "${task.title}" with ID:`, createdTask.id)
            tasksCreated.push({
              recurringTaskId: task.id,
              taskId: createdTask.id,
              title: task.title
            })
          }
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
