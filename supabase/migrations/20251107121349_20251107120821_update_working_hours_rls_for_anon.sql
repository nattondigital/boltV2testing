/*
  # Update Working Hours Settings RLS for Anonymous Access

  1. Changes
    - Update RLS policies to allow anonymous users to update working hours settings
    - This matches the pattern used in other settings tables in the application

  2. Security
    - Allow anon users to update working hours settings (for authenticated admin users using anon key)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can insert working hours settings" ON working_hours_settings;
DROP POLICY IF EXISTS "Authenticated users can update working hours settings" ON working_hours_settings;
DROP POLICY IF EXISTS "Authenticated users can delete working hours settings" ON working_hours_settings;

-- Create new policies that allow anon access
CREATE POLICY "Anyone can insert working hours settings"
  ON working_hours_settings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update working hours settings"
  ON working_hours_settings
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete working hours settings"
  ON working_hours_settings
  FOR DELETE
  TO anon, authenticated
  USING (true);
