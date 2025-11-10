# Module Access Permissions System

## Overview

The system implements role-based access control (RBAC) using module-level permissions stored in the `admin_users` table. Each user has granular permissions for different modules with four permission types: Read, Insert, Update, and Delete.

## Key Features

1. **Phone-Based Authentication**: Only users with phone numbers in `admin_users` table can login via OTP
2. **Active Status Check**: Users must have `is_active = true` to authenticate
3. **Module-Level Permissions**: Each module can have separate CRUD permissions
4. **Action Mapping**: Special actions (approve, reject, convert, etc.) are mapped to Update permission
5. **Route-Level Protection**: URLs are protected - users cannot bypass by typing URL directly
6. **UI Restrictions**: Sidebar items and action buttons are hidden based on permissions
7. **Access Denied Pages**: Users without module access see an access denied message

## Database Structure

### admin_users Table
- `phone`: User's phone number (used for OTP login)
- `is_active`: Boolean flag to enable/disable user
- `permissions`: JSONB column with module permissions

### Permission Format
```json
{
  "leads": {
    "read": true,
    "insert": true,
    "update": true,
    "delete": false
  },
  "contacts": {
    "read": true,
    "insert": false,
    "update": false,
    "delete": false
  }
}
```

## Available Modules

- `leads` - Leads CRM
- `contacts` - Contacts Management
- `tasks` - Task Management
- `appointments` - Appointments/Calendar
- `support` - Support Tickets
- `expenses` - Expense Tracking
- `products` - Products/Services
- `billing` - Billing & Invoices
- `team` - Team Management
- `leave` - Leave Requests
- `attendance` - Attendance Tracking
- `lms` - Learning Management System
- `courses` - Training Courses
- `media` - Media Storage
- `settings` - System Settings
- `webhooks` - Webhook Configuration
- `ai_agents` - AI Agents
- `pipelines` - Sales Pipelines
- `affiliates` - Affiliate Management
- `automations` - Workflow Automations
- `integrations` - External Integrations
- `enrolled_members` - Member Management

## Permission Types

### CRUD Permissions
- **read**: View data in the module
- **insert**: Create new records
- **update**: Modify existing records
- **delete**: Remove records

### Special Actions (Mapped to Update)
The following actions require `update` permission:
- `approve` - Approve requests (expenses, leave, etc.)
- `reject` - Reject requests
- `convert` - Convert records (e.g., lead to contact, estimate to invoice)
- `assign` - Assign to team members
- `move` - Move between stages/statuses
- `close` - Close tickets/tasks
- `reopen` - Reopen closed items
- `activate` - Activate records
- `deactivate` - Deactivate records
- `archive` - Archive records
- `restore` - Restore archived records

## Implementation Guide

### 1. Authentication (OTP Login)

The OTP login system checks:
1. Phone number exists in `admin_users` table
2. User has `is_active = true`
3. Valid OTP verification

```typescript
// In OTPLogin.tsx
const { data: adminUser } = await supabase
  .from('admin_users')
  .select('id, is_active')
  .eq('phone', mobile)
  .maybeSingle()

if (!adminUser) {
  setError('This phone number is not registered in the system.')
  return
}

if (!adminUser.is_active) {
  setError('Your account is inactive. Please contact administrator.')
  return
}
```

### 2. Route-Level Protection

All routes are protected using the `ProtectedRoute` component. This prevents users from accessing modules via direct URL entry.

```typescript
// In App.tsx
import { ProtectedRoute } from '@/components/Common/ProtectedRoute'

<Routes>
  <Route path="/" element={<Layout />}>
    {/* Protected routes - require module permission */}
    <Route path="attendance" element={
      <ProtectedRoute module="attendance">
        <Attendance />
      </ProtectedRoute>
    } />

    <Route path="leads" element={
      <ProtectedRoute module="leads">
        <Leads />
      </ProtectedRoute>
    } />

    {/* Unprotected routes - accessible to all authenticated users */}
    <Route path="dashboard" element={<Dashboard />} />
  </Route>
</Routes>
```

**Key Points:**
- Users without any permission for a module see an "Access Denied" page
- Direct URL access is blocked (e.g., typing `/attendance` in the browser)
- Users are shown a friendly message with option to go back
- Authentication is still required for all protected routes

### 3. Using Permissions in Components

#### Check Permissions with useAuth Hook

```typescript
import { useAuth } from '@/contexts/AuthContext'

function MyComponent() {
  const { canRead, canCreate, canUpdate, canDelete, canPerformAction } = useAuth()

  // Check basic permissions
  if (!canRead('leads')) {
    return <AccessDenied />
  }

  // Check specific permissions
  const showCreateButton = canCreate('leads')
  const showEditButton = canUpdate('leads')
  const showDeleteButton = canDelete('leads')

  // Check special actions
  const canApprove = canPerformAction('expenses', 'approve')
  const canConvert = canPerformAction('billing', 'convert')
}
```

#### Use PermissionGuard Component

```typescript
import { PermissionGuard } from '@/components/Common/PermissionGuard'

// Hide button without required permission
<PermissionGuard module="leads" action="delete">
  <Button onClick={handleDelete}>
    Delete Lead
  </Button>
</PermissionGuard>

// Hide section without any module access
<ModuleGuard module="leads">
  <LeadsSection />
</ModuleGuard>
```

#### Conditional Rendering

```typescript
// Build actions array based on permissions
const headerActions = []

if (canRead('leads')) {
  headerActions.push({
    label: 'Export Data',
    onClick: handleExport,
    icon: Download
  })
}

if (canCreate('leads')) {
  headerActions.push({
    label: 'Add New Lead',
    onClick: handleAdd,
    icon: Plus
  })
}

// Render with dynamic actions
<PageHeader title="Leads" actions={headerActions} />
```

