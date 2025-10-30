/*
================================================================================
GROUP 10: TASKS MANAGEMENT SYSTEM
================================================================================

Tasks table, RLS policies, and workflow triggers

Total Files: 10
Dependencies: Group 9

Files Included (in execution order):
1. 20251021191200_create_tasks_table.sql
2. 20251021200351_create_tasks_table.sql
3. 20251021200855_update_tasks_rls_policies.sql
4. 20251021201624_update_tasks_rls_for_anon_access.sql
5. 20251022113231_add_contact_to_tasks.sql
6. 20251022120000_create_task_triggers.sql
7. 20251022122626_create_task_triggers.sql
8. 20251022123001_add_task_workflow_triggers.sql
9. 20251022124554_update_task_triggers_with_phone_numbers.sql
10. 20251022124628_update_task_workflow_triggers_schema_with_phone.sql

================================================================================
*/

-- ============================================================================
-- MIGRATION 1: 20251021191200_create_tasks_table.sql
-- ============================================================================
/*
  # Create Tasks Management Table

  1. New Tables
    - `tasks`
      - `id` (uuid, primary key)
      - `task_id` (text, unique, auto-generated)
      - `title` (text, required)
      - `description` (text)
      - `status` (text) - Options: To Do, In Progress, In Review, Completed, Cancelled
      - `priority` (text) - Options: Low, Medium, High, Urgent
      - `assigned_to` (uuid, foreign key to admin_users)
      - `assigned_to_name` (text)
      - `assigned_by` (uuid, foreign key to admin_users)
      - `assigned_by_name` (text)
      - `due_date` (date)
      - `start_date` (date)
      - `completion_date` (timestamptz)
      - `estimated_hours` (numeric)
      - `actual_hours` (numeric)
      - `category` (text) - Development, Design, Marketing, Sales, Support, Operations, Other
      - `tags` (text array)
      - `attachments` (jsonb)
      - `progress_percentage` (integer, 0-100)
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `tasks` table
    - Add policies for authenticated admin users to manage tasks
    - Add policy for users to view tasks assigned to them
*/

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text UNIQUE NOT NULL DEFAULT 'TASK-' || LPAD(FLOOR(RANDOM() * 999999)::text, 6, '0'),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'To Do',
  priority text NOT NULL DEFAULT 'Medium',
  assigned_to uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  assigned_to_name text,
  assigned_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  assigned_by_name text,
  due_date date,
  start_date date,
  completion_date timestamptz,
  estimated_hours numeric(5,2),
  actual_hours numeric(5,2),
  category text DEFAULT 'Other',
  tags text[] DEFAULT '{}',
  attachments jsonb DEFAULT '[]',
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Admin users can view all tasks
CREATE POLICY "Admin users can view all tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('Owner', 'Admin', 'Manager', 'Team Member')
    )
  );

-- Policy: Admin users can create tasks
CREATE POLICY "Admin users can create tasks"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('Owner', 'Admin', 'Manager', 'Team Member')
    )
  );

-- Policy: Admin users can update tasks
CREATE POLICY "Admin users can update tasks"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('Owner', 'Admin', 'Manager', 'Team Member')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('Owner', 'Admin', 'Manager', 'Team Member')
    )
  );

-- Policy: Admin users can delete tasks
CREATE POLICY "Admin users can delete tasks"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('Owner', 'Admin', 'Manager')
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

-- ============================================================================
-- MIGRATION 2: 20251021200351_create_tasks_table.sql
-- ============================================================================
/*
  # Create Tasks Management Table

  1. New Tables
    - `tasks`
      - `id` (uuid, primary key)
      - `task_id` (text, unique, auto-generated)
      - `title` (text, required)
      - `description` (text)
      - `status` (text) - Options: To Do, In Progress, In Review, Completed, Cancelled
      - `priority` (text) - Options: Low, Medium, High, Urgent
      - `assigned_to` (uuid, foreign key to admin_users)
      - `assigned_to_name` (text)
      - `assigned_by` (uuid, foreign key to admin_users)
      - `assigned_by_name` (text)
      - `due_date` (date)
      - `start_date` (date)
      - `completion_date` (timestamptz)
      - `estimated_hours` (numeric)
      - `actual_hours` (numeric)
      - `category` (text) - Development, Design, Marketing, Sales, Support, Operations, Other
      - `tags` (text array)
      - `attachments` (jsonb)
      - `progress_percentage` (integer, 0-100)
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `tasks` table
    - Add policies for authenticated admin users to manage tasks
    - Add policy for users to view tasks assigned to them
*/

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text UNIQUE NOT NULL DEFAULT 'TASK-' || LPAD(FLOOR(RANDOM() * 999999)::text, 6, '0'),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'To Do',
  priority text NOT NULL DEFAULT 'Medium',
  assigned_to uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  assigned_to_name text,
  assigned_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  assigned_by_name text,
  due_date date,
  start_date date,
  completion_date timestamptz,
  estimated_hours numeric(5,2),
  actual_hours numeric(5,2),
  category text DEFAULT 'Other',
  tags text[] DEFAULT '{}',
  attachments jsonb DEFAULT '[]',
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Admin users can view all tasks
CREATE POLICY "Admin users can view all tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('Owner', 'Admin', 'Manager', 'Team Member')
    )
  );

-- Policy: Admin users can create tasks
CREATE POLICY "Admin users can create tasks"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('Owner', 'Admin', 'Manager', 'Team Member')
    )
  );

-- Policy: Admin users can update tasks
CREATE POLICY "Admin users can update tasks"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('Owner', 'Admin', 'Manager', 'Team Member')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('Owner', 'Admin', 'Manager', 'Team Member')
    )
  );

-- Policy: Admin users can delete tasks
CREATE POLICY "Admin users can delete tasks"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('Owner', 'Admin', 'Manager')
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

