import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Save, X, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { CustomFieldsManager } from './CustomFieldsManager'

interface CustomTab {
  id: string
  tab_id: string
  pipeline_id: string
  tab_name: string
  tab_order: number
  is_active: boolean
}

interface Pipeline {
  id: string
  pipeline_id: string
  name: string
  entity_type: string
}

export function CustomFieldsSettings() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('')
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingTab, setEditingTab] = useState<string | null>(null)
  const [newTabName, setNewTabName] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [expandedTabId, setExpandedTabId] = useState<string | null>(null)

  useEffect(() => {
    fetchPipelines()
  }, [])

  useEffect(() => {
    if (selectedPipelineId) {
      fetchCustomTabs()
    }
  }, [selectedPipelineId])

  const fetchPipelines = async () => {
    try {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, pipeline_id, name, entity_type')
        .eq('entity_type', 'lead')
        .eq('is_active', true)
        .order('display_order')

      if (error) throw error

      setPipelines(data || [])
      if (data && data.length > 0) {
        setSelectedPipelineId(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching pipelines:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomTabs = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_lead_tabs')
        .select('*')
        .eq('pipeline_id', selectedPipelineId)
        .order('tab_order')

      if (error) throw error

      setCustomTabs(data || [])
    } catch (error) {
      console.error('Error fetching custom tabs:', error)
    }
  }

  const handleAddTab = async () => {
    if (customTabs.length >= 10) {
      setMessage({ type: 'error', text: 'Maximum 10 custom tabs allowed per pipeline' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    if (!newTabName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a tab name' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    setSaving(true)
    try {
      const nextOrder = customTabs.length + 1
      const tabId = `custom_tab_${Date.now()}`

      const { error } = await supabase
        .from('custom_lead_tabs')
        .insert([{
          tab_id: tabId,
          pipeline_id: selectedPipelineId,
          tab_name: newTabName.trim(),
          tab_order: nextOrder,
          is_active: true
        }])

      if (error) throw error

      setMessage({ type: 'success', text: 'Custom tab added successfully' })
      setNewTabName('')
      await fetchCustomTabs()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error adding custom tab:', error)
      setMessage({ type: 'error', text: 'Failed to add custom tab' })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateTab = async (tabId: string, newName: string) => {
    if (!newName.trim()) {
      setMessage({ type: 'error', text: 'Tab name cannot be empty' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('custom_lead_tabs')
        .update({ tab_name: newName.trim(), updated_at: new Date().toISOString() })
        .eq('id', tabId)

      if (error) throw error

      setMessage({ type: 'success', text: 'Tab updated successfully' })
      setEditingTab(null)
      await fetchCustomTabs()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error updating custom tab:', error)
      setMessage({ type: 'error', text: 'Failed to update tab' })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTab = async (tabId: string) => {
    if (!confirm('Are you sure you want to delete this custom tab? This action cannot be undone.')) {
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('custom_lead_tabs')
        .delete()
        .eq('id', tabId)

      if (error) throw error

      setMessage({ type: 'success', text: 'Tab deleted successfully' })
      await fetchCustomTabs()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error deleting custom tab:', error)
      setMessage({ type: 'error', text: 'Failed to delete tab' })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (tabId: string, currentStatus: boolean) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('custom_lead_tabs')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', tabId)

      if (error) throw error

      setMessage({ type: 'success', text: `Tab ${!currentStatus ? 'activated' : 'deactivated'} successfully` })
      await fetchCustomTabs()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error toggling tab status:', error)
      setMessage({ type: 'error', text: 'Failed to update tab status' })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle>Custom Lead Tabs</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Create up to 3 custom tabs for each pipeline. These tabs will appear as sub-tabs within the Lead Details section of the lead view page.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Pipeline</label>
            <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Custom Tabs ({customTabs.length}/10)
              </h3>
              {customTabs.length < 10 && (
                <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                  {10 - customTabs.length} slots available
                </Badge>
              )}
            </div>

            {customTabs.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500 mb-2">No custom tabs created yet</p>
                <p className="text-sm text-gray-400">Add your first custom tab below</p>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                {customTabs.map((tab, index) => (
                  <motion.div
                    key={tab.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-4 bg-gray-50">
                      <div className="flex items-center space-x-4 flex-1">
                        <Badge variant="secondary" className="bg-brand-primary text-white">
                          Tab {tab.tab_order}
                        </Badge>
                        {editingTab === tab.id ? (
                          <Input
                            defaultValue={tab.tab_name}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateTab(tab.id, e.currentTarget.value)
                              } else if (e.key === 'Escape') {
                                setEditingTab(null)
                              }
                            }}
                            autoFocus
                            className="max-w-md"
                          />
                        ) : (
                          <div className="flex items-center space-x-3">
                            <span className="font-medium text-gray-900">{tab.tab_name}</span>
                            <Badge className={tab.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                              {tab.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {editingTab === tab.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const input = document.querySelector(`input[value="${tab.tab_name}"]`) as HTMLInputElement
                                if (input) {
                                  handleUpdateTab(tab.id, input.value)
                                }
                              }}
                              disabled={saving}
                            >
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingTab(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setExpandedTabId(expandedTabId === tab.id ? null : tab.id)}
                            >
                              {expandedTabId === tab.id ? (
                                <>
                                  <ChevronUp className="w-4 h-4 mr-2" />
                                  Hide Fields
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-4 h-4 mr-2" />
                                  Manage Fields
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingTab(tab.id)}
                              disabled={saving}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleActive(tab.id, tab.is_active)}
                              disabled={saving}
                            >
                              {tab.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteTab(tab.id)}
                              disabled={saving}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {expandedTabId === tab.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-gray-200 p-4 bg-white"
                      >
                        <CustomFieldsManager customTabId={tab.id} tabName={tab.tab_name} />
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {customTabs.length < 10 && (
              <div className="border-t pt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Add New Tab</h4>
                <div className="flex items-center space-x-3">
                  <Input
                    placeholder="Enter tab name (e.g., Additional Details, Custom Info)"
                    value={newTabName}
                    onChange={(e) => setNewTabName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddTab()
                      }
                    }}
                    className="flex-1"
                  />
                  <Button onClick={handleAddTab} disabled={saving || !newTabName.trim()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Tab
                  </Button>
                </div>
              </div>
            )}

            {customTabs.length >= 10 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Maximum tabs reached</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    You have reached the maximum limit of 10 custom tabs for this pipeline. Delete an existing tab to add a new one.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How Custom Tabs Work</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start space-x-2">
              <span className="text-brand-primary font-bold">1.</span>
              <span>Custom tabs are specific to each pipeline and will only appear for leads in that pipeline.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-brand-primary font-bold">2.</span>
              <span>Custom tabs appear as sub-tabs within the "Lead Details" main tab, after the "Lead Information" sub-tab.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-brand-primary font-bold">3.</span>
              <span>You can create up to 3 custom tabs per pipeline to organize additional lead information.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-brand-primary font-bold">4.</span>
              <span>Inactive tabs will not be visible in the lead pages but can be reactivated anytime.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-brand-primary font-bold">5.</span>
              <span>Add custom fields to each tab by clicking "Manage Fields" to capture additional lead information.</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
