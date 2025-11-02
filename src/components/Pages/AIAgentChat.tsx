import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Send, ArrowLeft, Paperclip, User, Loader2, X } from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: string
  imageUrl?: string
  action?: string
  module?: string
  result?: string
}

interface Agent {
  id: string
  name: string
  model: string
  status: string
  system_prompt?: string
}

export function AIAgentChat() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [loading, setLoading] = useState(true)
  const [openRouterApiKey, setOpenRouterApiKey] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>('internal')
  const [availablePhoneNumbers, setAvailablePhoneNumbers] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (id) {
      fetchAgent()
      fetchPhoneNumbers()
      fetchOpenRouterKey()
    }
  }, [id])

  useEffect(() => {
    if (id && selectedPhoneNumber) {
      loadChatHistory(selectedPhoneNumber)
    }
  }, [id, selectedPhoneNumber])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchAgent = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, model, status, system_prompt')
        .eq('id', id)
        .single()

      if (error) throw error
      setAgent(data)
    } catch (error) {
      console.error('Error fetching agent:', error)
      alert('Failed to load agent')
      navigate('/ai-agents')
    } finally {
      setLoading(false)
    }
  }

  const fetchOpenRouterKey = async () => {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('config')
        .eq('integration_type', 'openrouter')
        .maybeSingle()

      if (error) throw error

      if (data && data.config) {
        const config = data.config as any
        setOpenRouterApiKey(config.apiKey || '')
      }
    } catch (error) {
      console.error('Error fetching OpenRouter key:', error)
    }
  }

  const fetchPhoneNumbers = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_agent_chat_memory')
        .select('phone_number')
        .eq('agent_id', id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const uniquePhones = Array.from(new Set(data.map(d => d.phone_number)))
      setAvailablePhoneNumbers(['internal', ...uniquePhones.filter(p => p !== 'internal')])
    } catch (error) {
      console.error('Error fetching phone numbers:', error)
    }
  }

  const loadChatHistory = async (phoneNumber: string) => {
    try {
      const { data, error } = await supabase
        .from('ai_agent_chat_memory')
        .select('*')
        .eq('agent_id', id)
        .eq('phone_number', phoneNumber)
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) throw error

      const historyMessages: Message[] = data.map(msg => ({
        id: msg.id,
        role: msg.role === 'user' ? 'user' : 'agent',
        content: msg.message,
        timestamp: msg.created_at,
        imageUrl: msg.metadata?.image_url
      }))

      setMessages(historyMessages)
    } catch (error) {
      console.error('Error loading chat history:', error)
    }
  }

  const checkPermission = async (module: string, action: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('ai_agent_permissions')
        .select('permissions')
        .eq('agent_id', id)
        .maybeSingle()

      if (error || !data || !data.permissions) return false

      const permissions = data.permissions as any
      const modulePerms = permissions[module]

      if (!modulePerms) return false

      const actionMap: Record<string, string> = {
        'create': 'can_create',
        'update': 'can_edit',
        'edit': 'can_edit',
        'delete': 'can_delete',
        'fetch': 'can_view',
        'view': 'can_view',
        'read': 'can_view'
      }

      const permissionKey = actionMap[action.toLowerCase()]
      return modulePerms[permissionKey] === true
    } catch (error) {
      console.error('Error checking permission:', error)
      return false
    }
  }

  const getAvailableTools = async () => {
    const { data: permData } = await supabase
      .from('ai_agent_permissions')
      .select('permissions')
      .eq('agent_id', id)
      .maybeSingle()

    const permissions = permData?.permissions || {}

    const tools: any[] = []

    if (permissions['Expenses']?.can_create) {
      tools.push({
        type: 'function',
        function: {
          name: 'create_expense',
          description: 'Create a new expense entry in the CRM',
          parameters: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Description of the expense'
              },
              amount: {
                type: 'number',
                description: 'Amount of the expense'
              },
              category: {
                type: 'string',
                description: 'Category of the expense (e.g., Marketing, Software, Travel, Food, Transportation). If not specified in the request, infer from the description (e.g., "flight" -> Travel, "lunch" -> Food)'
              },
              date: {
                type: 'string',
                description: 'Date of expense in YYYY-MM-DD format'
              }
            },
            required: ['description', 'amount']
          }
        }
      })
    }

    if (permissions['Tasks']?.can_create) {
      tools.push({
        type: 'function',
        function: {
          name: 'create_task',
          description: 'Create a new task in the CRM',
          parameters: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Title of the task'
              },
              description: {
                type: 'string',
                description: 'Detailed description of the task'
              },
              due_date: {
                type: 'string',
                description: 'Due date in YYYY-MM-DD format'
              },
              priority: {
                type: 'string',
                enum: ['Low', 'Medium', 'High'],
                description: 'Priority level of the task'
              }
            },
            required: ['title']
          }
        }
      })
    }

    if (permissions['Leads']?.can_create) {
      tools.push({
        type: 'function',
        function: {
          name: 'create_lead',
          description: 'Create a new lead in the CRM',
          parameters: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of the lead'
              },
              phone: {
                type: 'string',
                description: 'Phone number of the lead'
              },
              email: {
                type: 'string',
                description: 'Email address of the lead'
              },
              company: {
                type: 'string',
                description: 'Company name'
              },
              pipeline: {
                type: 'string',
                description: 'Pipeline name (e.g., "ITR FILING", "Ai Automation 2.0")'
              },
              interest: {
                type: 'string',
                enum: ['Hot', 'Warm', 'Cold'],
                description: 'Interest level of the lead'
              },
              source: {
                type: 'string',
                description: 'Source of the lead (e.g., Website, Referral, Phone)'
              }
            },
            required: ['name', 'phone']
          }
        }
      })
    }

    if (permissions['Leads']?.can_view) {
      tools.push({
        type: 'function',
        function: {
          name: 'get_leads',
          description: 'Get list of leads from the CRM',
          parameters: {
            type: 'object',
            properties: {
              stage: {
                type: 'string',
                description: 'Filter by lead stage (e.g., New, Contacted, Qualified)'
              },
              limit: {
                type: 'number',
                description: 'Number of leads to retrieve'
              }
            }
          }
        }
      })
    }

    if (permissions['Expenses']?.can_view) {
      tools.push({
        type: 'function',
        function: {
          name: 'get_expenses',
          description: 'Get list of expenses from the CRM with optional filtering and grouping. Can filter by date range, category, and group by category with totals.',
          parameters: {
            type: 'object',
            properties: {
              date_filter: {
                type: 'string',
                description: 'Filter by date: "today", "this_week", "this_month", "last_month", or specific date in YYYY-MM-DD format'
              },
              category: {
                type: 'string',
                description: 'Filter by specific category (e.g., Travel, Marketing, Software)'
              },
              group_by_category: {
                type: 'boolean',
                description: 'If true, groups expenses by category and returns totals for each category'
              },
              limit: {
                type: 'number',
                description: 'Number of expenses to retrieve (not applicable when group_by_category is true)'
              }
            }
          }
        }
      })
    }

    if (permissions['Appointments']?.can_view) {
      tools.push({
        type: 'function',
        function: {
          name: 'get_appointments',
          description: 'Get list of appointments from the CRM. Can filter by date, status, or appointment ID.',
          parameters: {
            type: 'object',
            properties: {
              date_filter: {
                type: 'string',
                enum: ['today', 'upcoming', 'past', 'this_month', 'all'],
                description: 'Filter appointments by date: today (today only), upcoming (future), past (previous), this_month (current month), all (no filter)'
              },
              appointment_id: {
                type: 'string',
                description: 'Specific appointment ID to retrieve (e.g., APT-472048279)'
              },
              specific_date: {
                type: 'string',
                description: 'Specific date in YYYY-MM-DD format'
              },
              limit: {
                type: 'number',
                description: 'Number of appointments to retrieve'
              }
            }
          }
        }
      })
    }

    if (permissions['Appointments']?.can_create) {
      tools.push({
        type: 'function',
        function: {
          name: 'create_appointment',
          description: 'Create a new appointment in the CRM',
          parameters: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Title of the appointment'
              },
              contact_name: {
                type: 'string',
                description: 'Name of the contact'
              },
              contact_phone: {
                type: 'string',
                description: 'Phone number of the contact'
              },
              contact_email: {
                type: 'string',
                description: 'Email of the contact'
              },
              appointment_date: {
                type: 'string',
                description: 'Date in YYYY-MM-DD format'
              },
              appointment_time: {
                type: 'string',
                description: 'Time in HH:MM format (24-hour)'
              },
              duration_minutes: {
                type: 'number',
                description: 'Duration in minutes'
              },
              location: {
                type: 'string',
                description: 'Location of the appointment'
              },
              purpose: {
                type: 'string',
                description: 'Purpose of the appointment'
              }
            },
            required: ['title', 'appointment_date', 'appointment_time']
          }
        }
      })
    }

    tools.push({
      type: 'function',
      function: {
        name: 'get_calendars',
        description: 'Get list of calendars in the CRM',
        parameters: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of calendars to retrieve'
            }
          }
        }
      }
    })

    tools.push({
      type: 'function',
      function: {
        name: 'generate_image',
        description: 'Generate or edit an image using AI. Can create images from text descriptions or modify existing images.',
        parameters: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Detailed description of the image to generate or how to modify the existing image'
            },
            reference_image_url: {
              type: 'string',
              description: 'Optional URL of an existing image to use as reference or to modify'
            }
          },
          required: ['prompt']
        }
      }
    })

    if (permissions['Support Tickets']?.can_view) {
      tools.push({
        type: 'function',
        function: {
          name: 'get_support_tickets',
          description: 'Get list of support tickets from the CRM',
          parameters: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
                description: 'Filter by ticket status'
              },
              limit: {
                type: 'number',
                description: 'Number of tickets to retrieve'
              }
            }
          }
        }
      })
    }

    if (permissions['Contacts']?.can_view) {
      tools.push({
        type: 'function',
        function: {
          name: 'get_contacts',
          description: 'Get list of contacts from the CRM',
          parameters: {
            type: 'object',
            properties: {
              search: {
                type: 'string',
                description: 'Search contacts by name, email, or phone'
              },
              limit: {
                type: 'number',
                description: 'Number of contacts to retrieve'
              }
            }
          }
        }
      })
    }

    if (permissions['Tasks']?.can_view) {
      tools.push({
        type: 'function',
        function: {
          name: 'get_tasks',
          description: 'Get list of tasks from the CRM',
          parameters: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['Pending', 'In Progress', 'Completed'],
                description: 'Filter by task status'
              },
              priority: {
                type: 'string',
                enum: ['Low', 'Medium', 'High'],
                description: 'Filter by task priority'
              },
              limit: {
                type: 'number',
                description: 'Number of tasks to retrieve'
              }
            }
          }
        }
      })
    }

    return tools
  }

  const executeFunction = async (functionName: string, args: any, model?: string): Promise<any> => {
    try {
      switch (functionName) {
        case 'create_expense':
          const { error: expenseError } = await supabase
            .from('expenses')
            .insert({
              description: args.description,
              amount: args.amount,
              category: args.category || 'Other',
              expense_date: args.date || new Date().toISOString().split('T')[0],
              status: 'Pending'
            })

          if (expenseError) throw expenseError
          return { success: true, message: `Expense created: ${args.description} for ₹${args.amount} (Category: ${args.category || 'Other'})` }

        case 'create_task':
          const { error: taskError } = await supabase
            .from('tasks')
            .insert({
              title: args.title,
              description: args.description,
              due_date: args.due_date,
              priority: args.priority || 'Medium',
              status: 'Pending'
            })

          if (taskError) throw taskError
          return { success: true, message: `Task created: ${args.title}` }

        case 'create_lead':
          const { data: pipelines, error: pipelineError } = await supabase
            .from('pipelines')
            .select('id, name')

          if (pipelineError) throw pipelineError

          let pipelineId = pipelines?.find(p =>
            p.name.toLowerCase() === (args.pipeline || '').toLowerCase()
          )?.id

          if (!pipelineId && pipelines && pipelines.length > 0) {
            pipelineId = pipelines.find(p => p.is_default)?.id || pipelines[0].id
          }

          const { data: stages, error: stageError } = await supabase
            .from('pipeline_stages')
            .select('stage_id')
            .eq('pipeline_id', pipelineId)
            .order('display_order', { ascending: true })
            .limit(1)

          if (stageError) throw stageError
          const firstStageId = stages?.[0]?.stage_id || 'new_lead'

          const { error: leadError } = await supabase
            .from('leads')
            .insert({
              name: args.name,
              phone: args.phone,
              email: args.email,
              company: args.company,
              pipeline_id: pipelineId,
              stage: firstStageId,
              interest: args.interest || 'Warm',
              source: args.source || 'Manual Entry'
            })

          if (leadError) throw leadError
          return { success: true, message: `Lead created: ${args.name} (${args.phone})` }

        case 'get_leads':
          const leadsQuery = supabase
            .from('leads')
            .select('*')
            .limit(args.limit || 10)

          if (args.stage) {
            leadsQuery.eq('stage', args.stage)
          }

          const { data: leads, error: leadsError } = await leadsQuery
          if (leadsError) throw leadsError

          return { success: true, data: leads, count: leads.length }

        case 'get_expenses':
          let expensesQuery = supabase
            .from('expenses')
            .select('*')
            .order('expense_date', { ascending: false })

          const todayDate = new Date().toISOString().split('T')[0]
          const currentYear = new Date().getFullYear()
          const currentMonth = new Date().getMonth() + 1
          const firstDayOfMonth = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`
          const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1
          const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear
          const firstDayOfLastMonth = `${lastMonthYear}-${lastMonth.toString().padStart(2, '0')}-01`
          const lastDayOfLastMonth = new Date(lastMonthYear, lastMonth, 0).toISOString().split('T')[0]

          if (args.date_filter === 'today') {
            expensesQuery = expensesQuery.eq('expense_date', todayDate)
          } else if (args.date_filter === 'this_week') {
            const weekAgo = new Date()
            weekAgo.setDate(weekAgo.getDate() - 7)
            expensesQuery = expensesQuery.gte('expense_date', weekAgo.toISOString().split('T')[0])
          } else if (args.date_filter === 'this_month') {
            expensesQuery = expensesQuery.gte('expense_date', firstDayOfMonth)
          } else if (args.date_filter === 'last_month') {
            expensesQuery = expensesQuery
              .gte('expense_date', firstDayOfLastMonth)
              .lte('expense_date', lastDayOfLastMonth)
          } else if (args.date_filter && args.date_filter.match(/^\d{4}-\d{2}-\d{2}$/)) {
            expensesQuery = expensesQuery.eq('expense_date', args.date_filter)
          }

          if (args.category) {
            expensesQuery = expensesQuery.eq('category', args.category)
          }

          if (!args.group_by_category && args.limit) {
            expensesQuery = expensesQuery.limit(args.limit)
          }

          const { data: expenses, error: expensesError } = await expensesQuery

          if (expensesError) throw expensesError

          if (args.group_by_category) {
            const categoryTotals: Record<string, { count: number, total: number }> = {}
            expenses?.forEach(expense => {
              const cat = expense.category || 'Uncategorized'
              if (!categoryTotals[cat]) {
                categoryTotals[cat] = { count: 0, total: 0 }
              }
              categoryTotals[cat].count++
              categoryTotals[cat].total += parseFloat(expense.amount) || 0
            })

            const summary = Object.entries(categoryTotals).map(([category, data]) => ({
              category,
              count: data.count,
              total: data.total
            }))

            const grandTotal = summary.reduce((sum, item) => sum + item.total, 0)

            return {
              success: true,
              summary,
              grand_total: grandTotal,
              message: `Found ${expenses?.length || 0} expenses across ${summary.length} categories with a total of ₹${grandTotal.toFixed(2)}`
            }
          }

          return { success: true, data: expenses, count: expenses?.length || 0 }

        case 'get_appointments':
          let appointmentsQuery = supabase
            .from('appointments')
            .select('*')
            .order('appointment_date', { ascending: true })
            .order('appointment_time', { ascending: true })

          const today = new Date().toISOString().split('T')[0]
          const currentMonthStr = today.substring(0, 7)

          if (args.appointment_id) {
            appointmentsQuery = appointmentsQuery.eq('appointment_id', args.appointment_id)
          } else if (args.specific_date) {
            appointmentsQuery = appointmentsQuery.eq('appointment_date', args.specific_date)
          } else if (args.date_filter === 'today') {
            appointmentsQuery = appointmentsQuery.eq('appointment_date', today)
          } else if (args.date_filter === 'upcoming') {
            appointmentsQuery = appointmentsQuery.gte('appointment_date', today)
          } else if (args.date_filter === 'past') {
            appointmentsQuery = appointmentsQuery.lt('appointment_date', today)
          } else if (args.date_filter === 'this_month') {
            appointmentsQuery = appointmentsQuery.like('appointment_date', `${currentMonthStr}%`)
          }

          appointmentsQuery = appointmentsQuery.limit(args.limit || 10)

          const { data: appointments, error: appointmentsError } = await appointmentsQuery
          if (appointmentsError) throw appointmentsError

          return { success: true, data: appointments, count: appointments.length }

        case 'create_appointment':
          const appointmentId = `APT-${Math.floor(Math.random() * 1000000000)}`
          const { error: appointmentError } = await supabase
            .from('appointments')
            .insert({
              appointment_id: appointmentId,
              title: args.title,
              contact_name: args.contact_name,
              contact_phone: args.contact_phone,
              contact_email: args.contact_email,
              appointment_date: args.appointment_date,
              appointment_time: args.appointment_time,
              duration_minutes: args.duration_minutes || 60,
              location: args.location,
              purpose: args.purpose,
              status: 'Scheduled',
              reminder_sent: false
            })

          if (appointmentError) throw appointmentError
          return { success: true, message: `Appointment created: ${args.title} (${appointmentId})` }

        case 'get_calendars':
          const { data: calendars, error: calendarsError } = await supabase
            .from('calendars')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(args.limit || 10)

          if (calendarsError) throw calendarsError
          return { success: true, data: calendars, count: calendars.length }

        case 'get_support_tickets':
          let ticketsQuery = supabase
            .from('support_tickets')
            .select('*')
            .order('created_at', { ascending: false })

          if (args.status) {
            ticketsQuery = ticketsQuery.eq('status', args.status)
          }

          ticketsQuery = ticketsQuery.limit(args.limit || 10)

          const { data: tickets, error: ticketsError } = await ticketsQuery
          if (ticketsError) throw ticketsError

          return { success: true, data: tickets, count: tickets.length }

        case 'get_contacts':
          let contactsQuery = supabase
            .from('contacts_master')
            .select('*')
            .order('created_at', { ascending: false })

          if (args.search) {
            contactsQuery = contactsQuery.or(`name.ilike.%${args.search}%,email.ilike.%${args.search}%,phone.ilike.%${args.search}%`)
          }

          contactsQuery = contactsQuery.limit(args.limit || 10)

          const { data: contacts, error: contactsError } = await contactsQuery
          if (contactsError) throw contactsError

          return { success: true, data: contacts, count: contacts.length }

        case 'get_tasks':
          let tasksQuery = supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false })

          if (args.status) {
            tasksQuery = tasksQuery.eq('status', args.status)
          }

          if (args.priority) {
            tasksQuery = tasksQuery.eq('priority', args.priority)
          }

          tasksQuery = tasksQuery.limit(args.limit || 10)

          const { data: tasks, error: tasksError } = await tasksQuery
          if (tasksError) throw tasksError

          return { success: true, data: tasks, count: tasks.length }

        case 'generate_image':
          if (!openRouterApiKey) {
            return { success: false, message: 'OpenRouter API key is not configured' }
          }

          const imageGenMessages: any[] = [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: args.prompt
                }
              ]
            }
          ]

          if (args.reference_image_url) {
            imageGenMessages[0].content.push({
              type: 'image_url',
              image_url: {
                url: args.reference_image_url
              }
            })
          }

          const modelToUse = model || agent?.model || 'google/gemini-2.0-flash-exp'

          const imageGenResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openRouterApiKey}`
            },
            body: JSON.stringify({
              model: modelToUse,
              messages: imageGenMessages
            })
          })

          if (!imageGenResponse.ok) {
            const errorData = await imageGenResponse.json().catch(() => ({}))
            return { success: false, message: `Image generation failed: ${errorData.error?.message || imageGenResponse.statusText}` }
          }

          const imageGenData = await imageGenResponse.json()
          const imageContent = imageGenData.choices[0]?.message?.content || ''

          const imageUrlMatch = imageContent.match(/https?:\/\/[^\s)]+\.(jpg|jpeg|png|gif|webp)/i)
          const imageUrl = imageUrlMatch ? imageUrlMatch[0] : null

          if (imageUrl) {
            return { success: true, message: `Image generated successfully`, image_url: imageUrl }
          } else {
            return { success: false, message: 'Failed to extract image URL from response', response: imageContent }
          }

        default:
          return { success: false, message: `Unknown function: ${functionName}` }
      }
    } catch (error: any) {
      return { success: false, message: `Error: ${error.message}` }
    }
  }

  const callOpenRouter = async (userMessage: string, imageUrl?: string): Promise<string> => {
    if (!openRouterApiKey) {
      return "OpenRouter API key is not configured. Please configure it in Settings > Integrations."
    }

    if (!agent?.model) {
      return "AI model is not configured for this agent."
    }

    try {
      const messageContent: any[] = [
        {
          type: "text",
          text: userMessage
        }
      ]

      if (imageUrl) {
        messageContent.push({
          type: "image_url",
          image_url: {
            url: imageUrl
          }
        })
      }

      const tools = await getAvailableTools()

      const systemPrompt = agent.system_prompt || 'You are a helpful AI assistant with access to CRM functions.'
      let enhancedSystemPrompt = `${systemPrompt}\n\nYou have access to CRM tools. When a user asks you to perform actions like creating expenses, tasks, or retrieving data, use the available tools to execute those actions. Always use tools when appropriate instead of just describing what you would do.\n\nIMPORTANT: If you ask the user for additional information (like a category, date, etc.) and they provide it in their next message, use that information to complete the original action. For example, if you asked "What is the category?" and they reply "travel", use "travel" as the category parameter for the create_expense function.\n\nWhen users ask about expenses with time periods (like "this month", "today", "last month"), use the get_expenses tool with the date_filter parameter. When they ask for category-wise totals or breakdowns, set group_by_category to true. Examples:\n- "expenses this month" → get_expenses with date_filter="this_month"\n- "category wise expenses" → get_expenses with group_by_category=true\n- "travel expenses this month" → get_expenses with date_filter="this_month" and category="Travel"`

      if (imageUrl) {
        enhancedSystemPrompt += `\n\nIMPORTANT: The user has uploaded an image. When they ask you to create, generate, or modify an image, you MUST use the generate_image tool and pass the uploaded image URL as the reference_image_url parameter. The uploaded image is available at: ${imageUrl}`
      }

      const conversationMessages = [
        {
          role: 'system',
          content: enhancedSystemPrompt
        }
      ]

      const recentMessages = messages.slice(-10)
      recentMessages.forEach(msg => {
        conversationMessages.push({
          role: msg.role === 'agent' ? 'assistant' : 'user',
          content: msg.role === 'user' && msg.imageUrl
            ? [
                { type: 'text', text: msg.content },
                { type: 'image_url', image_url: { url: msg.imageUrl } }
              ]
            : msg.content
        })
      })

      conversationMessages.push({
        role: 'user',
        content: messageContent
      })

      const requestBody: any = {
        model: agent.model,
        messages: conversationMessages
      }

      if (tools.length > 0) {
        requestBody.tools = tools
        requestBody.tool_choice = 'auto'
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openRouterApiKey}`
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `API request failed with status ${response.status}`)
      }

      const data = await response.json()
      const message = data.choices[0]?.message

      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolResults: string[] = []
        let generatedImageUrl: string | null = null

        for (const toolCall of message.tool_calls) {
          const functionName = toolCall.function.name
          const functionArgs = JSON.parse(toolCall.function.arguments)

          const result = await executeFunction(functionName, functionArgs, agent.model)

          if (result.success) {
            toolResults.push(`✅ ${result.message}`)
            if (result.image_url) {
              generatedImageUrl = result.image_url
              toolResults.push(`\n![Generated Image](${result.image_url})`)
            }
            if (result.data) {
              toolResults.push(`\nData: ${JSON.stringify(result.data, null, 2)}`)
            }
          } else {
            toolResults.push(`❌ ${result.message}`)
          }
        }

        const finalResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openRouterApiKey}`
          },
          body: JSON.stringify({
            model: agent.model,
            messages: [
              {
                role: 'system',
                content: enhancedSystemPrompt
              },
              {
                role: 'user',
                content: messageContent
              },
              message,
              {
                role: 'tool',
                content: toolResults.join('\n')
              }
            ]
          })
        })

        if (finalResponse.ok) {
          const finalData = await finalResponse.json()
          return finalData.choices[0]?.message?.content || toolResults.join('\n')
        }

        return toolResults.join('\n')
      }

      return message.content || 'No response from AI'
    } catch (error: any) {
      console.error('Error calling OpenRouter:', error)
      return `Error communicating with AI: ${error.message}`
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploadImageToStorage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `chat-images/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('media-files')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('media-files')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      return null
    }
  }

  const saveMessageToMemory = async (message: string, role: 'user' | 'assistant', action: string, module: string, result: string, imageUrl?: string, phoneNumber?: string) => {
    const finalPhoneNumber = phoneNumber || selectedPhoneNumber
    try {
      await supabase
        .from('ai_agent_chat_memory')
        .insert({
          agent_id: id,
          phone_number: finalPhoneNumber,
          message: message,
          role: role,
          user_context: 'Internal',
          action: action,
          result: result,
          module: module,
          metadata: {
            image_url: imageUrl,
            timestamp: new Date().toISOString()
          }
        })

      await supabase
        .from('ai_agent_logs')
        .insert({
          agent_id: id,
          agent_name: agent?.name || 'Unknown',
          module,
          action,
          result,
          user_context: 'Internal',
          details: {
            user_message: message,
            image_url: imageUrl
          }
        })
    } catch (error) {
      console.error('Error saving message to memory:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !agent) return

    const messageText = inputMessage
    let uploadedImageUrl: string | null = null

    if (selectedImage) {
      uploadedImageUrl = await uploadImageToStorage(selectedImage)
      if (!uploadedImageUrl) {
        alert('Failed to upload image. Please try again.')
        return
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      imageUrl: uploadedImageUrl || undefined,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    removeImage()
    setIsTyping(true)

    const action = messageText.toLowerCase().includes('create') ? 'Create' :
                   messageText.toLowerCase().includes('update') ? 'Update' :
                   messageText.toLowerCase().includes('delete') ? 'Delete' : 'Chat'

    const module = messageText.toLowerCase().includes('task') ? 'Tasks' :
                   messageText.toLowerCase().includes('appointment') ? 'Appointments' :
                   messageText.toLowerCase().includes('ticket') ? 'Support Tickets' :
                   messageText.toLowerCase().includes('lead') ? 'Leads' : 'General'

    try {
      await saveMessageToMemory(messageText, 'user', action, module, 'Success', uploadedImageUrl || undefined)

      const agentResponse = await callOpenRouter(messageText, uploadedImageUrl || undefined)

      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: agentResponse,
        timestamp: new Date().toISOString(),
        result: agentResponse.includes('Error') ? 'Error' : 'Success'
      }

      setMessages(prev => [...prev, agentMessage])

      await saveMessageToMemory(agentResponse, 'assistant', action, module, agentMessage.result || 'Success', uploadedImageUrl || undefined)
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: 'An error occurred while processing your message. Please try again.',
        timestamp: new Date().toISOString(),
        result: 'Error'
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading chat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="p-8 pb-4">
        <Button
          variant="outline"
          onClick={() => navigate('/ai-agents')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Agents
        </Button>
        <div className="flex items-center justify-between">
          <PageHeader
            title={`Chat with ${agent?.name}`}
            subtitle={`Powered by ${agent?.model}`}
            icon={Bot}
          />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Phone:</label>
              <select
                value={selectedPhoneNumber}
                onChange={(e) => setSelectedPhoneNumber(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availablePhoneNumbers.map((phone) => (
                  <option key={phone} value={phone}>
                    {phone === 'internal' ? 'Internal Chat' : phone}
                  </option>
                ))}
              </select>
            </div>
            <Badge className={agent?.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
              {agent?.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-8 pb-8">
        <Card className="h-full flex flex-col">
          <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'agent' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-blue-600" />
                    </div>
                  )}
                  <div className={`max-w-[70%] ${message.role === 'user' ? 'order-1' : ''}`}>
                    <div
                      className={`
                        rounded-2xl px-4 py-3
                        ${message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                        }
                      `}
                    >
                      {message.imageUrl && (
                        <img
                          src={message.imageUrl}
                          alt="User uploaded"
                          className="max-w-full rounded-lg mb-2"
                          style={{ maxHeight: '300px' }}
                        />
                      )}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 px-2">
                      <span className="text-xs text-gray-400">
                        {formatDateTime(message.timestamp)}
                      </span>
                      {message.result && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            message.result === 'Success'
                              ? 'border-green-500 text-green-700'
                              : 'border-red-500 text-red-700'
                          }`}
                        >
                          {message.result}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-blue-600" />
                </div>
                <div className="bg-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    <span className="text-sm text-gray-500">Thinking...</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </CardContent>

          <div className="p-4 border-t">
            {imagePreview && (
              <div className="mb-3 relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-32 rounded-lg border border-gray-300"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Attach image"
              >
                <Paperclip className="w-5 h-5 text-gray-500" />
              </button>
              <Input
                placeholder="Type your message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isTyping}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2 px-2">
              Powered by OpenRouter AI. You can attach images for vision models.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