-- ============================================================================
-- MIGRATION 3: 20251021200855_update_tasks_rls_policies.sql
-- ============================================================================
/*
  # Update Tasks RLS Policies
  
  1. Changes
    - Drop existing restrictive policies
    - Add new policies that allow any authenticated admin user
    - Policies now check if user exists in admin_users table with is_active = true
    
  2. Security
    - All authenticated users in admin_users table can manage tasks
    - Only active admin users can access tasks
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admin users can view all tasks" ON tasks;
DROP POLICY IF EXISTS "Admin users can create tasks" ON tasks;
DROP POLICY IF EXISTS "Admin users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Admin users can delete tasks" ON tasks;

-- Policy: Authenticated admin users can view all tasks
CREATE POLICY "Authenticated admin users can view all tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Policy: Authenticated admin users can create tasks
CREATE POLICY "Authenticated admin users can create tasks"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Policy: Authenticated admin users can update tasks
CREATE POLICY "Authenticated admin users can update tasks"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Policy: Authenticated admin users can delete tasks
CREATE POLICY "Authenticated admin users can delete tasks"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- ============================================================================
-- MIGRATION 4: 20251021201624_update_tasks_rls_for_anon_access.sql
-- ============================================================================
/*
  # Update Tasks RLS for Anonymous Access
  
  1. Changes
    - Drop existing restrictive policies
    - Add new policies that allow anonymous users to manage tasks
    - Allow both authenticated admin users and anonymous users full access
    
  2. Security
    - Anonymous users can create, read, update, and delete tasks
    - Authenticated admin users retain full access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated admin users can view all tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated admin users can create tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated admin users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated admin users can delete tasks" ON tasks;

-- Policy: Allow anonymous and authenticated users to view all tasks
CREATE POLICY "Allow all to view tasks"
  ON tasks
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy: Allow anonymous and authenticated users to create tasks
CREATE POLICY "Allow all to create tasks"
  ON tasks
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Allow anonymous and authenticated users to update tasks
CREATE POLICY "Allow all to update tasks"
  ON tasks
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Allow anonymous and authenticated users to delete tasks
CREATE POLICY "Allow all to delete tasks"
  ON tasks
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- MIGRATION 5: 20251022113231_add_contact_to_tasks.sql
-- ============================================================================
/*
  # Add Contact Field to Tasks Table

  1. Changes
    - Add `contact_id` column to tasks table (optional, references contacts_master)
    - Add `contact_name` column for display purposes
    - Add `contact_phone` column for easy reference
    - Create index for efficient contact-based task queries
    
  2. Purpose
    - Associate tasks with specific contacts
    - Enable contact-centric task management
    - Improve task organization and filtering by contact
*/

