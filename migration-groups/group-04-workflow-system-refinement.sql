/*
================================================================================
GROUP 4: WORKFLOW SYSTEM REFINEMENT
================================================================================

Workflow trigger execution, API webhooks, and lead triggers

Total Files: 11
Dependencies: Group 3

Files Included (in execution order):
1. 20251016155911_simplify_workflow_trigger_execution.sql
2. 20251016160338_fix_ambiguous_column_reference_in_trigger.sql
3. 20251016162244_create_api_webhooks_table.sql
4. 20251016162454_update_trigger_to_send_to_api_webhooks.sql
5. 20251016162853_update_api_webhooks_rls_for_anon_access.sql
6. 20251016165211_add_lead_updated_trigger.sql
7. 20251016165212_add_lead_deleted_trigger.sql
8. 20251016165213_add_lead_deleted_trigger_data.sql
9. 20251016170137_20251016165212_add_lead_deleted_trigger.sql
10. 20251016170156_20251016165213_add_lead_deleted_trigger_data.sql
11. 20251016171744_20251016170500_update_lead_triggers_for_api_webhooks.sql

================================================================================
*/

-- ============================================================================
-- MIGRATION 1: 20251016155911_simplify_workflow_trigger_execution.sql
-- ============================================================================
/*
  # Simplify Workflow Trigger Execution

  1. Changes
    - Simplify the trigger function to directly execute workflows inline
    - Remove dependency on edge function for simple webhook actions
    - Makes execution faster and more reliable

  2. Important Notes
    - For webhook actions, we'll execute them directly from the trigger
    - This is more efficient than calling an edge function
    - Complex actions can still use edge functions in future
*/

-- Create function to execute webhook action
CREATE OR REPLACE FUNCTION execute_webhook_action(
  webhook_url text,
  headers jsonb,
  body_params jsonb,
  trigger_data jsonb
)
RETURNS void AS $$
DECLARE
  final_url text;
  final_headers jsonb;
  final_body jsonb;
  header_item jsonb;
  body_item jsonb;
  key text;
  value text;
  request_id bigint;
BEGIN
  -- Build final URL (no query params for now, can be added later)
  final_url := webhook_url;
  
  -- Build headers
  final_headers := '{}'::jsonb;
  IF headers IS NOT NULL THEN
    FOR header_item IN SELECT * FROM jsonb_array_elements(headers)
    LOOP
      key := header_item->>'key';
      value := header_item->>'value';
      IF key IS NOT NULL AND key != '' THEN
        -- Replace placeholders
        value := regexp_replace(value, '\\{\\{(\\w+)\\}\\}', trigger_data->>E'\\1', 'g');
        final_headers := final_headers || jsonb_build_object(key, value);
      END IF;
    END LOOP;
  END IF;
  
  -- Build body
  final_body := '{}'::jsonb;
  IF body_params IS NOT NULL THEN
    FOR body_item IN SELECT * FROM jsonb_array_elements(body_params)
    LOOP
      key := body_item->>'key';
      value := body_item->>'value';
      IF key IS NOT NULL AND key != '' THEN
        -- Replace placeholders
        value := regexp_replace(value, '\\{\\{(\\w+)\\}\\}', trigger_data->>E'\\1', 'g');
        final_body := final_body || jsonb_build_object(key, value);
      END IF;
    END LOOP;
  END IF;
  
  -- Make HTTP request using pg_net
  BEGIN
    SELECT net.http_post(
      url := final_url,
      headers := final_headers,
      body := final_body
    ) INTO request_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Webhook request failed: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the main trigger function to execute actions inline
CREATE OR REPLACE FUNCTION trigger_workflows_on_lead_insert()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
  action_node jsonb;
  webhook_config jsonb;
  steps_completed integer;
  total_steps integer;
  trigger_data jsonb;
