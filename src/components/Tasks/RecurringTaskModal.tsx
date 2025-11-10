import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Save, Upload, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

interface RecurringTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  task?: RecurringTask | null
  teamMembers: TeamMember[]
  contacts: Contact[]
}

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
    }
  }

  return nextRecurrence.toISOString()
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

export const RecurringTaskModal: React.FC<RecurringTaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  task,
  teamMembers,
  contacts
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
      if (task.start_days) {
        setSelectedStartDays(task.start_days)
      }
      if (task.start_day_of_month !== null) {
        setSelectedStartDayOfMonth(task.start_day_of_month)
      }
      if (task.due_days) {
        setSelectedDueDays(task.due_days)
      }
      if (task.due_day_of_month !== null) {
        setSelectedDueDayOfMonth(task.due_day_of_month)
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
      setSelectedStartDays([])
      setSelectedStartDayOfMonth(1)
      setSelectedDueDays([])
      setSelectedDueDayOfMonth(1)
    }
  }, [task])

  const handleRecurrenceTypeChange = (type: 'daily' | 'weekly' | 'monthly') => {
    setFormData(prev => ({
      ...prev,
      recurrence_type: type,
      start_days: type === 'weekly' ? selectedStartDays : null,
      start_day_of_month: type === 'monthly' ? selectedStartDayOfMonth : null,
      due_days: type === 'weekly' ? selectedDueDays : null,
      due_day_of_month: type === 'monthly' ? selectedDueDayOfMonth : null
    }))
  }

  const handleStartDayToggle = (day: string) => {
    const newDays = selectedStartDays.includes(day)
      ? selectedStartDays.filter(d => d !== day)
      : [...selectedStartDays, day]
    setSelectedStartDays(newDays)
    setFormData(prev => ({ ...prev, start_days: newDays }))
  }

  const handleDueDayToggle = (day: string) => {
    const newDays = selectedDueDays.includes(day)
      ? selectedDueDays.filter(d => d !== day)
      : [...selectedDueDays, day]
    setSelectedDueDays(newDays)
    setFormData(prev => ({ ...prev, due_days: newDays }))
  }

  const handleStartDayOfMonthChange = (day: number) => {
    setSelectedStartDayOfMonth(day)
    setFormData(prev => ({ ...prev, start_day_of_month: day }))
  }

  const handleDueDayOfMonthChange = (day: number) => {
    setSelectedDueDayOfMonth(day)
    setFormData(prev => ({ ...prev, due_day_of_month: day }))
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    setUploadingFiles(true)
    const uploadedUrls: string[] = []

    for (const file of Array.from(e.target.files)) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `recurring-task-docs/${fileName}`

      const { error: uploadError, data } = await supabase.storage
        .from('media-files')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Error uploading file:', uploadError)
        continue
      }

      const { data: { publicUrl } } = supabase.storage
        .from('media-files')
        .getPublicUrl(filePath)

      uploadedUrls.push(publicUrl)
    }

    setFormData(prev => ({
      ...prev,
      supporting_docs: [...prev.supporting_docs, ...uploadedUrls]
    }))
    setUploadingFiles(false)
  }

  const handleRemoveDocument = (url: string) => {
    setFormData(prev => ({
      ...prev,
      supporting_docs: prev.supporting_docs.filter(doc => doc !== url)
    }))
  }

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      alert('Please enter a task title')
      return
    }

    if (formData.recurrence_type === 'weekly') {
      if (!formData.start_days || formData.start_days.length === 0) {
        alert('Please select at least one start day for weekly recurrence')
        return
      }
      if (!formData.due_days || formData.due_days.length === 0) {
        alert('Please select at least one due day for weekly recurrence')
        return
      }
    }

    if (formData.recurrence_type === 'monthly') {
      if (formData.start_day_of_month === null) {
        alert('Please select a start day of the month')
        return
      }
      if (formData.due_day_of_month === null) {
        alert('Please select a due day of the month')
        return
      }
    }

    try {
      if (task?.id) {
        const { error } = await supabase
          .from('recurring_tasks')
          .update({
            title: formData.title,
            description: formData.description,
            contact_id: formData.contact_id,
            assigned_to: formData.assigned_to,
            priority: formData.priority,
            recurrence_type: formData.recurrence_type,
            start_time: formData.start_time,
            start_days: formData.start_days,
            start_day_of_month: formData.start_day_of_month,
            due_time: formData.due_time,
            due_days: formData.due_days,
            due_day_of_month: formData.due_day_of_month,
            supporting_docs: formData.supporting_docs,
            is_active: formData.is_active
          })
          .eq('id', task.id)

        if (error) throw error
      } else {
        const nextRecurrence = calculateInitialNextRecurrence(formData)

        const { error } = await supabase
          .from('recurring_tasks')
          .insert([{
            ...formData,
            next_recurrence: nextRecurrence
          }])

        if (error) throw error
      }

      onSave()
      onClose()
    } catch (error) {
      console.error('Error saving recurring task:', error)
      alert('Failed to save recurring task')
    }
  }

  const filteredContacts = contacts.filter(contact =>
    contact.full_name.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
    contact.phone.includes(contactSearchTerm)
  )

  const selectedContact = contacts.find(c => c.id === formData.contact_id)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold text-gray-900">
            {task ? 'Edit Recurring Task' : 'Add Recurring Task'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter task title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
              rows={3}
              placeholder="Enter task description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <Select value={formData.priority} onValueChange={value => setFormData(prev => ({ ...prev, priority: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assigned To</label>
              <Select value={formData.assigned_to || ''} onValueChange={value => setFormData(prev => ({ ...prev, assigned_to: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
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
            <Input
              value={selectedContact ? `${selectedContact.full_name} (${selectedContact.phone})` : contactSearchTerm}
              onChange={e => {
                setContactSearchTerm(e.target.value)
                setShowContactDropdown(true)
              }}
              onFocus={() => setShowContactDropdown(true)}
              placeholder="Search contact by name or phone"
            />
            {showContactDropdown && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredContacts.map(contact => (
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
                ))}
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
                className="flex-1"
              >
                Daily
              </Button>
              <Button
                type="button"
                variant={formData.recurrence_type === 'weekly' ? 'default' : 'outline'}
                onClick={() => handleRecurrenceTypeChange('weekly')}
                className="flex-1"
              >
                Weekly
              </Button>
              <Button
                type="button"
                variant={formData.recurrence_type === 'monthly' ? 'default' : 'outline'}
                onClick={() => handleRecurrenceTypeChange('monthly')}
                className="flex-1"
              >
                Monthly
              </Button>
            </div>
          </div>

          {formData.recurrence_type === 'daily' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time <span className="text-red-500">*</span>
                </label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={e => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
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
                />
              </div>
            </div>
          )}

          {formData.recurrence_type === 'weekly' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Days <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {daysOfWeek.map(day => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={selectedStartDays.includes(day.value) ? 'default' : 'outline'}
                      onClick={() => handleStartDayToggle(day.value)}
                      className="flex-1 min-w-[60px]"
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time <span className="text-red-500">*</span>
                </label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={e => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Days <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {daysOfWeek.map(day => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={selectedDueDays.includes(day.value) ? 'default' : 'outline'}
                      onClick={() => handleDueDayToggle(day.value)}
                      className="flex-1 min-w-[60px]"
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Time <span className="text-red-500">*</span>
                </label>
                <Input
                  type="time"
                  value={formData.due_time}
                  onChange={e => setFormData(prev => ({ ...prev, due_time: e.target.value }))}
                />
              </div>
            </div>
          )}

          {formData.recurrence_type === 'monthly' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Day of Month <span className="text-red-500">*</span>
                  </label>
                  <Select value={selectedStartDayOfMonth.toString()} onValueChange={value => handleStartDayOfMonthChange(Number(value))}>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="time"
                    value={formData.start_time}
                    onChange={e => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Day of Month <span className="text-red-500">*</span>
                  </label>
                  <Select value={selectedDueDayOfMonth.toString()} onValueChange={value => handleDueDayOfMonthChange(Number(value))}>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Time <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="time"
                    value={formData.due_time}
                    onChange={e => setFormData(prev => ({ ...prev, due_time: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Supporting Documents</label>
            <div className="space-y-2">
              <label className="flex items-center justify-center w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-brand-primary cursor-pointer">
                <Upload className="w-5 h-5 mr-2" />
                <span>{uploadingFiles ? 'Uploading...' : 'Upload Files'}</span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploadingFiles}
                />
              </label>

              {formData.supporting_docs.length > 0 && (
                <div className="space-y-2">
                  {formData.supporting_docs.map((url, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand-primary hover:underline truncate flex-1"
                      >
                        Document {index + 1}
                      </a>
                      <button
                        onClick={() => handleRemoveDocument(url)}
                        className="ml-2 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <Save className="w-4 h-4 mr-2" />
            {task ? 'Update' : 'Create'} Recurring Task
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
