import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { ModuleName, PermissionAction } from '@/lib/permissions'

interface PermissionGuardProps {
  module: ModuleName
  action: PermissionAction | string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PermissionGuard({ module, action, children, fallback = null }: PermissionGuardProps) {
  const { canPerformAction } = useAuth()

  if (!canPerformAction(module, action)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

interface ModuleGuardProps {
  module: ModuleName
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function ModuleGuard({ module, children, fallback = null }: ModuleGuardProps) {
  const { hasAnyPermission } = useAuth()

  if (!hasAnyPermission(module)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