BEGIN
  -- Build trigger data
  trigger_data := jsonb_build_object(
    'id', NEW.id,
    'lead_id', NEW.lead_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'source', NEW.source,
    'interest', NEW.interest,
    'status', NEW.status,
    'owner', NEW.owner,
    'address', NEW.address,
    'company', NEW.company,
    'notes', NEW.notes,
    'last_contact', NEW.last_contact,
    'lead_score', NEW.lead_score,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'affiliate_id', NEW.affiliate_id
  );

  -- Find all active automations with LEADS trigger
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
    
    -- Check if this is a LEADS trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'NEW_LEAD_ADDED' THEN
      
      total_steps := jsonb_array_length(automation_record.workflow_nodes) - 1;
      steps_completed := 0;
      
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
        'NEW_LEAD_ADDED',
        trigger_data,
        'running',
        total_steps,
        now()
      ) RETURNING id INTO execution_id;
      
      -- Execute each action node
      BEGIN
        FOR i IN 1..jsonb_array_length(automation_record.workflow_nodes)-1 LOOP
          action_node := automation_record.workflow_nodes->i;
          
          IF action_node->>'type' = 'action' 
             AND action_node->'properties'->>'action_type' = 'webhook' THEN
            
            webhook_config := action_node->'properties'->'webhook_config';
            
            IF webhook_config->>'webhook_url' IS NOT NULL THEN
              -- Execute webhook
              PERFORM execute_webhook_action(
                webhook_config->>'webhook_url',
                webhook_config->'headers',
                webhook_config->'body',
                trigger_data
              );
              
              steps_completed := steps_completed + 1;
            END IF;
          END IF;
        END LOOP;
        
        -- Mark as completed
        UPDATE workflow_executions
        SET 
          status = 'completed',
          steps_completed = steps_completed,
          completed_at = now()
        WHERE id = execution_id;
        
        -- Update automation stats
        UPDATE automations
        SET 
          total_runs = COALESCE(total_runs, 0) + 1,
          last_run = now()
        WHERE id = automation_record.id;
        
      EXCEPTION
        WHEN OTHERS THEN
          -- Mark as failed
          UPDATE workflow_executions
          SET 
            status = 'failed',
            steps_completed = steps_completed,
            error_message = SQLERRM,
            completed_at = now()
          WHERE id = execution_id;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_workflows_on_new_lead ON leads;
CREATE TRIGGER trigger_workflows_on_new_lead
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_lead_insert();

-- ============================================================================
-- MIGRATION 2: 20251016160338_fix_ambiguous_column_reference_in_trigger.sql
-- ============================================================================
/*
  # Fix Ambiguous Column Reference in Workflow Trigger

  1. Changes
    - Fix ambiguous column reference for steps_completed in trigger function
    - Add explicit table aliases and qualify all column references
    - Ensure variable names don't conflict with column names

  2. Important Notes
    - The issue was caused by variable name matching column name
    - Using explicit UPDATE syntax with column qualification
*/

-- Update the main trigger function with fixed column references
CREATE OR REPLACE FUNCTION trigger_workflows_on_lead_insert()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
  action_node jsonb;
  webhook_config jsonb;
  v_steps_completed integer;
  v_total_steps integer;
  trigger_data jsonb;
  i integer;