### 4. Sidebar Navigation

The sidebar automatically filters navigation items based on permissions:

```typescript
// Each nav item has a module property
const salesManagementNavigation = [
  { icon: Users, label: 'Leads CRM', to: '/leads', module: 'leads' },
  { icon: Calendar, label: 'Appointments', to: '/appointments', module: 'appointments' },
]

// Sidebar filters items automatically
const visibleSalesNav = salesManagementNavigation.filter(item => {
  if (!item.module) return true
  return hasAnyPermission(item.module)
})

// Section headers hide if no visible items
{!collapsed && visibleSalesNav.length > 0 && (
  <div className="pt-4">
    <button>Sales Management</button>
  </div>
)}
```

### 5. Access Denied Page

Show access denied message for users without read permission:

```typescript
if (!canRead('leads')) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h3>
          <p className="text-gray-600">You don't have permission to view leads.</p>
        </div>
      </div>
    </div>
  )
}
```

### 6. Available Permission Utilities

```typescript
// From @/lib/permissions
hasPermission(permissions, module, action) // Check specific permission
hasAnyPermission(permissions, module)     // Check if user has any permission for module
canRead(permissions, module)              // Check read permission
canCreate(permissions, module)            // Check insert permission
canUpdate(permissions, module)            // Check update permission
canDelete(permissions, module)            // Check delete permission
canPerformAction(permissions, module, action) // Check action with mapping
getModulePermissions(permissions, module) // Get all permissions for module
checkMultiplePermissions(permissions, checks) // Check multiple permissions at once
```

## Example: Complete Module Implementation

```typescript
import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { PermissionGuard } from '@/components/Common/PermissionGuard'
import { PageHeader } from '@/components/Common/PageHeader'
import { Button } from '@/components/ui/button'
import { Plus, Download, Edit, Trash2, AlertCircle } from 'lucide-react'

export function MyModule() {
  const { canRead, canCreate, canUpdate, canDelete } = useAuth()

  // Check read access first
  if (!canRead('my_module')) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h3>
            <p className="text-gray-600">You don't have permission to view this module.</p>
          </div>
        </div>
      </div>
    )
  }

  // Build header actions based on permissions
  const headerActions = []

  if (canRead('my_module')) {
    headerActions.push({
      label: 'Export Data',
      onClick: handleExport,
      icon: Download,
      variant: 'outline'
    })
  }

  if (canCreate('my_module')) {
    headerActions.push({
      label: 'Add New',
      onClick: handleAdd,
      icon: Plus
    })
  }

  return (
    <div className="p-6">
      <PageHeader
        title="My Module"
        subtitle="Module description"
        actions={headerActions}
      />

      {/* List view with conditional actions */}
      <div className="space-y-4">
        {items.map(item => (
          <Card key={item.id}>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>{item.name}</div>
                <div className="flex space-x-2">
                  <PermissionGuard module="my_module" action="update">
                    <Button size="sm" onClick={() => handleEdit(item)}>
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </PermissionGuard>

                  <PermissionGuard module="my_module" action="delete">
                    <Button size="sm" variant="outline" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </PermissionGuard>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

## Managing Permissions

### Via Team Management Page

Administrators can manage user permissions through the Team page:
1. Navigate to Team section
2. Select a team member
3. Configure module permissions with checkboxes for Read, Insert, Update, Delete
4. Save changes

### Direct Database Update

```sql
-- Grant full access to leads module
UPDATE admin_users
SET permissions = jsonb_set(
  permissions,
  '{leads}',
  '{"read": true, "insert": true, "update": true, "delete": true}'
)
WHERE phone = '1234567890';

-- Revoke delete permission from expenses
UPDATE admin_users
SET permissions = jsonb_set(
  permissions,
  '{expenses,delete}',
  'false'
)
WHERE phone = '1234567890';

-- Grant read-only access to all modules
UPDATE admin_users
SET permissions = '{
  "leads": {"read": true, "insert": false, "update": false, "delete": false},
  "contacts": {"read": true, "insert": false, "update": false, "delete": false},
  "tasks": {"read": true, "insert": false, "update": false, "delete": false}
}'::jsonb
WHERE phone = '1234567890';
```

## Security Best Practices

1. **Always check read permission first** before rendering module content
2. **Use PermissionGuard** for action buttons to prevent unauthorized actions
3. **Filter navigation items** to hide inaccessible modules
4. **Validate permissions on backend** - UI restrictions are not sufficient security
5. **Regular permission audits** - Review user permissions periodically
6. **Principle of least privilege** - Grant minimum permissions needed
7. **Active status management** - Deactivate users who leave the organization

## Testing Permissions

1. Create test users with different permission sets
2. Test each module with various permission combinations
3. Verify sidebar shows/hides correct items
4. Confirm action buttons appear based on permissions
5. Test access denied pages for users without read permission
6. Verify special actions (approve, convert, etc.) require update permission

## Troubleshooting

### User cannot login
- Check if phone exists in `admin_users` table
- Verify `is_active = true`
- Confirm OTP is being sent correctly

### User sees empty sidebar
- Check if user has any module permissions with at least one permission enabled
- Verify permissions JSONB structure is correct

### Action buttons not appearing
- Check module permission for the specific action
- Verify PermissionGuard is wrapping the button
- Confirm permission check is using correct module name

### Access denied despite having permissions
- Check permission object structure in database
- Verify module name matches exactly (case-sensitive)
- Confirm at least read permission is enabled for the module

### User can access page via direct URL
- This issue is now fixed with route-level protection
- All routes in App.tsx are wrapped with ProtectedRoute component
- Users will see "Access Denied" page if they try to access a module without permission
- If this still occurs, verify the route has `<ProtectedRoute module="...">` wrapper in App.tsx
