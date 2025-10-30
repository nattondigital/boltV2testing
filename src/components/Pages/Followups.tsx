import React, { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { MessageSquare, Edit, Save, X } from 'lucide-react'
import { PageHeader } from '../Common/PageHeader'
import { supabase } from '../../lib/supabase'
import { Badge } from '../ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Input } from '../ui/input'

interface FollowupAssignment {
  id: string
  trigger_event: string
  module: string
  whatsapp_template_id: string | null
  created_at: string
  updated_at: string
}

interface WhatsAppTemplate {
  id: string
  name: string
  type: string
  status: string
}

const moduleColors: Record<string, string> = {
  'Leads': 'bg-pink-100 text-pink-800',
  'Tasks': 'bg-blue-100 text-blue-800',
  'Appointments': 'bg-green-100 text-green-800',
  'Contacts': 'bg-purple-100 text-purple-800',
  'Support': 'bg-orange-100 text-orange-800',
}

export function Followups() {
  const [assignments, setAssignments] = useState<FollowupAssignment[]>([])
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<{
    trigger_event: string
    module: string
    whatsapp_template_id: string | null
  } | null>(null)

  useEffect(() => {
    loadAssignments()
    loadTemplates()
  }, [])

  const loadAssignments = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('followup_assignments')
        .select('*')
        .order('module', { ascending: true })

      if (error) throw error
      setAssignments(data || [])
    } catch (error) {
      console.error('Error loading followup assignments:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('id, name, type, status')
        .eq('status', 'Published')
        .order('name', { ascending: true })

      if (error) throw error
      setTemplates(data || [])
    } catch (error) {
      console.error('Error loading WhatsApp templates:', error)
    }
  }

  const handleEdit = (assignment: FollowupAssignment) => {
    setEditingId(assignment.id)
    setEditingData({
      trigger_event: assignment.trigger_event,
      module: assignment.module,
      whatsapp_template_id: assignment.whatsapp_template_id || '__none__'
    })
  }

  const handleSave = async (assignmentId: string) => {
    if (!editingData) return

    try {
      setLoading(true)

      const { error } = await supabase
        .from('followup_assignments')
        .update({
          trigger_event: editingData.trigger_event,
          module: editingData.module,
          whatsapp_template_id: editingData.whatsapp_template_id === '__none__' ? null : editingData.whatsapp_template_id
        })
        .eq('id', assignmentId)

      if (error) throw error

      await loadAssignments()
      setEditingId(null)
      setEditingData(null)
    } catch (error: any) {
      console.error('Error saving followup assignment:', error)
      alert(error.message || 'Failed to save followup assignment')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditingData(null)
  }

  const formatTriggerEvent = (event: string) => {
    return event
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ')
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Followup Assignments"
        subtitle="Manage automated followup actions and WhatsApp templates for trigger events"
      />

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-brand-primary" />
            <span>Followup Assignments</span>
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Configure WhatsApp templates for different trigger events across modules.
            This helps automate followup communications for leads, tasks, appointments, and more.
          </p>
        </CardHeader>
        <CardContent>
          {loading && assignments.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
              <p className="mt-4 text-gray-600">Loading assignments...</p>
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No followup assignments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Trigger Event</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Module</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">WhatsApp Template</th>
                    <th className="text-right py-3 px-4 font-semibold text-brand-text">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => {
                    const isEditing = editingId === assignment.id
                    const template = templates.find(t => t.id === assignment.whatsapp_template_id)

                    return (
                      <tr
                        key={assignment.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          {isEditing ? (
                            <Input
                              value={editingData?.trigger_event || ''}
                              onChange={(e) => setEditingData(editingData ? { ...editingData, trigger_event: e.target.value } : null)}
                              placeholder="e.g., LEAD_CREATED"
                              className="w-full"
                            />
                          ) : (
                            <>
                              <div className="font-medium text-gray-900">
                                {formatTriggerEvent(assignment.trigger_event)}
                              </div>
                              <div className="text-xs text-gray-500 font-mono mt-1">
                                {assignment.trigger_event}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isEditing ? (
                            <Input
                              value={editingData?.module || ''}
                              onChange={(e) => setEditingData(editingData ? { ...editingData, module: e.target.value } : null)}
                              placeholder="e.g., Leads"
                              className="w-32"
                            />
                          ) : (
                            <Badge
                              className={moduleColors[assignment.module] || 'bg-gray-100 text-gray-800'}
                              variant="secondary"
                            >
                              {assignment.module}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isEditing ? (
                            <Select
                              value={editingData?.whatsapp_template_id || '__none__'}
                              onValueChange={(value) => setEditingData(editingData ? { ...editingData, whatsapp_template_id: value } : null)}
                            >
                              <SelectTrigger className="w-64">
                                <SelectValue placeholder="Select a template..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">
                                  <span className="text-gray-500">No template assigned</span>
                                </SelectItem>
                                {templates.map((template) => (
                                  <SelectItem key={template.id} value={template.id}>
                                    <div className="flex items-center space-x-2">
                                      <MessageSquare className="w-4 h-4 text-gray-400" />
                                      <span>{template.name} ({template.type})</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex items-center space-x-2">
                              {template ? (
                                <>
                                  <MessageSquare className="w-4 h-4 text-gray-400" />
                                  <span className="text-gray-900">{template.name}</span>
                                </>
                              ) : (
                                <span className="text-gray-500 italic">No template assigned</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end space-x-2">
                            {isEditing ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleSave(assignment.id)}
                                  disabled={loading}
                                  className="h-8"
                                >
                                  <Save className="w-4 h-4 mr-1" />
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancel}
                                  disabled={loading}
                                  className="h-8"
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(assignment)}
                                className="h-8"
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Edit
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