BEGIN
  -- Build trigger data
  trigger_data := jsonb_build_object(
    'id', NEW.id,
    'lead_id', NEW.lead_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'source', NEW.source,
    'interest', NEW.interest,
    'status', NEW.status,
    'owner', NEW.owner,
    'address', NEW.address,
    'company', NEW.company,
    'notes', NEW.notes,
    'last_contact', NEW.last_contact,
    'lead_score', NEW.lead_score,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'affiliate_id', NEW.affiliate_id
  );

  -- Find all active automations with LEADS trigger
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
    
    -- Check if this is a LEADS trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'NEW_LEAD_ADDED' THEN
      
      v_total_steps := jsonb_array_length(automation_record.workflow_nodes) - 1;
      v_steps_completed := 0;
      
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
        'NEW_LEAD_ADDED',
        trigger_data,
        'running',
        v_total_steps,
        now()
      ) RETURNING id INTO execution_id;
      
      -- Execute each action node
      BEGIN
        i := 1;
        WHILE i < jsonb_array_length(automation_record.workflow_nodes) LOOP
          action_node := automation_record.workflow_nodes->i;
          
          IF action_node->>'type' = 'action' 
             AND action_node->'properties'->>'action_type' = 'webhook' THEN
            
            webhook_config := action_node->'properties'->'webhook_config';
            
            IF webhook_config->>'webhook_url' IS NOT NULL THEN
              -- Execute webhook
              PERFORM execute_webhook_action(
                webhook_config->>'webhook_url',
                webhook_config->'headers',
                webhook_config->'body',
                trigger_data
              );
              
              v_steps_completed := v_steps_completed + 1;
            END IF;
          END IF;
          
          i := i + 1;
        END LOOP;
        
        -- Mark as completed
        UPDATE workflow_executions
        SET 
          status = 'completed',
          steps_completed = v_steps_completed,
          completed_at = now()
        WHERE workflow_executions.id = execution_id;
        
        -- Update automation stats
        UPDATE automations
        SET 
          total_runs = COALESCE(automations.total_runs, 0) + 1,
          last_run = now()
        WHERE automations.id = automation_record.id;
        
      EXCEPTION
        WHEN OTHERS THEN
          -- Mark as failed
          UPDATE workflow_executions
          SET 
            status = 'failed',
            steps_completed = v_steps_completed,
            error_message = SQLERRM,
            completed_at = now()
          WHERE workflow_executions.id = execution_id;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_workflows_on_new_lead ON leads;
CREATE TRIGGER trigger_workflows_on_new_lead
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_lead_insert();

-- ============================================================================
-- MIGRATION 3: 20251016162244_create_api_webhooks_table.sql
-- ============================================================================
/*
  # Create API Webhooks Table

  1. New Tables
    - `api_webhooks` - Stores API webhook configurations
      - `id` (uuid, primary key) - Unique identifier
      - `name` (text) - Webhook name for identification
      - `trigger_event` (text) - Trigger event (e.g., NEW_LEAD_ADDED, NEW_MEMBER_ENROLLED)
      - `webhook_url` (text) - URL to send POST request to
      - `is_active` (boolean) - Whether webhook is active
      - `description` (text) - Optional description
      - `last_triggered` (timestamptz) - Last time webhook was triggered
      - `total_calls` (integer) - Total number of calls made
      - `success_count` (integer) - Number of successful calls
      - `failure_count` (integer) - Number of failed calls
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Update timestamp

  2. Security
    - Enable RLS on `api_webhooks` table
    - Add policies for authenticated users to manage webhooks

  3. Important Notes
    - Each webhook will send all trigger data to the configured URL
    - Simple POST request with JSON payload
    - No custom field mapping - all data is sent automatically
    - Multiple webhooks can be configured for the same trigger event
*/

-- Create api_webhooks table
CREATE TABLE IF NOT EXISTS api_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_event text NOT NULL,
  webhook_url text NOT NULL,
  is_active boolean DEFAULT true,
  description text DEFAULT '',
  last_triggered timestamptz,
  total_calls integer DEFAULT 0,
  success_count integer DEFAULT 0,
  failure_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_api_webhooks_trigger_event ON api_webhooks(trigger_event);
CREATE INDEX IF NOT EXISTS idx_api_webhooks_is_active ON api_webhooks(is_active);
CREATE INDEX IF NOT EXISTS idx_api_webhooks_created_at ON api_webhooks(created_at DESC);

-- Enable RLS
ALTER TABLE api_webhooks ENABLE ROW LEVEL SECURITY;

-- Create policies for anon and authenticated users
CREATE POLICY "Allow anon to read api webhooks"
  ON api_webhooks
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to read api webhooks"
  ON api_webhooks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to insert api webhooks"
  ON api_webhooks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update api webhooks"
  ON api_webhooks
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete api webhooks"
  ON api_webhooks
  FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_api_webhooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_api_webhooks_updated_at_trigger
  BEFORE UPDATE ON api_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_api_webhooks_updated_at();

