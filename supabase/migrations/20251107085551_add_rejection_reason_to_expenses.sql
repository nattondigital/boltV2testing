/*
  # Add Rejection Reason to Expenses

  1. Changes
    - Add `rejection_reason` column to `expenses` table
      - Type: text
      - Optional field to store reason when expense is rejected
      - Allows null values
    
  2. Notes
    - This field helps track why expenses were rejected
    - Similar to leave_requests rejection tracking
*/

-- Add rejection_reason column to expenses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE expenses ADD COLUMN rejection_reason text;
  END IF;
END $$;
