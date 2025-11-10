import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserPlus, Eye, CreditCard as Edit, Trash2, Shield, Crown, User, Settings, Mail, Phone, X, Save, Lock, Unlock, CheckCircle, XCircle, MoreVertical, ChevronRight, ArrowLeft, Users, Clock } from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { KPICard } from '@/components/Common/KPICard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { makeApiCall } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { UserWorkingHoursSettings } from '@/components/Settings/UserWorkingHoursSettings'
import { useAuth } from '@/contexts/AuthContext'
import { PermissionGuard } from '@/components/Common/PermissionGuard'

const mockTeamMembers = [
  {
    memberId: 'T001',
    name: 'Admin User',
    email: 'admin@aiacoach.com',
    phone: '919876543210',
    role: 'Super Admin',
    department: 'Management',
    permissions: ['All Access'],
    status: 'Active',
    lastLogin: '2024-01-21 10:30 AM',
    joinedOn: '2024-01-01',
    avatar: 'AU'
  },
  {
    memberId: 'T002',
    name: 'John Smith',
    email: 'john@aiacoach.com',
    phone: '919876543211',
    role: 'Sales Manager',
    department: 'Sales',
    permissions: ['Leads Management', 'Members View', 'Reports'],
    status: 'Active',
    lastLogin: '2024-01-21 09:15 AM',
    joinedOn: '2024-01-05',
    avatar: 'JS'
  },
  {
    memberId: 'T003',
    name: 'Jane Doe',
    email: 'jane@aiacoach.com',
    phone: '919876543212',
    role: 'Content Manager',
    department: 'Content',
    permissions: ['Courses Management', 'Members View'],
    status: 'Active',
    lastLogin: '2024-01-20 04:45 PM',
    joinedOn: '2024-01-08',
    avatar: 'JD'
  },
  {
    memberId: 'T004',
    name: 'Mike Wilson',
    email: 'mike@aiacoach.com',
    phone: '919876543213',
    role: 'Support Agent',
    department: 'Support',
    permissions: ['Support Tickets', 'Members View'],
    status: 'Active',
    lastLogin: '2024-01-21 08:20 AM',
    joinedOn: '2024-01-10',
    avatar: 'MW'
  },
  {
    memberId: 'T005',
    name: 'Sarah Johnson',
    email: 'sarah@aiacoach.com',
    phone: '919876543214',
    role: 'Marketing Specialist',
    department: 'Marketing',
    permissions: ['Affiliates Management', 'Leads View', 'Reports'],
    status: 'Inactive',
    lastLogin: '2024-01-18 02:30 PM',
    joinedOn: '2024-01-12',
    avatar: 'SJ'
  }
]

const roleColors: Record<string, string> = {
  'Super Admin': 'bg-red-100 text-red-800',
  'Admin': 'bg-orange-100 text-orange-800',
  'Manager': 'bg-blue-100 text-blue-800',
  'Team Lead': 'bg-purple-100 text-purple-800',
  'Team Member': 'bg-green-100 text-green-800'
}

const statusColors: Record<string, string> = {
  'Active': 'bg-green-100 text-green-800',
  'Inactive': 'bg-gray-100 text-gray-800',
  'Suspended': 'bg-red-100 text-red-800'
}

const departmentColors: Record<string, string> = {
  'Management': 'bg-red-50 text-red-700',
  'Sales': 'bg-blue-50 text-blue-700',
  'Content': 'bg-purple-50 text-purple-700',
  'Support': 'bg-green-50 text-green-700',
  'Marketing': 'bg-orange-50 text-orange-700',
  'Development': 'bg-gray-50 text-gray-700'
}

type ViewState = 'list' | 'add' | 'view' | 'edit'

