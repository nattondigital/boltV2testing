import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, ArrowLeft, Eye, CreditCard as Edit, Trash2, X, Save, User, Mail, Phone, MapPin, Building, Calendar, MoreVertical, GripVertical, Users, RefreshCw, AlertCircle, ChevronRight, Clock, CheckSquare, Flag, StickyNote, Download, Upload, FileSpreadsheet, CheckCircle, XCircle, LayoutGrid, List, Layers } from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { KPICard } from '@/components/Common/KPICard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ValidatedInput } from '@/components/ui/validated-input'
import { formatDate, formatTime } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { useAuth } from '@/contexts/AuthContext'
import { PermissionGuard } from '@/components/Common/PermissionGuard'

interface StageColumn {
  id: string
  label: string
  color: string
}

const interestColors: Record<string, string> = {
  'Hot': 'bg-red-100 text-red-800',
  'Warm': 'bg-orange-100 text-orange-800',
  'Cold': 'bg-blue-100 text-blue-800'
}

const getStageColorClasses = (bgColor: string): string => {
  const colorMap: Record<string, string> = {
    'bg-blue-100': 'border-l-blue-400 bg-blue-50',
    'bg-yellow-100': 'border-l-yellow-400 bg-yellow-50',
    'bg-purple-100': 'border-l-purple-400 bg-purple-50',
    'bg-red-100': 'border-l-red-400 bg-red-50',
    'bg-green-100': 'border-l-green-400 bg-green-50',
    'bg-gray-100': 'border-l-gray-400 bg-gray-50',
    'bg-orange-100': 'border-l-orange-400 bg-orange-50',
    'bg-pink-100': 'border-l-pink-400 bg-pink-50',
    'bg-indigo-100': 'border-l-indigo-400 bg-indigo-50',
    'bg-teal-100': 'border-l-teal-400 bg-teal-50',
    'bg-cyan-100': 'border-l-cyan-400 bg-cyan-50',
    'bg-lime-100': 'border-l-lime-400 bg-lime-50',
  }
  return colorMap[bgColor] || 'border-l-gray-400 bg-white'
}

interface Lead {
  id: string
  lead_id: string
  name: string
  email: string
  phone: string
  source: string
  interest: string
  stage: string
  owner: string
  address: string
  company: string
  notes: string
  lead_score: number
  last_contact: string
  created_at: string
  pipeline_id: string | null
}

interface Pipeline {
  id: string
  pipeline_id: string
  name: string
  entity_type: string
}

interface ContactNote {
  id: string
  contact_id: string
  note_text: string
  created_at: string
  updated_at: string
  created_by: string
}

interface Appointment {
  id: string
  appointment_id: string
  contact_id: string
  appointment_date: string
  appointment_time: string
  duration_minutes: number
  meeting_type: string
  location: string
  status: string
  notes: string
  created_at: string
}

interface Task {
  id: string
  task_id: string
  title: string
  description: string | null
  status: string
  priority: string
  assigned_to_name: string | null
  due_date: string | null
  category: string
  progress_percentage: number
  created_at: string
  updated_at: string
}

type ViewType = 'list' | 'add' | 'edit' | 'view' | 'bulk-import'
type TabType = 'lead-details' | 'personal' | 'business' | 'notes' | 'appointments' | 'tasks' | string
type DisplayMode = 'kanban' | 'list'

interface CustomTab {
  id: string
  tab_id: string
  pipeline_id: string
  tab_name: string
  tab_order: number
  is_active: boolean
}

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
}

interface CustomFieldValue {
  id?: string
  custom_field_id: string
  lead_id: string
  field_value: string
}

interface ImportResult {
  success: boolean
  row: number
  data?: any
  error?: string
}