-- Add comments
COMMENT ON TABLE api_webhooks IS 'Stores API webhook configurations for sending trigger data to external URLs';
COMMENT ON COLUMN api_webhooks.trigger_event IS 'Event that triggers this webhook (e.g., NEW_LEAD_ADDED)';

-- ============================================================================
-- MIGRATION 4: 20251016162454_update_trigger_to_send_to_api_webhooks.sql
-- ============================================================================
/*
  # Update Trigger to Send Data to API Webhooks

  1. Changes
    - Update trigger_workflows_on_lead_insert() to also send data to configured API webhooks
    - API webhooks receive all trigger data as JSON POST request
    - Track success/failure statistics for each webhook

  2. Important Notes
    - API webhooks are simpler than workflow automations
    - They send ALL trigger data automatically, no field mapping needed
    - Multiple webhooks can be configured for the same trigger event
*/

-- Update the main trigger function to also handle API webhooks
CREATE OR REPLACE FUNCTION trigger_workflows_on_lead_insert()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  api_webhook_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
  action_node jsonb;
  webhook_config jsonb;
  v_steps_completed integer;
  v_total_steps integer;
  trigger_data jsonb;
  i integer;
  request_id bigint;
  webhook_success boolean;
BEGIN
  -- Build trigger data
  trigger_data := jsonb_build_object(
    'id', NEW.id,
    'lead_id', NEW.lead_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'source', NEW.source,
    'interest', NEW.interest,
    'status', NEW.status,
    'owner', NEW.owner,
    'address', NEW.address,
    'company', NEW.company,
    'notes', NEW.notes,
    'last_contact', NEW.last_contact,
    'lead_score', NEW.lead_score,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'affiliate_id', NEW.affiliate_id
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'NEW_LEAD_ADDED'
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
    
    -- Check if this is a LEADS trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'NEW_LEAD_ADDED' THEN
      
      v_total_steps := jsonb_array_length(automation_record.workflow_nodes) - 1;
      v_steps_completed := 0;
      
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
        'NEW_LEAD_ADDED',
        trigger_data,
        'running',
        v_total_steps,
        now()
      ) RETURNING id INTO execution_id;
      
      -- Execute each action node
      BEGIN
        i := 1;
        WHILE i < jsonb_array_length(automation_record.workflow_nodes) LOOP
          action_node := automation_record.workflow_nodes->i;
          
          IF action_node->>'type' = 'action' 
             AND action_node->'properties'->>'action_type' = 'webhook' THEN
            
            webhook_config := action_node->'properties'->'webhook_config';
            
            IF webhook_config->>'webhook_url' IS NOT NULL THEN
              -- Execute webhook
              PERFORM execute_webhook_action(
                webhook_config->>'webhook_url',
                webhook_config->'headers',
                webhook_config->'body',
                trigger_data
              );
              
              v_steps_completed := v_steps_completed + 1;
            END IF;
          END IF;
          
          i := i + 1;
        END LOOP;
        
        -- Mark as completed
        UPDATE workflow_executions
        SET 
          status = 'completed',
          steps_completed = v_steps_completed,
          completed_at = now()
        WHERE workflow_executions.id = execution_id;
        
        -- Update automation stats
        UPDATE automations
        SET 
          total_runs = COALESCE(automations.total_runs, 0) + 1,
          last_run = now()
        WHERE automations.id = automation_record.id;
        
      EXCEPTION
        WHEN OTHERS THEN
          -- Mark as failed
          UPDATE workflow_executions
          SET 
            status = 'failed',
            steps_completed = v_steps_completed,
            error_message = SQLERRM,
            completed_at = now()
          WHERE workflow_executions.id = execution_id;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_workflows_on_new_lead ON leads;
CREATE TRIGGER trigger_workflows_on_new_lead
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_lead_insert();

-- Add comment
COMMENT ON FUNCTION trigger_workflows_on_lead_insert() IS 'Triggers both API webhooks and workflow automations when a new lead is inserted';

