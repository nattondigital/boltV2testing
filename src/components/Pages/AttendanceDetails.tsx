import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, Clock, MapPin, Camera, User } from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'

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

interface AttendanceDetailsProps {
  record: AttendanceRecord | null
  show: boolean
  onClose: () => void
}

const statusColors: Record<string, string> = {
  present: 'bg-green-100 text-green-800',
  absent: 'bg-red-100 text-red-800',
  late: 'bg-yellow-100 text-yellow-800',
  half_day: 'bg-blue-100 text-blue-800'
}

export function AttendanceDetails({ record, show, onClose }: AttendanceDetailsProps) {
  if (!record) return null

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-4xl bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-primary to-blue-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-6 h-6" />
                <div>
                  <h2 className="text-xl font-bold">Attendance Details</h2>
                  <p className="text-sm text-white/90">{record.admin_user?.full_name || 'Unknown'}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(100vh-200px)]">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Check-In Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 pb-2 border-b-2 border-green-500">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    Check-In Details
                  </h3>

                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <Calendar className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Date</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {format(new Date(record.date), 'MMMM dd, yyyy')}
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
                          {format(new Date(record.check_in_time), 'hh:mm a')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="bg-purple-100 p-2 rounded-lg">
                        <MapPin className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 font-medium mb-1">Location</p>
                        {record.check_in_location ? (
                          <>
                            <p className="text-sm text-gray-800 mb-2">
                              {record.check_in_location.address}
                            </p>
                            <button
                              onClick={() => window.open(`https://www.google.com/maps?q=${record.check_in_location!.lat},${record.check_in_location!.lng}`, '_blank')}
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
                      {record.check_in_selfie_url ? (
                        <img
                          src={record.check_in_selfie_url}
                          alt="Check-in selfie"
                          className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(record.check_in_selfie_url!, '_blank')}
                        />
                      ) : (
                        <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                          <Camera className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Check-Out Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 pb-2 border-b-2 border-red-500">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    Check-Out Details
                  </h3>

                  {record.check_out_time ? (
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <Calendar className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Date</p>
                          <p className="text-sm font-semibold text-gray-800">
                            {format(new Date(record.check_out_time), 'MMMM dd, yyyy')}
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
                            {format(new Date(record.check_out_time), 'hh:mm a')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="bg-purple-100 p-2 rounded-lg">
                          <MapPin className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 font-medium mb-1">Location</p>
                          {record.check_out_location ? (
                            <>
                              <p className="text-sm text-gray-800 mb-2">
                                {record.check_out_location.address}
                              </p>
                              <button
                                onClick={() => window.open(`https://www.google.com/maps?q=${record.check_out_location!.lat},${record.check_out_location!.lng}`, '_blank')}
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
                        {record.check_out_selfie_url ? (
                          <img
                            src={record.check_out_selfie_url}
                            alt="Check-out selfie"
                            className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(record.check_out_selfie_url!, '_blank')}
                          />
                        ) : (
                          <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                            <Camera className="w-12 h-12 text-gray-400" />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-8 text-center">
                      <Clock className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">Not checked out yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status & Notes */}
              <div className="mt-6 pt-6 border-t space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Status</p>
                  <Badge className={statusColors[record.status] || 'bg-gray-100 text-gray-800'}>
                    {record.status}
                  </Badge>
                </div>

                {record.notes && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">Notes</p>
                    <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3">
                      {record.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-4 bg-gray-50">
              <button
                onClick={onClose}
                className="w-full md:w-auto px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold text-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
