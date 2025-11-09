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
  recurrence_time: string
  recurrence_days: string[] | null
  recurrence_day_of_month: number | null
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
    recurrence_time: '09:00',
    recurrence_days: null,
    recurrence_day_of_month: null,
    supporting_docs: [],
    is_active: true
  })

  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [selectedDayOfMonth, setSelectedDayOfMonth] = useState<number>(1)
  const [contactSearchTerm, setContactSearchTerm] = useState('')
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)

  useEffect(() => {
    if (task) {
      setFormData(task)
      if (task.recurrence_days) {
        setSelectedDays(task.recurrence_days)
      }
      if (task.recurrence_day_of_month !== null) {
        setSelectedDayOfMonth(task.recurrence_day_of_month)
      }
    } else {
      setFormData({
        title: '',
        description: '',
        contact_id: null,
        assigned_to: null,
        priority: 'medium',
        recurrence_type: 'daily',
        recurrence_time: '09:00',
        recurrence_days: null,
        recurrence_day_of_month: null,
        supporting_docs: [],
        is_active: true
      })
      setSelectedDays([])
      setSelectedDayOfMonth(1)
    }
  }, [task])

  const handleRecurrenceTypeChange = (type: 'daily' | 'weekly' | 'monthly') => {
    setFormData(prev => ({
      ...prev,
      recurrence_type: type,
      recurrence_days: type === 'weekly' ? selectedDays : null,
      recurrence_day_of_month: type === 'monthly' ? selectedDayOfMonth : null
    }))
  }

  const handleDayToggle = (day: string) => {
    const newDays = selectedDays.includes(day)
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day]
    setSelectedDays(newDays)
    setFormData(prev => ({ ...prev, recurrence_days: newDays }))
  }

  const handleDayOfMonthChange = (day: number) => {
    setSelectedDayOfMonth(day)
    setFormData(prev => ({ ...prev, recurrence_day_of_month: day }))
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

    if (formData.recurrence_type === 'weekly' && (!formData.recurrence_days || formData.recurrence_days.length === 0)) {
      alert('Please select at least one day for weekly recurrence')
      return
    }

    if (formData.recurrence_type === 'monthly' && formData.recurrence_day_of_month === null) {
      alert('Please select a day of the month')
      return
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
            recurrence_time: formData.recurrence_time,
            recurrence_days: formData.recurrence_days,
            recurrence_day_of_month: formData.recurrence_day_of_month,
            supporting_docs: formData.supporting_docs,
            is_active: formData.is_active
          })
          .eq('id', task.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('recurring_tasks')
          .insert([formData])

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

          {formData.recurrence_type === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Days <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                {daysOfWeek.map(day => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={selectedDays.includes(day.value) ? 'default' : 'outline'}
                    onClick={() => handleDayToggle(day.value)}
                    className="flex-1 min-w-[60px]"
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
                Day of Month <span className="text-red-500">*</span>
              </label>
              <Select value={selectedDayOfMonth.toString()} onValueChange={value => handleDayOfMonthChange(Number(value))}>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time <span className="text-red-500">*</span>
            </label>
            <Input
              type="time"
              value={formData.recurrence_time}
              onChange={e => setFormData(prev => ({ ...prev, recurrence_time: e.target.value }))}
            />
          </div>

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
