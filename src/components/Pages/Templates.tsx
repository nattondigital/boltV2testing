import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Eye, Edit, Trash2, Copy, Download, Upload, Star, X, Save,
  Globe, Zap, Workflow, ExternalLink, MessageSquare,
  Search, Filter, Grid, List, Play, Pause, Settings,
  Image, Video, Link, Tag, Calendar, User, Heart,
  TrendingUp, Users, Clock, Award, CheckCircle, FileText,
  FileImage, FileVideo, FileAudio, File
} from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { KPICard } from '@/components/Common/KPICard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

// Mock data for different template types
const mockWebsites = [
  {
    id: 'WEB-001',
    name: 'SaaS Landing Page',
    description: 'High-converting landing page template for SaaS products',
    category: 'SaaS',
    thumbnail: 'https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=400',
    videoUrl: 'https://example.com/saas-demo.mp4',
    redirectUrl: 'https://demo.saastemplate.com',
    rating: 4.9,
    downloads: 345,
    tags: ['SaaS', 'Landing Page', 'Conversion'],
    createdBy: 'Sarah Johnson',
    createdAt: '2024-01-18',
    status: 'Published',
    features: ['Responsive Design', 'Payment Integration', 'Analytics', 'A/B Testing']
  },
  {
    id: 'WEB-002',
    name: 'E-commerce Store',
    description: 'Complete e-commerce website with shopping cart and payment gateway',
    category: 'E-commerce',
    thumbnail: 'https://images.pexels.com/photos/230544/pexels-photo-230544.jpeg?auto=compress&cs=tinysrgb&w=400',
    videoUrl: null,
    redirectUrl: 'https://demo.ecomstore.com',
    rating: 4.8,
    downloads: 278,
    tags: ['E-commerce', 'Shopping Cart', 'Payments'],
    createdBy: 'Alex Chen',
    createdAt: '2024-01-16',
    status: 'Published',
    features: ['Product Catalog', 'Shopping Cart', 'Payment Gateway', 'Order Management']
  },
  {
    id: 'WEB-003',
    name: 'Agency Portfolio',
    description: 'Professional portfolio website for digital agencies and freelancers',
    category: 'Portfolio',
    thumbnail: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=400',
    videoUrl: 'https://example.com/portfolio-demo.mp4',
    redirectUrl: 'https://demo.agencyportfolio.com',
    rating: 4.6,
    downloads: 198,
    tags: ['Portfolio', 'Agency', 'Professional'],
    createdBy: 'Emma Davis',
    createdAt: '2024-01-14',
    status: 'Published',
    features: ['Project Showcase', 'Client Testimonials', 'Contact Forms', 'Blog Integration']
  }
]

const mockLandingPages = [
  {
    id: 'LP-001',
    name: 'Course Sales Page',
    description: 'High-converting sales page template for online courses',
    category: 'Education',
    thumbnail: 'https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=400',
    videoUrl: 'https://example.com/course-demo.mp4',
    redirectUrl: 'https://demo.coursepage.com',
    rating: 4.9,
    downloads: 456,
    tags: ['Course Sales', 'Education', 'High Converting'],
    createdBy: 'David Wilson',
    createdAt: '2024-01-20',
    status: 'Published',
    features: ['Video Integration', 'Testimonials', 'Payment Forms', 'Countdown Timer']
  },
  {
    id: 'LP-002',
    name: 'Lead Magnet Page',
    description: 'Optimized landing page for lead generation and email capture',
    category: 'Lead Generation',
    thumbnail: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=400',
    videoUrl: null,
    redirectUrl: 'https://demo.leadmagnet.com',
    rating: 4.7,
    downloads: 312,
    tags: ['Lead Generation', 'Email Capture', 'Conversion'],
    createdBy: 'Lisa Anderson',
    createdAt: '2024-01-17',
    status: 'Published',
    features: ['Email Capture', 'Social Proof', 'Mobile Optimized', 'Analytics Tracking']
  }
]

