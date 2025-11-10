export type PermissionAction = 'read' | 'insert' | 'update' | 'delete'

export type ModuleName =
  | 'leads'
  | 'contacts'
  | 'tasks'
  | 'appointments'
  | 'support'
  | 'expenses'
  | 'products'
  | 'billing'
  | 'team'
  | 'leave'
  | 'attendance'
  | 'lms'
  | 'courses'
  | 'media'
  | 'settings'
  | 'webhooks'
  | 'ai_agents'
  | 'pipelines'
  | 'affiliates'
  | 'automations'
  | 'integrations'
  | 'enrolled_members'

export interface ModulePermissions {
  read: boolean
  insert: boolean
  update: boolean
  delete: boolean
}

export interface UserPermissions {
  [module: string]: ModulePermissions
}

export function hasPermission(
  permissions: UserPermissions | null,
  module: ModuleName,
  action: PermissionAction
): boolean {
  if (!permissions || !permissions[module]) {
    return false
  }

  return permissions[module][action] === true
}

export function hasAnyPermission(
  permissions: UserPermissions | null,
  module: ModuleName
): boolean {
  if (!permissions || !permissions[module]) {
    return false
  }

  const modulePerms = permissions[module]
  return modulePerms.read || modulePerms.insert || modulePerms.update || modulePerms.delete
}

export function canRead(permissions: UserPermissions | null, module: ModuleName): boolean {
  return hasPermission(permissions, module, 'read')
}

export function canCreate(permissions: UserPermissions | null, module: ModuleName): boolean {
  return hasPermission(permissions, module, 'insert')
}

export function canUpdate(permissions: UserPermissions | null, module: ModuleName): boolean {
  return hasPermission(permissions, module, 'update')
}

export function canDelete(permissions: UserPermissions | null, module: ModuleName): boolean {
  return hasPermission(permissions, module, 'delete')
}

export function getModulePermissions(
  permissions: UserPermissions | null,
  module: ModuleName
): ModulePermissions {
  if (!permissions || !permissions[module]) {
    return {
      read: false,
      insert: false,
      update: false,
      delete: false,
    }
  }

  return permissions[module]
}

export function checkMultiplePermissions(
  permissions: UserPermissions | null,
  checks: Array<{ module: ModuleName; action: PermissionAction }>
): boolean {
  return checks.every((check) => hasPermission(permissions, check.module, check.action))
}

export const ACTION_PERMISSION_MAP = {
  approve: 'update',
  reject: 'update',
  convert: 'update',
  assign: 'update',
  move: 'update',
  close: 'update',
  reopen: 'update',
  activate: 'update',
  deactivate: 'update',
  archive: 'update',
  restore: 'update',
} as const

export function canPerformAction(
  permissions: UserPermissions | null,
  module: ModuleName,
  action: keyof typeof ACTION_PERMISSION_MAP | PermissionAction
): boolean {
  const mappedAction = ACTION_PERMISSION_MAP[action as keyof typeof ACTION_PERMISSION_MAP] || action
  return hasPermission(permissions, module, mappedAction as PermissionAction)
}
