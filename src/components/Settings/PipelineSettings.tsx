import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit, Trash2, Save, X, GripVertical, Palette, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'

interface Pipeline {
  id: string
  pipeline_id: string
  name: string
  description: string | null
  entity_type: string
  is_default: boolean
  is_active: boolean
  display_order: number
}

interface PipelineStage {
  id: string
  pipeline_id: string
  stage_id: string
  name: string
  description: string | null
  color: string
  display_order: number
  is_active: boolean
}

const defaultColors = [
  'bg-blue-100',
  'bg-green-100',
  'bg-yellow-100',
  'bg-red-100',
  'bg-purple-100',
  'bg-pink-100',
  'bg-indigo-100',
  'bg-orange-100',
  'bg-teal-100',
  'bg-gray-100'
]

export function PipelineSettings() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null)
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [isAddingPipeline, setIsAddingPipeline] = useState(false)
  const [isAddingStage, setIsAddingStage] = useState(false)
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [pipelineForm, setPipelineForm] = useState({
    name: '',
    description: '',
    entity_type: 'lead'
  })

  const [stageForm, setStageForm] = useState({
    name: '',
    description: '',
    color: 'bg-blue-100'
  })

  useEffect(() => {
    fetchPipelines()
  }, [])

  useEffect(() => {
    if (selectedPipeline) {
      fetchStages(selectedPipeline.id)
    }
  }, [selectedPipeline])

  const fetchPipelines = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('pipelines')
        .select('*')
        .order('display_order', { ascending: true })

      if (error) throw error

      setPipelines(data || [])
      if (data && data.length > 0 && !selectedPipeline) {
        setSelectedPipeline(data[0])
      }
    } catch (error) {
      console.error('Error fetching pipelines:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStages = async (pipelineId: string) => {
    try {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', pipelineId)
        .order('display_order', { ascending: true })

      if (error) throw error

      setStages(data || [])
    } catch (error) {
      console.error('Error fetching stages:', error)
    }
  }

  const handleAddPipeline = async () => {
    if (!pipelineForm.name.trim()) {
      alert('Please enter a pipeline name')
      return
    }

    if (submitting) return

    try {
      setSubmitting(true)

      const { data: existingPipelines, error: fetchError } = await supabase
        .from('pipelines')
        .select('pipeline_id, name')
        .order('pipeline_id', { ascending: false })

      if (fetchError) {
        console.error('Error fetching existing pipelines:', fetchError)
        alert(`Failed to verify pipeline data: ${fetchError.message}`)
        return
      }

      const existingNames = existingPipelines?.map(p => p.name.toLowerCase()) || []
      if (existingNames.includes(pipelineForm.name.toLowerCase())) {
        alert('A pipeline with this name already exists. Please choose a different name.')
        return
      }

      let nextPipelineNumber = 1
      if (existingPipelines && existingPipelines.length > 0) {
        const pipelineNumbers = existingPipelines
          .map(p => {
            const match = p.pipeline_id.match(/^P(\d+)$/)
            return match ? parseInt(match[1], 10) : 0
          })
          .filter(num => num > 0)

        if (pipelineNumbers.length > 0) {
          nextPipelineNumber = Math.max(...pipelineNumbers) + 1
        }
      }

      const pipelineId = `P${String(nextPipelineNumber).padStart(3, '0')}`

      const maxOrder = pipelines.length > 0 ? Math.max(...pipelines.map(p => p.display_order)) : 0

      const { data, error } = await supabase
        .from('pipelines')
        .insert([{
          pipeline_id: pipelineId,
          name: pipelineForm.name,
          description: pipelineForm.description || null,
          entity_type: pipelineForm.entity_type,
          display_order: maxOrder + 1
        }])
        .select()
        .single()

      if (error) {
        console.error('Error inserting pipeline:', error)
        if (error.code === '23505') {
          alert('A pipeline with this ID already exists. Please try again.')
        } else if (error.message) {
          alert(`Failed to add pipeline: ${error.message}`)
        } else {
          alert('Failed to add pipeline. Please check your connection and try again.')
        }
        return
      }

      await fetchPipelines()
      setSelectedPipeline(data)
      setIsAddingPipeline(false)
      setPipelineForm({ name: '', description: '', entity_type: 'lead' })
      alert('Pipeline added successfully!')
    } catch (error) {
      console.error('Unexpected error adding pipeline:', error)
      alert('An unexpected error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePipeline = async (pipelineId: string) => {
    try {
      // Check if there are any leads using this pipeline
      const { data: leadsCount, error: countError } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('pipeline_id', pipelineId)

      if (countError) throw countError

      const count = leadsCount?.length || 0

      if (count > 0) {
        alert(`Cannot delete pipeline. There are ${count} lead(s) currently assigned to this pipeline. Please delete or reassign all leads in this pipeline before deleting it.`)
        return
      }

      if (!confirm('Are you sure you want to delete this pipeline? All stages will also be deleted.')) {
        return
      }

      // Check if this is the default pipeline
      const pipelineToDelete = pipelines.find(p => p.id === pipelineId)
      const isDefault = pipelineToDelete?.is_default

      // Delete the pipeline
      const { error } = await supabase
        .from('pipelines')
        .delete()
        .eq('id', pipelineId)

      if (error) throw error

      // If the deleted pipeline was default, set another pipeline as default
      if (isDefault) {
        const remainingPipelines = pipelines.filter(p => p.id !== pipelineId)
        if (remainingPipelines.length > 0) {
          // Set the first remaining pipeline as default
          const { error: updateError } = await supabase
            .from('pipelines')
            .update({ is_default: true })
            .eq('id', remainingPipelines[0].id)

          if (updateError) {
            console.error('Error setting new default pipeline:', updateError)
          }
        }
      }

      await fetchPipelines()
      setSelectedPipeline(null)
      alert('Pipeline deleted successfully!')
    } catch (error) {
      console.error('Error deleting pipeline:', error)
      alert('Failed to delete pipeline')
    }
  }

  const handleAddStage = async () => {
    if (!selectedPipeline) return
    if (!stageForm.name.trim()) {
      alert('Please enter a stage name')
      return
    }

    try {
      const maxOrder = stages.length > 0 ? Math.max(...stages.map(s => s.display_order)) : 0
      const stageId = stageForm.name.toLowerCase().replace(/\s+/g, '_')

      const { error } = await supabase
        .from('pipeline_stages')
        .insert([{
          pipeline_id: selectedPipeline.id,
          stage_id: stageId,
          name: stageForm.name,
          description: stageForm.description,
          color: stageForm.color,
          display_order: maxOrder + 1
        }])

      if (error) throw error

      await fetchStages(selectedPipeline.id)
      setIsAddingStage(false)
      setStageForm({ name: '', description: '', color: 'bg-blue-100' })
    } catch (error) {
      console.error('Error adding stage:', error)
      alert('Failed to add stage')
    }
  }

  const handleUpdateStage = async () => {
    if (!editingStage) return

    try {
      const { error } = await supabase
        .from('pipeline_stages')
        .update({
          name: stageForm.name,
          description: stageForm.description,
          color: stageForm.color
        })
        .eq('id', editingStage.id)

      if (error) throw error

      await fetchStages(selectedPipeline!.id)
      setEditingStage(null)
      setStageForm({ name: '', description: '', color: 'bg-blue-100' })
    } catch (error) {
      console.error('Error updating stage:', error)
      alert('Failed to update stage')
    }
  }

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('Are you sure you want to delete this stage?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('pipeline_stages')
        .delete()
        .eq('id', stageId)

      if (error) throw error

      await fetchStages(selectedPipeline!.id)
    } catch (error) {
      console.error('Error deleting stage:', error)
      alert('Failed to delete stage')
    }
  }

  const startEditStage = (stage: PipelineStage) => {
    setEditingStage(stage)
    setStageForm({
      name: stage.name,
      description: stage.description || '',
      color: stage.color
    })
  }

  const cancelEdit = () => {
    setEditingStage(null)
    setIsAddingStage(false)
    setStageForm({ name: '', description: '', color: 'bg-blue-100' })
  }

  const copyPipelineId = async (pipelineUUID: string) => {
    try {
      await navigator.clipboard.writeText(pipelineUUID)
      setCopiedId(pipelineUUID)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Failed to copy pipeline UUID:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading pipelines...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand-text">Pipeline Management</h2>
          <p className="text-gray-600 mt-1">Configure pipelines and stages for your workflows</p>
        </div>
        <Button onClick={() => setIsAddingPipeline(true)} disabled={submitting}>
          <Plus className="w-4 h-4 mr-2" />
          Add Pipeline
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Pipelines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pipelines.map((pipeline) => (
                <motion.div
                  key={pipeline.id}
                  whileHover={{ scale: 1.02 }}
                  className={`p-3 rounded-lg border transition-colors ${
                    selectedPipeline?.id === pipeline.id
                      ? 'bg-brand-primary text-white border-brand-primary'
                      : 'bg-white hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 cursor-pointer" onClick={() => setSelectedPipeline(pipeline)}>
                      <div className="font-medium">{pipeline.name}</div>
                      <div className={`text-sm ${selectedPipeline?.id === pipeline.id ? 'text-white/80' : 'text-gray-500'}`}>
                        {pipeline.entity_type}
                      </div>
                      <div className={`text-xs mt-1 font-mono flex items-center gap-1 ${selectedPipeline?.id === pipeline.id ? 'text-white/70' : 'text-gray-400'}`}>
                        ID: {pipeline.pipeline_id}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {pipeline.is_default && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          copyPipelineId(pipeline.id)
                        }}
                        className={`p-1 rounded transition-colors ${
                          selectedPipeline?.id === pipeline.id
                            ? 'hover:bg-white/20'
                            : 'hover:bg-gray-200'
                        }`}
                        title="Copy Pipeline UUID"
                      >
                        {copiedId === pipeline.id ? (
                          <Check className={`w-3 h-3 ${selectedPipeline?.id === pipeline.id ? 'text-white' : 'text-green-600'}`} />
                        ) : (
                          <Copy className={`w-3 h-3 ${selectedPipeline?.id === pipeline.id ? 'text-white' : 'text-gray-600'}`} />
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <CardTitle>{selectedPipeline?.name || 'Select a Pipeline'}</CardTitle>
                  {selectedPipeline && (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-md">
                        <span className="text-xs text-gray-500">ID:</span>
                        <span className="text-xs font-mono text-gray-600">{selectedPipeline.pipeline_id}</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-md">
                        <span className="text-xs text-gray-500">UUID:</span>
                        <span className="text-xs font-mono text-gray-600 truncate max-w-[200px]" title={selectedPipeline.id}>{selectedPipeline.id}</span>
                        <button
                          onClick={() => copyPipelineId(selectedPipeline.id)}
                          className="p-0.5 rounded hover:bg-blue-100 transition-colors flex-shrink-0"
                          title="Copy Pipeline UUID"
                        >
                          {copiedId === selectedPipeline.id ? (
                            <Check className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-600" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {selectedPipeline?.description && (
                  <p className="text-sm text-gray-600 mt-1">{selectedPipeline.description}</p>
                )}
              </div>
              {selectedPipeline && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddingStage(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Stage
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeletePipeline(selectedPipeline.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedPipeline ? (
              <div className="space-y-4">
                <AnimatePresence>
                  {stages.map((stage) => (
                    <motion.div
                      key={stage.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="border rounded-lg p-4"
                    >
                      {editingStage?.id === stage.id ? (
                        <div className="space-y-3">
                          <Input
                            placeholder="Stage name"
                            value={stageForm.name}
                            onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
                          />
                          <Textarea
                            placeholder="Description (optional)"
                            value={stageForm.description}
                            onChange={(e) => setStageForm({ ...stageForm, description: e.target.value })}
                            rows={2}
                          />
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <Palette className="w-4 h-4 inline mr-2" />
                              Card Color
                            </label>
                            <div className="grid grid-cols-5 gap-2">
                              {defaultColors.map((color) => (
                                <div
                                  key={color}
                                  className={`${color} h-12 rounded-lg border-2 cursor-pointer transition-all ${
                                    stageForm.color === color ? 'border-brand-primary scale-110' : 'border-transparent'
                                  }`}
                                  onClick={() => setStageForm({ ...stageForm, color })}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" size="sm" onClick={cancelEdit}>
                              <X className="w-4 h-4 mr-2" />
                              Cancel
                            </Button>
                            <Button size="sm" onClick={handleUpdateStage}>
                              <Save className="w-4 h-4 mr-2" />
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <GripVertical className="w-5 h-5 text-gray-400" />
                            <div className={`${stage.color} w-12 h-12 rounded-lg`} />
                            <div>
                              <div className="font-medium text-gray-900">{stage.name}</div>
                              {stage.description && (
                                <div className="text-sm text-gray-500">{stage.description}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditStage(stage)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteStage(stage.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isAddingStage && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-4"
                  >
                    <div className="space-y-3">
                      <Input
                        placeholder="Stage name"
                        value={stageForm.name}
                        onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
                      />
                      <Textarea
                        placeholder="Description (optional)"
                        value={stageForm.description}
                        onChange={(e) => setStageForm({ ...stageForm, description: e.target.value })}
                        rows={2}
                      />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Palette className="w-4 h-4 inline mr-2" />
                          Card Color
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                          {defaultColors.map((color) => (
                            <div
                              key={color}
                              className={`${color} h-12 rounded-lg border-2 cursor-pointer transition-all ${
                                stageForm.color === color ? 'border-brand-primary scale-110' : 'border-transparent'
                              }`}
                              onClick={() => setStageForm({ ...stageForm, color })}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" size="sm" onClick={cancelEdit}>
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleAddStage}>
                          <Save className="w-4 h-4 mr-2" />
                          Add Stage
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Select a pipeline to manage its stages
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AnimatePresence>
        {isAddingPipeline && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setIsAddingPipeline(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-brand-text mb-4">Add New Pipeline</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pipeline Name</label>
                  <Input
                    placeholder="e.g., Sales Pipeline"
                    value={pipelineForm.name}
                    onChange={(e) => setPipelineForm({ ...pipelineForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <Textarea
                    placeholder="Optional description"
                    value={pipelineForm.description}
                    onChange={(e) => setPipelineForm({ ...pipelineForm, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Entity Type</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={pipelineForm.entity_type}
                    onChange={(e) => setPipelineForm({ ...pipelineForm, entity_type: e.target.value })}
                  >
                    <option value="lead">Lead</option>
                    <option value="deal">Deal</option>
                    <option value="project">Project</option>
                    <option value="candidate">Candidate</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddingPipeline(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddPipeline}
                    disabled={submitting || !pipelineForm.name.trim()}
                  >
                    {submitting ? 'Adding...' : 'Add Pipeline'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
