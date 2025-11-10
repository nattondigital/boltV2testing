/*
  # Fix Expenses RLS to Use App Metadata Approach

  1. Changes
    - Drop JWT-based policies (won't work with anon access)
    - Create simpler policies that check permissions table directly
    - Use user_phone column that frontend will populate
  
  2. Strategy
    - Add user_phone column to track who's making the request
    - Policies check permissions based on user_phone field
    - Frontend must populate user_phone when creating/updating records
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Expenses read access based on admin permissions" ON expenses;
DROP POLICY IF EXISTS "Expenses insert access based on admin permissions" ON expenses;
DROP POLICY IF EXISTS "Expenses update access based on admin permissions" ON expenses;
DROP POLICY IF EXISTS "Expenses delete access based on admin permissions" ON expenses;

-- Add user_phone column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'user_phone'
  ) THEN
    ALTER TABLE expenses ADD COLUMN user_phone text;
    CREATE INDEX IF NOT EXISTS idx_expenses_user_phone ON expenses(user_phone);
  END IF;
END $$;

-- Create function to get current user phone from app context
CREATE OR REPLACE FUNCTION get_current_user_phone()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Try to get from custom claim first (for future use)
  BEGIN
    RETURN current_setting('app.current_user_phone', true);
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$$;

-- SELECT policy - check read permission
CREATE POLICY "Expenses read with permission check"
ON expenses
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE phone = get_current_user_phone()
    AND is_active = true
    AND (permissions -> 'expenses' ->> 'read')::boolean = true
  )
);

-- INSERT policy - check insert permission and set user_phone
CREATE POLICY "Expenses insert with permission check"
ON expenses
FOR INSERT
TO anon
WITH CHECK (
  user_phone = get_current_user_phone()
  AND EXISTS (
    SELECT 1 FROM admin_users
    WHERE phone = user_phone
    AND is_active = true
    AND (permissions -> 'expenses' ->> 'insert')::boolean = true
  )
);

-- UPDATE policy - check update permission
CREATE POLICY "Expenses update with permission check"
ON expenses
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE phone = get_current_user_phone()
    AND is_active = true
    AND (permissions -> 'expenses' ->> 'update')::boolean = true
  )
)
WITH CHECK (
  user_phone = get_current_user_phone()
  AND EXISTS (
    SELECT 1 FROM admin_users
    WHERE phone = user_phone
    AND is_active = true
    AND (permissions -> 'expenses' ->> 'update')::boolean = true
  )
);

-- DELETE policy - check delete permission
CREATE POLICY "Expenses delete with permission check"
ON expenses
FOR DELETE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE phone = get_current_user_phone()
    AND is_active = true
    AND (permissions -> 'expenses' ->> 'delete')::boolean = true
  )
);
