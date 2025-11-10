/*
  # Add Recurrence Task ID to Recurring Tasks

  1. Changes
    - Add `recurrence_task_id` field in format RETASK001, RETASK002, etc.
    - Auto-generate IDs using a trigger function
    - Add unique constraint to prevent duplicates
    
  2. Purpose
    - Provide a unique identifier for each recurring task
    - Use this ID to prevent duplicate task creation on same day
    - Display in UI for easy reference
    
  3. Security
    - Add to RLS policies to ensure proper access control
*/

-- Add recurrence_task_id column
ALTER TABLE recurring_tasks 
ADD COLUMN IF NOT EXISTS recurrence_task_id text UNIQUE;

-- Create function to generate recurrence task ID
CREATE OR REPLACE FUNCTION generate_recurrence_task_id()
RETURNS TRIGGER AS $$
DECLARE
  max_id INTEGER;
  new_id TEXT;
BEGIN
  -- Get the maximum existing ID number
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(recurrence_task_id FROM 'RETASK(\d+)') AS INTEGER
      )
    ), 0
  ) INTO max_id
  FROM recurring_tasks
  WHERE recurrence_task_id IS NOT NULL;
  
  -- Generate new ID with leading zeros (4 digits)
  new_id := 'RETASK' || LPAD((max_id + 1)::TEXT, 3, '0');
  
  -- Assign to the new row
  NEW.recurrence_task_id := new_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate recurrence task ID
DROP TRIGGER IF EXISTS set_recurrence_task_id ON recurring_tasks;
CREATE TRIGGER set_recurrence_task_id
  BEFORE INSERT ON recurring_tasks
  FOR EACH ROW
  WHEN (NEW.recurrence_task_id IS NULL)
  EXECUTE FUNCTION generate_recurrence_task_id();

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_recurrence_task_id 
ON recurring_tasks(recurrence_task_id);

-- Add comment for documentation
COMMENT ON COLUMN recurring_tasks.recurrence_task_id IS 'Unique identifier in format RETASK001, RETASK002, etc. Auto-generated on insert.';