export function Team() {
  const { canCreate, canUpdate, canDelete } = useAuth()
  const [view, setView] = useState<ViewState>('list')
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Removed showViewModal and showModuleAccessModal - now using view state pattern
  const [selectedMember, setSelectedMember] = useState<any>(null)
  // Removed viewModalTab - now using formTab for all views
  const [formTab, setFormTab] = useState<'details' | 'modules' | 'working-hours'>('details')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    department: '',
    permissions: [] as string[],
    status: 'Active'
  })

  const allModules = {
    enrolled_members: { read: false, insert: false, update: false, delete: false },
    leads: { read: false, insert: false, update: false, delete: false },
    courses: { read: false, insert: false, update: false, delete: false },
    billing: { read: false, insert: false, update: false, delete: false },
    team: { read: false, insert: false, update: false, delete: false },
    settings: { read: false, insert: false, update: false, delete: false },
    webhooks: { read: false, insert: false, update: false, delete: false },
    automations: { read: false, insert: false, update: false, delete: false },
    affiliates: { read: false, insert: false, update: false, delete: false },
    support: { read: false, insert: false, update: false, delete: false },
    contacts: { read: false, insert: false, update: false, delete: false },
    tasks: { read: false, insert: false, update: false, delete: false },
    appointments: { read: false, insert: false, update: false, delete: false },
    lms: { read: false, insert: false, update: false, delete: false },
    attendance: { read: false, insert: false, update: false, delete: false },
    expenses: { read: false, insert: false, update: false, delete: false },
    products: { read: false, insert: false, update: false, delete: false },
    leave: { read: false, insert: false, update: false, delete: false },
    media: { read: false, insert: false, update: false, delete: false },
    integrations: { read: false, insert: false, update: false, delete: false },
    ai_agents: { read: false, insert: false, update: false, delete: false },
    pipelines: { read: false, insert: false, update: false, delete: false }
  }

  const [modulePermissions, setModulePermissions] = useState<Record<string, { read: boolean; insert: boolean; update: boolean; delete: boolean }>>(allModules)

  // Fetch team members data from Supabase admin_users table
  useEffect(() => {
    const fetchTeamMembers = async () => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        const formatRole = (role: string) => {
          return role
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        }

        const mappedMembers = data.map((member: any) => ({
          id: member.id,
          memberId: member.member_id || `T${member.id.slice(0, 3).toUpperCase()}`,
          name: member.full_name,
          email: member.email,
          phone: member.phone || '',
          role: formatRole(member.role),
          department: member.department || 'General',
          modulePermissions: member.permissions || {},
          permissions: member.permissions ? Object.keys(member.permissions).filter(key =>
            member.permissions[key].read || member.permissions[key].insert ||
            member.permissions[key].update || member.permissions[key].delete
          ).map(key => key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())) : [],
          status: member.status || 'Active',
          lastLogin: member.last_login ? new Date(member.last_login).toLocaleString() : 'Never',
          joinedOn: member.created_at ? new Date(member.created_at).toISOString().split('T')[0] : '',
          isActive: member.is_active,
          avatar: member.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
        }))

        setTeamMembers(mappedMembers)

        if (mappedMembers.length > 0 && mappedMembers[0].modulePermissions) {
          setModulePermissions(mappedMembers[0].modulePermissions)
        }
      } catch (error) {
        console.error('Failed to fetch team members:', error)
        setTeamMembers(mockTeamMembers)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTeamMembers()
  }, [])

  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.phone.includes(searchTerm)
    const matchesRole = !roleFilter || member.role === roleFilter
    const matchesDepartment = !departmentFilter || member.department === departmentFilter
    return matchesSearch && matchesRole && matchesDepartment
  })

  const activeMembers = teamMembers.filter(m => m.status === 'Active').length
  const totalMembers = teamMembers.length
  const departments = [...new Set(teamMembers.map(m => m.department))].length
  const adminCount = teamMembers.filter(m => m.role.includes('Admin')).length

  const getRoleIcon = (role: string) => {
    if (role.includes('Admin')) return Crown
    if (role.includes('Manager')) return Shield
    return User
  }

  const handleCreateMember = async () => {
    try {
      // Convert role back to snake_case for database
      const roleToSnakeCase = (role: string) => {
        return role.toLowerCase().replace(/\s+/g, '_')
      }

      const { data, error } = await supabase
        .from('admin_users')
        .insert([{
          full_name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: roleToSnakeCase(formData.role),
          department: formData.department,
          status: formData.status,
          password_hash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
          permissions: modulePermissions,
          is_active: formData.status === 'Active',
          member_id: `T${String(teamMembers.length + 1).padStart(3, '0')}`
        }])
        .select()

      if (error) throw error

      const formatRole = (role: string) => {
        return role
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      }

      const newMember = {
        id: data[0].id,
        memberId: data[0].member_id,
        name: data[0].full_name,
        email: data[0].email,
        phone: data[0].phone,
        role: formatRole(data[0].role),
        department: data[0].department,
        modulePermissions: data[0].permissions,
        status: data[0].status,
        lastLogin: 'Never',
        joinedOn: new Date(data[0].created_at).toISOString().split('T')[0],
        isActive: data[0].is_active,
        avatar: data[0].full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
      }

      setTeamMembers(prev => [newMember, ...prev])
      setView('list')
      resetForm()
    } catch (error) {
      console.error('Failed to create team member:', error)
      alert('Failed to create team member. Please try again.')
    }
  }

  const handleEditMember = async () => {
    try {
      // Convert role back to snake_case for database
      const roleToSnakeCase = (role: string) => {
        return role.toLowerCase().replace(/\s+/g, '_')
      }

      const { data, error } = await supabase
        .from('admin_users')
        .update({
          full_name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: roleToSnakeCase(formData.role),
          department: formData.department,
          status: formData.status,
          is_active: formData.status === 'Active',
          permissions: modulePermissions
        })
        .eq('id', selectedMember.id)
        .select()

      if (error) throw error

      const formatRole = (role: string) => {
        return role
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      }

      setTeamMembers(prev => prev.map(member =>
        member.id === selectedMember.id
          ? {
              ...member,
              name: data[0].full_name,
              email: data[0].email,
              phone: data[0].phone,
              role: formatRole(data[0].role),
              department: data[0].department,
              status: data[0].status,
              isActive: data[0].is_active,
              modulePermissions: data[0].permissions
            }
          : member
      ))
      setView('list')
      resetForm()
    } catch (error) {
      console.error('Failed to update team member:', error)
      alert('Failed to update team member. Please try again.')
    }
  }

  const handleDeleteMember = async (memberId: string, id: string) => {
    if (confirm('Are you sure you want to remove this team member?')) {
      try {
        const { error } = await supabase
          .from('admin_users')
          .delete()
          .eq('id', id)

        if (error) throw error

        setTeamMembers(prev => prev.filter(member => member.id !== id))
      } catch (error) {
        console.error('Failed to delete team member:', error)
        alert('Failed to delete team member. Please try again.')
      }
    }
  }

  const handleViewMember = (member: any) => {
    setSelectedMember(member)
    if (member.modulePermissions) {
      setModulePermissions(member.modulePermissions)
    }
    setFormTab('details')
    setView('view')
  }

  const handleEditClick = (member: any) => {
    setSelectedMember(member)
    setFormData({
      name: member.name,
      email: member.email,
      phone: member.phone,
      role: member.role,
      department: member.department,
      permissions: member.permissions || [],
      status: member.status
    })
    if (member.modulePermissions) {
      setModulePermissions(member.modulePermissions)
    }
    setView('edit')
  }

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: '',
      department: '',
      permissions: [],
      status: 'Active'
    })
    setModulePermissions(allModules)
    setSelectedMember(null)
    setFormTab('details')
  }

  const availablePermissions = [
    'All Access',
    'Leads Management',
    'Members View',
    'Members Management',
    'Courses Management',
    'Billing Management',
    'Support Tickets',
    'Affiliates Management',
    'Team Management',
    'Settings Access',
    'Reports',
    'Analytics'
  ]

  const togglePermission = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }))
  }

  const toggleModulePermission = (module: string, action: 'read' | 'insert' | 'update' | 'delete') => {
    setModulePermissions(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module][action]
      }
    }))
  }

  const handleSaveModuleAccess = async () => {
    try {
      const { error } = await supabase
        .from('admin_users')
        .update({
          permissions: modulePermissions
        })
        .eq('id', selectedMember.id)

      if (error) throw error

      setTeamMembers(prev => prev.map(member =>
        member.id === selectedMember.id
          ? { ...member, modulePermissions }
          : member
      ))

      setShowModuleAccessModal(false)
      alert('Module permissions updated successfully!')
    } catch (error) {
      console.error('Failed to update module permissions:', error)
      alert('Failed to update module permissions. Please try again.')
    }
  }

  const getRoleEmoji = (role: string) => {
    if (role.includes('Admin')) return '👑'
    if (role.includes('Manager')) return '🛡️'
    if (role.includes('Sales')) return '💼'
    if (role.includes('Content')) return '✍️'
    if (role.includes('Support')) return '🎧'
    if (role.includes('Marketing')) return '📢'
    if (role.includes('Developer')) return '💻'
    return '👤'
  }

  return (
    <>
      {/* Desktop View */}
      <div className="hidden md:block ppt-slide p-6">
      {view === 'list' && (
        <PageHeader
          title="Team Management"
          subtitle="Roles → Permissions → Access Control"
          actions={[
            {
              label: 'Add Team Member',
              onClick: () => setView('add'),
              variant: 'default',
              icon: UserPlus
            }
          ]}
        />
      )}

      {view === 'list' && (
        <>
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
            title="Total Team Members"
            value={totalMembers}
            change={12}
            icon={User}
            category="primary"
          />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
          <KPICard
            title="Active Members"
            value={activeMembers}
            change={8}
            icon={Shield}
            category="success"
          />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
          <KPICard
            title="Departments"
            value={departments}
            change={0}
            icon={Settings}
            category="secondary"
          />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
          <KPICard
            title="Admin Users"
            value={adminCount}
            change={0}
            icon={Crown}
            category="secondary"
          />
        </motion.div>
      </motion.div>

      {/* Filters */}
      <motion.div 
        className="mb-6 flex gap-4 flex-wrap"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Input
          placeholder="Search team members by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <select
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All Roles</option>
          <option value="Super Admin">Super Admin</option>
          <option value="Admin">Admin</option>
          <option value="Manager">Manager</option>
          <option value="Team Lead">Team Lead</option>
          <option value="Team Member">Team Member</option>
        </select>
        <select
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
        >
          <option value="">All Departments</option>
          <option value="Management">Management</option>
          <option value="Sales">Sales</option>
          <option value="Content">Content</option>
          <option value="Support">Support</option>
          <option value="Marketing">Marketing</option>
        </select>
      </motion.div>

      {/* Team Members Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Team Members Directory</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading team members...</p>
                </div>
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Member</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Contact</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Role</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Department</th>
                    <th className="text-left py-3 px-4 font-semibold text-brand-text">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member, index) => {
                    const RoleIcon = getRoleIcon(member.role)
                    return (
                      <motion.tr
                        key={member.memberId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * index }}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-brand-primary text-white font-medium">
                                {(member.name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium flex items-center space-x-2">
                                <span>{member.name || 'Unknown'}</span>
                                <RoleIcon className="w-4 h-4 text-brand-primary" />
                              </div>
                              <div className="text-sm text-gray-500 font-mono">{member.memberId}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2 text-sm">
                              <Mail className="w-4 h-4 text-gray-400" />
                              <span>{member.email || 'N/A'}</span>
                            </div>
                            <div className="flex items-center space-x-2 text-sm font-mono">
                              <Phone className="w-4 h-4 text-gray-400" />
                              <span>{member.phone || 'N/A'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={roleColors[member.role] || 'bg-gray-100 text-gray-800'}>{member.role || 'Team Member'}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={departmentColors[member.department] || 'bg-gray-50 text-gray-700'}>
                            {member.department || 'General'}
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
                              <DropdownMenuItem onClick={() => handleViewMember(member)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditClick(member)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Member
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedMember(member)
                                  if (member.modulePermissions) {
                                    setModulePermissions(member.modulePermissions)
                                  }
                                  setFormTab('modules')
                                  setView('view')
                                }}
                              >
                                <Lock className="w-4 h-4 mr-2" />
                                Manage Module Access
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteMember(member.memberId, member.id)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Remove Member
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
      </motion.div>

      {/* Role Permissions Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Roles Overview */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-brand-primary" />
              <span>Roles Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(
                teamMembers.reduce((acc, member) => {
                  acc[member.role] = (acc[member.role] || 0) + 1
                  return acc
                }, {} as Record<string, number>)
              ).map(([role, count]) => {
                const RoleIcon = getRoleIcon(role)
                const maxCount = Math.max(...Object.values(
                  teamMembers.reduce((acc, member) => {
                    acc[member.role] = (acc[member.role] || 0) + 1
                    return acc
                  }, {} as Record<string, number>)
                ))
                const percentage = (count / maxCount) * 100
                
                return (
                  <div key={role} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center">
                          <RoleIcon className="w-4 h-4 text-brand-primary" />
                        </div>
                        <span className="font-medium">{role}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{count} member{count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <motion.div 
                        className="h-2 rounded-full bg-gradient-to-r from-brand-primary to-brand-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ delay: 0.6, duration: 0.5 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Department Distribution */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5 text-brand-primary" />
              <span>Department Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(
                teamMembers.reduce((acc, member) => {
                  acc[member.department] = (acc[member.department] || 0) + 1
                  return acc
                }, {} as Record<string, number>)
              ).map(([department, count]) => {
                const maxCount = Math.max(...Object.values(
                  teamMembers.reduce((acc, member) => {
                    acc[member.department] = (acc[member.department] || 0) + 1
                    return acc
                  }, {} as Record<string, number>)
                ))
                const percentage = (count / maxCount) * 100
                
                return (
                  <div key={department} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${departmentColors[department]}`}>
                          <span className="text-xs font-medium">
                            {department.charAt(0)}
                          </span>
                        </div>
                        <span className="font-medium">{department}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{count} member{count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <motion.div 
                        className="h-2 rounded-full bg-gradient-to-r from-brand-accent to-brand-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ delay: 0.8, duration: 0.5 }}
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
      )}

      {/* Add/Edit Team Member Form */}
      {(view === 'add' || view === 'edit') && (
        <Card>
          <CardContent className="p-6">
            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
              <button
                onClick={() => setFormTab('details')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-all ${
                  formTab === 'details'
                    ? 'bg-white text-brand-primary shadow-sm'
                    : 'text-gray-600 hover:text-brand-primary'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Details</span>
              </button>
              <button
                onClick={() => setFormTab('modules')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-all ${
                  formTab === 'modules'
                    ? 'bg-white text-brand-primary shadow-sm'
                    : 'text-gray-600 hover:text-brand-primary'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>Module Access</span>
              </button>
              <button
                onClick={() => setFormTab('working-hours')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-all ${
                  formTab === 'working-hours'
                    ? 'bg-white text-brand-primary shadow-sm'
                    : 'text-gray-600 hover:text-brand-primary'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Working Hours</span>
              </button>
            </div>

            {formTab === 'details' && (
            <div className="space-y-4">
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
                  <Input
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
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter phone number"
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                  <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Super Admin">Super Admin</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Manager">Manager</SelectItem>
                      <SelectItem value="Team Lead">Team Lead</SelectItem>
                      <SelectItem value="Team Member">Team Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department *</label>
                  <Select value={formData.department} onValueChange={(value) => setFormData(prev => ({ ...prev, department: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Management">Management</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="Content">Content</SelectItem>
                      <SelectItem value="Support">Support</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Development">Development</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            )}

            {formTab === 'modules' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Configure granular access permissions for each module</p>
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <table className="w-full border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b-2 border-gray-200 bg-gray-50">
                        <th className="text-left py-2 md:py-3 px-2 md:px-4 font-semibold text-brand-text text-sm">Module</th>
                        <th className="text-center py-2 md:py-3 px-2 md:px-4 font-semibold text-brand-text">
                          <div className="flex flex-col items-center">
                            <span className="text-xs md:text-sm">Read</span>
                            <span className="text-xs font-normal text-gray-500 hidden md:block">View</span>
                          </div>
                        </th>
                        <th className="text-center py-2 md:py-3 px-2 md:px-4 font-semibold text-brand-text">
                          <div className="flex flex-col items-center">
                            <span className="text-xs md:text-sm">Insert</span>
                            <span className="text-xs font-normal text-gray-500 hidden md:block">Create</span>
                          </div>
                        </th>
                        <th className="text-center py-2 md:py-3 px-2 md:px-4 font-semibold text-brand-text">
                          <div className="flex flex-col items-center">
                            <span className="text-xs md:text-sm">Update</span>
                            <span className="text-xs font-normal text-gray-500 hidden md:block">Modify</span>
                          </div>
                        </th>
                        <th className="text-center py-2 md:py-3 px-2 md:px-4 font-semibold text-brand-text">
                          <div className="flex flex-col items-center">
                            <span className="text-xs md:text-sm">Delete</span>
                            <span className="text-xs font-normal text-gray-500 hidden md:block">Remove</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(modulePermissions).map(([module, perms]) => (
                        <tr key={module} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 md:py-4 px-2 md:px-4">
                            <div className="flex items-center space-x-2 md:space-x-3">
                              <Shield className="w-4 h-4 md:w-5 md:h-5 text-brand-primary" />
                              <span className="font-medium capitalize text-sm md:text-base">{module.replace(/_/g, ' ')}</span>
                            </div>
                          </td>
                          <td className="py-3 md:py-4 px-2 md:px-4 text-center">
                            <input
                              type="checkbox"
                              checked={perms.read}
                              onChange={() => toggleModulePermission(module, 'read')}
                              className="w-4 h-4 md:w-5 md:h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 md:py-4 px-2 md:px-4 text-center">
                            <input
                              type="checkbox"
                              checked={perms.insert}
                              onChange={() => toggleModulePermission(module, 'insert')}
                              className="w-4 h-4 md:w-5 md:h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 md:py-4 px-2 md:px-4 text-center">
                            <input
                              type="checkbox"
                              checked={perms.update}
                              onChange={() => toggleModulePermission(module, 'update')}
                              className="w-4 h-4 md:w-5 md:h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 md:py-4 px-2 md:px-4 text-center">
                            <input
                              type="checkbox"
                              checked={perms.delete}
                              onChange={() => toggleModulePermission(module, 'delete')}
                              className="w-4 h-4 md:w-5 md:h-5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-gray-50 rounded-lg gap-3">
                <div className="text-sm text-gray-600">
                  <strong>Tip:</strong> Grant only the minimum permissions required for the user's role.
                </div>
                <div className="flex items-center space-x-2 w-full md:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allEnabled = Object.fromEntries(
                        Object.keys(modulePermissions).map(key => [
                          key,
                          { read: true, insert: true, update: true, delete: true }
                        ])
                      )
                      setModulePermissions(allEnabled)
                    }}
                  >
                    <Unlock className="w-4 h-4 mr-2" />
                    Grant All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allDisabled = Object.fromEntries(
                        Object.keys(modulePermissions).map(key => [
                          key,
                          { read: false, insert: false, update: false, delete: false }
                        ])
                      )
                      setModulePermissions(allDisabled)
                    }}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Revoke All
                  </Button>
                </div>
              </div>
            </div>
            )}

            {formTab === 'working-hours' && (
              <UserWorkingHoursSettings userId={view === 'edit' && selectedMember ? selectedMember.id : undefined} />
            )}

            <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-3 mt-6">
              <Button
                onClick={view === 'add' ? handleCreateMember : handleEditMember}
                disabled={!formData.name || !formData.email || !formData.phone || !formData.role || !formData.department}
                className="w-full md:w-auto"
              >
                <Save className="w-4 h-4 mr-2" />
                {view === 'add' ? 'Add Team Member' : 'Update Team Member'}
              </Button>
              <Button variant="outline" onClick={() => { setView('list'); resetForm(); }} className="w-full md:w-auto">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Team Member Details */}
      {view === 'view' && selectedMember && (
        <Card>
          <CardContent className="p-6">
            {/* Back Button */}
            <div className="mb-6">
              <Button
                variant="ghost"
                onClick={() => { setView('list'); setSelectedMember(null); }}
                className="flex items-center text-brand-primary hover:text-brand-primary/80"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to List
              </Button>
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
              <button
                onClick={() => setFormTab('details')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-all ${
                  formTab === 'details'
                    ? 'bg-white text-brand-primary shadow-sm'
                    : 'text-gray-600 hover:text-brand-primary'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Details</span>
              </button>
              <button
                onClick={() => setFormTab('modules')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-all ${
                  formTab === 'modules'
                    ? 'bg-white text-brand-primary shadow-sm'
                    : 'text-gray-600 hover:text-brand-primary'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>Module Access</span>
              </button>
              <button
                onClick={() => setFormTab('working-hours')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-all ${
                  formTab === 'working-hours'
                    ? 'bg-white text-brand-primary shadow-sm'
                    : 'text-gray-600 hover:text-brand-primary'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Working Hours</span>
              </button>
            </div>

            {/* Details Tab */}
            {formTab === 'details' && (
              <div className="space-y-6">
                {/* Member Header */}
                <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-brand-primary text-white text-xl font-bold">
                      {selectedMember.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-brand-text mb-2">{selectedMember.name}</h3>
                    <div className="flex items-center space-x-3 mb-2">
                      <Badge className={roleColors[selectedMember.role]}>{selectedMember.role}</Badge>
                      <Badge variant="outline" className={departmentColors[selectedMember.department]}>
                        {selectedMember.department}
                      </Badge>
                      <Badge className={statusColors[selectedMember.status]}>{selectedMember.status}</Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      Member ID: {selectedMember.memberId} • Joined: {selectedMember.joinedOn}
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h4 className="text-lg font-semibold text-brand-text mb-3">Contact Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="text-sm text-gray-600">Email</div>
                        <div className="font-medium">{selectedMember.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="text-sm text-gray-600">Phone</div>
                        <div className="font-medium">{selectedMember.phone}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Role & Department */}
                <div>
                  <h4 className="text-lg font-semibold text-brand-text mb-3">Role & Department</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Role</div>
                      <Badge className={roleColors[selectedMember.role]}>{selectedMember.role}</Badge>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Department</div>
                      <Badge variant="outline" className={departmentColors[selectedMember.department]}>
                        {selectedMember.department}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Permissions */}
                <div>
                  <h4 className="text-lg font-semibold text-brand-text mb-3">Permissions</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedMember.permissions.map((permission: string) => (
                      <Badge key={permission} variant="outline" className="text-xs">
                        {permission}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Activity */}
                <div>
                  <h4 className="text-lg font-semibold text-brand-text mb-3">Activity</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Last Login</div>
                      <div className="font-medium">{selectedMember.lastLogin}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Join Date</div>
                      <div className="font-medium">{selectedMember.joinedOn}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modules Tab - Read Only View */}
            {formTab === 'modules' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">View current module access permissions</p>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b-2 border-gray-200 bg-gray-50">
                          <th className="text-left py-3 px-4 font-semibold text-brand-text">Module</th>
                          <th className="text-center py-3 px-4 font-semibold text-brand-text">Read</th>
                          <th className="text-center py-3 px-4 font-semibold text-brand-text">Insert</th>
                          <th className="text-center py-3 px-4 font-semibold text-brand-text">Update</th>
                          <th className="text-center py-3 px-4 font-semibold text-brand-text">Delete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(modulePermissions).map(([module, perms]) => (
                          <tr key={module} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium capitalize">{module.replace(/_/g, ' ')}</td>
                            <td className="py-3 px-4 text-center">
                              {perms.read ? (
                                <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                              ) : (
                                <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {perms.insert ? (
                                <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                              ) : (
                                <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {perms.update ? (
                                <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                              ) : (
                                <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {perms.delete ? (
                                <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                              ) : (
                                <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Working Hours Tab - Read Only View */}
            {formTab === 'working-hours' && (
              <UserWorkingHoursSettings userId={selectedMember?.id} />
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-6">
              <Button
                variant="outline"
                onClick={() => { setView('list'); setSelectedMember(null); }}
              >
                Close
              </Button>
              <Button
                onClick={() => handleEditClick(selectedMember)}
                className="bg-brand-primary hover:bg-brand-primary/90"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Member
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Team Member Modal - Desktop Only */}
      {/* View Modal - REMOVED - Now using unified view state */}
      {false && (
        <div className="hidden md:flex fixed inset-0 bg-black bg-opacity-50 items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-brand-text">Team Member Details</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowViewModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
              <button
                onClick={() => setViewModalTab('details')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-all ${
                  viewModalTab === 'details'
                    ? 'bg-white text-brand-primary shadow-sm'
                    : 'text-gray-600 hover:text-brand-primary'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Details</span>
              </button>
              <button
                onClick={() => setViewModalTab('modules')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-all ${
                  viewModalTab === 'modules'
                    ? 'bg-white text-brand-primary shadow-sm'
                    : 'text-gray-600 hover:text-brand-primary'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>Module Access</span>
              </button>
            </div>

            {viewModalTab === 'details' && (
            <div className="space-y-6">
              {/* Member Header */}
              <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-brand-primary text-white text-xl font-bold">
                    {selectedMember.avatar}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-brand-text mb-2">{selectedMember.name}</h3>
                  <div className="flex items-center space-x-3 mb-2">
                    <Badge className={roleColors[selectedMember.role]}>{selectedMember.role}</Badge>
                    <Badge variant="outline" className={departmentColors[selectedMember.department]}>
                      {selectedMember.department}
                    </Badge>
                    <Badge className={statusColors[selectedMember.status]}>{selectedMember.status}</Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    Member ID: {selectedMember.memberId} • Joined: {selectedMember.joinedOn}
                  </div>
                </div>
              </div>
              
              {/* Contact Information */}
              <div>
                <h4 className="text-lg font-semibold text-brand-text mb-3">Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-sm text-gray-600">Email</div>
                      <div className="font-medium">{selectedMember.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-sm text-gray-600">Phone</div>
                      <div className="font-medium">{selectedMember.phone}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Role & Department */}
              <div>
                <h4 className="text-lg font-semibold text-brand-text mb-3">Role & Department</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Role</div>
                    <Badge className={roleColors[selectedMember.role]}>{selectedMember.role}</Badge>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Department</div>
                    <Badge variant="outline" className={departmentColors[selectedMember.department]}>
                      {selectedMember.department}
                    </Badge>
                  </div>
                </div>
              </div>
              
              {/* Permissions */}
              <div>
                <h4 className="text-lg font-semibold text-brand-text mb-3">Permissions</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedMember.permissions.map((permission: string) => (
                    <Badge key={permission} variant="outline" className="text-xs">
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {/* Activity */}
              <div>
                <h4 className="text-lg font-semibold text-brand-text mb-3">Activity</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Last Login</div>
                    <div className="font-medium">{selectedMember.lastLogin}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Join Date</div>
                    <div className="font-medium">{selectedMember.joinedOn}</div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {viewModalTab === 'modules' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Manage granular access permissions for each module</p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-brand-text">Module</th>
                        <th className="text-center py-3 px-4 font-semibold text-brand-text">Read</th>
                        <th className="text-center py-3 px-4 font-semibold text-brand-text">Insert</th>
                        <th className="text-center py-3 px-4 font-semibold text-brand-text">Update</th>
                        <th className="text-center py-3 px-4 font-semibold text-brand-text">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(modulePermissions).map(([module, perms]) => (
                        <tr key={module} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium capitalize">{module.replace('_', ' ')}</td>
                          <td className="py-3 px-4 text-center">
                            {perms.read ? (
                              <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                            ) : (
                              <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {perms.insert ? (
                              <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                            ) : (
                              <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {perms.update ? (
                              <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                            ) : (
                              <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {perms.delete ? (
                              <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                            ) : (
                              <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            )}

            <div className="flex items-center space-x-3 mt-6">
              <Button onClick={() => { setShowViewModal(false); handleEditClick(selectedMember); }}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Member
              </Button>
              <Button variant="outline" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Team Member Modal - REMOVED - Now using unified form */}
      {false && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg p-4 md:p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h2 className="text-lg md:text-2xl font-bold text-brand-text">Edit Team Member</h2>
              <Button variant="ghost" size="sm" onClick={() => { setShowEditModal(false); resetForm(); setEditModalTab('details'); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit mb-4 md:mb-6">
              <button
                onClick={() => setEditModalTab('details')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-all ${
                  editModalTab === 'details'
                    ? 'bg-white text-brand-primary shadow-sm'
                    : 'text-gray-600 hover:text-brand-primary'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Details</span>
              </button>
              <button
                onClick={() => setEditModalTab('modules')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-all ${
                  editModalTab === 'modules'
                    ? 'bg-white text-brand-primary shadow-sm'
                    : 'text-gray-600 hover:text-brand-primary'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>Module Access</span>
              </button>
            </div>

            {editModalTab === 'details' && (
            <div className="space-y-4">
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
                  <Input
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
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter phone number"
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                  <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Super Admin">Super Admin</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Manager">Manager</SelectItem>
                      <SelectItem value="Team Lead">Team Lead</SelectItem>
                      <SelectItem value="Team Member">Team Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department *</label>
                  <Select value={formData.department} onValueChange={(value) => setFormData(prev => ({ ...prev, department: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Management">Management</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="Content">Content</SelectItem>
                      <SelectItem value="Support">Support</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Development">Development</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            )}

            {editModalTab === 'modules' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Configure granular access permissions for each module</p>
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <table className="w-full border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b-2 border-gray-200 bg-gray-50">
                        <th className="text-left py-2 md:py-3 px-2 md:px-4 font-semibold text-brand-text text-sm">Module</th>
                        <th className="text-center py-2 md:py-3 px-2 md:px-4 font-semibold text-brand-text">
                          <div className="flex flex-col items-center">
                            <span className="text-xs md:text-sm">Read</span>
                            <span className="text-xs font-normal text-gray-500 hidden md:block">View</span>
                          </div>
                        </th>
                        <th className="text-center py-2 md:py-3 px-2 md:px-4 font-semibold text-brand-text">
                          <div className="flex flex-col items-center">
                            <span className="text-xs md:text-sm">Insert</span>
                            <span className="text-xs font-normal text-gray-500 hidden md:block">Create</span>
                          </div>
                        </th>
                        <th className="text-center py-2 md:py-3 px-2 md:px-4 font-semibold text-brand-text">
                          <div className="flex flex-col items-center">
                            <span className="text-xs md:text-sm">Update</span>
                            <span className="text-xs font-normal text-gray-500 hidden md:block">Modify</span>
                          </div>
                        </th>
                        <th className="text-center py-2 md:py-3 px-2 md:px-4 font-semibold text-brand-text">
                          <div className="flex flex-col items-center">
                            <span className="text-xs md:text-sm">Delete</span>
                            <span className="text-xs font-normal text-gray-500 hidden md:block">Remove</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(modulePermissions).map(([module, perms]) => (
                        <tr key={module} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 md:py-4 px-2 md:px-4">
                            <div className="flex items-center space-x-2 md:space-x-3">
                              <Shield className="w-4 h-4 md:w-5 md:h-5 text-brand-primary" />
                              <span className="font-medium capitalize text-sm md:text-base">{module.replace(/_/g, ' ')}</span>
                            </div>
                          </td>
                          <td className="py-3 md:py-4 px-2 md:px-4 text-center">
                            <input
                              type="checkbox"
                              checked={perms.read}
                              onChange={() => toggleModulePermission(module, 'read')}
                              className="w-4 h-4 md:w-5 md:h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 md:py-4 px-2 md:px-4 text-center">
                            <input
                              type="checkbox"
                              checked={perms.insert}
                              onChange={() => toggleModulePermission(module, 'insert')}
                              className="w-4 h-4 md:w-5 md:h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 md:py-4 px-2 md:px-4 text-center">
                            <input
                              type="checkbox"
                              checked={perms.update}
                              onChange={() => toggleModulePermission(module, 'update')}
                              className="w-4 h-4 md:w-5 md:h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 md:py-4 px-2 md:px-4 text-center">
                            <input
                              type="checkbox"
                              checked={perms.delete}
                              onChange={() => toggleModulePermission(module, 'delete')}
                              className="w-4 h-4 md:w-5 md:h-5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-gray-50 rounded-lg gap-3">
                <div className="text-sm text-gray-600">
                  <strong>Tip:</strong> Grant only the minimum permissions required for the user's role.
                </div>
                <div className="flex items-center space-x-2 w-full md:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allEnabled = Object.fromEntries(
                        Object.keys(modulePermissions).map(key => [
                          key,
                          { read: true, insert: true, update: true, delete: true }
                        ])
                      )
                      setModulePermissions(allEnabled)
                    }}
                  >
                    <Unlock className="w-4 h-4 mr-2" />
                    Grant All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allDisabled = Object.fromEntries(
                        Object.keys(modulePermissions).map(key => [
                          key,
                          { read: false, insert: false, update: false, delete: false }
                        ])
                      )
                      setModulePermissions(allDisabled)
                    }}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Revoke All
                  </Button>
                </div>
              </div>
            </div>
            )}

            <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-3 mt-6">
              <Button
                onClick={handleEditMember}
                disabled={!formData.name || !formData.email || !formData.phone || !formData.role || !formData.department}
                className="w-full md:w-auto"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => { setShowEditModal(false); resetForm(); setEditModalTab('details'); }} className="w-full md:w-auto">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Module Access Management Modal - REMOVED - Now using unified view state */}
      {false && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg p-4 md:p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div>
                <h2 className="text-lg md:text-2xl font-bold text-brand-text">Manage Module Access</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedMember.name} - {selectedMember.role}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowModuleAccessModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Lock className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-blue-900">Granular Access Control</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Configure specific READ, INSERT, UPDATE, and DELETE permissions for each module. Toggle checkboxes to grant or revoke access.
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 font-semibold text-brand-text">Module</th>
                      <th className="text-center py-3 px-4 font-semibold text-brand-text">
                        <div className="flex flex-col items-center">
                          <span>Read</span>
                          <span className="text-xs font-normal text-gray-500">View data</span>
                        </div>
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-brand-text">
                        <div className="flex flex-col items-center">
                          <span>Insert</span>
                          <span className="text-xs font-normal text-gray-500">Create new</span>
                        </div>
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-brand-text">
                        <div className="flex flex-col items-center">
                          <span>Update</span>
                          <span className="text-xs font-normal text-gray-500">Modify existing</span>
                        </div>
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-brand-text">
                        <div className="flex flex-col items-center">
                          <span>Delete</span>
                          <span className="text-xs font-normal text-gray-500">Remove data</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(modulePermissions).map(([module, perms]) => (
                      <tr key={module} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-3">
                            <Shield className="w-5 h-5 text-brand-primary" />
                            <span className="font-medium capitalize">{module.replace(/_/g, ' ')}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={perms.read}
                            onChange={() => toggleModulePermission(module, 'read')}
                            className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={perms.insert}
                            onChange={() => toggleModulePermission(module, 'insert')}
                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={perms.update}
                            onChange={() => toggleModulePermission(module, 'update')}
                            className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={perms.delete}
                            onChange={() => toggleModulePermission(module, 'delete')}
                            className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-gray-50 rounded-lg gap-3">
                <div className="text-sm text-gray-600">
                  <strong>Tip:</strong> Grant only the minimum permissions required for the user's role.
                </div>
                <div className="flex items-center space-x-2 w-full md:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allEnabled = Object.fromEntries(
                        Object.keys(modulePermissions).map(key => [
                          key,
                          { read: true, insert: true, update: true, delete: true }
                        ])
                      )
                      setModulePermissions(allEnabled)
                    }}
                  >
                    <Unlock className="w-4 h-4 mr-2" />
                    Grant All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allDisabled = Object.fromEntries(
                        Object.keys(modulePermissions).map(key => [
                          key,
                          { read: false, insert: false, update: false, delete: false }
                        ])
                      )
                      setModulePermissions(allDisabled)
                    }}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Revoke All
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-3 mt-6">
              <Button onClick={handleSaveModuleAccess} className="w-full md:w-auto">
                <Save className="w-4 h-4 mr-2" />
                Save Permissions
              </Button>
              <Button variant="outline" onClick={() => setShowModuleAccessModal(false)} className="w-full md:w-auto">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Mobile View - App-like Experience */}
      <div className="md:hidden min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50">
        {/* Mobile Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-6 shadow-lg">
          <h1 className="text-2xl font-bold mb-1">Team</h1>
          <p className="text-cyan-100 text-sm">{totalMembers} members • {departments} departments</p>
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
                <span className="text-2xl font-bold text-cyan-600">{totalMembers}</span>
              </div>
              <p className="text-xs text-gray-600 font-medium">Total</p>
            </motion.div>

            <motion.div
              whileTap={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-4 shadow-lg border border-green-100"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="bg-green-100 p-2 rounded-xl">
                  <Shield className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-2xl font-bold text-green-600">{activeMembers}</span>
              </div>
              <p className="text-xs text-gray-600 font-medium">Active</p>
            </motion.div>

            <motion.div
              whileTap={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-4 shadow-lg border border-purple-100"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="bg-purple-100 p-2 rounded-xl">
                  <Settings className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-2xl font-bold text-purple-600">{departments}</span>
              </div>
              <p className="text-xs text-gray-600 font-medium">Departments</p>
            </motion.div>

            <motion.div
              whileTap={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-4 shadow-lg border border-amber-100"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="bg-amber-100 p-2 rounded-xl">
                  <Crown className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-2xl font-bold text-amber-600">{adminCount}</span>
              </div>
              <p className="text-xs text-gray-600 font-medium">Admins</p>
            </motion.div>
          </div>
        </div>

        {/* Add Member Button */}
        <div className="px-4 mb-4">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setView('add')}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl py-4 px-6 shadow-lg flex items-center justify-center gap-3 font-semibold"
          >
            <UserPlus className="w-5 h-5" />
            Add Team Member
          </motion.button>
        </div>

        {/* Team Members List */}
        <div className="px-4 pb-20">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Team Directory</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No team members yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMembers.map((member) => (
                <motion.div
                  key={member.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleViewMember(member)}
                  className="bg-white rounded-2xl p-4 shadow-md active:shadow-lg transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white text-lg font-bold">
                          {member.avatar}
                        </div>
                        <div className="absolute -bottom-1 -right-1 text-xl">
                          {getRoleEmoji(member.role)}
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{member.name}</p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Badge className={roleColors[member.role] || 'bg-gray-100 text-gray-800'}>
                        {member.role}
                      </Badge>
                      <Badge variant="outline" className={departmentColors[member.department] || 'bg-gray-50 text-gray-700'}>
                        {member.department}
                      </Badge>
                    </div>
                    <Badge className={statusColors[member.status]}>
                      {member.status}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Create Member Page */}
      <AnimatePresence>
        {(view === 'add' || view === 'edit') && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="md:hidden fixed inset-0 bg-white z-[60] overflow-y-auto"
          >
            <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-6 sticky top-0 z-10">
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => { setView('list'); resetForm(); }}>
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold">
                  {view === 'add' ? 'Add Team Member' : 'Edit Team Member'}
                </h2>
              </div>

              {/* Top Tab Navigation */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFormTab('details')}
                  className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${
                    formTab === 'details'
                      ? 'bg-white text-cyan-600 shadow-lg'
                      : 'bg-cyan-700/50 text-white'
                  }`}
                >
                  <User className="w-4 h-4 inline mr-2" />
                  Details
                </button>
                <button
                  onClick={() => setFormTab('modules')}
                  className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${
                    formTab === 'modules'
                      ? 'bg-white text-cyan-600 shadow-lg'
                      : 'bg-cyan-700/50 text-white'
                  }`}
                >
                  <Lock className="w-4 h-4 inline mr-2" />
                  Permissions
                </button>
              </div>
            </div>

            <div className="p-4 pb-24">
              {formTab === 'details' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl shadow-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-4">Member Information</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Enter full name"
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="Enter email address"
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                        <Input
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="Enter phone number"
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                        <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent className="z-[70]">
                            <SelectItem value="Super Admin">Super Admin</SelectItem>
                            <SelectItem value="Sales Manager">Sales Manager</SelectItem>
                            <SelectItem value="Content Manager">Content Manager</SelectItem>
                            <SelectItem value="Support Agent">Support Agent</SelectItem>
                            <SelectItem value="Marketing Specialist">Marketing Specialist</SelectItem>
                            <SelectItem value="Developer">Developer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Department *</label>
                        <Select value={formData.department} onValueChange={(value) => setFormData(prev => ({ ...prev, department: value }))}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent className="z-[70]">
                            <SelectItem value="Management">Management</SelectItem>
                            <SelectItem value="Sales">Sales</SelectItem>
                            <SelectItem value="Content">Content</SelectItem>
                            <SelectItem value="Support">Support</SelectItem>
                            <SelectItem value="Marketing">Marketing</SelectItem>
                            <SelectItem value="Development">Development</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent className="z-[70]">
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                            <SelectItem value="Suspended">Suspended</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {formTab === 'modules' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl shadow-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-2">Module Permissions</h3>
                    <p className="text-sm text-gray-600 mb-4">Configure access for each module</p>

                    <div className="space-y-3">
                      {Object.entries(modulePermissions).map(([module, perms]) => (
                        <div key={module} className="border border-gray-200 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Shield className="w-5 h-5 text-cyan-600" />
                              <span className="font-medium capitalize text-sm">{module.replace(/_/g, ' ')}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <label className="flex items-center gap-2 p-2 bg-green-50 rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perms.read}
                                onChange={() => toggleModulePermission(module, 'read')}
                                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                              <span className="text-sm text-green-700">Read</span>
                            </label>

                            <label className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perms.insert}
                                onChange={() => toggleModulePermission(module, 'insert')}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-blue-700">Insert</span>
                            </label>

                            <label className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perms.update}
                                onChange={() => toggleModulePermission(module, 'update')}
                                className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                              />
                              <span className="text-sm text-orange-700">Update</span>
                            </label>

                            <label className="flex items-center gap-2 p-2 bg-red-50 rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perms.delete}
                                onChange={() => toggleModulePermission(module, 'delete')}
                                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                              />
                              <span className="text-sm text-red-700">Delete</span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => {
                          const allEnabled = Object.fromEntries(
                            Object.keys(modulePermissions).map(key => [
                              key,
                              { read: true, insert: true, update: true, delete: true }
                            ])
                          )
                          setModulePermissions(allEnabled)
                        }}
                        className="flex-1 bg-green-100 text-green-700 py-2 px-3 rounded-lg text-sm font-medium"
                      >
                        <Unlock className="w-4 h-4 inline mr-1" />
                        Grant All
                      </button>
                      <button
                        onClick={() => {
                          const allDisabled = Object.fromEntries(
                            Object.keys(modulePermissions).map(key => [
                              key,
                              { read: false, insert: false, update: false, delete: false }
                            ])
                          )
                          setModulePermissions(allDisabled)
                        }}
                        className="flex-1 bg-red-100 text-red-700 py-2 px-3 rounded-lg text-sm font-medium"
                      >
                        <Lock className="w-4 h-4 inline mr-1" />
                        Revoke All
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Action Button */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-20">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={view === 'add' ? handleCreateMember : handleEditMember}
                disabled={!formData.name || !formData.email || !formData.phone || !formData.role || !formData.department}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl py-4 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5 inline mr-2" />
                {view === 'add' ? 'Add Team Member' : 'Update Team Member'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Edit Member Page - REMOVED - Now using unified form above */}
      <AnimatePresence>
        {false && showEditModal && selectedMember && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="md:hidden fixed inset-0 bg-white z-[60] overflow-y-auto"
          >
            <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-6 sticky top-0 z-10">
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => { setShowEditModal(false); resetForm(); setEditModalTab('details'); }}>
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold">Edit Team Member</h2>
              </div>

              {/* Top Tab Navigation */}
              <div className="flex gap-2">
                <button
                  onClick={() => setEditModalTab('details')}
                  className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${
                    editModalTab === 'details'
                      ? 'bg-white text-cyan-600 shadow-lg'
                      : 'bg-cyan-700/50 text-white'
                  }`}
                >
                  <User className="w-4 h-4 inline mr-2" />
                  Details
                </button>
                <button
                  onClick={() => setEditModalTab('modules')}
                  className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${
                    editModalTab === 'modules'
                      ? 'bg-white text-cyan-600 shadow-lg'
                      : 'bg-cyan-700/50 text-white'
                  }`}
                >
                  <Lock className="w-4 h-4 inline mr-2" />
                  Permissions
                </button>
              </div>
            </div>

            <div className="p-4 pb-24">
              {editModalTab === 'details' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl shadow-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-4">Member Information</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Enter full name"
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="Enter email address"
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                        <Input
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="Enter phone number"
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                        <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent className="z-[70]">
                            <SelectItem value="Super Admin">Super Admin</SelectItem>
                            <SelectItem value="Sales Manager">Sales Manager</SelectItem>
                            <SelectItem value="Content Manager">Content Manager</SelectItem>
                            <SelectItem value="Support Agent">Support Agent</SelectItem>
                            <SelectItem value="Marketing Specialist">Marketing Specialist</SelectItem>
                            <SelectItem value="Developer">Developer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Department *</label>
                        <Select value={formData.department} onValueChange={(value) => setFormData(prev => ({ ...prev, department: value }))}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent className="z-[70]">
                            <SelectItem value="Management">Management</SelectItem>
                            <SelectItem value="Sales">Sales</SelectItem>
                            <SelectItem value="Content">Content</SelectItem>
                            <SelectItem value="Support">Support</SelectItem>
                            <SelectItem value="Marketing">Marketing</SelectItem>
                            <SelectItem value="Development">Development</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent className="z-[70]">
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                            <SelectItem value="Suspended">Suspended</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {editModalTab === 'modules' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl shadow-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-2">Module Permissions</h3>
                    <p className="text-sm text-gray-600 mb-4">Configure access for each module</p>

                    <div className="space-y-3">
                      {Object.entries(modulePermissions).map(([module, perms]) => (
                        <div key={module} className="border border-gray-200 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Shield className="w-5 h-5 text-cyan-600" />
                              <span className="font-medium capitalize text-sm">{module.replace(/_/g, ' ')}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <label className="flex items-center gap-2 p-2 bg-green-50 rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perms.read}
                                onChange={() => toggleModulePermission(module, 'read')}
                                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                              <span className="text-sm text-green-700">Read</span>
                            </label>

                            <label className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perms.insert}
                                onChange={() => toggleModulePermission(module, 'insert')}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-blue-700">Insert</span>
                            </label>

                            <label className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perms.update}
                                onChange={() => toggleModulePermission(module, 'update')}
                                className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                              />
                              <span className="text-sm text-orange-700">Update</span>
                            </label>

                            <label className="flex items-center gap-2 p-2 bg-red-50 rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perms.delete}
                                onChange={() => toggleModulePermission(module, 'delete')}
                                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                              />
                              <span className="text-sm text-red-700">Delete</span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => {
                          const allEnabled = Object.fromEntries(
                            Object.keys(modulePermissions).map(key => [
                              key,
                              { read: true, insert: true, update: true, delete: true }
                            ])
                          )
                          setModulePermissions(allEnabled)
                        }}
                        className="flex-1 bg-green-100 text-green-700 py-2 px-3 rounded-lg text-sm font-medium"
                      >
                        <Unlock className="w-4 h-4 inline mr-1" />
                        Grant All
                      </button>
                      <button
                        onClick={() => {
                          const allDisabled = Object.fromEntries(
                            Object.keys(modulePermissions).map(key => [
                              key,
                              { read: false, insert: false, update: false, delete: false }
                            ])
                          )
                          setModulePermissions(allDisabled)
                        }}
                        className="flex-1 bg-red-100 text-red-700 py-2 px-3 rounded-lg text-sm font-medium"
                      >
                        <Lock className="w-4 h-4 inline mr-1" />
                        Revoke All
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Action Button */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-20">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleEditMember}
                disabled={!formData.name || !formData.email || !formData.phone || !formData.role || !formData.department}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl py-4 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5 inline mr-2" />
                Save Changes
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Detail Modal */}
      {/* Mobile View Page */}
      <AnimatePresence>
        {view === 'view' && selectedMember && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="md:hidden fixed inset-0 bg-white z-[55] overflow-y-auto"
          >
            <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-6 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <button onClick={() => { setView('list'); setSelectedMember(null); }}>
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold">Team Member Details</h2>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="px-4 pt-4">
              <div className="flex bg-white rounded-xl shadow-md p-1">
                <button
                  onClick={() => setFormTab('details')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                    formTab === 'details'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white'
                      : 'text-gray-600'
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setFormTab('modules')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                    formTab === 'modules'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white'
                      : 'text-gray-600'
                  }`}
                >
                  Module Access
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {formTab === 'details' && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                      {selectedMember.avatar}
                    </div>
                    <div className="absolute -bottom-1 -right-1 text-3xl">
                      {getRoleEmoji(selectedMember.role)}
                    </div>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-800">{selectedMember.name}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge className={roleColors[selectedMember.role]}>
                        {selectedMember.role}
                      </Badge>
                      <Badge className={statusColors[selectedMember.status]}>
                        {selectedMember.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-xl">
                        <Mail className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-sm text-gray-600">Email</span>
                    </div>
                    <span className="text-sm font-medium text-gray-800">{selectedMember.email}</span>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-xl">
                        <Phone className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="text-sm text-gray-600">Phone</span>
                    </div>
                    <span className="text-sm font-medium text-gray-800">{selectedMember.phone}</span>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-100 p-2 rounded-xl">
                        <Settings className="w-4 h-4 text-purple-600" />
                      </div>
                      <span className="text-sm text-gray-600">Department</span>
                    </div>
                    <Badge variant="outline" className={departmentColors[selectedMember.department]}>
                      {selectedMember.department}
                    </Badge>
                  </div>

                  <div className="py-3 border-b">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-amber-100 p-2 rounded-xl">
                        <Shield className="w-4 h-4 text-amber-600" />
                      </div>
                      <span className="text-sm text-gray-600">Permissions</span>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-12">
                      {selectedMember.permissions && selectedMember.permissions.length > 0 ? (
                        selectedMember.permissions.map((permission: string) => (
                          <Badge key={permission} variant="outline" className="text-xs">
                            {permission}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">No permissions set</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-100 p-2 rounded-xl">
                        <User className="w-4 h-4 text-gray-600" />
                      </div>
                      <span className="text-sm text-gray-600">Member ID</span>
                    </div>
                    <span className="text-sm font-medium text-gray-800 font-mono">{selectedMember.memberId}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleEditClick(selectedMember)}
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl py-3 text-sm font-medium"
                  >
                    Edit Member
                  </motion.button>
                </div>
              </div>
              )}

              {formTab === 'modules' && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Module Access Permissions</h3>
                <p className="text-sm text-gray-600 mb-4">View current module access permissions for {selectedMember.name}</p>

                <div className="space-y-3">
                  {Object.entries(modulePermissions).map(([module, perms]) => (
                    <div key={module} className="border border-gray-200 rounded-xl p-4">
                      <h4 className="font-semibold text-gray-800 capitalize mb-3">{module.replace(/_/g, ' ')}</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Read</span>
                          {perms.read ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-300" />
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Insert</span>
                          {perms.insert ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-300" />
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Update</span>
                          {perms.update ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-300" />
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Delete</span>
                          {perms.delete ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-300" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}