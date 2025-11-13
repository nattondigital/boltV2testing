import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar as CalendarIcon, Clock, MapPin, Phone, Mail, User, Video, Users, CheckCircle, XCircle, AlertCircle, Plus, Eye, Edit, Trash2, Save, ArrowLeft, ChevronRight, RefreshCw, Filter, Search, X } from 'lucide-react'
import { PageHeader } from '@/components/Common/PageHeader'
import { KPICard } from '@/components/Common/KPICard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase'
import { formatDate, formatTime, formatDateTime, getISTDateString, formatLongDate } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { PermissionGuard } from '@/components/Common/PermissionGuard'

interface Contact {
  id: string
  contact_id: string
  full_name: string
  phone: string
  email: string | null
  business_name: string | null
}

interface CalendarAvailability {
  enabled: boolean
  slots: Array<{ start: string; end: string }>
}

interface Calendar {
  id: string
  calendar_id: string
  title: string
  description: string | null
  slot_duration: number
  meeting_type: string[]
  default_location: string | null
  color: string
  is_active: boolean
  availability: {
    monday: CalendarAvailability
    tuesday: CalendarAvailability
    wednesday: CalendarAvailability
    thursday: CalendarAvailability
    friday: CalendarAvailability
    saturday: CalendarAvailability
    sunday: CalendarAvailability
  }
  buffer_time: number
  max_bookings_per_slot: number
}

interface Appointment {
  id: string
  appointment_id: string
  title: string
  contact_id: string | null
  contact_name: string
  contact_phone: string
  contact_email: string | null
  appointment_date: string
  appointment_time: string
  duration_minutes: number
  location: string | null
  meeting_type: string
  status: string
  purpose: string
  notes: string | null
  reminder_sent: boolean
  assigned_to: string | null
  created_at: string
  updated_at: string
}

const statusColors: Record<string, string> = {
  'Scheduled': 'bg-blue-100 text-blue-800',
  'Confirmed': 'bg-green-100 text-green-800',
  'Completed': 'bg-gray-100 text-gray-800',
  'Cancelled': 'bg-red-100 text-red-800',
  'No-Show': 'bg-orange-100 text-orange-800'
}

const meetingTypeColors: Record<string, string> = {
  'In-Person': 'bg-purple-100 text-purple-800',
  'Video Call': 'bg-blue-100 text-blue-800',
  'Phone Call': 'bg-green-100 text-green-800'
}

const purposeColors: Record<string, string> = {
  'Sales Meeting': 'bg-green-50 text-green-700',
  'Product Demo': 'bg-blue-50 text-blue-700',
  'Follow-up': 'bg-yellow-50 text-yellow-700',
  'Consultation': 'bg-purple-50 text-purple-700',
  'Other': 'bg-gray-50 text-gray-700'
}

const meetingTypeIcons: Record<string, string> = {
  'In-Person': '👥',
  'Video Call': '🎥',
  'Phone Call': '📞'
}

type ViewType = 'list' | 'add' | 'edit' | 'view'

