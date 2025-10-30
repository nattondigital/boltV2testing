/*
================================================================================
GROUP 14: ADVANCED FEATURES AND OPTIMIZATIONS
================================================================================

Task enhancements, custom fields, media folders, and task reminders

Total Files: 22
Dependencies: Group 13

Files Included (in execution order):
1. 20251026141827_add_method_to_webhooks.sql
2. 20251026145852_add_task_denormalized_fields_trigger.sql
3. 20251026151051_update_task_id_format_to_sequential.sql
4. 20251026161241_update_support_tickets_assigned_to_uuid.sql
5. 20251026185603_create_ai_agent_chat_memory_table.sql
6. 20251027000000_create_media_folder_assignments_table.sql
7. 20251027100731_create_media_folder_assignments_table.sql
8. 20251027104205_add_ticket_trigger_events_to_media_folder_assignments.sql
9. 20251027104439_add_ticket_trigger_events_to_media_folder_assignments.sql
10. 20251027185316_fix_product_triggers_column_names.sql
11. 20251029165927_create_custom_lead_tabs_table.sql
12. 20251029170814_update_custom_lead_tabs_rls_for_anon_access.sql
13. 20251029172535_create_custom_fields_table.sql
14. 20251029183311_add_new_custom_field_types.sql
15. 20251029190000_update_tasks_remove_tags_notes_add_supporting_docs.sql
16. 20251029194626_update_tasks_remove_tags_notes_add_supporting_docs.sql
17. 20251029195000_fix_task_triggers_remove_tags_notes.sql
18. 20251029195245_fix_task_triggers_remove_tags_notes.sql
19. 20251029203201_update_tasks_datetime_fields.sql
20. 20251029212143_create_task_reminders_table.sql
21. 20251029214830_add_task_reminder_workflow_trigger.sql
22. 20251029214859_create_task_reminder_scheduler_function.sql

================================================================================
*/

-- ============================================================================
-- MIGRATION 1: 20251026141827_add_method_to_webhooks.sql
-- ============================================================================
/*
  # Add HTTP method to webhooks table

  1. Changes
    - Add `method` column to `webhooks` table with default value 'POST'
    - Update existing 'Get Team Member' webhook to use 'GET' method
  
  2. Notes
    - This allows the UI to generate proper cURL commands for different HTTP methods
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhooks' AND column_name = 'method'
  ) THEN
    ALTER TABLE webhooks ADD COLUMN method text DEFAULT 'POST';
  END IF;
END $$;

UPDATE webhooks 
SET method = 'GET' 
WHERE name = 'Get Team Member';

-- ============================================================================
-- MIGRATION 2: 20251026145852_add_task_denormalized_fields_trigger.sql
-- ============================================================================
/*
  # Add trigger to populate denormalized fields in tasks table

  1. Changes
    - Creates a trigger function to automatically populate assigned_to_name, assigned_by_name, contact_name, and contact_phone
    - Triggers on INSERT and UPDATE operations
    - Fetches data from admin_users and contacts_master tables based on UUIDs
    
  2. Purpose
    - Maintains denormalized data for performance and easier querying
    - Ensures data consistency when tasks are created or updated via webhooks or UI
*/

-- Create function to populate denormalized fields
CREATE OR REPLACE FUNCTION populate_task_denormalized_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Populate assigned_to_name
  IF NEW.assigned_to IS NOT NULL THEN
    SELECT full_name INTO NEW.assigned_to_name
    FROM admin_users
    WHERE id = NEW.assigned_to;
  ELSE
    NEW.assigned_to_name := NULL;
  END IF;

  -- Populate assigned_by_name
  IF NEW.assigned_by IS NOT NULL THEN
    SELECT full_name INTO NEW.assigned_by_name
    FROM admin_users
    WHERE id = NEW.assigned_by;
  ELSE
    NEW.assigned_by_name := NULL;
  END IF;

  -- Populate contact_name and contact_phone
  IF NEW.contact_id IS NOT NULL THEN
    SELECT full_name, phone INTO NEW.contact_name, NEW.contact_phone
    FROM contacts_master
    WHERE id = NEW.contact_id;
  ELSE
    NEW.contact_name := NULL;
    NEW.contact_phone := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_populate_task_denormalized_fields ON tasks;

-- Create trigger that runs before insert or update
CREATE TRIGGER trigger_populate_task_denormalized_fields
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION populate_task_denormalized_fields();

-- ============================================================================
-- MIGRATION 3: 20251026151051_update_task_id_format_to_sequential.sql
-- ============================================================================
/*
  # Update Task ID Format to Sequential Series

  1. Changes
    - Creates a sequence for task IDs starting from 10001
    - Updates all existing tasks to use the new sequential format (TASK-10001, TASK-10002, etc.)
    - Updates the default value generator to use the sequence
    - Creates a trigger to auto-generate task_id for new tasks
    
  2. Purpose
    - Provides cleaner, more professional task IDs
    - Ensures sequential numbering without gaps
    - Maintains uniqueness across all tasks
*/

-- Create sequence for task IDs starting from 10001
CREATE SEQUENCE IF NOT EXISTS task_id_seq START WITH 10001;

-- Update existing tasks with new sequential IDs ordered by created_at
DO $$
DECLARE
  task_record RECORD;
  counter INTEGER := 10001;
BEGIN
  FOR task_record IN 
    SELECT id FROM tasks ORDER BY created_at ASC
  LOOP
    UPDATE tasks 
    SET task_id = 'TASK-' || counter 
    WHERE id = task_record.id;
    counter := counter + 1;
  END LOOP;
  
  -- Set the sequence to the next value
  PERFORM setval('task_id_seq', counter);
END $$;

-- Drop the old default constraint
ALTER TABLE tasks ALTER COLUMN task_id DROP DEFAULT;

