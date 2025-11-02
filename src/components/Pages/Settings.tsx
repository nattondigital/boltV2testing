import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Save, User, Bell, Shield, Palette, Globe, Database, Pause, Key, Mail, Phone, MapPin, Building, CreditCard, Smartphone, Monitor, Moon, Sun, Volume2, VolumeX, Eye, EyeOff, Copy, RefreshCw, Trash2, Plus, CreditCard as Edit, Zap, Link, Settings as SettingsIcon, Lock, Unlock, Play, Check, X, AlertTriangle, Info, Download, Upload, Calendar, GitBranch, FolderOpen, Layers } from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { supabase } from '@/lib/supabase'
import { ApiWebhooks } from './ApiWebhooks'
import { AppearanceSettings } from '@/components/Settings/AppearanceSettings'
import { CalendarSettings } from '@/components/Settings/CalendarSettings'
import { PipelineSettings } from '@/components/Settings/PipelineSettings'
import { MediaFoldersSettings } from '@/components/Settings/MediaFoldersSettings'
import { CustomFieldsSettings } from '@/components/Settings/CustomFieldsSettings'
import { useAuth } from '@/contexts/AuthContext'

const mockIntegrations = [
  {
    id: 'whatsapp',
    name: 'WhatsApp Business API',
    description: 'Connect WhatsApp for automated messaging',
    status: 'Connected',
    icon: '💬',
    lastSync: '2024-01-21 10:30 AM',
    config: { businessName: 'AIA Coach', apiKey: 'dt_xxxxxxxxxxxx', wabaNumber: '+91 98765 43210' }
  }
]

const mockApiKeys = [
  {
    id: 'api-001',
    name: 'Production API Key',
    key: 'sk_live_51234567890abcdef...',
    permissions: ['read', 'write', 'admin'],
    createdAt: '2024-01-15',
    lastUsed: '2024-01-21 10:30 AM',
    status: 'Active'
  },
  {
    id: 'api-002',
    name: 'Development API Key',
    key: 'sk_test_51234567890abcdef...',
    permissions: ['read', 'write'],
    createdAt: '2024-01-10',
    lastUsed: '2024-01-20 03:20 PM',
    status: 'Active'
  },
  {
    id: 'api-003',
    name: 'Mobile App API Key',
    key: 'sk_mobile_51234567890abcdef...',
    permissions: ['read'],
    createdAt: '2024-01-08',
    lastUsed: 'Never',
    status: 'Inactive'
  }
]

const webhookStatusColors: Record<string, string> = {
  'Active': 'bg-green-100 text-green-800',
  'Paused': 'bg-yellow-100 text-yellow-800',
  'Error': 'bg-red-100 text-red-800',
  'Testing': 'bg-blue-100 text-blue-800'
}

const moduleColors: Record<string, string> = {
  'Leads': 'bg-blue-100 text-blue-800',
  'Members': 'bg-purple-100 text-purple-800',
  'Billing': 'bg-green-100 text-green-800',
  'Support': 'bg-orange-100 text-orange-800',
  'Affiliates': 'bg-pink-100 text-pink-800',
  'Courses': 'bg-indigo-100 text-indigo-800',
  'Team': 'bg-gray-100 text-gray-800',
  'Automations': 'bg-red-100 text-red-800'
}

const statusColors: Record<string, string> = {
  'Connected': 'bg-green-100 text-green-800',
  'Disconnected': 'bg-red-100 text-red-800',
  'Pending': 'bg-yellow-100 text-yellow-800',
  'Error': 'bg-red-100 text-red-800',
  'Active': 'bg-green-100 text-green-800',
  'Inactive': 'bg-gray-100 text-gray-800'
}

