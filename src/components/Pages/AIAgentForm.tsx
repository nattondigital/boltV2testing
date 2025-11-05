import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bot, Save, X, ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'

const AI_MODELS = [
  { category: 'Text Models', models: [
    { value: 'google/gemini-2.5-flash-lite', label: 'google/gemini-2.5-flash-lite' },
    { value: 'google/gemini-2.5-flash', label: 'google/gemini-2.5-flash ($0.30/M in, $2.50/M out)' },
    { value: 'google/gemini-2.5-pro', label: 'google/gemini-2.5-pro ($1.25/M in, $10/M out)' },
    { value: 'openai/gpt-4o-mini', label: 'openai/gpt-4o-mini' },
    { value: 'openai/gpt-5-mini', label: 'openai/gpt-5-mini' },
    { value: 'openai/gpt-5', label: 'openai/gpt-5 ($1.25/M in, $10/M out)' },
    { value: 'meta-llama/llama-4-maverick', label: 'meta-llama/llama-4-maverick ($0.15/M in, $0.60/M out)' },
    { value: 'anthropic/claude-sonnet-4.5', label: 'anthropic/claude-sonnet-4.5 ($3/M in, $15/M out)' }
  ]},
  { category: 'Image Models', models: [
    { value: 'google/gemini-2.5-flash', label: 'google/gemini-2.5-flash ($0.30/M in, $2.50/M out)' }
  ]}
]

const CHANNELS = ['Web', 'WhatsApp', 'Email', 'Voice', 'SMS', 'Telegram']

export function AIAgentForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    agent_type: 'BACKEND',
    model: '',
    system_prompt: '',
    status: 'Active',
    channels: [] as string[]
  })

  useEffect(() => {
    if (isEdit) {
      fetchAgent()
    }
  }, [id])

  const fetchAgent = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      setFormData({
        name: data.name,
        agent_type: data.agent_type || 'BACKEND',
        model: data.model,
        system_prompt: data.system_prompt,
        status: data.status,
        channels: data.channels || []
      })
    } catch (error) {
      console.error('Error fetching agent:', error)
      alert('Failed to load agent')
      navigate('/ai-agents')
    } finally {
      setLoading(false)
    }
  }

  const handleChannelToggle = (channel: string) => {
    setFormData(prev => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter(c => c !== channel)
        : [...prev.channels, channel]
    }))
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.model || !formData.system_prompt) {
      alert('Please fill in all required fields')
      return
    }

    if (formData.channels.length === 0) {
      alert('Please select at least one channel')
      return
    }

    try {
      setLoading(true)

      if (isEdit) {
        const { error } = await supabase
          .from('ai_agents')
          .update({
            name: formData.name,
            agent_type: formData.agent_type,
            model: formData.model,
            system_prompt: formData.system_prompt,
            status: formData.status,
            channels: formData.channels,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('ai_agents')
          .insert({
            name: formData.name,
            agent_type: formData.agent_type,
            model: formData.model,
            system_prompt: formData.system_prompt,
            status: formData.status,
            channels: formData.channels,
            last_activity: new Date().toISOString()
          })

        if (error) throw error
      }

      navigate('/ai-agents')
    } catch (error) {
      console.error('Error saving agent:', error)
      alert('Failed to save agent')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => navigate('/ai-agents')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Agents
        </Button>
        <PageHeader
          title={isEdit ? 'Edit AI Agent' : 'Add New AI Agent'}
          subtitle={isEdit ? 'Update agent configuration' : 'Create a new intelligent assistant'}
          icon={Bot}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl"
      >
        <Card>
          <CardHeader>
            <CardTitle>Agent Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agent Name *
              </label>
              <Input
                placeholder="e.g., Customer Support Agent"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agent Type *
              </label>
              <Select value={formData.agent_type} onValueChange={(value) => setFormData(prev => ({ ...prev, agent_type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BACKEND">
                    <div>
                      <div className="font-semibold">BACKEND - Internal AI Employee</div>
                      <div className="text-xs text-gray-500">For staff: CRM operations, no conversation memory</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="FRONTEND">
                    <div>
                      <div className="font-semibold">FRONTEND - Customer-Facing AI Employee</div>
                      <div className="text-xs text-gray-500">For clients: Chat support with conversation history</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {formData.agent_type === 'BACKEND'
                  ? 'BACKEND agents execute CRM tasks without conversation context for better performance'
                  : 'FRONTEND agents maintain conversation history (last 20 messages) for personalized customer interactions'
                }
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                AI Model *
              </label>
              <Select value={formData.model} onValueChange={(value) => setFormData(prev => ({ ...prev, model: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select AI model" />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map(category => (
                    <React.Fragment key={category.category}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                        {category.category}
                      </div>
                      {category.models.map(model => (
                        <SelectItem key={model.value} value={model.value}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                System Prompt *
              </label>
              <Textarea
                placeholder="Enter the system instructions for this agent..."
                value={formData.system_prompt}
                onChange={(e) => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Define how the agent should behave and what tasks it can perform
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Channels *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {CHANNELS.map(channel => (
                  <label
                    key={channel}
                    className={`
                      flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all
                      ${formData.channels.includes(channel)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={formData.channels.includes(channel)}
                      onChange={() => handleChannelToggle(channel)}
                      className="mr-2"
                    />
                    <span className="font-medium">{channel}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-4 pt-6 border-t">
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {isEdit ? 'Update Agent' : 'Create Agent'}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/ai-agents')}
                disabled={loading}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        {isEdit && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                onClick={() => navigate(`/ai-agents/permissions/${id}`)}
                className="w-full"
              >
                Configure Module Permissions
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/ai-agents/chat/${id}`)}
                className="w-full"
              >
                Open Chat Interface
              </Button>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  )
}
