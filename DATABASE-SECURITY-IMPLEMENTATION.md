# Database-Level Permission Enforcement

## Problem

Previously, permission checks were only implemented in the UI layer. Users could bypass these restrictions by:
1. Using browser dev tools to re-enable buttons
2. Making direct API calls to Supabase
3. Using Postman or other API tools

Example: User `8076175528` had read-only access to Expenses, Leave, and Tasks but could still create/update/delete records by calling the Supabase API directly.

## Solution

Implemented **database-level permission enforcement** using secure PostgreSQL functions that check permissions before performing any operation.

## Architecture

### 1. Permission Check Function

```sql
check_admin_permission(phone_number text, module_name text, action_type text)
```

This function:
- Checks if user exists in `admin_users` table
- Verifies user is active (`is_active = true`)
- Checks specific permission in the `permissions` JSONB column
- Returns `true` if user has permission, `false` otherwise

### 2. Secure Operation Functions

For each module (Expenses, Leave Requests, Tasks), we created three secure functions:

- `secure_create_<module>(user_phone, data)` - Checks insert permission
- `secure_update_<module>(user_phone, id, data)` - Checks update permission
- `secure_delete_<module>(user_phone, id)` - Checks delete permission

These functions:
- Are `SECURITY DEFINER` - they run with elevated privileges to bypass RLS
- Check permissions BEFORE performing any operation
- Return clear error messages when permission is denied
- Return the created/updated record on success

### 3. Frontend Integration

Created `SecureAPI` helper functions that:
- Automatically get the current user's phone from localStorage
- Call the secure database functions via Supabase RPC
- Handle error responses consistently
- Provide type-safe interfaces

## Usage Guide

### For Expenses Module

**Old Way (Insecure):**
```typescript
// Direct Supabase call - bypasses permissions!
const { data, error } = await supabase
  .from('expenses')
  .insert([expenseData])
```

**New Way (Secure):**
```typescript
import { SecureExpenseAPI, handleSecureApiError } from '@/lib/secure-api'

// Create expense with permission check
const response = await SecureExpenseAPI.create({
  admin_user_id: userId,
  category: 'Travel',
  amount: 500,
  description: 'Client meeting',
  expense_date: '2025-01-10',
  payment_method: 'Credit Card',
  status: 'Pending'
})

if (response.error) {
  handleSecureApiError(response)
  return
}

const newExpense = response.data
console.log('Expense created:', newExpense)
```

### For Leave Requests Module

```typescript
import { SecureLeaveAPI, handleSecureApiError } from '@/lib/secure-api'

// Create leave request
const response = await SecureLeaveAPI.create({
  admin_user_id: userId,
  start_date: '2025-02-01',
  end_date: '2025-02-05',
  leave_type: 'Vacation',
  reason: 'Family trip',
  status: 'Pending',
  leave_category: 'Annual Leave'
})

if (response.error) {
  handleSecureApiError(response)
  return
}

// Update leave request (e.g., approve/reject)
const updateResponse = await SecureLeaveAPI.update(leaveId, {
  status: 'Approved'
})

// Delete leave request
const deleteResponse = await SecureLeaveAPI.delete(leaveId)
```

### For Tasks Module

```typescript
import { SecureTaskAPI, handleSecureApiError } from '@/lib/secure-api'

// Create task
const response = await SecureTaskAPI.create({
  task_id: 'TASK-001',
  title: 'Follow up with client',
  description: 'Call regarding proposal',
  priority: 'High',
  status: 'Open',
  assigned_to: userId,
  contact_id: contactId,
  contact_name: 'John Doe',
  contact_phone: '1234567890',
  due_date: '2025-01-15',
  due_time: '14:00:00'
})

if (response.error) {
  handleSecureApiError(response)
  return
}

// Update task
const updateResponse = await SecureTaskAPI.update(taskId, {
  status: 'In Progress',
  priority: 'Medium'
})

// Delete task
const deleteResponse = await SecureTaskAPI.delete(taskId)
```

## Error Handling

### Permission Denied Error

When a user tries to perform an operation without permission:

```json
{
  "error": "Permission denied: You do not have permission to create expenses",
  "code": "PERMISSION_DENIED"
}
```

### Not Found Error

When trying to update/delete a non-existent record:

```json
{
  "error": "Expense not found",
  "code": "NOT_FOUND"
}
```

### Success Response

On successful create/update:

```json
{
  "id": "uuid",
  "admin_user_id": "uuid",
  "category": "Travel",
  "amount": 500,
  "status": "Pending",
  "created_at": "2025-01-10T10:00:00Z",
  ...
}
```

On successful delete:

