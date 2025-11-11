import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Edit, X, Save, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'

interface CustomField {
  id: string
  field_key: string
  custom_tab_id: string
  field_name: string
  field_type: 'text' | 'dropdown_single' | 'dropdown_multiple' | 'date' | 'number' | 'email' | 'phone' | 'url' | 'currency' | 'longtext'
  dropdown_options: string[]
  is_required: boolean
  display_order: number
  is_active: boolean
  created_at: string
}

interface CustomFieldsManagerProps {
  customTabId: string
  tabName: string
}

const fieldTypeLabels: Record<string, string> = {
  text: 'Text Field',
  dropdown_single: 'Dropdown (Single)',
  dropdown_multiple: 'Dropdown (Multiple)',
  date: 'Date Picker',
  number: 'Number Field',
  email: 'Email Field',
  phone: 'Phone Number Field',
  url: 'URL Field',
  currency: 'Currency Field',
  longtext: 'Long Text Field',
  range: 'Range',
  file_upload: 'File Upload'
}

export function CustomFieldsManager({ customTabId, tabName }: CustomFieldsManagerProps) {
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [newField, setNewField] = useState({
    field_name: '',
    field_type: 'text' as const,
    dropdown_options: '',
    is_required: false
  })

  useEffect(() => {
    fetchFields()
  }, [customTabId])

  const fetchFields = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('custom_tab_id', customTabId)
        .order('display_order')

      if (error) throw error

      setFields(data || [])
    } catch (error) {
      console.error('Error fetching custom fields:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddField = async () => {
    if (!newField.field_name.trim()) {
      setMessage({ type: 'error', text: 'Please enter a field name' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    if ((newField.field_type === 'dropdown_single' || newField.field_type === 'dropdown_multiple') && !newField.dropdown_options.trim()) {
      setMessage({ type: 'error', text: 'Please enter dropdown options' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    setSaving(true)
    try {
      const fieldKey = `custom_${Date.now()}_${newField.field_name.toLowerCase().replace(/\s+/g, '_')}`
      const dropdownOpts = (newField.field_type === 'dropdown_single' || newField.field_type === 'dropdown_multiple')
        ? newField.dropdown_options.split(',').map(opt => opt.trim()).filter(opt => opt)
        : []

      const { error } = await supabase
        .from('custom_fields')
        .insert([{
          field_key: fieldKey,
          custom_tab_id: customTabId,
          field_name: newField.field_name.trim(),
          field_type: newField.field_type,
          dropdown_options: dropdownOpts,
          is_required: newField.is_required,
          display_order: fields.length,
          is_active: true
        }])

      if (error) throw error

      setMessage({ type: 'success', text: 'Custom field added successfully' })
      setNewField({ field_name: '', field_type: 'text', dropdown_options: '', is_required: false })
      setShowAddForm(false)
      await fetchFields()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error adding custom field:', error)
      setMessage({ type: 'error', text: 'Failed to add custom field' })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('Are you sure you want to delete this custom field? All associated data will be lost.')) {
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('custom_fields')
        .delete()
        .eq('id', fieldId)

      if (error) throw error

      setMessage({ type: 'success', text: 'Field deleted successfully' })
      await fetchFields()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error deleting custom field:', error)
      setMessage({ type: 'error', text: 'Failed to delete field' })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (fieldId: string, currentStatus: boolean) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('custom_fields')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', fieldId)

      if (error) throw error

      setMessage({ type: 'success', text: `Field ${!currentStatus ? 'activated' : 'deactivated'} successfully` })
      await fetchFields()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error toggling field status:', error)
      setMessage({ type: 'error', text: 'Failed to update field status' })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-600">Loading fields...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`p-4 rounded-lg flex items-center space-x-2 ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </motion.div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Custom Fields for "{tabName}"
        </h3>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Field
          </Button>
        )}
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="border-2 border-brand-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Add New Field</CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowAddForm(false)
                      setNewField({ field_name: '', field_type: 'text', dropdown_options: '', is_required: false })
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Field Name *</label>
                    <Input
                      placeholder="e.g., Preferred Contact Time"
                      value={newField.field_name}
                      onChange={(e) => setNewField(prev => ({ ...prev, field_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Field Type *</label>
                    <Select
                      value={newField.field_type}
                      onValueChange={(value: any) => setNewField(prev => ({ ...prev, field_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text Field</SelectItem>
                        <SelectItem value="number">Number Field</SelectItem>
                        <SelectItem value="email">Email Field</SelectItem>
                        <SelectItem value="phone">Phone Number Field</SelectItem>
                        <SelectItem value="url">URL Field</SelectItem>
                        <SelectItem value="currency">Currency Field</SelectItem>
                        <SelectItem value="longtext">Long Text Field</SelectItem>
                        <SelectItem value="dropdown_single">Dropdown (Single)</SelectItem>
                        <SelectItem value="dropdown_multiple">Dropdown (Multiple)</SelectItem>
                        <SelectItem value="date">Date Picker</SelectItem>
                        <SelectItem value="range">Range</SelectItem>
                        <SelectItem value="file_upload">File Upload</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(newField.field_type === 'dropdown_single' || newField.field_type === 'dropdown_multiple') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Dropdown Options * (comma-separated)
                    </label>
                    <Input
                      placeholder="e.g., Option 1, Option 2, Option 3"
                      value={newField.dropdown_options}
                      onChange={(e) => setNewField(prev => ({ ...prev, dropdown_options: e.target.value }))}
                    />
                    <p className="text-xs text-gray-500 mt-1">Separate each option with a comma</p>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_required"
                    checked={newField.is_required}
                    onChange={(e) => setNewField(prev => ({ ...prev, is_required: e.target.checked }))}
                    className="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
                  />
                  <label htmlFor="is_required" className="text-sm text-gray-700">
                    Make this field required
                  </label>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false)
                      setNewField({ field_name: '', field_type: 'text', dropdown_options: '', is_required: false })
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddField} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Field
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {fields.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-2">No custom fields created yet</p>
          <p className="text-sm text-gray-400">Add your first custom field for this tab</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Field Name</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Unique Key</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Created On</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <motion.tr
                  key={field.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{field.field_name}</span>
                      {field.is_required && (
                        <Badge variant="secondary" className="bg-red-50 text-red-700 text-xs">
                          Required
                        </Badge>
                      )}
                    </div>
                    {(field.field_type === 'dropdown_single' || field.field_type === 'dropdown_multiple') && field.dropdown_options.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Options: {field.dropdown_options.join(', ')}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                      {fieldTypeLabels[field.field_type]}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                      {field.field_key}
                    </code>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {formatDate(field.created_at)}
                  </td>
                  <td className="py-3 px-4">
                    <Badge className={field.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {field.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleActive(field.id, field.is_active)}
                        disabled={saving}
                      >
                        {field.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteField(field.id)}
                        disabled={saving}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
