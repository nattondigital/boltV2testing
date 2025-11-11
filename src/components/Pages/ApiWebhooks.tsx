import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Globe, Edit, Trash2, Power, Copy, Check, X, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase'

interface ApiWebhook {
  id: string
  name: string
  trigger_event: string
  webhook_url: string
  is_active: boolean
  description: string
  last_triggered: string | null
  total_calls: number
  success_count: number
  failure_count: number
  created_at: string
}

interface TriggerEvent {
  value: string
  label: string
  module: string
}

export function ApiWebhooks() {
  const [webhooks, setWebhooks] = useState<ApiWebhook[]>([])
  const [triggerEvents, setTriggerEvents] = useState<TriggerEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<ApiWebhook | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    trigger_event: '',
    webhook_url: '',
    description: ''
  })

  useEffect(() => {
    fetchWebhooks()
    fetchTriggerEvents()
  }, [])

  const fetchWebhooks = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('api_webhooks')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setWebhooks(data || [])
    } catch (error) {
      console.error('Error fetching webhooks:', error)
      alert('Failed to load webhooks')
    } finally {
      setLoading(false)
    }
  }

  const fetchTriggerEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('workflow_triggers')
        .select('event_name, display_name, category')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('display_name', { ascending: true })

      if (error) throw error

      const events: TriggerEvent[] = (data || []).map(trigger => ({
        value: trigger.event_name,
        label: trigger.display_name,
        module: trigger.category
      }))

      setTriggerEvents(events)
    } catch (error) {
      console.error('Error fetching trigger events:', error)
    }
  }

  const handleOpenModal = (webhook?: ApiWebhook) => {
    if (webhook) {
      setEditingWebhook(webhook)
      setFormData({
        name: webhook.name,
        trigger_event: webhook.trigger_event,
        webhook_url: webhook.webhook_url,
        description: webhook.description
      })
    } else {
      setEditingWebhook(null)
      setFormData({
        name: '',
        trigger_event: '',
        webhook_url: '',
        description: ''
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingWebhook(null)
    setFormData({
      name: '',
      trigger_event: '',
      webhook_url: '',
      description: ''
    })
  }

  const handleSave = async () => {
    if (!formData.name || !formData.trigger_event || !formData.webhook_url) {
      alert('Please fill all required fields')
      return
    }

    try {
      setLoading(true)

      if (editingWebhook) {
        const { error } = await supabase
          .from('api_webhooks')
          .update({
            name: formData.name,
            trigger_event: formData.trigger_event,
            webhook_url: formData.webhook_url,
            description: formData.description
          })
          .eq('id', editingWebhook.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('api_webhooks')
          .insert([{
            name: formData.name,
            trigger_event: formData.trigger_event,
            webhook_url: formData.webhook_url,
            description: formData.description,
            is_active: true
          }])

        if (error) throw error
      }

      await fetchWebhooks()
      handleCloseModal()
    } catch (error) {
      console.error('Error saving webhook:', error)
      alert('Failed to save webhook')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (webhook: ApiWebhook) => {
    try {
      const { error } = await supabase
        .from('api_webhooks')
        .update({ is_active: !webhook.is_active })
        .eq('id', webhook.id)

      if (error) throw error
      await fetchWebhooks()
    } catch (error) {
      console.error('Error toggling webhook:', error)
      alert('Failed to update webhook status')
    }
  }

  const handleDelete = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return

    try {
      const { error } = await supabase
        .from('api_webhooks')
        .delete()
        .eq('id', webhookId)

      if (error) throw error
      await fetchWebhooks()
    } catch (error) {
      console.error('Error deleting webhook:', error)
      alert('Failed to delete webhook')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <>
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Globe className="w-5 h-5 text-brand-primary" />
              <span>API Webhooks</span>
            </CardTitle>
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Create API Webhook
            </Button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Configure webhooks to send trigger data to external URLs automatically
          </p>
        </CardHeader>
        <CardContent>
          {loading && webhooks.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
              <p className="mt-4 text-gray-600">Loading webhooks...</p>
            </div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Globe className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="mb-2">No API webhooks configured</p>
              <p className="text-sm">Create your first webhook to start sending trigger data to external URLs</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Trigger Event</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Module</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Webhook URL</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700">Total Calls</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700">Success</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700">Failed</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700">Success Rate</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700">Status</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {webhooks.map((webhook) => {
                    const triggerInfo = triggerEvents.find(t => t.value === webhook.trigger_event)
                    const successRate = webhook.total_calls > 0
                      ? Math.round((webhook.success_count / webhook.total_calls) * 100)
                      : 0

                    return (
                      <motion.tr
                        key={webhook.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div className="text-sm font-medium text-brand-text">
                            {triggerInfo?.label || webhook.trigger_event}
                          </div>
                          {webhook.name && (
                            <div className="text-xs text-gray-500 mt-1">{webhook.name}</div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="outline" className="text-xs">
                            {triggerInfo?.module || 'N/A'}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="text-sm font-mono text-gray-600 truncate max-w-xs" title={webhook.webhook_url}>
                              {webhook.webhook_url}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(webhook.webhook_url)}
                              className="flex-shrink-0"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="text-sm font-semibold text-brand-text">{webhook.total_calls}</div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="text-sm font-semibold text-green-600">{webhook.success_count}</div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="text-sm font-semibold text-red-600">{webhook.failure_count}</div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className={`text-sm font-semibold ${
                            successRate >= 80 ? 'text-green-600' :
                            successRate >= 50 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {successRate}%
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Badge className={webhook.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {webhook.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleToggleActive(webhook)}>
                                <Power className="w-4 h-4 mr-2" />
                                {webhook.is_active ? 'Deactivate' : 'Activate'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenModal(webhook)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(webhook.id)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-brand-text">
                {editingWebhook ? 'Edit API Webhook' : 'Create API Webhook'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Send Leads to CRM"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trigger Event *
                </label>
                <Select
                  value={formData.trigger_event}
                  onValueChange={(value) => setFormData({ ...formData, trigger_event: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select trigger event" />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerEvents.map((event) => (
                      <SelectItem key={event.value} value={event.value}>
                        <div className="flex items-center space-x-2">
                          <span>{event.label}</span>
                          <span className="text-xs text-gray-500">({event.module})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  All data related to this trigger will be sent to the webhook URL
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook URL *
                </label>
                <Input
                  value={formData.webhook_url}
                  onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                  placeholder="https://example.com/webhook"
                  type="url"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The URL where POST requests will be sent with trigger data
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description for this webhook"
                  rows={3}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">How it works</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• When the selected trigger event occurs, all related data will be sent to your webhook URL</li>
                  <li>• Data is sent as JSON in a POST request</li>
                  <li>• For example, NEW_LEAD_ADDED sends: name, email, phone, source, etc.</li>
                  <li>• Make sure your webhook endpoint can accept POST requests</li>
                </ul>
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
              <Button type="button" variant="outline" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : editingWebhook ? 'Update Webhook' : 'Create Webhook'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