-- Add contact fields to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts_master(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS contact_name text,
ADD COLUMN IF NOT EXISTS contact_phone text;

-- Create index for contact-based queries
CREATE INDEX IF NOT EXISTS idx_tasks_contact_id ON tasks(contact_id);

-- ============================================================================
-- MIGRATION 6: 20251022120000_create_task_triggers.sql
-- ============================================================================
/*
  # Create Task Triggers for Webhooks

  1. Overview
    - Creates database triggers for tasks table
    - Sends webhook notifications for create, update, and delete operations
    - Follows existing pattern used for leads, affiliates, appointments, and other tables

  2. Triggers Created
    - `trigger_task_created` - Fires when a new task is added
    - `trigger_task_updated` - Fires when a task is modified
    - `trigger_task_deleted` - Fires when a task is removed

  3. Webhook Integration
    - All triggers send data to `api_webhooks` table
    - Includes full task record in payload
    - Includes trigger event type for filtering

  4. Use Cases
    - Notify external systems when tasks are created
    - Sync task updates to third-party project management tools
    - Track task lifecycle for reporting and analytics
    - Trigger automated notifications and reminders
    - Integrate with external workflow automation systems
*/

-- Function to handle task created event
CREATE OR REPLACE FUNCTION notify_task_created()
RETURNS TRIGGER AS $$
DECLARE
  webhook_record RECORD;
  payload jsonb;
BEGIN
  -- Build the payload with task data
  payload := jsonb_build_object(
    'trigger_event', 'TASK_CREATED',
    'task_id', NEW.task_id,
    'id', NEW.id,
    'title', NEW.title,
    'description', NEW.description,
    'status', NEW.status,
    'priority', NEW.priority,
    'assigned_to', NEW.assigned_to,
    'assigned_to_name', NEW.assigned_to_name,
    'assigned_by', NEW.assigned_by,
    'assigned_by_name', NEW.assigned_by_name,
    'contact_id', NEW.contact_id,
    'contact_name', NEW.contact_name,
    'contact_phone', NEW.contact_phone,
    'due_date', NEW.due_date,
    'start_date', NEW.start_date,
    'completion_date', NEW.completion_date,
    'estimated_hours', NEW.estimated_hours,
    'actual_hours', NEW.actual_hours,
    'category', NEW.category,
    'tags', NEW.tags,
    'attachments', NEW.attachments,
    'progress_percentage', NEW.progress_percentage,
    'notes', NEW.notes,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  -- Loop through all active webhooks for this trigger event
  FOR webhook_record IN
    SELECT id, webhook_url
    FROM api_webhooks
    WHERE trigger_event = 'TASK_CREATED'
    AND is_active = true
  LOOP
    -- Send HTTP POST request to webhook URL using pg_net extension
    PERFORM net.http_post(
      url := webhook_record.webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload
    );

    -- Update webhook statistics
    UPDATE api_webhooks
    SET
      last_triggered = NOW(),
      total_calls = COALESCE(total_calls, 0) + 1,
      success_count = COALESCE(success_count, 0) + 1
    WHERE id = webhook_record.id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle task updated event
CREATE OR REPLACE FUNCTION notify_task_updated()
RETURNS TRIGGER AS $$
DECLARE
  webhook_record RECORD;
  payload jsonb;
BEGIN
  -- Build the payload with task data including previous values
  payload := jsonb_build_object(
    'trigger_event', 'TASK_UPDATED',
    'task_id', NEW.task_id,
    'id', NEW.id,
    'title', NEW.title,
    'description', NEW.description,
    'status', NEW.status,
    'priority', NEW.priority,
    'assigned_to', NEW.assigned_to,
    'assigned_to_name', NEW.assigned_to_name,
    'assigned_by', NEW.assigned_by,
    'assigned_by_name', NEW.assigned_by_name,
    'contact_id', NEW.contact_id,
    'contact_name', NEW.contact_name,
    'contact_phone', NEW.contact_phone,
    'due_date', NEW.due_date,
    'start_date', NEW.start_date,
    'completion_date', NEW.completion_date,
    'estimated_hours', NEW.estimated_hours,
    'actual_hours', NEW.actual_hours,
    'category', NEW.category,
    'tags', NEW.tags,
    'attachments', NEW.attachments,
    'progress_percentage', NEW.progress_percentage,
    'notes', NEW.notes,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'previous_status', OLD.status,
    'previous_priority', OLD.priority,
    'previous_assigned_to', OLD.assigned_to,
    'previous_due_date', OLD.due_date,
    'previous_progress_percentage', OLD.progress_percentage
  );

  -- Loop through all active webhooks for this trigger event
  FOR webhook_record IN
    SELECT id, webhook_url
    FROM api_webhooks
    WHERE trigger_event = 'TASK_UPDATED'
    AND is_active = true
  LOOP
    -- Send HTTP POST request to webhook URL
    PERFORM net.http_post(
      url := webhook_record.webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload
    );

    -- Update webhook statistics
    UPDATE api_webhooks
    SET
      last_triggered = NOW(),
      total_calls = COALESCE(total_calls, 0) + 1,
      success_count = COALESCE(success_count, 0) + 1
    WHERE id = webhook_record.id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle task deleted event
CREATE OR REPLACE FUNCTION notify_task_deleted()
RETURNS TRIGGER AS $$
DECLARE
  webhook_record RECORD;
  payload jsonb;
BEGIN
  -- Build the payload with deleted task data
  payload := jsonb_build_object(
    'trigger_event', 'TASK_DELETED',
    'task_id', OLD.task_id,
    'id', OLD.id,
    'title', OLD.title,
    'description', OLD.description,
    'status', OLD.status,
    'priority', OLD.priority,
    'assigned_to', OLD.assigned_to,
    'assigned_to_name', OLD.assigned_to_name,
    'assigned_by', OLD.assigned_by,
    'assigned_by_name', OLD.assigned_by_name,
    'contact_id', OLD.contact_id,
    'contact_name', OLD.contact_name,
    'contact_phone', OLD.contact_phone,
    'due_date', OLD.due_date,
    'start_date', OLD.start_date,
    'completion_date', OLD.completion_date,
    'estimated_hours', OLD.estimated_hours,
    'actual_hours', OLD.actual_hours,
    'category', OLD.category,
    'tags', OLD.tags,
    'progress_percentage', OLD.progress_percentage,
    'deleted_at', NOW()
  );

  -- Loop through all active webhooks for this trigger event
  FOR webhook_record IN
    SELECT id, webhook_url
    FROM api_webhooks
    WHERE trigger_event = 'TASK_DELETED'
    AND is_active = true
  LOOP
    -- Send HTTP POST request to webhook URL
    PERFORM net.http_post(
      url := webhook_record.webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload
    );

    -- Update webhook statistics
    UPDATE api_webhooks
    SET
      last_triggered = NOW(),
      total_calls = COALESCE(total_calls, 0) + 1,
      success_count = COALESCE(success_count, 0) + 1
    WHERE id = webhook_record.id;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_task_created ON tasks;
DROP TRIGGER IF EXISTS trigger_task_updated ON tasks;
DROP TRIGGER IF EXISTS trigger_task_deleted ON tasks;

-- Create trigger for task creation
CREATE TRIGGER trigger_task_created
  AFTER INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_created();

-- Create trigger for task update
CREATE TRIGGER trigger_task_updated
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_updated();

-- Create trigger for task deletion
CREATE TRIGGER trigger_task_deleted
  AFTER DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_deleted();

-- ============================================================================
-- MIGRATION 7: 20251022122626_create_task_triggers.sql
-- ============================================================================
/*
  # Create Task Triggers for Webhooks

  1. Overview
    - Creates database triggers for tasks table
    - Sends webhook notifications for create, update, and delete operations
    - Follows existing pattern used for leads, affiliates, appointments, and other tables

  2. Triggers Created
    - `trigger_task_created` - Fires when a new task is added
    - `trigger_task_updated` - Fires when a task is modified
    - `trigger_task_deleted` - Fires when a task is removed

  3. Webhook Integration
    - All triggers send data to `api_webhooks` table
    - Includes full task record in payload
    - Includes trigger event type for filtering

  4. Use Cases
    - Notify external systems when tasks are created
    - Sync task updates to third-party project management tools
    - Track task lifecycle for reporting and analytics
    - Trigger automated notifications and reminders
    - Integrate with external workflow automation systems
*/

-- Function to handle task created event
CREATE OR REPLACE FUNCTION notify_task_created()
RETURNS TRIGGER AS $$
DECLARE
  webhook_record RECORD;
  payload jsonb;
BEGIN
  -- Build the payload with task data
  payload := jsonb_build_object(
    'trigger_event', 'TASK_CREATED',
    'task_id', NEW.task_id,
    'id', NEW.id,
    'title', NEW.title,
    'description', NEW.description,
    'status', NEW.status,
    'priority', NEW.priority,
    'assigned_to', NEW.assigned_to,
    'assigned_to_name', NEW.assigned_to_name,
    'assigned_by', NEW.assigned_by,
    'assigned_by_name', NEW.assigned_by_name,
    'contact_id', NEW.contact_id,
    'contact_name', NEW.contact_name,
    'contact_phone', NEW.contact_phone,
    'due_date', NEW.due_date,
    'start_date', NEW.start_date,
    'completion_date', NEW.completion_date,
    'estimated_hours', NEW.estimated_hours,
    'actual_hours', NEW.actual_hours,
    'category', NEW.category,
    'tags', NEW.tags,
    'attachments', NEW.attachments,
    'progress_percentage', NEW.progress_percentage,
    'notes', NEW.notes,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  -- Loop through all active webhooks for this trigger event
  FOR webhook_record IN
    SELECT id, webhook_url
    FROM api_webhooks
    WHERE trigger_event = 'TASK_CREATED'
    AND is_active = true
  LOOP
    -- Send HTTP POST request to webhook URL using pg_net extension
    PERFORM net.http_post(
      url := webhook_record.webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload
    );

    -- Update webhook statistics
    UPDATE api_webhooks
    SET
      last_triggered = NOW(),
      total_calls = COALESCE(total_calls, 0) + 1,
      success_count = COALESCE(success_count, 0) + 1
    WHERE id = webhook_record.id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle task updated event
CREATE OR REPLACE FUNCTION notify_task_updated()
RETURNS TRIGGER AS $$
DECLARE
  webhook_record RECORD;
  payload jsonb;
BEGIN
  -- Build the payload with task data including previous values
  payload := jsonb_build_object(
    'trigger_event', 'TASK_UPDATED',
    'task_id', NEW.task_id,
    'id', NEW.id,
    'title', NEW.title,
    'description', NEW.description,
    'status', NEW.status,
    'priority', NEW.priority,
    'assigned_to', NEW.assigned_to,
    'assigned_to_name', NEW.assigned_to_name,
    'assigned_by', NEW.assigned_by,
    'assigned_by_name', NEW.assigned_by_name,
    'contact_id', NEW.contact_id,
    'contact_name', NEW.contact_name,
    'contact_phone', NEW.contact_phone,
    'due_date', NEW.due_date,
    'start_date', NEW.start_date,
    'completion_date', NEW.completion_date,
    'estimated_hours', NEW.estimated_hours,
    'actual_hours', NEW.actual_hours,
    'category', NEW.category,
    'tags', NEW.tags,
    'attachments', NEW.attachments,
    'progress_percentage', NEW.progress_percentage,
    'notes', NEW.notes,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'previous_status', OLD.status,
    'previous_priority', OLD.priority,
    'previous_assigned_to', OLD.assigned_to,
    'previous_due_date', OLD.due_date,
    'previous_progress_percentage', OLD.progress_percentage
  );

  -- Loop through all active webhooks for this trigger event
  FOR webhook_record IN
    SELECT id, webhook_url
    FROM api_webhooks
    WHERE trigger_event = 'TASK_UPDATED'
    AND is_active = true
  LOOP
    -- Send HTTP POST request to webhook URL
    PERFORM net.http_post(
      url := webhook_record.webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload
    );

    -- Update webhook statistics
    UPDATE api_webhooks
    SET
      last_triggered = NOW(),
      total_calls = COALESCE(total_calls, 0) + 1,
      success_count = COALESCE(success_count, 0) + 1
    WHERE id = webhook_record.id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle task deleted event
CREATE OR REPLACE FUNCTION notify_task_deleted()
RETURNS TRIGGER AS $$
DECLARE
  webhook_record RECORD;
  payload jsonb;
BEGIN
  -- Build the payload with deleted task data
  payload := jsonb_build_object(
    'trigger_event', 'TASK_DELETED',
    'task_id', OLD.task_id,
    'id', OLD.id,
    'title', OLD.title,
    'description', OLD.description,
    'status', OLD.status,
    'priority', OLD.priority,
    'assigned_to', OLD.assigned_to,
    'assigned_to_name', OLD.assigned_to_name,
    'assigned_by', OLD.assigned_by,
    'assigned_by_name', OLD.assigned_by_name,
    'contact_id', OLD.contact_id,
    'contact_name', OLD.contact_name,
    'contact_phone', OLD.contact_phone,
    'due_date', OLD.due_date,
    'start_date', OLD.start_date,
    'completion_date', OLD.completion_date,
    'estimated_hours', OLD.estimated_hours,
    'actual_hours', OLD.actual_hours,
    'category', OLD.category,
    'tags', OLD.tags,
    'progress_percentage', OLD.progress_percentage,
    'deleted_at', NOW()
  );

  -- Loop through all active webhooks for this trigger event
  FOR webhook_record IN
    SELECT id, webhook_url
    FROM api_webhooks
    WHERE trigger_event = 'TASK_DELETED'
    AND is_active = true
  LOOP
    -- Send HTTP POST request to webhook URL
    PERFORM net.http_post(
      url := webhook_record.webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload
    );

    -- Update webhook statistics
    UPDATE api_webhooks
    SET
      last_triggered = NOW(),
      total_calls = COALESCE(total_calls, 0) + 1,
      success_count = COALESCE(success_count, 0) + 1
    WHERE id = webhook_record.id;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_task_created ON tasks;
DROP TRIGGER IF EXISTS trigger_task_updated ON tasks;
DROP TRIGGER IF EXISTS trigger_task_deleted ON tasks;

-- Create trigger for task creation
CREATE TRIGGER trigger_task_created
  AFTER INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_created();

-- Create trigger for task update
CREATE TRIGGER trigger_task_updated
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_updated();

-- Create trigger for task deletion
CREATE TRIGGER trigger_task_deleted
  AFTER DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_deleted();

-- ============================================================================
-- MIGRATION 8: 20251022123001_add_task_workflow_triggers.sql
-- ============================================================================
/*
  # Add Task Workflow Triggers

  1. Overview
    - Adds task trigger events to workflow_triggers table
    - Enables workflow automation for task lifecycle events
    - Follows existing pattern from appointments, leads, affiliates, etc.

  2. Triggers Added
    - Task Created - When a new task is created
    - Task Updated - When a task is modified
    - Task Deleted - When a task is removed

  3. Purpose
    - Enable workflow automations based on task events
    - Integrate tasks with external systems
    - Trigger automated notifications and actions
*/

-- Insert Task Created trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon,
  is_active
) VALUES (
  'task_created',
  'Task Created',
  'Triggered when a new task is created in the system',
  'TASK_CREATED',
  '[
    {"type": "text", "field": "task_id", "description": "Human-readable task ID (e.g., TASK-123456)"},
    {"type": "uuid", "field": "id", "description": "Unique identifier"},
    {"type": "text", "field": "title", "description": "Task title"},
    {"type": "text", "field": "description", "description": "Task description"},
    {"type": "text", "field": "status", "description": "Task status (To Do, In Progress, In Review, Completed, Cancelled)"},
    {"type": "text", "field": "priority", "description": "Task priority (Low, Medium, High, Urgent)"},
    {"type": "uuid", "field": "assigned_to", "description": "User ID assigned to task"},
    {"type": "text", "field": "assigned_to_name", "description": "Name of assigned user"},
    {"type": "uuid", "field": "assigned_by", "description": "User ID who assigned the task"},
    {"type": "text", "field": "assigned_by_name", "description": "Name of user who assigned"},
    {"type": "uuid", "field": "contact_id", "description": "Related contact ID (if linked)"},
    {"type": "text", "field": "contact_name", "description": "Related contact name"},
    {"type": "text", "field": "contact_phone", "description": "Related contact phone"},
    {"type": "date", "field": "due_date", "description": "Task due date"},
    {"type": "date", "field": "start_date", "description": "Task start date"},
    {"type": "timestamptz", "field": "completion_date", "description": "When task was completed"},
    {"type": "numeric", "field": "estimated_hours", "description": "Estimated hours to complete"},
    {"type": "numeric", "field": "actual_hours", "description": "Actual hours spent"},
    {"type": "text", "field": "category", "description": "Task category"},
    {"type": "array", "field": "tags", "description": "Task tags"},
    {"type": "jsonb", "field": "attachments", "description": "Task attachments"},
    {"type": "integer", "field": "progress_percentage", "description": "Progress percentage (0-100)"},
    {"type": "text", "field": "notes", "description": "Additional notes"},
    {"type": "timestamptz", "field": "created_at", "description": "When the task was created"},
    {"type": "timestamptz", "field": "updated_at", "description": "When the task was last updated"}
  ]'::jsonb,
  'Tasks',
  'list-checks',
  true
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  event_name = EXCLUDED.event_name,
  event_schema = EXCLUDED.event_schema,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Insert Task Updated trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon,
  is_active
) VALUES (
  'task_updated',
  'Task Updated',
  'Triggered when an existing task is modified',
  'TASK_UPDATED',
  '[
    {"type": "text", "field": "task_id", "description": "Human-readable task ID (e.g., TASK-123456)"},
    {"type": "uuid", "field": "id", "description": "Unique identifier"},
    {"type": "text", "field": "title", "description": "Task title"},
    {"type": "text", "field": "description", "description": "Task description"},
    {"type": "text", "field": "status", "description": "Task status (To Do, In Progress, In Review, Completed, Cancelled)"},
    {"type": "text", "field": "priority", "description": "Task priority (Low, Medium, High, Urgent)"},
    {"type": "uuid", "field": "assigned_to", "description": "User ID assigned to task"},
    {"type": "text", "field": "assigned_to_name", "description": "Name of assigned user"},
    {"type": "uuid", "field": "assigned_by", "description": "User ID who assigned the task"},
    {"type": "text", "field": "assigned_by_name", "description": "Name of user who assigned"},
    {"type": "uuid", "field": "contact_id", "description": "Related contact ID (if linked)"},
    {"type": "text", "field": "contact_name", "description": "Related contact name"},
    {"type": "text", "field": "contact_phone", "description": "Related contact phone"},
    {"type": "date", "field": "due_date", "description": "Task due date"},
    {"type": "date", "field": "start_date", "description": "Task start date"},
    {"type": "timestamptz", "field": "completion_date", "description": "When task was completed"},
    {"type": "numeric", "field": "estimated_hours", "description": "Estimated hours to complete"},
    {"type": "numeric", "field": "actual_hours", "description": "Actual hours spent"},
    {"type": "text", "field": "category", "description": "Task category"},
    {"type": "array", "field": "tags", "description": "Task tags"},
    {"type": "jsonb", "field": "attachments", "description": "Task attachments"},
    {"type": "integer", "field": "progress_percentage", "description": "Progress percentage (0-100)"},
    {"type": "text", "field": "notes", "description": "Additional notes"},
    {"type": "timestamptz", "field": "created_at", "description": "When the task was created"},
    {"type": "timestamptz", "field": "updated_at", "description": "When the task was last updated"},
    {"type": "text", "field": "previous_status", "description": "Previous status before update"},
    {"type": "text", "field": "previous_priority", "description": "Previous priority before update"},
    {"type": "uuid", "field": "previous_assigned_to", "description": "Previous assigned user"},
    {"type": "date", "field": "previous_due_date", "description": "Previous due date"},
    {"type": "integer", "field": "previous_progress_percentage", "description": "Previous progress percentage"}
  ]'::jsonb,
  'Tasks',
  'list-checks',
  true
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  event_name = EXCLUDED.event_name,
  event_schema = EXCLUDED.event_schema,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Insert Task Deleted trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon,
  is_active
) VALUES (
  'task_deleted',
  'Task Deleted',
  'Triggered when a task is deleted from the system',
  'TASK_DELETED',
  '[
    {"type": "text", "field": "task_id", "description": "Human-readable task ID (e.g., TASK-123456)"},
    {"type": "uuid", "field": "id", "description": "Unique identifier"},
    {"type": "text", "field": "title", "description": "Task title"},
    {"type": "text", "field": "description", "description": "Task description"},
    {"type": "text", "field": "status", "description": "Task status at deletion"},
    {"type": "text", "field": "priority", "description": "Task priority"},
    {"type": "uuid", "field": "assigned_to", "description": "User ID assigned to task"},
    {"type": "text", "field": "assigned_to_name", "description": "Name of assigned user"},
    {"type": "uuid", "field": "assigned_by", "description": "User ID who assigned the task"},
    {"type": "text", "field": "assigned_by_name", "description": "Name of user who assigned"},
    {"type": "uuid", "field": "contact_id", "description": "Related contact ID (if linked)"},
    {"type": "text", "field": "contact_name", "description": "Related contact name"},
    {"type": "text", "field": "contact_phone", "description": "Related contact phone"},
    {"type": "date", "field": "due_date", "description": "Task due date"},
    {"type": "date", "field": "start_date", "description": "Task start date"},
    {"type": "timestamptz", "field": "completion_date", "description": "When task was completed"},
    {"type": "numeric", "field": "estimated_hours", "description": "Estimated hours to complete"},
    {"type": "numeric", "field": "actual_hours", "description": "Actual hours spent"},
    {"type": "text", "field": "category", "description": "Task category"},
    {"type": "array", "field": "tags", "description": "Task tags"},
    {"type": "integer", "field": "progress_percentage", "description": "Progress percentage (0-100)"},
    {"type": "timestamptz", "field": "deleted_at", "description": "When the task was deleted"}
  ]'::jsonb,
  'Tasks',
  'list-checks',
  true
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  event_name = EXCLUDED.event_name,
  event_schema = EXCLUDED.event_schema,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ============================================================================
