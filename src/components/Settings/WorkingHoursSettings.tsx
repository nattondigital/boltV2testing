import React, { useState, useEffect } from 'react'
import { Clock, Save, RefreshCw, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

interface WorkingHoursData {
  id: string
  day: string
  is_working_day: boolean
  start_time: string
  end_time: string
  total_working_hours: number
  full_day_hours: number
  half_day_hours: number
  overtime_hours: number
}

const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const dayLabels: Record<string, string> = {
  monday: 'M',
  tuesday: 'T',
  wednesday: 'W',
  thursday: 'T',
  friday: 'F',
  saturday: 'S',
  sunday: 'S'
}

export function WorkingHoursSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [workingHours, setWorkingHours] = useState<Record<string, WorkingHoursData>>({})

  useEffect(() => {
    fetchWorkingHours()
  }, [])

  const fetchWorkingHours = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('working_hours_settings')
        .select('*')
        .order('day')

      if (error) throw error

      const hoursMap: Record<string, WorkingHoursData> = {}
      data?.forEach((item: any) => {
        hoursMap[item.day] = item
      })
      setWorkingHours(hoursMap)
    } catch (error) {
      console.error('Error fetching working hours:', error)
      alert('Failed to load working hours settings')
    } finally {
      setLoading(false)
    }
  }

  const updateWorkingHours = (day: string, field: keyof WorkingHoursData, value: any) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }))
  }

  const handleStartTimeChange = (day: string, time: string) => {
    updateWorkingHours(day, 'start_time', time)
    calculateTotalHours(day, time, workingHours[day].end_time, workingHours[day].is_working_day)
  }

  const handleEndTimeChange = (day: string, time: string) => {
    updateWorkingHours(day, 'end_time', time)
    calculateTotalHours(day, workingHours[day].start_time, time, workingHours[day].is_working_day)
  }

  const handleWorkingDayToggle = (day: string) => {
    const newIsWorkingDay = !workingHours[day].is_working_day
    updateWorkingHours(day, 'is_working_day', newIsWorkingDay)
    calculateTotalHours(day, workingHours[day].start_time, workingHours[day].end_time, newIsWorkingDay)
  }

  const calculateTotalHours = (day: string, startTime: string, endTime: string, isWorkingDay: boolean) => {
    if (!isWorkingDay) {
      updateWorkingHours(day, 'total_working_hours', 0)
      return
    }

    const start = new Date(`2000-01-01T${startTime}`)
    const end = new Date(`2000-01-01T${endTime}`)
    const diffMs = end.getTime() - start.getTime()
    const hours = diffMs / (1000 * 60 * 60)
    updateWorkingHours(day, 'total_working_hours', Math.max(0, hours))
  }

  const applyMondayToAll = () => {
    const mondayData = workingHours['monday']
    if (!mondayData) return

    const updatedHours = { ...workingHours }
    dayOrder.forEach(day => {
      if (day !== 'monday' && updatedHours[day]) {
        updatedHours[day] = {
          ...updatedHours[day],
          start_time: mondayData.start_time,
          end_time: mondayData.end_time,
          full_day_hours: mondayData.full_day_hours,
          half_day_hours: mondayData.half_day_hours,
          overtime_hours: mondayData.overtime_hours,
          total_working_hours: updatedHours[day].is_working_day ? mondayData.total_working_hours : 0
        }
      }
    })
    setWorkingHours(updatedHours)
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      const updates = Object.values(workingHours).map(hours => ({
        id: hours.id,
        day: hours.day,
        is_working_day: hours.is_working_day,
        start_time: hours.start_time,
        end_time: hours.end_time,
        full_day_hours: parseFloat(hours.full_day_hours.toString()) || 0,
        half_day_hours: parseFloat(hours.half_day_hours.toString()) || 0,
        overtime_hours: parseFloat(hours.overtime_hours.toString()) || 0
      }))

      for (const update of updates) {
        const { data, error } = await supabase
          .from('working_hours_settings')
          .update({
            is_working_day: update.is_working_day,
            start_time: update.start_time,
            end_time: update.end_time,
            full_day_hours: update.full_day_hours,
            half_day_hours: update.half_day_hours,
            overtime_hours: update.overtime_hours
          })
          .eq('id', update.id)
          .select()

        if (error) {
          console.error('Error updating day:', update.day, error)
          throw error
        }

        console.log('Updated:', update.day, data)
      }

      alert('Working hours settings saved successfully!')
      await fetchWorkingHours()
    } catch (error: any) {
      console.error('Error saving working hours:', error)
      alert(`Failed to save working hours settings: ${error.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-primary" />
          <p className="text-gray-500">Loading working hours settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Office Working Hours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {dayOrder.map(day => {
              const hours = workingHours[day]
              if (!hours) return null

              return (
                <div key={day} className="flex items-center gap-4 py-3 border-b last:border-b-0">
                  <div className="w-32">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={hours.is_working_day}
                        onChange={() => handleWorkingDayToggle(day)}
                        className="w-4 h-4"
                      />
                      <span className="font-medium capitalize">{day}</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      type="time"
                      value={hours.start_time}
                      onChange={(e) => handleStartTimeChange(day, e.target.value)}
                      disabled={!hours.is_working_day}
                      className="w-32"
                    />
                    <span className="text-gray-500">to</span>
                    <Input
                      type="time"
                      value={hours.end_time}
                      onChange={(e) => handleEndTimeChange(day, e.target.value)}
                      disabled={!hours.is_working_day}
                      className="w-32"
                    />
                  </div>
                  <div className="w-32 text-right">
                    <span className="text-sm font-medium">
                      {hours.total_working_hours.toFixed(1)} hrs
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={applyMondayToAll}
            >
              Apply Monday to All Days
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Hour Type</th>
                  {dayOrder.map(day => (
                    <th key={day} className="text-center py-3 px-2 font-semibold text-gray-700">
                      {dayLabels[day]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">Total Working Hours</td>
                  {dayOrder.map(day => {
                    const hours = workingHours[day]
                    return (
                      <td key={day} className="text-center py-3 px-2">
                        <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                          hours?.is_working_day ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {hours?.total_working_hours.toFixed(1) || '0.0'}
                        </span>
                      </td>
                    )
                  })}
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">Full Day Hours</td>
                  {dayOrder.map(day => {
                    const hours = workingHours[day]
                    return (
                      <td key={day} className="text-center py-3 px-2">
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          value={hours?.full_day_hours || 0}
                          onChange={(e) => updateWorkingHours(day, 'full_day_hours', parseFloat(e.target.value) || 0)}
                          className="w-16 text-center mx-auto"
                        />
                      </td>
                    )
                  })}
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">Half Day Hours</td>
                  {dayOrder.map(day => {
                    const hours = workingHours[day]
                    return (
                      <td key={day} className="text-center py-3 px-2">
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          value={hours?.half_day_hours || 0}
                          onChange={(e) => updateWorkingHours(day, 'half_day_hours', parseFloat(e.target.value) || 0)}
                          className="w-16 text-center mx-auto"
                        />
                      </td>
                    )
                  })}
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">Overtime Hours</td>
                  {dayOrder.map(day => {
                    const hours = workingHours[day]
                    return (
                      <td key={day} className="text-center py-3 px-2">
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          value={hours?.overtime_hours || 0}
                          onChange={(e) => updateWorkingHours(day, 'overtime_hours', parseFloat(e.target.value) || 0)}
                          className="w-16 text-center mx-auto"
                        />
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Payroll Policy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-3">Attendance Status Calculation Rules</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center flex-shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Full Day</p>
                    <p className="text-gray-600">
                      Employee Attendance Status will be marked as <span className="font-semibold text-green-700">"FULL DAY"</span> if Actual Working Hours <span className="font-semibold">≥</span> Full Day Hours
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 font-bold flex items-center justify-center flex-shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Half Day</p>
                    <p className="text-gray-600">
                      Employee Attendance Status will be marked as <span className="font-semibold text-yellow-700">"HALF DAY"</span> if Actual Working Hours <span className="font-semibold">&lt;</span> Half Day Hours
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-bold flex items-center justify-center flex-shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Overtime</p>
                    <p className="text-gray-600">
                      Employee Attendance Status will be marked as <span className="font-semibold text-orange-700">"OVERTIME"</span> if Actual Working Hours <span className="font-semibold">≥</span> Overtime Hours
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                How It Works
              </h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary font-bold">•</span>
                  <span>Actual Working Hours are calculated from check-in and check-out times in the Attendance module</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary font-bold">•</span>
                  <span>The system automatically determines attendance status based on the policies above</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary font-bold">•</span>
                  <span>Overtime is calculated when working hours exceed the configured Overtime Hours threshold</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary font-bold">•</span>
                  <span>These policies apply to each working day based on the day-specific hour configurations above</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-primary hover:bg-blue-700"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Working Hours
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
