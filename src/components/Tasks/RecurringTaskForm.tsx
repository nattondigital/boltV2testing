import React, { useState, useEffect } from 'react'
import { ArrowLeft, Save, Upload, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'

interface RecurringTask {
  id?: string
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
  supporting_docs: string[]
  is_active: boolean
}

interface TeamMember {
  id: string
  name: string
  email: string
}

interface Contact {
  id: string
  full_name: string
  phone: string
}

interface RecurringTaskFormProps {
  mode: 'add' | 'edit' | 'view'
  task: RecurringTask | null
  teamMembers: TeamMember[]
  contacts: Contact[]
  onBack: () => void
  onSave: () => void
  onEdit?: () => void
}

const daysOfWeek = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' }
]

const daysOfMonth = [
  ...Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: `${i + 1}` })),
  { value: 0, label: 'Last Day' }
]

function calculateInitialNextRecurrence(task: RecurringTask): string {
  const now = new Date()
  const kolkataTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  let nextRecurrence = new Date(kolkataTime)

  const [startHour, startMinute] = task.start_time.split(':').map(Number)

  if (task.recurrence_type === 'daily') {
    nextRecurrence.setHours(startHour, startMinute, 0, 0)
    if (nextRecurrence <= kolkataTime) {
      nextRecurrence.setDate(nextRecurrence.getDate() + 1)
    }
  } else if (task.recurrence_type === 'weekly') {
    const startDays = task.start_days || []
    const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    const currentDayIndex = daysOfWeek.indexOf(
      nextRecurrence.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' }).toLowerCase()
    )

    let daysToAdd = 7
    for (const startDay of startDays) {
      const startDayIndex = daysOfWeek.indexOf(startDay)
      let diff = startDayIndex - currentDayIndex
      if (diff < 0) diff += 7
      if (diff === 0) {
        nextRecurrence.setHours(startHour, startMinute, 0, 0)
        if (nextRecurrence <= kolkataTime) {
          diff = 7
        }
      }
      if (diff < daysToAdd) {
        daysToAdd = diff
      }
    }

    if (daysToAdd > 0) {
      nextRecurrence.setDate(nextRecurrence.getDate() + daysToAdd)
    }
    nextRecurrence.setHours(startHour, startMinute, 0, 0)
  } else if (task.recurrence_type === 'monthly') {
    let startDay = task.start_day_of_month || 1

    if (startDay === 0) {
      const lastDay = new Date(nextRecurrence.getFullYear(), nextRecurrence.getMonth() + 1, 0).getDate()
      startDay = lastDay
    }

    nextRecurrence.setDate(Math.min(startDay, new Date(nextRecurrence.getFullYear(), nextRecurrence.getMonth() + 1, 0).getDate()))
    nextRecurrence.setHours(startHour, startMinute, 0, 0)

    if (nextRecurrence <= kolkataTime) {
      nextRecurrence.setMonth(nextRecurrence.getMonth() + 1)
      const lastDay = new Date(nextRecurrence.getFullYear(), nextRecurrence.getMonth() + 1, 0).getDate()
      nextRecurrence.setDate(Math.min(startDay, lastDay))
      nextRecurrence.setHours(startHour, startMinute, 0, 0)
    }
  }

  return nextRecurrence.toISOString()
}