-- ============================================================================
-- MIGRATION 5: 20251016162853_update_api_webhooks_rls_for_anon_access.sql
-- ============================================================================
/*
  # Update API Webhooks RLS for Anon Access

  1. Changes
    - Add anon policies for api_webhooks table
    - Allow anon users to insert, update, and delete webhooks
    - This matches the pattern used in other admin tables

  2. Security
    - Enable full CRUD access for anon users
    - This is intended for admin dashboard usage
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anon to read api webhooks" ON api_webhooks;
DROP POLICY IF EXISTS "Allow authenticated to read api webhooks" ON api_webhooks;
DROP POLICY IF EXISTS "Allow authenticated to insert api webhooks" ON api_webhooks;
DROP POLICY IF EXISTS "Allow authenticated to update api webhooks" ON api_webhooks;
DROP POLICY IF EXISTS "Allow authenticated to delete api webhooks" ON api_webhooks;

-- Create policies for anon users (full access)
CREATE POLICY "Allow anon to read api webhooks"
  ON api_webhooks
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon to insert api webhooks"
  ON api_webhooks
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon to update api webhooks"
  ON api_webhooks
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete api webhooks"
  ON api_webhooks
  FOR DELETE
  TO anon
  USING (true);

-- Create policies for authenticated users (full access)
CREATE POLICY "Allow authenticated to read api webhooks"
  ON api_webhooks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to insert api webhooks"
  ON api_webhooks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update api webhooks"
  ON api_webhooks
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete api webhooks"
  ON api_webhooks
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- MIGRATION 6: 20251016165211_add_lead_updated_trigger.sql
-- ============================================================================
/*
  # Add Lead Updated Trigger Event

  1. Changes
    - Create a new database trigger function for lead updates
    - Add trigger on leads table for UPDATE operations
    - When a lead is updated, check for active workflows with LEAD_UPDATED trigger
    - Create workflow execution records for matching workflows
    - Send notification via pg_notify for async workflow processing

  2. Functionality
    - Triggers workflows when any lead is updated
    - Passes all lead data (both OLD and NEW values) to the workflow
    - Works alongside the existing NEW_LEAD_ADDED trigger
    - Supports multiple workflows being triggered by the same event

  3. Security
    - Uses existing RLS policies on workflow_executions table
    - No additional security configuration needed
*/

-- Create function to trigger workflows when a lead is updated
CREATE OR REPLACE FUNCTION trigger_workflows_on_lead_update()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
BEGIN
  -- Find all active automations with LEAD_UPDATED trigger
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
    
    -- Check if this is a LEAD_UPDATED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'LEAD_UPDATED' THEN
      
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
        'LEAD_UPDATED',
        jsonb_build_object(
          'id', NEW.id,
          'lead_id', NEW.lead_id,
          'name', NEW.name,
          'email', NEW.email,
          'phone', NEW.phone,
          'source', NEW.source,
          'interest', NEW.interest,
          'status', NEW.status,
          'owner', NEW.owner,
          'address', NEW.address,
          'company', NEW.company,
          'notes', NEW.notes,
          'last_contact', NEW.last_contact,
          'lead_score', NEW.lead_score,
          'created_at', NEW.created_at,
          'updated_at', NEW.updated_at,
          'affiliate_id', NEW.affiliate_id,
          'previous', jsonb_build_object(
            'status', OLD.status,
            'interest', OLD.interest,
            'owner', OLD.owner,
            'notes', OLD.notes,
            'last_contact', OLD.last_contact,
            'lead_score', OLD.lead_score
          )
        ),
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
          'trigger_type', 'LEAD_UPDATED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on leads table for updates
DROP TRIGGER IF EXISTS trigger_workflows_on_lead_update ON leads;
CREATE TRIGGER trigger_workflows_on_lead_update
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_lead_update();

-- Add comment
COMMENT ON FUNCTION trigger_workflows_on_lead_update() IS 'Triggers workflows when a lead is updated';