export function Leads() {
  const navigate = useNavigate()
  const location = useLocation()
  const { canCreate, canUpdate, canDelete, canRead } = useAuth()
  const [view, setView] = useState<ViewType>('list')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('kanban')
  const [detailTab, setDetailTab] = useState<TabType>('lead-details')
  const [leadDetailsSubTab, setLeadDetailsSubTab] = useState<string>('info')
  const [searchTerm, setSearchTerm] = useState('')
  const [pipelineFilter, setPipelineFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [interestFilter, setInterestFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [leads, setLeads] = useState<Lead[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('')
  const [stageColumns, setStageColumns] = useState<StageColumn[]>([])
  const [availableStages, setAvailableStages] = useState<Record<string, StageColumn[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const [contactNotes, setContactNotes] = useState<ContactNote[]>([])
  const [newNoteText, setNewNoteText] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')
  const [contactAppointments, setContactAppointments] = useState<Appointment[]>([])
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false)
  const [contactTasks, setContactTasks] = useState<Task[]>([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [linkedContact, setLinkedContact] = useState<any>(null)
  const [contactSearchResults, setContactSearchResults] = useState<any[]>([])
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  const [isSearchingContacts, setIsSearchingContacts] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [showImportResults, setShowImportResults] = useState(false)
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([])
  const [customFields, setCustomFields] = useState<Record<string, CustomField[]>>({})
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({})
  const [isSavingCustomFields, setIsSavingCustomFields] = useState(false)
  const [customFieldsMessage, setCustomFieldsMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    source: '',
    interest: '',
    stage: 'New',
    pipeline_id: '',
    owner: '',
    address: '',
    company: '',
    notes: '',
    fullName: '',
    phoneNumber: '',
    emailAddress: '',
    dateOfBirth: '',
    gender: '',
    educationLevel: '',
    profession: '',
    experience: '',
    businessName: '',
    city: '',
    state: '',
    pincode: '',
    gstNumber: '',
    contactType: 'Lead'
  })

  useEffect(() => {
    const initializeLeads = async () => {
      await fetchPipelines()
      await fetchLeads()
      await fetchTeamMembers()
    }
    initializeLeads()
  }, [])

  useEffect(() => {
    if (selectedLead?.pipeline_id) {
      fetchCustomTabs(selectedLead.pipeline_id)
    }
  }, [selectedLead])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.contact-search-container')) {
        setShowContactDropdown(false)
      }
    }

    if (showContactDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showContactDropdown])

  useEffect(() => {
    if (location.state?.returnToLeadId && location.state?.refreshAppointments) {
      const leadId = location.state.returnToLeadId
      const lead = leads.find(l => l.id === leadId)
      if (lead) {
        handleViewLead(lead)
        setDetailTab('appointments')
        const contact = fetchLinkedContact(lead.phone)
        contact.then(c => {
          if (c) fetchContactAppointments(c.id)
        })
      }
      window.history.replaceState({}, '')
    } else if (location.state?.returnToLeadId && location.state?.refreshTasks) {
      const leadId = location.state.returnToLeadId
      const lead = leads.find(l => l.id === leadId)
      if (lead) {
        handleViewLead(lead)
        setDetailTab('tasks')
        const contact = fetchLinkedContact(lead.phone)
        contact.then(c => {
          if (c) fetchContactTasks(c.id)
        })
      }
      window.history.replaceState({}, '')
    }
  }, [location.state, leads])

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      console.log('📊 Fetched leads:', data?.length || 0)
      console.log('🔍 Leads data:', data)
      setLeads(data || [])
    } catch (error) {
      console.error('Error fetching leads:', error)
      alert('Failed to fetch leads')
    } finally {
      setLoading(false)
    }
  }

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, full_name, role')
        .order('full_name')

      if (error) throw error
      setTeamMembers(data || [])
    } catch (error) {
      console.error('Error fetching team members:', error)
    }
  }

  const fetchCustomTabs = async (pipelineId: string) => {
    try {
      const { data, error } = await supabase
        .from('custom_lead_tabs')
        .select('*')
        .eq('pipeline_id', pipelineId)
        .eq('is_active', true)
        .order('tab_order')

      if (error) throw error
      setCustomTabs(data || [])

      if (data && data.length > 0) {
        const tabIds = data.map(tab => tab.id)
        const { data: fieldsData, error: fieldsError } = await supabase
          .from('custom_fields')
          .select('*')
          .in('custom_tab_id', tabIds)
          .eq('is_active', true)
          .order('display_order')

        if (fieldsError) throw fieldsError

        const fieldsByTab: Record<string, CustomField[]> = {}
        fieldsData?.forEach(field => {
          if (!fieldsByTab[field.custom_tab_id]) {
            fieldsByTab[field.custom_tab_id] = []
          }
          fieldsByTab[field.custom_tab_id].push(field)
        })
        setCustomFields(fieldsByTab)
      }
    } catch (error) {
      console.error('Error fetching custom tabs:', error)
      setCustomTabs([])
      setCustomFields({})
    }
  }

  const fetchCustomFieldValues = async (leadId: string) => {
    try {
      const { data, error } = await supabase
        .from('custom_field_values')
        .select('*')
        .eq('lead_id', leadId)

      if (error) throw error

      const values: Record<string, string> = {}
      data?.forEach(value => {
        values[value.custom_field_id] = value.field_value || ''
      })
      setCustomFieldValues(values)
    } catch (error) {
      console.error('Error fetching custom field values:', error)
      setCustomFieldValues({})
    }
  }

  const validateCustomField = (fieldType: string, value: string): string | null => {
    if (!value) return null

    if (fieldType === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) {
        return 'Please enter a valid email address'
      }
    }

    if (fieldType === 'phone') {
      const phoneRegex = /^[6-9]\d{9}$/
      if (!phoneRegex.test(value.replace(/\s+/g, ''))) {
        return 'Please enter a valid 10-digit Indian mobile number'
      }
    }

    return null
  }

  const handleCustomFieldChange = (fieldId: string, value: string, fieldType: string) => {
    setCustomFieldValues(prev => ({
      ...prev,
      [fieldId]: value
    }))

    const error = validateCustomField(fieldType, value)
    setCustomFieldErrors(prev => ({
      ...prev,
      [fieldId]: error || ''
    }))
  }

  const saveAllCustomFields = async () => {
    if (!selectedLead) return

    const allFields = Object.values(customFields).flat()
    const hasErrors = allFields.some(field => {
      const value = customFieldValues[field.id]
      if (value) {
        const error = validateCustomField(field.field_type, value)
        return error !== null
      }
      return false
    })

    if (hasErrors) {
      setCustomFieldsMessage({ type: 'error', text: 'Please fix validation errors before saving' })
      setTimeout(() => setCustomFieldsMessage(null), 3000)
      return
    }

    setIsSavingCustomFields(true)
    setCustomFieldsMessage(null)

    try {
      for (const field of allFields) {
        const value = (customFieldValues[field.id] || '').trim()

        const { data: existing } = await supabase
          .from('custom_field_values')
          .select('id')
          .eq('custom_field_id', field.id)
          .eq('lead_id', selectedLead.id)
          .maybeSingle()

        if (existing) {
          if (value) {
            await supabase
              .from('custom_field_values')
              .update({ field_value: value, updated_at: new Date().toISOString() })
              .eq('id', existing.id)
          } else {
            await supabase
              .from('custom_field_values')
              .delete()
              .eq('id', existing.id)
          }
        } else {
          if (value) {
            await supabase
              .from('custom_field_values')
              .insert([{
                custom_field_id: field.id,
                lead_id: selectedLead.id,
                field_value: value
              }])
          }
        }
      }

      setCustomFieldsMessage({ type: 'success', text: 'Custom fields saved successfully' })
      setTimeout(() => setCustomFieldsMessage(null), 3000)
    } catch (error) {
      console.error('Error saving custom field values:', error)
      setCustomFieldsMessage({ type: 'error', text: 'Failed to save custom fields' })
      setTimeout(() => setCustomFieldsMessage(null), 3000)
    } finally {
      setIsSavingCustomFields(false)
    }
  }

  const fetchPipelines = async () => {
    try {
      const { data: pipelinesData, error: pipelinesError } = await supabase
        .from('pipelines')
        .select('id, pipeline_id, name, entity_type, is_default')
        .eq('entity_type', 'lead')
        .eq('is_active', true)
        .order('display_order')

      console.log('🔧 Fetched pipelines:', pipelinesData)

      if (pipelinesError) throw pipelinesError

      setPipelines(pipelinesData || [])

      const stagesMap: Record<string, StageColumn[]> = {}
      let defaultPipelineId = ''

      for (const pipeline of (pipelinesData || [])) {
        const { data: stagesData, error: stagesError } = await supabase
          .from('pipeline_stages')
          .select('stage_id, name, color, display_order')
          .eq('pipeline_id', pipeline.id)
          .eq('is_active', true)
          .order('display_order')

        if (!stagesError && stagesData) {
          const formattedStages = stagesData.map(stage => ({
            id: stage.stage_id,
            label: stage.name,
            color: stage.color
          }))
          stagesMap[pipeline.id] = formattedStages

          if (pipeline.is_default) {
            defaultPipelineId = pipeline.id
            console.log('🎨 Setting stages for default pipeline:', formattedStages)
            setStageColumns(formattedStages)
          }
        }
      }

      setAvailableStages(stagesMap)

      // If no default pipeline found, use the first pipeline
      if (!defaultPipelineId && pipelinesData && pipelinesData.length > 0) {
        defaultPipelineId = pipelinesData[0].id
        const firstPipelineStages = stagesMap[defaultPipelineId] || []
        setStageColumns(firstPipelineStages)
      }

      console.log('✅ Setting default pipeline:', defaultPipelineId)
      console.log('📋 Pipeline name:', pipelinesData?.find(p => p.id === defaultPipelineId)?.name)
      setSelectedPipelineId(defaultPipelineId)
      setPipelineFilter(defaultPipelineId)
      setFormData(prev => ({ ...prev, pipeline_id: defaultPipelineId }))
    } catch (error) {
      console.error('Error fetching pipelines:', error)
      const defaultStages = [
        { id: 'New', label: 'New', color: 'bg-blue-100' },
        { id: 'Contacted', label: 'Contacted', color: 'bg-yellow-100' },
        { id: 'Demo Booked', label: 'Demo Booked', color: 'bg-purple-100' },
        { id: 'No Show', label: 'No Show', color: 'bg-red-100' },
        { id: 'Won', label: 'Won', color: 'bg-green-100' },
        { id: 'Lost', label: 'Lost', color: 'bg-gray-100' }
      ]
      setStageColumns(defaultStages)
    }
  }

  const fetchLinkedContact = async (phone: string) => {
    if (!phone) return null

    try {
      const { data, error } = await supabase
        .from('contacts_master')
        .select('*')
        .eq('phone', phone)
        .maybeSingle()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching linked contact:', error)
      return null
    }
  }

  const fetchContactNotes = async (contactId: string) => {
    try {
      const { data, error } = await supabase
        .from('contact_notes')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setContactNotes(data || [])
    } catch (error) {
      console.error('Error fetching contact notes:', error)
    }
  }

  const fetchContactAppointments = async (contactId: string) => {
    setIsLoadingAppointments(true)
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('contact_id', contactId)
        .order('appointment_date', { ascending: false })

      if (error) throw error
      setContactAppointments(data || [])
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      setIsLoadingAppointments(false)
    }
  }

  const fetchContactTasks = async (contactId: string) => {
    setIsLoadingTasks(true)
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setContactTasks(data || [])
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setIsLoadingTasks(false)
    }
  }

  const searchContacts = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setContactSearchResults([])
      setShowContactDropdown(false)
      return
    }

    setIsSearchingContacts(true)
    try {
      const { data, error } = await supabase
        .from('contacts_master')
        .select('id, contact_id, full_name, phone, email, business_name')
        .or(`full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(10)

      if (error) throw error
      setContactSearchResults(data || [])
      setShowContactDropdown(true)
    } catch (error) {
      console.error('Error searching contacts:', error)
      setContactSearchResults([])
    } finally {
      setIsSearchingContacts(false)
    }
  }

  const handleSelectContact = (contact: any) => {
    setFormData(prev => ({
      ...prev,
      name: contact.full_name,
      phone: contact.phone,
      email: contact.email || '',
      company: contact.business_name || ''
    }))
    setShowContactDropdown(false)
    setContactSearchResults([])
  }

  const handleViewLead = async (lead: Lead) => {
    setSelectedLead(lead)
    setView('view')
    setDetailTab('lead-details')

    const contact = await fetchLinkedContact(lead.phone)
    setLinkedContact(contact)

    if (contact) {
      await fetchContactNotes(contact.id)
      await fetchContactAppointments(contact.id)
      await fetchContactTasks(contact.id)
    }

    await fetchCustomFieldValues(lead.id)
  }

  const handleAddClick = () => {
    const currentPipelineId = pipelineFilter || selectedPipelineId
    const defaultStage = availableStages[currentPipelineId]?.[0]?.id || 'New'

    setFormData({
      name: '',
      email: '',
      phone: '',
      source: '',
      interest: '',
      stage: defaultStage,
      pipeline_id: currentPipelineId,
      owner: '',
      address: '',
      company: '',
      notes: '',
      fullName: '',
      phoneNumber: '',
      emailAddress: '',
      dateOfBirth: '',
      gender: '',
      educationLevel: '',
      profession: '',
      experience: '',
      businessName: '',
      city: '',
      state: '',
      pincode: '',
      gstNumber: '',
      contactType: 'Lead'
    })
    setView('add')
  }

  const handleEditClick = (lead: Lead) => {
    setSelectedLead(lead)
    setFormData({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      interest: lead.interest,
      stage: lead.stage,
      pipeline_id: lead.pipeline_id || '',
      owner: lead.owner,
      address: lead.address || '',
      company: lead.company || '',
      notes: lead.notes || '',
      fullName: lead.name,
      phoneNumber: lead.phone,
      emailAddress: lead.email,
      dateOfBirth: '',
      gender: '',
      educationLevel: '',
      profession: '',
      experience: '',
      businessName: lead.company || '',
      city: '',
      state: '',
      pincode: '',
      gstNumber: '',
      contactType: 'Lead'
    })
    setView('edit')
  }

  const handleBackToList = () => {
    setView('list')
    setSelectedLead(null)
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      source: '',
      interest: '',
      stage: 'New',
      pipeline_id: selectedPipelineId,
      owner: '',
      address: '',
      company: '',
      notes: '',
      fullName: '',
      phoneNumber: '',
      emailAddress: '',
      dateOfBirth: '',
      gender: '',
      educationLevel: '',
      profession: '',
      experience: '',
      businessName: '',
      city: '',
      state: '',
      pincode: '',
      gstNumber: '',
      contactType: 'Lead'
    })
  }

  const handleCreateLead = async () => {
    if (!formData.name || !formData.phone || !formData.source || !formData.interest) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const leadData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        source: formData.source,
        interest: formData.interest,
        stage: formData.stage,
        pipeline_id: formData.pipeline_id || null,
        owner: formData.owner,
        address: formData.address,
        company: formData.company,
        notes: formData.notes
      }

      const { data, error } = await supabase
        .from('leads')
        .insert([leadData])
        .select()
        .single()

      if (error) throw error

      setLeads([data, ...leads])
      handleBackToList()
      alert('Lead created successfully!')
    } catch (error) {
      console.error('Error creating lead:', error)
      alert('Failed to create lead')
    }
  }

  const handleUpdateLead = async () => {
    if (!selectedLead || !formData.name || !formData.phone) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const leadData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        source: formData.source,
        interest: formData.interest,
        stage: formData.stage,
        pipeline_id: formData.pipeline_id || null,
        owner: formData.owner,
        address: formData.address,
        company: formData.company,
        notes: formData.notes
      }

      const { error } = await supabase
        .from('leads')
        .update(leadData)
        .eq('id', selectedLead.id)

      if (error) throw error

      await fetchLeads()
      handleBackToList()
      alert('Lead updated successfully!')
    } catch (error) {
      console.error('Error updating lead:', error)
      alert('Failed to update lead')
    }
  }

  const handleDeleteLead = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id)

      if (error) throw error

      setLeads(leads.filter(l => l.id !== id))
      if (view !== 'list') {
        handleBackToList()
      }
      alert('Lead deleted successfully!')
    } catch (error) {
      console.error('Error deleting lead:', error)
      alert('Failed to delete lead')
    }
  }

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault()

    if (!draggedLead || draggedLead.stage === newStage) {
      setDraggedLead(null)
      return
    }

    try {
      const { error } = await supabase
        .from('leads')
        .update({ stage: newStage })
        .eq('id', draggedLead.id)

      if (error) throw error

      await fetchLeads()
      setDraggedLead(null)
    } catch (error) {
      console.error('Error updating lead stage:', error)
      alert('Failed to update lead stage')
    }
  }

  const handleUpdateContact = async () => {
    if (!selectedLead) return

    try {
      const contactData = {
        full_name: formData.fullName || linkedContact?.full_name || selectedLead?.name || '',
        phone: formData.phoneNumber || linkedContact?.phone || selectedLead?.phone || '',
        email: formData.emailAddress || linkedContact?.email || selectedLead?.email || '',
        date_of_birth: formData.dateOfBirth || linkedContact?.date_of_birth || null,
        gender: formData.gender || linkedContact?.gender || null,
        education_level: formData.educationLevel || linkedContact?.education_level || null,
        profession: formData.profession || linkedContact?.profession || null,
        experience: formData.experience || linkedContact?.experience || null,
        business_name: formData.businessName || linkedContact?.business_name || selectedLead?.company || null,
        address: formData.address || linkedContact?.address || selectedLead?.address || null,
        city: formData.city || linkedContact?.city || null,
        state: formData.state || linkedContact?.state || null,
        pincode: formData.pincode || linkedContact?.pincode || null,
        gst_number: formData.gstNumber || linkedContact?.gst_number || null,
        contact_type: formData.contactType || linkedContact?.contact_type || 'Lead',
        status: 'Active'
      }

      if (!contactData.full_name) {
        alert('Full name is required')
        return
      }

      if (linkedContact) {
        const { error } = await supabase
          .from('contacts_master')
          .update(contactData)
          .eq('id', linkedContact.id)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('contacts_master')
          .insert([contactData])
          .select()
          .single()

        if (error) throw error
        setLinkedContact(data)
      }

      alert('Contact details updated successfully!')
      const phoneToLookup = contactData.phone || linkedContact?.phone || selectedLead?.phone
      if (phoneToLookup) {
        const updatedContact = await fetchLinkedContact(phoneToLookup)
        setLinkedContact(updatedContact)
      }
    } catch (error) {
      console.error('Error updating contact:', error)
      alert('Failed to update contact details')
    }
  }

  const handleAddNote = async () => {
    if (!newNoteText.trim() || !linkedContact) return

    try {
      const { data, error } = await supabase
        .from('contact_notes')
        .insert([
          {
            contact_id: linkedContact.id,
            note_text: newNoteText,
            created_by: 'Current User'
          }
        ])
        .select()
        .single()

      if (error) throw error

      setContactNotes([data, ...contactNotes])
      setNewNoteText('')
      alert('Note added successfully!')
    } catch (error) {
      console.error('Error adding note:', error)
      alert('Failed to add note')
    }
  }

  const handleUpdateNote = async (noteId: string, newText: string) => {
    if (!newText.trim()) return

    try {
      const { error } = await supabase
        .from('contact_notes')
        .update({ note_text: newText, updated_at: new Date().toISOString() })
        .eq('id', noteId)

      if (error) throw error

      setContactNotes(contactNotes.map(note =>
        note.id === noteId ? { ...note, note_text: newText, updated_at: new Date().toISOString() } : note
      ))
      setEditingNoteId(null)
      setEditingNoteText('')
      alert('Note updated successfully!')
    } catch (error) {
      console.error('Error updating note:', error)
      alert('Failed to update note')
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return

    try {
      const { error } = await supabase
        .from('contact_notes')
        .delete()
        .eq('id', noteId)

      if (error) throw error

      setContactNotes(contactNotes.filter(note => note.id !== noteId))
      alert('Note deleted successfully!')
    } catch (error) {
      console.error('Error deleting note:', error)
      alert('Failed to delete note')
    }
  }

  const handleAddAppointment = () => {
    if (!linkedContact) return
    navigate('/appointments', {
      state: {
        action: 'add',
        prefilledContact: {
          id: linkedContact.id,
          contact_id: linkedContact.contact_id,
          full_name: linkedContact.full_name,
          phone: linkedContact.phone,
          email: linkedContact.email
        },
        returnTo: '/leads',
        returnToLeadId: selectedLead?.id
      }
    })
  }

  const handleEditAppointment = (appointment: any) => {
    navigate('/appointments', {
      state: {
        action: 'edit',
        appointmentId: appointment.id,
        returnTo: '/leads',
        returnToLeadId: selectedLead?.id
      }
    })
  }

  const handleDeleteAppointment = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to delete this appointment?')) return

    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId)

      if (error) throw error

      if (linkedContact) fetchContactAppointments(linkedContact.id)
      alert('Appointment deleted successfully!')
    } catch (error) {
      console.error('Error deleting appointment:', error)
      alert('Failed to delete appointment')
    }
  }

  const handleAddTask = () => {
    if (!linkedContact) return
    navigate('/tasks', {
      state: {
        action: 'add',
        prefilledContact: {
          id: linkedContact.id,
          name: linkedContact.full_name,
          phone: linkedContact.phone
        },
        returnTo: '/leads',
        returnToLeadId: selectedLead?.id,
        refreshTasks: true
      }
    })
  }

  const handleEditTask = (task: any) => {
    navigate('/tasks', {
      state: {
        action: 'edit',
        taskId: task.id,
        returnTo: '/leads',
        returnToLeadId: selectedLead?.id
      }
    })
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (error) throw error

      if (linkedContact) fetchContactTasks(linkedContact.id)
      alert('Task deleted successfully!')
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Failed to delete task')
    }
  }

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.phone && lead.phone.includes(searchTerm)) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.lead_id && lead.lead_id.toLowerCase().includes(searchTerm.toLowerCase()))

    // Always filter by pipeline - show only leads from selected pipeline
    const matchesPipeline = pipelineFilter ? lead.pipeline_id === pipelineFilter : false
    const matchesSource = !sourceFilter || lead.source === sourceFilter
    const matchesInterest = !interestFilter || lead.interest === interestFilter
    const matchesStage = !stageFilter || lead.stage === stageFilter

    return matchesSearch && matchesPipeline && matchesSource && matchesInterest && matchesStage
  })

  // Debug logging
  console.log('🎯 Filter state:', {
    totalLeads: leads.length,
    pipelineFilter,
    filteredCount: filteredLeads.length,
    leadsWithPipeline: leads.filter(l => l.pipeline_id === pipelineFilter).length
  })

  const getLeadsByStage = (stage: string) => {
    const leadsInStage = filteredLeads.filter(lead => lead.stage === stage)
    console.log(`🔹 Stage "${stage}": ${leadsInStage.length} leads`, leadsInStage.map(l => l.lead_id))
    return leadsInStage
  }

  const totalLeads = filteredLeads.length
  const hotLeads = filteredLeads.filter(l => l.interest === 'Hot').length
  const demoBookedLeads = filteredLeads.filter(l => l.stage === 'Demo Booked').length
  const wonLeads = filteredLeads.filter(l => l.stage === 'Won').length

  console.log('📈 KPIs:', { totalLeads, hotLeads, demoBookedLeads, wonLeads })

  const handleBulkImportClick = () => {
    setView('bulk-import')
    setImportFile(null)
    setImportResults([])
    setShowImportResults(false)
    setImportProgress(0)
  }

  const handleDownloadSample = () => {
    const sampleData = [
      [
        'Name',
        'Email',
        'Phone',
        'Company',
        'Source',
        'Interest Level',
        'Stage',
        'Owner',
        'Address',
        'Notes'
      ],
      [
        'John Doe',
        'john.doe@example.com',
        '1234567890',
        'ABC Corp',
        'Website',
        'Hot',
        'New',
        'Sales Team',
        '123 Main St, City',
        'Sample lead notes'
      ],
      [
        'Jane Smith',
        'jane.smith@example.com',
        '9876543210',
        'XYZ Inc',
        'Referral',
        'Warm',
        'Contacted',
        'Sales Team',
        '456 Oak Ave, Town',
        'Follow up needed'
      ]
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(sampleData)

    const columnWidths = [
      { wch: 25 },
      { wch: 30 },
      { wch: 15 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 35 },
      { wch: 40 }
    ]
    worksheet['!cols'] = columnWidths

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads Template')

    XLSX.writeFile(workbook, 'Leads_Import_Template.xlsx')
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        alert('Please select a valid Excel file (.xlsx or .xls)')
        return
      }
      setImportFile(file)
      setImportResults([])
      setShowImportResults(false)
    }
  }

  const handleBulkImport = async () => {
    if (!importFile) {
      alert('Please select a file to import')
      return
    }

    setIsImporting(true)
    setImportProgress(0)
    setImportResults([])
    setShowImportResults(false)

    try {
      const data = await importFile.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

      if (jsonData.length < 2) {
        alert('The file appears to be empty or has no data rows')
        setIsImporting(false)
        return
      }

      const headers = jsonData[0].map((h: string) => h?.toLowerCase().trim())
      const dataRows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''))

      const results: ImportResult[] = []
      const currentPipelineId = pipelineFilter || selectedPipelineId
      const defaultStage = availableStages[currentPipelineId]?.[0]?.id || availableStages[currentPipelineId]?.[0]?.label || 'New'

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]
        const rowNumber = i + 2

        try {
          const leadData: any = {
            pipeline_id: currentPipelineId
          }

          headers.forEach((header, index) => {
            const value = row[index]
            if (value !== undefined && value !== '') {
              if (header.includes('name')) leadData.name = String(value)
              else if (header.includes('email')) leadData.email = String(value)
              else if (header.includes('phone')) leadData.phone = String(value)
              else if (header.includes('company')) leadData.company = String(value)
              else if (header.includes('source')) leadData.source = String(value)
              else if (header.includes('interest')) leadData.interest = String(value)
              else if (header.includes('stage')) {
                const stageValue = String(value)
                const matchedStage = availableStages[currentPipelineId]?.find(
                  s => s.id.toLowerCase() === stageValue.toLowerCase() ||
                       s.label.toLowerCase() === stageValue.toLowerCase()
                )
                leadData.stage = matchedStage ? matchedStage.id : stageValue
              }
              else if (header.includes('owner')) leadData.owner = String(value)
              else if (header.includes('address')) leadData.address = String(value)
              else if (header.includes('notes')) leadData.notes = String(value)
            }
          })

          if (!leadData.name || !leadData.phone) {
            results.push({
              success: false,
              row: rowNumber,
              error: 'Name and Phone are required fields'
            })
            continue
          }

          if (!leadData.source) leadData.source = 'Import'
          if (!leadData.interest) leadData.interest = 'Cold'
          if (!leadData.stage || !availableStages[currentPipelineId]?.find(s => s.id === leadData.stage)) {
            leadData.stage = defaultStage
          }

          const { data, error } = await supabase
            .from('leads')
            .insert([leadData])
            .select()
            .single()

          if (error) throw error

          results.push({
            success: true,
            row: rowNumber,
            data: leadData
          })
        } catch (error: any) {
          results.push({
            success: false,
            row: rowNumber,
            error: error.message || 'Unknown error'
          })
        }

        setImportProgress(Math.round(((i + 1) / dataRows.length) * 100))
      }

      setImportResults(results)
      setShowImportResults(true)
      await fetchLeads()

      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length

      alert(`Import completed!\nSuccessful: ${successCount}\nFailed: ${failCount}`)
    } catch (error) {
      console.error('Error importing leads:', error)
      alert('Failed to import leads. Please check the file format and try again.')
    } finally {
      setIsImporting(false)
      setImportProgress(0)
    }
  }

  const handleExportData = () => {
    try {
      const currentPipeline = pipelines.find(p => p.id === pipelineFilter)
      const pipelineName = currentPipeline?.name || 'All Leads'

      const leadsToExport = filteredLeads.filter(lead =>
        !pipelineFilter || lead.pipeline_id === pipelineFilter
      )

      if (leadsToExport.length === 0) {
        alert('No leads found for the selected pipeline')
        return
      }

      const worksheetData = [
        [
          'Lead ID',
          'Name',
          'Email',
          'Phone',
          'Company',
          'Source',
          'Interest Level',
          'Stage',
          'Owner',
          'Address',
          'Lead Score',
          'Last Contact',
          'Created Date',
          'Notes'
        ],
        ...leadsToExport.map(lead => [
          lead.lead_id || '',
          lead.name || '',
          lead.email || '',
          lead.phone || '',
          lead.company || '',
          lead.source || '',
          lead.interest || '',
          lead.stage || '',
          lead.owner || '',
          lead.address || '',
          lead.lead_score || '',
          lead.last_contact ? formatDate(lead.last_contact) : '',
          formatDate(lead.created_at),
          lead.notes || ''
        ])
      ]

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

      const columnWidths = [
        { wch: 15 },
        { wch: 25 },
        { wch: 30 },
        { wch: 15 },
        { wch: 25 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 20 },
        { wch: 35 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 40 }
      ]
      worksheet['!cols'] = columnWidths

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads')

      const timestamp = format(new Date(), 'yyyy-MM-dd_HHmmss')
      const fileName = `${pipelineName.replace(/\s+/g, '_')}_Leads_${timestamp}.xlsx`

      XLSX.writeFile(workbook, fileName)

      alert(`Successfully exported ${leadsToExport.length} leads from ${pipelineName}`)
    } catch (error) {
      console.error('Error exporting leads:', error)
      alert('Failed to export leads data')
    }
  }

  if (view === 'bulk-import') {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToList}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Leads
          </Button>
          <h1 className="text-3xl font-bold text-brand-text">Bulk Import Leads</h1>
          <p className="text-gray-600 mt-2">Import multiple leads at once using an Excel file</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Upload Excel File</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <FileSpreadsheet className="w-16 h-16 mb-4 text-gray-400" />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">Excel files only (.xlsx, .xls)</p>
                        {importFile && (
                          <div className="mt-4 px-4 py-2 bg-white border border-gray-200 rounded-lg">
                            <p className="text-sm font-medium text-gray-900">{importFile.name}</p>
                            <p className="text-xs text-gray-500">{(importFile.size / 1024).toFixed(2)} KB</p>
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept=".xlsx,.xls"
                        onChange={handleFileSelect}
                        disabled={isImporting}
                      />
                    </label>
                  </div>
                </div>

                {isImporting && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Importing leads...</span>
                      <span className="font-medium text-brand-primary">{importProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-brand-primary h-3 rounded-full transition-all duration-300 flex items-center justify-center"
                        style={{ width: `${importProgress}%` }}
                      >
                        {importProgress > 10 && (
                          <span className="text-xs text-white font-medium">{importProgress}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <Button
                    onClick={handleBulkImport}
                    disabled={!importFile || isImporting}
                    className="flex-1"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isImporting ? 'Importing...' : 'Start Import'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImportFile(null)
                      setImportResults([])
                      setShowImportResults(false)
                    }}
                    disabled={isImporting}
                  >
                    Clear
                  </Button>
                </div>

                {showImportResults && importResults.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                      Import Results
                      <Badge className="ml-3 bg-green-100 text-green-800">
                        {importResults.filter(r => r.success).length} Success
                      </Badge>
                      {importResults.filter(r => !r.success).length > 0 && (
                        <Badge className="ml-2 bg-red-100 text-red-800">
                          {importResults.filter(r => !r.success).length} Failed
                        </Badge>
                      )}
                    </h3>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {importResults.map((result, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border ${
                            result.success
                              ? 'bg-green-50 border-green-200'
                              : 'bg-red-50 border-red-200'
                          }`}
                        >
                          <div className="flex items-start">
                            {result.success ? (
                              <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                Row {result.row}
                                {result.success && result.data && ` - ${result.data.name}`}
                              </p>
                              {!result.success && (
                                <p className="text-sm text-red-700 mt-1">{result.error}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Instructions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Step 1: Download Template</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Download the sample Excel template to see the correct format for your data.
                  </p>
                  <Button variant="outline" onClick={handleDownloadSample} className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Download Sample Template
                  </Button>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-2">Step 2: Prepare Your Data</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Fill in your lead data following these guidelines:
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li><strong>Name</strong> (Required)</li>
                    <li><strong>Phone</strong> (Required)</li>
                    <li>Email (Optional)</li>
                    <li>Company (Optional)</li>
                    <li>Source, Interest Level, Stage</li>
                    <li>Owner, Address, Notes</li>
                  </ul>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-2">Step 3: Upload & Import</h4>
                  <p className="text-sm text-gray-600">
                    Upload your Excel file and click "Start Import". All leads will be imported to the currently selected pipeline.
                  </p>
                </div>

                <div className="border-t pt-4 bg-blue-50 rounded-lg p-3">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 mb-1">Note</p>
                      <p className="text-xs text-blue-800">
                        Leads will be imported to: <strong>{pipelines.find(p => p.id === (pipelineFilter || selectedPipelineId))?.name}</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'add') {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToList}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Leads
          </Button>
          <h1 className="text-3xl font-bold text-brand-text">Add New Lead</h1>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative contact-search-container">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <div className="relative">
                    <Input
                      value={formData.name}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, name: e.target.value }))
                        searchContacts(e.target.value)
                      }}
                      onFocus={() => {
                        if (formData.name && contactSearchResults.length > 0) {
                          setShowContactDropdown(true)
                        }
                      }}
                      placeholder="Enter full name or search existing contacts"
                    />
                    {isSearchingContacts && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                      </div>
                    )}
                  </div>
                  {showContactDropdown && contactSearchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {contactSearchResults.map((contact) => (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => handleSelectContact(contact)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-900">{contact.full_name}</div>
                              <div className="text-sm text-gray-500 flex items-center space-x-3 mt-1">
                                <span className="flex items-center">
                                  <Phone className="w-3 h-3 mr-1" />
                                  {contact.phone}
                                </span>
                                {contact.email && (
                                  <span className="flex items-center">
                                    <Mail className="w-3 h-3 mr-1" />
                                    {contact.email}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline" className="ml-2">{contact.contact_id}</Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <ValidatedInput
                    validationType="email"
                    isRequired={false}
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address (optional)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                  <ValidatedInput
                    validationType="phone"
                    isRequired={true}
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                  <Input
                    value={formData.company}
                    onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="Enter company name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter address"
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Source *</label>
                  <Select value={formData.source} onValueChange={(value) => setFormData(prev => ({ ...prev, source: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ad">Facebook Ad</SelectItem>
                      <SelectItem value="Referral">Referral</SelectItem>
                      <SelectItem value="Affiliate">Affiliate</SelectItem>
                      <SelectItem value="Website">Website</SelectItem>
                      <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                      <SelectItem value="Webinar">Webinar</SelectItem>
                      <SelectItem value="Cold Call">Cold Call</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Interest Level *</label>
                  <Select value={formData.interest} onValueChange={(value) => setFormData(prev => ({ ...prev, interest: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select interest" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hot">Hot</SelectItem>
                      <SelectItem value="Warm">Warm</SelectItem>
                      <SelectItem value="Cold">Cold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pipeline</label>
                  <Select value={formData.pipeline_id} onValueChange={(value) => {
                    setFormData(prev => ({ ...prev, pipeline_id: value, stage: '' }))
                    if (availableStages[value] && availableStages[value].length > 0) {
                      setFormData(prev => ({ ...prev, stage: availableStages[value][0].id }))
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select pipeline" />
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stage</label>
                  <Select value={formData.stage} onValueChange={(value) => setFormData(prev => ({ ...prev, stage: value }))} disabled={!formData.pipeline_id}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.pipeline_id && availableStages[formData.pipeline_id]?.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assigned To</label>
                  <Select value={formData.owner} onValueChange={(value) => setFormData(prev => ({ ...prev, owner: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.full_name}>
                          {member.full_name} ({member.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Enter any additional notes about this lead"
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <Button onClick={handleCreateLead} disabled={!formData.name || !formData.phone || !formData.source || !formData.interest}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Lead
                </Button>
                <Button variant="outline" onClick={handleBackToList}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (view === 'edit') {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToList}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Leads
          </Button>
          <h1 className="text-3xl font-bold text-brand-text">Edit Lead</h1>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative contact-search-container">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <div className="relative">
                    <Input
                      value={formData.name}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, name: e.target.value }))
                        searchContacts(e.target.value)
                      }}
                      onFocus={() => {
                        if (formData.name && contactSearchResults.length > 0) {
                          setShowContactDropdown(true)
                        }
                      }}
                      placeholder="Enter full name or search existing contacts"
                    />
                    {isSearchingContacts && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                      </div>
                    )}
                  </div>
                  {showContactDropdown && contactSearchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {contactSearchResults.map((contact) => (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => handleSelectContact(contact)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-900">{contact.full_name}</div>
                              <div className="text-sm text-gray-500 flex items-center space-x-3 mt-1">
                                <span className="flex items-center">
                                  <Phone className="w-3 h-3 mr-1" />
                                  {contact.phone}
                                </span>
                                {contact.email && (
                                  <span className="flex items-center">
                                    <Mail className="w-3 h-3 mr-1" />
                                    {contact.email}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline" className="ml-2">{contact.contact_id}</Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <ValidatedInput
                    validationType="email"
                    isRequired={false}
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address (optional)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                  <ValidatedInput
                    validationType="phone"
                    isRequired={true}
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                  <Input
                    value={formData.company}
                    onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="Enter company name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter address"
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Source *</label>
                  <Select value={formData.source} onValueChange={(value) => setFormData(prev => ({ ...prev, source: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ad">Facebook Ad</SelectItem>
                      <SelectItem value="Referral">Referral</SelectItem>
                      <SelectItem value="Affiliate">Affiliate</SelectItem>
                      <SelectItem value="Website">Website</SelectItem>
                      <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                      <SelectItem value="Webinar">Webinar</SelectItem>
                      <SelectItem value="Cold Call">Cold Call</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Interest Level *</label>
                  <Select value={formData.interest} onValueChange={(value) => setFormData(prev => ({ ...prev, interest: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select interest" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hot">Hot</SelectItem>
                      <SelectItem value="Warm">Warm</SelectItem>
                      <SelectItem value="Cold">Cold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pipeline</label>
                  <Select value={formData.pipeline_id} onValueChange={(value) => {
                    setFormData(prev => ({ ...prev, pipeline_id: value, stage: '' }))
                    if (availableStages[value] && availableStages[value].length > 0) {
                      setFormData(prev => ({ ...prev, stage: availableStages[value][0].id }))
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select pipeline" />
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stage</label>
                  <Select value={formData.stage} onValueChange={(value) => setFormData(prev => ({ ...prev, stage: value }))} disabled={!formData.pipeline_id}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.pipeline_id && availableStages[formData.pipeline_id]?.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assigned To</label>
                  <Select value={formData.owner} onValueChange={(value) => setFormData(prev => ({ ...prev, owner: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.full_name}>
                          {member.full_name} ({member.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Enter any additional notes about this lead"
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <PermissionGuard module="leads" action="update">
                  <Button onClick={handleUpdateLead} disabled={!formData.name || !formData.phone}>
                    <Save className="w-4 h-4 mr-2" />
                    Update Lead
                  </Button>
                </PermissionGuard>
                <Button variant="outline" onClick={handleBackToList}>
                  Cancel
                </Button>
                {selectedLead && (
                  <PermissionGuard module="leads" action="delete">
                    <Button
                      variant="outline"
                      onClick={() => handleDeleteLead(selectedLead.id)}
                      className="text-red-600 hover:text-red-700 ml-auto"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Lead
                    </Button>
                  </PermissionGuard>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (view === 'view' && selectedLead) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToList}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Leads
          </Button>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-brand-primary text-white text-xl font-bold">
                  {selectedLead.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl font-bold text-brand-text">{selectedLead.name}</h1>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="secondary">{selectedLead.stage}</Badge>
                  <Badge className={interestColors[selectedLead.interest]}>{selectedLead.interest}</Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button onClick={() => handleEditClick(selectedLead)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Lead
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDeleteLead(selectedLead.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>

        <div className="border-b border-gray-200 mb-6">
          <div className="flex space-x-8 overflow-x-auto">
            {[
              { id: 'lead-details', label: 'Lead Details', icon: Flag },
              { id: 'personal', label: 'Personal', icon: User },
              { id: 'business', label: 'Business', icon: Building },
              { id: 'notes', label: 'Notes', icon: StickyNote },
              { id: 'appointments', label: 'Appointments', icon: Calendar },
              { id: 'tasks', label: 'Tasks', icon: CheckSquare }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDetailTab(tab.id as TabType)}
                className={`flex items-center space-x-2 pb-4 px-1 border-b-2 transition-colors flex-shrink-0 ${
                  detailTab === tab.id
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {detailTab === 'lead-details' && (
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-64 flex-shrink-0">
                <Card className="md:sticky md:top-6">
                  <CardContent className="p-4">
                    <nav className="space-y-1">
                      {[
                        { id: 'info', label: 'Lead Information', icon: Flag },
                        ...customTabs.filter(tab => tab.is_active).map(tab => ({
                          id: tab.tab_id,
                          label: tab.tab_name,
                          icon: Layers
                        }))
                      ].map((subTab) => (
                        <button
                          key={subTab.id}
                          onClick={() => setLeadDetailsSubTab(subTab.id)}
                          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-left ${
                            leadDetailsSubTab === subTab.id
                              ? 'bg-brand-primary text-white'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <subTab.icon className="w-5 h-5" />
                          <span className="font-medium">{subTab.label}</span>
                        </button>
                      ))}
                    </nav>
                  </CardContent>
                </Card>
              </div>

              <div className="flex-1">
                {leadDetailsSubTab === 'info' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Lead Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="text-sm text-gray-600">Lead ID</label>
                          <p className="font-medium mt-1">{selectedLead.lead_id}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-600">Stage</label>
                          <p className="font-medium mt-1">
                            <Badge variant="secondary">{selectedLead.stage}</Badge>
                          </p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-600">Source</label>
                          <p className="font-medium mt-1">{selectedLead.source}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-600">Interest Level</label>
                          <p className="font-medium mt-1">
                            <Badge className={interestColors[selectedLead.interest]}>{selectedLead.interest}</Badge>
                          </p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-600">Email</label>
                          <p className="font-medium mt-1">{selectedLead.email || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-600">Phone</label>
                          <p className="font-medium mt-1">{selectedLead.phone}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-600">Assigned To</label>
                          <p className="font-medium mt-1">{selectedLead.owner || 'Unassigned'}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-600">Created Date</label>
                          <p className="font-medium mt-1">{formatDate(selectedLead.created_at)}</p>
                        </div>
                        {selectedLead.lead_score && (
                          <div>
                            <label className="text-sm text-gray-600">Lead Score</label>
                            <p className="font-medium mt-1">{selectedLead.lead_score}/100</p>
                          </div>
                        )}
                        {selectedLead.last_contact && (
                          <div>
                            <label className="text-sm text-gray-600">Last Contact</label>
                            <p className="font-medium mt-1">{formatDate(selectedLead.last_contact)}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {customTabs.map((customTab) => {
                  const tabFields = customFields[customTab.id] || []
                  return leadDetailsSubTab === customTab.tab_id && (
                    <Card key={customTab.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Layers className="w-5 h-5" />
                          <span>{customTab.tab_name}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {tabFields.length === 0 ? (
                          <div className="text-center py-12">
                            <Layers className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-600 mb-2">No custom fields configured</p>
                            <p className="text-sm text-gray-500">
                              Go to Settings &gt; Custom Fields to add fields to this tab
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {customFieldsMessage && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className={`p-4 rounded-lg flex items-center space-x-2 ${
                                  customFieldsMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                                }`}
                              >
                                {customFieldsMessage.type === 'success' ? (
                                  <CheckCircle className="w-5 h-5" />
                                ) : (
                                  <AlertCircle className="w-5 h-5" />
                                )}
                                <span>{customFieldsMessage.text}</span>
                              </motion.div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {tabFields.map((field) => (
                                <div key={field.id}>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {field.field_name}
                                    {field.is_required && <span className="text-red-500 ml-1">*</span>}
                                  </label>
                                  {field.field_type === 'text' && (
                                    <Input
                                      value={customFieldValues[field.id] || ''}
                                      onChange={(e) => handleCustomFieldChange(field.id, e.target.value, 'text')}
                                      placeholder={`Enter ${field.field_name.toLowerCase()}`}
                                    />
                                  )}
                                  {field.field_type === 'dropdown_single' && (
                                    <Select
                                      value={customFieldValues[field.id] || ''}
                                      onValueChange={(value) => handleCustomFieldChange(field.id, value, 'dropdown_single')}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder={`Select ${field.field_name.toLowerCase()}`} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {field.dropdown_options.map((option) => (
                                          <SelectItem key={option} value={option}>
                                            {option}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                  {field.field_type === 'dropdown_multiple' && (
                                    <div className="space-y-2">
                                      <Select
                                        value=""
                                        onValueChange={(value) => {
                                          const currentValues = customFieldValues[field.id]
                                            ? customFieldValues[field.id].split(',').map(v => v.trim()).filter(v => v)
                                            : []

                                          if (!currentValues.includes(value)) {
                                            const newValues = [...currentValues, value]
                                            const newValue = newValues.join(', ')
                                            handleCustomFieldChange(field.id, newValue, 'dropdown_multiple')
                                          }
                                        }}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder={`Select ${field.field_name.toLowerCase()}`} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {field.dropdown_options.map((option) => {
                                            const currentValues = customFieldValues[field.id]
                                              ? customFieldValues[field.id].split(',').map(v => v.trim()).filter(v => v)
                                              : []
                                            const isSelected = currentValues.includes(option)

                                            return (
                                              <SelectItem
                                                key={option}
                                                value={option}
                                                disabled={isSelected}
                                              >
                                                {option} {isSelected && '✓'}
                                              </SelectItem>
                                            )
                                          })}
                                        </SelectContent>
                                      </Select>

                                      {customFieldValues[field.id] && customFieldValues[field.id].split(',').map(v => v.trim()).filter(v => v).length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                          {customFieldValues[field.id].split(',').map(v => v.trim()).filter(v => v).map((value) => (
                                            <Badge
                                              key={value}
                                              variant="secondary"
                                              className="bg-brand-primary text-white flex items-center gap-1"
                                            >
                                              {value}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const currentValues = customFieldValues[field.id]
                                                    .split(',')
                                                    .map(v => v.trim())
                                                    .filter(v => v !== value)
                                                  const newValue = currentValues.join(', ')
                                                  handleCustomFieldChange(field.id, newValue, 'dropdown_multiple')
                                                }}
                                                className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                                              >
                                                <X className="w-3 h-3" />
                                              </button>
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {field.field_type === 'date' && (
                                    <Input
                                      type="date"
                                      value={customFieldValues[field.id] || ''}
                                      onChange={(e) => handleCustomFieldChange(field.id, e.target.value, 'date')}
                                    />
                                  )}
                                  {field.field_type === 'number' && (
                                    <Input
                                      type="number"
                                      value={customFieldValues[field.id] || ''}
                                      onChange={(e) => handleCustomFieldChange(field.id, e.target.value, 'number')}
                                      placeholder={`Enter ${field.field_name.toLowerCase()}`}
                                    />
                                  )}
                                  {field.field_type === 'email' && (
                                    <div>
                                      <Input
                                        type="email"
                                        value={customFieldValues[field.id] || ''}
                                        onChange={(e) => handleCustomFieldChange(field.id, e.target.value, 'email')}
                                        placeholder={`Enter ${field.field_name.toLowerCase()}`}
                                        className={customFieldErrors[field.id] ? 'border-red-500' : ''}
                                      />
                                      {customFieldErrors[field.id] && (
                                        <p className="text-xs text-red-500 mt-1">{customFieldErrors[field.id]}</p>
                                      )}
                                    </div>
                                  )}
                                  {field.field_type === 'phone' && (
                                    <div>
                                      <Input
                                        type="tel"
                                        value={customFieldValues[field.id] || ''}
                                        onChange={(e) => handleCustomFieldChange(field.id, e.target.value, 'phone')}
                                        placeholder="Enter 10-digit mobile number"
                                        maxLength={10}
                                        className={customFieldErrors[field.id] ? 'border-red-500' : ''}
                                      />
                                      {customFieldErrors[field.id] && (
                                        <p className="text-xs text-red-500 mt-1">{customFieldErrors[field.id]}</p>
                                      )}
                                    </div>
                                  )}
                                  {field.field_type === 'url' && (
                                    <Input
                                      type="url"
                                      value={customFieldValues[field.id] || ''}
                                      onChange={(e) => handleCustomFieldChange(field.id, e.target.value, 'url')}
                                      placeholder={`Enter ${field.field_name.toLowerCase()}`}
                                    />
                                  )}
                                  {field.field_type === 'currency' && (
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={customFieldValues[field.id] || ''}
                                        onChange={(e) => handleCustomFieldChange(field.id, e.target.value, 'currency')}
                                        placeholder="0.00"
                                        className="pl-7"
                                      />
                                    </div>
                                  )}
                                  {field.field_type === 'longtext' && (
                                    <Textarea
                                      value={customFieldValues[field.id] || ''}
                                      onChange={(e) => handleCustomFieldChange(field.id, e.target.value, 'longtext')}
                                      placeholder={`Enter ${field.field_name.toLowerCase()}`}
                                      rows={4}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>

                            <div className="flex justify-end pt-4 border-t">
                              <Button
                                onClick={saveAllCustomFields}
                                disabled={isSavingCustomFields}
                                className="min-w-[150px]"
                              >
                                {isSavingCustomFields ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Changes
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {detailTab === 'personal' && (
            <Card>
              <CardHeader>
                <CardTitle>Personal Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {!linkedContact && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-blue-800">
                        <AlertCircle className="w-4 h-4 inline mr-2" />
                        No contact record found. Fill in the details below to create one.
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                      <Input
                        value={formData.fullName || linkedContact?.full_name || selectedLead?.name || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                      <Input
                        value={formData.phoneNumber || linkedContact?.phone || selectedLead?.phone || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <Input
                        type="email"
                        value={formData.emailAddress || linkedContact?.email || selectedLead?.email || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, emailAddress: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                      <Input
                        type="date"
                        value={formData.dateOfBirth || linkedContact?.date_of_birth || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                      <Select
                        value={formData.gender || linkedContact?.gender || ''}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Education Level</label>
                      <Input
                        value={formData.educationLevel || linkedContact?.education_level || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, educationLevel: e.target.value }))}
                        placeholder="e.g., Bachelor's, Master's"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Profession</label>
                      <Input
                        value={formData.profession || linkedContact?.profession || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, profession: e.target.value }))}
                        placeholder="e.g., Software Engineer"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Experience (Years)</label>
                      <Input
                        value={formData.experience || linkedContact?.experience || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, experience: e.target.value }))}
                        placeholder="e.g., 5"
                      />
                    </div>
                  </div>

                  <Button onClick={handleUpdateContact}>
                    <Save className="w-4 h-4 mr-2" />
                    {linkedContact ? 'Save Personal Details' : 'Create Contact & Save Details'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {detailTab === 'business' && (
            <Card>
              <CardHeader>
                <CardTitle>Business Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {!linkedContact && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-blue-800">
                        <AlertCircle className="w-4 h-4 inline mr-2" />
                        No contact record found. Fill in the details below to create one.
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Business Name</label>
                      <Input
                        value={formData.businessName || linkedContact?.business_name || selectedLead?.company || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                        placeholder="Enter business name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">GST Number</label>
                      <Input
                        value={formData.gstNumber || linkedContact?.gst_number || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, gstNumber: e.target.value }))}
                        placeholder="Enter GST number"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                    <Input
                      value={formData.address || linkedContact?.address || selectedLead?.address || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Enter business address"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                      <Input
                        value={formData.city || linkedContact?.city || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                        placeholder="Enter city"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                      <Input
                        value={formData.state || linkedContact?.state || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                        placeholder="Enter state"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Pincode</label>
                      <Input
                        value={formData.pincode || linkedContact?.pincode || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, pincode: e.target.value }))}
                        placeholder="Enter pincode"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Type</label>
                    <Select
                      value={formData.contactType || linkedContact?.contact_type || 'Lead'}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, contactType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Customer">Customer</SelectItem>
                        <SelectItem value="Vendor">Vendor</SelectItem>
                        <SelectItem value="Partner">Partner</SelectItem>
                        <SelectItem value="Lead">Lead</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={handleUpdateContact}>
                    <Save className="w-4 h-4 mr-2" />
                    {linkedContact ? 'Save Business Details' : 'Create Contact & Save Details'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {detailTab === 'notes' && (
            <Card>
              <CardHeader>
                <CardTitle>Contact Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {linkedContact ? (
                  <div className="space-y-4">
                    <div className="flex space-x-2">
                      <Input
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        placeholder="Add a new note..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleAddNote()
                          }
                        }}
                      />
                      <Button onClick={handleAddNote} disabled={!newNoteText.trim()}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Note
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {contactNotes.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                          <StickyNote className="w-12 h-12 mx-auto mb-3" />
                          <p>No notes yet. Add your first note above.</p>
                        </div>
                      ) : (
                        contactNotes.map((note) => (
                          <div key={note.id} className="p-4 bg-gray-50 rounded-lg">
                            {editingNoteId === note.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editingNoteText}
                                  onChange={(e) => setEditingNoteText(e.target.value)}
                                  rows={3}
                                />
                                <div className="flex space-x-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleUpdateNote(note.id, editingNoteText)}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingNoteId(null)
                                      setEditingNoteText('')
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-start justify-between">
                                  <p className="text-gray-700 flex-1">{note.note_text}</p>
                                  <div className="flex space-x-1 ml-4">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingNoteId(note.id)
                                        setEditingNoteText(note.note_text)
                                      }}
                                    >
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteNote(note.id)}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2 mt-2 text-xs text-gray-500">
                                  <span>{note.created_by}</span>
                                  <span>•</span>
                                  <span>{formatDate(note.created_at)}</span>
                                  {note.updated_at && note.updated_at !== note.created_at && (
                                    <>
                                      <span>•</span>
                                      <span>Edited</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>No contact record found for this lead.</p>
                    <p className="text-sm mt-2">Notes will be available once a contact is created.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {detailTab === 'appointments' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Appointments ({contactAppointments.length})</CardTitle>
                  {linkedContact && (
                    <Button
                      onClick={handleAddAppointment}
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Appointment
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {linkedContact ? (
                  isLoadingAppointments ? (
                    <div className="text-center py-8">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-brand-primary" />
                      <p className="text-gray-600">Loading appointments...</p>
                    </div>
                  ) : contactAppointments.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Calendar className="w-12 h-12 mx-auto mb-3" />
                      <p>No appointments scheduled</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contactAppointments.map((appointment) => (
                        <div key={appointment.id} className="bg-gray-50 p-4 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Badge className={
                                  appointment.status === 'Confirmed' ? 'bg-green-100 text-green-800' :
                                  appointment.status === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
                                  appointment.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {appointment.status}
                                </Badge>
                                <Badge className="bg-purple-100 text-purple-800">
                                  {appointment.meeting_type}
                                </Badge>
                              </div>
                              <div className="font-medium text-sm text-gray-500 mb-1">
                                ID: {appointment.appointment_id}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditAppointment(appointment)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteAppointment(appointment.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span>{formatDate(appointment.appointment_date)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <span>{formatTime(appointment.appointment_time)} ({appointment.duration_minutes}m)</span>
                            </div>
                            {appointment.location && (
                              <div className="flex items-center gap-2 text-sm col-span-2">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span>{appointment.location}</span>
                              </div>
                            )}
                          </div>

                          {appointment.notes && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-sm text-gray-600">{appointment.notes}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>No contact record found for this lead.</p>
                    <p className="text-sm mt-2">Appointments will be available once a contact is created.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {detailTab === 'tasks' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Tasks ({contactTasks.length})</CardTitle>
                  {linkedContact && (
                    <Button
                      onClick={handleAddTask}
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Task
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {linkedContact ? (
                  isLoadingTasks ? (
                    <div className="text-center py-8">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-brand-primary" />
                      <p className="text-gray-600">Loading tasks...</p>
                    </div>
                  ) : contactTasks.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <CheckSquare className="w-12 h-12 mx-auto mb-3" />
                      <p>No tasks found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contactTasks.map((task) => (
                        <div key={task.id} className="bg-gray-50 p-4 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Badge className={
                                  task.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                  task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                  task.status === 'In Review' ? 'bg-yellow-100 text-yellow-800' :
                                  task.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {task.status}
                                </Badge>
                                <Badge className={
                                  task.priority === 'Urgent' ? 'bg-red-100 text-red-800' :
                                  task.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                                  task.priority === 'Medium' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }>
                                  <Flag className="w-3 h-3 mr-1" />
                                  {task.priority}
                                </Badge>
                                <Badge className="bg-purple-100 text-purple-800">
                                  {task.category}
                                </Badge>
                              </div>
                              <div className="font-medium text-gray-900 mb-1">{task.title}</div>
                              <div className="text-sm text-gray-500 mb-1">
                                ID: {task.task_id}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditTask(task)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteTask(task.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {task.assigned_to_name && (
                              <div className="flex items-center gap-2 text-sm">
                                <Users className="w-4 h-4 text-gray-400" />
                                <span>{task.assigned_to_name}</span>
                              </div>
                            )}
                            {task.due_date && (
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span>Due: {formatDate(task.due_date)}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-sm">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-500">Progress</span>
                                  <span className="text-xs font-medium">{task.progress_percentage}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-brand-primary h-2 rounded-full transition-all"
                                    style={{ width: `${task.progress_percentage}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {task.description && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-sm text-gray-600">{task.description}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>No contact record found for this lead.</p>
                    <p className="text-sm mt-2">Tasks will be available once a contact is created.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    )
  }

  const headerActions = []

  if (canRead('leads')) {
    headerActions.push({
      label: 'Export All Data',
      onClick: handleExportData,
      icon: Download,
      variant: 'outline' as const
    })
  }

  if (canCreate('leads')) {
    headerActions.push({
      label: 'Bulk Import',
      onClick: handleBulkImportClick,
      icon: Upload,
      variant: 'outline' as const
    })
    headerActions.push({
      label: 'Add New Lead',
      onClick: handleAddClick,
      icon: Plus
    })
  }

  if (!canRead('leads')) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h3>
            <p className="text-gray-600">You don't have permission to view leads.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Leads Management"
        subtitle="Track and manage your sales pipeline"
        actions={headerActions}
      />

      {loading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center py-12"
        >
          <div className="flex items-center space-x-3">
            <RefreshCw className="w-6 h-6 text-brand-primary animate-spin" />
            <span className="text-lg text-gray-600">Loading leads data...</span>
          </div>
        </motion.div>
      ) : (
        <>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1
                }
              }
            }}
          >
            <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
              <KPICard
                title="Total Leads"
                value={totalLeads}
                change={12}
                icon={Users}
                category="primary"
              />
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
              <KPICard
                title="Hot Leads"
                value={hotLeads}
                change={8}
                icon={Flag}
                category="warning"
              />
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
              <KPICard
                title="Demo Booked"
                value={demoBookedLeads}
                change={15}
                icon={Calendar}
                category="secondary"
              />
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
              <KPICard
                title="Won"
                value={wonLeads}
                change={5}
                icon={CheckSquare}
                category="success"
              />
            </motion.div>
          </motion.div>

          <motion.div
            className="mb-6 flex gap-4 flex-wrap"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Input
              placeholder="Search leads by name, email, phone, or lead ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            <select
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
              value={pipelineFilter}
              onChange={(e) => {
                setPipelineFilter(e.target.value)
                if (e.target.value && availableStages[e.target.value]) {
                  setStageColumns(availableStages[e.target.value])
                }
                setStageFilter('')
              }}
            >
              {pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>
              ))}
            </select>
            <select
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="">All Sources</option>
              <option value="Ad">Facebook Ad</option>
              <option value="Referral">Referral</option>
              <option value="Affiliate">Affiliate</option>
              <option value="Website">Website</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Webinar">Webinar</option>
              <option value="Cold Call">Cold Call</option>
            </select>
            <select
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
              value={interestFilter}
              onChange={(e) => setInterestFilter(e.target.value)}
            >
              <option value="">All Interest Levels</option>
              <option value="Hot">Hot</option>
              <option value="Warm">Warm</option>
              <option value="Cold">Cold</option>
            </select>
            <select
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="">All Stages</option>
              {stageColumns.map((stage) => (
                <option key={stage.id} value={stage.id}>{stage.label}</option>
              ))}
            </select>
            <div className="ml-auto flex items-center gap-2 border border-gray-300 rounded-md overflow-hidden">
              <button
                onClick={() => setDisplayMode('kanban')}
                className={`px-4 py-2 flex items-center gap-2 transition-colors ${
                  displayMode === 'kanban'
                    ? 'bg-brand-primary text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Kanban
              </button>
              <button
                onClick={() => setDisplayMode('list')}
                className={`px-4 py-2 flex items-center gap-2 transition-colors ${
                  displayMode === 'list'
                    ? 'bg-brand-primary text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <List className="w-4 h-4" />
                List
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {displayMode === 'kanban' ? (
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle>{pipelines.find(p => p.id === pipelineFilter)?.name || 'Pipeline'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto pb-4">
                  <div className="flex gap-6 min-w-max">
          {stageColumns.map((column) => (
            <div
              key={column.id}
              className="bg-gray-50 rounded-lg p-4 w-60 flex-shrink-0"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">{column.label}</h3>
                <Badge variant="secondary" className="bg-gray-200">
                  {getLeadsByStage(column.id).length}
                </Badge>
              </div>

              <div className="space-y-3">
                <AnimatePresence>
                  {getLeadsByStage(column.id).length === 0 ? (
                    <div className="text-center text-gray-400 py-8 text-sm">
                      No leads in this stage
                    </div>
                  ) : (
                    getLeadsByStage(column.id).map((lead, index) => (
                      <motion.div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead)}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: index * 0.05 }}
                        className={`border-l-4 border-r border-t border-b border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${getStageColorClasses(column.color)}`}
                        onClick={() => handleViewLead(lead)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <GripVertical
                              className="w-4 h-4 text-gray-400 cursor-move flex-shrink-0"
                              onMouseDown={(e) => e.stopPropagation()}
                            />
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarFallback className="bg-brand-primary text-white text-xs">
                                {lead.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 text-sm leading-tight truncate">
                                {lead.name}
                              </h4>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 flex-shrink-0">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewLead(lead); }}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditClick(lead); }}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Lead
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); handleDeleteLead(lead.id); }}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Lead
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="text-xs text-gray-600 space-y-1 mb-2">
                          {lead.email && (
                            <div className="flex items-center space-x-1 truncate">
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{lead.email}</span>
                            </div>
                          )}
                          {lead.phone && (
                            <div className="flex items-center space-x-1">
                              <Phone className="w-3 h-3 flex-shrink-0" />
                              <span>{lead.phone}</span>
                            </div>
                          )}
                          {lead.company && (
                            <div className="flex items-center space-x-1 truncate">
                              <Building className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{lead.company}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <Badge className={interestColors[lead.interest]} variant="secondary">
                            {lead.interest}
                          </Badge>
                          {lead.owner && (
                            <div className="text-xs text-gray-500 truncate ml-2">
                              {lead.owner}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            ) : (
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle>{pipelines.find(p => p.id === pipelineFilter)?.name || 'Pipeline'} - List View</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Lead ID</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Contact</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Company</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Source</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Interest</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Stage</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Owner</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-12 text-gray-400">
                            No leads found
                          </td>
                        </tr>
                      ) : (
                        filteredLeads.map((lead, index) => (
                          <motion.tr
                            key={lead.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => handleViewLead(lead)}
                          >
                            <td className="py-3 px-4">
                              <span className="text-sm font-medium text-brand-primary">{lead.lead_id}</span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-brand-primary text-white text-xs">
                                    {lead.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-gray-900">{lead.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-sm space-y-1">
                                <div className="flex items-center space-x-1 text-gray-600">
                                  <Phone className="w-3 h-3" />
                                  <span>{lead.phone}</span>
                                </div>
                                {lead.email && (
                                  <div className="flex items-center space-x-1 text-gray-600">
                                    <Mail className="w-3 h-3" />
                                    <span className="truncate max-w-[200px]">{lead.email}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-sm text-gray-600">{lead.company || '-'}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-sm text-gray-600">{lead.source}</span>
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={interestColors[lead.interest]} variant="secondary">
                                {lead.interest}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                                {lead.stage}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-sm text-gray-600">{lead.owner || '-'}</span>
                            </td>
                            <td className="py-3 px-4">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewLead(lead); }}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditClick(lead); }}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Lead
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); handleDeleteLead(lead.id); }}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Lead
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </motion.tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            )}
          </motion.div>
        </>
      )}
    </div>
  )
}
