/*
  # Fix Weekly Tasks to Single Day and Add Constraint

  1. Changes
    - Update existing weekly recurring tasks to use only the first day in start_days and due_days arrays
    - Add check constraints to ensure start_days and due_days contain exactly one element for weekly recurrence
    
  2. Purpose
    - Clean up existing data to comply with single day selection
    - Enforce single day selection for weekly recurring tasks going forward
*/

-- Update existing weekly tasks to use only the first day in the arrays
UPDATE recurring_tasks
SET 
  start_days = ARRAY[start_days[1]],
  due_days = ARRAY[due_days[1]]
WHERE recurrence_type = 'weekly'
  AND (array_length(start_days, 1) > 1 OR array_length(due_days, 1) > 1);

-- Add constraint to ensure start_days has exactly one element for weekly recurrence
ALTER TABLE recurring_tasks 
ADD CONSTRAINT recurring_tasks_weekly_start_days_single_day
CHECK (
  recurrence_type != 'weekly' OR 
  (start_days IS NOT NULL AND array_length(start_days, 1) = 1)
);

-- Add constraint to ensure due_days has exactly one element for weekly recurrence
ALTER TABLE recurring_tasks 
ADD CONSTRAINT recurring_tasks_weekly_due_days_single_day
CHECK (
  recurrence_type != 'weekly' OR 
  (due_days IS NOT NULL AND array_length(due_days, 1) = 1)
);

-- Add comments
COMMENT ON CONSTRAINT recurring_tasks_weekly_start_days_single_day ON recurring_tasks 
IS 'Ensures start_days contains exactly one day for weekly recurrence';

COMMENT ON CONSTRAINT recurring_tasks_weekly_due_days_single_day ON recurring_tasks 
IS 'Ensures due_days contains exactly one day for weekly recurrence';