-- ============================================================================
-- MIGRATION 7: 20251016165212_add_lead_deleted_trigger.sql
-- ============================================================================
/*
  # Add Lead Deleted Trigger Event

  1. Changes
    - Create a new database trigger function for lead deletions
    - Add trigger on leads table for DELETE operations
    - When a lead is deleted, check for active workflows with LEAD_DELETED trigger
    - Create workflow execution records for matching workflows
    - Send notification via pg_notify for async workflow processing

  2. Functionality
    - Triggers workflows when any lead is deleted
    - Passes all lead data to the workflow before deletion
    - Works alongside existing NEW_LEAD_ADDED and LEAD_UPDATED triggers
    - Supports multiple workflows being triggered by the same event

  3. Security
    - Uses existing RLS policies on workflow_executions table
    - No additional security configuration needed
*/

-- Create function to trigger workflows when a lead is deleted
CREATE OR REPLACE FUNCTION trigger_workflows_on_lead_delete()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
BEGIN
  -- Find all active automations with LEAD_DELETED trigger
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

    -- Check if this is a LEAD_DELETED trigger
    IF trigger_node->>'type' = 'trigger'
       AND trigger_node->'properties'->>'event_name' = 'LEAD_DELETED' THEN

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
        'LEAD_DELETED',
        jsonb_build_object(
          'id', OLD.id,
          'lead_id', OLD.lead_id,
          'name', OLD.name,
          'email', OLD.email,
          'phone', OLD.phone,
          'source', OLD.source,
          'interest', OLD.interest,
          'status', OLD.status,
          'owner', OLD.owner,
          'address', OLD.address,
          'company', OLD.company,
          'notes', OLD.notes,
          'last_contact', OLD.last_contact,
          'lead_score', OLD.lead_score,
          'created_at', OLD.created_at,
          'updated_at', OLD.updated_at,
          'affiliate_id', OLD.affiliate_id,
          'deleted_at', now()
        ),
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
          'trigger_type', 'LEAD_DELETED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on leads table for deletions
DROP TRIGGER IF EXISTS trigger_workflows_on_lead_delete ON leads;
CREATE TRIGGER trigger_workflows_on_lead_delete
  AFTER DELETE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_lead_delete();

-- Add comment
COMMENT ON FUNCTION trigger_workflows_on_lead_delete() IS 'Triggers workflows when a lead is deleted';

-- ============================================================================
-- MIGRATION 8: 20251016165213_add_lead_deleted_trigger_data.sql
-- ============================================================================
/*
  # Add Lead Deleted Trigger to Workflow Triggers

  1. Changes
    - Insert the LEAD_DELETED trigger into workflow_triggers table
    - Provides trigger configuration for when leads are deleted
    - Makes the trigger available in the automation builder UI

  2. Trigger Details
    - Event Name: LEAD_DELETED
    - Category: Leads
    - 15 data fields including deleted_at timestamp
    - Icon: users

  3. Security
    - Uses existing RLS policies on workflow_triggers table
*/

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
  'lead_deleted',
  'Lead Deleted',
  'Triggered when a lead is deleted from the CRM',
  'LEAD_DELETED',
  '[
    {"field": "id", "type": "uuid", "description": "Unique identifier"},
    {"field": "lead_id", "type": "string", "description": "Lead ID (e.g., L001)"},
    {"field": "name", "type": "string", "description": "Lead name"},
    {"field": "email", "type": "string", "description": "Lead email address"},
    {"field": "phone", "type": "string", "description": "Lead phone number"},
    {"field": "source", "type": "string", "description": "Lead source"},
    {"field": "interest", "type": "string", "description": "Lead interest level"},
    {"field": "status", "type": "string", "description": "Lead status"},
    {"field": "owner", "type": "string", "description": "Assigned owner"},
    {"field": "address", "type": "string", "description": "Lead address"},
    {"field": "company", "type": "string", "description": "Company name"},
    {"field": "notes", "type": "string", "description": "Lead notes"},
    {"field": "last_contact", "type": "date", "description": "Last contact date"},
    {"field": "lead_score", "type": "number", "description": "Lead score"},
    {"field": "deleted_at", "type": "timestamp", "description": "When the lead was deleted"}
  ]'::jsonb,
  'Leads',
  'users',
  true
);