export function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { userProfile, refreshProfile } = useAuth()
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'integrations' | 'api' | 'system' | 'webhooks' | 'appearance' | 'calendar' | 'pipelines' | 'media-folders' | 'custom-fields'>('profile')
  const [profileSubTab, setProfileSubTab] = useState<'personal' | 'business'>('personal')
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({})
  const [editingIntegration, setEditingIntegration] = useState<string | null>(null)
  const [integrationConfig, setIntegrationConfig] = useState<Record<string, any>>({})
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: '',
    department: '',
    role: '',
    status: 'Active'
  })
  const [businessData, setBusinessData] = useState({
    business_name: '',
    business_tagline: '',
    business_address: '',
    business_city: '',
    business_state: '',
    business_pincode: '',
    business_phone: '',
    business_email: '',
    gst_number: '',
    website: ''
  })
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [settings, setSettings] = useState({
    profile: {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@aiacoach.com',
      phone: '+91 98765 43210',
      company: 'AIA Coach',
      address: 'Mumbai, Maharashtra, India',
      timezone: 'Asia/Kolkata',
      language: 'English',
      avatar: 'AU'
    },
    notifications: {
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
      marketingEmails: false,
      newLeads: true,
      newEnrollments: true,
      paymentAlerts: true,
      systemUpdates: false,
      weeklyReports: true
    },
    system: {
      theme: 'light',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12',
      currency: 'INR',
      backupFrequency: 'daily',
      maintenanceMode: false,
      debugMode: false,
      cacheEnabled: true
    }
  })

  const [integrations, setIntegrations] = useState<any[]>([])
  const [apiKeys, setApiKeys] = useState(mockApiKeys)
  const [webhooks, setWebhooks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [whatsappConfigId, setWhatsappConfigId] = useState<string | null>(null)
  const [showWebhookModal, setShowWebhookModal] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<any | null>(null)
  const [webhookFormData, setWebhookFormData] = useState({
    name: '',
    module: '',
    method: 'POST',
    url: '',
    payload_fields: {}
  })

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['profile', 'notifications', 'integrations', 'api', 'system', 'webhooks', 'appearance', 'calendar', 'pipelines', 'media-folders', 'custom-fields'].includes(tab)) {
      setActiveTab(tab as any)
    }
  }, [searchParams])

  useEffect(() => {
    if (activeTab === 'webhooks') {
      fetchWebhooks()
    } else if (activeTab === 'integrations') {
      fetchIntegrations()
    } else if (activeTab === 'profile') {
      loadProfileData()
    }
  }, [activeTab])

  useEffect(() => {
    if (userProfile) {
      setProfileData({
        full_name: userProfile.full_name || '',
        email: userProfile.email || '',
        phone: userProfile.phone || '',
        department: userProfile.department || '',
        role: userProfile.role || '',
        status: userProfile.status || 'Active'
      })
    }
  }, [userProfile])

  const loadProfileData = async () => {
    if (userProfile) {
      setProfileData({
        full_name: userProfile.full_name || '',
        email: userProfile.email || '',
        phone: userProfile.phone || '',
        department: userProfile.department || '',
        role: userProfile.role || '',
        status: userProfile.status || 'Active'
      })
    }

    // Load business settings
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .limit(1)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setBusinessData({
          business_name: data.business_name || '',
          business_tagline: data.business_tagline || '',
          business_address: data.business_address || '',
          business_city: data.business_city || '',
          business_state: data.business_state || '',
          business_pincode: data.business_pincode || '',
          business_phone: data.business_phone || '',
          business_email: data.business_email || '',
          gst_number: data.gst_number || '',
          website: data.website || ''
        })
      }
    } catch (error) {
      console.error('Error loading business settings:', error)
    }
  }

  const handleSaveProfile = async () => {
    if (!userProfile || !profileData.full_name || !profileData.email || !profileData.phone) {
      setProfileMessage({ type: 'error', text: 'Please fill in all required fields (Name, Email, Phone)' })
      setTimeout(() => setProfileMessage(null), 5000)
      return
    }

    try {
      setIsSavingProfile(true)
      setProfileMessage(null)

      const { error } = await supabase
        .from('admin_users')
        .update({
          full_name: profileData.full_name,
          email: profileData.email,
          phone: profileData.phone,
          department: profileData.department || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userProfile.id)

      if (error) throw error

      await refreshProfile()

      setProfileMessage({ type: 'success', text: 'Profile updated successfully!' })
      setTimeout(() => setProfileMessage(null), 5000)
    } catch (error) {
      console.error('Error updating profile:', error)
      setProfileMessage({ type: 'error', text: 'Failed to update profile. Please try again.' })
      setTimeout(() => setProfileMessage(null), 5000)
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSaveBusinessDetails = async () => {
    if (!businessData.business_name || !businessData.business_address || !businessData.business_city ||
        !businessData.business_state || !businessData.business_pincode || !businessData.business_phone ||
        !businessData.business_email) {
      setProfileMessage({ type: 'error', text: 'Please fill in all required business fields' })
      setTimeout(() => setProfileMessage(null), 5000)
      return
    }

    try {
      setIsSavingProfile(true)
      setProfileMessage(null)

      // Check if business settings exist
      const { data: existing } = await supabase
        .from('business_settings')
        .select('id')
        .limit(1)
        .maybeSingle()

      const businessSettingsData = {
        business_name: businessData.business_name,
        business_tagline: businessData.business_tagline || '',
        business_address: businessData.business_address,
        business_city: businessData.business_city,
        business_state: businessData.business_state,
        business_pincode: businessData.business_pincode,
        business_phone: businessData.business_phone,
        business_email: businessData.business_email,
        gst_number: businessData.gst_number || '',
        website: businessData.website || '',
        updated_at: new Date().toISOString()
      }

      let error
      if (existing) {
        // Update existing record
        const result = await supabase
          .from('business_settings')
          .update(businessSettingsData)
          .eq('id', existing.id)
        error = result.error
      } else {
        // Insert new record
        const result = await supabase
          .from('business_settings')
          .insert([businessSettingsData])
        error = result.error
      }

      if (error) throw error

      setProfileMessage({ type: 'success', text: 'Business details saved successfully!' })
      setTimeout(() => setProfileMessage(null), 5000)
    } catch (error) {
      console.error('Error saving business details:', error)
      setProfileMessage({ type: 'error', text: 'Failed to save business details. Please try again.' })
      setTimeout(() => setProfileMessage(null), 5000)
    } finally {
      setIsSavingProfile(false)
    }
  }

  const updateProfileField = (field: string, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const fetchIntegrations = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error

      if (data) {
        setIntegrations(data.map((integration: any) => ({
          id: integration.integration_type,
          dbId: integration.id,
          name: integration.name,
          description: integration.description,
          icon: integration.icon,
          status: integration.status,
          lastSync: integration.last_sync ? new Date(integration.last_sync).toLocaleString() : null,
          config: integration.config
        })))
      }
    } catch (error) {
      console.error('Failed to fetch integrations:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchWebhooks = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setWebhooks(data || [])
    } catch (error) {
      console.error('Failed to fetch webhooks:', error)
      alert('Failed to load webhooks. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenWebhookModal = (webhook?: any) => {
    if (webhook) {
      setEditingWebhook(webhook)
      setWebhookFormData({
        name: webhook.name,
        module: webhook.module,
        method: webhook.method || 'POST',
        url: webhook.url,
        payload_fields: webhook.payload_fields || {}
      })
    } else {
      setEditingWebhook(null)
      setWebhookFormData({
        name: '',
        module: '',
        method: 'POST',
        url: '',
        payload_fields: {}
      })
    }
    setShowWebhookModal(true)
  }

  const handleCloseWebhookModal = () => {
    setShowWebhookModal(false)
    setEditingWebhook(null)
    setWebhookFormData({
      name: '',
      module: '',
      method: 'POST',
      url: '',
      payload_fields: {}
    })
  }

  const handleSaveWebhook = async () => {
    if (!webhookFormData.name || !webhookFormData.module || !webhookFormData.method || !webhookFormData.url) {
      alert('Please fill all required fields')
      return
    }

    try {
      setLoading(true)

      if (editingWebhook) {
        const { error } = await supabase
          .from('webhooks')
          .update({
            name: webhookFormData.name,
            module: webhookFormData.module,
            method: webhookFormData.method,
            url: webhookFormData.url,
            payload_fields: webhookFormData.payload_fields,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingWebhook.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('webhooks')
          .insert([{
            name: webhookFormData.name,
            module: webhookFormData.module,
            method: webhookFormData.method,
            url: webhookFormData.url,
            payload_fields: webhookFormData.payload_fields
          }])

        if (error) throw error
      }

      await fetchWebhooks()
      handleCloseWebhookModal()
      alert(`Webhook ${editingWebhook ? 'updated' : 'created'} successfully!`)
    } catch (error) {
      console.error('Error saving webhook:', error)
      alert('Failed to save webhook')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) {
      return
    }

    try {
      setLoading(true)
      const { error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', id)

      if (error) throw error

      await fetchWebhooks()
      alert('Webhook deleted successfully!')
    } catch (error) {
      console.error('Error deleting webhook:', error)
      alert('Failed to delete webhook')
    } finally {
      setLoading(false)
    }
  }

  const updateSetting = (category: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [key]: value
      }
    }))
  }

  const toggleApiKeyVisibility = (keyId: string) => {
    setShowApiKey(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  }

  const generateCurlCommand = (webhook: any) => {
    const method = webhook.method || 'POST'

    if (method === 'GET') {
      const queryParams: string[] = []

      if (webhook.payload_fields) {
        Object.entries(webhook.payload_fields).forEach(([key, value]: [string, any]) => {
          queryParams.push(`${key}=YOUR_${key.toUpperCase()}_VALUE`)
        })
      }

      const urlWithParams = queryParams.length > 0
        ? `${webhook.url}?${queryParams.join('&')}`
        : webhook.url

      const curlCommand = `curl -X GET '${urlWithParams}' \\
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY'`

      return curlCommand
    } else {
      const examplePayload: any = {}

      if (webhook.payload_fields) {
        Object.entries(webhook.payload_fields).forEach(([key, description]: [string, any]) => {
          const descStr = typeof description === 'string' ? description : String(description)
          const isRequired = descStr.includes('(required)')
          const isOptional = descStr.includes('(optional)')

          let value: any = 'value'

          if (descStr.includes('string')) {
            value = isRequired ? 'your_value_here' : '(optional) your_value_here'
          } else if (descStr.includes('number')) {
            value = isRequired ? 0 : '(optional) 0'
          } else if (descStr.includes('array')) {
            value = isRequired ? [] : '(optional) []'
          } else if (descStr.includes('object')) {
            value = isRequired ? {} : '(optional) {}'
          } else if (descStr.includes('boolean')) {
            value = isRequired ? true : '(optional) true'
          }

          if (!isOptional || isRequired) {
            examplePayload[key] = value
          } else {
            examplePayload[`${key} (optional)`] = value
          }
        })
      }

      const curlCommand = `curl -X POST '${webhook.url}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \\
  -d '${JSON.stringify(examplePayload, null, 2)}'`

      return curlCommand
    }
  }

  const copyCurlCommand = (webhook: any) => {
    const curlCommand = generateCurlCommand(webhook)
    copyToClipboard(curlCommand)
  }

  const connectIntegration = async (integrationId: string) => {
    startEditingIntegration(integrationId)
  }

  const disconnectIntegration = async (integrationId: string) => {
    try {
      setLoading(true)

      const { error } = await supabase
        .from('integrations')
        .update({
          status: 'Disconnected',
          last_sync: null
        })
        .eq('integration_type', integrationId)

      if (error) throw error

      if (integrationId === 'whatsapp' && whatsappConfigId) {
        await supabase
          .from('whatsapp_config')
          .update({
            status: 'Disconnected',
            last_sync: null
          })
          .eq('id', whatsappConfigId)
      }

      await fetchIntegrations()
    } catch (error) {
      console.error('Failed to disconnect integration:', error)
      alert('Failed to disconnect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const startEditingIntegration = (integrationId: string) => {
    const integration = integrations.find(i => i.id === integrationId)
    if (integration?.config) {
      setIntegrationConfig(integration.config)
    }
    setEditingIntegration(integrationId)
  }

  const saveIntegrationConfig = async (integrationId: string) => {
    try {
      setLoading(true)

      const integration = integrations.find(i => i.id === integrationId)
      if (!integration) return

      const { error } = await supabase
        .from('integrations')
        .update({
          config: integrationConfig,
          status: 'Connected',
          last_sync: new Date().toISOString()
        })
        .eq('integration_type', integrationId)

      if (error) throw error

      if (integrationId === 'whatsapp') {
        const whatsappConfig = {
          business_name: integrationConfig.businessName || '',
          api_key: integrationConfig.apiKey || '',
          waba_number: integrationConfig.wabaNumber || '',
          status: 'Connected',
          last_sync: new Date().toISOString()
        }

        if (whatsappConfigId) {
          await supabase
            .from('whatsapp_config')
            .update(whatsappConfig)
            .eq('id', whatsappConfigId)
        } else {
          const { data } = await supabase
            .from('whatsapp_config')
            .insert([whatsappConfig])
            .select()
            .single()
          if (data) setWhatsappConfigId(data.id)
        }
      }

      await fetchIntegrations()
      setEditingIntegration(null)
      setIntegrationConfig({})
    } catch (error) {
      console.error('Failed to save integration config:', error)
      alert('Failed to save configuration. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const cancelEditingIntegration = () => {
    setEditingIntegration(null)
    setIntegrationConfig({})
  }

  const updateIntegrationConfig = (key: string, value: string) => {
    setIntegrationConfig(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const generateApiKey = () => {
    const newKey = {
      id: `api-${Date.now()}`,
      name: 'New API Key',
      key: `sk_live_${Math.random().toString(36).substring(2, 15)}...`,
      permissions: ['read'],
      createdAt: new Date().toISOString().split('T')[0],
      lastUsed: 'Never',
      status: 'Active' as const
    }
    setApiKeys(prev => [...prev, newKey])
  }

  const revokeApiKey = (keyId: string) => {
    setApiKeys(prev => prev.filter(key => key.id !== keyId))
  }

  const toggleWebhookStatus = (webhookId: string) => {
    setWebhooks(prev => prev.map(webhook => 
      webhook.id === webhookId 
        ? { ...webhook, status: webhook.status === 'Active' ? 'Paused' : 'Active' }
        : webhook
    ))
  }

  const testWebhook = (webhookId: string) => {
    // Simulate webhook test
    console.log(`Testing webhook ${webhookId}`)
  }

  const regenerateWebhookUrl = (webhookId: string) => {
    setWebhooks(prev => prev.map(webhook => 
      webhook.id === webhookId 
        ? { ...webhook, url: `${webhook.url}?v=${Date.now()}` }
        : webhook
    ))
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'pipelines', label: 'Pipelines', icon: GitBranch },
    { id: 'media-folders', label: 'Media Folders', icon: FolderOpen },
    { id: 'custom-fields', label: 'Custom Fields', icon: Layers },
    { id: 'integrations', label: 'Integrations', icon: Zap },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'system', label: 'System', icon: SettingsIcon },
    { id: 'webhooks', label: 'Webhooks', icon: Link }
  ]

  return (
    <div className="ppt-slide p-6">
      <PageHeader
        title="Settings & Configuration"
        subtitle="Manage your account, integrations, and system preferences"
      />

      {/* Tab Navigation */}
      <motion.div 
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-wrap gap-2 bg-gray-100 p-2 rounded-lg">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any)
                  setSearchParams({ tab: tab.id })
                }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-brand-primary shadow-sm'
                    : 'text-gray-600 hover:text-brand-primary hover:bg-white/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Profile Settings */}
      {activeTab === 'profile' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Profile Sub-tabs */}
          <div className="flex space-x-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setProfileSubTab('personal')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                profileSubTab === 'personal'
                  ? 'bg-white text-brand-primary shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <User className="w-4 h-4" />
                <span>Personal Details</span>
              </div>
            </button>
            <button
              onClick={() => setProfileSubTab('business')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                profileSubTab === 'business'
                  ? 'bg-white text-brand-primary shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Building className="w-4 h-4" />
                <span>Business Details</span>
              </div>
            </button>
          </div>

          {/* Personal Details Tab */}
          {profileSubTab === 'personal' && (
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5 text-brand-primary" />
                <span>Personal Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!userProfile ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-4">Loading profile...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center space-y-4">
                      <Avatar className="h-24 w-24">
                        <AvatarFallback className="bg-brand-primary text-white text-2xl font-bold">
                          {getInitials(profileData.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Member ID</p>
                        <p className="font-medium">{userProfile.member_id || 'N/A'}</p>
                      </div>
                      <Badge className={statusColors[profileData.status]}>
                        {profileData.status}
                      </Badge>
                    </div>

                    {/* Personal Information */}
                    <div className="lg:col-span-2 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Full Name <span className="text-red-500">*</span>
                          </label>
                          <Input
                            value={profileData.full_name}
                            onChange={(e) => updateProfileField('full_name', e.target.value)}
                            placeholder="Enter your full name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                          <Input
                            value={profileData.role}
                            disabled
                            className="bg-gray-50"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email Address <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <Input
                              className="pl-10"
                              type="email"
                              value={profileData.email}
                              onChange={(e) => updateProfileField('email', e.target.value)}
                              placeholder="your.email@example.com"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Phone Number <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <Input
                              className="pl-10"
                              type="tel"
                              value={profileData.phone}
                              onChange={(e) => updateProfileField('phone', e.target.value)}
                              placeholder="+91 1234567890"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                          <div className="relative">
                            <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <Input
                              className="pl-10"
                              value={profileData.department}
                              onChange={(e) => updateProfileField('department', e.target.value)}
                              placeholder="e.g., Sales, Support, Tech"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Last Login</label>
                          <Input
                            value={userProfile.last_login ? new Date(userProfile.last_login).toLocaleString() : 'Never'}
                            disabled
                            className="bg-gray-50"
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t">
                        <p className="text-xs text-gray-500 mb-2">
                          Account created on {new Date(userProfile.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          Last updated on {new Date(userProfile.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {profileMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mt-6 p-4 rounded-lg flex items-center space-x-2 ${
                        profileMessage.type === 'success'
                          ? 'bg-green-50 border border-green-200 text-green-700'
                          : 'bg-red-50 border border-red-200 text-red-700'
                      }`}
                    >
                      {profileMessage.type === 'success' ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5" />
                      )}
                      <span>{profileMessage.text}</span>
                    </motion.div>
                  )}

                  <div className="flex justify-end mt-6 pt-6 border-t">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile}
                      className="min-w-32"
                    >
                      {isSavingProfile ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Saving...</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Save className="w-4 h-4" />
                          <span>Save Changes</span>
                        </div>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          )}

          {/* Business Details Tab */}
          {profileSubTab === 'business' && (
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building className="w-5 h-5 text-brand-primary" />
                <span>Business Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={businessData.business_name}
                      onChange={(e) => setBusinessData({ ...businessData, business_name: e.target.value })}
                      placeholder="Enter your business name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Business Tagline</label>
                    <Input
                      value={businessData.business_tagline}
                      onChange={(e) => setBusinessData({ ...businessData, business_tagline: e.target.value })}
                      placeholder="Your business tagline"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Address <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={businessData.business_address}
                    onChange={(e) => setBusinessData({ ...businessData, business_address: e.target.value })}
                    placeholder="Street address"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={businessData.business_city}
                      onChange={(e) => setBusinessData({ ...businessData, business_city: e.target.value })}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={businessData.business_state}
                      onChange={(e) => setBusinessData({ ...businessData, business_state: e.target.value })}
                      placeholder="State"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pincode <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={businessData.business_pincode}
                      onChange={(e) => setBusinessData({ ...businessData, business_pincode: e.target.value })}
                      placeholder="Pincode"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Phone <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        className="pl-10"
                        type="tel"
                        value={businessData.business_phone}
                        onChange={(e) => setBusinessData({ ...businessData, business_phone: e.target.value })}
                        placeholder="+91 1234567890"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        className="pl-10"
                        type="email"
                        value={businessData.business_email}
                        onChange={(e) => setBusinessData({ ...businessData, business_email: e.target.value })}
                        placeholder="info@business.com"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">GST Number</label>
                    <Input
                      value={businessData.gst_number}
                      onChange={(e) => setBusinessData({ ...businessData, gst_number: e.target.value })}
                      placeholder="22AAAAA0000A1Z5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        className="pl-10"
                        type="url"
                        value={businessData.website}
                        onChange={(e) => setBusinessData({ ...businessData, website: e.target.value })}
                        placeholder="https://www.business.com"
                      />
                    </div>
                  </div>
                </div>

                {profileMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-lg flex items-center space-x-2 ${
                      profileMessage.type === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                    }`}
                  >
                    {profileMessage.type === 'success' ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                    <span>{profileMessage.text}</span>
                  </motion.div>
                )}

                <div className="flex justify-end pt-6 border-t">
                  <Button
                    onClick={handleSaveBusinessDetails}
                    disabled={isSavingProfile}
                    className="min-w-32"
                  >
                    {isSavingProfile ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Saving...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Save className="w-4 h-4" />
                        <span>Save Changes</span>
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          )}
        </motion.div>
      )}

      {/* Notifications Settings */}
      {activeTab === 'notifications' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="w-5 h-5 text-brand-primary" />
                <span>Notification Preferences</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Communication Preferences */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-text mb-4">Communication Methods</h3>
                  <div className="space-y-4">
                    {[
                      { key: 'emailNotifications', label: 'Email Notifications', icon: Mail, description: 'Receive notifications via email' },
                      { key: 'smsNotifications', label: 'SMS Notifications', icon: Smartphone, description: 'Receive notifications via SMS' },
                      { key: 'pushNotifications', label: 'Push Notifications', icon: Monitor, description: 'Receive browser push notifications' }
                    ].map((item) => {
                      const Icon = item.icon
                      return (
                        <div key={item.key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Icon className="w-5 h-5 text-brand-primary" />
                            <div>
                              <div className="font-medium">{item.label}</div>
                              <div className="text-sm text-gray-500">{item.description}</div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateSetting('notifications', item.key, !settings.notifications[item.key as keyof typeof settings.notifications])}
                            className={settings.notifications[item.key as keyof typeof settings.notifications] ? 'text-green-600' : 'text-gray-400'}
                          >
                            {settings.notifications[item.key as keyof typeof settings.notifications] ? (
                              <Volume2 className="w-5 h-5" />
                            ) : (
                              <VolumeX className="w-5 h-5" />
                            )}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Notification Types */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-text mb-4">Notification Types</h3>
                  <div className="space-y-4">
                    {[
                      { key: 'newLeads', label: 'New Leads', description: 'When new leads are captured' },
                      { key: 'newEnrollments', label: 'New Enrollments', description: 'When students enroll in courses' },
                      { key: 'paymentAlerts', label: 'Payment Alerts', description: 'Payment confirmations and failures' },
                      { key: 'systemUpdates', label: 'System Updates', description: 'Platform updates and maintenance' },
                      { key: 'weeklyReports', label: 'Weekly Reports', description: 'Weekly performance summaries' },
                      { key: 'marketingEmails', label: 'Marketing Emails', description: 'Promotional and marketing content' }
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div>
                          <div className="font-medium">{item.label}</div>
                          <div className="text-sm text-gray-500">{item.description}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateSetting('notifications', item.key, !settings.notifications[item.key as keyof typeof settings.notifications])}
                          className={settings.notifications[item.key as keyof typeof settings.notifications] ? 'text-green-600' : 'text-gray-400'}
                        >
                          {settings.notifications[item.key as keyof typeof settings.notifications] ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <X className="w-5 h-5" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Appearance */}
      {activeTab === 'appearance' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AppearanceSettings />
        </motion.div>
      )}

      {/* Calendar */}
      {activeTab === 'calendar' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <CalendarSettings />
        </motion.div>
      )}

      {/* Pipelines */}
      {activeTab === 'pipelines' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <PipelineSettings />
        </motion.div>
      )}

      {/* Media Folders */}
      {activeTab === 'media-folders' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <MediaFoldersSettings />
        </motion.div>
      )}

      {/* Custom Fields */}
      {activeTab === 'custom-fields' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <CustomFieldsSettings />
        </motion.div>
      )}

      {/* Integrations */}
      {activeTab === 'integrations' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-brand-primary" />
                <span>Third-Party Integrations</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {integrations.map((integration, index) => (
                  <motion.div
                    key={integration.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{integration.icon}</div>
                        <div>
                          <h3 className="font-semibold text-brand-text">{integration.name}</h3>
                          <p className="text-sm text-gray-500">{integration.description}</p>
                        </div>
                      </div>
                      <Badge className={statusColors[integration.status]}>
                        {integration.status}
                      </Badge>
                    </div>

                    {integration.config && editingIntegration !== integration.id && (
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="text-xs font-medium text-gray-700 mb-2">Configuration</div>
                        {Object.entries(integration.config).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                            <span className="font-medium">{key.toLowerCase().includes('key') || key.toLowerCase().includes('token') ? '••••••••••' : value}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {editingIntegration === integration.id && (
                      <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-4">
                        <div className="text-sm font-medium text-gray-700 mb-3">Edit Configuration</div>

                        {integration.id === 'whatsapp' && (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Business Name</label>
                              <Input
                                value={integrationConfig.businessName || ''}
                                onChange={(e) => updateIntegrationConfig('businessName', e.target.value)}
                                placeholder="Enter business name"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Doubletick API Key</label>
                              <Input
                                value={integrationConfig.apiKey || ''}
                                onChange={(e) => updateIntegrationConfig('apiKey', e.target.value)}
                                placeholder="Enter Doubletick API key"
                                type="password"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">WABA Number</label>
                              <Input
                                value={integrationConfig.wabaNumber || ''}
                                onChange={(e) => updateIntegrationConfig('wabaNumber', e.target.value)}
                                placeholder="Enter WhatsApp Business Account number"
                              />
                            </div>
                          </>
                        )}

                        {integration.id === 'ghl_api' && (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Business Name</label>
                              <Input
                                value={integrationConfig.businessName || ''}
                                onChange={(e) => updateIntegrationConfig('businessName', e.target.value)}
                                placeholder="Enter your business name"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">GHL Access Token</label>
                              <Input
                                value={integrationConfig.accessToken || ''}
                                onChange={(e) => updateIntegrationConfig('accessToken', e.target.value)}
                                placeholder="Enter GoHighLevel Access Token"
                                type="password"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Location ID</label>
                              <Input
                                value={integrationConfig.locationId || ''}
                                onChange={(e) => updateIntegrationConfig('locationId', e.target.value)}
                                placeholder="Enter GoHighLevel Location ID"
                              />
                            </div>
                          </>
                        )}

                        {integration.id === 'openrouter' && (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Application Name</label>
                              <Input
                                value={integrationConfig.appName || ''}
                                onChange={(e) => updateIntegrationConfig('appName', e.target.value)}
                                placeholder="Enter your application name"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">OpenRouter API Key</label>
                              <Input
                                value={integrationConfig.apiKey || ''}
                                onChange={(e) => updateIntegrationConfig('apiKey', e.target.value)}
                                placeholder="Enter OpenRouter API Key"
                                type="password"
                              />
                            </div>
                          </>
                        )}

                        <div className="flex space-x-2 pt-2">
                          <Button
                            size="sm"
                            onClick={() => saveIntegrationConfig(integration.id)}
                            className="flex-1"
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Save Changes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEditingIntegration}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {integration.lastSync && (
                      <div className="text-xs text-gray-500 mb-4">
                        Last sync: {integration.lastSync}
                      </div>
                    )}

                    {editingIntegration !== integration.id && (
                      <div className="flex space-x-2">
                        {integration.status === 'Connected' ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => disconnectIntegration(integration.id)}
                              className="flex-1"
                            >
                              <X className="w-4 h-4 mr-2" />
                              Disconnect
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditingIntegration(integration.id)}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Configure
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => connectIntegration(integration.id)}
                            className="flex-1"
                          >
                            <Link className="w-4 h-4 mr-2" />
                            Connect
                          </Button>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* API Webhooks */}
      {activeTab === 'api' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <ApiWebhooks />
        </motion.div>
      )}

      {/* System Settings */}
      {activeTab === 'system' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <SettingsIcon className="w-5 h-5 text-brand-primary" />
                <span>System Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Appearance */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-text mb-4">Appearance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                      <Select value={settings.system.theme} onValueChange={(value) => updateSetting('system', 'theme', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">
                            <div className="flex items-center space-x-2">
                              <Sun className="w-4 h-4" />
                              <span>Light</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="dark">
                            <div className="flex items-center space-x-2">
                              <Moon className="w-4 h-4" />
                              <span>Dark</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Localization */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-text mb-4">Localization</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date Format</label>
                      <Select value={settings.system.dateFormat} onValueChange={(value) => updateSetting('system', 'dateFormat', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                          <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                          <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Time Format</label>
                      <Select value={settings.system.timeFormat} onValueChange={(value) => updateSetting('system', 'timeFormat', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12">12 Hour</SelectItem>
                          <SelectItem value="24">24 Hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                      <Select value={settings.system.currency} onValueChange={(value) => updateSetting('system', 'currency', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INR">INR (₹)</SelectItem>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* System Options */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-text mb-4">System Options</h3>
                  <div className="space-y-4">
                    {[
                      { key: 'maintenanceMode', label: 'Maintenance Mode', description: 'Enable maintenance mode to prevent user access', icon: AlertTriangle },
                      { key: 'debugMode', label: 'Debug Mode', description: 'Enable debug mode for troubleshooting', icon: Info },
                      { key: 'cacheEnabled', label: 'Cache Enabled', description: 'Enable caching for better performance', icon: Database }
                    ].map((item) => {
                      const Icon = item.icon
                      return (
                        <div key={item.key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Icon className="w-5 h-5 text-brand-primary" />
                            <div>
                              <div className="font-medium">{item.label}</div>
                              <div className="text-sm text-gray-500">{item.description}</div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateSetting('system', item.key, !settings.system[item.key as keyof typeof settings.system])}
                            className={settings.system[item.key as keyof typeof settings.system] ? 'text-green-600' : 'text-gray-400'}
                          >
                            {settings.system[item.key as keyof typeof settings.system] ? (
                              <Check className="w-5 h-5" />
                            ) : (
                              <X className="w-5 h-5" />
                            )}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Backup Settings */}
                <div>
                  <h3 className="text-lg font-semibold text-brand-text mb-4">Backup Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Backup Frequency</label>
                      <Select value={settings.system.backupFrequency} onValueChange={(value) => updateSetting('system', 'backupFrequency', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button variant="outline" className="w-full">
                        <Download className="w-4 h-4 mr-2" />
                        Create Backup Now
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* n8n Webhooks */}
      {activeTab === 'webhooks' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Card className="shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Link className="w-5 h-5 text-brand-primary" />
                  <span>Webhook Management</span>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(import.meta.env.VITE_SUPABASE_ANON_KEY || '')}
                    title="Copy API Key"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy API Key
                  </Button>
                  <Button onClick={() => handleOpenWebhookModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Webhook
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                  <p className="mt-4 text-gray-600">Loading webhooks...</p>
                </div>
              ) : webhooks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Link className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No webhooks found</p>
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Webhook Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Module</th>
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Method</th>
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Webhook URL</th>
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Payload Fields</th>
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Created At</th>
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webhooks.map((webhook, index) => (
                      <tr
                        key={webhook.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium">{webhook.name}</div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={moduleColors[webhook.module] || 'bg-gray-100 text-gray-800'} variant="secondary">
                            {webhook.module}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs font-mono">
                            {webhook.method || 'POST'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Input
                              value={webhook.url}
                              readOnly
                              className="font-mono text-sm max-w-xs"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(webhook.url)}
                              title="Copy URL"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {webhook.payload_fields && Object.keys(webhook.payload_fields).map((field) => (
                              <Badge key={field} variant="outline" className="text-xs">
                                {field}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-600">
                            {new Date(webhook.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenWebhookModal(webhook)}
                              title="Edit Webhook"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyCurlCommand(webhook)}
                              className="text-blue-600 hover:text-blue-700"
                              title="Copy cURL Command"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Webhook Modal */}
      {showWebhookModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-brand-text">
                {editingWebhook ? 'Edit Webhook' : 'Create Webhook'}
              </h2>
              <button
                onClick={handleCloseWebhookModal}
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
                  value={webhookFormData.name}
                  onChange={(e) => setWebhookFormData({ ...webhookFormData, name: e.target.value })}
                  placeholder="e.g., Add Enrolled Member"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Module *
                </label>
                <Input
                  value={webhookFormData.module}
                  onChange={(e) => setWebhookFormData({ ...webhookFormData, module: e.target.value })}
                  placeholder="e.g., Members, Leads, Team"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  HTTP Method *
                </label>
                <Select
                  value={webhookFormData.method}
                  onValueChange={(value) => setWebhookFormData({ ...webhookFormData, method: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select HTTP Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook URL *
                </label>
                <Input
                  value={webhookFormData.url}
                  onChange={(e) => setWebhookFormData({ ...webhookFormData, url: e.target.value })}
                  placeholder="https://your-domain.com/webhook-endpoint"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payload Fields (JSON)
                </label>
                <Textarea
                  value={JSON.stringify(webhookFormData.payload_fields, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value)
                      setWebhookFormData({ ...webhookFormData, payload_fields: parsed })
                    } catch (err) {
                      // Invalid JSON, keep the current value
                    }
                  }}
                  placeholder='{"field_name": "field_type"}'
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">How it works</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Webhooks allow you to connect external services to your system</li>
                  <li>• Data is sent as JSON in a POST request to the specified URL</li>
                  <li>• Define payload fields to specify what data should be sent</li>
                  <li>• Make sure your webhook endpoint can accept POST requests</li>
                </ul>
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
              <Button type="button" variant="outline" onClick={handleCloseWebhookModal}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveWebhook} disabled={loading}>
                {loading ? 'Saving...' : editingWebhook ? 'Update Webhook' : 'Create Webhook'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}