-- MIGRATION 9: 20251022124554_update_task_triggers_with_phone_numbers.sql
-- ============================================================================
/*
  # Update Task Triggers to Include Phone Numbers

  1. Overview
    - Updates task trigger functions to include phone numbers
    - Fetches assigned_by_phone from admin_users table for the user who created the task
    - Fetches assigned_to_phone from admin_users table for the assigned user
    - Maintains all existing functionality

  2. Changes
    - notify_task_created() - adds assigned_by_phone and assigned_to_phone
    - notify_task_updated() - adds assigned_by_phone and assigned_to_phone
    - notify_task_deleted() - adds assigned_by_phone and assigned_to_phone

  3. Purpose
    - Enable SMS/WhatsApp notifications to task creators and assignees
    - Provide complete contact information in webhook payloads
*/

-- Function to handle task created event (updated with phone numbers)
CREATE OR REPLACE FUNCTION notify_task_created()
RETURNS TRIGGER AS $$
DECLARE
  webhook_record RECORD;
  payload jsonb;
  v_assigned_by_phone text;
  v_assigned_to_phone text;
BEGIN
  -- Fetch phone numbers from admin_users table
  SELECT phone INTO v_assigned_by_phone
  FROM admin_users
  WHERE id = NEW.assigned_by;

  SELECT phone INTO v_assigned_to_phone
  FROM admin_users
  WHERE id = NEW.assigned_to;

  -- Build the payload with task data including phone numbers
  payload := jsonb_build_object(
    'trigger_event', 'TASK_CREATED',
    'task_id', NEW.task_id,
    'id', NEW.id,
    'title', NEW.title,
    'description', NEW.description,
    'status', NEW.status,
    'priority', NEW.priority,
    'assigned_to', NEW.assigned_to,
    'assigned_to_name', NEW.assigned_to_name,
    'assigned_to_phone', v_assigned_to_phone,
    'assigned_by', NEW.assigned_by,
    'assigned_by_name', NEW.assigned_by_name,
    'assigned_by_phone', v_assigned_by_phone,
    'contact_id', NEW.contact_id,
    'contact_name', NEW.contact_name,
    'contact_phone', NEW.contact_phone,
    'due_date', NEW.due_date,
    'start_date', NEW.start_date,
    'completion_date', NEW.completion_date,
    'estimated_hours', NEW.estimated_hours,
    'actual_hours', NEW.actual_hours,
    'category', NEW.category,
    'tags', NEW.tags,
    'attachments', NEW.attachments,
    'progress_percentage', NEW.progress_percentage,
    'notes', NEW.notes,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  -- Loop through all active webhooks for this trigger event
  FOR webhook_record IN
    SELECT id, webhook_url
    FROM api_webhooks
    WHERE trigger_event = 'TASK_CREATED'
    AND is_active = true
  LOOP
    -- Send HTTP POST request to webhook URL using pg_net extension
    PERFORM net.http_post(
      url := webhook_record.webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload
    );

    -- Update webhook statistics
    UPDATE api_webhooks
    SET
      last_triggered = NOW(),
      total_calls = COALESCE(total_calls, 0) + 1,
      success_count = COALESCE(success_count, 0) + 1
    WHERE id = webhook_record.id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle task updated event (updated with phone numbers)
CREATE OR REPLACE FUNCTION notify_task_updated()
RETURNS TRIGGER AS $$
DECLARE
  webhook_record RECORD;
  payload jsonb;
  v_assigned_by_phone text;
  v_assigned_to_phone text;
BEGIN
  -- Fetch phone numbers from admin_users table
  SELECT phone INTO v_assigned_by_phone
  FROM admin_users
  WHERE id = NEW.assigned_by;

  SELECT phone INTO v_assigned_to_phone
  FROM admin_users
  WHERE id = NEW.assigned_to;

  -- Build the payload with task data including phone numbers and previous values
  payload := jsonb_build_object(
    'trigger_event', 'TASK_UPDATED',
    'task_id', NEW.task_id,
    'id', NEW.id,
    'title', NEW.title,
    'description', NEW.description,
    'status', NEW.status,
    'priority', NEW.priority,
    'assigned_to', NEW.assigned_to,
    'assigned_to_name', NEW.assigned_to_name,
    'assigned_to_phone', v_assigned_to_phone,
    'assigned_by', NEW.assigned_by,
    'assigned_by_name', NEW.assigned_by_name,
    'assigned_by_phone', v_assigned_by_phone,
    'contact_id', NEW.contact_id,
    'contact_name', NEW.contact_name,
    'contact_phone', NEW.contact_phone,
    'due_date', NEW.due_date,
    'start_date', NEW.start_date,
    'completion_date', NEW.completion_date,
    'estimated_hours', NEW.estimated_hours,
    'actual_hours', NEW.actual_hours,
    'category', NEW.category,
    'tags', NEW.tags,
    'attachments', NEW.attachments,
    'progress_percentage', NEW.progress_percentage,
    'notes', NEW.notes,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'previous_status', OLD.status,
    'previous_priority', OLD.priority,
    'previous_assigned_to', OLD.assigned_to,
    'previous_due_date', OLD.due_date,
    'previous_progress_percentage', OLD.progress_percentage
  );

  -- Loop through all active webhooks for this trigger event
  FOR webhook_record IN
    SELECT id, webhook_url
    FROM api_webhooks
    WHERE trigger_event = 'TASK_UPDATED'
    AND is_active = true
  LOOP
    -- Send HTTP POST request to webhook URL
    PERFORM net.http_post(
      url := webhook_record.webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload
    );

    -- Update webhook statistics
    UPDATE api_webhooks
    SET
      last_triggered = NOW(),
      total_calls = COALESCE(total_calls, 0) + 1,
      success_count = COALESCE(success_count, 0) + 1
    WHERE id = webhook_record.id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle task deleted event (updated with phone numbers)
CREATE OR REPLACE FUNCTION notify_task_deleted()
RETURNS TRIGGER AS $$
DECLARE
  webhook_record RECORD;
  payload jsonb;
  v_assigned_by_phone text;
  v_assigned_to_phone text;
BEGIN
  -- Fetch phone numbers from admin_users table
  SELECT phone INTO v_assigned_by_phone
  FROM admin_users
  WHERE id = OLD.assigned_by;

  SELECT phone INTO v_assigned_to_phone
  FROM admin_users
  WHERE id = OLD.assigned_to;

  -- Build the payload with deleted task data including phone numbers
  payload := jsonb_build_object(
    'trigger_event', 'TASK_DELETED',
    'task_id', OLD.task_id,
    'id', OLD.id,
    'title', OLD.title,
    'description', OLD.description,
    'status', OLD.status,
    'priority', OLD.priority,
    'assigned_to', OLD.assigned_to,
    'assigned_to_name', OLD.assigned_to_name,
    'assigned_to_phone', v_assigned_to_phone,
    'assigned_by', OLD.assigned_by,
    'assigned_by_name', OLD.assigned_by_name,
    'assigned_by_phone', v_assigned_by_phone,
    'contact_id', OLD.contact_id,
    'contact_name', OLD.contact_name,
    'contact_phone', OLD.contact_phone,
    'due_date', OLD.due_date,
    'start_date', OLD.start_date,
    'completion_date', OLD.completion_date,
    'estimated_hours', OLD.estimated_hours,
    'actual_hours', OLD.actual_hours,
    'category', OLD.category,
    'tags', OLD.tags,
    'progress_percentage', OLD.progress_percentage,
    'deleted_at', NOW()
  );

  -- Loop through all active webhooks for this trigger event
  FOR webhook_record IN
    SELECT id, webhook_url
    FROM api_webhooks
    WHERE trigger_event = 'TASK_DELETED'
    AND is_active = true
  LOOP
    -- Send HTTP POST request to webhook URL
    PERFORM net.http_post(
      url := webhook_record.webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload
    );

    -- Update webhook statistics
    UPDATE api_webhooks
    SET
      last_triggered = NOW(),
      total_calls = COALESCE(total_calls, 0) + 1,
      success_count = COALESCE(success_count, 0) + 1
    WHERE id = webhook_record.id;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION 10: 20251022124628_update_task_workflow_triggers_schema_with_phone.sql
-- ============================================================================
/*
  # Update Task Workflow Triggers Schema with Phone Numbers

  1. Overview
    - Updates task workflow trigger event schemas to include phone number fields
    - Adds assigned_by_phone and assigned_to_phone to all task trigger schemas

  2. Changes
    - Updates task_created schema
    - Updates task_updated schema
    - Updates task_deleted schema

  3. Purpose
    - Reflect the actual data being sent in webhook payloads
    - Enable workflow automations to use phone numbers for SMS/WhatsApp
*/

-- Update Task Created trigger schema
UPDATE workflow_triggers
SET event_schema = '[
  {"type": "text", "field": "task_id", "description": "Human-readable task ID (e.g., TASK-123456)"},
  {"type": "uuid", "field": "id", "description": "Unique identifier"},
  {"type": "text", "field": "title", "description": "Task title"},
  {"type": "text", "field": "description", "description": "Task description"},
  {"type": "text", "field": "status", "description": "Task status (To Do, In Progress, In Review, Completed, Cancelled)"},
  {"type": "text", "field": "priority", "description": "Task priority (Low, Medium, High, Urgent)"},
  {"type": "uuid", "field": "assigned_to", "description": "User ID assigned to task"},
  {"type": "text", "field": "assigned_to_name", "description": "Name of assigned user"},
  {"type": "text", "field": "assigned_to_phone", "description": "Phone number of assigned user"},
  {"type": "uuid", "field": "assigned_by", "description": "User ID who assigned the task"},
  {"type": "text", "field": "assigned_by_name", "description": "Name of user who assigned"},
  {"type": "text", "field": "assigned_by_phone", "description": "Phone number of user who assigned"},
  {"type": "uuid", "field": "contact_id", "description": "Related contact ID (if linked)"},
  {"type": "text", "field": "contact_name", "description": "Related contact name"},
  {"type": "text", "field": "contact_phone", "description": "Related contact phone"},
  {"type": "date", "field": "due_date", "description": "Task due date"},
  {"type": "date", "field": "start_date", "description": "Task start date"},
  {"type": "timestamptz", "field": "completion_date", "description": "When task was completed"},
  {"type": "numeric", "field": "estimated_hours", "description": "Estimated hours to complete"},
  {"type": "numeric", "field": "actual_hours", "description": "Actual hours spent"},
  {"type": "text", "field": "category", "description": "Task category"},
  {"type": "array", "field": "tags", "description": "Task tags"},
  {"type": "jsonb", "field": "attachments", "description": "Task attachments"},
  {"type": "integer", "field": "progress_percentage", "description": "Progress percentage (0-100)"},
  {"type": "text", "field": "notes", "description": "Additional notes"},
  {"type": "timestamptz", "field": "created_at", "description": "When the task was created"},
  {"type": "timestamptz", "field": "updated_at", "description": "When the task was last updated"}
]'::jsonb,
updated_at = NOW()
WHERE name = 'task_created';

