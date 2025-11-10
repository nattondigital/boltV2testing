/*
  # Add Recurrence Task ID to Tasks Table

  1. Changes
    - Add `recurrence_task_id` field to tasks table
    - This field links tasks to their recurring task template
    - Used for duplicate prevention and tracking
    
  2. Purpose
    - Link active tasks to their recurring task source
    - Prevent duplicate task creation on the same day
    - Enable querying tasks by their recurring template
*/

-- Add recurrence_task_id column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS recurrence_task_id text;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_task_id 
ON tasks(recurrence_task_id);

-- Add foreign key constraint (optional but recommended)
ALTER TABLE tasks
ADD CONSTRAINT fk_tasks_recurrence_task_id
FOREIGN KEY (recurrence_task_id) 
REFERENCES recurring_tasks(recurrence_task_id)
ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN tasks.recurrence_task_id IS 'Links task to its recurring task template (RETASK001, RETASK002, etc.). Used to prevent duplicate creation.';