```json
{
  "success": true,
  "message": "Expense deleted successfully"
}
```

## Helper Functions

### isPermissionError

Check if an error is a permission denial:

```typescript
import { isPermissionError } from '@/lib/secure-api'

if (isPermissionError(response)) {
  // Show permission denied message
  // Maybe redirect to dashboard
}
```

### handleSecureApiError

Automatically show appropriate error messages:

```typescript
import { handleSecureApiError } from '@/lib/secure-api'

const response = await SecureExpenseAPI.create(data)
if (response.error) {
  handleSecureApiError(response) // Shows alert with error message
  return
}
```

## Migration Strategy

### Step 1: Update Component Imports

```typescript
// Add import
import { SecureExpenseAPI, handleSecureApiError } from '@/lib/secure-api'
```

### Step 2: Replace Direct Supabase Calls

Find and replace all direct Supabase insert/update/delete calls:

**Before:**
```typescript
const { data, error } = await supabase
  .from('expenses')
  .insert([expenseData])

if (error) {
  console.error('Error:', error)
  return
}
```

**After:**
```typescript
const response = await SecureExpenseAPI.create(expenseData)

if (response.error) {
  handleSecureApiError(response)
  return
}

const data = response.data
```

### Step 3: Test Permission Enforcement

1. Login as user with read-only access (e.g., `8076175528`)
2. Try to create a new record - should show "Permission denied" error
3. Try to update existing record - should show "Permission denied" error
4. Try to delete record - should show "Permission denied" error
5. Verify read operations still work

## Database Functions Reference

### Expenses Module

- `secure_create_expense(user_phone text, expense_data jsonb)`
- `secure_update_expense(user_phone text, expense_id uuid, expense_data jsonb)`
- `secure_delete_expense(user_phone text, expense_id uuid)`

### Leave Requests Module

- `secure_create_leave_request(user_phone text, leave_data jsonb)`
- `secure_update_leave_request(user_phone text, leave_id uuid, leave_data jsonb)`
- `secure_delete_leave_request(user_phone text, leave_id uuid)`

### Tasks Module

- `secure_create_task(user_phone text, task_data jsonb)`
- `secure_update_task(user_phone text, task_id uuid, task_data jsonb)`
- `secure_delete_task(user_phone text, task_id uuid)`

## Security Benefits

1. **Server-Side Validation**: Permissions are checked at the database level, not client-side
2. **Cannot Be Bypassed**: Even direct API calls are blocked if user lacks permission
3. **Consistent Enforcement**: Same permission logic everywhere
4. **Clear Error Messages**: Users get feedback about why operations failed
5. **Audit Trail**: Can log permission denials in the future
6. **SECURITY DEFINER**: Functions run with elevated privileges but still check permissions

## Best Practices

1. **Always use SecureAPI**: Never make direct Supabase calls for create/update/delete
2. **Handle errors**: Always check `response.error` before using `response.data`
3. **Show user feedback**: Use `handleSecureApiError()` or custom error messages
4. **Read operations**: Regular Supabase queries still work for SELECT operations
5. **Consistent data format**: Pass data as JSONB objects to secure functions

## Testing Checklist

For each module with secure functions:

- [ ] User with insert=false cannot create records
- [ ] User with update=false cannot modify records
- [ ] User with delete=false cannot remove records
- [ ] User with read=true can still view records
- [ ] Appropriate error messages are shown
- [ ] Success operations work correctly
- [ ] UI buttons are hidden based on permissions (belt & suspenders)

## Extending to Other Modules

To add permission enforcement to other modules:

1. Create migration file with three secure functions (create/update/delete)
2. Add API methods to `secure-api.ts`
3. Update frontend components to use secure API
4. Test with users having different permissions
5. Update this documentation

## Performance Considerations

- Secure functions add minimal overhead (one permission check per operation)
- Functions use indexes on `admin_users.phone` for fast lookups
- JSONB operations on permissions column are very fast
- No noticeable performance impact for end users

## Troubleshooting

### "Not authenticated" Error

- User is not logged in
- `admin_mobile` not in localStorage
- Solution: Redirect to login page

### "Permission denied" Error

- User's permissions don't include required action
- User account is inactive
- Solution: Contact administrator to grant permissions

### "RPC_ERROR" or "EXCEPTION" Error

- Database function doesn't exist
- Network error
- Invalid data format
- Solution: Check browser console for details

## Future Enhancements

1. Add comprehensive logging of permission denials
2. Create admin dashboard to view permission usage
3. Add rate limiting per user
4. Implement data-level permissions (e.g., user can only see their own expenses)
5. Add permission inheritance and roles