const mockN8nWorkflows = [
  {
    id: 'N8N-001',
    name: 'Lead Nurturing Sequence',
    description: 'Automated email sequence for nurturing leads through the sales funnel',
    category: 'Email Marketing',
    thumbnail: 'https://images.pexels.com/photos/4439901/pexels-photo-4439901.jpeg?auto=compress&cs=tinysrgb&w=400',
    videoUrl: 'https://example.com/workflow-demo.mp4',
    redirectUrl: null,
    rating: 4.8,
    downloads: 189,
    tags: ['Email Marketing', 'Lead Nurturing', 'Automation'],
    createdBy: 'Tom Rodriguez',
    createdAt: '2024-01-19',
    status: 'Published',
    features: ['Email Sequences', 'Conditional Logic', 'CRM Integration', 'Analytics']
  },
  {
    id: 'N8N-002',
    name: 'Social Media Automation',
    description: 'Workflow to automatically post content across multiple social platforms',
    category: 'Social Media',
    thumbnail: 'https://images.pexels.com/photos/267371/pexels-photo-267371.jpeg?auto=compress&cs=tinysrgb&w=400',
    videoUrl: null,
    redirectUrl: null,
    rating: 4.6,
    downloads: 145,
    tags: ['Social Media', 'Content Automation', 'Multi-platform'],
    createdBy: 'Rachel Green',
    createdAt: '2024-01-13',
    status: 'Published',
    features: ['Multi-platform Posting', 'Content Scheduling', 'Hashtag Optimization', 'Analytics']
  }
]



const statusColors: Record<string, string> = {
  'Published': 'bg-green-100 text-green-800',
  'Draft': 'bg-yellow-100 text-yellow-800',
  'Archived': 'bg-gray-100 text-gray-800',
  'Under Review': 'bg-blue-100 text-blue-800'
}

const categoryColors: Record<string, string> = {
  'SaaS': 'bg-indigo-100 text-indigo-800',
  'E-commerce': 'bg-orange-100 text-orange-800',
  'Portfolio': 'bg-pink-100 text-pink-800',
  'Education': 'bg-red-100 text-red-800',
  'Lead Generation': 'bg-yellow-100 text-yellow-800',
  'Email Marketing': 'bg-cyan-100 text-cyan-800',
  'Social Media': 'bg-violet-100 text-violet-800'
}

