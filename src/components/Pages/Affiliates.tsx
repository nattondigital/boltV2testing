import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserPlus, Eye, Edit, Trash2, Copy, DollarSign, TrendingUp, Users, Link as LinkIcon, Save, Mail, Phone, MapPin, Building, ArrowLeft, MoreVertical, Plus } from 'lucide-react'
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
import { formatCurrency, getPhoneValidationError, getEmailValidationError } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { ValidatedInput } from '@/components/ui/validated-input'
import { useAuth } from '@/contexts/AuthContext'
import { PermissionGuard } from '@/components/Common/PermissionGuard'

interface Affiliate {
  id?: string
  affiliateId: string
  name: string
  email: string
  phone: string
  commissionPct: number
  uniqueLink: string
  referrals: number
  earningsPaid: number
  earningsPending: number
  status: string
  company?: string
  address?: string
  notes?: string
  joinedOn: string
  lastActivity: string
}

type ViewState = 'list' | 'add' | 'edit' | 'view'

const statusColors: Record<string, string> = {
  'Active': 'bg-green-100 text-green-800',
  'Inactive': 'bg-gray-100 text-gray-800',
  'Suspended': 'bg-red-100 text-red-800'
}

export function Affiliates() {
  const { canCreate, canUpdate, canDelete } = useAuth()
  const [viewState, setViewState] = useState<ViewState>('list')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    commissionPct: 15,
    status: 'Active',
    address: '',
    company: '',
    notes: ''
  })

  useEffect(() => {
    fetchAffiliates()
  }, [])

  const fetchAffiliates = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const formattedData = data?.map((affiliate: any) => ({
        id: affiliate.id,
        affiliateId: affiliate.affiliate_id,
        name: affiliate.name,
        email: affiliate.email,
        phone: affiliate.phone || '',
        commissionPct: affiliate.commission_pct,
        uniqueLink: affiliate.unique_link,
        referrals: affiliate.referrals,
        earningsPaid: Number(affiliate.earnings_paid),
        earningsPending: Number(affiliate.earnings_pending),
        status: affiliate.status,
        company: affiliate.company || '',
        address: affiliate.address || '',
        notes: affiliate.notes || '',
        joinedOn: affiliate.joined_on,
        lastActivity: affiliate.last_activity || 'Never'
      })) || []

      setAffiliates(formattedData)
    } catch (error) {
      console.error('Error fetching affiliates:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAffiliates = affiliates.filter(affiliate => {
    const matchesSearch = affiliate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         affiliate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         affiliate.phone.includes(searchTerm)
    const matchesStatus = !statusFilter || affiliate.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleCreateAffiliate = async () => {
    const phoneError = getPhoneValidationError(formData.phone)
    const emailError = getEmailValidationError(formData.email, true)

    if (phoneError || emailError) {
      alert(phoneError || emailError || 'Please fix validation errors before submitting')
      return
    }

    try {
      const affiliateCount = affiliates.length + 1
      const affiliateId = `A${String(affiliateCount).padStart(3, '0')}`
      const uniqueLink = `https://aiacoach.com/ref/${formData.name.toLowerCase().replace(/\s+/g, '-')}`

      const { error } = await supabase
        .from('affiliates')
        .insert({
          affiliate_id: affiliateId,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          commission_pct: formData.commissionPct,
          unique_link: uniqueLink,
          referrals: 0,
          earnings_paid: 0,
          earnings_pending: 0,
          status: formData.status,
          company: formData.company || null,
          address: formData.address || null,
          notes: formData.notes || null,
          joined_on: new Date().toISOString().split('T')[0]
        })

      if (error) throw error

      await fetchAffiliates()
      handleBackToList()
    } catch (error) {
      console.error('Error creating affiliate:', error)
      alert('Failed to create affiliate. Please try again.')
    }
  }

  const handleEditAffiliate = async () => {
    if (!selectedAffiliate?.id) return

    const phoneError = getPhoneValidationError(formData.phone)
    const emailError = getEmailValidationError(formData.email, true)

    if (phoneError || emailError) {
      alert(phoneError || emailError || 'Please fix validation errors before submitting')
      return
    }

    try {
      const uniqueLink = `https://aiacoach.com/ref/${formData.name.toLowerCase().replace(/\s+/g, '-')}`

      const { error } = await supabase
        .from('affiliates')
        .update({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          commission_pct: formData.commissionPct,
          unique_link: uniqueLink,
          status: formData.status,
          company: formData.company || null,
          address: formData.address || null,
          notes: formData.notes || null
        })
        .eq('id', selectedAffiliate.id)

      if (error) throw error

      await fetchAffiliates()
      handleBackToList()
    } catch (error) {
      console.error('Error updating affiliate:', error)
      alert('Failed to update affiliate. Please try again.')
    }
  }

  const handleDeleteAffiliate = async (affiliate: Affiliate) => {
    if (!affiliate.id || !confirm('Are you sure you want to delete this affiliate?')) return

    try {
      const { error } = await supabase
        .from('affiliates')
        .delete()
        .eq('id', affiliate.id)

      if (error) throw error

      await fetchAffiliates()
    } catch (error) {
      console.error('Error deleting affiliate:', error)
      alert('Failed to delete affiliate. Please try again.')
    }
  }

  const handleViewAffiliate = (affiliate: Affiliate) => {
    setSelectedAffiliate(affiliate)
    setViewState('view')
  }

  const handleEditClick = (affiliate: Affiliate) => {
    setSelectedAffiliate(affiliate)
    setFormData({
      name: affiliate.name,
      email: affiliate.email,
      phone: affiliate.phone,
      commissionPct: affiliate.commissionPct,
      status: affiliate.status,
      address: affiliate.address || '',
      company: affiliate.company || '',
      notes: affiliate.notes || ''
    })
    setViewState('edit')
  }

  const handleAddClick = () => {
    resetForm()
    setViewState('add')
  }

  const handleBackToList = () => {
    resetForm()
    setViewState('list')
  }

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      commissionPct: 15,
      status: 'Active',
      address: '',
      company: '',
      notes: ''
    })
    setSelectedAffiliate(null)
  }

  const totalReferrals = affiliates.reduce((sum, affiliate) => sum + affiliate.referrals, 0)
  const totalEarningsPaid = affiliates.reduce((sum, affiliate) => sum + affiliate.earningsPaid, 0)
  const totalEarningsPending = affiliates.reduce((sum, affiliate) => sum + affiliate.earningsPending, 0)
  const activeAffiliates = affiliates.filter(a => a.status === 'Active').length

  const renderListView = () => (
    <>
      <PageHeader
        title="Affiliate Management"
        subtitle="Referrals → Earnings → Payouts"
        actions={[
          ...(canCreate('affiliates') ? [{
            label: 'Add Affiliate',
            onClick: handleAddClick,
            variant: 'default' as const,
            icon: UserPlus
          }] : []),
          ...(canUpdate('affiliates') ? [{
            label: 'Bulk Payout',
            onClick: () => {},
            variant: 'secondary' as const,
            icon: DollarSign
          }] : [])
        ]}
      />

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
            title="Active Affiliates"
            value={activeAffiliates}
            change={12}
            icon={Users}
            category="success"
          />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
          <KPICard
            title="Total Referrals"
            value={totalReferrals}
            change={8}
            icon={TrendingUp}
            category="secondary"
          />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
          <KPICard
            title="Earnings Paid"
            value={formatCurrency(totalEarningsPaid)}
            change={15}
            icon={DollarSign}
            category="success"
          />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
          <KPICard
            title="Pending Payouts"
            value={formatCurrency(totalEarningsPending)}
            change={-5}
            icon={DollarSign}
            category="warning"
          />
        </motion.div>
      </motion.div>

      <motion.div
        className="mb-6 flex gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Input
          placeholder="Search affiliates by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <select
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Suspended">Suspended</option>
        </select>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Affiliates Database</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Contact</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Commission</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Tracking Link</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Referrals</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Earnings</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAffiliates.map((affiliate, index) => (
                    <motion.tr
                      key={affiliate.affiliateId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 font-mono text-sm">{affiliate.affiliateId}</td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{affiliate.name}</div>
                          <div className="text-sm text-gray-500">{affiliate.email}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-sm">{affiliate.phone}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">{affiliate.commissionPct}%</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600 truncate max-w-[200px]">
                            {affiliate.uniqueLink}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(affiliate.uniqueLink)}
                            className="text-brand-primary hover:text-brand-primary/80"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{affiliate.referrals}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="text-sm">
                            <span className="text-green-600 font-medium">
                              Paid: {formatCurrency(affiliate.earningsPaid)}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-orange-600 font-medium">
                              Pending: {formatCurrency(affiliate.earningsPending)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={statusColors[affiliate.status]}>{affiliate.status}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {(canUpdate('affiliates') || canDelete('affiliates')) ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewAffiliate(affiliate)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {canUpdate('affiliates') && (
                                <DropdownMenuItem onClick={() => handleEditClick(affiliate)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit Affiliate
                                </DropdownMenuItem>
                              )}
                              {canUpdate('affiliates') && (
                                <DropdownMenuItem>
                                  <DollarSign className="w-4 h-4 mr-2" />
                                  Trigger Payout
                                </DropdownMenuItem>
                              )}
                              {canDelete('affiliates') && (
                                <DropdownMenuItem
                                  onClick={() => handleDeleteAffiliate(affiliate)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Remove Affiliate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => handleViewAffiliate(affiliate)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mb-8"
      >
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-brand-primary" />
              <span>Top Performing Affiliates</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {affiliates
                .sort((a, b) => (b.earningsPaid + b.earningsPending) - (a.earningsPaid + a.earningsPending))
                .slice(0, 5)
                .map((affiliate, index) => {
                  const totalEarnings = affiliate.earningsPaid + affiliate.earningsPending
                  const maxEarnings = Math.max(...affiliates.map(a => a.earningsPaid + a.earningsPending))
                  const percentage = (totalEarnings / maxEarnings) * 100

                  return (
                    <div key={affiliate.affiliateId} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-brand-primary">#{index + 1}</span>
                          </div>
                          <div>
                            <span className="font-medium">{affiliate.name}</span>
                            <div className="text-sm text-gray-500">{affiliate.referrals} referrals</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(totalEarnings)}</div>
                          <div className="text-sm text-gray-500">{affiliate.commissionPct}% commission</div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <motion.div
                          className="h-2 rounded-full bg-gradient-to-r from-brand-primary to-brand-accent"
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ delay: 0.6 + index * 0.1, duration: 0.5 }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </>
  )

  const renderFormView = (mode: 'add' | 'edit') => (
    <>
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={handleBackToList} className="mr-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to List
        </Button>
      </div>

      <Card className="shadow-xl max-w-3xl">
        <CardHeader>
          <CardTitle>{mode === 'add' ? 'Add New Affiliate' : 'Edit Affiliate'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                <ValidatedInput
                  validationType="email"
                  isRequired={true}
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Commission % *</label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={formData.commissionPct}
                  onChange={(e) => setFormData(prev => ({ ...prev, commissionPct: parseInt(e.target.value) || 15 }))}
                  placeholder="Commission percentage"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Enter any additional notes about this affiliate"
                rows={4}
              />
            </div>

            <div className="flex items-center space-x-3 pt-4 border-t">
              <Button
                onClick={mode === 'add' ? handleCreateAffiliate : handleEditAffiliate}
                disabled={!formData.name || !formData.email || !formData.phone}
              >
                <Save className="w-4 h-4 mr-2" />
                {mode === 'add' ? 'Add Affiliate' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={handleBackToList}>
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )

  const renderViewState = () => {
    if (!selectedAffiliate) return null

    return (
      <>
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={handleBackToList} className="mr-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to List
          </Button>
        </div>

        <Card className="shadow-xl max-w-4xl">
          <CardHeader>
            <CardTitle>Affiliate Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-brand-primary text-white text-xl font-bold">
                    {selectedAffiliate.name.split(' ').map((n: string) => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-brand-text mb-2">{selectedAffiliate.name}</h3>
                  <div className="flex items-center space-x-3 mb-2">
                    <Badge className={statusColors[selectedAffiliate.status]}>{selectedAffiliate.status}</Badge>
                    <Badge variant="outline">{selectedAffiliate.commissionPct}% Commission</Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    Affiliate ID: {selectedAffiliate.affiliateId} • Joined: {selectedAffiliate.joinedOn}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-brand-text mb-3">Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-sm text-gray-600">Email</div>
                      <div className="font-medium">{selectedAffiliate.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-sm text-gray-600">Phone</div>
                      <div className="font-medium">{selectedAffiliate.phone}</div>
                    </div>
                  </div>
                  {selectedAffiliate.company && (
                    <div className="flex items-center space-x-3">
                      <Building className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="text-sm text-gray-600">Company</div>
                        <div className="font-medium">{selectedAffiliate.company}</div>
                      </div>
                    </div>
                  )}
                  {selectedAffiliate.address && (
                    <div className="flex items-center space-x-3">
                      <MapPin className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="text-sm text-gray-600">Address</div>
                        <div className="font-medium">{selectedAffiliate.address}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-brand-text mb-3">Performance Metrics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{selectedAffiliate.referrals}</div>
                    <div className="text-sm text-blue-600">Total Referrals</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(selectedAffiliate.earningsPaid)}</div>
                    <div className="text-sm text-green-600">Earnings Paid</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{formatCurrency(selectedAffiliate.earningsPending)}</div>
                    <div className="text-sm text-orange-600">Pending Payout</div>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-lg">
                    <div className="text-2xl font-bold text-slate-600">{selectedAffiliate.commissionPct}%</div>
                    <div className="text-sm text-slate-600">Commission Rate</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-brand-text mb-3">Affiliate Link</h4>
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                  <LinkIcon className="w-5 h-5 text-gray-400" />
                  <Input
                    value={selectedAffiliate.uniqueLink}
                    readOnly
                    className="flex-1 bg-transparent border-none"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(selectedAffiliate.uniqueLink)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-brand-text mb-3">Activity</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Last Activity</div>
                    <div className="font-medium">{selectedAffiliate.lastActivity}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Join Date</div>
                    <div className="font-medium">{selectedAffiliate.joinedOn}</div>
                  </div>
                </div>
              </div>

              {selectedAffiliate.notes && (
                <div>
                  <h4 className="text-lg font-semibold text-brand-text mb-3">Notes</h4>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-700">{selectedAffiliate.notes}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3 mt-6 pt-6 border-t">
              <Button onClick={() => handleEditClick(selectedAffiliate)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Affiliate
              </Button>
              <Button variant="outline" onClick={handleBackToList}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      {/* Desktop View */}
      <div className="hidden md:block ppt-slide p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={viewState}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {viewState === 'list' && renderListView()}
            {viewState === 'add' && renderFormView('add')}
            {viewState === 'edit' && renderFormView('edit')}
            {viewState === 'view' && renderViewState()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Mobile View */}
      <div className="md:hidden min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50">
        <AnimatePresence mode="wait">
          {viewState === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Mobile Header */}
              <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-6 shadow-lg">
                <h1 className="text-2xl font-bold mb-1">Affiliates</h1>
                <p className="text-cyan-100 text-sm">{activeAffiliates} active • {totalReferrals} referrals</p>
              </div>

              {/* Stats Cards */}
              <div className="px-4 -mt-4 mb-4">
                <div className="grid grid-cols-2 gap-3">
                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="bg-white rounded-2xl p-4 shadow-lg border border-cyan-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-cyan-100 p-2 rounded-xl">
                        <Users className="w-5 h-5 text-cyan-600" />
                      </div>
                      <span className="text-2xl font-bold text-cyan-600">{activeAffiliates}</span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">Active</p>
                  </motion.div>

                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="bg-white rounded-2xl p-4 shadow-lg border border-blue-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-blue-100 p-2 rounded-xl">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className="text-2xl font-bold text-blue-600">{totalReferrals}</span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">Referrals</p>
                  </motion.div>

                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="bg-white rounded-2xl p-4 shadow-lg border border-green-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-green-100 p-2 rounded-xl">
                        <DollarSign className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="text-xl font-bold text-green-600">{formatCurrency(totalEarningsPaid)}</span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">Paid</p>
                  </motion.div>

                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="bg-white rounded-2xl p-4 shadow-lg border border-orange-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-orange-100 p-2 rounded-xl">
                        <DollarSign className="w-5 h-5 text-orange-600" />
                      </div>
                      <span className="text-xl font-bold text-orange-600">{formatCurrency(totalEarningsPending)}</span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">Pending</p>
                  </motion.div>
                </div>
              </div>

              {/* Add Affiliate Button */}
              <div className="px-4 mb-4">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddClick}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl py-4 px-6 shadow-lg flex items-center justify-center gap-3 font-semibold"
                >
                  <UserPlus className="w-5 h-5" />
                  Add New Affiliate
                </motion.button>
              </div>

              {/* Affiliates List */}
              <div className="px-4 pb-20">
                <h2 className="text-lg font-bold text-gray-800 mb-3">All Affiliates</h2>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
                  </div>
                ) : filteredAffiliates.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No affiliates yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredAffiliates.map((affiliate) => (
                      <motion.div
                        key={affiliate.affiliateId}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleViewAffiliate(affiliate)}
                        className="bg-white rounded-2xl p-4 shadow-md active:shadow-lg transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback className="bg-gradient-to-br from-cyan-600 to-blue-600 text-white text-lg font-bold">
                                {affiliate.name.split(' ').map((n: string) => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-gray-800">{affiliate.name}</p>
                              <p className="text-xs text-gray-500">{affiliate.email}</p>
                            </div>
                          </div>
                          <MoreVertical className="w-5 h-5 text-gray-400" />
                        </div>

                        <div className="flex items-center justify-between mb-2">
                          <div className="flex gap-2">
                            <Badge className={statusColors[affiliate.status]}>{affiliate.status}</Badge>
                            <Badge variant="outline">{affiliate.commissionPct}%</Badge>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">{affiliate.referrals} referrals</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                          <div className="text-center">
                            <p className="text-sm font-semibold text-green-600">{formatCurrency(affiliate.earningsPaid)}</p>
                            <p className="text-xs text-gray-500">Paid</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-orange-600">{formatCurrency(affiliate.earningsPending)}</p>
                            <p className="text-xs text-gray-500">Pending</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {viewState === 'view' && selectedAffiliate && (
            <motion.div
              key="view"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="md:hidden fixed inset-0 bg-white z-[60] overflow-y-auto"
            >
              <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-6 sticky top-0 z-10">
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={handleBackToList}>
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <div className="flex-1">
                    <h1 className="text-xl font-bold">Affiliate Details</h1>
                  </div>
                  {(canUpdate('affiliates') || canDelete('affiliates')) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-white hover:bg-white/20">
                          <MoreVertical className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canUpdate('affiliates') && (
                          <DropdownMenuItem onClick={() => handleEditClick(selectedAffiliate)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Affiliate
                          </DropdownMenuItem>
                        )}
                        {canUpdate('affiliates') && (
                          <DropdownMenuItem>
                            <DollarSign className="w-4 h-4 mr-2" />
                            Trigger Payout
                          </DropdownMenuItem>
                        )}
                        {canDelete('affiliates') && (
                          <DropdownMenuItem
                            onClick={() => handleDeleteAffiliate(selectedAffiliate)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Profile Section */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-4 border-white/30">
                    <AvatarFallback className="bg-white text-cyan-600 text-2xl font-bold">
                      {selectedAffiliate.name.split(' ').map((n: string) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold">{selectedAffiliate.name}</h2>
                    <p className="text-cyan-100 text-sm">{selectedAffiliate.affiliateId}</p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Badge className={`${statusColors[selectedAffiliate.status]} border-0`}>
                    {selectedAffiliate.status}
                  </Badge>
                  <Badge variant="outline" className="bg-white/20 text-white border-white/40">
                    {selectedAffiliate.commissionPct}% Commission
                  </Badge>
                </div>
              </div>

              <div className="p-4 space-y-4 pb-20">
                {/* Performance Metrics */}
                <div className="bg-white rounded-2xl p-4 shadow-md">
                  <h3 className="font-semibold text-gray-800 mb-3">Performance</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-blue-50 rounded-xl">
                      <div className="text-2xl font-bold text-blue-600">{selectedAffiliate.referrals}</div>
                      <div className="text-xs text-blue-600">Referrals</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-xl">
                      <div className="text-lg font-bold text-green-600">{formatCurrency(selectedAffiliate.earningsPaid)}</div>
                      <div className="text-xs text-green-600">Paid</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-xl">
                      <div className="text-lg font-bold text-orange-600">{formatCurrency(selectedAffiliate.earningsPending)}</div>
                      <div className="text-xs text-orange-600">Pending</div>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-xl">
                      <div className="text-2xl font-bold text-slate-600">{selectedAffiliate.commissionPct}%</div>
                      <div className="text-xs text-slate-600">Commission</div>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-white rounded-2xl p-4 shadow-md">
                  <h3 className="font-semibold text-gray-800 mb-3">Contact</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-cyan-100 p-2 rounded-lg">
                        <Mail className="w-4 h-4 text-cyan-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="text-sm font-medium text-gray-800">{selectedAffiliate.email}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="bg-cyan-100 p-2 rounded-lg">
                        <Phone className="w-4 h-4 text-cyan-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="text-sm font-medium text-gray-800">{selectedAffiliate.phone}</p>
                      </div>
                    </div>
                    {selectedAffiliate.company && (
                      <div className="flex items-start gap-3">
                        <div className="bg-cyan-100 p-2 rounded-lg">
                          <Building className="w-4 h-4 text-cyan-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Company</p>
                          <p className="text-sm font-medium text-gray-800">{selectedAffiliate.company}</p>
                        </div>
                      </div>
                    )}
                    {selectedAffiliate.address && (
                      <div className="flex items-start gap-3">
                        <div className="bg-cyan-100 p-2 rounded-lg">
                          <MapPin className="w-4 h-4 text-cyan-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Address</p>
                          <p className="text-sm font-medium text-gray-800">{selectedAffiliate.address}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Affiliate Link */}
                <div className="bg-white rounded-2xl p-4 shadow-md">
                  <h3 className="font-semibold text-gray-800 mb-3">Tracking Link</h3>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                    <LinkIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <p className="text-xs text-gray-600 flex-1 truncate">{selectedAffiliate.uniqueLink}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(selectedAffiliate.uniqueLink)}
                      className="flex-shrink-0"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Activity */}
                <div className="bg-white rounded-2xl p-4 shadow-md">
                  <h3 className="font-semibold text-gray-800 mb-3">Activity</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between py-2">
                      <span className="text-sm text-gray-500">Join Date</span>
                      <span className="text-sm font-medium text-gray-800">{selectedAffiliate.joinedOn}</span>
                    </div>
                    <div className="flex justify-between py-2 border-t border-gray-100">
                      <span className="text-sm text-gray-500">Last Activity</span>
                      <span className="text-sm font-medium text-gray-800">{selectedAffiliate.lastActivity}</span>
                    </div>
                  </div>
                </div>

                {selectedAffiliate.notes && (
                  <div className="bg-white rounded-2xl p-4 shadow-md">
                    <h3 className="font-semibold text-gray-800 mb-3">Notes</h3>
                    <p className="text-sm text-gray-600">{selectedAffiliate.notes}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {(viewState === 'add' || viewState === 'edit') && (
            <motion.div
              key="form"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="md:hidden fixed inset-0 bg-white z-[60] overflow-y-auto"
            >
              <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-6 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <button onClick={handleBackToList}>
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <h1 className="text-xl font-bold">
                    {viewState === 'add' ? 'New Affiliate' : 'Edit Affiliate'}
                  </h1>
                </div>
              </div>

              <div className="p-4 space-y-4 pb-20">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter full name"
                      className="rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                    <ValidatedInput
                      validationType="email"
                      isRequired={true}
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Enter email address"
                      className="rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                    <ValidatedInput
                      validationType="phone"
                      isRequired={true}
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Enter phone number"
                      className="rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                    <Input
                      value={formData.company}
                      onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                      placeholder="Enter company name"
                      className="rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Enter address"
                      className="rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Commission % *</label>
                    <Input
                      type="number"
                      min="1"
                      max="50"
                      value={formData.commissionPct}
                      onChange={(e) => setFormData(prev => ({ ...prev, commissionPct: parseInt(e.target.value) || 15 }))}
                      placeholder="Commission percentage"
                      className="rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Enter any additional notes"
                      rows={4}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="sticky bottom-0 bg-white pt-4 pb-4 -mx-4 px-4 border-t border-gray-200">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={viewState === 'add' ? handleCreateAffiliate : handleEditAffiliate}
                    disabled={!formData.name || !formData.email || !formData.phone}
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl py-4 px-6 shadow-lg flex items-center justify-center gap-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-5 h-5" />
                    {viewState === 'add' ? 'Add Affiliate' : 'Save Changes'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
