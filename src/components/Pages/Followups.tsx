import React, { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import { Input } from '../ui/input'
import { Plus, Search, Edit, Trash2, X } from 'lucide-react'
import { PageHeader } from '../Common/PageHeader'
import { supabase } from '../../lib/supabase'

interface FollowupAssignment {
  id: string
  trigger_event: string
  module: string
  whatsapp_template_id: string | null
  actions: string
  created_at: string
  updated_at: string
}

interface WhatsAppTemplate {
  id: string
  name: string
  type: string
  status: string
}

export function Followups() {
  const [assignments, setAssignments] = useState<FollowupAssignment[]>([])
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<FollowupAssignment | null>(null)
  const [formData, setFormData] = useState({
    trigger_event: '',
    module: '',
    whatsapp_template_id: '',
    actions: ''
  })

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

  const handleCreate = () => {
    setEditingAssignment(null)
    setFormData({
      trigger_event: '',
      module: '',
      whatsapp_template_id: '',
      actions: ''
    })
    setShowModal(true)
  }

  const handleEdit = (assignment: FollowupAssignment) => {
    setEditingAssignment(assignment)
    setFormData({
      trigger_event: assignment.trigger_event,
      module: assignment.module,
      whatsapp_template_id: assignment.whatsapp_template_id || '',
      actions: assignment.actions
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    try {
      setLoading(true)

      if (editingAssignment) {
        const { error } = await supabase
          .from('followup_assignments')
          .update({
            trigger_event: formData.trigger_event,
            module: formData.module,
            whatsapp_template_id: formData.whatsapp_template_id || null,
            actions: formData.actions
          })
          .eq('id', editingAssignment.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('followup_assignments')
          .insert({
            trigger_event: formData.trigger_event,
            module: formData.module,
            whatsapp_template_id: formData.whatsapp_template_id || null,
            actions: formData.actions
          })

        if (error) throw error
      }

      await loadAssignments()
      setShowModal(false)
    } catch (error: any) {
      console.error('Error saving followup assignment:', error)
      alert(error.message || 'Failed to save followup assignment')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this followup assignment?')) return

    try {
      setLoading(true)
      const { error } = await supabase
        .from('followup_assignments')
        .delete()
        .eq('id', id)

      if (error) throw error
      await loadAssignments()
    } catch (error) {
      console.error('Error deleting followup assignment:', error)
      alert('Failed to delete followup assignment')
    } finally {
      setLoading(false)
    }
  }

  const getTemplateName = (templateId: string | null) => {
    if (!templateId) return 'No Template'
    const template = templates.find(t => t.id === templateId)
    return template ? template.name : 'Unknown Template'
  }

  const filteredAssignments = assignments.filter(assignment =>
    assignment.trigger_event.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.actions.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const groupedAssignments = filteredAssignments.reduce((acc, assignment) => {
    if (!acc[assignment.module]) {
      acc[assignment.module] = []
    }
    acc[assignment.module].push(assignment)
    return acc
  }, {} as Record<string, FollowupAssignment[]>)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Followup Assignments"
        subtitle="Manage automated followup actions and WhatsApp templates for trigger events"
      />

      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search by trigger event, module, or actions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Add Assignment
        </Button>
      </div>

      {loading && assignments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filteredAssignments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {searchTerm ? 'No assignments found matching your search.' : 'No followup assignments yet. Create your first one!'}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedAssignments).map(([module, moduleAssignments]) => (
            <div key={module}>
              <h2 className="text-xl font-bold text-gray-800 mb-4">{module}</h2>
              <div className="grid grid-cols-1 gap-4">
                {moduleAssignments.map((assignment) => (
                  <Card key={assignment.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <h3 className="text-lg font-bold text-gray-800">
                              {assignment.trigger_event}
                            </h3>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {assignment.module}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                            <div>
                              <span className="text-sm font-medium text-gray-600">WhatsApp Template:</span>
                              <p className="text-sm text-gray-800 font-medium">
                                {getTemplateName(assignment.whatsapp_template_id)}
                              </p>
                            </div>

                            <div>
                              <span className="text-sm font-medium text-gray-600">Actions:</span>
                              <p className="text-sm text-gray-800 font-medium">{assignment.actions}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(assignment)}
                            disabled={loading}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(assignment.id)}
                            disabled={loading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {editingAssignment ? 'Edit Followup Assignment' : 'Create Followup Assignment'}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trigger Event *
                </label>
                <Input
                  placeholder="e.g., LEAD_CREATED, TASK_COMPLETED"
                  value={formData.trigger_event}
                  onChange={(e) => setFormData({ ...formData, trigger_event: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Module *
                </label>
                <Input
                  placeholder="e.g., Leads, Tasks, Appointments"
                  value={formData.module}
                  onChange={(e) => setFormData({ ...formData, module: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  WhatsApp Template
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.whatsapp_template_id}
                  onChange={(e) => setFormData({ ...formData, whatsapp_template_id: e.target.value })}
                >
                  <option value="">Select a template (optional)</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Actions *
                </label>
                <Input
                  placeholder="e.g., Send Welcome Message, Create Task, Update Status"
                  value={formData.actions}
                  onChange={(e) => setFormData({ ...formData, actions: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={loading || !formData.trigger_event || !formData.module || !formData.actions}
              >
                {loading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
