import React from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Upload, Trash2, Eye, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PermissionGuard } from '@/components/Common/PermissionGuard'

interface RecurringTaskFormsProps {
  view: 'add' | 'edit' | 'view'
  formData: {
    title: string
    description: string
    contactId: string | null
    assignedTo: string | null
    priority: string
    recurrenceType: 'daily' | 'weekly' | 'monthly'
    startTime: string
    startDays: string[]
    startDayOfMonth: number
    dueTime: string
    dueDays: string[]
    dueDayOfMonth: number
    supportingDocs: string[]
    isActive: boolean
  }
  setFormData: React.Dispatch<React.SetStateAction<any>>
  selectedTask: any
  teamMembers: Array<{ id: string; name: string; email: string }>
  contacts: Array<{ id: string; full_name: string; phone: string }>
  contactSearchTerm: string
  setContactSearchTerm: (value: string) => void
  showContactDropdown: boolean
  setShowContactDropdown: (value: boolean) => void
  selectedContact: any
  uploadingFiles: boolean
  daysOfWeek: Array<{ value: string; label: string }>
  daysOfMonth: Array<{ value: number; label: string }>
  filteredContacts: any[]
  onSave: () => void
  onBack: () => void
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onEdit: () => void
}

export const RecurringTaskForms: React.FC<RecurringTaskFormsProps> = ({
  view,
  formData,
  setFormData,
  selectedTask,
  teamMembers,
  contacts,
  contactSearchTerm,
  setContactSearchTerm,
  showContactDropdown,
  setShowContactDropdown,
  selectedContact,
  uploadingFiles,
  daysOfWeek,
  daysOfMonth,
  filteredContacts,
  onSave,
  onBack,
  onFileUpload,
  onEdit
}) => {
  const isView = view === 'view'

  const handleStartDayToggle = (day: string) => {
    const newDays = [day]
    setFormData((prev: any) => ({ ...prev, startDays: newDays }))
  }

  const handleDueDayToggle = (day: string) => {
    const newDays = [day]
    setFormData((prev: any) => ({ ...prev, dueDays: newDays }))
  }

  const handleRecurrenceTypeChange = (type: 'daily' | 'weekly' | 'monthly') => {
    setFormData((prev: any) => ({
      ...prev,
      recurrenceType: type,
      startDays: type === 'weekly' ? (prev.startDays.length > 0 ? prev.startDays : []) : [],
      startDayOfMonth: type === 'monthly' ? prev.startDayOfMonth : 1,
      dueDays: type === 'weekly' ? (prev.dueDays.length > 0 ? prev.dueDays : []) : [],
      dueDayOfMonth: type === 'monthly' ? prev.dueDayOfMonth : 1
    }))
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={onBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to List
            </Button>
          </div>
          {isView && (
            <PermissionGuard module="tasks" action="update">
              <Button onClick={onEdit} className="flex items-center gap-2">
                <Edit2 className="w-4 h-4" />
                Edit
              </Button>
            </PermissionGuard>
          )}
        </div>

        <h3 className="text-2xl font-bold text-brand-text mb-6">
          {view === 'add' ? 'Add New Recurring Task' : view === 'edit' ? 'Edit Recurring Task' : 'View Recurring Task'}
        </h3>

        {selectedTask && view === 'view' && (
          <div className="mb-4">
            <Badge className="text-sm">RETASK ID: {selectedTask.recurrence_task_id}</Badge>
          </div>
        )}

        <div className="space-y-6 max-w-4xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            {isView ? (
              <p className="text-gray-900 py-2">{formData.title}</p>
            ) : (
              <Input
                value={formData.title}
                onChange={e => setFormData((prev: any) => ({ ...prev, title: e.target.value }))}
                placeholder="Enter task title"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            {isView ? (
              <p className="text-gray-900 py-2">{formData.description || 'No description'}</p>
            ) : (
              <textarea
                value={formData.description}
                onChange={e => setFormData((prev: any) => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                rows={3}
                placeholder="Enter task description"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              {isView ? (
                <p className="text-gray-900 py-2 capitalize">{formData.priority}</p>
              ) : (
                <Select value={formData.priority} onValueChange={value => setFormData((prev: any) => ({ ...prev, priority: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assigned To</label>
              {isView ? (
                <p className="text-gray-900 py-2">
                  {teamMembers.find(m => m.id === formData.assignedTo)?.name || 'Unassigned'}
                </p>
              ) : (
                <Select value={formData.assignedTo || ''} onValueChange={value => setFormData((prev: any) => ({ ...prev, assignedTo: value }))}>
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
              )}
            </div>
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">Contact</label>
            {isView ? (
              <p className="text-gray-900 py-2">
                {selectedContact ? `${selectedContact.full_name} (${selectedContact.phone})` : 'No contact'}
              </p>
            ) : (
              <>
                {selectedContact ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={`${selectedContact.full_name} (${selectedContact.phone})`}
                      readOnly
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormData((prev: any) => ({ ...prev, contactId: null }))
                        setContactSearchTerm('')
                      }}
                      className="flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      value={contactSearchTerm}
                      onChange={e => {
                        setContactSearchTerm(e.target.value)
                        setShowContactDropdown(true)
                      }}
                      onFocus={() => setShowContactDropdown(true)}
                      placeholder="Search contact by name or phone"
                    />
                    {showContactDropdown && filteredContacts.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredContacts.map(contact => (
                          <div
                            key={contact.id}
                            onClick={() => {
                              setFormData((prev: any) => ({ ...prev, contactId: contact.id }))
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
                  </>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recurrence Type <span className="text-red-500">*</span>
            </label>
            {isView ? (
              <p className="text-gray-900 py-2 capitalize">{formData.recurrenceType}</p>
            ) : (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={formData.recurrenceType === 'daily' ? 'default' : 'outline'}
                  onClick={() => handleRecurrenceTypeChange('daily')}
                  className="flex-1"
                >
                  Daily
                </Button>
                <Button
                  type="button"
                  variant={formData.recurrenceType === 'weekly' ? 'default' : 'outline'}
                  onClick={() => handleRecurrenceTypeChange('weekly')}
                  className="flex-1"
                >
                  Weekly
                </Button>
                <Button
                  type="button"
                  variant={formData.recurrenceType === 'monthly' ? 'default' : 'outline'}
                  onClick={() => handleRecurrenceTypeChange('monthly')}
                  className="flex-1"
                >
                  Monthly
                </Button>
              </div>
            )}
          </div>

          {formData.recurrenceType === 'daily' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time <span className="text-red-500">*</span>
                </label>
                {isView ? (
                  <p className="text-gray-900 py-2">{formData.startTime}</p>
                ) : (
                  <Input
                    type="time"
                    value={formData.startTime}
                    onChange={e => setFormData((prev: any) => ({ ...prev, startTime: e.target.value }))}
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Time <span className="text-red-500">*</span>
                </label>
                {isView ? (
                  <p className="text-gray-900 py-2">{formData.dueTime}</p>
                ) : (
                  <Input
                    type="time"
                    value={formData.dueTime}
                    onChange={e => setFormData((prev: any) => ({ ...prev, dueTime: e.target.value }))}
                  />
                )}
              </div>
            </div>
          )}

          {formData.recurrenceType === 'weekly' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Day <span className="text-red-500">*</span>
                </label>
                {isView ? (
                  <p className="text-gray-900 py-2 uppercase">{formData.startDays.join(', ')}</p>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {daysOfWeek.map(day => (
                      <Button
                        key={day.value}
                        type="button"
                        variant={formData.startDays.includes(day.value) ? 'default' : 'outline'}
                        onClick={() => handleStartDayToggle(day.value)}
                        className="flex-1 min-w-[60px]"
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time <span className="text-red-500">*</span>
                </label>
                {isView ? (
                  <p className="text-gray-900 py-2">{formData.startTime}</p>
                ) : (
                  <Input
                    type="time"
                    value={formData.startTime}
                    onChange={e => setFormData((prev: any) => ({ ...prev, startTime: e.target.value }))}
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Day <span className="text-red-500">*</span>
                </label>
                {isView ? (
                  <p className="text-gray-900 py-2 uppercase">{formData.dueDays.join(', ')}</p>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {daysOfWeek.map(day => (
                      <Button
                        key={day.value}
                        type="button"
                        variant={formData.dueDays.includes(day.value) ? 'default' : 'outline'}
                        onClick={() => handleDueDayToggle(day.value)}
                        className="flex-1 min-w-[60px]"
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Time <span className="text-red-500">*</span>
                </label>
                {isView ? (
                  <p className="text-gray-900 py-2">{formData.dueTime}</p>
                ) : (
                  <Input
                    type="time"
                    value={formData.dueTime}
                    onChange={e => setFormData((prev: any) => ({ ...prev, dueTime: e.target.value }))}
                  />
                )}
              </div>
            </div>
          )}

          {formData.recurrenceType === 'monthly' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Day of Month <span className="text-red-500">*</span>
                  </label>
                  {isView ? (
                    <p className="text-gray-900 py-2">
                      {daysOfMonth.find(d => d.value === formData.startDayOfMonth)?.label}
                    </p>
                  ) : (
                    <Select
                      value={formData.startDayOfMonth.toString()}
                      onValueChange={value => setFormData((prev: any) => ({ ...prev, startDayOfMonth: Number(value) }))}
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
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  {isView ? (
                    <p className="text-gray-900 py-2">{formData.startTime}</p>
                  ) : (
                    <Input
                      type="time"
                      value={formData.startTime}
                      onChange={e => setFormData((prev: any) => ({ ...prev, startTime: e.target.value }))}
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Day of Month <span className="text-red-500">*</span>
                  </label>
                  {isView ? (
                    <p className="text-gray-900 py-2">
                      {daysOfMonth.find(d => d.value === formData.dueDayOfMonth)?.label}
                    </p>
                  ) : (
                    <Select
                      value={formData.dueDayOfMonth.toString()}
                      onValueChange={value => setFormData((prev: any) => ({ ...prev, dueDayOfMonth: Number(value) }))}
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
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Time <span className="text-red-500">*</span>
                  </label>
                  {isView ? (
                    <p className="text-gray-900 py-2">{formData.dueTime}</p>
                  ) : (
                    <Input
                      type="time"
                      value={formData.dueTime}
                      onChange={e => setFormData((prev: any) => ({ ...prev, dueTime: e.target.value }))}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Supporting Documents</label>
            {isView ? (
              <div className="space-y-2">
                {formData.supportingDocs.length === 0 ? (
                  <p className="text-gray-500">No documents</p>
                ) : (
                  formData.supportingDocs.map((url, index) => (
                    <div key={index} className="flex items-center p-2 bg-gray-50 rounded">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand-primary hover:underline truncate flex-1"
                      >
                        Document {index + 1}
                      </a>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="flex items-center justify-center w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-brand-primary cursor-pointer">
                  <Upload className="w-5 h-5 mr-2" />
                  <span>{uploadingFiles ? 'Uploading...' : 'Upload Files'}</span>
                  <input
                    type="file"
                    multiple
                    onChange={onFileUpload}
                    className="hidden"
                    disabled={uploadingFiles}
                  />
                </label>

                {formData.supportingDocs.length > 0 && (
                  <div className="space-y-2">
                    {formData.supportingDocs.map((url, index) => (
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
                          onClick={() => setFormData((prev: any) => ({
                            ...prev,
                            supportingDocs: prev.supportingDocs.filter((_: string, i: number) => i !== index)
                          }))}
                          className="ml-2 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            {isView ? (
              <Badge className={formData.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                {formData.isActive ? 'Active' : 'Inactive'}
              </Badge>
            ) : (
              <Select
                value={formData.isActive ? 'active' : 'inactive'}
                onValueChange={value => setFormData((prev: any) => ({ ...prev, isActive: value === 'active' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {!isView && (
          <div className="flex items-center gap-3 pt-6 mt-6 border-t">
            <PermissionGuard module="tasks" action={view === 'add' ? 'insert' : 'update'}>
              <Button onClick={onSave}>
                <Save className="w-4 h-4 mr-2" />
                {view === 'add' ? 'Create Recurring Task' : 'Update Recurring Task'}
              </Button>
            </PermissionGuard>
            <Button variant="outline" onClick={onBack}>
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
