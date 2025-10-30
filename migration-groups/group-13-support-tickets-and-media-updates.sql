/*
================================================================================
GROUP 13: SUPPORT TICKETS AND MEDIA UPDATES
================================================================================

Support ticket updates, media storage bucket, and AI agents tables

Total Files: 11
Dependencies: Group 12

Files Included (in execution order):
1. 20251024081323_add_attachments_to_support_tickets.sql
2. 20251024082432_rename_enrolled_member_id_to_contact_id_in_support_tickets.sql
3. 20251024083631_create_media_files_storage_bucket.sql
4. 20251024084736_migrate_support_ticket_contacts_and_fix_fkey.sql
5. 20251024085201_update_support_ticket_triggers_to_use_contact_id.sql
6. 20251025000000_create_ai_agents_tables.sql
7. 20251025085835_create_ai_agents_tables.sql
8. 20251025152029_update_ai_agent_permissions_to_array_structure.sql
9. 20251026090901_remove_duplicate_contacts_and_add_unique_constraint.sql
10. 20251026123432_update_appointment_id_format.sql
11. 20251026134714_add_missing_modules_to_admin_permissions.sql

================================================================================
*/

-- ============================================================================
-- MIGRATION 1: 20251024081323_add_attachments_to_support_tickets.sql
-- ============================================================================
/*
  # Add Attachment Fields to Support Tickets

  1. Changes
    - Add `attachment_1_url` column to store first file URL
    - Add `attachment_1_name` column to store first file name
    - Add `attachment_2_url` column to store second file URL
    - Add `attachment_2_name` column to store second file name
    - Add `attachment_3_url` column to store third file URL
    - Add `attachment_3_name` column to store third file name
  
  2. Purpose
    - Allow users to upload up to 3 files when creating support tickets
    - Store both the file URL (from storage) and original filename for display
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'attachment_1_url'
  ) THEN
    ALTER TABLE support_tickets 
      ADD COLUMN attachment_1_url text,
      ADD COLUMN attachment_1_name text,
      ADD COLUMN attachment_2_url text,
      ADD COLUMN attachment_2_name text,
      ADD COLUMN attachment_3_url text,
      ADD COLUMN attachment_3_name text;
  END IF;
END $$;

-- ============================================================================
-- MIGRATION 2: 20251024082432_rename_enrolled_member_id_to_contact_id_in_support_tickets.sql
-- ============================================================================
/*
  # Rename enrolled_member_id to contact_id in support_tickets

  1. Changes
    - Rename `enrolled_member_id` column to `contact_id` in support_tickets table
    - This reflects the new relationship with contacts_master instead of enrolled_members
  
  2. Notes
    - The column still references the same UUID values
    - Now points to contacts_master.id instead of enrolled_members.id
    - All existing data is preserved
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'enrolled_member_id'
  ) THEN
    ALTER TABLE support_tickets 
      RENAME COLUMN enrolled_member_id TO contact_id;
  END IF;
END $$;

-- ============================================================================
-- MIGRATION 3: 20251024083631_create_media_files_storage_bucket.sql
-- ============================================================================
/*
  # Create media-files Storage Bucket

  1. Changes
    - Create a public storage bucket named 'media-files'
    - Set up RLS policies for public read access
    - Allow authenticated users to upload files
  
  2. Security
    - Public bucket for file access
    - Anyone can read files
    - Only authenticated users can upload
*/

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('media-files', 'media-files', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- Allow anyone to read files
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'media-files');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'media-files');

-- Allow users to update their own files
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'media-files');

-- Allow users to delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (bucket_id = 'media-files');

-- ============================================================================
-- MIGRATION 4: 20251024084736_migrate_support_ticket_contacts_and_fix_fkey.sql
-- ============================================================================
/*
  # Migrate Support Ticket Contacts and Fix Foreign Key

  1. Changes
    - Migrate enrolled members referenced in support_tickets to contacts_master
    - Drop old foreign key constraint pointing to enrolled_members
    - Add new foreign key constraint pointing to contacts_master
  
  2. Data Migration
    - Insert missing contacts from enrolled_members into contacts_master
    - Preserve all contact data (full_name, email, phone)
    - Auto-generate contact_id for migrated contacts
  
  3. Security
    - Maintains referential integrity
    - Ensures contact_id references valid contacts in contacts_master table
*/

