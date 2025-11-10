/*
  # Create Admin Permission Check Function

  1. Function
    - `check_admin_permission(phone_number text, module_name text, action_type text)` - Returns boolean
    - Checks if a user with given phone has specific permission for a module
    - Used by RLS policies to enforce module-level permissions
  
  2. Security
    - Function is SECURITY DEFINER to allow RLS policies to check permissions
    - Only checks permissions, does not modify data
*/

-- Create function to check admin permissions
CREATE OR REPLACE FUNCTION check_admin_permission(
  phone_number text,
  module_name text,
  action_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  has_permission boolean;
BEGIN
  -- Check if user exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE phone = phone_number 
    AND is_active = true
  ) THEN
    RETURN false;
  END IF;

  -- Check specific permission
  SELECT COALESCE(
    (permissions -> module_name ->> action_type)::boolean,
    false
  )
  INTO has_permission
  FROM admin_users
  WHERE phone = phone_number
  AND is_active = true;

  RETURN COALESCE(has_permission, false);
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION check_admin_permission TO anon, authenticated;