-- ============================================================================
-- MIGRATION 9: 20251016170137_20251016165212_add_lead_deleted_trigger.sql
-- ============================================================================
/*
  # Add Lead Deleted Trigger Event

  1. Changes
    - Create a new database trigger function for lead deletions
    - Add trigger on leads table for DELETE operations
    - When a lead is deleted, check for active workflows with LEAD_DELETED trigger
    - Create workflow execution records for matching workflows
    - Send notification via pg_notify for async workflow processing

  2. Functionality
    - Triggers workflows when any lead is deleted
    - Passes all lead data to the workflow before deletion
    - Works alongside existing NEW_LEAD_ADDED and LEAD_UPDATED triggers
    - Supports multiple workflows being triggered by the same event

  3. Security
    - Uses existing RLS policies on workflow_executions table
    - No additional security configuration needed
*/

-- Create function to trigger workflows when a lead is deleted
CREATE OR REPLACE FUNCTION trigger_workflows_on_lead_delete()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
BEGIN
  -- Find all active automations with LEAD_DELETED trigger
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

    -- Check if this is a LEAD_DELETED trigger
    IF trigger_node->>'type' = 'trigger'
       AND trigger_node->'properties'->>'event_name' = 'LEAD_DELETED' THEN

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
        'LEAD_DELETED',
        jsonb_build_object(
          'id', OLD.id,
          'lead_id', OLD.lead_id,
          'name', OLD.name,
          'email', OLD.email,
          'phone', OLD.phone,
          'source', OLD.source,
          'interest', OLD.interest,
          'status', OLD.status,
          'owner', OLD.owner,
          'address', OLD.address,
          'company', OLD.company,
          'notes', OLD.notes,
          'last_contact', OLD.last_contact,
          'lead_score', OLD.lead_score,
          'created_at', OLD.created_at,
          'updated_at', OLD.updated_at,
          'affiliate_id', OLD.affiliate_id,
          'deleted_at', now()
        ),
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
          'trigger_type', 'LEAD_DELETED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on leads table for deletions
DROP TRIGGER IF EXISTS trigger_workflows_on_lead_delete ON leads;
CREATE TRIGGER trigger_workflows_on_lead_delete
  AFTER DELETE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_lead_delete();

-- Add comment
COMMENT ON FUNCTION trigger_workflows_on_lead_delete() IS 'Triggers workflows when a lead is deleted';

-- ============================================================================
-- MIGRATION 10: 20251016170156_20251016165213_add_lead_deleted_trigger_data.sql
-- ============================================================================
/*
  # Add Lead Deleted Trigger to Workflow Triggers

  1. Changes
    - Insert the LEAD_DELETED trigger into workflow_triggers table
    - Provides trigger configuration for when leads are deleted
    - Makes the trigger available in the automation builder UI

  2. Trigger Details
    - Event Name: LEAD_DELETED
    - Category: Leads
    - 15 data fields including deleted_at timestamp
    - Icon: users

  3. Security
    - Uses existing RLS policies on workflow_triggers table
*/

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
  'lead_deleted',
  'Lead Deleted',
  'Triggered when a lead is deleted from the CRM',
  'LEAD_DELETED',
  '[
    {"field": "id", "type": "uuid", "description": "Unique identifier"},
    {"field": "lead_id", "type": "string", "description": "Lead ID (e.g., L001)"},
    {"field": "name", "type": "string", "description": "Lead name"},
    {"field": "email", "type": "string", "description": "Lead email address"},
    {"field": "phone", "type": "string", "description": "Lead phone number"},
    {"field": "source", "type": "string", "description": "Lead source"},
    {"field": "interest", "type": "string", "description": "Lead interest level"},
    {"field": "status", "type": "string", "description": "Lead status"},
    {"field": "owner", "type": "string", "description": "Assigned owner"},
    {"field": "address", "type": "string", "description": "Lead address"},
    {"field": "company", "type": "string", "description": "Company name"},
    {"field": "notes", "type": "string", "description": "Lead notes"},
    {"field": "last_contact", "type": "date", "description": "Last contact date"},
    {"field": "lead_score", "type": "number", "description": "Lead score"},
    {"field": "deleted_at", "type": "timestamp", "description": "When the lead was deleted"}
  ]'::jsonb,
  'Leads',
  'users',
  true
);