-- Migrate enrolled members referenced in support tickets to contacts_master
INSERT INTO contacts_master (
  id, 
  contact_id, 
  full_name, 
  email, 
  phone, 
  contact_type,
  status,
  created_at, 
  updated_at
)
SELECT 
  em.id,
  'CNT-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(((
    SELECT COUNT(*) 
    FROM contacts_master 
    WHERE contact_id LIKE 'CNT-' || EXTRACT(YEAR FROM NOW())::text || '-%'
  ) + ROW_NUMBER() OVER (ORDER BY em.created_at))::text, 3, '0'),
  em.full_name,
  em.email,
  em.phone,
  'Customer',
  'Active',
  em.created_at,
  em.updated_at
FROM enrolled_members em
WHERE em.id IN (
  SELECT DISTINCT contact_id 
  FROM support_tickets 
  WHERE contact_id IS NOT NULL
)
AND em.id NOT IN (SELECT id FROM contacts_master)
ON CONFLICT (id) DO NOTHING;

-- Drop the old foreign key constraint
ALTER TABLE support_tickets 
  DROP CONSTRAINT IF EXISTS support_tickets_enrolled_member_id_fkey;

-- Add new foreign key constraint pointing to contacts_master
ALTER TABLE support_tickets 
  ADD CONSTRAINT support_tickets_contact_id_fkey 
  FOREIGN KEY (contact_id) 
  REFERENCES contacts_master(id) 
  ON DELETE CASCADE;

-- ============================================================================
-- MIGRATION 5: 20251024085201_update_support_ticket_triggers_to_use_contact_id.sql
-- ============================================================================
/*
  # Update Support Ticket Triggers to Use contact_id

  1. Changes
    - Update all support ticket trigger functions to use contact_id instead of enrolled_member_id
    - Affects TICKET_CREATED, TICKET_UPDATED, and TICKET_DELETED triggers
  
  2. Impact
    - Fixes "record has no field enrolled_member_id" error
    - Ensures triggers work with the new contacts_master relationship
*/

