import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Plus, Search, Edit, Trash2, Power, PowerOff, Clock, Activity, Filter, MoreVertical, Shield, MessageSquare, Copy } from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { KPICard } from '@/components/Common/KPICard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { formatDateTime } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

interface AIAgent {
  id: string
  name: string
  agent_type: string
  model: string
  system_prompt: string
  status: string
  channels: string[]
  created_at: string
  updated_at: string
  last_activity: string
  created_by: string
}

const statusColors: Record<string, string> = {
  'Active': 'bg-green-100 text-green-800',
  'Inactive': 'bg-gray-100 text-gray-800'
}

export function AIAgents() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchAgents()
  }, [])

  const fetchAgents = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAgents(data || [])
    } catch (error) {
      console.error('Error fetching agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this AI agent?')) return

    try {
      const { error } = await supabase
        .from('ai_agents')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchAgents()
    } catch (error) {
      console.error('Error deleting agent:', error)
      alert('Failed to delete agent')
    }
  }

  const handleToggleStatus = async (agent: AIAgent) => {
    try {
      const newStatus = agent.status === 'Active' ? 'Inactive' : 'Active'
      const { error } = await supabase
        .from('ai_agents')
        .update({ status: newStatus })
        .eq('id', agent.id)

      if (error) throw error
      fetchAgents()
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Failed to update status')
    }
  }

  const handleCopyAgentId = (agentId: string) => {
    navigator.clipboard.writeText(agentId)
      .then(() => {
        alert('Agent ID copied to clipboard!')
      })
      .catch((error) => {
        console.error('Failed to copy agent ID:', error)
        alert('Failed to copy agent ID')
      })
  }

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.model.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const activeAgents = agents.filter(a => a.status === 'Active').length
  const inactiveAgents = agents.filter(a => a.status === 'Inactive').length

  return (
    <div className="p-8">
      <PageHeader
        title="AI Agents"
        subtitle="Manage your intelligent CRM assistants"
        icon={Bot}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <KPICard
          title="Total Agents"
          value={agents.length}
          icon={Bot}
          trend={{ value: 0, isPositive: true }}
          color="blue"
        />
        <KPICard
          title="Active Agents"
          value={activeAgents}
          icon={Power}
          trend={{ value: 0, isPositive: true }}
          color="green"
        />
        <KPICard
          title="Inactive Agents"
          value={inactiveAgents}
          icon={PowerOff}
          trend={{ value: 0, isPositive: false }}
          color="gray"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4 flex-1 w-full">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search agents by name or model..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => navigate('/ai-agents/add')} className="w-full md:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add New Agent
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading agents...</p>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No AI agents found</p>
              <Button onClick={() => navigate('/ai-agents/add')} className="mt-4">
                Create your first agent
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredAgents.map((agent) => (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="relative hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="absolute top-4 right-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => handleToggleStatus(agent)}>
                                {agent.status === 'Active' ? (
                                  <>
                                    <PowerOff className="mr-2 h-4 w-4" />
                                    <span>Deactivate</span>
                                  </>
                                ) : (
                                  <>
                                    <Power className="mr-2 h-4 w-4" />
                                    <span>Activate</span>
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/ai-agents/edit/${agent.id}`)}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Edit Agent</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/ai-agents/permissions/${agent.id}`)}>
                                <Shield className="mr-2 h-4 w-4" />
                                <span>Module Permissions</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCopyAgentId(agent.id)}>
                                <Copy className="mr-2 h-4 w-4" />
                                <span>Copy Agent ID</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(agent.id)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete Agent</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex items-start space-x-4 mb-4">
                          <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                            <Bot className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 truncate mb-1">
                              {agent.name}
                            </h3>
                            <div className="flex gap-2 flex-wrap">
                              <Badge className={statusColors[agent.status]}>
                                {agent.status}
                              </Badge>
                              <Badge
                                className={agent.agent_type === 'FRONTEND'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                                }
                              >
                                {agent.agent_type === 'FRONTEND' ? 'FRONTEND' : 'BACKEND'}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center text-sm">
                            <Activity className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                            <span className="text-gray-600">Model:</span>
                            <span className="ml-2 text-gray-900 font-medium">{agent.model}</span>
                          </div>

                          <div className="flex items-start text-sm">
                            <Shield className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <span className="text-gray-600">Channels:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {agent.channels && agent.channels.length > 0 ? (
                                  agent.channels.map((channel, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {channel}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-gray-400 text-xs">No channels</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center text-sm text-gray-500 pt-3 border-t">
                            <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
                            <span className="truncate">
                              Last active: {formatDateTime(agent.last_activity)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t">
                          <Button
                            onClick={() => navigate(`/ai-agents/chat/${agent.id}`)}
                            className="w-full"
                            variant="default"
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Start Chat
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
