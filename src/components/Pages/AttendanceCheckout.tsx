import React from 'react'
import { motion } from 'framer-motion'
import { Clock, Camera, MapPin, CheckCircle, Calendar, LogOut, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'

interface CheckoutFormProps {
  selectedRecord: any
  selfieDataUrl: string | null
  location: { lat: number; lng: number; address: string } | null
  isCameraActive: boolean
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
  onStartCamera: () => void
  onStopCamera: () => void
  onCaptureSelfie: () => void
  onRetake: () => void
  onSubmit: () => void
  onBack: () => void
}

export function CheckoutFormDesktop({
  selectedRecord,
  selfieDataUrl,
  location,
  isCameraActive,
  videoRef,
  canvasRef,
  onStartCamera,
  onStopCamera,
  onCaptureSelfie,
  onRetake,
  onSubmit,
  onBack
}: CheckoutFormProps) {
  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h2 className="text-2xl font-bold">Check Out - {selectedRecord?.admin_user?.full_name}</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOut className="w-5 h-5" />
            Mark Check Out
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Selfie Image *</label>
            {!selfieDataUrl ? (
              <div className="space-y-4">
                <div
                  className="relative bg-gray-900 rounded-lg overflow-hidden"
                  style={{ aspectRatio: '4/3', maxHeight: '400px' }}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
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
                    onClick={isCameraActive ? onCaptureSelfie : onStartCamera}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {isCameraActive ? 'Capture Photo' : 'Start Camera'}
                  </Button>

                  {isCameraActive && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onStopCamera}
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
                  style={{ aspectRatio: '4/3', maxHeight: '400px' }}
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
                  onClick={onRetake}
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
            <Button onClick={onBack} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={onSubmit} className="flex-1 bg-red-600 hover:bg-red-700">
              <LogOut className="w-4 h-4 mr-2" />
              Mark Check Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

export function CheckoutFormMobile({
  selectedRecord,
  selfieDataUrl,
  location,
  isCameraActive,
  videoRef,
  canvasRef,
  onStartCamera,
  onStopCamera,
  onCaptureSelfie,
  onRetake,
  onSubmit,
  onClose
}: CheckoutFormProps & { onClose: () => void }) {
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="md:hidden fixed inset-0 bg-white z-[60] overflow-y-auto"
    >
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-6 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onClose}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold">Mark Check Out</h2>
        </div>
        <p className="text-sm text-white/90">{selectedRecord?.admin_user?.full_name}</p>
      </div>

      <div className="p-4 pb-24 space-y-6">
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
                  className="w-full h-full object-cover"
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
                  onClick={isCameraActive ? onCaptureSelfie : onStartCamera}
                  className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  {isCameraActive ? 'Capture Photo' : 'Start Camera'}
                </motion.button>

                {isCameraActive && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onStopCamera}
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
                  <div className="bg-red-500 rounded-full p-2">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onRetake}
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
              <div className="bg-red-100 p-2 rounded-xl">
                <Clock className="w-4 h-4 text-red-600" />
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
          onClick={onSubmit}
          className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white rounded-2xl py-4 font-bold text-lg shadow-lg flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          Mark Check Out
        </motion.button>
      </div>
    </motion.div>
  )
}