export function Appointments() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userMobile, canCreate, canUpdate, canDelete, shouldFilterByUser, userProfile } = useAuth()
  const [view, setView] = useState<ViewType>('list')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [meetingTypeFilter, setMeetingTypeFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null)
  const [contactSearchTerm, setContactSearchTerm] = useState('')
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  const [availableSlots, setAvailableSlots] = useState<Array<{time: string, available: number, total: number}>>([])
  const [returnTo, setReturnTo] = useState<string | null>(null)
  const [returnToContactId, setReturnToContactId] = useState<string | null>(null)
  const [returnToLeadId, setReturnToLeadId] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    appointmentDate: '',
    appointmentTime: '',
    durationMinutes: '30',
    location: '',
    meetingType: 'In-Person',
    status: 'Scheduled',
    purpose: 'Sales Meeting',
    notes: ''
  })

  const fetchAppointments = async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (shouldFilterByUser() && userProfile?.id) {
        const { data: userCalendars, error: calendarError } = await supabase
          .from('calendars')
          .select('id')
          .eq('assigned_user_id', userProfile.id)

        if (calendarError) throw calendarError

        const calendarIds = (userCalendars || []).map(cal => cal.id)

        if (calendarIds.length === 0) {
          setAppointments([])
          setIsLoading(false)
          return
        }

        const { data, error: fetchError } = await supabase
          .from('appointments')
          .select('*')
          .in('calendar_id', calendarIds)
          .order('appointment_date', { ascending: true })
          .order('appointment_time', { ascending: true })

        if (fetchError) throw fetchError
        setAppointments(data || [])
      } else {
        const { data, error: fetchError } = await supabase
          .from('appointments')
          .select('*')
          .order('appointment_date', { ascending: true })
          .order('appointment_time', { ascending: true })

        if (fetchError) throw fetchError
        setAppointments(data || [])
      }
    } catch (error) {
      console.error('Error fetching appointments:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch appointments')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAppointments()
    fetchContacts()
    fetchCalendars()
    fetchCurrentUser()
    updatePastAppointments()
  }, [])

  const updatePastAppointments = async () => {
    try {
      const now = new Date()
      const currentDate = now.toISOString().split('T')[0]
      const currentTime = now.toTimeString().slice(0, 5)

      const { data: pastAppointments, error: fetchError } = await supabase
        .from('appointments')
        .select('*')
        .in('status', ['Scheduled', 'Confirmed'])
        .or(`appointment_date.lt.${currentDate},and(appointment_date.eq.${currentDate},appointment_time.lt.${currentTime})`)

      if (fetchError) throw fetchError

      if (pastAppointments && pastAppointments.length > 0) {
        const updatePromises = pastAppointments.map(appointment =>
          supabase
            .from('appointments')
            .update({ status: 'No-Show' })
            .eq('id', appointment.id)
        )

        await Promise.all(updatePromises)
      }
    } catch (error) {
      console.error('Error updating past appointments:', error)
    }
  }

  const fetchCurrentUser = async () => {
    if (userMobile) {
      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('id')
          .eq('phone', userMobile)
          .maybeSingle()

        if (error) throw error
        if (data) {
          setCurrentUserId(data.id)
        }
      } catch (error) {
        console.error('Error fetching current user:', error)
      }
    }
  }

  useEffect(() => {
    const handleNavigationState = async () => {
      if (location.state?.action === 'add' && location.state?.prefilledContact) {
        const contact = location.state.prefilledContact

        // Preserve return navigation state
        if (location.state?.returnTo) {
          setReturnTo(location.state.returnTo)
        }
        if (location.state?.returnToContactId) {
          setReturnToContactId(location.state.returnToContactId)
        }
        if (location.state?.returnToLeadId) {
          setReturnToLeadId(location.state.returnToLeadId)
        }

        setSelectedContactId(contact.id)
        setContactSearchTerm(contact.full_name)
        setFormData(prev => ({
          ...prev,
          contactName: contact.full_name,
          contactPhone: contact.phone,
          contactEmail: contact.email || ''
        }))

        if (calendars.length > 0 && !selectedCalendarId) {
          setSelectedCalendarId(calendars[0].id)
        }

        setView('add')
        window.history.replaceState({}, document.title)
      } else if (location.state?.action === 'edit' && location.state?.appointmentId) {
        try {
          // Preserve return navigation state
          if (location.state?.returnTo) {
            setReturnTo(location.state.returnTo)
          }
          if (location.state?.returnToContactId) {
            setReturnToContactId(location.state.returnToContactId)
          }
          if (location.state?.returnToLeadId) {
            setReturnToLeadId(location.state.returnToLeadId)
          }

          const { data: appointment, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('id', location.state.appointmentId)
            .single()

          if (error) throw error

          if (appointment) {
            setSelectedAppointment(appointment)
            setSelectedContactId(appointment.contact_id)
            setSelectedCalendarId(appointment.calendar_id)
            setContactSearchTerm(appointment.contact_name)
            setFormData({
              title: appointment.title,
              contactName: appointment.contact_name,
              contactPhone: appointment.contact_phone,
              contactEmail: appointment.contact_email || '',
              appointmentDate: appointment.appointment_date,
              appointmentTime: appointment.appointment_time,
              durationMinutes: appointment.duration_minutes.toString(),
              location: appointment.location || '',
              meetingType: appointment.meeting_type,
              status: appointment.status,
              purpose: appointment.purpose,
              notes: appointment.notes || ''
            })

            // Generate available slots for the selected calendar and date
            const calendar = calendars.find(c => c.id === appointment.calendar_id)
            if (calendar && appointment.appointment_date) {
              generateAvailableSlots(calendar, appointment.appointment_date)
              setSelectedSlot(appointment.appointment_time)
            }

            setView('edit')
          }
        } catch (error) {
          console.error('Error fetching appointment:', error)
        }
        window.history.replaceState({}, document.title)
      }
    }

    handleNavigationState()
  }, [location.state, calendars, selectedCalendarId])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.contact-search-container')) {
        setShowContactDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchContacts = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('contacts_master')
        .select('id, contact_id, full_name, phone, email, business_name')
        .eq('status', 'Active')
        .order('full_name', { ascending: true })

      if (fetchError) throw fetchError
      setContacts(data || [])
    } catch (error) {
      console.error('Error fetching contacts:', error)
    }
  }

  const fetchCalendars = async () => {
    try {
      let query = supabase
        .from('calendars')
        .select('id, calendar_id, title, description, slot_duration, meeting_type, default_location, color, is_active, availability, buffer_time, max_bookings_per_slot')
        .eq('is_active', true)
        .order('title', { ascending: true })

      if (shouldFilterByUser() && userProfile?.id) {
        query = query.eq('assigned_user_id', userProfile.id)
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError
      setCalendars(data || [])
    } catch (error) {
      console.error('Error fetching calendars:', error)
    }
  }

  const handleBackNavigation = () => {
    if (returnTo === '/contacts' && returnToContactId) {
      navigate('/contacts', {
        state: {
          returnToContactId,
          refreshAppointments: true
        }
      })
    } else if (returnTo === '/leads' && returnToLeadId) {
      navigate('/leads', {
        state: {
          returnToLeadId,
          refreshAppointments: true
        }
      })
    } else {
      setView('list')
      resetForm()
    }
  }

  const getDateRange = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    switch (periodFilter) {
      case 'today': {
        const start = today.toISOString().split('T')[0]
        return { start, end: start }
      }
      case 'tomorrow': {
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const date = tomorrow.toISOString().split('T')[0]
        return { start: date, end: date }
      }
      case 'this_week': {
        const start = new Date(today)
        const end = new Date(today)
        const dayOfWeek = today.getDay()
        start.setDate(today.getDate() - dayOfWeek)
        end.setDate(today.getDate() + (6 - dayOfWeek))
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        }
      }
      case 'next_week': {
        const start = new Date(today)
        const end = new Date(today)
        const dayOfWeek = today.getDay()
        start.setDate(today.getDate() + (7 - dayOfWeek))
        end.setDate(start.getDate() + 6)
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        }
      }
      case 'this_month': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1)
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        }
      }
      case 'next_month': {
        const start = new Date(today.getFullYear(), today.getMonth() + 1, 1)
        const end = new Date(today.getFullYear(), today.getMonth() + 2, 0)
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        }
      }
      case 'custom': {
        if (customStartDate && customEndDate) {
          return { start: customStartDate, end: customEndDate }
        }
        return null
      }
      default:
        return null
    }
  }

  const filteredAppointments = appointments.filter(appointment => {
    const matchesSearch = (appointment.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (appointment.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (appointment.contact_phone || '').includes(searchTerm) ||
                         (appointment.appointment_id || '').toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = !statusFilter || appointment.status === statusFilter
    const matchesMeetingType = !meetingTypeFilter || appointment.meeting_type === meetingTypeFilter

    let matchesPeriod = true
    if (periodFilter && periodFilter !== '') {
      const dateRange = getDateRange()
      if (dateRange) {
        const appointmentDate = appointment.appointment_date
        matchesPeriod = appointmentDate >= dateRange.start && appointmentDate <= dateRange.end
      }
    }

    const now = new Date()
    const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`)
    const isPastAppointment = appointmentDateTime < now

    const isActiveStatus = appointment.status === 'Scheduled' || appointment.status === 'Confirmed'

    if (isPastAppointment && isActiveStatus) {
      return false
    }

    return matchesSearch && matchesStatus && matchesMeetingType && matchesPeriod
  })

  const totalAppointments = appointments.length
  const scheduledAppointments = appointments.filter(a => a.status === 'Scheduled').length
  const confirmedAppointments = appointments.filter(a => a.status === 'Confirmed').length
  const completedAppointments = appointments.filter(a => a.status === 'Completed').length

  const handleCreateAppointment = async () => {
    try {
      const { error: insertError } = await supabase
        .from('appointments')
        .insert({
          title: formData.title,
          calendar_id: selectedCalendarId,
          contact_id: selectedContactId,
          contact_name: formData.contactName,
          contact_phone: formData.contactPhone,
          contact_email: formData.contactEmail || null,
          appointment_date: formData.appointmentDate,
          appointment_time: formData.appointmentTime,
          duration_minutes: parseInt(formData.durationMinutes),
          location: formData.location || null,
          meeting_type: formData.meetingType,
          status: formData.status,
          purpose: formData.purpose,
          notes: formData.notes || null,
          created_by: currentUserId
        })

      if (insertError) throw insertError

      fetchAppointments()
      handleBackNavigation()
    } catch (error) {
      console.error('Error creating appointment:', error)
      setError(error instanceof Error ? error.message : 'Failed to create appointment')
    }
  }

  const handleEditAppointment = async () => {
    if (!selectedAppointment) return

    try {
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          title: formData.title,
          calendar_id: selectedCalendarId,
          contact_id: selectedContactId,
          contact_name: formData.contactName,
          contact_phone: formData.contactPhone,
          contact_email: formData.contactEmail || null,
          appointment_date: formData.appointmentDate,
          appointment_time: formData.appointmentTime,
          duration_minutes: parseInt(formData.durationMinutes),
          location: formData.location || null,
          meeting_type: formData.meetingType,
          status: formData.status,
          purpose: formData.purpose,
          notes: formData.notes || null
        })
        .eq('id', selectedAppointment.id)

      if (updateError) throw updateError

      fetchAppointments()
      handleBackNavigation()
    } catch (error) {
      console.error('Error updating appointment:', error)
      setError(error instanceof Error ? error.message : 'Failed to update appointment')
    }
  }

  const handleDeleteAppointment = async (appointmentId: string) => {
    if (confirm('Are you sure you want to delete this appointment?')) {
      try {
        const { error: deleteError } = await supabase
          .from('appointments')
          .delete()
          .eq('id', appointmentId)

        if (deleteError) throw deleteError
        fetchAppointments()
      } catch (error) {
        console.error('Error deleting appointment:', error)
        setError(error instanceof Error ? error.message : 'Failed to delete appointment')
      }
    }
  }

  const handleEditClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setSelectedContactId(appointment.contact_id)
    setSelectedCalendarId(appointment.calendar_id)
    setContactSearchTerm(appointment.contact_name)
    setFormData({
      title: appointment.title,
      contactName: appointment.contact_name,
      contactPhone: appointment.contact_phone,
      contactEmail: appointment.contact_email || '',
      appointmentDate: appointment.appointment_date,
      appointmentTime: appointment.appointment_time,
      durationMinutes: appointment.duration_minutes.toString(),
      location: appointment.location || '',
      meetingType: appointment.meeting_type,
      status: appointment.status,
      purpose: appointment.purpose,
      notes: appointment.notes || ''
    })

    // Generate available slots for the selected calendar and date
    const calendar = calendars.find(c => c.id === appointment.calendar_id)
    if (calendar && appointment.appointment_date) {
      generateAvailableSlots(calendar, appointment.appointment_date)
      setSelectedSlot(appointment.appointment_time)
    }

    setView('edit')
  }

  const handleViewAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setView('view')
  }

  const resetForm = () => {
    setFormData({
      title: '',
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      appointmentDate: '',
      appointmentTime: '',
      durationMinutes: '30',
      location: '',
      meetingType: 'In-Person',
      status: 'Scheduled',
      purpose: 'Sales Meeting',
      notes: ''
    })
    setSelectedAppointment(null)
    setSelectedContactId(null)
    setSelectedCalendarId(null)
    setContactSearchTerm('')
    setShowContactDropdown(false)
    setAvailableSlots([])
    setSelectedSlot(null)
  }

  const handleCalendarSelect = (calendarId: string) => {
    const calendar = calendars.find(c => c.id === calendarId)
    if (calendar) {
      setSelectedCalendarId(calendarId)
      setFormData(prev => ({
        ...prev,
        title: calendar.title,
        durationMinutes: calendar.slot_duration.toString(),
        location: calendar.default_location || '',
        meetingType: calendar.meeting_type.length > 0 ? calendar.meeting_type[0] : 'In-Person',
        appointmentTime: ''
      }))
      setSelectedSlot(null)
      if (formData.appointmentDate) {
        generateAvailableSlots(calendar, formData.appointmentDate)
      }
    }
  }

  const generateAvailableSlots = async (calendar: Calendar, date: string) => {
    const selectedDate = new Date(date + 'T00:00:00')
    const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const dayAvailability = calendar.availability[dayOfWeek as keyof typeof calendar.availability]

    if (!dayAvailability || !dayAvailability.enabled) {
      setAvailableSlots([])
      return
    }

    const slots: string[] = []
    const slotDuration = calendar.slot_duration
    const bufferTime = calendar.buffer_time || 0

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const isToday = date === today
    const currentMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : 0

    dayAvailability.slots.forEach(timeSlot => {
      const [startHour, startMinute] = timeSlot.start.split(':').map(Number)
      const [endHour, endMinute] = timeSlot.end.split(':').map(Number)

      let currentTime = startHour * 60 + startMinute
      const endTime = endHour * 60 + endMinute

      while (currentTime + slotDuration <= endTime) {
        if (!isToday || currentTime > currentMinutes) {
          const hours = Math.floor(currentTime / 60)
          const minutes = currentTime % 60
          const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
          slots.push(timeString)
        }
        currentTime += slotDuration + bufferTime
      }
    })

    // Fetch existing bookings for this calendar and date
    try {
      // Check for appointments linked to this calendar OR without any calendar
      // This prevents double-booking the same time slot
      const { data: existingBookings, error } = await supabase
        .from('appointments')
        .select('appointment_time')
        .eq('appointment_date', date)
        .in('status', ['Scheduled', 'Confirmed'])
        .or(`calendar_id.eq.${calendar.id},calendar_id.is.null`)

      if (error) throw error

      // Normalize time format helper (HH:MM:SS -> HH:MM)
      const normalizeTime = (time: string) => {
        if (!time) return time
        const parts = time.split(':')
        return `${parts[0]}:${parts[1]}`
      }

      // Count bookings per slot
      const bookingCounts: Record<string, number> = {}
      existingBookings?.forEach(booking => {
        const normalizedTime = normalizeTime(booking.appointment_time)
        bookingCounts[normalizedTime] = (bookingCounts[normalizedTime] || 0) + 1
      })

      // Create slot objects with availability info
      const slotsWithAvailability = slots.map(time => ({
        time,
        available: calendar.max_bookings_per_slot - (bookingCounts[time] || 0),
        total: calendar.max_bookings_per_slot
      }))

      setAvailableSlots(slotsWithAvailability)
    } catch (error) {
      console.error('Error fetching existing bookings:', error)
      // Fallback to showing all slots if there's an error
      setAvailableSlots(slots.map(time => ({ time, available: calendar.max_bookings_per_slot, total: calendar.max_bookings_per_slot })))
    }
  }

  const handleDateChange = async (date: string) => {
    setFormData(prev => ({ ...prev, appointmentDate: date, appointmentTime: '' }))
    setSelectedSlot(null)

    const calendar = calendars.find(c => c.id === selectedCalendarId)
    if (calendar && date) {
      await generateAvailableSlots(calendar, date)
    } else {
      setAvailableSlots([])
    }
  }

  const handleSlotSelect = (slot: string) => {
    setSelectedSlot(slot)
    setFormData(prev => ({ ...prev, appointmentTime: slot }))
  }

  const handleContactSelect = (contact: Contact) => {
    setSelectedContactId(contact.id)
    setContactSearchTerm(contact.full_name)
    setFormData(prev => ({
      ...prev,
      contactName: contact.full_name,
      contactPhone: contact.phone,
      contactEmail: contact.email || ''
    }))
    setShowContactDropdown(false)
  }

  const filteredContacts = contacts.filter(contact =>
    contact.full_name.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
    contact.phone.includes(contactSearchTerm) ||
    (contact.email && contact.email.toLowerCase().includes(contactSearchTerm.toLowerCase()))
  )

  return (
    <>
      {/* Desktop View */}
      <div className="hidden md:block ppt-slide p-6">
        {view === 'list' && (
          <PageHeader
            title="Appointments"
            subtitle="Manage and track all your sales appointments"
            actions={[
              ...(canCreate('appointments') ? [{
                label: 'Add Appointment',
                onClick: () => setView('add'),
                variant: 'default' as const,
                icon: Plus
              }] : [])
            ]}
          />
        )}

        {view === 'list' && (
          <>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center py-12"
              >
                <div className="flex items-center space-x-3">
                  <RefreshCw className="w-6 h-6 text-brand-primary animate-spin" />
                  <span className="text-lg text-gray-600">Loading appointments...</span>
                </div>
              </motion.div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
              >
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <div>
                    <div className="font-medium text-red-800">Error loading appointments</div>
                    <div className="text-sm text-red-600">{error}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchAppointments}
                    className="ml-auto"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </motion.div>
            )}

            {!isLoading && !error && (
              <>
                <motion.div
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: { staggerChildren: 0.1 }
                    }
                  }}
                >
                  <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                    <KPICard
                      title="Total Appointments"
                      value={totalAppointments}
                      change={12}
                      icon={CalendarIcon}
                      category="primary"
                    />
                  </motion.div>
                  <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                    <KPICard
                      title="Scheduled"
                      value={scheduledAppointments}
                      change={8}
                      icon={Clock}
                      category="secondary"
                    />
                  </motion.div>
                  <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                    <KPICard
                      title="Confirmed"
                      value={confirmedAppointments}
                      change={15}
                      icon={CheckCircle}
                      category="success"
                    />
                  </motion.div>
                  <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                    <KPICard
                      title="Completed"
                      value={completedAppointments}
                      change={5}
                      icon={Users}
                      category="secondary"
                    />
                  </motion.div>
                </motion.div>

                <motion.div
                  className="mb-6 flex gap-4 flex-wrap"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Input
                    placeholder="Search appointments by title, contact, phone, or ID..."
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
                    <option value="Scheduled">Scheduled</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="No-Show">No-Show</option>
                  </select>
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    value={meetingTypeFilter}
                    onChange={(e) => setMeetingTypeFilter(e.target.value)}
                  >
                    <option value="">All Types</option>
                    <option value="In-Person">In-Person</option>
                    <option value="Video Call">Video Call</option>
                    <option value="Phone Call">Phone Call</option>
                  </select>
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    value={periodFilter}
                    onChange={(e) => {
                      setPeriodFilter(e.target.value)
                      if (e.target.value !== 'custom') {
                        setCustomStartDate('')
                        setCustomEndDate('')
                      }
                    }}
                  >
                    <option value="">All Period</option>
                    <option value="today">Today</option>
                    <option value="tomorrow">Tomorrow</option>
                    <option value="this_week">This Week</option>
                    <option value="next_week">Next Week</option>
                    <option value="this_month">This Month</option>
                    <option value="next_month">Next Month</option>
                    <option value="custom">Custom Range</option>
                  </select>
                  {periodFilter === 'custom' && (
                    <>
                      <Input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        placeholder="Start Date"
                        className="w-40"
                      />
                      <Input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        placeholder="End Date"
                        className="w-40"
                      />
                    </>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mb-8"
                >
                  <Card className="shadow-xl">
                    <CardHeader>
                      <CardTitle>All Appointments</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-4 font-semibold text-brand-text">Appointment ID</th>
                              <th className="text-left py-3 px-4 font-semibold text-brand-text">Title</th>
                              <th className="text-left py-3 px-4 font-semibold text-brand-text">Contact</th>
                              <th className="text-left py-3 px-4 font-semibold text-brand-text">Date & Time</th>
                              <th className="text-left py-3 px-4 font-semibold text-brand-text">Type</th>
                              <th className="text-left py-3 px-4 font-semibold text-brand-text">Purpose</th>
                              <th className="text-left py-3 px-4 font-semibold text-brand-text">Status</th>
                              <th className="text-left py-3 px-4 font-semibold text-brand-text">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAppointments.map((appointment, index) => (
                              <motion.tr
                                key={appointment.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * index }}
                                className="border-b border-gray-100 hover:bg-gray-50"
                              >
                                <td className="py-3 px-4 font-mono text-sm">{appointment.appointment_id}</td>
                                <td className="py-3 px-4">
                                  <div className="font-medium">{appointment.title}</div>
                                </td>
                                <td className="py-3 px-4">
                                  <div>
                                    <div className="font-medium">{appointment.contact_name}</div>
                                    <div className="text-sm text-gray-500">{appointment.contact_phone}</div>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center space-x-2 text-sm">
                                      <CalendarIcon className="w-4 h-4 text-gray-400" />
                                      <span>{formatDate(appointment.appointment_date)}</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-sm">
                                      <Clock className="w-4 h-4 text-gray-400" />
                                      <span>{formatTime(appointment.appointment_time)} ({appointment.duration_minutes}m)</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <Badge className={meetingTypeColors[appointment.meeting_type]}>
                                    {appointment.meeting_type}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4">
                                  <Badge className={purposeColors[appointment.purpose]}>
                                    {appointment.purpose}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4">
                                  <Badge className={statusColors[appointment.status]}>
                                    {appointment.status}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="sm" variant="ghost">
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleViewAppointment(appointment)}>
                                        <Eye className="w-4 h-4 mr-2" />
                                        View Details
                                      </DropdownMenuItem>
                                      {canUpdate('appointments') && (
                                        <DropdownMenuItem onClick={() => handleEditClick(appointment)}>
                                          <Edit className="w-4 h-4 mr-2" />
                                          Edit Appointment
                                        </DropdownMenuItem>
                                      )}
                                      {canDelete('appointments') && (
                                        <DropdownMenuItem
                                          onClick={() => handleDeleteAppointment(appointment.id)}
                                          className="text-red-600 focus:text-red-600"
                                        >
                                          <Trash2 className="w-4 h-4 mr-2" />
                                          Delete Appointment
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </>
            )}
          </>
        )}

        {/* Add/Edit Form */}
        {(view === 'add' || view === 'edit') && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <Button
                  variant="ghost"
                  onClick={handleBackNavigation}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              </div>

              <div className="space-y-6">
                {/* Calendar Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <CalendarIcon className="w-4 h-4 inline-block mr-1" />
                    Calendar *
                  </label>
                  <Select value={selectedCalendarId || ''} onValueChange={handleCalendarSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a calendar" />
                    </SelectTrigger>
                    <SelectContent className="z-[70]">
                      {calendars.map((calendar) => (
                        <SelectItem key={calendar.id} value={calendar.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: calendar.color }}
                            />
                            <span>{calendar.title}</span>
                            <span className="text-xs text-gray-500">({calendar.slot_duration}m)</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {calendars.length === 0 && (
                    <p className="text-sm text-gray-500 mt-1">No active calendars available</p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Appointment Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter appointment title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Purpose *</label>
                      <Select value={formData.purpose} onValueChange={(value) => setFormData(prev => ({ ...prev, purpose: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select purpose" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sales Meeting">Sales Meeting</SelectItem>
                          <SelectItem value="Product Demo">Product Demo</SelectItem>
                          <SelectItem value="Follow-up">Follow-up</SelectItem>
                          <SelectItem value="Consultation">Consultation</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 relative contact-search-container">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Search Contact *</label>
                      <div className="relative">
                        <Input
                          value={contactSearchTerm}
                          onChange={(e) => {
                            setContactSearchTerm(e.target.value)
                            setShowContactDropdown(true)
                          }}
                          onFocus={() => setShowContactDropdown(true)}
                          placeholder="Search contact by name, phone, or email..."
                          className="pr-20"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          {contactSearchTerm && (
                            <button
                              onClick={() => {
                                setContactSearchTerm('')
                                setSelectedContactId(null)
                                setFormData(prev => ({
                                  ...prev,
                                  contactName: '',
                                  contactPhone: '',
                                  contactEmail: ''
                                }))
                              }}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              <X className="w-4 h-4 text-gray-400" />
                            </button>
                          )}
                          <Search className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>

                      {showContactDropdown && filteredContacts.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredContacts.map((contact) => (
                            <button
                              key={contact.id}
                              onClick={() => handleContactSelect(contact)}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium text-gray-900">{contact.full_name}</div>
                                  <div className="text-sm text-gray-600">{contact.phone}</div>
                                  {contact.email && (
                                    <div className="text-xs text-gray-500">{contact.email}</div>
                                  )}
                                </div>
                                {contact.business_name && (
                                  <div className="text-xs text-gray-500">{contact.business_name}</div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {showContactDropdown && contactSearchTerm && filteredContacts.length === 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
                          No contacts found
                        </div>
                      )}
                    </div>

                    {selectedContactId && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Contact Name</label>
                          <Input
                            value={formData.contactName}
                            disabled
                            className="bg-gray-50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Contact Phone</label>
                          <Input
                            value={formData.contactPhone}
                            disabled
                            className="bg-gray-50"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
                          <Input
                            type="email"
                            value={formData.contactEmail}
                            disabled
                            className="bg-gray-50"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Schedule & Meeting Type</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date * (dd/mm/yyyy)</label>
                      <Input
                        type="date"
                        value={formData.appointmentDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        min={getISTDateString()}
                      />
                    </div>

                    {selectedCalendarId && formData.appointmentDate ? (
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Available Time Slots *</label>
                        {availableSlots.length > 0 ? (
                          <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto p-2 bg-gray-50 rounded-lg">
                            {availableSlots.map((slot) => {
                              const isSelected = selectedSlot === slot.time
                              const isFullyBooked = slot.available <= 0
                              const hasLimitedAvailability = slot.available > 0 && slot.available < slot.total

                              return (
                                <button
                                  key={slot.time}
                                  type="button"
                                  onClick={() => !isFullyBooked && handleSlotSelect(slot.time)}
                                  disabled={isFullyBooked}
                                  className={`px-4 py-3 rounded-lg border-2 transition-all font-medium relative ${
                                    isFullyBooked
                                      ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : isSelected
                                      ? 'border-green-500 bg-green-50 text-green-700'
                                      : hasLimitedAvailability
                                      ? 'border-orange-300 bg-orange-50 hover:border-orange-400 text-orange-700'
                                      : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50 text-gray-700'
                                  }`}
                                >
                                  <div className="text-center">
                                    <div>{slot.time}</div>
                                    {slot.total > 1 && (
                                      <div className="text-xs mt-1">
                                        {isFullyBooked ? (
                                          <span className="text-red-600">Full</span>
                                        ) : hasLimitedAvailability ? (
                                          <span className="text-orange-600">{slot.available}/{slot.total} left</span>
                                        ) : (
                                          <span className="text-green-600">{slot.available} spots</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                            <AlertCircle className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                            <p className="text-sm text-yellow-800 font-medium">No available slots for this date</p>
                            <p className="text-xs text-yellow-600 mt-1">This calendar is not available on the selected date</p>
                          </div>
                        )}
                      </div>
                    ) : !selectedCalendarId && formData.appointmentDate ? (
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Time *</label>
                        <Input
                          type="time"
                          value={formData.appointmentTime}
                          onChange={(e) => setFormData(prev => ({ ...prev, appointmentTime: e.target.value }))}
                        />
                        <p className="text-xs text-gray-500 mt-1">Select a calendar to see available time slots</p>
                      </div>
                    ) : null}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
                      <Input
                        type="number"
                        value={formData.durationMinutes}
                        onChange={(e) => setFormData(prev => ({ ...prev, durationMinutes: e.target.value }))}
                        placeholder="30"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Type *</label>
                      <Select value={formData.meetingType} onValueChange={(value) => setFormData(prev => ({ ...prev, meetingType: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="In-Person">In-Person</SelectItem>
                          <SelectItem value="Video Call">Video Call</SelectItem>
                          <SelectItem value="Phone Call">Phone Call</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                      <Input
                        value={formData.location}
                        onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="Enter meeting location or video call link"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                      <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Scheduled">Scheduled</SelectItem>
                          <SelectItem value="Confirmed">Confirmed</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                          <SelectItem value="No-Show">No-Show</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    rows={4}
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add any additional notes..."
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3 mt-6">
                <Button
                  onClick={view === 'add' ? handleCreateAppointment : handleEditAppointment}
                  disabled={!formData.title || !selectedContactId || !selectedCalendarId || !formData.appointmentDate || !formData.appointmentTime}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {view === 'add' ? 'Create Appointment' : 'Save Changes'}
                </Button>
                <Button variant="outline" onClick={handleBackNavigation}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* View Details */}
        {view === 'view' && selectedAppointment && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <Button
                  variant="ghost"
                  onClick={handleBackNavigation}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-brand-text mb-2">{selectedAppointment.title}</h3>
                      <div className="flex items-center space-x-3">
                        <Badge className={statusColors[selectedAppointment.status]}>
                          {selectedAppointment.status}
                        </Badge>
                        <Badge className={meetingTypeColors[selectedAppointment.meeting_type]}>
                          {selectedAppointment.meeting_type}
                        </Badge>
                        <Badge className={purposeColors[selectedAppointment.purpose]}>
                          {selectedAppointment.purpose}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      ID: {selectedAppointment.appointment_id}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-brand-text mb-3">Schedule Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3">
                      <CalendarIcon className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="text-sm text-gray-600">Date</div>
                        <div className="font-medium">{formatDate(selectedAppointment.appointment_date)}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Clock className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="text-sm text-gray-600">Time</div>
                        <div className="font-medium">{formatTime(selectedAppointment.appointment_time)} ({selectedAppointment.duration_minutes} minutes)</div>
                      </div>
                    </div>
                    {selectedAppointment.location && (
                      <div className="flex items-center space-x-3 col-span-2">
                        <MapPin className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="text-sm text-gray-600">Location</div>
                          <div className="font-medium">{selectedAppointment.location}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-brand-text mb-3">Contact Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3">
                      <User className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="text-sm text-gray-600">Name</div>
                        <div className="font-medium">{selectedAppointment.contact_name}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="text-sm text-gray-600">Phone</div>
                        <div className="font-medium">{selectedAppointment.contact_phone}</div>
                      </div>
                    </div>
                    {selectedAppointment.contact_email && (
                      <div className="flex items-center space-x-3 col-span-2">
                        <Mail className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="text-sm text-gray-600">Email</div>
                          <div className="font-medium">{selectedAppointment.contact_email}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {selectedAppointment.notes && (
                  <div>
                    <h4 className="text-lg font-semibold text-brand-text mb-3">Notes</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700 whitespace-pre-wrap">{selectedAppointment.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-3 mt-6">
                <PermissionGuard module="appointments" action="update">
                  <Button onClick={() => handleEditClick(selectedAppointment)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Appointment
                  </Button>
                </PermissionGuard>
                <Button variant="outline" onClick={() => { setView('list'); resetForm(); }}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Mobile View */}
      <div className="md:hidden min-h-screen bg-gradient-to-br from-green-50 to-teal-50">
        <AnimatePresence mode="wait">
          {view === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white px-4 py-6 shadow-lg">
                <h1 className="text-2xl font-bold mb-1">Appointments</h1>
                <p className="text-green-100 text-sm">{formatLongDate(new Date())}</p>
              </div>

              <div className="px-4 -mt-4 mb-4">
                <div className="grid grid-cols-2 gap-3">
                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="bg-white rounded-2xl p-4 shadow-lg border border-green-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-green-100 p-2 rounded-xl">
                        <CalendarIcon className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="text-2xl font-bold text-green-600">{totalAppointments}</span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">Total</p>
                  </motion.div>

                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="bg-white rounded-2xl p-4 shadow-lg border border-blue-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-blue-100 p-2 rounded-xl">
                        <Clock className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className="text-2xl font-bold text-blue-600">{scheduledAppointments}</span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">Scheduled</p>
                  </motion.div>

                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="bg-white rounded-2xl p-4 shadow-lg border border-green-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-green-100 p-2 rounded-xl">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="text-2xl font-bold text-green-600">{confirmedAppointments}</span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">Confirmed</p>
                  </motion.div>

                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-gray-100 p-2 rounded-xl">
                        <Users className="w-5 h-5 text-gray-600" />
                      </div>
                      <span className="text-2xl font-bold text-gray-600">{completedAppointments}</span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">Completed</p>
                  </motion.div>
                </div>
              </div>

              <PermissionGuard module="appointments" action="insert">
                <div className="px-4 mb-4">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setView('add')}
                    className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-2xl py-4 px-6 shadow-lg flex items-center justify-center gap-3 font-semibold"
                  >
                    <Plus className="w-5 h-5" />
                    Add New Appointment
                  </motion.button>
                </div>
              </PermissionGuard>

              <div className="px-4 pb-20">
                <h2 className="text-lg font-bold text-gray-800 mb-3">Upcoming Appointments</h2>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  </div>
                ) : filteredAppointments.length === 0 ? (
                  <div className="text-center py-12">
                    <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No appointments yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredAppointments.map((appointment) => (
                      <motion.div
                        key={appointment.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleViewAppointment(appointment)}
                        className="bg-white rounded-2xl p-4 shadow-md active:shadow-lg transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="text-3xl">{meetingTypeIcons[appointment.meeting_type]}</div>
                            <div>
                              <p className="font-semibold text-gray-800">{appointment.title}</p>
                              <p className="text-xs text-gray-500">{appointment.contact_name}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>

                        <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                          <CalendarIcon className="w-4 h-4" />
                          <span>{formatDate(appointment.appointment_date)} at {formatTime(appointment.appointment_time)}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className={statusColors[appointment.status]}>
                              {appointment.status}
                            </Badge>
                            <Badge className={purposeColors[appointment.purpose]}>
                              {appointment.purpose}
                            </Badge>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {(view === 'add' || view === 'edit') && (
            <motion.div
              key="form"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 bg-white z-[60] overflow-y-auto"
            >
              <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white px-4 py-6 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <button onClick={handleBackNavigation}>
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <h2 className="text-xl font-bold">
                    {view === 'add' ? 'New Appointment' : 'Edit Appointment'}
                  </h2>
                </div>
              </div>

              <div className="p-4 pb-24 space-y-4">
                {/* Calendar Selection - Mobile */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <CalendarIcon className="w-4 h-4 inline-block mr-1" />
                    Calendar *
                  </label>
                  <Select value={selectedCalendarId || ''} onValueChange={handleCalendarSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a calendar" />
                    </SelectTrigger>
                    <SelectContent className="z-[70]">
                      {calendars.map((calendar) => (
                        <SelectItem key={calendar.id} value={calendar.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: calendar.color }}
                            />
                            <span>{calendar.title}</span>
                            <span className="text-xs text-gray-500">({calendar.slot_duration}m)</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {calendars.length === 0 && (
                    <p className="text-sm text-gray-500 mt-1">No active calendars available</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter title"
                  />
                </div>

                <div className="relative contact-search-container">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search Contact *</label>
                  <div className="relative">
                    <Input
                      value={contactSearchTerm}
                      onChange={(e) => {
                        setContactSearchTerm(e.target.value)
                        setShowContactDropdown(true)
                      }}
                      onFocus={() => setShowContactDropdown(true)}
                      placeholder="Search contact..."
                      className="pr-20"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {contactSearchTerm && (
                        <button
                          onClick={() => {
                            setContactSearchTerm('')
                            setSelectedContactId(null)
                            setFormData(prev => ({
                              ...prev,
                              contactName: '',
                              contactPhone: '',
                              contactEmail: ''
                            }))
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      )}
                      <Search className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>

                  {showContactDropdown && filteredContacts.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredContacts.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => handleContactSelect(contact)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900 text-sm">{contact.full_name}</div>
                          <div className="text-xs text-gray-600">{contact.phone}</div>
                          {contact.email && (
                            <div className="text-xs text-gray-500">{contact.email}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedContactId && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Contact Name</label>
                      <Input
                        value={formData.contactName}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Contact Phone</label>
                      <Input
                        value={formData.contactPhone}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
                      <Input
                        type="email"
                        value={formData.contactEmail}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date * (dd/mm/yyyy)</label>
                  <Input
                    type="date"
                    value={formData.appointmentDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    min={getISTDateString()}
                  />
                </div>

                {selectedCalendarId && formData.appointmentDate ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Available Time Slots *</label>
                    {availableSlots.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 bg-gray-50 rounded-lg">
                        {availableSlots.map((slot) => {
                          const isSelected = selectedSlot === slot.time
                          const isFullyBooked = slot.available <= 0
                          const hasLimitedAvailability = slot.available > 0 && slot.available < slot.total

                          return (
                            <button
                              key={slot.time}
                              type="button"
                              onClick={() => !isFullyBooked && handleSlotSelect(slot.time)}
                              disabled={isFullyBooked}
                              className={`px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                                isFullyBooked
                                  ? 'border-gray-200 bg-gray-100 text-gray-400'
                                  : isSelected
                                  ? 'border-green-500 bg-green-50 text-green-700'
                                  : hasLimitedAvailability
                                  ? 'border-orange-300 bg-orange-50 text-orange-700'
                                  : 'border-gray-300 bg-white text-gray-700'
                              }`}
                            >
                              <div className="text-center">
                                <div>{slot.time}</div>
                                {slot.total > 1 && (
                                  <div className="text-xs mt-0.5">
                                    {isFullyBooked ? (
                                      <span className="text-red-600">Full</span>
                                    ) : hasLimitedAvailability ? (
                                      <span className="text-orange-600">{slot.available}/{slot.total}</span>
                                    ) : (
                                      <span className="text-green-600">{slot.available}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                        <AlertCircle className="w-6 h-6 text-yellow-600 mx-auto mb-1" />
                        <p className="text-xs text-yellow-800 font-medium">No available slots</p>
                        <p className="text-xs text-yellow-600">Not available on this date</p>
                      </div>
                    )}
                  </div>
                ) : !selectedCalendarId && formData.appointmentDate ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Time *</label>
                    <Input
                      type="time"
                      value={formData.appointmentTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, appointmentTime: e.target.value }))}
                    />
                    <p className="text-xs text-gray-500 mt-1">Select a calendar for time slots</p>
                  </div>
                ) : null}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
                  <Input
                    type="number"
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData(prev => ({ ...prev, durationMinutes: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Type *</label>
                  <Select value={formData.meetingType} onValueChange={(value) => setFormData(prev => ({ ...prev, meetingType: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="In-Person">In-Person</SelectItem>
                      <SelectItem value="Video Call">Video Call</SelectItem>
                      <SelectItem value="Phone Call">Phone Call</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Purpose *</label>
                  <Select value={formData.purpose} onValueChange={(value) => setFormData(prev => ({ ...prev, purpose: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sales Meeting">Sales Meeting</SelectItem>
                      <SelectItem value="Product Demo">Product Demo</SelectItem>
                      <SelectItem value="Follow-up">Follow-up</SelectItem>
                      <SelectItem value="Consultation">Consultation</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                      <SelectItem value="Confirmed">Confirmed</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                      <SelectItem value="No-Show">No-Show</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Enter location or link"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    rows={4}
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add notes..."
                  />
                </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3">
                <Button
                  onClick={view === 'add' ? handleCreateAppointment : handleEditAppointment}
                  disabled={!formData.title || !selectedContactId || !selectedCalendarId || !formData.appointmentDate || !formData.appointmentTime}
                  className="flex-1"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {view === 'add' ? 'Create' : 'Save'}
                </Button>
                <Button variant="outline" onClick={handleBackNavigation}>
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}

          {view === 'view' && selectedAppointment && (
            <motion.div
              key="view"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 bg-white z-[60] overflow-y-auto"
            >
              <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white px-4 py-6 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <button onClick={handleBackNavigation}>
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <h2 className="text-xl font-bold">Appointment Details</h2>
                </div>
              </div>

              <div className="p-4 pb-24 space-y-4">
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-5xl">{meetingTypeIcons[selectedAppointment.meeting_type]}</div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{selectedAppointment.title}</h3>
                      <p className="text-sm text-gray-600">{selectedAppointment.appointment_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={statusColors[selectedAppointment.status]}>
                      {selectedAppointment.status}
                    </Badge>
                    <Badge className={meetingTypeColors[selectedAppointment.meeting_type]}>
                      {selectedAppointment.meeting_type}
                    </Badge>
                    <Badge className={purposeColors[selectedAppointment.purpose]}>
                      {selectedAppointment.purpose}
                    </Badge>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Date & Time</div>
                  <div className="font-medium">{formatDate(selectedAppointment.appointment_date)} at {formatTime(selectedAppointment.appointment_time)}</div>
                  <div className="text-sm text-gray-600">{selectedAppointment.duration_minutes} minutes</div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Contact</div>
                  <div className="font-medium">{selectedAppointment.contact_name}</div>
                  <div className="text-sm text-gray-600">{selectedAppointment.contact_phone}</div>
                  {selectedAppointment.contact_email && (
                    <div className="text-sm text-gray-600">{selectedAppointment.contact_email}</div>
                  )}
                </div>

                {selectedAppointment.location && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Location</div>
                    <div className="font-medium">{selectedAppointment.location}</div>
                  </div>
                )}

                {selectedAppointment.notes && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Notes</div>
                    <div className="font-medium whitespace-pre-wrap">{selectedAppointment.notes}</div>
                  </div>
                )}
              </div>

              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3">
                <PermissionGuard module="appointments" action="update">
                  <Button onClick={() => handleEditClick(selectedAppointment)} className="flex-1">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </PermissionGuard>
                <PermissionGuard module="appointments" action="delete">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this appointment?')) {
                        handleDeleteAppointment(selectedAppointment.id)
                        setView('list')
                        resetForm()
                      }
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </PermissionGuard>
                <Button variant="outline" onClick={() => { setView('list'); resetForm(); }}>
                  Close
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
