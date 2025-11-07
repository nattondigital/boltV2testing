import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Camera, MapPin, CheckCircle, Calendar, User, LogOut, Plus, X, ChevronRight, ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { KPICard } from '@/components/Common/KPICard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { CheckoutFormDesktop, CheckoutFormMobile } from './AttendanceCheckout'

interface AttendanceRecord {
  id: string
  admin_user_id: string
  date: string
  check_in_time: string
  check_out_time: string | null
  check_in_selfie_url: string | null
  check_in_location: {
    lat: number
    lng: number
    address: string
  } | null
  check_out_selfie_url: string | null
  check_out_location: {
    lat: number
    lng: number
    address: string
  } | null
  status: string
  notes: string | null
  admin_user?: {
    id: string
    full_name: string
    email: string
  }
}

const statusColors: Record<string, string> = {
  present: 'bg-green-100 text-green-800',
  absent: 'bg-red-100 text-red-800',
  late: 'bg-yellow-100 text-yellow-800',
  half_day: 'bg-blue-100 text-blue-800'
}

export function Attendance() {
  const [view, setView] = useState<'list' | 'add' | 'checkout' | 'details'>('list')
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showMarkModal, setShowMarkModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState('')
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    fetchAttendance()
    fetchTeamMembers()
  }, [])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  // Capture GPS location and start camera when view changes to 'add', 'checkout' or modal opens
  useEffect(() => {
    if (view === 'add' || view === 'checkout' || showMarkModal) {
      const captureLocation = async () => {
        try {
          const currentLocation = await getCurrentLocation()
          setLocation(currentLocation)
          console.log('Location captured:', currentLocation)
        } catch (error) {
          console.error('Error getting location:', error)
          alert('Unable to capture location. Please enable location services.')
        }
      }

      const initializeCamera = async () => {
        // Auto-start camera when entering add or checkout view
        if (!selfieDataUrl) {
          // Small delay to ensure DOM is ready
          setTimeout(async () => {
            await startCamera()
          }, 100)
        }
      }

      captureLocation()
      initializeCamera()
    }

    // Cleanup when leaving these views
    return () => {
      if (view !== 'add' && view !== 'checkout' && !showMarkModal) {
        stopCamera()
      }
    }
  }, [view, showMarkModal])

  // Ensure video stream is attached to video element when videoRef changes
  useEffect(() => {
    if (streamRef.current && videoRef.current && isCameraActive) {
      // Reattach stream if video element changed
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current
        videoRef.current.play().catch(err => {
          console.error('Error playing video:', err)
        })
      }
    }
  }, [view, isCameraActive])

  const fetchAttendance = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          admin_user:admin_users(id, full_name, email)
        `)
        .order('date', { ascending: false })
        .order('check_in_time', { ascending: false })

      if (error) {
        console.error('Supabase error:', error)
        alert(`Error loading attendance: ${error.message}`)
        throw error
      }

      console.log('Fetched attendance records:', data)
      setAttendance(data || [])
    } catch (err: any) {
      console.error('Error fetching attendance:', err)
      alert(`Failed to load attendance records: ${err.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, full_name, email, role')
        .order('full_name', { ascending: true })

      if (error) throw error
      setTeamMembers(data || [])
    } catch (err) {
      console.error('Error fetching team members:', err)
    }
  }

  const startCamera = async () => {
    try {
      // Stop any existing camera stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      })

      // Store stream reference
      streamRef.current = stream

      // Attach stream to ALL video elements with class 'attendance-video'
      // This handles both desktop and mobile views simultaneously
      const videoElements = document.querySelectorAll<HTMLVideoElement>('.attendance-video')
      videoElements.forEach((videoElement) => {
        if (videoElement) {
          videoElement.srcObject = stream
          videoElement.onloadedmetadata = () => {
            videoElement.play().catch(err => {
              console.error('Error playing video:', err)
            })
          }
        }
      })

      // Set state immediately
      setIsCameraActive(true)
    } catch (err) {
      console.error('Error accessing camera:', err)
      alert('Failed to access camera. Please allow camera permissions.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraActive(false)
  }

  const captureSelfie = () => {
    // Find the first visible video element with the stream
    const videoElements = document.querySelectorAll<HTMLVideoElement>('.attendance-video')
    let activeVideo: HTMLVideoElement | null = null

    // Find the video element that is currently visible and has a stream
    videoElements.forEach((video) => {
      if (video.srcObject && video.videoWidth > 0 && !activeVideo) {
        // Check if element is visible (not hidden by CSS)
        const style = window.getComputedStyle(video)
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          activeVideo = video
        }
      }
    })

    if (activeVideo && canvasRef.current) {
      const canvas = canvasRef.current
      canvas.width = activeVideo.videoWidth
      canvas.height = activeVideo.videoHeight

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(activeVideo, 0, 0)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        setSelfieDataUrl(dataUrl)
        stopCamera()
      }
    }
  }

  const getCurrentLocation = () => {
    return new Promise<{ lat: number; lng: number; address: string }>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            )
            const data = await response.json()
            const address = data.display_name || `${lat}, ${lng}`

            resolve({ lat, lng, address })
          } catch {
            resolve({ lat, lng, address: `${lat}, ${lng}` })
          }
        },
        (error) => {
          reject(error)
        }
      )
    })
  }

  const handleMarkAttendance = async () => {
    if (!selectedMember) {
      alert('Please select an employee')
      return
    }

    if (!selfieDataUrl) {
      alert('Please capture a selfie')
      return
    }

    if (!location) {
      alert('Location not captured. Please try again.')
      return
    }

    try {
      const currentLocation = location

      let selfieUrl = selfieDataUrl

      try {
        const { data: integration, error: integrationError } = await supabase
          .from('integrations')
          .select('config')
          .eq('integration_type', 'ghl_api')
          .maybeSingle()

        if (integration?.config?.accessToken) {
          const accessToken = integration.config.accessToken
          const locationId = integration.config.locationId || 'iDIRFjdZBWH7SqBzTowc'

          const { data: folderAssignment } = await supabase
            .from('media_folder_assignments')
            .select('media_folder_id, media_folders!inner(ghl_folder_id, folder_name)')
            .eq('trigger_event', 'ATTENDANCE_CHECKIN')
            .eq('module', 'Attendance')
            .maybeSingle()

          const ghlFolderId = folderAssignment?.media_folders?.ghl_folder_id

          if (!ghlFolderId) {
            console.log('No GHL folder configured for attendance check-ins, using data URL')
          } else {
            let { data: attendanceFolder } = await supabase
              .from('media_folders')
              .select('id')
              .eq('ghl_folder_id', ghlFolderId)
              .maybeSingle()

            if (!attendanceFolder) {
              const { data: newFolder, error: folderError } = await supabase
                .from('media_folders')
                .insert({
                  folder_name: folderAssignment?.media_folders?.folder_name || 'Attendance',
                  ghl_folder_id: ghlFolderId,
                  parent_id: null,
                  location_id: locationId
                })
                .select('id')
                .single()

              if (!folderError && newFolder) {
                attendanceFolder = newFolder
              }
            }

            const response = await fetch(selfieDataUrl)
            const blob = await response.blob()

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            const fileName = `attendance-${selectedMember}-${timestamp}.jpg`
            const file = new File([blob], fileName, { type: 'image/jpeg' })

            const formData = new FormData()
            formData.append('file', file)
            formData.append('name', fileName)
            formData.append('parentId', ghlFolderId)

            const uploadResponse = await fetch('https://services.leadconnectorhq.com/medias/upload-file', {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Version': '2021-07-28',
                'Authorization': `Bearer ${accessToken.trim()}`
              },
              body: formData
            })

            if (uploadResponse.ok) {
              const ghlFile = await uploadResponse.json()
              selfieUrl = ghlFile.url || ghlFile.fileUrl || selfieDataUrl

              await supabase.from('media_files').insert({
                file_name: fileName,
                file_url: selfieUrl,
                file_type: 'image/jpeg',
                file_size: file.size,
                ghl_file_id: ghlFile._id || ghlFile.id,
                folder_id: attendanceFolder?.id || null,
                location_id: locationId,
                thumbnail_url: ghlFile.thumbnailUrl || null,
                uploaded_by: selectedMember
              })
            } else {
              console.error('Failed to upload to GHL, using data URL')
            }
          }
        }
      } catch (uploadErr) {
        console.error('Error uploading selfie to GHL:', uploadErr)
      }

      const { error } = await supabase
        .from('attendance')
        .insert({
          admin_user_id: selectedMember,
          date: format(new Date(), 'yyyy-MM-dd'),
          check_in_time: new Date().toISOString(),
          check_in_selfie_url: selfieUrl,
          check_in_location: currentLocation,
          status: 'present'
        })

      if (error) {
        if (error.code === '23505') {
          alert('Attendance already marked for today')
        } else {
          throw error
        }
        return
      }

      alert('Attendance marked successfully')
      fetchAttendance()
      handleCloseModal()
      setView('list')
    } catch (err) {
      console.error('Error marking attendance:', err)
      alert('Failed to mark attendance')
    }
  }

  const handleAddAttendance = () => {
    setView('add')
    setSelectedMember('')
    setSelfieDataUrl(null)
    setLocation(null)
  }

  const handleBackToList = () => {
    setView('list')
    setSelectedMember('')
    setSelfieDataUrl(null)
    setLocation(null)
    stopCamera()
  }

  const handleInitiateCheckout = (record: AttendanceRecord) => {
    setSelectedRecord(record)
    setSelectedMember(record.admin_user_id)
    setSelfieDataUrl(null)
    setLocation(null)
    setView('checkout')
  }

  const handleCheckoutSubmit = async () => {
    if (!selectedRecord) {
      alert('No attendance record selected')
      return
    }

    if (!selfieDataUrl) {
      alert('Please capture a selfie')
      return
    }

    if (!location) {
      alert('Location not captured. Please try again.')
      return
    }

    try {
      const currentLocation = location

      let selfieUrl = selfieDataUrl

      try {
        const { data: integration, error: integrationError } = await supabase
          .from('integrations')
          .select('config')
          .eq('integration_type', 'ghl_api')
          .maybeSingle()

        if (integration?.config?.accessToken) {
          const accessToken = integration.config.accessToken
          const locationId = integration.config.locationId || 'iDIRFjdZBWH7SqBzTowc'

          const { data: folderAssignment } = await supabase
            .from('media_folder_assignments')
            .select('media_folder_id, media_folders!inner(ghl_folder_id, folder_name)')
            .eq('trigger_event', 'ATTENDANCE_CHECKOUT')
            .eq('module', 'Attendance')
            .maybeSingle()

          const ghlFolderId = folderAssignment?.media_folders?.ghl_folder_id

          if (ghlFolderId) {
            const blob = await fetch(selfieDataUrl).then(r => r.blob())
            const timestamp = new Date().getTime()
            const fileName = `attendance-checkout-${selectedMember}-${timestamp}.jpg`
            const file = new File([blob], fileName, { type: 'image/jpeg' })

            const formData = new FormData()
            formData.append('file', file)
            formData.append('name', fileName)
            formData.append('parentId', ghlFolderId)

            const uploadResponse = await fetch('https://services.leadconnectorhq.com/medias/upload-file', {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Version': '2021-07-28',
                'Authorization': `Bearer ${accessToken.trim()}`
              },
              body: formData
            })

            if (uploadResponse.ok) {
              const ghlFile = await uploadResponse.json()
              selfieUrl = ghlFile.url || ghlFile.fileUrl || selfieDataUrl

              await supabase.from('media_files').insert({
                file_name: fileName,
                file_url: selfieUrl,
                file_type: 'image/jpeg',
                file_size: file.size,
                ghl_file_id: ghlFile._id || ghlFile.id,
                folder_id: folderAssignment?.media_folders?.id || null,
                location_id: locationId,
                thumbnail_url: ghlFile.thumbnailUrl || null,
                uploaded_by: selectedMember
              })
            }
          }
        }
      } catch (uploadErr) {
        console.error('Error uploading checkout selfie to GHL:', uploadErr)
      }

      const { error } = await supabase
        .from('attendance')
        .update({
          check_out_time: new Date().toISOString(),
          check_out_selfie_url: selfieUrl,
          check_out_location: currentLocation
        })
        .eq('id', selectedRecord.id)

      if (error) throw error

      alert('Check-out marked successfully')
      fetchAttendance()
      setView('list')
      setSelectedRecord(null)
      setSelectedMember('')
      setSelfieDataUrl(null)
      setLocation(null)
      stopCamera()
    } catch (err) {
      console.error('Error marking check-out:', err)
      alert('Failed to mark check-out')
    }
  }

  const handleViewDetails = (record: AttendanceRecord) => {
    setSelectedRecord(record)
    setView('details')
  }

  const handleCloseModal = () => {
    setShowMarkModal(false)
    setSelectedMember('')
    setSelfieDataUrl(null)
    setLocation(null)
    stopCamera()
  }

  const totalPresent = attendance.filter(a =>
    a.date === format(new Date(), 'yyyy-MM-dd') && a.status === 'present'
  ).length
  const totalLate = attendance.filter(a =>
    a.date === format(new Date(), 'yyyy-MM-dd') && a.status === 'late'
  ).length
  const totalAbsent = teamMembers.length - totalPresent - totalLate

  return (
    <>
      {/* Desktop View */}
      <div className="hidden md:block p-8 space-y-8">
        {view === 'list' && (
          <>
            <PageHeader
              title="Attendance Management"
              subtitle="Track and manage team attendance"
              actions={[
                {
                  label: 'Mark Attendance',
                  onClick: handleAddAttendance,
                  variant: 'default',
                  icon: Plus
                }
              ]}
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <KPICard
                title="Present Today"
                value={totalPresent.toString()}
                icon={CheckCircle}
                category="success"
              />
              <KPICard
                title="Late Today"
                value={totalLate.toString()}
                icon={Clock}
                category="warning"
              />
              <KPICard
                title="Absent Today"
                value={totalAbsent.toString()}
                icon={User}
                category="warning"
              />
              <KPICard
                title="Total Staff"
                value={teamMembers.length.toString()}
                icon={User}
                category="primary"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Attendance Records</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Member</th>
                        <th className="text-left py-3 px-4 font-medium">Date</th>
                        <th className="text-left py-3 px-4 font-medium">Check In</th>
                        <th className="text-left py-3 px-4 font-medium">Check Out</th>
                        <th className="text-left py-3 px-4 font-medium">Selfies</th>
                        <th className="text-left py-3 px-4 font-medium">Locations</th>
                        <th className="text-left py-3 px-4 font-medium">Status</th>
                        <th className="text-left py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-gray-500">
                            Loading...
                          </td>
                        </tr>
                      ) : attendance.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-gray-500">
                            No attendance records found
                          </td>
                        </tr>
                      ) : (
                        attendance.map((record) => (
                          <tr key={record.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarFallback>
                                    {record.admin_user?.full_name?.charAt(0) || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">{record.admin_user?.full_name || 'Unknown'}</div>
                                  <div className="text-sm text-gray-500">{record.admin_user?.email || 'No email'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                {format(new Date(record.date), 'dd/MM/yyyy')}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                {format(new Date(record.check_in_time), 'HH:mm')}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {record.check_out_time ? (
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-gray-400" />
                                  {format(new Date(record.check_out_time), 'HH:mm')}
                                </div>
                              ) : (
                                <span className="text-gray-400">Not checked out</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                {record.check_in_selfie_url ? (
                                  <img
                                    src={record.check_in_selfie_url}
                                    alt="Check-in Selfie"
                                    className="w-10 h-10 rounded-full object-cover cursor-pointer border-2 border-green-500"
                                    onClick={() => window.open(record.check_in_selfie_url!, '_blank')}
                                    title="Check-in selfie"
                                  />
                                ) : (
                                  <Camera className="w-8 h-8 text-gray-300" />
                                )}
                                {record.check_out_selfie_url ? (
                                  <img
                                    src={record.check_out_selfie_url}
                                    alt="Check-out Selfie"
                                    className="w-10 h-10 rounded-full object-cover cursor-pointer border-2 border-red-500"
                                    onClick={() => window.open(record.check_out_selfie_url!, '_blank')}
                                    title="Check-out selfie"
                                  />
                                ) : record.check_out_time ? (
                                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center" title="No checkout selfie">
                                    <Camera className="w-5 h-5 text-gray-400" />
                                  </div>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {record.check_in_location ? (
                                  <button
                                    onClick={() => window.open(`https://www.google.com/maps?q=${record.check_in_location!.lat},${record.check_in_location!.lng}`, '_blank')}
                                    className="p-2 bg-green-100 hover:bg-green-200 rounded-full transition-colors"
                                    title={`Check-in: ${record.check_in_location.address}`}
                                  >
                                    <MapPin className="w-4 h-4 text-green-600" />
                                  </button>
                                ) : (
                                  <div className="p-2 bg-gray-100 rounded-full">
                                    <MapPin className="w-4 h-4 text-gray-300" />
                                  </div>
                                )}
                                {record.check_out_location ? (
                                  <button
                                    onClick={() => window.open(`https://www.google.com/maps?q=${record.check_out_location!.lat},${record.check_out_location!.lng}`, '_blank')}
                                    className="p-2 bg-red-100 hover:bg-red-200 rounded-full transition-colors"
                                    title={`Check-out: ${record.check_out_location.address}`}
                                  >
                                    <MapPin className="w-4 h-4 text-red-600" />
                                  </button>
                                ) : record.check_out_time ? (
                                  <div className="p-2 bg-gray-100 rounded-full" title="No checkout location">
                                    <MapPin className="w-4 h-4 text-gray-300" />
                                  </div>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={statusColors[record.status] || 'bg-gray-100 text-gray-800'}>
                                {record.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewDetails(record)}
                                >
                                  View Details
                                </Button>
                                {!record.check_out_time && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleInitiateCheckout(record)}
                                  >
                                    <LogOut className="w-4 h-4 mr-1" />
                                    Check Out
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {view === 'add' && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <Button
                variant="ghost"
                onClick={handleBackToList}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to List
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Mark Attendance</h1>
                <p className="text-gray-500 mt-1">Record employee attendance for today</p>
              </div>
            </div>

            <Card className="max-w-3xl">
              <CardContent className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Employee Name *</label>
                  <select
                    value={selectedMember}
                    onChange={(e) => setSelectedMember(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select employee</option>
                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name} - {member.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selfie Image <span className="text-red-500">*</span>
                  </label>

                  {!selfieDataUrl ? (
                    <div className="space-y-4">
                      <div
                        className="relative bg-gray-900 rounded-lg overflow-hidden"
                        style={{ aspectRatio: '4/3' }}
                      >
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover attendance-video"
                        />
                        {!isCameraActive && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                            <div className="text-center text-white">
                              <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
                              <p className="text-sm">Camera will appear here</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <Button
                          type="button"
                          onClick={isCameraActive ? captureSelfie : startCamera}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          {isCameraActive ? 'Capture Photo' : 'Start Camera'}
                        </Button>

                        {isCameraActive && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={stopCamera}
                            className="px-8"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>

                      <canvas ref={canvasRef} className="hidden" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div
                        className="relative bg-gray-100 rounded-lg overflow-hidden"
                        style={{ aspectRatio: '4/3' }}
                      >
                        <img
                          src={selfieDataUrl}
                          alt="Captured selfie"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSelfieDataUrl(null)
                          startCamera()
                        }}
                        className="w-full"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Retake Photo
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Date</label>
                  <div className="px-4 py-2 bg-gray-100 rounded-lg">
                    {format(new Date(), 'MMMM dd, yyyy')}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Time</label>
                  <div className="px-4 py-2 bg-gray-100 rounded-lg">
                    {format(new Date(), 'hh:mm a')}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">GPS Location</label>
                  <div className="px-4 py-2 bg-gray-100 rounded-lg flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">
                      {location ? location.address : 'Capturing location...'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button onClick={handleBackToList} variant="outline" className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleMarkAttendance} className="flex-1">
                    Mark Attendance
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {view === 'checkout' && selectedRecord && (
          <CheckoutFormDesktop
            selectedRecord={selectedRecord}
            selfieDataUrl={selfieDataUrl}
            location={location}
            isCameraActive={isCameraActive}
            videoRef={videoRef}
            canvasRef={canvasRef}
            onStartCamera={startCamera}
            onStopCamera={stopCamera}
            onCaptureSelfie={captureSelfie}
            onRetake={() => {
              setSelfieDataUrl(null)
              startCamera()
            }}
            onSubmit={handleCheckoutSubmit}
            onBack={handleBackToList}
          />
        )}

        {view === 'details' && selectedRecord && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <Button onClick={handleBackToList} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h2 className="text-2xl font-bold">Attendance Details - {selectedRecord.admin_user?.full_name}</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Check-In Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    Check-In Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <Calendar className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Date</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {format(new Date(selectedRecord.date), 'MMMM dd, yyyy')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="bg-green-100 p-2 rounded-lg">
                        <Clock className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Time</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {format(new Date(selectedRecord.check_in_time), 'hh:mm a')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="bg-purple-100 p-2 rounded-lg">
                        <MapPin className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 font-medium mb-1">Location</p>
                        {selectedRecord.check_in_location ? (
                          <>
                            <p className="text-sm text-gray-800 mb-2">
                              {selectedRecord.check_in_location.address}
                            </p>
                            <button
                              onClick={() => window.open(`https://www.google.com/maps?q=${selectedRecord.check_in_location!.lat},${selectedRecord.check_in_location!.lng}`, '_blank')}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium underline"
                            >
                              View on Map
                            </button>
                          </>
                        ) : (
                          <p className="text-sm text-gray-500">Not available</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-2">Selfie</p>
                      {selectedRecord.check_in_selfie_url ? (
                        <img
                          src={selectedRecord.check_in_selfie_url}
                          alt="Check-in selfie"
                          className="w-full h-64 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(selectedRecord.check_in_selfie_url!, '_blank')}
                        />
                      ) : (
                        <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
                          <Camera className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Check-Out Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    Check-Out Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedRecord.check_out_time ? (
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <Calendar className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Date</p>
                          <p className="text-sm font-semibold text-gray-800">
                            {format(new Date(selectedRecord.check_out_time), 'MMMM dd, yyyy')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="bg-red-100 p-2 rounded-lg">
                          <Clock className="w-4 h-4 text-red-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Time</p>
                          <p className="text-sm font-semibold text-gray-800">
                            {format(new Date(selectedRecord.check_out_time), 'hh:mm a')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="bg-purple-100 p-2 rounded-lg">
                          <MapPin className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 font-medium mb-1">Location</p>
                          {selectedRecord.check_out_location ? (
                            <>
                              <p className="text-sm text-gray-800 mb-2">
                                {selectedRecord.check_out_location.address}
                              </p>
                              <button
                                onClick={() => window.open(`https://www.google.com/maps?q=${selectedRecord.check_out_location!.lat},${selectedRecord.check_out_location!.lng}`, '_blank')}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium underline"
                              >
                                View on Map
                              </button>
                            </>
                          ) : (
                            <p className="text-sm text-gray-500">Not available</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 font-medium mb-2">Selfie</p>
                        {selectedRecord.check_out_selfie_url ? (
                          <img
                            src={selectedRecord.check_out_selfie_url}
                            alt="Check-out selfie"
                            className="w-full h-64 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(selectedRecord.check_out_selfie_url!, '_blank')}
                          />
                        ) : (
                          <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
                            <Camera className="w-12 h-12 text-gray-400" />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-8 text-center h-full flex flex-col items-center justify-center">
                      <Clock className="w-16 h-16 text-gray-300 mb-3" />
                      <p className="text-gray-500 font-medium">Not checked out yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Status & Notes */}
            <Card className="mt-6">
              <CardContent className="pt-6 space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Status</p>
                  <Badge className={statusColors[selectedRecord.status] || 'bg-gray-100 text-gray-800'}>
                    {selectedRecord.status}
                  </Badge>
                </div>

                {selectedRecord.notes && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">Notes</p>
                    <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3">
                      {selectedRecord.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Mobile View - App-like Experience */}
      <div className="md:hidden min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        {/* Mobile Header */}
        <div className="bg-gradient-to-r from-brand-primary to-blue-600 text-white px-4 py-6 shadow-lg">
          <h1 className="text-2xl font-bold mb-1">Attendance</h1>
          <p className="text-blue-100 text-sm">{format(new Date(), 'EEEE, MMMM dd, yyyy')}</p>
        </div>

        {/* Stats Cards */}
        <div className="px-4 -mt-4 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <motion.div
              whileTap={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-4 shadow-lg border border-green-100"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="bg-green-100 p-2 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-2xl font-bold text-green-600">{totalPresent}</span>
              </div>
              <p className="text-xs text-gray-600 font-medium">Present</p>
            </motion.div>

            <motion.div
              whileTap={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-4 shadow-lg border border-yellow-100"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="bg-yellow-100 p-2 rounded-xl">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <span className="text-2xl font-bold text-yellow-600">{totalLate}</span>
              </div>
              <p className="text-xs text-gray-600 font-medium">Late</p>
            </motion.div>

            <motion.div
              whileTap={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-4 shadow-lg border border-red-100"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="bg-red-100 p-2 rounded-xl">
                  <User className="w-5 h-5 text-red-600" />
                </div>
                <span className="text-2xl font-bold text-red-600">{totalAbsent}</span>
              </div>
              <p className="text-xs text-gray-600 font-medium">Absent</p>
            </motion.div>

            <motion.div
              whileTap={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-4 shadow-lg border border-blue-100"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="bg-blue-100 p-2 rounded-xl">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-2xl font-bold text-blue-600">{teamMembers.length}</span>
              </div>
              <p className="text-xs text-gray-600 font-medium">Total Staff</p>
            </motion.div>
          </div>
        </div>

        {/* Mark Attendance Button */}
        <div className="px-4 mb-4">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setLocation(null)
              setShowMarkModal(true)
            }}
            className="w-full bg-gradient-to-r from-brand-primary to-blue-600 text-white rounded-2xl py-4 px-6 shadow-lg flex items-center justify-center gap-3 font-semibold"
          >
            <Plus className="w-5 h-5" />
            Mark Attendance
          </motion.button>
        </div>

        {/* Recent Records */}
        <div className="px-4 pb-20">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Recent Records</h2>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
            </div>
          ) : attendance.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No records yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attendance.map((record) => (
                <motion.div
                  key={record.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleViewDetails(record)}
                  className="bg-white rounded-2xl p-4 shadow-md active:shadow-lg transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="w-12 h-12">
                          <AvatarFallback className="bg-gradient-to-br from-brand-primary to-blue-600 text-white text-lg">
                            {record.admin_user?.full_name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        {record.check_in_selfie_url && (
                          <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                            <Camera className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{record.admin_user?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{format(new Date(record.date), 'MMM dd, yyyy')}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span className="font-medium">{format(new Date(record.check_in_time), 'HH:mm')}</span>
                    </div>
                    {record.check_out_time ? (
                      <div className="flex items-center gap-2 text-gray-600">
                        <LogOut className="w-4 h-4" />
                        <span className="font-medium">{format(new Date(record.check_out_time), 'HH:mm')}</span>
                      </div>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-800 text-xs">Active</Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Details View */}
      <AnimatePresence>
        {view === 'details' && selectedRecord && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="md:hidden fixed inset-0 bg-white z-50 overflow-y-auto"
          >
            <div className="bg-gradient-to-r from-brand-primary to-blue-600 text-white px-4 py-6 sticky top-0 z-10">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={handleBackToList}>
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold">Attendance Details</h2>
              </div>
              <p className="text-sm text-white/90 ml-9">{selectedRecord.admin_user?.full_name}</p>
            </div>

            <div className="p-4 pb-24 space-y-4">
              {/* Check-In Section */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-green-600 mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  Check-In
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-xl">
                        <Calendar className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-sm text-gray-600">Date</span>
                    </div>
                    <span className="font-semibold text-gray-800 text-sm">
                      {format(new Date(selectedRecord.date), 'MMM dd, yyyy')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-xl">
                        <Clock className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="text-sm text-gray-600">Time</span>
                    </div>
                    <span className="font-semibold text-gray-800 text-sm">
                      {format(new Date(selectedRecord.check_in_time), 'hh:mm a')}
                    </span>
                  </div>

                  {selectedRecord.check_in_location && (
                    <div className="py-2 border-b">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="bg-purple-100 p-2 rounded-xl">
                          <MapPin className="w-4 h-4 text-purple-600" />
                        </div>
                        <span className="text-sm text-gray-600">Location</span>
                      </div>
                      <p className="text-xs text-gray-700 ml-11 mb-2">
                        {selectedRecord.check_in_location.address}
                      </p>
                      <button
                        onClick={() => window.open(`https://www.google.com/maps?q=${selectedRecord.check_in_location!.lat},${selectedRecord.check_in_location!.lng}`, '_blank')}
                        className="text-xs text-blue-600 font-medium underline ml-11"
                      >
                        View on Map
                      </button>
                    </div>
                  )}

                  <div className="pt-2">
                    <p className="text-xs text-gray-600 mb-2 flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      Selfie
                    </p>
                    {selectedRecord.check_in_selfie_url ? (
                      <img
                        src={selectedRecord.check_in_selfie_url}
                        alt="Check-in selfie"
                        className="w-full h-48 object-cover rounded-xl cursor-pointer"
                        onClick={() => window.open(selectedRecord.check_in_selfie_url!, '_blank')}
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-200 rounded-xl flex items-center justify-center">
                        <Camera className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Check-Out Section */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  Check-Out
                </h3>
                {selectedRecord.check_out_time ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-xl">
                          <Calendar className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="text-sm text-gray-600">Date</span>
                      </div>
                      <span className="font-semibold text-gray-800 text-sm">
                        {format(new Date(selectedRecord.check_out_time), 'MMM dd, yyyy')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-2 border-b">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-100 p-2 rounded-xl">
                          <Clock className="w-4 h-4 text-red-600" />
                        </div>
                        <span className="text-sm text-gray-600">Time</span>
                      </div>
                      <span className="font-semibold text-gray-800 text-sm">
                        {format(new Date(selectedRecord.check_out_time), 'hh:mm a')}
                      </span>
                    </div>

                    {selectedRecord.check_out_location && (
                      <div className="py-2 border-b">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="bg-purple-100 p-2 rounded-xl">
                            <MapPin className="w-4 h-4 text-purple-600" />
                          </div>
                          <span className="text-sm text-gray-600">Location</span>
                        </div>
                        <p className="text-xs text-gray-700 ml-11 mb-2">
                          {selectedRecord.check_out_location.address}
                        </p>
                        <button
                          onClick={() => window.open(`https://www.google.com/maps?q=${selectedRecord.check_out_location!.lat},${selectedRecord.check_out_location!.lng}`, '_blank')}
                          className="text-xs text-blue-600 font-medium underline ml-11"
                        >
                          View on Map
                        </button>
                      </div>
                    )}

                    <div className="pt-2">
                      <p className="text-xs text-gray-600 mb-2 flex items-center gap-2">
                        <Camera className="w-4 h-4" />
                        Selfie
                      </p>
                      {selectedRecord.check_out_selfie_url ? (
                        <img
                          src={selectedRecord.check_out_selfie_url}
                          alt="Check-out selfie"
                          className="w-full h-48 object-cover rounded-xl cursor-pointer"
                          onClick={() => window.open(selectedRecord.check_out_selfie_url!, '_blank')}
                        />
                      ) : (
                        <div className="w-full h-48 bg-gray-200 rounded-xl flex items-center justify-center">
                          <Camera className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium mb-4">Not checked out yet</p>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleInitiateCheckout(selectedRecord)}
                      className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl py-3 px-6 font-semibold flex items-center justify-center gap-2 mx-auto"
                    >
                      <LogOut className="w-5 h-5" />
                      Mark Check Out
                    </motion.button>
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <p className="text-sm font-medium text-gray-600 mb-2">Status</p>
                <Badge className={statusColors[selectedRecord.status] || 'bg-gray-100 text-gray-800'}>
                  {selectedRecord.status}
                </Badge>
                {selectedRecord.notes && (
                  <>
                    <p className="text-sm font-medium text-gray-600 mb-2 mt-4">Notes</p>
                    <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3">
                      {selectedRecord.notes}
                    </p>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Mark Attendance Page */}
      <AnimatePresence>
        {showMarkModal && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="md:hidden fixed inset-0 bg-white z-[60] overflow-y-auto"
          >
            <div className="bg-gradient-to-r from-brand-primary to-blue-600 text-white px-4 py-6 sticky top-0 z-10">
              <div className="flex items-center gap-3 mb-4">
                <button onClick={handleCloseModal}>
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold">Mark Attendance</h2>
              </div>
            </div>

            <div className="p-4 pb-24 space-y-6">
              {/* Employee Selection */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Select Employee *
                </label>
                <select
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose employee</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name} - {member.role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Camera Section */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Selfie Image *
                </label>

                {!selfieDataUrl ? (
                  <div className="space-y-4">
                    <div
                      className="relative bg-gray-900 rounded-2xl overflow-hidden"
                      style={{ aspectRatio: '4/3' }}
                    >
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover attendance-video"
                      />
                      {!isCameraActive && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                          <div className="text-center text-white">
                            <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p className="text-sm font-medium">Camera will appear here</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={isCameraActive ? captureSelfie : startCamera}
                        className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
                      >
                        <Camera className="w-5 h-5" />
                        {isCameraActive ? 'Capture Photo' : 'Start Camera'}
                      </motion.button>

                      {isCameraActive && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={stopCamera}
                          className="px-6 border-2 border-gray-300 rounded-xl font-semibold text-gray-700"
                        >
                          Cancel
                        </motion.button>
                      )}
                    </div>

                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div
                      className="relative bg-gray-100 rounded-2xl overflow-hidden"
                      style={{ aspectRatio: '4/3' }}
                    >
                      <img
                        src={selfieDataUrl}
                        alt="Captured selfie"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 right-3">
                        <div className="bg-green-500 rounded-full p-2">
                          <CheckCircle className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSelfieDataUrl(null)
                        startCamera()
                      }}
                      className="w-full border-2 border-gray-300 rounded-xl py-3 font-semibold text-gray-700 flex items-center justify-center gap-2"
                    >
                      <Camera className="w-5 h-5" />
                      Retake Photo
                    </motion.button>
                  </div>
                )}
              </div>

              {/* Date & Time Info */}
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
                <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-xl">
                      <Calendar className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-600">Date</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-800">
                    {format(new Date(), 'MMM dd, yyyy')}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-xl">
                      <Clock className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-600">Time</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-800">
                    {format(new Date(), 'hh:mm a')}
                  </span>
                </div>

                <div className="py-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-purple-100 p-2 rounded-xl">
                      <MapPin className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-600">GPS Location</span>
                  </div>
                  <p className="text-xs text-gray-500 ml-11">
                    {location ? location.address : 'Capturing location...'}
                  </p>
                </div>
              </div>
            </div>

            {/* Fixed Bottom Button */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-20">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleMarkAttendance}
                className="w-full bg-gradient-to-r from-brand-primary to-blue-600 text-white rounded-2xl py-4 font-bold text-lg shadow-lg flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Mark Attendance
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Checkout View */}
      <AnimatePresence>
        {view === 'checkout' && selectedRecord && (
          <CheckoutFormMobile
            selectedRecord={selectedRecord}
            selfieDataUrl={selfieDataUrl}
            location={location}
            isCameraActive={isCameraActive}
            videoRef={videoRef}
            canvasRef={canvasRef}
            onStartCamera={startCamera}
            onStopCamera={stopCamera}
            onCaptureSelfie={captureSelfie}
            onRetake={() => {
              setSelfieDataUrl(null)
              startCamera()
            }}
            onSubmit={handleCheckoutSubmit}
            onBack={handleBackToList}
            onClose={handleBackToList}
          />
        )}
      </AnimatePresence>
    </>
  )
}