export const RecurringTaskForm: React.FC<RecurringTaskFormProps> = ({
  mode,
  task,
  teamMembers,
  contacts,
  onBack,
  onSave,
  onEdit
}) => {
  const [formData, setFormData] = useState<RecurringTask>({
    title: '',
    description: '',
    contact_id: null,
    assigned_to: null,
    priority: 'medium',
    recurrence_type: 'daily',
    start_time: '09:00',
    start_days: null,
    start_day_of_month: null,
    due_time: '17:00',
    due_days: null,
    due_day_of_month: null,
    supporting_docs: [],
    is_active: true
  })

  const [selectedStartDays, setSelectedStartDays] = useState<string[]>([])
  const [selectedStartDayOfMonth, setSelectedStartDayOfMonth] = useState<number>(1)
  const [selectedDueDays, setSelectedDueDays] = useState<string[]>([])
  const [selectedDueDayOfMonth, setSelectedDueDayOfMonth] = useState<number>(1)
  const [contactSearchTerm, setContactSearchTerm] = useState('')
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)

  useEffect(() => {
    if (task) {
      setFormData(task)
      setContactSearchTerm('')
      if (task.start_days) {
        setSelectedStartDays(task.start_days)
      } else {
        setSelectedStartDays([])
      }
      if (task.start_day_of_month !== null) {
        setSelectedStartDayOfMonth(task.start_day_of_month)
      } else {
        setSelectedStartDayOfMonth(1)
      }
      if (task.due_days) {
        setSelectedDueDays(task.due_days)
      } else {
        setSelectedDueDays([])
      }
      if (task.due_day_of_month !== null) {
        setSelectedDueDayOfMonth(task.due_day_of_month)
      } else {
        setSelectedDueDayOfMonth(1)
      }
    } else {
      setFormData({
        title: '',
        description: '',
        contact_id: null,
        assigned_to: null,
        priority: 'medium',
        recurrence_type: 'daily',
        start_time: '09:00',
        start_days: null,
        start_day_of_month: null,
        due_time: '17:00',
        due_days: null,
        due_day_of_month: null,
        supporting_docs: [],
        is_active: true
      })
      setContactSearchTerm('')
      setSelectedStartDays([])
      setSelectedStartDayOfMonth(1)
      setSelectedDueDays([])
      setSelectedDueDayOfMonth(1)
    }
  }, [task, mode])

  const handleRecurrenceTypeChange = (type: 'daily' | 'weekly' | 'monthly') => {
    setFormData(prev => ({
      ...prev,
      recurrence_type: type,
      start_days: type === 'weekly' ? [] : null,
      start_day_of_month: type === 'monthly' ? 1 : null,
      due_days: type === 'weekly' ? [] : null,
      due_day_of_month: type === 'monthly' ? 1 : null
    }))

    if (type === 'weekly') {
      setSelectedStartDays([])
      setSelectedDueDays([])
    } else if (type === 'monthly') {
      setSelectedStartDayOfMonth(1)
      setSelectedDueDayOfMonth(1)
    }
  }

  const handleStartDayToggle = (day: string) => {
    setSelectedStartDays(prev => {
      const newDays = prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
      setFormData(prevForm => ({ ...prevForm, start_days: newDays.length > 0 ? newDays : null }))
      return newDays
    })
  }

  const handleDueDayToggle = (day: string) => {
    setSelectedDueDays(prev => {
      const newDays = prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
      setFormData(prevForm => ({ ...prevForm, due_days: newDays.length > 0 ? newDays : null }))
      return newDays
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingFiles(true)
    const uploadedUrls: string[] = []

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileName = `${Date.now()}-${file.name}`
        const { data, error } = await supabase.storage
          .from('media-files')
          .upload(`task-documents/${fileName}`, file)

        if (error) throw error

        const { data: { publicUrl } } = supabase.storage
          .from('media-files')
          .getPublicUrl(`task-documents/${fileName}`)

        uploadedUrls.push(publicUrl)
      }

      setFormData(prev => ({
        ...prev,
        supporting_docs: [...prev.supporting_docs, ...uploadedUrls]
      }))
    } catch (error) {
      console.error('Error uploading files:', error)
      alert('Failed to upload files')
    } finally {
      setUploadingFiles(false)
    }
  }

  const handleRemoveFile = (url: string) => {
    setFormData(prev => ({
      ...prev,
      supporting_docs: prev.supporting_docs.filter(doc => doc !== url)
    }))
  }

  const handleSubmit = async () => {
    if (!formData.title) {
      alert('Please enter a title')
      return
    }

    if (formData.recurrence_type === 'weekly' && (!formData.start_days || formData.start_days.length === 0)) {
      alert('Please select at least one day for weekly recurrence')
      return
    }

    try {
      const taskData = {
        ...formData,
        start_days: formData.recurrence_type === 'weekly' ? selectedStartDays : null,
        start_day_of_month: formData.recurrence_type === 'monthly' ? selectedStartDayOfMonth : null,
        due_days: formData.recurrence_type === 'weekly' ? selectedDueDays : null,
        due_day_of_month: formData.recurrence_type === 'monthly' ? selectedDueDayOfMonth : null
      }

      const nextRecurrence = calculateInitialNextRecurrence(taskData)

      if (mode === 'edit' && formData.id) {
        const { error } = await supabase
          .from('recurring_tasks')
          .update({
            ...taskData,
            next_recurrence: nextRecurrence
          })
          .eq('id', formData.id)

        if (error) throw error
        alert('Recurring task updated successfully!')
      } else {
        const { error } = await supabase
          .from('recurring_tasks')
          .insert([{
            ...taskData,
            next_recurrence: nextRecurrence
          }])

        if (error) throw error
        alert('Recurring task created successfully!')
      }

      onSave()
      onBack()
    } catch (error) {
      console.error('Error saving recurring task:', error)
      alert('Failed to save recurring task')
    }
  }

  const filteredContacts = contacts?.filter(contact =>
    contact.full_name?.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
    contact.phone?.includes(contactSearchTerm)
  ) || []

  const selectedContact = contacts?.find(c => c.id === formData.contact_id)
  const selectedAssignee = teamMembers?.find(m => m.id === formData.assigned_to)

  const isViewMode = mode === 'view'

  return (
    <Card className="shadow-xl">
      <CardContent className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <h2 className="text-2xl font-bold text-gray-800">
            {mode === 'add' ? 'Add Recurring Task' : mode === 'edit' ? 'Edit Recurring Task' : 'View Recurring Task'}
          </h2>
        </div>

        <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title <span className="text-red-500">*</span>
          </label>
          <Input
            value={formData.title}
            onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter task title"
            disabled={isViewMode}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter task description"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              disabled={isViewMode}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <Select
                value={formData.priority}
                onValueChange={value => setFormData(prev => ({ ...prev, priority: value }))}
                disabled={isViewMode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assigned To</label>
              <Select
                value={formData.assigned_to || ''}
                onValueChange={value => setFormData(prev => ({ ...prev, assigned_to: value || null }))}
                disabled={isViewMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {teamMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">Contact</label>
            {isViewMode ? (
              <Input
                value={selectedContact ? `${selectedContact.full_name} (${selectedContact.phone})` : 'No contact'}
                disabled
              />
            ) : (
              <div className="relative">
                <Input
                  value={selectedContact ? `${selectedContact.full_name} (${selectedContact.phone})` : contactSearchTerm}
                  onChange={e => {
                    if (!selectedContact) {
                      setContactSearchTerm(e.target.value)
                      setShowContactDropdown(true)
                    }
                  }}
                  onFocus={() => {
                    if (!selectedContact) {
                      setShowContactDropdown(true)
                    }
                  }}
                  placeholder="Search contact by name or phone"
                  className="pr-10"
                />
                {selectedContact && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, contact_id: null }))
                      setContactSearchTerm('')
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
            {showContactDropdown && !selectedContact && !isViewMode && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredContacts.length > 0 ? (
                  filteredContacts.map(contact => (
                    <div
                      key={contact.id}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, contact_id: contact.id }))
                        setContactSearchTerm('')
                        setShowContactDropdown(false)
                      }}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      <div className="font-medium">{contact.full_name}</div>
                      <div className="text-sm text-gray-500">{contact.phone}</div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-2 text-sm text-gray-500">No contacts found</div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recurrence Type <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={formData.recurrence_type === 'daily' ? 'default' : 'outline'}
                onClick={() => handleRecurrenceTypeChange('daily')}
                disabled={isViewMode}
              >
                Daily
              </Button>
              <Button
                type="button"
                variant={formData.recurrence_type === 'weekly' ? 'default' : 'outline'}
                onClick={() => handleRecurrenceTypeChange('weekly')}
                disabled={isViewMode}
              >
                Weekly
              </Button>
              <Button
                type="button"
                variant={formData.recurrence_type === 'monthly' ? 'default' : 'outline'}
                onClick={() => handleRecurrenceTypeChange('monthly')}
                disabled={isViewMode}
              >
                Monthly
              </Button>
            </div>
          </div>

          {formData.recurrence_type === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Days <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map(day => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={selectedStartDays.includes(day.value) ? 'default' : 'outline'}
                    onClick={() => handleStartDayToggle(day.value)}
                    disabled={isViewMode}
                    size="sm"
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {formData.recurrence_type === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Day of Month <span className="text-red-500">*</span>
              </label>
              <Select
                value={selectedStartDayOfMonth.toString()}
                onValueChange={value => {
                  const day = parseInt(value)
                  setSelectedStartDayOfMonth(day)
                  setFormData(prev => ({ ...prev, start_day_of_month: day }))
                }}
                disabled={isViewMode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {daysOfMonth.map(day => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time <span className="text-red-500">*</span>
              </label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={e => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                disabled={isViewMode}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Time <span className="text-red-500">*</span>
              </label>
              <Input
                type="time"
                value={formData.due_time}
                onChange={e => setFormData(prev => ({ ...prev, due_time: e.target.value }))}
                disabled={isViewMode}
              />
            </div>
          </div>

          {formData.recurrence_type === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Due Days</label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map(day => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={selectedDueDays.includes(day.value) ? 'default' : 'outline'}
                    onClick={() => handleDueDayToggle(day.value)}
                    disabled={isViewMode}
                    size="sm"
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {formData.recurrence_type === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Due Day of Month</label>
              <Select
                value={selectedDueDayOfMonth.toString()}
                onValueChange={value => {
                  const day = parseInt(value)
                  setSelectedDueDayOfMonth(day)
                  setFormData(prev => ({ ...prev, due_day_of_month: day }))
                }}
                disabled={isViewMode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {daysOfMonth.map(day => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Supporting Documents</label>
            {!isViewMode && (
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="recurring-file-upload"
                  disabled={uploadingFiles}
                />
                <label htmlFor="recurring-file-upload">
                  <Button type="button" variant="outline" size="sm" disabled={uploadingFiles} asChild>
                    <span className="cursor-pointer">
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingFiles ? 'Uploading...' : 'Upload Files'}
                    </span>
                  </Button>
                </label>
              </div>
            )}
            {formData.supporting_docs.length > 0 && (
              <div className="space-y-2">
                {formData.supporting_docs.map((doc, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <a
                      href={doc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline truncate flex-1"
                    >
                      {doc.split('/').pop()}
                    </a>
                    {!isViewMode && (
                      <button
                        onClick={() => handleRemoveFile(doc)}
                        className="text-red-600 hover:text-red-800 ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isViewMode && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is-active"
                checked={formData.is_active}
                onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
              />
              <label htmlFor="is-active" className="text-sm text-gray-700">
                Active
              </label>
            </div>
          )}

          {isViewMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <Badge variant={formData.is_active ? 'default' : 'secondary'}>
                {formData.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          )}
        </div>

        {!isViewMode && (
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={onBack}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              <Save className="w-4 h-4 mr-2" />
              {mode === 'add' ? 'Create Task' : 'Update Task'}
            </Button>
          </div>
        )}

        {isViewMode && (
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={onBack}>
              Close
            </Button>
            {onEdit && (
              <Button onClick={onEdit}>
                Edit Task
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
