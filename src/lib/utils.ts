import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const API_BASE = "https://n8n.srv825961.hstgr.cloud/webhook"

export const makeApiCall = async (endpoint: string, method = 'GET', data?: any) => {
  const url = `${API_BASE}${endpoint}`
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  }

  if (data && method !== 'GET') {
    options.body = JSON.stringify(data)
  }

  try {
    const response = await fetch(url, options)
    return await response.json()
  } catch (error) {
    console.error('API call failed:', error)
    throw error
  }
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export const formatDate = (date: string | Date) => {
  const d = new Date(date)
  const day = d.toLocaleString('en-IN', { day: '2-digit', timeZone: 'Asia/Kolkata' })
  const month = d.toLocaleString('en-IN', { month: '2-digit', timeZone: 'Asia/Kolkata' })
  const year = d.toLocaleString('en-IN', { year: 'numeric', timeZone: 'Asia/Kolkata' })
  return `${day}/${month}/${year}`
}

export const formatTime = (time: string) => {
  // Convert time string (HH:MM or HH:MM:SS) to HH:MM format
  if (!time) return ''
  const parts = time.split(':')
  return `${parts[0]}:${parts[1]}`
}

export const formatDateTime = (date: string | Date) => {
  const d = new Date(date)
  const dateStr = formatDate(d)
  const timeStr = d.toLocaleString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata'
  })
  return `${dateStr} ${timeStr}`
}

export const getCurrentDateInIST = () => {
  const now = new Date()
  const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  return istDate
}

export const getISTDateString = () => {
  const istDate = getCurrentDateInIST()
  const year = istDate.getFullYear()
  const month = String(istDate.getMonth() + 1).padStart(2, '0')
  const day = String(istDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const getISTTimeString = () => {
  const istDate = getCurrentDateInIST()
  const hours = String(istDate.getHours()).padStart(2, '0')
  const minutes = String(istDate.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export const formatLongDate = (date: Date | string) => {
  const d = new Date(date)
  return d.toLocaleString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata'
  })
}

export const validateIndianMobile = (phone: string): boolean => {
  const cleanPhone = phone.replace(/\s+/g, '').replace(/[-()]/g, '')
  const phoneRegex = /^[6-9]\d{9}$/
  return phoneRegex.test(cleanPhone)
}

export const validateEmail = (email: string): boolean => {
  if (!email || email.trim() === '') return true
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

export const getPhoneValidationError = (phone: string): string | null => {
  if (!phone || phone.trim() === '') return 'Phone number is required'
  if (!validateIndianMobile(phone)) {
    return 'Please enter a valid 10-digit Indian mobile number'
  }
  return null
}

export const getEmailValidationError = (email: string, isRequired: boolean = false): string | null => {
  if (!email || email.trim() === '') {
    return isRequired ? 'Email is required' : null
  }
  if (!validateEmail(email)) {
    return 'Please enter a valid email address'
  }
  return null
}

export const convertISTToUTC = (istDateTimeString: string): string => {
  if (!istDateTimeString) return ''

  const [datePart, timePart] = istDateTimeString.split('T')
  const [year, month, day] = datePart.split('-')
  const [hours, minutes] = timePart.split(':')

  const istDate = new Date(`${year}-${month}-${day}T${hours}:${minutes}:00+05:30`)
  return istDate.toISOString()
}

export const convertUTCToISTForInput = (utcDateString: string | null): string => {
  if (!utcDateString) return ''

  const date = new Date(utcDateString)

  const istOffset = 5.5 * 60 * 60 * 1000
  const istDate = new Date(date.getTime() + istOffset)

  const year = istDate.getUTCFullYear()
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(istDate.getUTCDate()).padStart(2, '0')
  const hours = String(istDate.getUTCHours()).padStart(2, '0')
  const minutes = String(istDate.getUTCMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}