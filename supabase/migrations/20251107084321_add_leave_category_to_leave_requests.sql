/*
  # Add Leave Category to Leave Requests

  1. Changes
    - Add `leave_category` column to `leave_requests` table
      - Type: text
      - Options: 'Casual', 'Vacation', 'Sick Leave', 'Personal', 'Emergency', 'Other'
      - Default: 'Casual'
      - Not nullable
    
  2. Notes
    - This allows better categorization and tracking of different types of leave requests
    - Category helps with leave balance management and reporting
*/

-- Add leave_category column to leave_requests table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'leave_category'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN leave_category text NOT NULL DEFAULT 'Casual';
  END IF;
END $$;

-- Add check constraint for valid leave categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'leave_requests' AND constraint_name = 'leave_requests_leave_category_check'
  ) THEN
    ALTER TABLE leave_requests
    ADD CONSTRAINT leave_requests_leave_category_check
    CHECK (leave_category IN ('Casual', 'Vacation', 'Sick Leave', 'Personal', 'Emergency', 'Other'));
  END IF;
END $$;
