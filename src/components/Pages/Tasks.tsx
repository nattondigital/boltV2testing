import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckSquare, Eye, Edit, Trash2, Plus, X, Save, ArrowLeft, ChevronRight, Users, Calendar, Clock, AlertCircle, TrendingUp, ListTodo, Target, Flag, MoreVertical, FileText, RefreshCw, Bell, BellPlus, Repeat } from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { KPICard } from '@/components/Common/KPICard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { RecurringTaskModal } from '@/components/Tasks/RecurringTaskModal'
import { supabase } from '@/lib/supabase'
import { formatDate, formatDateTime, convertISTToUTC, convertUTCToISTForInput } from '@/lib/utils'

interface Task {
  id: string
  task_id: string
  title: string
  description: string | null
  status: string
  priority: string
  assigned_to: string | null
  assigned_to_name: string | null
  assigned_by: string | null
  assigned_by_name: string | null
  contact_id: string | null
  contact_name: string | null
  contact_phone: string | null
  due_date: string | null
  start_date: string | null
  completion_date: string | null
  estimated_hours: number | null
  actual_hours: number | null
  category: string
  attachments: any
  progress_percentage: number
  supporting_documents: string[]
  created_at: string
  updated_at: string
}

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
}

interface Contact {
  id: string
  contact_id: string
  full_name: string
  phone: string
  email: string | null
  business_name: string | null
}

interface TaskReminder {
  id?: string
  task_id?: string
  reminder_type: 'start_date' | 'due_date' | 'custom'
  custom_datetime: string | null
  offset_timing: 'before' | 'after'
  offset_value: number
  offset_unit: 'minutes' | 'hours' | 'days'
  calculated_reminder_time?: string | null
  is_sent?: boolean
}

const statusColors: Record<string, string> = {
  'To Do': 'bg-gray-100 text-gray-800',
  'In Progress': 'bg-blue-100 text-blue-800',
  'In Review': 'bg-yellow-100 text-yellow-800',
  'Completed': 'bg-green-100 text-green-800',
  'Cancelled': 'bg-red-100 text-red-800'
}

const priorityColors: Record<string, string> = {
  'Low': 'bg-gray-100 text-gray-800',
  'low': 'bg-gray-100 text-gray-800',
  'Medium': 'bg-blue-100 text-blue-800',
  'medium': 'bg-blue-100 text-blue-800',
  'High': 'bg-orange-100 text-orange-800',
  'high': 'bg-orange-100 text-orange-800',
  'Urgent': 'bg-red-100 text-red-800'
}

const categoryColors: Record<string, string> = {
  'Development': 'bg-blue-50 text-blue-700',
  'Design': 'bg-purple-50 text-purple-700',
  'Marketing': 'bg-pink-50 text-pink-700',
  'Sales': 'bg-green-50 text-green-700',
  'Support': 'bg-cyan-50 text-cyan-700',
  'Operations': 'bg-orange-50 text-orange-700',
  'Other': 'bg-gray-50 text-gray-700'
}

const statusOptions = ['To Do', 'In Progress', 'In Review', 'Completed', 'Cancelled']
const priorityOptions = ['Low', 'Medium', 'High', 'Urgent']
const categoryOptions = ['Development', 'Design', 'Marketing', 'Sales', 'Support', 'Operations', 'Other']

