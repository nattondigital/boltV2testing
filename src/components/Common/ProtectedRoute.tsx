import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ModuleName } from '@/lib/permissions'
import { AlertCircle } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
  module?: ModuleName
  requireAuth?: boolean
}

export function ProtectedRoute({ children, module, requireAuth = true }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasAnyPermission } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (module && !hasAnyPermission(module)) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
          <div className="text-center max-w-md">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">
              You don't have permission to access this page. Please contact your administrator if you believe this is an error.
            </p>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
