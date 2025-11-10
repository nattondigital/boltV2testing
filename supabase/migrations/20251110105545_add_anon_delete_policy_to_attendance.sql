/*
  # Add Anon Delete Policy to Attendance

  1. Changes
    - Add policy to allow anonymous users to delete attendance records
    
  2. Security
    - Allows anon role to delete attendance records
    - This matches the existing anon policies for insert, select, and update
*/

-- Create policy for anonymous users to delete attendance
CREATE POLICY "Anon can delete attendance"
  ON attendance
  FOR DELETE
  TO anon
  USING (true);

-- Add comment for documentation
COMMENT ON POLICY "Anon can delete attendance" ON attendance IS 'Allows anonymous users to delete attendance records';