export const Tasks: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState<'active' | 'recurring'>('active')
  const [view, setView] = useState<'list' | 'add' | 'edit' | 'view'>('list')
  const [tasks, setTasks] = useState<Task[]>([])
  const [recurringTasks, setRecurringTasks] = useState<any[]>([])
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [selectedRecurringTask, setSelectedRecurringTask] = useState<any | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assignedToFilter, setAssignedToFilter] = useState('')
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [contactSearchTerm, setContactSearchTerm] = useState('')
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  const [returnTo, setReturnTo] = useState<string | null>(null)
  const [returnToContactId, setReturnToContactId] = useState<string | null>(null)
  const [returnToLeadId, setReturnToLeadId] = useState<string | null>(null)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [reminders, setReminders] = useState<TaskReminder[]>([])
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null)
  const [reminderFormData, setReminderFormData] = useState<TaskReminder>({
    reminder_type: 'due_date',
    custom_datetime: null,
    offset_timing: 'before',
    offset_value: 1,
    offset_unit: 'hours'
  })
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'To Do',
    priority: 'Medium',
    assignedTo: '',
    contactName: '',
    contactPhone: '',
    dueDate: '',
    startDate: '',
    estimatedHours: '',
    category: 'Other',
    progressPercentage: 0,
    supportingDocuments: [] as string[]
  })

  useEffect(() => {
    fetchTasks()
    fetchTeamMembers()
    fetchContacts()
    fetchRecurringTasks()
  }, [])

  useEffect(() => {
    const handleNavigationState = async () => {
      if (location.state?.action === 'add' && location.state?.prefilledContact) {
        const contact = location.state.prefilledContact
        setSelectedContactId(contact.id)
        setContactSearchTerm(contact.name)
        setFormData(prev => ({
          ...prev,
          contactName: contact.name,
          contactPhone: contact.phone
        }))
        setReturnTo(location.state.returnTo || null)
        setReturnToContactId(location.state.returnToContactId || null)
        setReturnToLeadId(location.state.returnToLeadId || null)
        setView('add')
        window.history.replaceState({}, document.title)
      } else if (location.state?.action === 'edit' && location.state?.taskId) {
        const taskId = location.state.taskId
        const task = tasks.find(t => t.id === taskId)
        if (task) {
          handleEditClick(task)
        }
        setReturnTo(location.state.returnTo || null)
        setReturnToContactId(location.state.returnToContactId || null)
        setReturnToLeadId(location.state.returnToLeadId || null)
        window.history.replaceState({}, document.title)
      }
    }

    if (location.state) {
      handleNavigationState()
    }
  }, [location.state, tasks])

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts_master')
        .select('id, contact_id, full_name, phone, email, business_name')
        .order('full_name')

      if (error) throw error
      setContacts(data || [])
    } catch (error) {
      console.error('Error fetching contacts:', error)
    }
  }

  const fetchTasks = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, full_name, email, role')
        .eq('is_active', true)
        .order('full_name')

      if (error) throw error

      // Map full_name to name for compatibility with the rest of the component
      const members = (data || []).map(user => ({
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role
      }))

      setTeamMembers(members)
    } catch (error) {
      console.error('Error fetching team members:', error)
    }
  }

  const fetchRecurringTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('recurring_tasks')
        .select(`
          *,
          contact:contacts_master(id, full_name, phone),
          assignee:admin_users!recurring_tasks_assigned_to_fkey(id, full_name)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRecurringTasks(data || [])
    } catch (error) {
      console.error('Error fetching recurring tasks:', error)
    }
  }

  const fetchReminders = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from('task_reminders')
        .select('*')
        .eq('task_id', taskId)
        .order('calculated_reminder_time', { ascending: true })

      if (error) throw error
      setReminders(data || [])
    } catch (error) {
      console.error('Error fetching reminders:', error)
    }
  }

  const handleAddReminder = async () => {
    if (!selectedTask) return

    try {
      const reminderData = {
        task_id: selectedTask.id,
        reminder_type: reminderFormData.reminder_type,
        custom_datetime: reminderFormData.reminder_type === 'custom' && reminderFormData.custom_datetime
          ? convertISTToUTC(reminderFormData.custom_datetime)
          : null,
        offset_timing: reminderFormData.offset_timing,
        offset_value: reminderFormData.offset_value,
        offset_unit: reminderFormData.offset_unit
      }

      if (editingReminderId) {
        const { error } = await supabase
          .from('task_reminders')
          .update(reminderData)
          .eq('id', editingReminderId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('task_reminders')
          .insert(reminderData)

        if (error) throw error
      }

      await fetchReminders(selectedTask.id)
      resetReminderForm()
    } catch (error) {
      console.error('Error saving reminder:', error)
      alert('Failed to save reminder')
    }
  }

  const handleEditReminder = (reminder: TaskReminder) => {
    setEditingReminderId(reminder.id || null)
    setReminderFormData({
      reminder_type: reminder.reminder_type,
      custom_datetime: reminder.custom_datetime ? convertUTCToISTForInput(reminder.custom_datetime) : null,
      offset_timing: reminder.offset_timing,
      offset_value: reminder.offset_value,
      offset_unit: reminder.offset_unit
    })
    setShowReminderForm(true)
  }

  const handleDeleteReminder = async (reminderId: string) => {
    if (!confirm('Are you sure you want to delete this reminder?')) return

    try {
      const { error } = await supabase
        .from('task_reminders')
        .delete()
        .eq('id', reminderId)

      if (error) throw error

      if (selectedTask) {
        await fetchReminders(selectedTask.id)
      }
    } catch (error) {
      console.error('Error deleting reminder:', error)
      alert('Failed to delete reminder')
    }
  }

  const resetReminderForm = () => {
    setReminderFormData({
      reminder_type: 'due_date',
      custom_datetime: null,
      offset_timing: 'before',
      offset_value: 1,
      offset_unit: 'hours'
    })
    setShowReminderForm(false)
    setEditingReminderId(null)
  }

  const formatReminderDisplay = (reminder: TaskReminder) => {
    const typeLabel = reminder.reminder_type === 'start_date' ? 'Start Date'
      : reminder.reminder_type === 'due_date' ? 'Due Date'
      : 'Custom Date'

    const offsetLabel = `${reminder.offset_value} ${reminder.offset_unit}`
    const timingLabel = reminder.offset_timing === 'before' ? 'before' : 'after'

    return `${offsetLabel} ${timingLabel} ${typeLabel}`
  }

  const handleFileUpload = async (files: File[]): Promise<string[]> => {
    const FOLDER_ID = '88babbbd-3e5d-49fa-b4dc-ff4b81f2cdda'
    const uploadedUrls: string[] = []

    try {
      // Fetch GHL integration settings
      const { data: integration, error: integrationError } = await supabase
        .from('integrations')
        .select('config')
        .eq('integration_type', 'ghl_api')
        .maybeSingle()

      if (integrationError) {
        console.error('Integration fetch error:', integrationError)
        throw new Error('Failed to fetch integration settings')
      }

      if (!integration) {
        alert('GHL API integration not found. Please configure it in Settings > Integrations first.')
        return []
      }

      const accessToken = integration?.config?.accessToken
      if (!accessToken || accessToken.trim() === '') {
        alert('GHL Access Token is not configured. Please add your access token in Settings > Integrations > GHL API.')
        return []
      }

      const locationId = integration?.config?.locationId || 'iDIRFjdZBWH7SqBzTowc'
      if (!locationId || locationId.trim() === '') {
        alert('GHL Location ID is not configured. Please add your Location ID in Settings > Integrations > GHL API.')
        return []
      }

      // Get the GHL folder ID from media_folders table
      const { data: folderData } = await supabase
        .from('media_folders')
        .select('ghl_folder_id')
        .eq('id', FOLDER_ID)
        .maybeSingle()

      const ghlParentId = folderData?.ghl_folder_id || null

      // Upload each file to GHL
      for (const file of files) {
        try {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('name', file.name)
          if (ghlParentId) {
            formData.append('parentId', ghlParentId)
          }

          console.log('Uploading file to GHL:', {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            parentId: ghlParentId
          })

          const response = await fetch('https://services.leadconnectorhq.com/medias/upload-file', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Version': '2021-07-28',
              'Authorization': `Bearer ${accessToken.trim()}`
            },
            body: formData
          })

          if (!response.ok) {
            let errorMessage = 'Failed to upload file to GHL'
            try {
              const errorData = await response.json()
              errorMessage = errorData.message || errorData.error || errorMessage
              console.error('GHL API Error:', errorData)
            } catch (e) {
              const errorText = await response.text()
              console.error('GHL API Error (text):', errorText)
              errorMessage = errorText || errorMessage
            }
            throw new Error(`${errorMessage} (Status: ${response.status})`)
          }

          const ghlFile = await response.json()
          console.log('GHL file uploaded:', ghlFile)

          // Save file metadata to media_files table
          const fileUrl = ghlFile.url || ghlFile.fileUrl || ''
          const { error: insertError } = await supabase
            .from('media_files')
            .insert([{
              file_name: file.name,
              file_url: fileUrl,
              file_type: file.type,
              file_size: file.size,
              ghl_file_id: ghlFile._id || ghlFile.id,
              folder_id: FOLDER_ID,
              location_id: locationId,
              thumbnail_url: ghlFile.thumbnailUrl || null
            }])

          if (insertError) {
            console.error('Error saving file metadata:', insertError)
          }

          uploadedUrls.push(fileUrl)
        } catch (error) {
          console.error('Error uploading file:', file.name, error)
          alert(`Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    } catch (error) {
      console.error('Error in file upload process:', error)
      alert(`Failed to upload files: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return uploadedUrls
  }

  const handleAddTask = async () => {
    if (!formData.title.trim()) {
      alert('Please enter a task title')
      return
    }

    // Validate due date is not before start date (comparing IST datetimes)
    if (formData.startDate && formData.dueDate) {
      const startDate = new Date(convertISTToUTC(formData.startDate))
      const dueDate = new Date(convertISTToUTC(formData.dueDate))
      if (dueDate < startDate) {
        alert('Due date cannot be before start date')
        return
      }
    }

    try {
      const assignedMember = teamMembers.find(m => m.id === formData.assignedTo)

      // Get logged-in user from localStorage (custom OTP auth)
      const userMobile = localStorage.getItem('admin_mobile')

      // Fetch current user details from admin_users using phone number
      let currentUserId = null
      let currentUserName = null
      if (userMobile) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id, full_name')
          .eq('phone', userMobile)
          .maybeSingle()

        if (adminUser) {
          currentUserId = adminUser.id
          currentUserName = adminUser.full_name
        }
      }

      const taskData = {
        title: formData.title.trim(),
        description: formData.description?.trim() || null,
        status: formData.status,
        priority: formData.priority,
        assigned_to: formData.assignedTo || null,
        assigned_to_name: assignedMember?.name || null,
        assigned_by: currentUserId,
        assigned_by_name: currentUserName,
        contact_id: selectedContactId,
        contact_name: formData.contactName || null,
        contact_phone: formData.contactPhone || null,
        due_date: formData.dueDate ? convertISTToUTC(formData.dueDate) : null,
        start_date: formData.startDate ? convertISTToUTC(formData.startDate) : null,
        estimated_hours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : null,
        category: formData.category,
        progress_percentage: formData.progressPercentage || 0,
        supporting_documents: formData.supportingDocuments || []
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      console.log('Task created successfully:', data)
      await fetchTasks()
      handleBackNavigation()
    } catch (error: any) {
      console.error('Error adding task:', error)
      alert(`Failed to add task: ${error.message || 'Unknown error'}`)
    }
  }

  const handleEditTask = async () => {
    if (!selectedTask) return

    // Validate due date is not before start date (comparing IST datetimes)
    if (formData.startDate && formData.dueDate) {
      const startDate = new Date(convertISTToUTC(formData.startDate))
      const dueDate = new Date(convertISTToUTC(formData.dueDate))
      if (dueDate < startDate) {
        alert('Due date cannot be before start date')
        return
      }
    }

    try {
      const assignedMember = teamMembers.find(m => m.id === formData.assignedTo)

      const updateData: any = {
        title: formData.title,
        description: formData.description || null,
        status: formData.status,
        priority: formData.priority,
        assigned_to: formData.assignedTo || null,
        assigned_to_name: assignedMember?.name || null,
        contact_id: selectedContactId,
        contact_name: formData.contactName || null,
        contact_phone: formData.contactPhone || null,
        due_date: formData.dueDate ? convertISTToUTC(formData.dueDate) : null,
        start_date: formData.startDate ? convertISTToUTC(formData.startDate) : null,
        estimated_hours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : null,
        category: formData.category,
        progress_percentage: formData.progressPercentage,
        supporting_documents: formData.supportingDocuments || []
      }

      if (formData.status === 'Completed' && !selectedTask.completion_date) {
        updateData.completion_date = new Date().toISOString()
      }

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', selectedTask.id)

      if (error) throw error

      await fetchTasks()
      handleBackNavigation()
    } catch (error) {
      console.error('Error updating task:', error)
      alert('Failed to update task')
    }
  }

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
      await fetchTasks()
      if (view === 'view' || view === 'edit') {
        setView('list')
        resetForm()
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Failed to delete task')
    }
  }

  const handleViewTask = async (task: Task) => {
    setSelectedTask(task)
    await fetchReminders(task.id)
    setView('view')
  }

  const handleEditClick = async (task: Task) => {
    setSelectedTask(task)
    setSelectedContactId(task.contact_id)
    setContactSearchTerm(task.contact_name || '')

    setFormData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      assignedTo: task.assigned_to || '',
      contactName: task.contact_name || '',
      contactPhone: task.contact_phone || '',
      dueDate: convertUTCToISTForInput(task.due_date),
      startDate: convertUTCToISTForInput(task.start_date),
      estimatedHours: task.estimated_hours?.toString() || '',
      category: task.category,
      progressPercentage: task.progress_percentage,
      supportingDocuments: task.supporting_documents || []
    })
    await fetchReminders(task.id)
    setView('edit')
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      status: 'To Do',
      priority: 'Medium',
      assignedTo: '',
      contactName: '',
      contactPhone: '',
      dueDate: '',
      startDate: '',
      estimatedHours: '',
      category: 'Other',
      progressPercentage: 0,
      supportingDocuments: [] as string[]
    })
    setSelectedTask(null)
    setSelectedContactId(null)
    setContactSearchTerm('')
    setShowContactDropdown(false)
  }

  const handleBackNavigation = () => {
    if (returnTo === '/contacts' && returnToContactId) {
      navigate('/contacts', {
        state: {
          returnToContactId: returnToContactId,
          refreshTasks: true
        }
      })
      setReturnTo(null)
      setReturnToContactId(null)
    } else if (returnTo === '/leads' && returnToLeadId) {
      navigate('/leads', {
        state: {
          returnToLeadId: returnToLeadId,
          refreshTasks: true
        }
      })
      setReturnTo(null)
      setReturnToLeadId(null)
    } else {
      setView('list')
      resetForm()
    }
  }

  const handleContactSelect = (contact: Contact) => {
    setSelectedContactId(contact.id)
    setContactSearchTerm(contact.full_name)
    setFormData(prev => ({
      ...prev,
      contactName: contact.full_name,
      contactPhone: contact.phone
    }))
    setShowContactDropdown(false)
  }

  const handleContactSearchChange = (value: string) => {
    setContactSearchTerm(value)
    setShowContactDropdown(true)
    if (!value) {
      setSelectedContactId(null)
      setFormData(prev => ({
        ...prev,
        contactName: '',
        contactPhone: ''
      }))
    }
  }

  const filteredContacts = contacts.filter(contact =>
    contact.full_name.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
    contact.phone.includes(contactSearchTerm) ||
    (contact.business_name && contact.business_name.toLowerCase().includes(contactSearchTerm.toLowerCase()))
  )

  const filteredTasks = tasks.filter(task => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.task_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.assigned_to_name && task.assigned_to_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (task.contact_name && task.contact_name.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === '' || task.status === statusFilter
    const matchesPriority = priorityFilter === '' || task.priority === priorityFilter
    const matchesAssignedTo = assignedToFilter === '' || task.assigned_to === assignedToFilter

    return matchesSearch && matchesStatus && matchesPriority && matchesAssignedTo
  })

  const totalTasks = tasks.length
  const todoTasks = tasks.filter(t => t.status === 'To Do').length
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length
  const completedTasks = tasks.filter(t => t.status === 'Completed').length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="hidden md:block ppt-slide p-6">
        {view === 'list' && (
          <>
            <PageHeader
              title="Tasks Management"
              subtitle="Create and manage team tasks efficiently"
              actions={[
                {
                  label: activeTab === 'active' ? 'Add Task' : 'Add Recurring Task',
                  onClick: () => activeTab === 'active' ? setView('add') : setShowRecurringModal(true),
                  variant: 'default',
                  icon: Plus
                },
                {
                  label: 'Refresh',
                  onClick: () => activeTab === 'active' ? fetchTasks() : fetchRecurringTasks(),
                  variant: 'outline',
                  icon: RefreshCw
                }
              ]}
            />

            <div className="flex gap-2 mb-6">
              <Button
                variant={activeTab === 'active' ? 'default' : 'outline'}
                onClick={() => setActiveTab('active')}
                className="flex items-center gap-2"
              >
                <ListTodo className="w-4 h-4" />
                Active Tasks
              </Button>
              <Button
                variant={activeTab === 'recurring' ? 'default' : 'outline'}
                onClick={() => setActiveTab('recurring')}
                className="flex items-center gap-2"
              >
                <Repeat className="w-4 h-4" />
                Recurring Tasks
              </Button>
            </div>
          </>
        )}

        {view === 'list' && (
          <>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center py-12"
              >
                <div className="flex items-center space-x-3">
                  <RefreshCw className="w-6 h-6 text-brand-primary animate-spin" />
                  <span className="text-lg text-gray-600">Loading tasks...</span>
                </div>
              </motion.div>
            )}

            {!isLoading && (
              <>
                <motion.div
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: { staggerChildren: 0.1 }
                    }
                  }}
                >
                  <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                    <KPICard
                      title="Total Tasks"
                      value={totalTasks}
                      change={12}
                      icon={ListTodo}
                      category="primary"
                    />
                  </motion.div>
                  <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                    <KPICard
                      title="To Do"
                      value={todoTasks}
                      change={8}
                      icon={AlertCircle}
                      category="warning"
                    />
                  </motion.div>
                  <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                    <KPICard
                      title="In Progress"
                      value={inProgressTasks}
                      change={15}
                      icon={TrendingUp}
                      category="secondary"
                    />
                  </motion.div>
                  <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                    <KPICard
                      title="Completed"
                      value={completedTasks}
                      change={5}
                      icon={CheckSquare}
                      category="success"
                    />
                  </motion.div>
                </motion.div>

                <motion.div
                  className="mb-6 flex gap-4 flex-wrap"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Input
                    placeholder="Search tasks by title, task ID, or assigned member..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-md"
                  />
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                  >
                    <option value="">All Priorities</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    value={assignedToFilter}
                    onChange={(e) => setAssignedToFilter(e.target.value)}
                  >
                    <option value="">All Assignees</option>
                    {teamMembers.map(member => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </motion.div>

                {activeTab === 'active' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mb-8"
                  >
                    <Card className="shadow-xl">
                      <CardHeader>
                        <CardTitle>All Tasks</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {filteredTasks.length === 0 ? (
                        <div className="text-center py-12">
                          <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">No tasks found</p>
                        </div>
                      ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-4 font-semibold text-brand-text">Task ID</th>
                              <th className="text-left py-3 px-4 font-semibold text-brand-text">Title</th>
                              <th className="text-left py-3 px-4 font-semibold text-brand-text">Status</th>
                              <th className="text-left py-3 px-4 font-semibold text-brand-text">Priority</th>
                              <th className="text-left py-3 px-4 font-semibold text-brand-text">Assigned To</th>
                              <th className="text-left py-3 px-4 font-semibold text-brand-text">Due Date</th>
                              <th className="text-left py-3 px-4 font-semibold text-brand-text">Progress</th>
                              <th className="text-left py-3 px-4 font-semibold text-brand-text">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTasks.map((task, index) => (
                              <motion.tr
                                key={task.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.05 * index }}
                                className="border-b border-gray-100 hover:bg-gray-50"
                              >
                                <td className="py-3 px-4">
                                  <span className="font-mono text-sm text-gray-600">{task.task_id}</span>
                                </td>
                                <td className="py-3 px-4">
                                  <div>
                                    <p className="font-medium text-gray-900">{task.title}</p>
                                    {task.category && (
                                      <Badge className={`${categoryColors[task.category]} text-xs mt-1`}>
                                        {task.category}
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <Badge className={statusColors[task.status]}>
                                    {task.status}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4">
                                  <Badge className={priorityColors[task.priority]}>
                                    {task.priority}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4">
                                  {task.assigned_to_name ? (
                                    <div className="flex items-center gap-2">
                                      <Users className="w-4 h-4 text-gray-400" />
                                      <span className="text-sm">{task.assigned_to_name}</span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-sm">Unassigned</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  {task.due_date ? (
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-4 h-4 text-gray-400" />
                                      <span className="text-sm">{formatDate(task.due_date)}</span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-sm">No deadline</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                                      <div
                                        className="bg-blue-600 h-2 rounded-full"
                                        style={{ width: `${task.progress_percentage}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-600 w-10">{task.progress_percentage}%</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="sm" variant="ghost">
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleViewTask(task)}>
                                        <Eye className="w-4 h-4 mr-2" />
                                        View Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleEditClick(task)}>
                                        <Edit className="w-4 h-4 mr-2" />
                                        Edit Task
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteTask(task.id)}
                                        className="text-red-600 focus:text-red-600"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete Task
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </td>
                              </motion.tr>
                            ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
                )}

                {activeTab === 'recurring' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mb-8"
                  >
                    <Card className="shadow-xl">
                      <CardHeader>
                        <CardTitle>Recurring Tasks</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {recurringTasks.length === 0 ? (
                          <div className="text-center py-12">
                            <Repeat className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No recurring tasks found</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-3 px-4 font-semibold text-brand-text">Title</th>
                                  <th className="text-left py-3 px-4 font-semibold text-brand-text">Type</th>
                                  <th className="text-left py-3 px-4 font-semibold text-brand-text">Schedule</th>
                                  <th className="text-left py-3 px-4 font-semibold text-brand-text">Time</th>
                                  <th className="text-left py-3 px-4 font-semibold text-brand-text">Priority</th>
                                  <th className="text-left py-3 px-4 font-semibold text-brand-text">Assigned To</th>
                                  <th className="text-left py-3 px-4 font-semibold text-brand-text">Status</th>
                                  <th className="text-left py-3 px-4 font-semibold text-brand-text">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {recurringTasks.map((task, index) => {
                                  let scheduleText = ''
                                  if (task.recurrence_type === 'daily') {
                                    scheduleText = 'Every Day'
                                  } else if (task.recurrence_type === 'weekly') {
                                    const days = task.recurrence_days?.map((d: string) => d.toUpperCase()).join(', ')
                                    scheduleText = days || 'Weekly'
                                  } else if (task.recurrence_type === 'monthly') {
                                    scheduleText = task.recurrence_day_of_month === 0 ? 'Last Day' : `Day ${task.recurrence_day_of_month}`
                                  }

                                  return (
                                    <motion.tr
                                      key={task.id}
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: 0.05 * index }}
                                      className="border-b border-gray-100 hover:bg-gray-50"
                                    >
                                      <td className="py-3 px-4">
                                        <div>
                                          <p className="font-medium text-gray-900">{task.title}</p>
                                          {task.contact && (
                                            <p className="text-sm text-gray-500">{task.contact.full_name}</p>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-3 px-4">
                                        <Badge className="capitalize">{task.recurrence_type}</Badge>
                                      </td>
                                      <td className="py-3 px-4">
                                        <span className="text-sm text-gray-600">{scheduleText}</span>
                                      </td>
                                      <td className="py-3 px-4">
                                        <span className="text-sm text-gray-600">{task.recurrence_time}</span>
                                      </td>
                                      <td className="py-3 px-4">
                                        <Badge className={`capitalize ${priorityColors[task.priority] || 'bg-gray-100 text-gray-800'}`}>
                                          {task.priority}
                                        </Badge>
                                      </td>
                                      <td className="py-3 px-4">
                                        <span className="text-sm text-gray-600">
                                          {task.assignee?.full_name || 'Unassigned'}
                                        </span>
                                      </td>
                                      <td className="py-3 px-4">
                                        <Badge className={task.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                          {task.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                      </td>
                                      <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => {
                                              setSelectedRecurringTask(task)
                                              setShowRecurringModal(true)
                                            }}
                                            className="text-blue-600 hover:text-blue-800"
                                            title="Edit"
                                          >
                                            <Edit className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={async () => {
                                              if (confirm('Are you sure you want to delete this recurring task?')) {
                                                try {
                                                  const { error } = await supabase
                                                    .from('recurring_tasks')
                                                    .delete()
                                                    .eq('id', task.id)
                                                  if (error) throw error
                                                  fetchRecurringTasks()
                                                } catch (error) {
                                                  console.error('Error deleting recurring task:', error)
                                                  alert('Failed to delete recurring task')
                                                }
                                              }
                                            }}
                                            className="text-red-600 hover:text-red-800"
                                            title="Delete"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </td>
                                    </motion.tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </>
            )}
          </>
        )}

        <RecurringTaskModal
          isOpen={showRecurringModal}
          onClose={() => {
            setShowRecurringModal(false)
            setSelectedRecurringTask(null)
          }}
          onSave={() => {
            fetchRecurringTasks()
          }}
          task={selectedRecurringTask}
          teamMembers={teamMembers}
          contacts={contacts}
        />

        {/* Desktop Add/Edit Form */}
          {(view === 'add' || view === 'edit') && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <Button
                    variant="ghost"
                    onClick={handleBackNavigation}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to List
                  </Button>
                </div>

                <h3 className="text-2xl font-bold text-brand-text mb-6">
                  {view === 'add' ? 'Add New Task' : 'Edit Task'}
                </h3>

                <div className="space-y-6 max-w-4xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter task title"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter task description"
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                      <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((status) => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Priority *</label>
                      <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {priorityOptions.map((priority) => (
                            <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Assign To</label>
                      <Select value={formData.assignedTo} onValueChange={(value) => setFormData(prev => ({ ...prev, assignedTo: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select team member" />
                        </SelectTrigger>
                        <SelectContent>
                          {teamMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name} ({member.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Contact (Optional)</label>
                      <Input
                        value={contactSearchTerm}
                        onChange={(e) => handleContactSearchChange(e.target.value)}
                        onFocus={() => setShowContactDropdown(true)}
                        placeholder="Search contacts..."
                        className="w-full"
                      />
                      {showContactDropdown && filteredContacts.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredContacts.map((contact) => (
                            <div
                              key={contact.id}
                              onClick={() => handleContactSelect(contact)}
                              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                            >
                              <div className="font-medium text-gray-900">{contact.full_name}</div>
                              <div className="text-sm text-gray-500">{contact.phone}</div>
                              {contact.business_name && (
                                <div className="text-xs text-gray-400">{contact.business_name}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {selectedContactId && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedContactId(null)
                            setContactSearchTerm('')
                            setFormData(prev => ({ ...prev, contactName: '', contactPhone: '' }))
                          }}
                          className="absolute right-2 top-9 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categoryOptions.map((category) => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Date & Time</label>
                      <Input
                        type="datetime-local"
                        value={formData.startDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Due Date & Time</label>
                      <Input
                        type="datetime-local"
                        value={formData.dueDate}
                        min={formData.startDate || undefined}
                        onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                      />
                      {formData.startDate && (
                        <p className="text-xs text-gray-500 mt-1">Due date must be on or after start date</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Hours</label>
                      <Input
                        type="number"
                        step="0.5"
                        value={formData.estimatedHours}
                        onChange={(e) => setFormData(prev => ({ ...prev, estimatedHours: e.target.value }))}
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Progress (%)</label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.progressPercentage}
                        onChange={(e) => setFormData(prev => ({ ...prev, progressPercentage: parseInt(e.target.value) || 0 }))}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Supporting Documents</label>
                      <div className="space-y-2">
                        <Input
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || [])
                            if (files.length > 0) {
                              setUploadingFiles(true)
                              try {
                                const uploadedUrls = await handleFileUpload(files)
                                setFormData(prev => ({
                                  ...prev,
                                  supportingDocuments: [...prev.supportingDocuments, ...uploadedUrls]
                                }))
                              } catch (error) {
                                console.error('Error uploading files:', error)
                              } finally {
                                setUploadingFiles(false)
                                e.target.value = ''
                              }
                            }
                          }}
                          disabled={uploadingFiles}
                          className="cursor-pointer"
                        />
                        {uploadingFiles && (
                          <p className="text-xs text-blue-600 flex items-center gap-2">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Uploading files...
                          </p>
                        )}
                        {!uploadingFiles && (
                          <p className="text-xs text-gray-500">Upload supporting documents for this task (PDF, DOC, XLS, Images)</p>
                        )}
                        {formData.supportingDocuments && formData.supportingDocuments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {formData.supportingDocuments.map((doc, index) => (
                              <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {doc.split('/').pop()}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormData(prev => ({
                                      ...prev,
                                      supportingDocuments: prev.supportingDocuments.filter((_, i) => i !== index)
                                    }))
                                  }}
                                  className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Reminders Section - Only show in edit mode */}
                    {view === 'edit' && selectedTask && (
                      <div className="md:col-span-2">
                        <div className="border-t border-gray-200 pt-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Bell className="w-5 h-5 text-gray-600" />
                              <h4 className="text-lg font-semibold text-gray-800">Reminders</h4>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setShowReminderForm(!showReminderForm)}
                              variant={showReminderForm ? "outline" : "default"}
                            >
                              {showReminderForm ? (
                                <>
                                  <X className="w-4 h-4 mr-2" />
                                  Cancel
                                </>
                              ) : (
                                <>
                                  <BellPlus className="w-4 h-4 mr-2" />
                                  Add Reminder
                                </>
                              )}
                            </Button>
                          </div>

                          {showReminderForm && (
                            <div className="bg-gray-50 p-4 rounded-lg mb-4 space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Reminder Type
                                  </label>
                                  <Select
                                    value={reminderFormData.reminder_type}
                                    onValueChange={(value: any) => {
                                      setReminderFormData(prev => ({
                                        ...prev,
                                        reminder_type: value,
                                        custom_datetime: value === 'custom' ? '' : null
                                      }))
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="start_date">Start Date/Time</SelectItem>
                                      <SelectItem value="due_date">Due Date/Time</SelectItem>
                                      <SelectItem value="custom">Custom Date/Time</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {reminderFormData.reminder_type === 'custom' && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Custom Date & Time
                                    </label>
                                    <Input
                                      type="datetime-local"
                                      value={reminderFormData.custom_datetime || ''}
                                      onChange={(e) =>
                                        setReminderFormData(prev => ({
                                          ...prev,
                                          custom_datetime: e.target.value
                                        }))
                                      }
                                    />
                                  </div>
                                )}

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Timing
                                  </label>
                                  <Select
                                    value={reminderFormData.offset_timing}
                                    onValueChange={(value: any) =>
                                      setReminderFormData(prev => ({ ...prev, offset_timing: value }))
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="before">Before</SelectItem>
                                      <SelectItem value="after">After</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Offset Value
                                  </label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={reminderFormData.offset_value}
                                    onChange={(e) =>
                                      setReminderFormData(prev => ({
                                        ...prev,
                                        offset_value: parseInt(e.target.value) || 0
                                      }))
                                    }
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Offset Unit
                                  </label>
                                  <Select
                                    value={reminderFormData.offset_unit}
                                    onValueChange={(value: any) =>
                                      setReminderFormData(prev => ({ ...prev, offset_unit: value }))
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="minutes">Minutes</SelectItem>
                                      <SelectItem value="hours">Hours</SelectItem>
                                      <SelectItem value="days">Days</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <Button type="button" size="sm" onClick={handleAddReminder}>
                                  {editingReminderId ? 'Update Reminder' : 'Save Reminder'}
                                </Button>
                                {editingReminderId && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={resetReminderForm}
                                  >
                                    Cancel Edit
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}

                          {reminders.length > 0 ? (
                            <div className="space-y-2">
                              {reminders.map((reminder) => (
                                <div
                                  key={reminder.id}
                                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                                >
                                  <div className="flex items-center gap-3 flex-1">
                                    <Bell className="w-4 h-4 text-blue-600" />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-900">
                                        {formatReminderDisplay(reminder)}
                                      </p>
                                      {reminder.calculated_reminder_time && (
                                        <p className="text-xs text-gray-500">
                                          {formatDateTime(reminder.calculated_reminder_time)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEditReminder(reminder)}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteReminder(reminder.id!)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 text-center py-4">
                              No reminders set. Click "Add Reminder" to create one.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <Button onClick={view === 'add' ? handleAddTask : handleEditTask}>
                      <Save className="w-4 h-4 mr-2" />
                      {view === 'add' ? 'Create Task' : 'Update Task'}
                    </Button>
                    <Button variant="outline" onClick={handleBackNavigation}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Desktop View Details */}
          {view === 'view' && selectedTask && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <Button
                    variant="ghost"
                    onClick={handleBackNavigation}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to List
                  </Button>
                </div>

                <div className="space-y-6 max-w-4xl">
                  <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-brand-text mb-2">{selectedTask.title}</h3>
                      <p className="text-sm text-gray-500 font-mono mb-3">{selectedTask.task_id}</p>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[selectedTask.status]}>
                          {selectedTask.status}
                        </Badge>
                        <Badge className={priorityColors[selectedTask.priority]}>
                          {selectedTask.priority}
                        </Badge>
                        <Badge className={categoryColors[selectedTask.category]}>
                          {selectedTask.category}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleEditClick(selectedTask)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this task?')) {
                            handleDeleteTask(selectedTask.id)
                          }
                        }}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {selectedTask.description && (
                    <div>
                      <h4 className="text-lg font-semibold text-brand-text mb-3">Description</h4>
                      <p className="text-gray-600 bg-gray-50 p-4 rounded-lg">{selectedTask.description}</p>
                    </div>
                  )}

                  <div>
                    <h4 className="text-lg font-semibold text-brand-text mb-3">Task Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedTask.assigned_to_name && (
                        <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg">
                          <Users className="w-5 h-5 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-600">Assigned To</div>
                            <div className="font-medium">{selectedTask.assigned_to_name}</div>
                          </div>
                        </div>
                      )}

                      {selectedTask.start_date && (
                        <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg">
                          <Calendar className="w-5 h-5 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-600">Start Date & Time</div>
                            <div className="font-medium">{formatDateTime(selectedTask.start_date)}</div>
                          </div>
                        </div>
                      )}

                      {selectedTask.due_date && (
                        <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg">
                          <Calendar className="w-5 h-5 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-600">Due Date & Time</div>
                            <div className="font-medium">{formatDateTime(selectedTask.due_date)}</div>
                          </div>
                        </div>
                      )}

                      {selectedTask.estimated_hours && (
                        <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg">
                          <Clock className="w-5 h-5 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-600">Estimated Hours</div>
                            <div className="font-medium">{selectedTask.estimated_hours}h</div>
                          </div>
                        </div>
                      )}

                      {selectedTask.completion_date && (
                        <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg">
                          <CheckSquare className="w-5 h-5 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-600">Completed On</div>
                            <div className="font-medium">{formatDate(selectedTask.completion_date)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-brand-text mb-3">Progress</h4>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-200 rounded-full h-4">
                        <div
                          className="bg-blue-600 h-4 rounded-full transition-all"
                          style={{ width: `${selectedTask.progress_percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700 min-w-[50px]">{selectedTask.progress_percentage}%</span>
                    </div>
                  </div>

                  {selectedTask.supporting_documents && selectedTask.supporting_documents.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-brand-text mb-3">Supporting Documents</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedTask.supporting_documents.map((doc, index) => (
                          <a
                            key={index}
                            href={doc}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block"
                          >
                            <Badge variant="secondary" className="flex items-center gap-1 hover:bg-gray-300 cursor-pointer transition-colors">
                              <FileText className="w-3 h-3" />
                              {doc.split('/').pop()?.split('_').slice(1).join('_') || 'Document'}
                            </Badge>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {reminders.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-brand-text mb-3 flex items-center gap-2">
                        <Bell className="w-5 h-5" />
                        Reminders
                      </h4>
                      <div className="space-y-2">
                        {reminders.map((reminder) => (
                          <div
                            key={reminder.id}
                            className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <Bell className="w-4 h-4 text-blue-600 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {formatReminderDisplay(reminder)}
                              </p>
                              {reminder.calculated_reminder_time && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Scheduled: {formatDateTime(reminder.calculated_reminder_time)}
                                </p>
                              )}
                              {reminder.is_sent && reminder.sent_at && (
                                <Badge variant="secondary" className="mt-1 text-xs">
                                  Sent on {formatDateTime(reminder.sent_at)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
      </div>

      <div className="md:hidden min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <AnimatePresence mode="wait">
          {view === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-6 shadow-lg">
                <h1 className="text-2xl font-bold mb-1">Tasks</h1>
                <p className="text-blue-100 text-sm">Manage your team tasks</p>
              </div>

              <div className="px-4 -mt-4 mb-4">
                <div className="grid grid-cols-2 gap-3">
                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="bg-white rounded-2xl p-4 shadow-lg border border-blue-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-blue-100 p-2 rounded-xl">
                        <ListTodo className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className="text-2xl font-bold text-blue-600">{totalTasks}</span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">Total</p>
                  </motion.div>

                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="bg-white rounded-2xl p-4 shadow-lg border border-orange-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-orange-100 p-2 rounded-xl">
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                      </div>
                      <span className="text-2xl font-bold text-orange-600">{todoTasks}</span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">To Do</p>
                  </motion.div>

                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="bg-white rounded-2xl p-4 shadow-lg border border-indigo-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-indigo-100 p-2 rounded-xl">
                        <TrendingUp className="w-5 h-5 text-indigo-600" />
                      </div>
                      <span className="text-2xl font-bold text-indigo-600">{inProgressTasks}</span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">In Progress</p>
                  </motion.div>

                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="bg-white rounded-2xl p-4 shadow-lg border border-green-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-green-100 p-2 rounded-xl">
                        <CheckSquare className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="text-2xl font-bold text-green-600">{completedTasks}</span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">Completed</p>
                  </motion.div>
                </div>
              </div>

              <div className="px-4 mb-4">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setView('add')}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl py-4 px-6 shadow-lg flex items-center justify-center gap-3 font-semibold"
                >
                  <Plus className="w-5 h-5" />
                  Add New Task
                </motion.button>
              </div>

              <div className="px-4 mb-4">
                <div className="space-y-2">
                  <select
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="In Review">In Review</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                    >
                      <option value="">All Priorities</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                    <select
                      className="px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      value={assignedToFilter}
                      onChange={(e) => setAssignedToFilter(e.target.value)}
                    >
                      <option value="">All Assignees</option>
                      {teamMembers.map(member => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="px-4 pb-20">
                <h2 className="text-lg font-bold text-gray-800 mb-3">All Tasks</h2>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No tasks yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTasks.map((task) => (
                      <motion.div
                        key={task.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleViewTask(task)}
                        className="bg-white rounded-2xl p-4 shadow-md active:shadow-lg transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800 mb-1">{task.title}</p>
                            <p className="text-xs text-gray-500 font-mono">{task.task_id}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>

                        <div className="flex items-center gap-2 mb-3">
                          <Badge className={statusColors[task.status]}>
                            {task.status}
                          </Badge>
                          <Badge className={priorityColors[task.priority]}>
                            {task.priority}
                          </Badge>
                        </div>

                        <div className="space-y-2 text-sm">
                          {task.assigned_to_name && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Users className="w-4 h-4" />
                              <span>{task.assigned_to_name}</span>
                            </div>
                          )}
                          {task.due_date && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Calendar className="w-4 h-4" />
                              <span>{formatDate(task.due_date)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${task.progress_percentage}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">{task.progress_percentage}%</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {(view === 'add' || view === 'edit') && (
            <motion.div
              key="form"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 bg-white z-[60] overflow-y-auto"
            >
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-6 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <button onClick={handleBackNavigation}>
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <h2 className="text-xl font-bold">
                    {view === 'add' ? 'New Task' : 'Edit Task'}
                  </h2>
                </div>
              </div>

              <div className="p-4 pb-24 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter task title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter task description"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                    <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        {statusOptions.map((status) => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priority *</label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        {priorityOptions.map((priority) => (
                          <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assign To</label>
                  <Select value={formData.assignedTo} onValueChange={(value) => setFormData(prev => ({ ...prev, assignedTo: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent className="z-[70]">
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name} ({member.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact (Optional)</label>
                  <Input
                    value={contactSearchTerm}
                    onChange={(e) => handleContactSearchChange(e.target.value)}
                    onFocus={() => setShowContactDropdown(true)}
                    placeholder="Search contacts..."
                    className="w-full"
                  />
                  {showContactDropdown && filteredContacts.length > 0 && (
                    <div className="absolute z-[70] mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredContacts.map((contact) => (
                        <div
                          key={contact.id}
                          onClick={() => handleContactSelect(contact)}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                        >
                          <div className="font-medium text-gray-900">{contact.full_name}</div>
                          <div className="text-sm text-gray-500">{contact.phone}</div>
                          {contact.business_name && (
                            <div className="text-xs text-gray-400">{contact.business_name}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedContactId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedContactId(null)
                        setContactSearchTerm('')
                        setFormData(prev => ({ ...prev, contactName: '', contactPhone: '' }))
                      }}
                      className="absolute right-2 top-9 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[70]">
                      {categoryOptions.map((category) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date & Time</label>
                    <Input
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Due Date & Time</label>
                    <Input
                      type="datetime-local"
                      value={formData.dueDate}
                      min={formData.startDate || undefined}
                      onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                    {formData.startDate && (
                      <p className="text-xs text-gray-500 mt-1">Due date must be on or after start date</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Hours</label>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.estimatedHours}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimatedHours: e.target.value }))}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Progress (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.progressPercentage}
                    onChange={(e) => setFormData(prev => ({ ...prev, progressPercentage: parseInt(e.target.value) || 0 }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Supporting Documents</label>
                  <div className="space-y-2">
                    <Input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || [])
                        if (files.length > 0) {
                          setUploadingFiles(true)
                          try {
                            const uploadedUrls = await handleFileUpload(files)
                            setFormData(prev => ({
                              ...prev,
                              supportingDocuments: [...prev.supportingDocuments, ...uploadedUrls]
                            }))
                          } catch (error) {
                            console.error('Error uploading files:', error)
                          } finally {
                            setUploadingFiles(false)
                            e.target.value = ''
                          }
                        }
                      }}
                      disabled={uploadingFiles}
                      className="cursor-pointer"
                    />
                    {uploadingFiles && (
                      <p className="text-xs text-blue-600 flex items-center gap-2">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Uploading files...
                      </p>
                    )}
                    {!uploadingFiles && (
                      <p className="text-xs text-gray-500">Upload supporting documents for this task (PDF, DOC, XLS, Images)</p>
                    )}
                    {formData.supportingDocuments && formData.supportingDocuments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.supportingDocuments.map((doc, index) => (
                          <Badge key={index} variant="secondary" className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {doc.split('/').pop()}
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  supportingDocuments: prev.supportingDocuments.filter((_, i) => i !== index)
                                }))
                              }}
                              className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3">
                <Button onClick={view === 'add' ? handleAddTask : handleEditTask} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  {view === 'add' ? 'Create Task' : 'Update Task'}
                </Button>
                <Button variant="outline" onClick={handleBackNavigation}>
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}

          {view === 'view' && selectedTask && (
            <motion.div
              key="view"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 bg-white z-[60] overflow-y-auto"
            >
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-6 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <button onClick={handleBackNavigation}>
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <h2 className="text-xl font-bold">Task Details</h2>
                </div>
              </div>

              <div className="p-4 pb-24 space-y-4">
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{selectedTask.title}</h3>
                  <p className="text-sm text-gray-500 font-mono mb-4">{selectedTask.task_id}</p>

                  <div className="flex items-center gap-2 mb-4">
                    <Badge className={statusColors[selectedTask.status]}>
                      {selectedTask.status}
                    </Badge>
                    <Badge className={priorityColors[selectedTask.priority]}>
                      {selectedTask.priority}
                    </Badge>
                    <Badge className={categoryColors[selectedTask.category]}>
                      {selectedTask.category}
                    </Badge>
                  </div>

                  {selectedTask.description && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">{selectedTask.description}</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {selectedTask.assigned_to_name && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Assigned To</div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{selectedTask.assigned_to_name}</span>
                        </div>
                      </div>
                    )}

                    {selectedTask.start_date && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Start Date & Time</div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{formatDateTime(selectedTask.start_date)}</span>
                        </div>
                      </div>
                    )}

                    {selectedTask.due_date && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Due Date & Time</div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{formatDateTime(selectedTask.due_date)}</span>
                        </div>
                      </div>
                    )}

                    {selectedTask.estimated_hours && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Estimated Hours</div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{selectedTask.estimated_hours}h</span>
                        </div>
                      </div>
                    )}

                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-500 mb-2">Progress</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-blue-600 h-3 rounded-full"
                            style={{ width: `${selectedTask.progress_percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{selectedTask.progress_percentage}%</span>
                      </div>
                    </div>

                    {selectedTask.supporting_documents && selectedTask.supporting_documents.length > 0 && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 mb-2">Supporting Documents</div>
                        <div className="flex flex-wrap gap-2">
                          {selectedTask.supporting_documents.map((doc, index) => (
                            <a
                              key={index}
                              href={doc}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block"
                            >
                              <Badge variant="secondary" className="flex items-center gap-1 hover:bg-gray-300 cursor-pointer transition-colors">
                                <FileText className="w-3 h-3" />
                                {doc.split('/').pop()?.split('_').slice(1).join('_') || 'Document'}
                              </Badge>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3">
                <Button onClick={() => handleEditClick(selectedTask)} className="flex-1">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this task?')) {
                      handleDeleteTask(selectedTask.id)
                    }
                  }}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
