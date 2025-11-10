import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  hasPermission,
  canRead,
  canCreate,
  canUpdate,
  canDelete,
  canPerformAction,
  getModulePermissions,
  hasAnyPermission,
  type ModuleName,
  type PermissionAction,
  type UserPermissions,
} from '@/lib/permissions'

interface UserProfile {
  id: string
  email: string
  full_name: string
  phone: string
  role: string
  department: string | null
  status: string
  member_id: string | null
  is_active: boolean
  last_login: string | null
  created_at: string
  updated_at: string
  permissions: UserPermissions
}

interface AuthContextType {
  isAuthenticated: boolean
  userMobile: string | null
  userProfile: UserProfile | null
  login: (mobile: string) => Promise<void>
  logout: () => Promise<void>
  isLoading: boolean
  refreshProfile: () => Promise<void>
  hasPermission: (module: ModuleName, action: PermissionAction) => boolean
  canRead: (module: ModuleName) => boolean
  canCreate: (module: ModuleName) => boolean
  canUpdate: (module: ModuleName) => boolean
  canDelete: (module: ModuleName) => boolean
  canPerformAction: (module: ModuleName, action: string) => boolean
  hasAnyPermission: (module: ModuleName) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userMobile, setUserMobile] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const fetchUserProfile = async (mobile: string) => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('phone', mobile)
        .maybeSingle()

      if (error) {
        console.error('Error fetching user profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
  }

  const checkAuthStatus = async () => {
    try {
      const storedMobile = localStorage.getItem('admin_mobile')
      const storedTimestamp = localStorage.getItem('admin_auth_timestamp')

      if (storedMobile && storedTimestamp) {
        const authTime = parseInt(storedTimestamp)
        const currentTime = Date.now()
        const hoursSinceAuth = (currentTime - authTime) / (1000 * 60 * 60)

        if (hoursSinceAuth < 24) {
          const profile = await fetchUserProfile(storedMobile)
          if (profile) {
            setIsAuthenticated(true)
            setUserMobile(storedMobile)
            setUserProfile(profile)
          } else {
            localStorage.removeItem('admin_mobile')
            localStorage.removeItem('admin_auth_timestamp')
          }
        } else {
          localStorage.removeItem('admin_mobile')
          localStorage.removeItem('admin_auth_timestamp')
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshProfile = async () => {
    if (userMobile) {
      const profile = await fetchUserProfile(userMobile)
      if (profile) {
        setUserProfile(profile)
      }
    }
  }

  const login = async (mobile: string) => {
    try {
      const timestamp = Date.now()

      localStorage.setItem('admin_mobile', mobile)
      localStorage.setItem('admin_auth_timestamp', timestamp.toString())

      const { error } = await supabase
        .from('admin_users')
        .update({ last_login: new Date().toISOString() })
        .eq('phone', mobile)

      if (error) {
        console.error('Error updating last login:', error)
      }

      const profile = await fetchUserProfile(mobile)

      setIsAuthenticated(true)
      setUserMobile(mobile)
      setUserProfile(profile)
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      localStorage.removeItem('admin_mobile')
      localStorage.removeItem('admin_auth_timestamp')
      setIsAuthenticated(false)
      setUserMobile(null)
      setUserProfile(null)
    } catch (error) {
      console.error('Logout error:', error)
      throw error
    }
  }

  const checkPermission = (module: ModuleName, action: PermissionAction): boolean => {
    return hasPermission(userProfile?.permissions || null, module, action)
  }

  const checkCanRead = (module: ModuleName): boolean => {
    return canRead(userProfile?.permissions || null, module)
  }

  const checkCanCreate = (module: ModuleName): boolean => {
    return canCreate(userProfile?.permissions || null, module)
  }

  const checkCanUpdate = (module: ModuleName): boolean => {
    return canUpdate(userProfile?.permissions || null, module)
  }

  const checkCanDelete = (module: ModuleName): boolean => {
    return canDelete(userProfile?.permissions || null, module)
  }

  const checkCanPerformAction = (module: ModuleName, action: string): boolean => {
    return canPerformAction(userProfile?.permissions || null, module, action as any)
  }

  const checkHasAnyPermission = (module: ModuleName): boolean => {
    return hasAnyPermission(userProfile?.permissions || null, module)
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userMobile,
        userProfile,
        login,
        logout,
        isLoading,
        refreshProfile,
        hasPermission: checkPermission,
        canRead: checkCanRead,
        canCreate: checkCanCreate,
        canUpdate: checkCanUpdate,
        canDelete: checkCanDelete,
        canPerformAction: checkCanPerformAction,
        hasAnyPermission: checkHasAnyPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