-- Update Task Updated trigger schema
UPDATE workflow_triggers
SET event_schema = '[
  {"type": "text", "field": "task_id", "description": "Human-readable task ID (e.g., TASK-123456)"},
  {"type": "uuid", "field": "id", "description": "Unique identifier"},
  {"type": "text", "field": "title", "description": "Task title"},
  {"type": "text", "field": "description", "description": "Task description"},
  {"type": "text", "field": "status", "description": "Task status (To Do, In Progress, In Review, Completed, Cancelled)"},
  {"type": "text", "field": "priority", "description": "Task priority (Low, Medium, High, Urgent)"},
  {"type": "uuid", "field": "assigned_to", "description": "User ID assigned to task"},
  {"type": "text", "field": "assigned_to_name", "description": "Name of assigned user"},
  {"type": "text", "field": "assigned_to_phone", "description": "Phone number of assigned user"},
  {"type": "uuid", "field": "assigned_by", "description": "User ID who assigned the task"},
  {"type": "text", "field": "assigned_by_name", "description": "Name of user who assigned"},
  {"type": "text", "field": "assigned_by_phone", "description": "Phone number of user who assigned"},
  {"type": "uuid", "field": "contact_id", "description": "Related contact ID (if linked)"},
  {"type": "text", "field": "contact_name", "description": "Related contact name"},
  {"type": "text", "field": "contact_phone", "description": "Related contact phone"},
  {"type": "date", "field": "due_date", "description": "Task due date"},
  {"type": "date", "field": "start_date", "description": "Task start date"},
  {"type": "timestamptz", "field": "completion_date", "description": "When task was completed"},
  {"type": "numeric", "field": "estimated_hours", "description": "Estimated hours to complete"},
  {"type": "numeric", "field": "actual_hours", "description": "Actual hours spent"},
  {"type": "text", "field": "category", "description": "Task category"},
  {"type": "array", "field": "tags", "description": "Task tags"},
  {"type": "jsonb", "field": "attachments", "description": "Task attachments"},
  {"type": "integer", "field": "progress_percentage", "description": "Progress percentage (0-100)"},
  {"type": "text", "field": "notes", "description": "Additional notes"},
  {"type": "timestamptz", "field": "created_at", "description": "When the task was created"},
  {"type": "timestamptz", "field": "updated_at", "description": "When the task was last updated"},
  {"type": "text", "field": "previous_status", "description": "Previous status before update"},
  {"type": "text", "field": "previous_priority", "description": "Previous priority before update"},
  {"type": "uuid", "field": "previous_assigned_to", "description": "Previous assigned user"},
  {"type": "date", "field": "previous_due_date", "description": "Previous due date"},
  {"type": "integer", "field": "previous_progress_percentage", "description": "Previous progress percentage"}
]'::jsonb,
updated_at = NOW()
WHERE name = 'task_updated';

