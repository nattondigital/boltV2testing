import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Phone, Lock, ArrowRight, Shield, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

interface OTPLoginProps {
  onAuthenticated: (mobile: string) => void
}

export function OTPLogin({ onAuthenticated }: OTPLoginProps) {
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile')
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState(['', '', '', ''])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSendOTP = async () => {
    if (mobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const { data: adminUser, error: userCheckError } = await supabase
        .from('admin_users')
        .select('id, is_active')
        .eq('phone', mobile)
        .maybeSingle()

      if (userCheckError) {
        console.error('Error checking user:', userCheckError)
        setError('Failed to verify user. Please try again.')
        setIsLoading(false)
        return
      }

      if (!adminUser) {
        setError('This phone number is not registered in the system.')
        setIsLoading(false)
        return
      }

      if (!adminUser.is_active) {
        setError('Your account is inactive. Please contact administrator.')
        setIsLoading(false)
        return
      }

      const generatedOTP = Math.floor(1000 + Math.random() * 9000).toString()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
      const { error: dbError } = await supabase
        .from('otp_verifications')
        .insert({
          mobile: mobile,
          otp: generatedOTP,
          expires_at: expiresAt,
          verified: false
        })

      if (dbError) {
        console.error('Error storing OTP:', dbError)
        setError('Failed to generate OTP. Please try again.')
        setIsLoading(false)
        return
      }

      const requestBody = {
        action: 'send_otp',
        mobile: mobile,
        otp: generatedOTP
      }

      console.log('Sending OTP request:', requestBody)

      const response = await fetch('https://n8n.srv825961.hstgr.cloud/webhook/ac7f2179-5f4e-4431-9def-01d2698254eb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      console.log('OTP webhook response status:', response.status)

      setSuccess('OTP sent successfully to your mobile number')
      setStep('otp')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error sending OTP:', err)
      setError('Failed to send OTP. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    const otpValue = otp.join('')

    if (otpValue.length !== 4) {
      setError('Please enter the complete 4-digit OTP')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const { data: otpRecords, error: fetchError } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('mobile', mobile)
        .eq('otp', otpValue)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)

      if (fetchError) {
        console.error('Error fetching OTP:', fetchError)
        setError('Failed to verify OTP. Please try again.')
        setIsLoading(false)
        return
      }

      if (!otpRecords || otpRecords.length === 0) {
        setError('Invalid or expired OTP. Please try again.')
        setIsLoading(false)
        return
      }

      const { error: updateError } = await supabase
        .from('otp_verifications')
        .update({
          verified: true,
          verified_at: new Date().toISOString()
        })
        .eq('id', otpRecords[0].id)

      if (updateError) {
        console.error('Error updating OTP:', updateError)
      }

      setSuccess('OTP verified successfully!')
      setTimeout(() => {
        onAuthenticated(mobile)
      }, 1000)
    } catch (err) {
      console.error('Error verifying OTP:', err)
      setError('Failed to verify OTP. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOTPChange = (index: number, value: string) => {
    if (value.length > 1) return

    const newOtp = [...otp]
    newOtp[index] = value

    setOtp(newOtp)

    if (value && index < 3) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      nextInput?.focus()
    }
  }

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      prevInput?.focus()
    }
  }

  const handleMobileKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendOTP()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-2xl border-0">
          <CardHeader className="space-y-4 pb-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center shadow-lg">
                <Shield className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center text-gray-900">
              {step === 'mobile' ? 'Admin Authentication' : 'Verify OTP'}
            </CardTitle>
            <p className="text-center text-gray-600 text-sm">
              {step === 'mobile'
                ? 'Enter your mobile number to receive a 4-digit OTP'
                : `We've sent a 4-digit OTP to ${mobile}`}
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {step === 'mobile' ? (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Mobile Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="tel"
                      placeholder="Enter 10-digit mobile number"
                      value={mobile}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 10)
                        setMobile(value)
                        setError('')
                      }}
                      onKeyPress={handleMobileKeyPress}
                      className="pl-11 h-12 text-lg"
                      maxLength={10}
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
                  >
                    {error}
                  </motion.div>
                )}

                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center space-x-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{success}</span>
                  </motion.div>
                )}

                <Button
                  onClick={handleSendOTP}
                  disabled={isLoading || mobile.length !== 10}
                  className="w-full h-12 text-base font-medium bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Sending OTP...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span>Send OTP</span>
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  )}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 text-center block">
                    Enter 4-Digit OTP
                  </label>
                  <div className="flex justify-center space-x-3">
                    {otp.map((digit, index) => (
                      <Input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOTPChange(index, e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => handleOTPKeyDown(index, e)}
                        className="w-14 h-14 text-center text-2xl font-bold"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
                  >
                    {error}
                  </motion.div>
                )}

                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center space-x-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{success}</span>
                  </motion.div>
                )}

                <div className="space-y-3">
                  <Button
                    onClick={handleVerifyOTP}
                    disabled={isLoading || otp.join('').length !== 4}
                    className="w-full h-12 text-base font-medium bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900"
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Verifying...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Lock className="w-5 h-5" />
                        <span>Verify & Login</span>
                      </div>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => {
                      setStep('mobile')
                      setOtp(['', '', '', ''])
                      setError('')
                    }}
                    disabled={isLoading}
                    className="w-full"
                  >
                    Change Mobile Number
                  </Button>

                  <button
                    onClick={handleSendOTP}
                    disabled={isLoading}
                    className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Resend OTP
                  </button>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>

        <p className="text-center mt-6 text-sm text-gray-600">
          Secure authentication powered by AI Academy Admin
        </p>
      </motion.div>
    </div>
  )
}