export function Templates() {
  const [activeTab, setActiveTab] = useState<'websites' | 'landing-pages' | 'n8n-workflows' | 'whatsapp-templates'>('websites')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    status: 'Draft',
    thumbnail: '',
    videoUrl: '',
    redirectUrl: '',
    tags: '',
    features: '',
    type: 'Text',
    mediaUrl: '',
    bodyText: ''
  })
  const [uploadingFile, setUploadingFile] = useState(false)
  const [fileError, setFileError] = useState('')
  const [loading, setLoading] = useState(false)

  // State for each template type
  const [websites, setWebsites] = useState(mockWebsites)
  const [landingPages, setLandingPages] = useState(mockLandingPages)
  const [n8nWorkflows, setN8nWorkflows] = useState(mockN8nWorkflows)
  const [whatsappTemplates, setWhatsappTemplates] = useState<any[]>([])

  // Load WhatsApp templates from database
  useEffect(() => {
    if (activeTab === 'whatsapp-templates') {
      loadWhatsappTemplates()
    }
  }, [activeTab])

  const loadWhatsappTemplates = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Map database fields to match component expectations
      const mappedData = data?.map(template => ({
        id: template.id,
        name: template.name,
        type: template.type,
        mediaUrl: template.media_url,
        bodyText: template.body_text,
        status: template.status,
        createdBy: template.created_by,
        createdAt: template.created_at
      })) || []

      setWhatsappTemplates(mappedData)
    } catch (error) {
      console.error('Error loading WhatsApp templates:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get current templates based on active tab
  const getCurrentTemplates = () => {
    switch (activeTab) {
      case 'websites': return websites
      case 'landing-pages': return landingPages
      case 'n8n-workflows': return n8nWorkflows
      case 'whatsapp-templates': return whatsappTemplates
      default: return []
    }
  }

  const setCurrentTemplates = (templates: any[]) => {
    switch (activeTab) {
      case 'websites': setWebsites(templates); break
      case 'landing-pages': setLandingPages(templates); break
      case 'n8n-workflows': setN8nWorkflows(templates); break
      case 'whatsapp-templates': setWhatsappTemplates(templates); break
    }
  }

  const currentTemplates = getCurrentTemplates()
  
  const filteredTemplates = currentTemplates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (template.description && template.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (template.bodyText && template.bodyText.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (template.tags && template.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    const matchesCategory = !categoryFilter || template.category === categoryFilter || (activeTab === 'whatsapp-templates' && (!categoryFilter || template.type === categoryFilter))
    const matchesStatus = !statusFilter || template.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  // Calculate KPIs
  const totalTemplates = currentTemplates.length
  const publishedTemplates = currentTemplates.filter(t => t.status === 'Published').length
  const totalDownloads = activeTab === 'whatsapp-templates' ? 0 : currentTemplates.reduce((sum, t) => sum + (t.downloads || 0), 0)
  const avgRating = activeTab === 'whatsapp-templates' ? 0 : (currentTemplates.reduce((sum, t) => sum + (t.rating || 0), 0) / currentTemplates.length || 0)

  const handleViewTemplate = (template: any) => {
    setSelectedTemplate(template)
    setShowViewModal(true)
  }

  const handleEditTemplate = (template: any) => {
    setSelectedTemplate(template)
    if (activeTab === 'whatsapp-templates') {
      setFormData({
        name: template.name,
        description: '',
        category: '',
        status: template.status,
        thumbnail: '',
        videoUrl: '',
        redirectUrl: '',
        tags: '',
        features: '',
        type: template.type || 'Text',
        mediaUrl: template.mediaUrl || '',
        bodyText: template.bodyText || ''
      })
    } else {
      setFormData({
        name: template.name,
        description: template.description,
        category: template.category,
        status: template.status,
        thumbnail: template.thumbnail,
        videoUrl: template.videoUrl || '',
        redirectUrl: template.redirectUrl || '',
        tags: template.tags.join(', '),
        features: template.features.join(', '),
        type: 'Text',
        mediaUrl: '',
        bodyText: ''
      })
    }
    setShowEditModal(true)
  }

  const handleCreateTemplate = async () => {
    if (activeTab === 'whatsapp-templates') {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('whatsapp_templates')
          .insert({
            name: formData.name,
            type: formData.type,
            media_url: formData.mediaUrl || null,
            body_text: formData.bodyText,
            status: formData.status,
            created_by: 'Admin User'
          })
          .select()
          .single()

        if (error) throw error

        await loadWhatsappTemplates()
        setShowCreateModal(false)
        resetForm()
      } catch (error) {
        console.error('Error creating WhatsApp template:', error)
        alert('Failed to create template. Please try again.')
      } finally {
        setLoading(false)
      }
    } else {
      let newTemplate: any = {
        id: `${activeTab.toUpperCase().replace('-', '')}-${String(Date.now()).slice(-3)}`,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        thumbnail: formData.thumbnail,
        videoUrl: formData.videoUrl || null,
        redirectUrl: formData.redirectUrl || null,
        rating: 0,
        downloads: 0,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        createdBy: 'Admin User',
        createdAt: new Date().toISOString().split('T')[0],
        status: formData.status,
        features: formData.features.split(',').map(feature => feature.trim()).filter(feature => feature)
      }

      const updatedTemplates = [...currentTemplates, newTemplate]
      setCurrentTemplates(updatedTemplates)
      setShowCreateModal(false)
      resetForm()
    }
  }

  const handleUpdateTemplate = async () => {
    if (activeTab === 'whatsapp-templates') {
      try {
        setLoading(true)
        const { error } = await supabase
          .from('whatsapp_templates')
          .update({
            name: formData.name,
            type: formData.type,
            media_url: formData.mediaUrl || null,
            body_text: formData.bodyText,
            status: formData.status
          })
          .eq('id', selectedTemplate.id)

        if (error) throw error

        await loadWhatsappTemplates()
        setShowEditModal(false)
        resetForm()
      } catch (error) {
        console.error('Error updating WhatsApp template:', error)
        alert('Failed to update template. Please try again.')
      } finally {
        setLoading(false)
      }
    } else {
      let updatedTemplate: any = {
        ...selectedTemplate,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        thumbnail: formData.thumbnail,
        videoUrl: formData.videoUrl || null,
        redirectUrl: formData.redirectUrl || null,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        features: formData.features.split(',').map(feature => feature.trim()).filter(feature => feature),
        status: formData.status
      }

      const updatedTemplates = currentTemplates.map(template =>
        template.id === selectedTemplate.id ? updatedTemplate : template
      )
      setCurrentTemplates(updatedTemplates)
      setShowEditModal(false)
      resetForm()
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      if (activeTab === 'whatsapp-templates') {
        try {
          setLoading(true)
          const { error } = await supabase
            .from('whatsapp_templates')
            .delete()
            .eq('id', templateId)

          if (error) throw error

          await loadWhatsappTemplates()
        } catch (error) {
          console.error('Error deleting WhatsApp template:', error)
          alert('Failed to delete template. Please try again.')
        } finally {
          setLoading(false)
        }
      } else {
        const updatedTemplates = currentTemplates.filter(template => template.id !== templateId)
        setCurrentTemplates(updatedTemplates)
      }
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check file size (14 MB = 14 * 1024 * 1024 bytes)
    const maxSize = 14 * 1024 * 1024
    if (file.size > maxSize) {
      setFileError('File size must be less than 14 MB')
      return
    }

    setFileError('')
    setUploadingFile(true)

    try {
      // GHL folder details for WhatsApp Template Media
      const ghlFolderId = '9d74c5db-d17f-46c6-a1c0-e3c0d761a843'
      const ghlLocationId = '6903be8d79f86168153724f2'

      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${ghlFolderId}/${fileName}`

      const { error: uploadError, data } = await supabase.storage
        .from('media-files')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('media-files')
        .getPublicUrl(filePath)

      setFormData(prev => ({ ...prev, mediaUrl: publicUrl }))
    } catch (error: any) {
      setFileError(error.message || 'Failed to upload file')
    } finally {
      setUploadingFile(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      status: 'Draft',
      thumbnail: '',
      videoUrl: '',
      redirectUrl: '',
      tags: '',
      features: '',
      type: 'Text',
      mediaUrl: '',
      bodyText: ''
    })
    setSelectedTemplate(null)
    setFileError('')
  }

  const getCategoriesForTab = () => {
    switch (activeTab) {
      case 'websites': return ['SaaS', 'E-commerce', 'Portfolio', 'Business']
      case 'landing-pages': return ['Education', 'Lead Generation', 'Sales', 'Marketing']
      case 'n8n-workflows': return ['Email Marketing', 'Social Media', 'CRM', 'Automation']
      case 'whatsapp-templates': return ['Text', 'Video', 'Audio', 'Image', 'Document']
      default: return []
    }
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ))
  }

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'websites': return Globe
      case 'landing-pages': return Zap
      case 'n8n-workflows': return Workflow
      case 'whatsapp-templates': return MessageSquare
      default: return Globe
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Text': return FileText
      case 'Video': return FileVideo
      case 'Audio': return FileAudio
      case 'Image': return FileImage
      case 'Document': return File
      default: return FileText
    }
  }

  const tabs = [
    { id: 'websites', label: 'Websites', icon: Globe },
    { id: 'landing-pages', label: 'Landing Pages', icon: Zap },
    { id: 'n8n-workflows', label: 'n8n Workflows', icon: Workflow },
    { id: 'whatsapp-templates', label: 'WhatsApp Templates', icon: MessageSquare }
  ]

  return (
    <div className="ppt-slide p-6">
      <PageHeader 
        title="Template Library"
        subtitle="Create → Manage → Share Professional Templates"
        actions={[
          {
            label: 'Create Template',
            onClick: () => setShowCreateModal(true),
            variant: 'default',
            icon: Plus
          },
          {
            label: 'Import Template',
            onClick: () => {},
            variant: 'outline',
            icon: Upload
          },
          {
            label: 'Export All',
            onClick: () => {},
            variant: 'secondary',
            icon: Download
          }
        ]}
      />

      {/* KPI Cards */}
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
            title="Total Templates"
            value={totalTemplates}
            change={12}
            colorScheme="blue"
            icon={getTabIcon(activeTab)}
          />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
          <KPICard
            title="Published"
            value={publishedTemplates}
            change={8}
            colorScheme="green"
            icon={CheckCircle}
          />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
          <KPICard
            title="Total Downloads"
            value={totalDownloads}
            change={15}
            colorScheme="purple"
            icon={Download}
          />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
          <KPICard
            title="Avg Rating"
            value={`${avgRating.toFixed(1)}/5`}
            change={5}
            colorScheme="green"
            icon={Star}
          />
        </motion.div>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div 
        className="mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-wrap gap-2 bg-gray-100 p-2 rounded-lg">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
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

      {/* Filters and Controls */}
      <motion.div 
        className="mb-6 flex flex-wrap gap-4 items-center justify-between"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex gap-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 max-w-md"
            />
          </div>
          
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {[...new Set(currentTemplates.map(t => t.category))].map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="Published">Published</option>
            <option value="Draft">Draft</option>
            <option value="Under Review">Under Review</option>
            <option value="Archived">Archived</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

      {/* Templates Grid/List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}
      >
        {filteredTemplates.map((template, index) => (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
            whileHover={{ scale: viewMode === 'grid' ? 1.02 : 1 }}
            className={viewMode === 'grid' ? 'h-full' : ''}
          >
            {viewMode === 'grid' ? (
              <Card className="shadow-xl hover:shadow-2xl transition-all duration-300 h-full flex flex-col">
                {activeTab === 'whatsapp-templates' ? (
                  <div className="relative bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-t-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        {React.createElement(getTypeIcon(template.type), { className: 'w-6 h-6 text-green-600' })}
                        <Badge variant="outline" className="bg-white">{template.type}</Badge>
                      </div>
                      <Badge className={statusColors[template.status]}>{template.status}</Badge>
                    </div>
                    {template.mediaUrl && template.type === 'Image' && (
                      <img
                        src={template.mediaUrl}
                        alt={template.name}
                        className="w-full h-32 object-cover rounded-lg mb-4"
                      />
                    )}
                    {template.mediaUrl && template.type === 'Video' && (
                      <div className="w-full h-32 bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
                        <FileVideo className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                    {template.mediaUrl && template.type === 'Audio' && (
                      <div className="w-full h-32 bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
                        <FileAudio className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                    {template.mediaUrl && template.type === 'Document' && (
                      <div className="w-full h-32 bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
                        <File className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={template.thumbnail}
                      alt={template.name}
                      className="w-full h-48 object-cover rounded-t-lg"
                    />
                    <div className="absolute top-4 right-4">
                      <Badge className={statusColors[template.status]}>{template.status}</Badge>
                    </div>
                    <div className="absolute top-4 left-4">
                      <Badge variant="outline" className={categoryColors[template.category]}>
                        {template.category}
                      </Badge>
                    </div>
                    {template.videoUrl && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity duration-300">
                        <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm">
                          <Play className="w-4 h-4 mr-2" />
                          Play Video
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                
                <CardContent className="p-6 flex-1 flex flex-col">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-brand-text mb-2 line-clamp-2">
                      {template.name}
                    </h3>

                    {activeTab === 'whatsapp-templates' ? (
                      <>
                        <p className="text-gray-600 mb-4 line-clamp-3 whitespace-pre-wrap">
                          {template.bodyText}
                        </p>
                        {template.mediaUrl && (
                          <div className="text-sm text-gray-500 mb-2">
                            <span className="font-medium">Media:</span> Attached
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-gray-600 mb-4 line-clamp-2">
                          {template.description}
                        </p>

                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-1">
                            {renderStars(template.rating)}
                            <span className="text-sm text-gray-600 ml-2">
                              {template.rating} ({template.downloads} downloads)
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                          {template.tags.slice(0, 3).map((tag: string) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {template.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{template.tags.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </>
                    )}

                    <div className="text-sm text-gray-500 mb-4">
                      <div>Created by {template.createdBy}</div>
                      <div>{formatDate(template.createdAt)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 pt-4 border-t">
                    <Button size="sm" variant="default" className="flex-1" onClick={() => handleViewTemplate(template)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    {template.redirectUrl && (
                      <Button size="sm" variant="outline" onClick={() => window.open(template.redirectUrl, '_blank')}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleEditTemplate(template)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteTemplate(template.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <img
                      src={template.thumbnail}
                      alt={template.name}
                      className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-lg font-bold text-brand-text mb-1">{template.name}</h3>
                          <p className="text-gray-600 mb-2">{template.description}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={statusColors[template.status]}>{template.status}</Badge>
                          <Badge variant="outline" className={categoryColors[template.category]}>
                            {template.category}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-1">
                            {renderStars(template.rating)}
                            <span className="text-sm text-gray-600 ml-2">{template.rating}</span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {template.downloads} downloads
                          </div>
                          <div className="text-sm text-gray-500">
                            by {template.createdBy}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="outline" onClick={() => handleViewTemplate(template)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                          {template.redirectUrl && (
                            <Button size="sm" variant="outline" onClick={() => window.open(template.redirectUrl, '_blank')}>
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="outline">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* View Template Modal */}
      {showViewModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-brand-text">
                {activeTab === 'whatsapp-templates' ? 'WhatsApp Template Details' : 'Template Details'}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowViewModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {activeTab === 'whatsapp-templates' ? (
              <div className="space-y-6">
                {/* WhatsApp Template View */}
                <div className="flex items-center space-x-3">
                  <h3 className="text-2xl font-bold text-brand-text">{selectedTemplate.name}</h3>
                  <Badge className={statusColors[selectedTemplate.status]}>{selectedTemplate.status}</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Type:</span>
                    <div className="flex items-center space-x-2 mt-1">
                      {React.createElement(getTypeIcon(selectedTemplate.type), { className: 'w-5 h-5 text-green-600' })}
                      <span className="font-medium">{selectedTemplate.type}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-sm font-medium text-gray-700">Created by:</span>
                    <p className="font-medium mt-1">{selectedTemplate.createdBy}</p>
                  </div>

                  <div>
                    <span className="text-sm font-medium text-gray-700">Created at:</span>
                    <p className="font-medium mt-1">{formatDate(selectedTemplate.createdAt)}</p>
                  </div>

                  {selectedTemplate.mediaUrl && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Media:</span>
                      <p className="font-medium mt-1 text-green-600">Attached</p>
                    </div>
                  )}
                </div>

                {selectedTemplate.mediaUrl && (
                  <div>
                    <span className="text-sm font-medium text-gray-700 mb-2 block">Media Preview:</span>
                    {selectedTemplate.type === 'Image' ? (
                      <img
                        src={selectedTemplate.mediaUrl}
                        alt={selectedTemplate.name}
                        className="w-full max-h-96 object-contain rounded-lg border"
                      />
                    ) : (
                      <div className="bg-gray-100 rounded-lg p-8 flex items-center justify-center">
                        {React.createElement(getTypeIcon(selectedTemplate.type), { className: 'w-16 h-16 text-gray-400' })}
                      </div>
                    )}
                    <a
                      href={selectedTemplate.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline mt-2 block"
                    >
                      View Media File
                    </a>
                  </div>
                )}

                <div>
                  <span className="text-sm font-medium text-gray-700 mb-2 block">Body Text:</span>
                  <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap">
                    {selectedTemplate.bodyText}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Media */}
                <div>
                  <img
                    src={selectedTemplate.thumbnail}
                    alt={selectedTemplate.name}
                    className="w-full h-64 object-cover rounded-lg mb-4"
                  />

                  {selectedTemplate.videoUrl && (
                    <div className="mb-4">
                      <Button className="w-full" onClick={() => window.open(selectedTemplate.videoUrl, '_blank')}>
                        <Play className="w-4 h-4 mr-2" />
                        Watch Demo Video
                      </Button>
                    </div>
                  )}

                  {selectedTemplate.redirectUrl && (
                    <div className="mb-4">
                      <Button variant="outline" className="w-full" onClick={() => window.open(selectedTemplate.redirectUrl, '_blank')}>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Visit Live Demo
                      </Button>
                    </div>
                  )}
                </div>

                {/* Right Column - Details */}
                <div>
                <div className="flex items-center space-x-3 mb-4">
                  <h3 className="text-2xl font-bold text-brand-text">{selectedTemplate.name}</h3>
                  <Badge className={statusColors[selectedTemplate.status]}>{selectedTemplate.status}</Badge>
                </div>
                
                <p className="text-gray-600 mb-4">{selectedTemplate.description}</p>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Category:</span>
                    <Badge variant="outline" className={categoryColors[selectedTemplate.category]}>
                      {selectedTemplate.category}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Rating:</span>
                    <div className="flex items-center space-x-1">
                      {renderStars(selectedTemplate.rating)}
                      <span className="text-sm">{selectedTemplate.rating}/5</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Downloads:</span>
                    <p className="font-medium">{selectedTemplate.downloads}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Created:</span>
                    <p className="font-medium">{formatDate(selectedTemplate.createdAt)}</p>
                  </div>
                </div>
                
                <div className="mb-4">
                  <span className="text-sm font-medium text-gray-700">Created by:</span>
                  <p className="font-medium">{selectedTemplate.createdBy}</p>
                </div>
                
                <div className="mb-4">
                  <span className="text-sm font-medium text-gray-700">Tags:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedTemplate.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="mb-6">
                  <span className="text-sm font-medium text-gray-700">Features:</span>
                  <ul className="mt-2 space-y-1">
                    {selectedTemplate.features.map((feature: string, index: number) => (
                      <li key={index} className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Button>
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                  <Button variant="outline">
                    <Copy className="w-4 h-4 mr-2" />
                    Duplicate
                  </Button>
                  <Button variant="outline" onClick={() => { setShowViewModal(false); handleEditTemplate(selectedTemplate); }}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-brand-text">Create New Template</h2>
              <Button variant="ghost" size="sm" onClick={() => { setShowCreateModal(false); resetForm(); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              {activeTab === 'whatsapp-templates' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Template Name *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter template name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
                    <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Text">Text</SelectItem>
                        <SelectItem value="Video">Video</SelectItem>
                        <SelectItem value="Audio">Audio</SelectItem>
                        <SelectItem value="Image">Image</SelectItem>
                        <SelectItem value="Document">Document</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.type !== 'Text' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Media File (Max 14 MB)</label>
                      <div className="space-y-2">
                        <Input
                          type="file"
                          onChange={handleFileUpload}
                          accept={formData.type === 'Video' ? 'video/*' : formData.type === 'Audio' ? 'audio/*' : formData.type === 'Image' ? 'image/*' : '*'}
                          disabled={uploadingFile}
                        />
                        {uploadingFile && <p className="text-sm text-blue-600">Uploading...</p>}
                        {fileError && <p className="text-sm text-red-600">{fileError}</p>}
                        {formData.mediaUrl && (
                          <p className="text-sm text-green-600">File uploaded successfully!</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Body Text *</label>
                    <Textarea
                      value={formData.bodyText}
                      onChange={(e) => setFormData(prev => ({ ...prev, bodyText: e.target.value }))}
                      placeholder="Enter message body text"
                      rows={5}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Published">Published</SelectItem>
                        <SelectItem value="Under Review">Under Review</SelectItem>
                        <SelectItem value="Archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Template Name *</label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter template name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                      <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {getCategoriesForTab().map(category => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter template description"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Thumbnail Image URL *</label>
                    <Input
                      value={formData.thumbnail}
                      onChange={(e) => setFormData(prev => ({ ...prev, thumbnail: e.target.value }))}
                      placeholder="Enter image URL"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Video URL (Optional)</label>
                      <Input
                        value={formData.videoUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, videoUrl: e.target.value }))}
                        placeholder="Enter video URL"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Redirect URL (Optional)</label>
                      <Input
                        value={formData.redirectUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, redirectUrl: e.target.value }))}
                        placeholder="Enter redirect URL"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Published">Published</SelectItem>
                        <SelectItem value="Under Review">Under Review</SelectItem>
                        <SelectItem value="Archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma-separated)</label>
                    <Input
                      value={formData.tags}
                      onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                      placeholder="e.g., AI, Automation, Customer Service"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Features (comma-separated)</label>
                    <Textarea
                      value={formData.features}
                      onChange={(e) => setFormData(prev => ({ ...prev, features: e.target.value }))}
                      placeholder="e.g., 24/7 Support, Multi-language, CRM Integration"
                      rows={2}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center space-x-3 mt-6">
              <Button
                onClick={handleCreateTemplate}
                disabled={activeTab === 'whatsapp-templates' ? (!formData.name || !formData.bodyText) : (!formData.name || !formData.description || !formData.category || !formData.thumbnail)}
              >
                <Save className="w-4 h-4 mr-2" />
                Create Template
              </Button>
              <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {showEditModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-brand-text">Edit Template</h2>
              <Button variant="ghost" size="sm" onClick={() => { setShowEditModal(false); resetForm(); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              {activeTab === 'whatsapp-templates' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Template Name *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter template name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
                    <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Text">Text</SelectItem>
                        <SelectItem value="Video">Video</SelectItem>
                        <SelectItem value="Audio">Audio</SelectItem>
                        <SelectItem value="Image">Image</SelectItem>
                        <SelectItem value="Document">Document</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.type !== 'Text' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Media File (Max 14 MB)</label>
                      <div className="space-y-2">
                        <Input
                          type="file"
                          onChange={handleFileUpload}
                          accept={formData.type === 'Video' ? 'video/*' : formData.type === 'Audio' ? 'audio/*' : formData.type === 'Image' ? 'image/*' : '*'}
                          disabled={uploadingFile}
                        />
                        {uploadingFile && <p className="text-sm text-blue-600">Uploading...</p>}
                        {fileError && <p className="text-sm text-red-600">{fileError}</p>}
                        {formData.mediaUrl && (
                          <p className="text-sm text-green-600">File uploaded successfully!</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Body Text *</label>
                    <Textarea
                      value={formData.bodyText}
                      onChange={(e) => setFormData(prev => ({ ...prev, bodyText: e.target.value }))}
                      placeholder="Enter message body text"
                      rows={5}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Published">Published</SelectItem>
                        <SelectItem value="Under Review">Under Review</SelectItem>
                        <SelectItem value="Archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Template Name *</label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter template name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                      <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {getCategoriesForTab().map(category => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter template description"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Thumbnail Image URL *</label>
                    <Input
                      value={formData.thumbnail}
                      onChange={(e) => setFormData(prev => ({ ...prev, thumbnail: e.target.value }))}
                      placeholder="Enter image URL"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Video URL (Optional)</label>
                      <Input
                        value={formData.videoUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, videoUrl: e.target.value }))}
                        placeholder="Enter video URL"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Redirect URL (Optional)</label>
                      <Input
                        value={formData.redirectUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, redirectUrl: e.target.value }))}
                        placeholder="Enter redirect URL"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Published">Published</SelectItem>
                        <SelectItem value="Under Review">Under Review</SelectItem>
                        <SelectItem value="Archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma-separated)</label>
                    <Input
                      value={formData.tags}
                      onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                      placeholder="e.g., AI, Automation, Customer Service"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Features (comma-separated)</label>
                    <Textarea
                      value={formData.features}
                      onChange={(e) => setFormData(prev => ({ ...prev, features: e.target.value }))}
                      placeholder="e.g., 24/7 Support, Multi-language, CRM Integration"
                      rows={2}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center space-x-3 mt-6">
              <Button
                onClick={handleUpdateTemplate}
                disabled={activeTab === 'whatsapp-templates' ? (!formData.name || !formData.bodyText) : (!formData.name || !formData.description || !formData.category || !formData.thumbnail)}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => { setShowEditModal(false); resetForm(); }}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}