-- Update Task Deleted trigger schema
UPDATE workflow_triggers
SET event_schema = '[
  {"type": "text", "field": "task_id", "description": "Human-readable task ID (e.g., TASK-123456)"},
  {"type": "uuid", "field": "id", "description": "Unique identifier"},
  {"type": "text", "field": "title", "description": "Task title"},
  {"type": "text", "field": "description", "description": "Task description"},
  {"type": "text", "field": "status", "description": "Task status at deletion"},
  {"type": "text", "field": "priority", "description": "Task priority"},
  {"type": "uuid", "field": "assigned_to", "description": "User ID assigned to task"},
  {"type": "text", "field": "assigned_to_name", "description": "Name of assigned user"},
  {"type": "text", "field": "assigned_to_phone", "description": "Phone number of assigned user"},
  {"type": "uuid", "field": "assigned_by", "description": "User ID who assigned the task"},
  {"type": "text", "field": "assigned_by_name", "description": "Name of user who assigned"},
  {"type": "text", "field": "assigned_by_phone", "description": "Phone number of user who assigned"},
  {"type": "uuid", "field": "contact_id", "description": "Related contact ID (if linked)"},
  {"type": "text", "field": "contact_name", "description": "Related contact name"},
  {"type": "text", "field": "contact_phone", "description": "Related contact phone"},
  {"type": "date", "field": "due_date", "description": "Task due date"},
  {"type": "date", "field": "start_date", "description": "Task start date"},
  {"type": "timestamptz", "field": "completion_date", "description": "When task was completed"},
  {"type": "numeric", "field": "estimated_hours", "description": "Estimated hours to complete"},
  {"type": "numeric", "field": "actual_hours", "description": "Actual hours spent"},
  {"type": "text", "field": "category", "description": "Task category"},
  {"type": "array", "field": "tags", "description": "Task tags"},
  {"type": "integer", "field": "progress_percentage", "description": "Progress percentage (0-100)"},
  {"type": "timestamptz", "field": "deleted_at", "description": "When the task was deleted"}
]'::jsonb,
updated_at = NOW()
WHERE name = 'task_deleted';

/*
================================================================================
END OF GROUP 10: TASKS MANAGEMENT SYSTEM
================================================================================
Next Group: group-11-contact-triggers-and-webhooks.sql
*/