-- ============================================================================
-- MIGRATION 11: 20251016171744_20251016170500_update_lead_triggers_for_api_webhooks.sql
-- ============================================================================
/*
  # Update Lead UPDATE and DELETE Triggers for API Webhooks

  1. Changes
    - Update trigger_workflows_on_lead_update() to send data to configured API webhooks
    - Update trigger_workflows_on_lead_delete() to send data to configured API webhooks
    - API webhooks receive all trigger data as JSON POST request
    - Track success/failure statistics for each webhook

  2. Functionality
    - When a lead is updated, check for active API webhooks with LEAD_UPDATED trigger
    - When a lead is deleted, check for active API webhooks with LEAD_DELETED trigger
    - Send POST request to webhook URL with all lead data
    - Update webhook statistics (total_calls, success_count, failure_count)
    - Works alongside existing workflow automation triggers

  3. Security
    - Uses existing RLS policies on api_webhooks table
    - SECURITY DEFINER ensures trigger has permission to update statistics
*/

-- Update LEAD_UPDATED trigger function to include API webhooks
CREATE OR REPLACE FUNCTION trigger_workflows_on_lead_update()
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
    'lead_id', NEW.lead_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'source', NEW.source,
    'interest', NEW.interest,
    'status', NEW.status,
    'owner', NEW.owner,
    'address', NEW.address,
    'company', NEW.company,
    'notes', NEW.notes,
    'last_contact', NEW.last_contact,
    'lead_score', NEW.lead_score,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'affiliate_id', NEW.affiliate_id,
    'previous', jsonb_build_object(
      'status', OLD.status,
      'interest', OLD.interest,
      'owner', OLD.owner,
      'notes', OLD.notes,
      'last_contact', OLD.last_contact,
      'lead_score', OLD.lead_score
    )
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'LEAD_UPDATED'
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

  -- Process Workflow Automations (existing logic)
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
       AND trigger_node->'properties'->>'event_name' = 'LEAD_UPDATED' THEN
      
      INSERT INTO workflow_executions (
        automation_id,
        trigger_type,
        trigger_data,
        status,
        total_steps,
        started_at
      ) VALUES (
        automation_record.id,
        'LEAD_UPDATED',
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
          'trigger_type', 'LEAD_UPDATED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update LEAD_DELETED trigger function to include API webhooks
CREATE OR REPLACE FUNCTION trigger_workflows_on_lead_delete()
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
    'lead_id', OLD.lead_id,
    'name', OLD.name,
    'email', OLD.email,
    'phone', OLD.phone,
    'source', OLD.source,
    'interest', OLD.interest,
    'status', OLD.status,
    'owner', OLD.owner,
    'address', OLD.address,
    'company', OLD.company,
    'notes', OLD.notes,
    'last_contact', OLD.last_contact,
    'lead_score', OLD.lead_score,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'affiliate_id', OLD.affiliate_id,
    'deleted_at', now()
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'LEAD_DELETED'
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

  -- Process Workflow Automations (existing logic)
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
       AND trigger_node->'properties'->>'event_name' = 'LEAD_DELETED' THEN

      INSERT INTO workflow_executions (
        automation_id,
        trigger_type,
        trigger_data,
        status,
        total_steps,
        started_at
      ) VALUES (
        automation_record.id,
        'LEAD_DELETED',
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
          'trigger_type', 'LEAD_DELETED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update comments
COMMENT ON FUNCTION trigger_workflows_on_lead_update() IS 'Triggers both API webhooks and workflow automations when a lead is updated';
COMMENT ON FUNCTION trigger_workflows_on_lead_delete() IS 'Triggers both API webhooks and workflow automations when a lead is deleted';

/*
================================================================================
END OF GROUP 4: WORKFLOW SYSTEM REFINEMENT
================================================================================
Next Group: group-05-support-and-attendance-systems.sql
*/