-- Create function to generate task_id using sequence
CREATE OR REPLACE FUNCTION generate_task_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.task_id IS NULL OR NEW.task_id = '' THEN
    NEW.task_id := 'TASK-' || nextval('task_id_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_generate_task_id ON tasks;

-- Create trigger to auto-generate task_id
CREATE TRIGGER trigger_generate_task_id
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION generate_task_id();

-- ============================================================================
-- MIGRATION 4: 20251026161241_update_support_tickets_assigned_to_uuid.sql
-- ============================================================================
/*
  # Update Support Tickets assigned_to to UUID
  
  1. Changes
    - Convert `assigned_to` column from text to uuid
    - Add foreign key constraint to reference admin_users table
    - This ensures assigned_to values are valid admin user IDs
  
  2. Security
    - Maintains existing RLS policies
    - Ensures data integrity with foreign key constraint
*/

DO $$
BEGIN
  -- Drop existing data in assigned_to if it's not a valid UUID
  UPDATE support_tickets
  SET assigned_to = NULL
  WHERE assigned_to IS NOT NULL 
    AND assigned_to !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  -- Drop the column if it's text type and recreate as UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' 
      AND column_name = 'assigned_to'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE support_tickets DROP COLUMN assigned_to;
    ALTER TABLE support_tickets ADD COLUMN assigned_to uuid REFERENCES admin_users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- MIGRATION 5: 20251026185603_create_ai_agent_chat_memory_table.sql
-- ============================================================================
/*
  # Create AI Agent Chat Memory Table

  1. New Tables
    - `ai_agent_chat_memory`
      - `id` (uuid, primary key)
      - `agent_id` (uuid, references ai_agents)
      - `phone_number` (text) - Phone number of the contact
      - `message` (text) - Chat message content
      - `role` (text) - Either 'user' or 'assistant'
      - `metadata` (jsonb) - Additional message metadata
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on `ai_agent_chat_memory` table
    - Add policy for authenticated admin users to manage chat memory
  
  3. Indexes
    - Index on agent_id for faster lookups
    - Index on phone_number for faster filtering
    - Composite index on (phone_number, created_at) for efficient cleanup
  
  4. Automatic Cleanup
    - Add trigger function to automatically delete old messages
    - Keep only the last 100 messages per phone number
    - Trigger fires after each insert
*/

CREATE TABLE IF NOT EXISTS ai_agent_chat_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES ai_agents(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  message text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_chat_memory_agent_id ON ai_agent_chat_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_chat_memory_phone ON ai_agent_chat_memory(phone_number);
CREATE INDEX IF NOT EXISTS idx_ai_agent_chat_memory_phone_created ON ai_agent_chat_memory(phone_number, created_at DESC);

ALTER TABLE ai_agent_chat_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can manage chat memory"
  ON ai_agent_chat_memory
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Allow anon read access to chat memory"
  ON ai_agent_chat_memory
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert access to chat memory"
  ON ai_agent_chat_memory
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION cleanup_old_chat_messages()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM ai_agent_chat_memory
  WHERE id IN (
    SELECT id
    FROM ai_agent_chat_memory
    WHERE phone_number = NEW.phone_number
    ORDER BY created_at DESC
    OFFSET 100
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_old_chat_messages
  AFTER INSERT ON ai_agent_chat_memory
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_old_chat_messages();

-- ============================================================================
-- MIGRATION 6: 20251027000000_create_media_folder_assignments_table.sql
-- ============================================================================
/*
  # Create Media Folder Assignments Table

  1. New Tables
    - `media_folder_assignments`
      - `id` (uuid, primary key) - Unique identifier
      - `trigger_event` (text) - Trigger event name (e.g., ATTENDANCE_CHECKIN, EXPENSE_ADDED)
      - `module` (text) - Module name (e.g., Attendance, Expenses)
      - `media_folder_id` (uuid) - Reference to media_folders table
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Update timestamp

  2. Security
    - Enable RLS on table
    - Add policies for anonymous access (read/write)

  3. Indexes
    - Index on trigger_event for fast lookups
    - Index on module for filtering
    - Unique constraint on trigger_event to prevent duplicates

  4. Initial Data
    - Add default assignments for Attendance and Expense events
*/

CREATE TABLE IF NOT EXISTS media_folder_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_event text UNIQUE NOT NULL,
  module text NOT NULL,
  media_folder_id uuid REFERENCES media_folders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE media_folder_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to media_folder_assignments"
  ON media_folder_assignments
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to media_folder_assignments"
  ON media_folder_assignments
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to media_folder_assignments"
  ON media_folder_assignments
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to media_folder_assignments"
  ON media_folder_assignments
  FOR DELETE
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_media_folder_assignments_trigger_event ON media_folder_assignments(trigger_event);
CREATE INDEX IF NOT EXISTS idx_media_folder_assignments_module ON media_folder_assignments(module);
CREATE INDEX IF NOT EXISTS idx_media_folder_assignments_folder_id ON media_folder_assignments(media_folder_id);

CREATE OR REPLACE FUNCTION update_media_folder_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_media_folder_assignments_updated_at
  BEFORE UPDATE ON media_folder_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_media_folder_assignments_updated_at();

-- Insert default media folder assignments for common triggers
INSERT INTO media_folder_assignments (trigger_event, module, media_folder_id)
VALUES
  ('ATTENDANCE_CHECKIN', 'Attendance', NULL),
  ('ATTENDANCE_CHECKOUT', 'Attendance', NULL),
  ('EXPENSE_ADDED', 'Expenses', NULL),
  ('EXPENSE_UPDATED', 'Expenses', NULL),
  ('EXPENSE_DELETED', 'Expenses', NULL)
ON CONFLICT (trigger_event) DO NOTHING;

COMMENT ON TABLE media_folder_assignments IS 'Maps trigger events to specific media folders for GHL media file organization';
COMMENT ON COLUMN media_folder_assignments.trigger_event IS 'The trigger event name from workflow_triggers or database triggers';
COMMENT ON COLUMN media_folder_assignments.module IS 'The module this trigger belongs to (for grouping in UI)';
COMMENT ON COLUMN media_folder_assignments.media_folder_id IS 'The media folder where files related to this trigger should be displayed';

-- ============================================================================
-- MIGRATION 7: 20251027100731_create_media_folder_assignments_table.sql
-- ============================================================================
/*
  # Create Media Folder Assignments Table

  1. New Tables
    - `media_folder_assignments`
      - `id` (uuid, primary key) - Unique identifier
      - `trigger_event` (text) - Trigger event name (e.g., ATTENDANCE_CHECKIN, EXPENSE_ADDED)
      - `module` (text) - Module name (e.g., Attendance, Expenses)
      - `media_folder_id` (uuid) - Reference to media_folders table
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Update timestamp

  2. Security
    - Enable RLS on table
    - Add policies for anonymous access (read/write)

  3. Indexes
    - Index on trigger_event for fast lookups
    - Index on module for filtering
    - Unique constraint on trigger_event to prevent duplicates

  4. Initial Data
    - Add default assignments for Attendance and Expense events
*/

CREATE TABLE IF NOT EXISTS media_folder_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_event text UNIQUE NOT NULL,
  module text NOT NULL,
  media_folder_id uuid REFERENCES media_folders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE media_folder_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to media_folder_assignments"
  ON media_folder_assignments
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to media_folder_assignments"
  ON media_folder_assignments
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to media_folder_assignments"
  ON media_folder_assignments
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to media_folder_assignments"
  ON media_folder_assignments
  FOR DELETE
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_media_folder_assignments_trigger_event ON media_folder_assignments(trigger_event);
CREATE INDEX IF NOT EXISTS idx_media_folder_assignments_module ON media_folder_assignments(module);
CREATE INDEX IF NOT EXISTS idx_media_folder_assignments_folder_id ON media_folder_assignments(media_folder_id);

CREATE OR REPLACE FUNCTION update_media_folder_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_media_folder_assignments_updated_at
  BEFORE UPDATE ON media_folder_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_media_folder_assignments_updated_at();

-- Insert default media folder assignments for common triggers
INSERT INTO media_folder_assignments (trigger_event, module, media_folder_id)
VALUES
  ('ATTENDANCE_CHECKIN', 'Attendance', NULL),
  ('ATTENDANCE_CHECKOUT', 'Attendance', NULL),
  ('EXPENSE_ADDED', 'Expenses', NULL),
  ('EXPENSE_UPDATED', 'Expenses', NULL),
  ('EXPENSE_DELETED', 'Expenses', NULL)
ON CONFLICT (trigger_event) DO NOTHING;

COMMENT ON TABLE media_folder_assignments IS 'Maps trigger events to specific media folders for GHL media file organization';
COMMENT ON COLUMN media_folder_assignments.trigger_event IS 'The trigger event name from workflow_triggers or database triggers';
COMMENT ON COLUMN media_folder_assignments.module IS 'The module this trigger belongs to (for grouping in UI)';
COMMENT ON COLUMN media_folder_assignments.media_folder_id IS 'The media folder where files related to this trigger should be displayed';

-- ============================================================================
-- MIGRATION 8: 20251027104205_add_ticket_trigger_events_to_media_folder_assignments.sql
-- ============================================================================
/*
  # Add Support Ticket Trigger Events to Media Folder Assignments

  1. Changes
    - Add TICKET_CREATED trigger event for Support module
    - Add TICKET_UPDATED trigger event for Support module
    - Allows support ticket attachments to be organized into specific GHL folders

  2. New Assignments
    - TICKET_CREATED: For attachments when creating support tickets
    - TICKET_UPDATED: For attachments when updating support tickets

  3. Notes
    - media_folder_id is initially set to NULL (will be configured via UI)
    - Uses ON CONFLICT to prevent duplicate entries if already exists
*/

-- Insert support ticket trigger events into media_folder_assignments
INSERT INTO media_folder_assignments (trigger_event, module, media_folder_id)
VALUES
  ('TICKET_CREATED', 'Support', NULL),
  ('TICKET_UPDATED', 'Support', NULL)
ON CONFLICT (trigger_event) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE media_folder_assignments IS 'Maps trigger events to specific media folders for GHL media file organization. Includes events for Attendance, Expenses, and Support tickets.';

-- ============================================================================
-- MIGRATION 9: 20251027104439_add_ticket_trigger_events_to_media_folder_assignments.sql
-- ============================================================================
/*
  # Add Support Ticket Trigger Events to Media Folder Assignments

  1. Changes
    - Add TICKET_CREATED trigger event for Support module
    - Add TICKET_UPDATED trigger event for Support module
    - Allows support ticket attachments to be organized into specific GHL folders

  2. New Assignments
    - TICKET_CREATED: For attachments when creating support tickets
    - TICKET_UPDATED: For attachments when updating support tickets

  3. Notes
    - media_folder_id is initially set to NULL (will be configured via UI)
    - Uses ON CONFLICT to prevent duplicate entries if already exists
*/

-- Insert support ticket trigger events into media_folder_assignments
INSERT INTO media_folder_assignments (trigger_event, module, media_folder_id)
VALUES
  ('TICKET_CREATED', 'Support', NULL),
  ('TICKET_UPDATED', 'Support', NULL)
ON CONFLICT (trigger_event) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE media_folder_assignments IS 'Maps trigger events to specific media folders for GHL media file organization. Includes events for Attendance, Expenses, and Support tickets.';

-- ============================================================================
-- MIGRATION 10: 20251027185316_fix_product_triggers_column_names.sql
-- ============================================================================
/*
  # Fix Product Trigger Column Names

  1. Changes
    - Update trigger functions to use correct column name `product_price` instead of `course_price`, `onboarding_fee`, `retainer_fee`
    - Remove references to non-existent columns from trigger data payloads
    - Maintain all existing functionality for API webhooks and workflow automations

  2. Tables Modified
    - products (triggers only, no schema changes)

  3. Security
    - Maintains existing SECURITY DEFINER permissions
    - No changes to RLS policies
*/

-- Update function to trigger workflows when a new product is added
CREATE OR REPLACE FUNCTION trigger_workflows_on_product_add()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  api_webhook_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
  trigger_data jsonb;
  request_id bigint;
  webhook_success boolean;
BEGIN
  -- Build trigger data with trigger_event
  trigger_data := jsonb_build_object(
    'trigger_event', 'PRODUCT_ADDED',
    'id', NEW.id,
    'product_id', NEW.product_id,
    'product_name', NEW.product_name,
    'product_type', NEW.product_type,
    'description', NEW.description,
    'pricing_model', NEW.pricing_model,
    'product_price', NEW.product_price,
    'currency', NEW.currency,
    'features', NEW.features,
    'duration', NEW.duration,
    'is_active', NEW.is_active,
    'category', NEW.category,
    'thumbnail_url', NEW.thumbnail_url,
    'sales_page_url', NEW.sales_page_url,
    'total_sales', NEW.total_sales,
    'total_revenue', NEW.total_revenue,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'PRODUCT_ADDED'
      AND is_active = true
  LOOP
    BEGIN
      webhook_success := false;
      
      -- Make HTTP POST request using pg_net
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      -- Update success statistics
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Update failure statistics
        UPDATE api_webhooks
        SET 
          total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
        WHERE id = api_webhook_record.id;
        
        RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  -- Process Workflow Automations
  FOR automation_record IN
    SELECT 
      a.id,
      a.workflow_nodes
    FROM automations a
    WHERE a.status = 'Active'
      AND a.workflow_nodes IS NOT NULL
      AND jsonb_array_length(a.workflow_nodes) > 0
  LOOP
    -- Get the first node (trigger node)
    trigger_node := automation_record.workflow_nodes->0;
    
    -- Check if this is a PRODUCT_ADDED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'PRODUCT_ADDED' THEN
      
      -- Create a workflow execution record
      INSERT INTO workflow_executions (
        automation_id,
        trigger_type,
        trigger_data,
        status,
        total_steps,
        started_at
      ) VALUES (
        automation_record.id,
        'PRODUCT_ADDED',
        trigger_data,
        'pending',
        jsonb_array_length(automation_record.workflow_nodes) - 1,
        now()
      ) RETURNING id INTO execution_id;

      -- Signal that a workflow needs to be executed
      PERFORM pg_notify(
        'workflow_execution',
        json_build_object(
          'execution_id', execution_id,
          'automation_id', automation_record.id,
          'trigger_type', 'PRODUCT_ADDED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update function to trigger workflows when a product is updated
CREATE OR REPLACE FUNCTION trigger_workflows_on_product_update()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  api_webhook_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
  trigger_data jsonb;
  request_id bigint;
  webhook_success boolean;
BEGIN
  -- Build trigger data with trigger_event and previous values
  trigger_data := jsonb_build_object(
    'trigger_event', 'PRODUCT_UPDATED',
    'id', NEW.id,
    'product_id', NEW.product_id,
    'product_name', NEW.product_name,
    'product_type', NEW.product_type,
    'description', NEW.description,
    'pricing_model', NEW.pricing_model,
    'product_price', NEW.product_price,
    'currency', NEW.currency,
    'features', NEW.features,
    'duration', NEW.duration,
    'is_active', NEW.is_active,
    'category', NEW.category,
    'thumbnail_url', NEW.thumbnail_url,
    'sales_page_url', NEW.sales_page_url,
    'total_sales', NEW.total_sales,
    'total_revenue', NEW.total_revenue,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'previous', jsonb_build_object(
      'product_name', OLD.product_name,
      'product_type', OLD.product_type,
      'pricing_model', OLD.pricing_model,
      'product_price', OLD.product_price,
      'is_active', OLD.is_active,
      'category', OLD.category
    )
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'PRODUCT_UPDATED'
      AND is_active = true
  LOOP
    BEGIN
      webhook_success := false;
      
      -- Make HTTP POST request using pg_net
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      -- Update success statistics
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Update failure statistics
        UPDATE api_webhooks
        SET 
          total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
        WHERE id = api_webhook_record.id;
        
        RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  -- Process Workflow Automations
  FOR automation_record IN
    SELECT 
      a.id,
      a.workflow_nodes
    FROM automations a
    WHERE a.status = 'Active'
      AND a.workflow_nodes IS NOT NULL
      AND jsonb_array_length(a.workflow_nodes) > 0
  LOOP
    -- Get the first node (trigger node)
    trigger_node := automation_record.workflow_nodes->0;
    
    -- Check if this is a PRODUCT_UPDATED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'PRODUCT_UPDATED' THEN
      
      -- Create a workflow execution record
      INSERT INTO workflow_executions (
        automation_id,
        trigger_type,
        trigger_data,
        status,
        total_steps,
        started_at
      ) VALUES (
        automation_record.id,
        'PRODUCT_UPDATED',
        trigger_data,
        'pending',
        jsonb_array_length(automation_record.workflow_nodes) - 1,
        now()
      ) RETURNING id INTO execution_id;

      -- Signal that a workflow needs to be executed
      PERFORM pg_notify(
        'workflow_execution',
        json_build_object(
          'execution_id', execution_id,
          'automation_id', automation_record.id,
          'trigger_type', 'PRODUCT_UPDATED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update function to trigger workflows when a product is deleted
CREATE OR REPLACE FUNCTION trigger_workflows_on_product_delete()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  api_webhook_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
  trigger_data jsonb;
  request_id bigint;
  webhook_success boolean;
BEGIN
  -- Build trigger data with trigger_event
  trigger_data := jsonb_build_object(
    'trigger_event', 'PRODUCT_DELETED',
    'id', OLD.id,
    'product_id', OLD.product_id,
    'product_name', OLD.product_name,
    'product_type', OLD.product_type,
    'description', OLD.description,
    'pricing_model', OLD.pricing_model,
    'product_price', OLD.product_price,
    'currency', OLD.currency,
    'features', OLD.features,
    'duration', OLD.duration,
    'is_active', OLD.is_active,
    'category', OLD.category,
    'thumbnail_url', OLD.thumbnail_url,
    'sales_page_url', OLD.sales_page_url,
    'total_sales', OLD.total_sales,
    'total_revenue', OLD.total_revenue,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'deleted_at', now()
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'PRODUCT_DELETED'
      AND is_active = true
  LOOP
    BEGIN
      webhook_success := false;
      
      -- Make HTTP POST request using pg_net
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      -- Update success statistics
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Update failure statistics
        UPDATE api_webhooks
        SET 
          total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
        WHERE id = api_webhook_record.id;
        
        RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  -- Process Workflow Automations
  FOR automation_record IN
    SELECT 
      a.id,
      a.workflow_nodes
    FROM automations a
    WHERE a.status = 'Active'
      AND a.workflow_nodes IS NOT NULL
      AND jsonb_array_length(a.workflow_nodes) > 0
  LOOP
    -- Get the first node (trigger node)
    trigger_node := automation_record.workflow_nodes->0;
    
    -- Check if this is a PRODUCT_DELETED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'PRODUCT_DELETED' THEN
      
      -- Create a workflow execution record
      INSERT INTO workflow_executions (
        automation_id,
        trigger_type,
        trigger_data,
        status,
        total_steps,
        started_at
      ) VALUES (
        automation_record.id,
        'PRODUCT_DELETED',
        trigger_data,
        'pending',
        jsonb_array_length(automation_record.workflow_nodes) - 1,
        now()
      ) RETURNING id INTO execution_id;

      -- Signal that a workflow needs to be executed
      PERFORM pg_notify(
        'workflow_execution',
        json_build_object(
          'execution_id', execution_id,
          'automation_id', automation_record.id,
          'trigger_type', 'PRODUCT_DELETED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRATION 11: 20251029165927_create_custom_lead_tabs_table.sql
-- ============================================================================
/*
  # Create Custom Lead Tabs Table

  1. New Tables
    - `custom_lead_tabs`
      - `id` (uuid, primary key)
      - `tab_id` (text, unique identifier for the tab)
      - `pipeline_id` (uuid, foreign key to pipelines)
      - `tab_name` (text, the display name of the tab)
      - `tab_order` (integer, display order 1-3)
      - `is_active` (boolean, whether the tab is active)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `custom_lead_tabs` table
    - Add policy for anonymous users to read active tabs
    - Add policy for authenticated users to manage tabs

  3. Constraints
    - Unique constraint on (pipeline_id, tab_order) to prevent duplicate orders
    - Check constraint to ensure tab_order is between 1 and 3
    - Limit of 3 tabs per pipeline enforced at application level
*/

CREATE TABLE IF NOT EXISTS custom_lead_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id text UNIQUE NOT NULL,
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  tab_name text NOT NULL,
  tab_order integer NOT NULL CHECK (tab_order >= 1 AND tab_order <= 3),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(pipeline_id, tab_order)
);

ALTER TABLE custom_lead_tabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active custom lead tabs"
  ON custom_lead_tabs
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can insert custom lead tabs"
  ON custom_lead_tabs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update custom lead tabs"
  ON custom_lead_tabs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete custom lead tabs"
  ON custom_lead_tabs
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_custom_lead_tabs_pipeline ON custom_lead_tabs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_custom_lead_tabs_active ON custom_lead_tabs(is_active);

-- ============================================================================
-- MIGRATION 12: 20251029170814_update_custom_lead_tabs_rls_for_anon_access.sql
-- ============================================================================
/*
  # Update custom_lead_tabs RLS for Anonymous Access

  1. Changes
    - Update RLS policies on custom_lead_tabs table
    - Add policies allowing anonymous (anon) users to manage custom tabs
    
  2. Security
    - Allow anon users to SELECT, INSERT, UPDATE, DELETE from custom_lead_tabs
    - This enables custom tab management for admin users
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read active custom lead tabs" ON custom_lead_tabs;
DROP POLICY IF EXISTS "Authenticated users can insert custom lead tabs" ON custom_lead_tabs;
DROP POLICY IF EXISTS "Authenticated users can update custom lead tabs" ON custom_lead_tabs;
DROP POLICY IF EXISTS "Authenticated users can delete custom lead tabs" ON custom_lead_tabs;

-- Create new policies for anon and authenticated access
CREATE POLICY "Allow anon to read custom lead tabs"
  ON custom_lead_tabs
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to read custom lead tabs"
  ON custom_lead_tabs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to insert custom lead tabs"
  ON custom_lead_tabs
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to insert custom lead tabs"
  ON custom_lead_tabs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update custom lead tabs"
  ON custom_lead_tabs
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update custom lead tabs"
  ON custom_lead_tabs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete custom lead tabs"
  ON custom_lead_tabs
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to delete custom lead tabs"
  ON custom_lead_tabs
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- MIGRATION 13: 20251029172535_create_custom_fields_table.sql
-- ============================================================================
/*
  # Create Custom Fields Table

  1. New Tables
    - `custom_fields`
      - `id` (uuid, primary key)
      - `field_key` (text, unique identifier for the field)
      - `custom_tab_id` (uuid, foreign key to custom_lead_tabs)
      - `field_name` (text, display name of the field)
      - `field_type` (text, type: text, dropdown_single, dropdown_multiple, date)
      - `dropdown_options` (jsonb, array of options for dropdown fields)
      - `is_required` (boolean, whether the field is required)
      - `display_order` (integer, order in which field appears)
      - `is_active` (boolean, whether the field is active)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `custom_field_values`
      - `id` (uuid, primary key)
      - `custom_field_id` (uuid, foreign key to custom_fields)
      - `lead_id` (uuid, foreign key to leads)
      - `field_value` (text, the actual value entered)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for anon and authenticated users

  3. Constraints
    - Unique constraint on field_key
    - Check constraint for valid field types
*/

-- Create custom_fields table
CREATE TABLE IF NOT EXISTS custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key text UNIQUE NOT NULL,
  custom_tab_id uuid NOT NULL REFERENCES custom_lead_tabs(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'dropdown_single', 'dropdown_multiple', 'date')),
  dropdown_options jsonb DEFAULT '[]'::jsonb,
  is_required boolean DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create custom_field_values table
CREATE TABLE IF NOT EXISTS custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_field_id uuid NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  field_value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(custom_field_id, lead_id)
);

-- Enable RLS
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_fields
CREATE POLICY "Allow anon to read custom fields"
  ON custom_fields
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to read custom fields"
  ON custom_fields
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to insert custom fields"
  ON custom_fields
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to insert custom fields"
  ON custom_fields
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update custom fields"
  ON custom_fields
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update custom fields"
  ON custom_fields
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete custom fields"
  ON custom_fields
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to delete custom fields"
  ON custom_fields
  FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for custom_field_values
CREATE POLICY "Allow anon to read custom field values"
  ON custom_field_values
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to read custom field values"
  ON custom_field_values
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to insert custom field values"
  ON custom_field_values
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to insert custom field values"
  ON custom_field_values
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update custom field values"
  ON custom_field_values
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update custom field values"
  ON custom_field_values
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete custom field values"
  ON custom_field_values
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to delete custom field values"
  ON custom_field_values
  FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_custom_fields_tab ON custom_fields(custom_tab_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_active ON custom_fields(is_active);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_field ON custom_field_values(custom_field_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_lead ON custom_field_values(lead_id);

-- ============================================================================
-- MIGRATION 14: 20251029183311_add_new_custom_field_types.sql
-- ============================================================================
/*
  # Add New Custom Field Types
  
  1. Changes
    - Update the field_type check constraint in custom_fields table
    - Add support for: number, email, phone, url, currency, longtext
    - Previous types: text, dropdown_single, dropdown_multiple, date
    - New types: number, email, phone, url, currency, longtext
    
  2. Field Types
    - number: For numeric values
    - email: For email addresses with validation
    - phone: For phone numbers
    - url: For website URLs
    - currency: For monetary values
    - longtext: For longer text entries (textarea)
  
  3. Notes
    - This migration safely adds new field types without affecting existing data
    - All existing fields with old types remain valid
*/

-- Drop the existing check constraint
ALTER TABLE custom_fields 
  DROP CONSTRAINT IF EXISTS custom_fields_field_type_check;

-- Add the updated check constraint with all field types
ALTER TABLE custom_fields 
  ADD CONSTRAINT custom_fields_field_type_check 
  CHECK (field_type IN (
    'text', 
    'dropdown_single', 
    'dropdown_multiple', 
    'date',
    'number',
    'email',
    'phone',
    'url',
    'currency',
    'longtext'
  ));

-- ============================================================================
-- MIGRATION 15: 20251029190000_update_tasks_remove_tags_notes_add_supporting_docs.sql
-- ============================================================================
/*
  # Update Tasks Table - Remove Tags and Notes, Add Supporting Documents

  1. Changes
    - Remove `tags` column from tasks table
    - Remove `notes` column from tasks table
    - Add `supporting_documents` column (text array) to store file paths from media storage
    - Add entry to media_folder_assignments for Tasks module

  2. Notes
    - Supporting documents will be stored in the folder: 88babbbd-3e5d-49fa-b4dc-ff4b81f2cdda
    - Folder name: Tasks (69026dc57e5798abb745da59)
*/

-- Drop tags and notes columns from tasks table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'tags'
  ) THEN
    ALTER TABLE tasks DROP COLUMN tags;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'notes'
  ) THEN
    ALTER TABLE tasks DROP COLUMN notes;
  END IF;
END $$;

-- Add supporting_documents column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'supporting_documents'
  ) THEN
    ALTER TABLE tasks ADD COLUMN supporting_documents text[] DEFAULT '{}';
  END IF;
END $$;

-- Add media folder assignments for Tasks module
INSERT INTO media_folder_assignments (trigger_event, module, media_folder_id)
VALUES
  ('TASK_CREATED', 'Tasks', '88babbbd-3e5d-49fa-b4dc-ff4b81f2cdda'),
  ('TASK_UPDATED', 'Tasks', '88babbbd-3e5d-49fa-b4dc-ff4b81f2cdda')
ON CONFLICT (trigger_event) DO UPDATE
SET
  module = EXCLUDED.module,
  media_folder_id = EXCLUDED.media_folder_id,
  updated_at = now();

-- ============================================================================
-- MIGRATION 16: 20251029194626_update_tasks_remove_tags_notes_add_supporting_docs.sql
-- ============================================================================
/*
  # Update Tasks Table - Remove Tags and Notes, Add Supporting Documents

  1. Changes
    - Remove `tags` column from tasks table
    - Remove `notes` column from tasks table
    - Add `supporting_documents` column (text array) to store file paths from media storage
    - Add entry to media_folder_assignments for Tasks module

  2. Notes
    - Supporting documents will be stored in the folder: 88babbbd-3e5d-49fa-b4dc-ff4b81f2cdda
    - Folder name: Tasks (69026dc57e5798abb745da59)
*/

-- Drop tags and notes columns from tasks table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'tags'
  ) THEN
    ALTER TABLE tasks DROP COLUMN tags;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'notes'
  ) THEN
    ALTER TABLE tasks DROP COLUMN notes;
  END IF;
END $$;

-- Add supporting_documents column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'supporting_documents'
  ) THEN
    ALTER TABLE tasks ADD COLUMN supporting_documents text[] DEFAULT '{}';
  END IF;
END $$;

-- Add media folder assignments for Tasks module
INSERT INTO media_folder_assignments (trigger_event, module, media_folder_id)
VALUES
  ('TASK_CREATED', 'Tasks', '88babbbd-3e5d-49fa-b4dc-ff4b81f2cdda'),
  ('TASK_UPDATED', 'Tasks', '88babbbd-3e5d-49fa-b4dc-ff4b81f2cdda')
ON CONFLICT (trigger_event) DO UPDATE
SET
  module = EXCLUDED.module,
  media_folder_id = EXCLUDED.media_folder_id,
  updated_at = now();

-- ============================================================================
-- MIGRATION 17: 20251029195000_fix_task_triggers_remove_tags_notes.sql
-- ============================================================================
/*
  # Fix Task Triggers - Remove Tags and Notes References

  1. Overview
    - Updates task trigger functions to remove tags and notes fields
    - Adds supporting_documents field to webhook payloads
    - Fixes error: record "new" has no field "tags"

  2. Changes
    - notify_task_created() - removes tags/notes, adds supporting_documents
    - notify_task_updated() - removes tags/notes, adds supporting_documents
    - notify_task_deleted() - removes tags/notes, adds supporting_documents
*/

-- Function to handle task created event (without tags/notes)
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
    'attachments', NEW.attachments,
    'progress_percentage', NEW.progress_percentage,
    'supporting_documents', NEW.supporting_documents,
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

-- Function to handle task updated event (without tags/notes)
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
    'attachments', NEW.attachments,
    'progress_percentage', NEW.progress_percentage,
    'supporting_documents', NEW.supporting_documents,
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

-- Function to handle task deleted event (without tags/notes)
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
    'progress_percentage', OLD.progress_percentage,
    'supporting_documents', OLD.supporting_documents,
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
-- MIGRATION 18: 20251029195245_fix_task_triggers_remove_tags_notes.sql
-- ============================================================================
/*
  # Fix Task Triggers - Remove Tags and Notes References

  1. Overview
    - Updates task trigger functions to remove tags and notes fields
    - Adds supporting_documents field to webhook payloads
    - Fixes error: record "new" has no field "tags"

  2. Changes
    - notify_task_created() - removes tags/notes, adds supporting_documents
    - notify_task_updated() - removes tags/notes, adds supporting_documents
    - notify_task_deleted() - removes tags/notes, adds supporting_documents
*/

-- Function to handle task created event (without tags/notes)
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
    'attachments', NEW.attachments,
    'progress_percentage', NEW.progress_percentage,
    'supporting_documents', NEW.supporting_documents,
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

-- Function to handle task updated event (without tags/notes)
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
    'attachments', NEW.attachments,
    'progress_percentage', NEW.progress_percentage,
    'supporting_documents', NEW.supporting_documents,
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

-- Function to handle task deleted event (without tags/notes)
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
    'progress_percentage', OLD.progress_percentage,
    'supporting_documents', OLD.supporting_documents,
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
-- MIGRATION 19: 20251029203201_update_tasks_datetime_fields.sql
-- ============================================================================
/*
  # Update Tasks Table Date Fields to DateTime

  1. Changes
    - Change `start_date` column from DATE to TIMESTAMPTZ to support date and time
    - Change `due_date` column from DATE to TIMESTAMPTZ to support date and time
    - Existing date values will be preserved and converted to timestamps (midnight UTC)

  2. Notes
    - Using TIMESTAMPTZ (timestamp with timezone) for proper timezone handling
    - Existing data will be automatically converted during the ALTER
    - NULL values remain NULL
*/

-- Update start_date to support datetime
ALTER TABLE tasks 
ALTER COLUMN start_date TYPE timestamptz 
USING start_date::timestamptz;

-- Update due_date to support datetime
ALTER TABLE tasks 
ALTER COLUMN due_date TYPE timestamptz 
USING due_date::timestamptz;

-- ============================================================================
-- MIGRATION 20: 20251029212143_create_task_reminders_table.sql
-- ============================================================================
/*
  # Create Task Reminders Table

  1. New Tables
    - `task_reminders`
      - `id` (uuid, primary key)
      - `task_id` (uuid, foreign key to tasks)
      - `reminder_type` (text, enum: 'start_date', 'due_date', 'custom')
      - `custom_datetime` (timestamptz, nullable, for custom datetime)
      - `offset_timing` (text, enum: 'before', 'after')
      - `offset_value` (integer, the number of units)
      - `offset_unit` (text, enum: 'minutes', 'hours', 'days')
      - `calculated_reminder_time` (timestamptz, the actual computed reminder time)
      - `is_sent` (boolean, default false)
      - `sent_at` (timestamptz, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `task_reminders` table
    - Add policy for anon users to read all reminders
    - Add policy for anon users to insert/update/delete reminders
    - Add policy for authenticated admin users to manage all reminders

  3. Indexes
    - Index on task_id for fast lookups by task
    - Index on calculated_reminder_time for scheduled reminder queries
    - Index on is_sent for filtering sent/pending reminders

  4. Triggers
    - Auto-update updated_at timestamp
    - Auto-calculate reminder time based on task dates and offset
*/

-- Create task_reminders table
CREATE TABLE IF NOT EXISTS task_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('start_date', 'due_date', 'custom')),
  custom_datetime timestamptz,
  offset_timing text NOT NULL CHECK (offset_timing IN ('before', 'after')),
  offset_value integer NOT NULL CHECK (offset_value >= 0),
  offset_unit text NOT NULL CHECK (offset_unit IN ('minutes', 'hours', 'days')),
  calculated_reminder_time timestamptz,
  is_sent boolean DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_custom_datetime CHECK (
    (reminder_type = 'custom' AND custom_datetime IS NOT NULL) OR
    (reminder_type != 'custom' AND custom_datetime IS NULL)
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_task_reminders_task_id ON task_reminders(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reminders_calculated_time ON task_reminders(calculated_reminder_time);
CREATE INDEX IF NOT EXISTS idx_task_reminders_is_sent ON task_reminders(is_sent);

-- Enable RLS
ALTER TABLE task_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for anon access
CREATE POLICY "Allow anon read access to task_reminders"
  ON task_reminders FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert access to task_reminders"
  ON task_reminders FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update access to task_reminders"
  ON task_reminders FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete access to task_reminders"
  ON task_reminders FOR DELETE
  TO anon
  USING (true);

-- RLS Policies for authenticated admin users
CREATE POLICY "Admins can read all task_reminders"
  ON task_reminders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

CREATE POLICY "Admins can insert task_reminders"
  ON task_reminders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

CREATE POLICY "Admins can update task_reminders"
  ON task_reminders FOR UPDATE
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

CREATE POLICY "Admins can delete task_reminders"
  ON task_reminders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Function to calculate reminder time
CREATE OR REPLACE FUNCTION calculate_reminder_time()
RETURNS TRIGGER AS $$
DECLARE
  base_time timestamptz;
  interval_value interval;
BEGIN
  -- Determine base time based on reminder type
  IF NEW.reminder_type = 'custom' THEN
    base_time := NEW.custom_datetime;
  ELSIF NEW.reminder_type = 'start_date' THEN
    SELECT start_date INTO base_time FROM tasks WHERE id = NEW.task_id;
  ELSIF NEW.reminder_type = 'due_date' THEN
    SELECT due_date INTO base_time FROM tasks WHERE id = NEW.task_id;
  END IF;

  -- If base_time is NULL, set calculated_reminder_time to NULL
  IF base_time IS NULL THEN
    NEW.calculated_reminder_time := NULL;
    RETURN NEW;
  END IF;

  -- Calculate interval based on unit
  IF NEW.offset_unit = 'minutes' THEN
    interval_value := make_interval(mins => NEW.offset_value);
  ELSIF NEW.offset_unit = 'hours' THEN
    interval_value := make_interval(hours => NEW.offset_value);
  ELSIF NEW.offset_unit = 'days' THEN
    interval_value := make_interval(days => NEW.offset_value);
  END IF;

  -- Apply offset
  IF NEW.offset_timing = 'before' THEN
    NEW.calculated_reminder_time := base_time - interval_value;
  ELSE
    NEW.calculated_reminder_time := base_time + interval_value;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate reminder time on insert/update
CREATE TRIGGER trigger_calculate_reminder_time
  BEFORE INSERT OR UPDATE ON task_reminders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_reminder_time();

-- Trigger to update updated_at timestamp
CREATE TRIGGER trigger_update_task_reminders_updated_at
  BEFORE UPDATE ON task_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to recalculate reminders when task dates change
CREATE OR REPLACE FUNCTION recalculate_task_reminders()
RETURNS TRIGGER AS $$
BEGIN
  -- Only recalculate if start_date or due_date changed
  IF (OLD.start_date IS DISTINCT FROM NEW.start_date) OR
     (OLD.due_date IS DISTINCT FROM NEW.due_date) THEN
    
    -- Update all non-custom reminders for this task
    UPDATE task_reminders
    SET updated_at = now()
    WHERE task_id = NEW.id
    AND reminder_type IN ('start_date', 'due_date')
    AND is_sent = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on tasks table to recalculate reminders
CREATE TRIGGER trigger_recalculate_reminders_on_task_update
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_task_reminders();

-- ============================================================================
-- MIGRATION 21: 20251029214830_add_task_reminder_workflow_trigger.sql
-- ============================================================================
/*
  # Add Task Reminder Workflow Trigger

  1. Overview
    - Adds "Task Reminder" trigger event to workflow_triggers table
    - Enables workflow automation when scheduled task reminders are due
    - Follows existing pattern from task triggers

  2. Trigger Added
    - Task Reminder - Triggered at the scheduled reminder date/time

  3. Purpose
    - Enable workflow automations based on task reminder events
    - Send notifications when reminders are due
    - Integrate reminders with external systems (WhatsApp, Email, SMS, etc.)
    - Automate follow-up actions based on reminders

  4. Event Schema
    - Includes task details, reminder details, and contact information
    - Provides all necessary data for notification workflows
*/

-- Insert Task Reminder trigger
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
  'task_reminder',
  'Task Reminder',
  'Triggered at the scheduled task reminder date/time',
  'TASK_REMINDER',
  '[
    {"type": "uuid", "field": "reminder_id", "description": "Unique reminder identifier"},
    {"type": "uuid", "field": "task_id", "description": "Task unique identifier"},
    {"type": "text", "field": "task_readable_id", "description": "Human-readable task ID (e.g., TASK-123456)"},
    {"type": "text", "field": "task_title", "description": "Task title"},
    {"type": "text", "field": "task_description", "description": "Task description"},
    {"type": "text", "field": "task_status", "description": "Task status (To Do, In Progress, In Review, Completed, Cancelled)"},
    {"type": "text", "field": "task_priority", "description": "Task priority (Low, Medium, High, Urgent)"},
    {"type": "text", "field": "task_category", "description": "Task category"},
    {"type": "uuid", "field": "assigned_to", "description": "User ID assigned to task"},
    {"type": "text", "field": "assigned_to_name", "description": "Name of assigned user"},
    {"type": "uuid", "field": "assigned_by", "description": "User ID who assigned the task"},
    {"type": "text", "field": "assigned_by_name", "description": "Name of user who assigned"},
    {"type": "uuid", "field": "contact_id", "description": "Related contact ID (if linked)"},
    {"type": "text", "field": "contact_name", "description": "Related contact name"},
    {"type": "text", "field": "contact_phone", "description": "Related contact phone"},
    {"type": "timestamptz", "field": "task_due_date", "description": "Task due date and time"},
    {"type": "timestamptz", "field": "task_start_date", "description": "Task start date and time"},
    {"type": "numeric", "field": "task_estimated_hours", "description": "Estimated hours to complete"},
    {"type": "integer", "field": "task_progress_percentage", "description": "Progress percentage (0-100)"},
    {"type": "text", "field": "reminder_type", "description": "Reminder type (start_date, due_date, custom)"},
    {"type": "timestamptz", "field": "reminder_custom_datetime", "description": "Custom datetime if reminder type is custom"},
    {"type": "text", "field": "reminder_offset_timing", "description": "Offset timing (before, after)"},
    {"type": "integer", "field": "reminder_offset_value", "description": "Offset value (e.g., 1, 2, 3)"},
    {"type": "text", "field": "reminder_offset_unit", "description": "Offset unit (minutes, hours, days)"},
    {"type": "timestamptz", "field": "reminder_scheduled_time", "description": "Calculated reminder time when it should trigger"},
    {"type": "text", "field": "reminder_display", "description": "Human-readable reminder description (e.g., 2 hours before Due Date)"},
    {"type": "timestamptz", "field": "created_at", "description": "When the reminder was created"}
  ]'::jsonb,
  'Tasks',
  'bell',
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
-- MIGRATION 22: 20251029214859_create_task_reminder_scheduler_function.sql
-- ============================================================================
/*
  # Create Task Reminder Scheduler Function

  1. Overview
    - Creates a function to check and trigger task reminders that are due
    - Sends reminder events to api_webhooks for processing
    - Marks reminders as sent after triggering
    - Can be called periodically by a cron job or scheduled task

  2. Components
    - Function: process_due_task_reminders()
    - Processes all unsent reminders where calculated_reminder_time <= NOW()
    - Sends webhook events to api_webhooks table
    - Updates reminder status to sent

  3. Usage
    - Can be called manually: SELECT process_due_task_reminders();
    - Should be scheduled to run every minute via external cron or pg_cron
*/

-- Function to process due task reminders
CREATE OR REPLACE FUNCTION process_due_task_reminders()
RETURNS TABLE (
  processed_count integer,
  reminder_ids uuid[]
) AS $$
DECLARE
  reminder_record RECORD;
  task_record RECORD;
  reminder_display_text text;
  processed_ids uuid[] := ARRAY[]::uuid[];
  count_processed integer := 0;
BEGIN
  -- Loop through all unsent reminders that are due
  FOR reminder_record IN
    SELECT * FROM task_reminders
    WHERE is_sent = false
    AND calculated_reminder_time IS NOT NULL
    AND calculated_reminder_time <= NOW()
    ORDER BY calculated_reminder_time ASC
  LOOP
    -- Get the task details
    SELECT * INTO task_record
    FROM tasks
    WHERE id = reminder_record.task_id;

    -- Skip if task not found or deleted
    IF task_record.id IS NULL THEN
      CONTINUE;
    END IF;

    -- Build reminder display text
    IF reminder_record.reminder_type = 'start_date' THEN
      reminder_display_text := reminder_record.offset_value::text || ' ' || 
                               reminder_record.offset_unit || ' ' || 
                               reminder_record.offset_timing || ' Start Date';
    ELSIF reminder_record.reminder_type = 'due_date' THEN
      reminder_display_text := reminder_record.offset_value::text || ' ' || 
                               reminder_record.offset_unit || ' ' || 
                               reminder_record.offset_timing || ' Due Date';
    ELSE
      reminder_display_text := reminder_record.offset_value::text || ' ' || 
                               reminder_record.offset_unit || ' ' || 
                               reminder_record.offset_timing || ' Custom Date';
    END IF;

    -- Insert webhook event to api_webhooks
    INSERT INTO api_webhooks (event_type, payload)
    VALUES (
      'TASK_REMINDER',
      jsonb_build_object(
        'trigger_event', 'TASK_REMINDER',
        'reminder_id', reminder_record.id,
        'task_id', task_record.id,
        'task_readable_id', task_record.task_id,
        'task_title', task_record.title,
        'task_description', task_record.description,
        'task_status', task_record.status,
        'task_priority', task_record.priority,
        'task_category', task_record.category,
        'assigned_to', task_record.assigned_to,
        'assigned_to_name', task_record.assigned_to_name,
        'assigned_by', task_record.assigned_by,
        'assigned_by_name', task_record.assigned_by_name,
        'contact_id', task_record.contact_id,
        'contact_name', task_record.contact_name,
        'contact_phone', task_record.contact_phone,
        'task_due_date', task_record.due_date,
        'task_start_date', task_record.start_date,
        'task_estimated_hours', task_record.estimated_hours,
        'task_progress_percentage', task_record.progress_percentage,
        'reminder_type', reminder_record.reminder_type,
        'reminder_custom_datetime', reminder_record.custom_datetime,
        'reminder_offset_timing', reminder_record.offset_timing,
        'reminder_offset_value', reminder_record.offset_value,
        'reminder_offset_unit', reminder_record.offset_unit,
        'reminder_scheduled_time', reminder_record.calculated_reminder_time,
        'reminder_display', reminder_display_text,
        'created_at', reminder_record.created_at
      )
    );

    -- Mark reminder as sent
    UPDATE task_reminders
    SET is_sent = true,
        sent_at = NOW()
    WHERE id = reminder_record.id;

    -- Add to processed list
    processed_ids := array_append(processed_ids, reminder_record.id);
    count_processed := count_processed + 1;
  END LOOP;

  -- Return results
  RETURN QUERY SELECT count_processed, processed_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION process_due_task_reminders() TO anon;
GRANT EXECUTE ON FUNCTION process_due_task_reminders() TO authenticated;

-- Add comment
COMMENT ON FUNCTION process_due_task_reminders() IS 
'Processes all due task reminders and sends them to api_webhooks. Should be called periodically via cron.';

/*
================================================================================
END OF GROUP 14: ADVANCED FEATURES AND OPTIMIZATIONS
================================================================================
This is the final migration group.
*/
