import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Eye, Edit, Trash2, Calendar, CheckCircle, XCircle, Clock, User, Home, Sun, X, Save, MoreVertical, ChevronRight, ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { KPICard } from '@/components/Common/KPICard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { format } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'
import { PermissionGuard } from '@/components/Common/PermissionGuard'

const requestTypeColors: Record<string, string> = {
  'Leave': 'bg-orange-100 text-orange-800',
  'Work From Home': 'bg-blue-100 text-blue-800',
  'Half Day': 'bg-green-100 text-green-800'
}

const statusColors: Record<string, string> = {
  'Pending': 'bg-yellow-100 text-yellow-800',
  'Approved': 'bg-green-100 text-green-800',
  'Rejected': 'bg-red-100 text-red-800'
}

interface LeaveRequest {
  id: string
  request_id: string
  admin_user_id: string
  request_type: string
  leave_category: string
  start_date: string
  end_date: string
  total_days: number
  reason: string
  status: string
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
  admin_users: {
    full_name: string
    email: string
  }
  approver?: {
    full_name: string
  }
}

export function Leave() {
  const { userProfile, canCreate, canUpdate, canDelete } = useAuth()
  const [view, setView] = useState<'list' | 'add' | 'edit' | 'view'>('list')
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [formData, setFormData] = useState({
    admin_user_id: '',
    request_type: '',
    leave_category: 'Casual',
    start_date: '',
    end_date: '',
    reason: '',
    notes: ''
  })

  useEffect(() => {
    fetchLeaveRequests()
    fetchTeamMembers()
  }, [])

  const fetchLeaveRequests = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          admin_users!leave_requests_admin_user_id_fkey (
            full_name,
            email
          ),
          approver:admin_users!leave_requests_approved_by_fkey (
            full_name
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setLeaveRequests(data || [])
    } catch (error) {
      console.error('Failed to fetch leave requests:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, full_name, email')
        .order('full_name')

      if (error) throw error
      setTeamMembers(data || [])
    } catch (error) {
      console.error('Failed to fetch team members:', error)
    }
  }

  const filteredRequests = leaveRequests.filter(request => {
    const matchesSearch = request.request_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.admin_users.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.reason.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = !typeFilter || request.request_type === typeFilter
    const matchesStatus = !statusFilter || request.status === statusFilter
    return matchesSearch && matchesType && matchesStatus
  })

  const totalRequests = leaveRequests.length
  const pendingRequests = leaveRequests.filter(r => r.status === 'Pending').length
  const approvedRequests = leaveRequests.filter(r => r.status === 'Approved').length
  const rejectedRequests = leaveRequests.filter(r => r.status === 'Rejected').length

  const handleCreateRequest = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .insert([{
          admin_user_id: formData.admin_user_id,
          request_type: formData.request_type,
          leave_category: formData.leave_category,
          start_date: formData.start_date,
          end_date: formData.request_type === 'Half Day' ? formData.start_date : formData.end_date,
          reason: formData.reason,
          notes: formData.notes || null
        }])
        .select()

      if (error) throw error

      await fetchLeaveRequests()
      setView('list')
      resetForm()
    } catch (error) {
      console.error('Failed to create leave request:', error)
      alert('Failed to create leave request. Please try again.')
    }
  }

  const handleAddRequest = () => {
    setView('add')
    resetForm()
    if (userProfile?.id) {
      setFormData(prev => ({ ...prev, admin_user_id: userProfile.id }))
    }
  }

  const handleBackToList = () => {
    setView('list')
    resetForm()
  }

  const handleApproveRequest = async () => {
    if (!selectedRequest) return

    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'Approved',
          approved_by: teamMembers[0]?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', selectedRequest.id)

      if (error) throw error

      await fetchLeaveRequests()
      setShowApproveModal(false)
      setSelectedRequest(null)
      setView('list')
    } catch (error) {
      console.error('Failed to approve request:', error)
      alert('Failed to approve request. Please try again.')
    }
  }

  const handleRejectRequest = async () => {
    if (!selectedRequest) return

    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'Rejected',
          approved_by: teamMembers[0]?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectionReason.trim() || null
        })
        .eq('id', selectedRequest.id)

      if (error) throw error

      await fetchLeaveRequests()
      setShowRejectModal(false)
      setSelectedRequest(null)
      setRejectionReason('')
      setView('list')
    } catch (error) {
      console.error('Failed to reject request:', error)
      alert('Failed to reject request. Please try again.')
    }
  }

  const handleDeleteRequest = async (id: string, requestId: string) => {
    if (confirm(`Are you sure you want to delete request ${requestId}?`)) {
      try {
        const { error } = await supabase
          .from('leave_requests')
          .delete()
          .eq('id', id)

        if (error) throw error

        await fetchLeaveRequests()
      } catch (error) {
        console.error('Failed to delete request:', error)
        alert('Failed to delete request. Please try again.')
      }
    }
  }

  const handleViewRequest = (request: LeaveRequest) => {
    setSelectedRequest(request)
    setView('view')
  }

  const handleEditClick = (request: LeaveRequest) => {
    setSelectedRequest(request)
    setFormData({
      admin_user_id: request.admin_user_id,
      request_type: request.request_type,
      leave_category: request.leave_category,
      start_date: request.start_date,
      end_date: request.end_date,
      reason: request.reason,
      notes: request.notes || ''
    })
    setView('edit')
  }

  const handleEditRequest = async () => {
    if (!selectedRequest) return

    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          admin_user_id: formData.admin_user_id,
          request_type: formData.request_type,
          leave_category: formData.leave_category,
          start_date: formData.start_date,
          end_date: formData.request_type === 'Half Day' ? formData.start_date : formData.end_date,
          reason: formData.reason,
          notes: formData.notes || null
        })
        .eq('id', selectedRequest.id)

      if (error) throw error

      await fetchLeaveRequests()
      setView('list')
      setSelectedRequest(null)
      resetForm()
    } catch (error) {
      console.error('Failed to update leave request:', error)
      alert('Failed to update leave request. Please try again.')
    }
  }

  const resetForm = () => {
    setFormData({
      admin_user_id: '',
      request_type: '',
      leave_category: 'Casual',
      start_date: '',
      end_date: '',
      reason: '',
      notes: ''
    })
  }

  const getRequestTypeIcon = (type: string) => {
    switch (type) {
      case 'Leave':
        return Calendar
      case 'Work From Home':
        return Home
      case 'Half Day':
        return Sun
      default:
        return Calendar
    }
  }

  const getRequestTypeEmoji = (type: string) => {
    switch (type) {
      case 'Leave':
        return '🏖️'
      case 'Work From Home':
        return '🏠'
      case 'Half Day':
        return '☀️'
      default:
        return '📅'
    }
  }

  return (
    <>
      {/* Desktop View */}
      <div className="hidden md:block ppt-slide p-6">
        {view === 'list' && (
          <>
            <PageHeader
              title="Leave Management"
              subtitle="Manage team leave requests, work from home, and half day requests"
              actions={[
                ...(canCreate('leave') ? [{
                  label: 'New Request',
                  onClick: handleAddRequest,
                  variant: 'default' as const,
                  icon: Plus
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
              title="Total Requests"
              value={totalRequests}
              change={8}
              category="primary"
              icon={Calendar}
            />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
            <KPICard
              title="Pending"
              value={pendingRequests}
              change={3}
              category="warning"
              icon={Clock}
            />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
            <KPICard
              title="Approved"
              value={approvedRequests}
              change={12}
              category="success"
              icon={CheckCircle}
            />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
            <KPICard
              title="Rejected"
              value={rejectedRequests}
              change={-2}
              category="secondary"
              icon={XCircle}
            />
          </motion.div>
        </motion.div>

        <motion.div
          className="mb-6 flex gap-4 flex-wrap"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Input
            placeholder="Search by request ID, member name, or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="Leave">Leave</option>
            <option value="Work From Home">Work From Home</option>
            <option value="Half Day">Half Day</option>
          </select>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
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
              <CardTitle>Leave Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading leave requests...</p>
                  </div>
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Request</th>
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Team Member</th>
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Type</th>
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Duration</th>
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((request, index) => {
                      const RequestIcon = getRequestTypeIcon(request.request_type)
                      return (
                        <motion.tr
                          key={request.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 * index }}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-3">
                              <RequestIcon className="w-5 h-5 text-gray-600" />
                              <div>
                                <div className="font-medium font-mono">{request.request_id}</div>
                                <div className="text-sm text-gray-500">{new Date(request.created_at).toLocaleDateString()}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <div>
                                <div className="font-medium">{request.admin_users.full_name}</div>
                                <div className="text-sm text-gray-500">{request.admin_users.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={requestTypeColors[request.request_type]}>
                              {request.request_type}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <div className="text-sm font-medium">
                                {request.total_days} {request.total_days === 1 ? 'day' : 'days'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={statusColors[request.status]}>
                              {request.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewRequest(request)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                {canUpdate('leave') && (
                                  <DropdownMenuItem onClick={() => handleEditClick(request)}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Request
                                  </DropdownMenuItem>
                                )}
                                {canUpdate('leave') && request.status === 'Pending' && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedRequest(request)
                                        setShowApproveModal(true)
                                      }}
                                      className="text-green-600 focus:text-green-600"
                                    >
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Approve Request
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedRequest(request)
                                        setShowRejectModal(true)
                                      }}
                                      className="text-orange-600 focus:text-orange-600"
                                    >
                                      <XCircle className="w-4 h-4 mr-2" />
                                      Reject Request
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {canDelete('leave') && (
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteRequest(request.id, request.request_id)}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Request
                                  </DropdownMenuItem>
                                )}
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
        </motion.div>
          </>
        )}

        {view === 'add' && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <Button variant="ghost" onClick={handleBackToList}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to List
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-brand-text">New Leave Request</h1>
                <p className="text-sm text-gray-500">Submit a new leave request for team member</p>
              </div>
            </div>

            <Card className="shadow-xl">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Team Member *</label>
                    <Select value={formData.admin_user_id} onValueChange={(value) => setFormData(prev => ({ ...prev, admin_user_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select team member" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamMembers.map(member => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.full_name} ({member.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Request Type *</label>
                    <Select value={formData.request_type} onValueChange={(value) => setFormData(prev => ({ ...prev, request_type: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Leave">Leave</SelectItem>
                        <SelectItem value="Work From Home">Work From Home</SelectItem>
                        <SelectItem value="Half Day">Half Day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Leave Category *</label>
                    <Select value={formData.leave_category} onValueChange={(value) => setFormData(prev => ({ ...prev, leave_category: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Casual">Casual</SelectItem>
                        <SelectItem value="Vacation">Vacation</SelectItem>
                        <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                        <SelectItem value="Personal">Personal</SelectItem>
                        <SelectItem value="Emergency">Emergency</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                      <Input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      />
                    </div>
                    {formData.request_type !== 'Half Day' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                        <Input
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reason *</label>
                    <Textarea
                      value={formData.reason}
                      onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Enter reason for request"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Any additional information"
                      rows={2}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3 mt-6">
                  <Button
                    onClick={handleCreateRequest}
                    disabled={!formData.admin_user_id || !formData.request_type || !formData.start_date || !formData.reason || (formData.request_type !== 'Half Day' && !formData.end_date)}
                    className="flex-1"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Submit Request
                  </Button>
                  <Button variant="outline" onClick={handleBackToList} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {view === 'edit' && selectedRequest && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <Button variant="ghost" onClick={handleBackToList}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to List
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-brand-text">Edit Leave Request</h1>
                <p className="text-sm text-gray-500">Update leave request details</p>
              </div>
            </div>

            <Card className="shadow-xl">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Team Member *</label>
                    <Select value={formData.admin_user_id} onValueChange={(value) => setFormData(prev => ({ ...prev, admin_user_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select team member" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamMembers.map(member => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.full_name} ({member.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Request Type *</label>
                    <Select value={formData.request_type} onValueChange={(value) => setFormData(prev => ({ ...prev, request_type: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Leave">Leave</SelectItem>
                        <SelectItem value="Work From Home">Work From Home</SelectItem>
                        <SelectItem value="Half Day">Half Day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Leave Category *</label>
                    <Select value={formData.leave_category} onValueChange={(value) => setFormData(prev => ({ ...prev, leave_category: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Casual">Casual</SelectItem>
                        <SelectItem value="Vacation">Vacation</SelectItem>
                        <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                        <SelectItem value="Personal">Personal</SelectItem>
                        <SelectItem value="Emergency">Emergency</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                      <Input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      />
                    </div>
                    {formData.request_type !== 'Half Day' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                        <Input
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reason *</label>
                    <Textarea
                      value={formData.reason}
                      onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Enter reason for request"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Any additional information"
                      rows={2}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3 mt-6">
                  <Button
                    onClick={handleEditRequest}
                    disabled={!formData.admin_user_id || !formData.request_type || !formData.start_date || !formData.reason || (formData.request_type !== 'Half Day' && !formData.end_date)}
                    className="flex-1"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={handleBackToList} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {view === 'view' && selectedRequest && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <Button variant="ghost" onClick={handleBackToList}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to List
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-brand-text">Request Details</h1>
                <p className="text-sm text-gray-500">View leave request information</p>
              </div>
            </div>

            <Card className="shadow-xl">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Team Member</label>
                      <p className="text-base font-semibold text-gray-800">{selectedRequest.admin_users.full_name}</p>
                      <p className="text-sm text-gray-500">{selectedRequest.admin_users.email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
                      <Badge className={statusColors[selectedRequest.status]}>
                        {selectedRequest.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Request Type</label>
                      <Badge className={requestTypeColors[selectedRequest.request_type]}>
                        {selectedRequest.request_type}
                      </Badge>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Leave Category</label>
                      <p className="text-base font-semibold text-gray-800">
                        {selectedRequest.leave_category}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Duration</label>
                    <p className="text-base font-semibold text-gray-800">
                      {selectedRequest.total_days} {selectedRequest.total_days === 1 ? 'day' : 'days'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Dates</label>
                    <p className="text-base font-semibold text-gray-800">
                      {format(new Date(selectedRequest.start_date), 'MMM dd, yyyy')} - {format(new Date(selectedRequest.end_date), 'MMM dd, yyyy')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Reason</label>
                    <p className="text-base text-gray-700 leading-relaxed">{selectedRequest.reason}</p>
                  </div>

                  {selectedRequest.notes && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Additional Notes</label>
                      <p className="text-base text-gray-700 leading-relaxed">{selectedRequest.notes}</p>
                    </div>
                  )}

                  {selectedRequest.status === 'Rejected' && selectedRequest.rejection_reason && (
                    <div>
                      <label className="block text-sm font-medium text-red-600 mb-1">Rejection Reason</label>
                      <p className="text-base text-red-700 leading-relaxed bg-red-50 p-3 rounded-lg border border-red-200">
                        {selectedRequest.rejection_reason}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-6">
                  {canUpdate('leave') && selectedRequest.status === 'Pending' && (
                    <>
                      <Button
                        onClick={() => setShowApproveModal(true)}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => setShowRejectModal(true)}
                        className="flex-1 bg-orange-600 hover:bg-orange-700"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </>
                  )}
                  {canUpdate('leave') && (
                    <Button
                      onClick={() => handleEditClick(selectedRequest)}
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  {canDelete('leave') && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        handleDeleteRequest(selectedRequest.id, selectedRequest.request_id)
                        handleBackToList()
                      }}
                      className="flex-1 text-red-600 hover:text-red-700 hover:border-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Mobile View */}
      <div className="md:hidden min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
        {/* Mobile Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-6 shadow-lg">
          <h1 className="text-2xl font-bold mb-1">Leave Requests</h1>
          <p className="text-purple-100 text-sm">{format(new Date(), 'EEEE, MMMM dd, yyyy')}</p>
        </div>

        {/* Stats Cards */}
        <div className="px-4 -mt-4 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <motion.div
              whileTap={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-4 shadow-lg border border-purple-100"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="bg-purple-100 p-2 rounded-xl">
                  <Calendar className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-2xl font-bold text-purple-600">{totalRequests}</span>
              </div>
              <p className="text-xs text-gray-600 font-medium">Total</p>
            </motion.div>

            <motion.div
              whileTap={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-4 shadow-lg border border-yellow-100"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="bg-yellow-100 p-2 rounded-xl">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <span className="text-2xl font-bold text-yellow-600">{pendingRequests}</span>
              </div>
              <p className="text-xs text-gray-600 font-medium">Pending</p>
            </motion.div>

            <motion.div
              whileTap={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-4 shadow-lg border border-green-100"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="bg-green-100 p-2 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-2xl font-bold text-green-600">{approvedRequests}</span>
              </div>
              <p className="text-xs text-gray-600 font-medium">Approved</p>
            </motion.div>

            <motion.div
              whileTap={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-4 shadow-lg border border-red-100"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="bg-red-100 p-2 rounded-xl">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <span className="text-2xl font-bold text-red-600">{rejectedRequests}</span>
              </div>
              <p className="text-xs text-gray-600 font-medium">Rejected</p>
            </motion.div>
          </div>
        </div>

        {/* New Request Button */}
        <div className="px-4 mb-4">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleAddRequest}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl py-4 px-6 shadow-lg flex items-center justify-center gap-3 font-semibold"
          >
            <Plus className="w-5 h-5" />
            New Leave Request
          </motion.button>
        </div>

        {/* Recent Requests */}
        <div className="px-4 pb-20">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Recent Requests</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No requests yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((request) => (
                <motion.div
                  key={request.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleViewRequest(request)}
                  className="bg-white rounded-2xl p-4 shadow-md active:shadow-lg transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{getRequestTypeEmoji(request.request_type)}</div>
                      <div>
                        <p className="font-semibold text-gray-800">{request.admin_users.full_name}</p>
                        <p className="text-xs text-gray-500">{request.request_type}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{request.reason}</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(request.start_date), 'MMM dd')} - {format(new Date(request.end_date), 'MMM dd')} ({request.total_days} days)
                      </p>
                    </div>
                    <Badge className={statusColors[request.status]}>
                      {request.status}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail View for Mobile */}
      <AnimatePresence>
        {view === 'view' && selectedRequest && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="md:hidden fixed inset-0 bg-white z-50 overflow-y-auto"
          >
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-6 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <button onClick={handleBackToList}>
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold">Request Details</h2>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-5xl">{getRequestTypeEmoji(selectedRequest.request_type)}</div>
                  <div>
                    <p className="text-lg font-bold text-gray-800">{selectedRequest.admin_users.full_name}</p>
                    <Badge className={statusColors[selectedRequest.status]}>
                      {selectedRequest.status}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-100 p-2 rounded-xl">
                        <Calendar className="w-4 h-4 text-purple-600" />
                      </div>
                      <span className="text-sm text-gray-600">Type</span>
                    </div>
                    <Badge className={requestTypeColors[selectedRequest.request_type]}>
                      {selectedRequest.request_type}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-xl">
                        <Calendar className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-sm text-gray-600">Duration</span>
                    </div>
                    <span className="font-semibold text-gray-800">
                      {selectedRequest.total_days} {selectedRequest.total_days === 1 ? 'day' : 'days'}
                    </span>
                  </div>

                  <div className="py-3 border-b">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-green-100 p-2 rounded-xl">
                        <Calendar className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="text-sm text-gray-600">Dates</span>
                    </div>
                    <p className="text-sm text-gray-700 ml-12">
                      {format(new Date(selectedRequest.start_date), 'MMM dd, yyyy')} - {format(new Date(selectedRequest.end_date), 'MMM dd, yyyy')}
                    </p>
                  </div>

                  <div className="py-3">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-orange-100 p-2 rounded-xl">
                        <User className="w-4 h-4 text-orange-600" />
                      </div>
                      <span className="text-sm text-gray-600">Reason</span>
                    </div>
                    <p className="text-sm text-gray-700 ml-12 leading-relaxed">
                      {selectedRequest.reason}
                    </p>
                  </div>

                  {selectedRequest.notes && (
                    <div className="py-3 border-t">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="bg-gray-100 p-2 rounded-xl">
                          <User className="w-4 h-4 text-gray-600" />
                        </div>
                        <span className="text-sm text-gray-600">Notes</span>
                      </div>
                      <p className="text-sm text-gray-700 ml-12 leading-relaxed bg-gray-50 p-3 rounded-lg">
                        {selectedRequest.notes}
                      </p>
                    </div>
                  )}

                  {selectedRequest.rejection_reason && (
                    <div className="py-3 border-t">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="bg-red-100 p-2 rounded-xl">
                          <XCircle className="w-4 h-4 text-red-600" />
                        </div>
                        <span className="text-sm text-gray-600">Rejection Reason</span>
                      </div>
                      <p className="text-sm text-red-700 ml-12 leading-relaxed bg-red-50 p-3 rounded-lg border border-red-200">
                        {selectedRequest.rejection_reason}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-4 pb-4 space-y-3">
                {canUpdate('leave') && selectedRequest.status === 'Pending' && (
                  <div className="flex gap-3">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowApproveModal(true)}
                      className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl py-4 font-semibold shadow-lg flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Approve
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowRejectModal(true)}
                      className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl py-4 font-semibold shadow-lg flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-5 h-5" />
                      Reject
                    </motion.button>
                  </div>
                )}
                <div className="flex gap-3">
                  {canUpdate('leave') && (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleEditClick(selectedRequest)}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl py-4 font-semibold shadow-lg flex items-center justify-center gap-2"
                    >
                      <Edit className="w-5 h-5" />
                      Edit
                    </motion.button>
                  )}
                  {canDelete('leave') && (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        handleDeleteRequest(selectedRequest.id, selectedRequest.request_id)
                        handleBackToList()
                      }}
                      className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl py-4 font-semibold shadow-lg flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-5 h-5" />
                      Delete
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Approve Modal */}
      {showApproveModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-brand-text">Approve Request</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowApproveModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-gray-600 mb-6">
              Are you sure you want to approve leave request <span className="font-mono font-semibold">{selectedRequest.request_id}</span> for <span className="font-semibold">{selectedRequest.admin_users.full_name}</span>?
            </p>

            <div className="flex items-center space-x-3">
              <Button onClick={handleApproveRequest} className="bg-green-600 hover:bg-green-700 flex-1">
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve
              </Button>
              <Button variant="outline" onClick={() => setShowApproveModal(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-brand-text">Reject Request</h2>
              <Button variant="ghost" size="sm" onClick={() => { setShowRejectModal(false); setRejectionReason(''); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-gray-600 mb-4">
              Optionally provide a reason for rejecting leave request <span className="font-mono font-semibold">{selectedRequest.request_id}</span>:
            </p>

            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason (optional)..."
              rows={4}
              className="mb-4"
            />

            <div className="flex items-center space-x-3">
              <Button
                onClick={handleRejectRequest}
                className="bg-red-600 hover:bg-red-700 flex-1"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button variant="outline" onClick={() => { setShowRejectModal(false); setRejectionReason(''); }} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Create Leave Request Page */}
      <AnimatePresence>
        {view === 'add' && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="md:hidden fixed inset-0 bg-white z-[60] overflow-y-auto"
          >
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-6 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <button onClick={handleBackToList}>
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold">New Leave Request</h2>
              </div>
            </div>

            <div className="p-4 pb-24 space-y-6">
              {/* Team Member */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Team Member *
                </label>
                <select
                  value={formData.admin_user_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, admin_user_id: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select team member</option>
                  {teamMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.full_name} ({member.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Request Type */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Request Type *
                </label>
                <select
                  value={formData.request_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, request_type: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select type</option>
                  <option value="Leave">Leave 🏖️</option>
                  <option value="Work From Home">Work From Home 🏠</option>
                  <option value="Half Day">Half Day ☀️</option>
                </select>
              </div>

              {/* Leave Category */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Leave Category *
                </label>
                <select
                  value={formData.leave_category}
                  onChange={(e) => setFormData(prev => ({ ...prev, leave_category: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="Casual">Casual</option>
                  <option value="Vacation">Vacation</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Personal">Personal</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Dates */}
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {formData.request_type !== 'Half Day' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      End Date *
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              {/* Reason */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Reason *
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Why are you requesting this leave?"
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Additional Notes */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any additional information..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Fixed Bottom Button */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-20">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleCreateRequest}
                disabled={!formData.admin_user_id || !formData.request_type || !formData.start_date || !formData.reason || (formData.request_type !== 'Half Day' && !formData.end_date)}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl py-4 font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                Submit Request
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Edit Leave Request Page */}
      <AnimatePresence>
        {view === 'edit' && selectedRequest && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="md:hidden fixed inset-0 bg-white z-[60] overflow-y-auto"
          >
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-6 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <button onClick={handleBackToList}>
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold">Edit Leave Request</h2>
              </div>
            </div>

            <div className="p-4 pb-24 space-y-6">
              {/* Team Member */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Team Member *
                </label>
                <select
                  value={formData.admin_user_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, admin_user_id: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select team member</option>
                  {teamMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.full_name} ({member.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Request Type */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Request Type *
                </label>
                <select
                  value={formData.request_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, request_type: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select type</option>
                  <option value="Leave">Leave 🏖️</option>
                  <option value="Work From Home">Work From Home 🏠</option>
                  <option value="Half Day">Half Day ☀️</option>
                </select>
              </div>

              {/* Leave Category */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Leave Category *
                </label>
                <select
                  value={formData.leave_category}
                  onChange={(e) => setFormData(prev => ({ ...prev, leave_category: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="Casual">Casual</option>
                  <option value="Vacation">Vacation</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Personal">Personal</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Dates */}
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {formData.request_type !== 'Half Day' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      End Date *
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              {/* Reason */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Reason *
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Why are you requesting this leave?"
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Additional Notes */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any additional information..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Fixed Bottom Button */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-20">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleEditRequest}
                disabled={!formData.admin_user_id || !formData.request_type || !formData.start_date || !formData.reason || (formData.request_type !== 'Half Day' && !formData.end_date)}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl py-4 font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                Save Changes
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
