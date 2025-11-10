/*
  # Update Expenses RLS Policies with Phone-Based Permissions

  1. Changes
    - Drop existing permissive policies
    - Create new restrictive policies that check admin permissions
    - Policies check user_phone from request headers or app context
  
  2. Security
    - Read: Requires 'read' permission for 'expenses' module
    - Insert: Requires 'insert' permission for 'expenses' module
    - Update: Requires 'update' permission for 'expenses' module (includes approve/reject)
    - Delete: Requires 'delete' permission for 'expenses' module
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow anonymous read access to expenses" ON expenses;
DROP POLICY IF EXISTS "Allow anonymous insert access to expenses" ON expenses;
DROP POLICY IF EXISTS "Allow anonymous update access to expenses" ON expenses;
DROP POLICY IF EXISTS "Allow anonymous delete access to expenses" ON expenses;

-- Create new permission-based policies

-- SELECT policy - requires 'read' permission
CREATE POLICY "Expenses read access based on admin permissions"
ON expenses
FOR SELECT
TO anon
USING (
  check_admin_permission(
    current_setting('request.jwt.claims', true)::json->>'phone',
    'expenses',
    'read'
  ) = true
);

-- INSERT policy - requires 'insert' permission
CREATE POLICY "Expenses insert access based on admin permissions"
ON expenses
FOR INSERT
TO anon
WITH CHECK (
  check_admin_permission(
    current_setting('request.jwt.claims', true)::json->>'phone',
    'expenses',
    'insert'
  ) = true
);

-- UPDATE policy - requires 'update' permission
CREATE POLICY "Expenses update access based on admin permissions"
ON expenses
FOR UPDATE
TO anon
USING (
  check_admin_permission(
    current_setting('request.jwt.claims', true)::json->>'phone',
    'expenses',
    'update'
  ) = true
)
WITH CHECK (
  check_admin_permission(
    current_setting('request.jwt.claims', true)::json->>'phone',
    'expenses',
    'update'
  ) = true
);

-- DELETE policy - requires 'delete' permission
CREATE POLICY "Expenses delete access based on admin permissions"
ON expenses
FOR DELETE
TO anon
USING (
  check_admin_permission(
    current_setting('request.jwt.claims', true)::json->>'phone',
    'expenses',
    'delete'
  ) = true
);