-- Update trigger function for TICKET_CREATED
CREATE OR REPLACE FUNCTION trigger_workflows_on_ticket_insert()
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
  -- Build trigger data
  trigger_data := jsonb_build_object(
    'id', NEW.id,
    'ticket_id', NEW.ticket_id,
    'contact_id', NEW.contact_id,
    'subject', NEW.subject,
    'description', NEW.description,
    'priority', NEW.priority,
    'status', NEW.status,
    'category', NEW.category,
    'assigned_to', NEW.assigned_to,
    'response_time', NEW.response_time,
    'satisfaction', NEW.satisfaction,
    'tags', NEW.tags,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'TICKET_CREATED'
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
    trigger_node := automation_record.workflow_nodes->0;
    
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'TICKET_CREATED' THEN
      
      INSERT INTO workflow_executions (
        automation_id,
        trigger_type,
        trigger_data,
        status,
        total_steps,
        started_at
      ) VALUES (
        automation_record.id,
        'TICKET_CREATED',
        trigger_data,
        'pending',
        jsonb_array_length(automation_record.workflow_nodes) - 1,
        now()
      ) RETURNING id INTO execution_id;

      PERFORM pg_notify(
        'workflow_execution',
        json_build_object(
          'execution_id', execution_id,
          'automation_id', automation_record.id,
          'trigger_type', 'TICKET_CREATED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger function for TICKET_UPDATED
CREATE OR REPLACE FUNCTION trigger_workflows_on_ticket_update()
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
  -- Build trigger data
  trigger_data := jsonb_build_object(
    'id', NEW.id,
    'ticket_id', NEW.ticket_id,
    'contact_id', NEW.contact_id,
    'subject', NEW.subject,
    'description', NEW.description,
    'priority', NEW.priority,
    'status', NEW.status,
    'category', NEW.category,
    'assigned_to', NEW.assigned_to,
    'response_time', NEW.response_time,
    'satisfaction', NEW.satisfaction,
    'tags', NEW.tags,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'previous', jsonb_build_object(
      'priority', OLD.priority,
      'status', OLD.status,
      'category', OLD.category,
      'assigned_to', OLD.assigned_to,
      'response_time', OLD.response_time,
      'satisfaction', OLD.satisfaction
    )
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'TICKET_UPDATED'
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
    trigger_node := automation_record.workflow_nodes->0;
    
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'TICKET_UPDATED' THEN
      
      INSERT INTO workflow_executions (
        automation_id,
        trigger_type,
        trigger_data,
        status,
        total_steps,
        started_at
      ) VALUES (
        automation_record.id,
        'TICKET_UPDATED',
        trigger_data,
        'pending',
        jsonb_array_length(automation_record.workflow_nodes) - 1,
        now()
      ) RETURNING id INTO execution_id;

      PERFORM pg_notify(
        'workflow_execution',
        json_build_object(
          'execution_id', execution_id,
          'automation_id', automation_record.id,
          'trigger_type', 'TICKET_UPDATED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger function for TICKET_DELETED
CREATE OR REPLACE FUNCTION trigger_workflows_on_ticket_delete()
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
  -- Build trigger data
  trigger_data := jsonb_build_object(
    'id', OLD.id,
    'ticket_id', OLD.ticket_id,
    'contact_id', OLD.contact_id,
    'subject', OLD.subject,
    'description', OLD.description,
    'priority', OLD.priority,
    'status', OLD.status,
    'category', OLD.category,
    'assigned_to', OLD.assigned_to,
    'response_time', OLD.response_time,
    'satisfaction', OLD.satisfaction,
    'tags', OLD.tags,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'deleted_at', now()
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'TICKET_DELETED'
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
    trigger_node := automation_record.workflow_nodes->0;

    IF trigger_node->>'type' = 'trigger'
       AND trigger_node->'properties'->>'event_name' = 'TICKET_DELETED' THEN

      INSERT INTO workflow_executions (
        automation_id,
        trigger_type,
        trigger_data,
        status,
        total_steps,
        started_at
      ) VALUES (
        automation_record.id,
        'TICKET_DELETED',
        trigger_data,
        'pending',
        jsonb_array_length(automation_record.workflow_nodes) - 1,
        now()
      ) RETURNING id INTO execution_id;

      PERFORM pg_notify(
        'workflow_execution',
        json_build_object(
          'execution_id', execution_id,
          'automation_id', automation_record.id,
          'trigger_type', 'TICKET_DELETED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRATION 6: 20251025000000_create_ai_agents_tables.sql
-- ============================================================================
/*
  # AI Agents Module Tables

  ## Overview
  Creates tables for AI Agents functionality in the CRM system.

  ## New Tables

  ### 1. `ai_agents`
  Main table for AI agent configurations
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text) - Agent display name
  - `model` (text) - AI model (GPT-5, Claude, Llama, etc.)
  - `system_prompt` (text) - System instructions for the agent
  - `status` (text) - Active/Inactive
  - `channels` (text[]) - Array of channels (Web, WhatsApp, Email, Voice)
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  - `last_activity` (timestamptz) - Last activity timestamp
  - `created_by` (text) - User who created the agent

  ### 2. `ai_agent_permissions`
  Stores module access permissions for each agent
  - `id` (uuid, primary key) - Unique identifier
  - `agent_id` (uuid, foreign key) - References ai_agents
  - `module_name` (text) - Name of CRM module
  - `view` (boolean) - View permission
  - `create` (boolean) - Create permission
  - `edit` (boolean) - Edit permission
  - `delete` (boolean) - Delete permission
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 3. `ai_agent_logs`
  Activity logs for agent actions
  - `id` (uuid, primary key) - Unique identifier
  - `agent_id` (uuid, foreign key) - References ai_agents
  - `agent_name` (text) - Agent name at time of action
  - `module` (text) - CRM module affected
  - `action` (text) - Action type (Create, Update, Fetch, Delete)
  - `result` (text) - Success/Denied/Error
  - `user_context` (text) - User who gave instruction
  - `details` (jsonb) - Additional details about the action
  - `created_at` (timestamptz) - Action timestamp

  ## Security
  - RLS enabled on all tables
  - Policies allow authenticated users to manage their own data
  - Admin users have full access
*/

-- Create ai_agents table
CREATE TABLE IF NOT EXISTS ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  model text NOT NULL,
  system_prompt text NOT NULL,
  status text NOT NULL DEFAULT 'Active',
  channels text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_activity timestamptz DEFAULT now(),
  created_by text
);

-- Create ai_agent_permissions table
CREATE TABLE IF NOT EXISTS ai_agent_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  module_name text NOT NULL,
  view boolean DEFAULT true,
  create boolean DEFAULT false,
  edit boolean DEFAULT false,
  delete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(agent_id, module_name)
);

-- Create ai_agent_logs table
CREATE TABLE IF NOT EXISTS ai_agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  module text NOT NULL,
  action text NOT NULL,
  result text NOT NULL,
  user_context text,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_agents
CREATE POLICY "Allow anonymous read access to ai_agents"
  ON ai_agents FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to ai_agents"
  ON ai_agents FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to ai_agents"
  ON ai_agents FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to ai_agents"
  ON ai_agents FOR DELETE
  TO anon
  USING (true);

-- RLS Policies for ai_agent_permissions
CREATE POLICY "Allow anonymous read access to ai_agent_permissions"
  ON ai_agent_permissions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to ai_agent_permissions"
  ON ai_agent_permissions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to ai_agent_permissions"
  ON ai_agent_permissions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to ai_agent_permissions"
  ON ai_agent_permissions FOR DELETE
  TO anon
  USING (true);

-- RLS Policies for ai_agent_logs
CREATE POLICY "Allow anonymous read access to ai_agent_logs"
  ON ai_agent_logs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to ai_agent_logs"
  ON ai_agent_logs FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_agents_status ON ai_agents(status);
CREATE INDEX IF NOT EXISTS idx_ai_agents_last_activity ON ai_agents(last_activity);
CREATE INDEX IF NOT EXISTS idx_ai_agent_permissions_agent_id ON ai_agent_permissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_logs_agent_id ON ai_agent_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_logs_created_at ON ai_agent_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_agent_logs_module ON ai_agent_logs(module);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_ai_agents_updated_at ON ai_agents;
CREATE TRIGGER update_ai_agents_updated_at
  BEFORE UPDATE ON ai_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_agent_permissions_updated_at ON ai_agent_permissions;
CREATE TRIGGER update_ai_agent_permissions_updated_at
  BEFORE UPDATE ON ai_agent_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION 7: 20251025085835_create_ai_agents_tables.sql
-- ============================================================================
/*
  # AI Agents Module Tables

  ## Overview
  Creates tables for AI Agents functionality in the CRM system.

  ## New Tables

  ### 1. `ai_agents`
  Main table for AI agent configurations
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text) - Agent display name
  - `model` (text) - AI model (GPT-5, Claude, Llama, etc.)
  - `system_prompt` (text) - System instructions for the agent
  - `status` (text) - Active/Inactive
  - `channels` (text[]) - Array of channels (Web, WhatsApp, Email, Voice)
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  - `last_activity` (timestamptz) - Last activity timestamp
  - `created_by` (text) - User who created the agent

  ### 2. `ai_agent_permissions`
  Stores module access permissions for each agent
  - `id` (uuid, primary key) - Unique identifier
  - `agent_id` (uuid, foreign key) - References ai_agents
  - `module_name` (text) - Name of CRM module
  - `can_view` (boolean) - View permission
  - `can_create` (boolean) - Create permission
  - `can_edit` (boolean) - Edit permission
  - `can_delete` (boolean) - Delete permission
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 3. `ai_agent_logs`
  Activity logs for agent actions
  - `id` (uuid, primary key) - Unique identifier
  - `agent_id` (uuid, foreign key) - References ai_agents
  - `agent_name` (text) - Agent name at time of action
  - `module` (text) - CRM module affected
  - `action` (text) - Action type (Create, Update, Fetch, Delete)
  - `result` (text) - Success/Denied/Error
  - `user_context` (text) - User who gave instruction
  - `details` (jsonb) - Additional details about the action
  - `created_at` (timestamptz) - Action timestamp

  ## Security
  - RLS enabled on all tables
  - Policies allow authenticated users to manage their own data
  - Admin users have full access
*/

-- Create ai_agents table
CREATE TABLE IF NOT EXISTS ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  model text NOT NULL,
  system_prompt text NOT NULL,
  status text NOT NULL DEFAULT 'Active',
  channels text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_activity timestamptz DEFAULT now(),
  created_by text
);

-- Create ai_agent_permissions table
CREATE TABLE IF NOT EXISTS ai_agent_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  module_name text NOT NULL,
  can_view boolean DEFAULT true,
  can_create boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(agent_id, module_name)
);

-- Create ai_agent_logs table
CREATE TABLE IF NOT EXISTS ai_agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  module text NOT NULL,
  action text NOT NULL,
  result text NOT NULL,
  user_context text,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_agents
CREATE POLICY "Allow anonymous read access to ai_agents"
  ON ai_agents FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to ai_agents"
  ON ai_agents FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to ai_agents"
  ON ai_agents FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to ai_agents"
  ON ai_agents FOR DELETE
  TO anon
  USING (true);

-- RLS Policies for ai_agent_permissions
CREATE POLICY "Allow anonymous read access to ai_agent_permissions"
  ON ai_agent_permissions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to ai_agent_permissions"
  ON ai_agent_permissions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to ai_agent_permissions"
  ON ai_agent_permissions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to ai_agent_permissions"
  ON ai_agent_permissions FOR DELETE
  TO anon
  USING (true);

-- RLS Policies for ai_agent_logs
CREATE POLICY "Allow anonymous read access to ai_agent_logs"
  ON ai_agent_logs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to ai_agent_logs"
  ON ai_agent_logs FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_agents_status ON ai_agents(status);
CREATE INDEX IF NOT EXISTS idx_ai_agents_last_activity ON ai_agents(last_activity);
CREATE INDEX IF NOT EXISTS idx_ai_agent_permissions_agent_id ON ai_agent_permissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_logs_agent_id ON ai_agent_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_logs_created_at ON ai_agent_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_agent_logs_module ON ai_agent_logs(module);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_ai_agents_updated_at ON ai_agents;
CREATE TRIGGER update_ai_agents_updated_at
  BEFORE UPDATE ON ai_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_agent_permissions_updated_at ON ai_agent_permissions;
CREATE TRIGGER update_ai_agent_permissions_updated_at
  BEFORE UPDATE ON ai_agent_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION 8: 20251025152029_update_ai_agent_permissions_to_array_structure.sql
-- ============================================================================
/*
  # Restructure AI Agent Permissions to Array-Based Storage

  ## Overview
  Converts ai_agent_permissions from one-row-per-module to one-row-per-agent with all permissions in a JSONB object.
  This matches the pattern used in admin_users for consistency.

  ## Changes
  
  ### 1. Backup existing data
  Creates a temporary backup of existing permissions
  
  ### 2. Drop existing table
  Removes the old table structure with individual rows per module
  
  ### 3. Create new table structure
  - `ai_agent_permissions` with single row per agent
  - Stores all module permissions in a JSONB object
  - Structure: {"module_name": {"can_view": bool, "can_create": bool, "can_edit": bool, "can_delete": bool}}
  
  ### 4. Migrate data
  Converts old row-per-module data to new JSONB structure
  
  ## Security
  - RLS policies maintained for anonymous access
  - All existing security rules preserved
*/

-- Step 1: Create backup of existing data
CREATE TEMP TABLE ai_agent_permissions_backup AS 
SELECT * FROM ai_agent_permissions;

-- Step 2: Drop old table and recreate with new structure
DROP TABLE IF EXISTS ai_agent_permissions CASCADE;

CREATE TABLE ai_agent_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid UNIQUE NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 3: Migrate existing data to new structure
DO $$
DECLARE
  agent_record RECORD;
  permissions_json jsonb := '{}'::jsonb;
BEGIN
  -- Get unique agents from backup
  FOR agent_record IN 
    SELECT DISTINCT agent_id FROM ai_agent_permissions_backup
  LOOP
    -- Build permissions JSON for this agent
    permissions_json := '{}'::jsonb;
    
    -- Aggregate all module permissions for this agent
    SELECT jsonb_object_agg(
      module_name,
      jsonb_build_object(
        'can_view', can_view,
        'can_create', can_create,
        'can_edit', can_edit,
        'can_delete', can_delete
      )
    )
    INTO permissions_json
    FROM ai_agent_permissions_backup
    WHERE agent_id = agent_record.agent_id;
    
    -- Insert into new table
    INSERT INTO ai_agent_permissions (agent_id, permissions)
    VALUES (agent_record.agent_id, permissions_json);
  END LOOP;
END $$;

-- Step 4: Enable RLS
ALTER TABLE ai_agent_permissions ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
CREATE POLICY "Allow anonymous read access to ai_agent_permissions"
  ON ai_agent_permissions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to ai_agent_permissions"
  ON ai_agent_permissions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to ai_agent_permissions"
  ON ai_agent_permissions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to ai_agent_permissions"
  ON ai_agent_permissions FOR DELETE
  TO anon
  USING (true);

-- Step 6: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_agent_permissions_agent_id ON ai_agent_permissions(agent_id);

-- Step 7: Create trigger for updated_at
DROP TRIGGER IF EXISTS update_ai_agent_permissions_updated_at ON ai_agent_permissions;
CREATE TRIGGER update_ai_agent_permissions_updated_at
  BEFORE UPDATE ON ai_agent_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION 9: 20251026090901_remove_duplicate_contacts_and_add_unique_constraint.sql
-- ============================================================================
/*
  # Remove Duplicate Contacts and Add Unique Constraint

  1. Changes
    - Remove duplicate contacts keeping only the oldest entry for each phone number
    - Add unique constraint to `phone` column in `contacts_master` table
  
  2. Security
    - Maintains data integrity by preventing duplicate phone numbers
    - Keeps the oldest contact record for each duplicate phone number
  
  3. Notes
    - Phone number is the primary identifier for contacts
    - This ensures data integrity and prevents duplicate contact entries in the future
*/

DO $$
BEGIN
  DELETE FROM contacts_master
  WHERE id IN (
    SELECT id
    FROM (
      SELECT id, 
             ROW_NUMBER() OVER (PARTITION BY phone ORDER BY created_at ASC) AS rn
      FROM contacts_master
    ) t
    WHERE t.rn > 1
  );

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contacts_master_phone_key'
  ) THEN
    ALTER TABLE contacts_master 
    ADD CONSTRAINT contacts_master_phone_key UNIQUE (phone);
  END IF;
END $$;

-- ============================================================================
-- MIGRATION 10: 20251026123432_update_appointment_id_format.sql
-- ============================================================================
/*
  # Update Appointment ID Format to APT0001, APT0002, etc.

  1. Changes
    - Drop the default random ID generation for appointment_id
    - Create a sequence for auto-incrementing appointment numbers
    - Create a function to generate appointment IDs in APT0001 format
    - Create a trigger to auto-generate appointment IDs on insert
    - Update all existing appointments with the new ID format

  2. Migration Steps
    - Create sequence starting from 1
    - Update existing appointments with sequential IDs
    - Add trigger for new appointments
*/

-- Create sequence for appointment numbering
CREATE SEQUENCE IF NOT EXISTS appointments_id_seq START WITH 1;

-- Create function to generate appointment ID
CREATE OR REPLACE FUNCTION generate_appointment_id()
RETURNS TEXT AS $$
DECLARE
  next_id INTEGER;
BEGIN
  next_id := nextval('appointments_id_seq');
  RETURN 'APT' || LPAD(next_id::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Update existing appointments with sequential IDs
DO $$
DECLARE
  appointment_record RECORD;
  counter INTEGER := 0;
BEGIN
  FOR appointment_record IN 
    SELECT id FROM appointments ORDER BY created_at
  LOOP
    counter := counter + 1;
    UPDATE appointments 
    SET appointment_id = 'APT' || LPAD(counter::TEXT, 4, '0')
    WHERE id = appointment_record.id;
  END LOOP;
  
  -- Set the sequence to continue from the last ID
  IF counter > 0 THEN
    PERFORM setval('appointments_id_seq', counter);
  END IF;
END $$;

-- Drop the old default constraint
ALTER TABLE appointments ALTER COLUMN appointment_id DROP DEFAULT;

-- Add new default using the function
ALTER TABLE appointments ALTER COLUMN appointment_id SET DEFAULT generate_appointment_id();

-- Create trigger to auto-generate appointment_id on insert
CREATE OR REPLACE FUNCTION set_appointment_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.appointment_id IS NULL OR NEW.appointment_id = '' THEN
    NEW.appointment_id := generate_appointment_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_appointment_id ON appointments;

CREATE TRIGGER trigger_set_appointment_id
  BEFORE INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION set_appointment_id();

-- ============================================================================
-- MIGRATION 11: 20251026134714_add_missing_modules_to_admin_permissions.sql
-- ============================================================================
/*
  # Add Missing Modules to Admin User Permissions

  1. Changes
    - Updates all existing admin_users to include the 12 new modules in their permissions JSONB column
    - Adds: contacts, tasks, appointments, lms, attendance, expenses, products, leave, media, integrations, ai_agents, pipelines
    - Each new module gets default permissions: { read: false, insert: false, update: false, delete: false }
    
  2. Notes
    - This ensures all team members have a consistent permission structure
    - Preserves existing permissions for the original 10 modules
    - New modules are added with all permissions set to false by default
*/

-- Update all existing admin users to include the new modules
UPDATE admin_users
SET permissions = permissions || jsonb_build_object(
  'contacts', jsonb_build_object('read', false, 'insert', false, 'update', false, 'delete', false),
  'tasks', jsonb_build_object('read', false, 'insert', false, 'update', false, 'delete', false),
  'appointments', jsonb_build_object('read', false, 'insert', false, 'update', false, 'delete', false),
  'lms', jsonb_build_object('read', false, 'insert', false, 'update', false, 'delete', false),
  'attendance', jsonb_build_object('read', false, 'insert', false, 'update', false, 'delete', false),
  'expenses', jsonb_build_object('read', false, 'insert', false, 'update', false, 'delete', false),
  'products', jsonb_build_object('read', false, 'insert', false, 'update', false, 'delete', false),
  'leave', jsonb_build_object('read', false, 'insert', false, 'update', false, 'delete', false),
  'media', jsonb_build_object('read', false, 'insert', false, 'update', false, 'delete', false),
  'integrations', jsonb_build_object('read', false, 'insert', false, 'update', false, 'delete', false),
  'ai_agents', jsonb_build_object('read', false, 'insert', false, 'update', false, 'delete', false),
  'pipelines', jsonb_build_object('read', false, 'insert', false, 'update', false, 'delete', false)
)
WHERE permissions IS NOT NULL
  AND NOT permissions ? 'contacts';  -- Only update if contacts module doesn't exist yet

/*
================================================================================
END OF GROUP 13: SUPPORT TICKETS AND MEDIA UPDATES
================================================================================
Next Group: group-14-advanced-features-and-optimizations.sql
*/
