import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  TrendingUp,
  Target,
  PhoneCall,
  UserCheck,
  XCircle,
  Clock,
  Download,
  Calendar,
  DollarSign,
  Percent,
  Award
} from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import {
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  FunnelChart,
  Funnel
} from 'recharts'

interface LeadMetrics {
  totalLeads: number
  newLeads: number
  contactedLeads: number
  wonLeads: number
  lostLeads: number
  conversionRate: number
  contactRate: number
  averageLeadScore: number
  previousTotalLeads: number
  previousWonLeads: number
}

interface LeadByStage {
  stage: string
  count: number
  value: number
}

interface LeadBySource {
  source: string
  count: number
  converted: number
  conversion_rate: number
}

interface LeadByInterest {
  interest: string
  count: number
}

interface OwnerPerformance {
  owner: string
  total_leads: number
  contacted: number
  won: number
  lost: number
  conversion_rate: number
  avg_lead_score: number
}

interface DailyLeadTrend {
  date: string
  new_leads: number
  won_leads: number
}

interface Pipeline {
  id: string
  pipeline_id: string
  name: string
  entity_type: string
  is_default: boolean
}

interface PipelineStage {
  id: string
  name: string
  color: string
  display_order: number
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

const INTEREST_COLORS: Record<string, string> = {
  'Hot': '#ef4444',
  'Warm': '#f59e0b',
  'Cold': '#3b82f6'
}

const getColorFromBgClass = (bgColorClass: string): string => {
  const colorMap: Record<string, string> = {
    'bg-blue-100': '#3b82f6',
    'bg-yellow-100': '#f59e0b',
    'bg-orange-100': '#f97316',
    'bg-purple-100': '#8b5cf6',
    'bg-red-100': '#ef4444',
    'bg-green-100': '#22c55e',
    'bg-gray-100': '#94a3b8',
    'bg-pink-100': '#ec4899',
    'bg-indigo-100': '#6366f1',
    'bg-teal-100': '#14b8a6',
    'bg-cyan-100': '#06b6d4',
    'bg-lime-100': '#84cc16'
  }
  return colorMap[bgColorClass] || '#3b82f6'
}

export function LeadsMIS() {
  const [metrics, setMetrics] = useState<LeadMetrics>({
    totalLeads: 0,
    newLeads: 0,
    contactedLeads: 0,
    wonLeads: 0,
    lostLeads: 0,
    conversionRate: 0,
    contactRate: 0,
    averageLeadScore: 0,
    previousTotalLeads: 0,
    previousWonLeads: 0
  })
  const [leadsByStage, setLeadsByStage] = useState<LeadByStage[]>([])
  const [leadsBySource, setLeadsBySource] = useState<LeadBySource[]>([])
  const [leadsByInterest, setLeadsByInterest] = useState<LeadByInterest[]>([])
  const [ownerPerformance, setOwnerPerformance] = useState<OwnerPerformance[]>([])
  const [dailyTrends, setDailyTrends] = useState<DailyLeadTrend[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [pipelineFilter, setPipelineFilter] = useState<string>('')
  const [pipelineStages, setPipelineStages] = useState<Record<string, PipelineStage[]>>({})
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('thisMonth')

  useEffect(() => {
    fetchPipelines()
  }, [])

  useEffect(() => {
    if (pipelineFilter) {
      fetchLeadsData()
    }
  }, [dateRange, pipelineFilter])

  const getDateRange = () => {
    const now = new Date()
    const start = new Date()
    const previousStart = new Date()
    const previousEnd = new Date()

    switch (dateRange) {
      case 'today':
        start.setHours(0, 0, 0, 0)
        previousStart.setDate(start.getDate() - 1)
        previousStart.setHours(0, 0, 0, 0)
        previousEnd.setDate(previousStart.getDate() + 1)
        break
      case 'thisWeek':
        const dayOfWeek = start.getDay()
        start.setDate(start.getDate() - dayOfWeek)
        start.setHours(0, 0, 0, 0)
        previousStart.setDate(start.getDate() - 7)
        previousEnd.setDate(previousStart.getDate() + 7)
        break
      case 'thisMonth':
        start.setDate(1)
        start.setHours(0, 0, 0, 0)
        previousStart.setMonth(start.getMonth() - 1)
        previousStart.setDate(1)
        previousEnd.setMonth(previousStart.getMonth() + 1)
        previousEnd.setDate(0)
        break
      case 'thisQuarter':
        const quarter = Math.floor(start.getMonth() / 3)
        start.setMonth(quarter * 3, 1)
        start.setHours(0, 0, 0, 0)
        previousStart.setMonth(start.getMonth() - 3)
        previousEnd.setMonth(previousStart.getMonth() + 3)
        previousEnd.setDate(0)
        break
      case 'thisYear':
        start.setMonth(0, 1)
        start.setHours(0, 0, 0, 0)
        previousStart.setFullYear(start.getFullYear() - 1)
        previousStart.setMonth(0, 1)
        previousEnd.setFullYear(previousStart.getFullYear() + 1)
        previousEnd.setMonth(0, 0)
        break
      default:
        start.setDate(1)
        start.setHours(0, 0, 0, 0)
        previousStart.setMonth(start.getMonth() - 1)
        previousStart.setDate(1)
        previousEnd.setMonth(previousStart.getMonth() + 1)
        previousEnd.setDate(0)
    }

    return {
      start: start.toISOString(),
      end: now.toISOString(),
      previousStart: previousStart.toISOString(),
      previousEnd: previousEnd.toISOString()
    }
  }

  const fetchPipelines = async () => {
    try {
      const { data: pipelinesData, error: pipelinesError } = await supabase
        .from('pipelines')
        .select('id, pipeline_id, name, entity_type, is_default')
        .eq('entity_type', 'lead')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (pipelinesError) throw pipelinesError

      console.log('Fetched pipelines:', pipelinesData)
      setPipelines(pipelinesData || [])

      const stagesMap: Record<string, PipelineStage[]> = {}
      for (const pipeline of (pipelinesData || [])) {
        const { data: stagesData } = await supabase
          .from('pipeline_stages')
          .select('id, name, color, display_order')
          .eq('pipeline_id', pipeline.id)
          .eq('is_active', true)
          .order('display_order', { ascending: true })

        if (stagesData) {
          stagesMap[pipeline.id] = stagesData
          console.log(`Stages for pipeline ${pipeline.name}:`, stagesData)
        }
      }
      setPipelineStages(stagesMap)

      const defaultPipeline = pipelinesData?.find(p => p.is_default) || pipelinesData?.[0]
      if (defaultPipeline) {
        console.log('Setting default pipeline:', defaultPipeline.name, defaultPipeline.id)
        setPipelineFilter(defaultPipeline.id)
      }
    } catch (error) {
      console.error('Error fetching pipelines:', error)
    }
  }

  const fetchLeadsData = async () => {
    try {
      setLoading(true)
      const { start, end, previousStart, previousEnd } = getDateRange()

      console.log('Fetching leads for pipeline:', pipelineFilter)
      console.log('Date range:', { start, end })

      const [leadsRes, previousLeadsRes] = await Promise.all([
        supabase
          .from('leads')
          .select('*')
          .eq('pipeline_id', pipelineFilter)
          .gte('created_at', start)
          .lte('created_at', end),

        supabase
          .from('leads')
          .select('stage')
          .eq('pipeline_id', pipelineFilter)
          .gte('created_at', previousStart)
          .lte('created_at', previousEnd)
      ])

      console.log('Leads response:', leadsRes)
      console.log('Leads count:', leadsRes.data?.length)

      if (leadsRes.error) {
        console.error('Error fetching leads:', leadsRes.error)
        throw leadsRes.error
      }

      const allLeads = leadsRes.data || []
      const previousLeads = previousLeadsRes.data || []

      console.log('Processing', allLeads.length, 'leads')

      // Get the first stage name from pipeline stages (typically "New")
      const firstStageName = pipelineStages[pipelineFilter]?.[0]?.name || 'New'
      const wonStageName = pipelineStages[pipelineFilter]?.find(s => s.name.toLowerCase().includes('won'))?.name || 'Won'
      const lostStageName = pipelineStages[pipelineFilter]?.find(s => s.name.toLowerCase().includes('lost'))?.name || 'Lost'

      const newLeads = allLeads.filter(l => l.stage === firstStageName)
      const contactedLeads = allLeads.filter(l => l.stage !== firstStageName)
      const wonLeads = allLeads.filter(l => l.stage === wonStageName)
      const lostLeads = allLeads.filter(l => l.stage === lostStageName)
      const previousWonLeads = previousLeads.filter(l => l.stage === wonStageName)

      const totalLeadScore = allLeads.reduce((sum, l) => sum + (Number(l.lead_score) || 0), 0)
      const avgLeadScore = allLeads.length > 0 ? totalLeadScore / allLeads.length : 0

      setMetrics({
        totalLeads: allLeads.length,
        newLeads: newLeads.length,
        contactedLeads: contactedLeads.length,
        wonLeads: wonLeads.length,
        lostLeads: lostLeads.length,
        conversionRate: allLeads.length > 0 ? (wonLeads.length / allLeads.length) * 100 : 0,
        contactRate: allLeads.length > 0 ? (contactedLeads.length / allLeads.length) * 100 : 0,
        averageLeadScore: avgLeadScore,
        previousTotalLeads: previousLeads.length,
        previousWonLeads: previousWonLeads.length
      })

      const stageCounts = allLeads.reduce((acc, lead) => {
        const stage = lead.stage || 'Unknown'
        if (!acc[stage]) {
          acc[stage] = { count: 0, value: 0 }
        }
        acc[stage].count += 1
        acc[stage].value = acc[stage].count
        return acc
      }, {} as Record<string, { count: number; value: number }>)

      const currentPipelineStages = pipelineStages[pipelineFilter] || []
      console.log('Current pipeline stages:', currentPipelineStages)
      const orderedStages = currentPipelineStages
        .sort((a, b) => a.display_order - b.display_order)
        .map(s => s.name)

      console.log('Ordered stage names:', orderedStages)
      console.log('Stage counts:', stageCounts)

      // Show all stages, even if count is 0
      const stageData = orderedStages.map(stage => ({
        stage,
        count: stageCounts[stage]?.count || 0,
        value: stageCounts[stage]?.value || 0
      }))

      console.log('Setting leadsByStage:', stageData)
      setLeadsByStage(stageData)

      const sourceCounts = allLeads.reduce((acc, lead) => {
        const source = lead.source || 'Unknown'
        if (!acc[source]) {
          acc[source] = { count: 0, converted: 0 }
        }
        acc[source].count += 1
        if (lead.stage === wonStageName) {
          acc[source].converted += 1
        }
        return acc
      }, {} as Record<string, { count: number; converted: number }>)

      setLeadsBySource(
        Object.entries(sourceCounts)
          .map(([source, data]) => ({
            source,
            count: data.count,
            converted: data.converted,
            conversion_rate: data.count > 0 ? (data.converted / data.count) * 100 : 0
          }))
          .sort((a, b) => b.count - a.count)
      )

      const interestCounts = allLeads.reduce((acc, lead) => {
        const interest = lead.interest || 'Unknown'
        acc[interest] = (acc[interest] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      setLeadsByInterest(
        Object.entries(interestCounts).map(([interest, count]) => ({
          interest,
          count
        }))
      )

      const ownerStats = allLeads.reduce((acc, lead) => {
        const owner = lead.owner || 'Unassigned'
        if (!acc[owner]) {
          acc[owner] = {
            total: 0,
            contacted: 0,
            won: 0,
            lost: 0,
            totalScore: 0
          }
        }
        acc[owner].total += 1
        acc[owner].totalScore += Number(lead.lead_score) || 0
        if (lead.stage !== firstStageName) {
          acc[owner].contacted += 1
        }
        if (lead.stage === wonStageName) {
          acc[owner].won += 1
        }
        if (lead.stage === lostStageName) {
          acc[owner].lost += 1
        }
        return acc
      }, {} as Record<string, any>)

      setOwnerPerformance(
        Object.entries(ownerStats)
          .map(([owner, stats]) => ({
            owner,
            total_leads: stats.total,
            contacted: stats.contacted,
            won: stats.won,
            lost: stats.lost,
            conversion_rate: stats.total > 0 ? (stats.won / stats.total) * 100 : 0,
            avg_lead_score: stats.total > 0 ? stats.totalScore / stats.total : 0
          }))
          .sort((a, b) => b.conversion_rate - a.conversion_rate)
      )

      const dailyStats = allLeads.reduce((acc, lead) => {
        const createdDate = new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        if (!acc[createdDate]) {
          acc[createdDate] = { new_leads: 0, won_leads: 0 }
        }
        acc[createdDate].new_leads += 1
        if (lead.stage === wonStageName) {
          acc[createdDate].won_leads += 1
        }
        return acc
      }, {} as Record<string, { new_leads: number; won_leads: number }>)

      setDailyTrends(
        Object.entries(dailyStats)
          .map(([date, data]) => ({
            date,
            new_leads: data.new_leads,
            won_leads: data.won_leads
          }))
          .slice(-14)
      )

    } catch (error) {
      console.error('Error fetching leads data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  const exportToExcel = () => {
    const currentPipeline = pipelines.find(p => p.id === pipelineFilter)
    const pipelineName = currentPipeline?.name || 'All Pipelines'

    const summaryData = [
      ['Leads MIS Report'],
      ['Pipeline', pipelineName],
      ['Date Range', dateRange],
      [''],
      ['Key Metrics'],
      ['Total Leads', metrics.totalLeads],
      ['New Leads', metrics.newLeads],
      ['Contacted Leads', metrics.contactedLeads],
      ['Won Leads', metrics.wonLeads],
      ['Lost Leads', metrics.lostLeads],
      ['Conversion Rate', `${metrics.conversionRate.toFixed(1)}%`],
      ['Contact Rate', `${metrics.contactRate.toFixed(1)}%`],
      ['Average Lead Score', metrics.averageLeadScore.toFixed(1)],
      [''],
      ['Leads by Stage'],
      ['Stage', 'Count'],
      ...leadsByStage.map(s => [s.stage, s.count]),
      [''],
      ['Leads by Source'],
      ['Source', 'Total', 'Converted', 'Conversion Rate'],
      ...leadsBySource.map(s => [s.source, s.count, s.converted, `${s.conversion_rate.toFixed(1)}%`]),
      [''],
      ['Leads by Interest'],
      ['Interest Level', 'Count'],
      ...leadsByInterest.map(i => [i.interest, i.count]),
      [''],
      ['Owner Performance'],
      ['Owner', 'Total Leads', 'Contacted', 'Won', 'Lost', 'Conversion Rate', 'Avg Score'],
      ...ownerPerformance.map(o => [
        o.owner,
        o.total_leads,
        o.contacted,
        o.won,
        o.lost,
        `${o.conversion_rate.toFixed(1)}%`,
        o.avg_lead_score.toFixed(1)
      ])
    ]

    const ws = XLSX.utils.aoa_to_sheet(summaryData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Leads MIS Report')
    XLSX.writeFile(wb, `Leads_MIS_Report_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const leadsChange = calculateChange(metrics.totalLeads, metrics.previousTotalLeads)
  const wonChange = calculateChange(metrics.wonLeads, metrics.previousWonLeads)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leads data...</p>
        </div>
      </div>
    )
  }

  if (!pipelineFilter) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader
          title="Leads MIS Report"
          description="Comprehensive lead analytics and sales pipeline performance insights"
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-gray-500" />
              <select
                value={pipelineFilter}
                onChange={(e) => setPipelineFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary min-w-[200px]"
              >
                <option value="">Select Pipeline</option>
                {pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Pipeline</h3>
              <p className="text-gray-600">Please select a pipeline from the dropdown above to view analytics.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Leads MIS Report"
        description="Comprehensive lead analytics and sales pipeline performance insights"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-gray-500" />
              <select
                value={pipelineFilter}
                onChange={(e) => setPipelineFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary min-w-[200px]"
              >
                <option value="">Select Pipeline</option>
                {pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="today">Today</option>
                <option value="thisWeek">This Week</option>
                <option value="thisMonth">This Month</option>
                <option value="thisQuarter">This Quarter</option>
                <option value="thisYear">This Year</option>
              </select>
            </div>
          </div>
          <Button onClick={exportToExcel} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription>Total Leads</CardDescription>
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {metrics.totalLeads}
                </div>
                <p className={`text-sm mt-1 ${leadsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {leadsChange >= 0 ? '+' : ''}{leadsChange.toFixed(1)}% vs previous period
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription>Won Leads</CardDescription>
                  <div className="p-2 bg-green-50 rounded-lg">
                    <UserCheck className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {metrics.wonLeads}
                </div>
                <p className={`text-sm mt-1 ${wonChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {wonChange >= 0 ? '+' : ''}{wonChange.toFixed(1)}% vs previous period
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription>Conversion Rate</CardDescription>
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Percent className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {metrics.conversionRate.toFixed(1)}%
                </div>
                <p className="text-sm text-gray-500 mt-1">Leads to won</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription>Contact Rate</CardDescription>
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <PhoneCall className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {metrics.contactRate.toFixed(1)}%
                </div>
                <p className="text-sm text-gray-500 mt-1">Leads contacted</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription>New Leads</CardDescription>
                  <TrendingUp className="h-5 w-5 text-gray-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {metrics.newLeads}
                </div>
                <p className="text-sm text-gray-500 mt-1">Pending contact</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription>Lost Leads</CardDescription>
                  <XCircle className="h-5 w-5 text-gray-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {metrics.lostLeads}
                </div>
                <p className="text-sm text-gray-500 mt-1">Not converted</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription>Avg Lead Score</CardDescription>
                  <Award className="h-5 w-5 text-gray-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {metrics.averageLeadScore.toFixed(1)}
                </div>
                <p className="text-sm text-gray-500 mt-1">Out of 100</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Sales Funnel</CardTitle>
              <CardDescription>Lead progression through pipeline stages</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={leadsByStage} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="stage" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6">
                    {leadsByStage.map((entry, index) => {
                      const stageColor = pipelineStages[pipelineFilter]?.find(s => s.name === entry.stage)?.color
                      return (
                        <Cell key={`cell-${index}`} fill={stageColor ? getColorFromBgClass(stageColor) : COLORS[index % COLORS.length]} />
                      )
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leads by Interest Level</CardTitle>
              <CardDescription>Distribution based on lead temperature</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RePieChart>
                  <Pie
                    data={leadsByInterest}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ interest, count }) => `${interest}: ${count}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {leadsByInterest.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={INTEREST_COLORS[entry.interest] || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Lead Sources Performance</CardTitle>
              <CardDescription>Conversion rate by lead source</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={leadsBySource}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="source" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="Total Leads" fill="#3b82f6" />
                  <Bar dataKey="converted" name="Converted" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Lead Trends</CardTitle>
              <CardDescription>New leads vs won leads over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="new_leads" stroke="#3b82f6" name="New Leads" strokeWidth={2} />
                  <Line type="monotone" dataKey="won_leads" stroke="#22c55e" name="Won Leads" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Owner Performance</CardTitle>
            <CardDescription>Individual sales team member conversion metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Owner</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Total Leads</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Contacted</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Won</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Lost</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Conversion Rate</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg Score</th>
                  </tr>
                </thead>
                <tbody>
                  {ownerPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500">
                        No owner performance data available
                      </td>
                    </tr>
                  ) : (
                    ownerPerformance.map((owner, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-gray-400" />
                            {owner.owner}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center text-gray-900">{owner.total_leads}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                            {owner.contacted}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            {owner.won}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                            {owner.lost}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(owner.conversion_rate, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                              {owner.conversion_rate.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center text-gray-900">
                          {owner.avg_lead_score.toFixed(1)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Source Performance</CardTitle>
              <CardDescription>Top performing lead sources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {leadsBySource.slice(0, 5).map((source, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{source.source}</div>
                      <div className="text-sm text-gray-600">{source.count} leads</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">
                        {source.conversion_rate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">{source.converted} won</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Pipeline Health</CardTitle>
              <CardDescription>Current distribution across pipeline stages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {leadsByStage.map((stage, idx) => {
                  const stageColor = pipelineStages[pipelineFilter]?.find(s => s.name === stage.stage)?.color
                  const borderColor = stageColor ? getColorFromBgClass(stageColor) : '#94a3b8'
                  return (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg border-l-4" style={{ borderLeftColor: borderColor }}>
                      <div className="text-sm text-gray-600 mb-1">{stage.stage}</div>
                      <div className="text-2xl font-bold text-gray-900">{stage.count}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {metrics.totalLeads > 0 ? ((stage.count / metrics.totalLeads) * 100).toFixed(1) : 0}% of total
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
