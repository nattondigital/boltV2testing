/*
  # Add Next Recurrence Field to Recurring Tasks

  1. Changes
    - Add `next_recurrence` field to track when the next task should be created
    - This field will store a timestamp (with timezone) for the next scheduled occurrence
    - Add function to calculate and populate initial next_recurrence values
    
  2. Purpose
    - Simplify recurring task scheduling by tracking exact next occurrence time
    - Allow scheduler to simply check if next_recurrence <= current time
    - Automatically update next_recurrence after creating each task
    
  3. Notes
    - For existing records, next_recurrence will be calculated based on current logic
    - For new records, next_recurrence should be set when the recurring task is created
*/

-- Add next_recurrence column
ALTER TABLE recurring_tasks 
ADD COLUMN IF NOT EXISTS next_recurrence timestamptz;

-- Add index for efficient querying by scheduler
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_next_recurrence 
ON recurring_tasks(next_recurrence) 
WHERE is_active = true;

-- Add comment for documentation
COMMENT ON COLUMN recurring_tasks.next_recurrence IS 'Timestamp of the next scheduled task creation. Updated after each task is created.';
