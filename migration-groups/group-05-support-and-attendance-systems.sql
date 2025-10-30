/*
================================================================================
GROUP 5: SUPPORT AND ATTENDANCE SYSTEMS
================================================================================

Support ticket triggers, attendance tracking, and affiliate triggers

Total Files: 10
Dependencies: Group 4

Files Included (in execution order):
1. 20251016172937_create_support_ticket_triggers.sql
2. 20251016180012_create_attendance_table.sql
3. 20251016181148_update_attendance_rls_for_anon_read.sql
4. 20251018172938_add_affiliate_triggers.sql
5. 20251018183139_update_affiliate_triggers_for_api_webhooks.sql
6. 20251018184329_add_trigger_event_to_all_webhook_payloads.sql
7. 20251018184416_add_trigger_event_to_support_ticket_webhooks.sql
8. 20251018190601_create_enrolled_member_triggers.sql
9. 20251018192404_create_team_user_triggers.sql
10. 20251018194556_create_attendance_triggers.sql

================================================================================
*/

-- ============================================================================
-- MIGRATION 1: 20251016172937_create_support_ticket_triggers.sql
-- ============================================================================
/*
  # Create Support Ticket Triggers for API Webhooks and Automations

  1. Changes
    - Create trigger function for support ticket INSERT operations
    - Create trigger function for support ticket UPDATE operations
    - Create trigger function for support ticket DELETE operations
    - All triggers support both API webhooks and workflow automations

  2. Functionality
    - TICKET_CREATED: Triggers when a new support ticket is created
    - TICKET_UPDATED: Triggers when an existing ticket is updated
    - TICKET_DELETED: Triggers when a ticket is deleted
    - Sends POST requests to configured webhook URLs
    - Tracks webhook statistics (total_calls, success_count, failure_count)
    - Creates workflow execution records for active automations

  3. Security
    - SECURITY DEFINER ensures triggers have permission to update statistics
    - Uses existing RLS policies on api_webhooks and workflow_executions tables
*/

-- Trigger function for TICKET_CREATED
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
    'enrolled_member_id', NEW.enrolled_member_id,
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

-- Trigger function for TICKET_UPDATED
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
    'enrolled_member_id', NEW.enrolled_member_id,
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

-- Trigger function for TICKET_DELETED
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
    'enrolled_member_id', OLD.enrolled_member_id,
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

-- Create triggers on support_tickets table
DROP TRIGGER IF EXISTS trigger_workflows_on_ticket_insert ON support_tickets;
CREATE TRIGGER trigger_workflows_on_ticket_insert
  AFTER INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_ticket_insert();

DROP TRIGGER IF EXISTS trigger_workflows_on_ticket_update ON support_tickets;
CREATE TRIGGER trigger_workflows_on_ticket_update
  AFTER UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_ticket_update();

DROP TRIGGER IF EXISTS trigger_workflows_on_ticket_delete ON support_tickets;
CREATE TRIGGER trigger_workflows_on_ticket_delete
  AFTER DELETE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_ticket_delete();

-- Add comments
COMMENT ON FUNCTION trigger_workflows_on_ticket_insert() IS 'Triggers both API webhooks and workflow automations when a support ticket is created';
COMMENT ON FUNCTION trigger_workflows_on_ticket_update() IS 'Triggers both API webhooks and workflow automations when a support ticket is updated';
COMMENT ON FUNCTION trigger_workflows_on_ticket_delete() IS 'Triggers both API webhooks and workflow automations when a support ticket is deleted';

-- ============================================================================
-- MIGRATION 2: 20251016180012_create_attendance_table.sql
-- ============================================================================
/*
  # Create Attendance Management Table

  1. New Tables
    - `attendance`
      - `id` (uuid, primary key)
      - `admin_user_id` (uuid, foreign key to admin_users)
      - `date` (date) - Attendance date
      - `check_in_time` (timestamptz) - Check-in timestamp
      - `check_out_time` (timestamptz) - Check-out timestamp (nullable)
      - `check_in_selfie_url` (text) - URL to selfie image
      - `check_in_location` (jsonb) - GPS coordinates {lat, lng, address}
      - `status` (text) - present, absent, late, half_day
      - `notes` (text) - Optional notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `attendance` table
    - Add policies for authenticated users (admin role) to manage attendance
    - Add policy for users to view their own attendance
    - Add policy for anon users to mark attendance (for mobile app support)

  3. Indexes
    - Index on admin_user_id for faster lookups
    - Index on date for date-based queries
    - Composite index on admin_user_id and date for unique constraint
*/

-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in_time timestamptz NOT NULL DEFAULT now(),
  check_out_time timestamptz,
  check_in_selfie_url text,
  check_in_location jsonb,
  status text DEFAULT 'present',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_date UNIQUE (admin_user_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

-- Enable RLS
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated admin users to view all attendance
CREATE POLICY "Admins can view all attendance"
  ON attendance
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('Admin', 'Super Admin')
    )
  );

-- Policy: Allow users to view their own attendance
CREATE POLICY "Users can view own attendance"
  ON attendance
  FOR SELECT
  TO authenticated
  USING (admin_user_id = auth.uid());

-- Policy: Allow anon users to insert attendance (for mark attendance)
CREATE POLICY "Anon can mark attendance"
  ON attendance
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Allow authenticated users to insert their own attendance
CREATE POLICY "Users can mark own attendance"
  ON attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (admin_user_id = auth.uid());

-- Policy: Allow anon users to update attendance (for check out)
CREATE POLICY "Anon can update attendance"
  ON attendance
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Policy: Allow users to update their own attendance
CREATE POLICY "Users can update own attendance"
  ON attendance
  FOR UPDATE
  TO authenticated
  USING (admin_user_id = auth.uid())
  WITH CHECK (admin_user_id = auth.uid());

-- Policy: Allow admins to update any attendance
CREATE POLICY "Admins can update all attendance"
  ON attendance
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('Admin', 'Super Admin')
    )
  );

-- Policy: Allow admins to delete attendance
CREATE POLICY "Admins can delete attendance"
  ON attendance
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('Admin', 'Super Admin')
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_attendance_updated_at_trigger ON attendance;
CREATE TRIGGER update_attendance_updated_at_trigger
  BEFORE UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_updated_at();

-- Add comments
COMMENT ON TABLE attendance IS 'Stores employee attendance records with check-in/out times and selfies';
COMMENT ON COLUMN attendance.check_in_location IS 'GPS coordinates and address in JSON format: {lat, lng, address}';
COMMENT ON COLUMN attendance.status IS 'Attendance status: present, absent, late, half_day';

-- ============================================================================
-- MIGRATION 3: 20251016181148_update_attendance_rls_for_anon_read.sql
-- ============================================================================
/*
  # Update Attendance RLS for Anon Access

  1. Changes
    - Add policy to allow anon users to read all attendance records
    - This enables the attendance records table to display data

  2. Security
    - Read-only access for anon users
    - Write operations still controlled by existing policies
*/

-- Policy: Allow anon users to view all attendance
CREATE POLICY "Anon can view all attendance"
  ON attendance
  FOR SELECT
  TO anon
  USING (true);

-- ============================================================================
-- MIGRATION 4: 20251018172938_add_affiliate_triggers.sql
-- ============================================================================
/*
  # Add Affiliate Trigger Events

  1. Changes
    - Create database trigger functions for affiliate operations
    - Add triggers on affiliates table for INSERT, UPDATE, and DELETE operations
    - When an affiliate is added/updated/deleted, check for active workflows with corresponding triggers
    - Create workflow execution records for matching workflows
    - Send notification via pg_notify for async workflow processing

  2. New Trigger Events
    - AFFILIATE_ADDED: Triggers when a new affiliate is created
    - AFFILIATE_UPDATED: Triggers when an affiliate is updated
    - AFFILIATE_DELETED: Triggers when an affiliate is deleted

  3. Functionality
    - Triggers workflows based on affiliate operations
    - Passes all affiliate data to the workflow
    - For updates, includes both OLD and NEW values
    - For deletes, includes the deleted affiliate data
    - Supports multiple workflows being triggered by the same event

  4. Security
    - Uses existing RLS policies on workflow_executions table
    - No additional security configuration needed
*/

-- Create function to trigger workflows when a new affiliate is added
CREATE OR REPLACE FUNCTION trigger_workflows_on_affiliate_add()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
BEGIN
  -- Find all active automations with AFFILIATE_ADDED trigger
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
    
    -- Check if this is an AFFILIATE_ADDED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'AFFILIATE_ADDED' THEN
      
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
        'AFFILIATE_ADDED',
        jsonb_build_object(
          'id', NEW.id,
          'affiliate_id', NEW.affiliate_id,
          'name', NEW.name,
          'email', NEW.email,
          'phone', NEW.phone,
          'commission_pct', NEW.commission_pct,
          'unique_link', NEW.unique_link,
          'referrals', NEW.referrals,
          'earnings_paid', NEW.earnings_paid,
          'earnings_pending', NEW.earnings_pending,
          'status', NEW.status,
          'company', NEW.company,
          'address', NEW.address,
          'notes', NEW.notes,
          'joined_on', NEW.joined_on,
          'last_activity', NEW.last_activity,
          'created_at', NEW.created_at,
          'updated_at', NEW.updated_at
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
          'trigger_type', 'AFFILIATE_ADDED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to trigger workflows when an affiliate is updated
CREATE OR REPLACE FUNCTION trigger_workflows_on_affiliate_update()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
BEGIN
  -- Find all active automations with AFFILIATE_UPDATED trigger
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
    
    -- Check if this is an AFFILIATE_UPDATED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'AFFILIATE_UPDATED' THEN
      
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
        'AFFILIATE_UPDATED',
        jsonb_build_object(
          'id', NEW.id,
          'affiliate_id', NEW.affiliate_id,
          'name', NEW.name,
          'email', NEW.email,
          'phone', NEW.phone,
          'commission_pct', NEW.commission_pct,
          'unique_link', NEW.unique_link,
          'referrals', NEW.referrals,
          'earnings_paid', NEW.earnings_paid,
          'earnings_pending', NEW.earnings_pending,
          'status', NEW.status,
          'company', NEW.company,
          'address', NEW.address,
          'notes', NEW.notes,
          'joined_on', NEW.joined_on,
          'last_activity', NEW.last_activity,
          'created_at', NEW.created_at,
          'updated_at', NEW.updated_at,
          'previous', jsonb_build_object(
            'status', OLD.status,
            'commission_pct', OLD.commission_pct,
            'referrals', OLD.referrals,
            'earnings_paid', OLD.earnings_paid,
            'earnings_pending', OLD.earnings_pending,
            'notes', OLD.notes,
            'last_activity', OLD.last_activity
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
          'trigger_type', 'AFFILIATE_UPDATED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to trigger workflows when an affiliate is deleted
CREATE OR REPLACE FUNCTION trigger_workflows_on_affiliate_delete()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
BEGIN
  -- Find all active automations with AFFILIATE_DELETED trigger
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
    
    -- Check if this is an AFFILIATE_DELETED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'AFFILIATE_DELETED' THEN
      
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
        'AFFILIATE_DELETED',
        jsonb_build_object(
          'id', OLD.id,
          'affiliate_id', OLD.affiliate_id,
          'name', OLD.name,
          'email', OLD.email,
          'phone', OLD.phone,
          'commission_pct', OLD.commission_pct,
          'unique_link', OLD.unique_link,
          'referrals', OLD.referrals,
          'earnings_paid', OLD.earnings_paid,
          'earnings_pending', OLD.earnings_pending,
          'status', OLD.status,
          'company', OLD.company,
          'address', OLD.address,
          'notes', OLD.notes,
          'joined_on', OLD.joined_on,
          'last_activity', OLD.last_activity,
          'created_at', OLD.created_at,
          'updated_at', OLD.updated_at,
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
          'trigger_type', 'AFFILIATE_DELETED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on affiliates table for inserts
DROP TRIGGER IF EXISTS trigger_workflows_on_affiliate_add ON affiliates;
CREATE TRIGGER trigger_workflows_on_affiliate_add
  AFTER INSERT ON affiliates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_affiliate_add();

-- Create trigger on affiliates table for updates
DROP TRIGGER IF EXISTS trigger_workflows_on_affiliate_update ON affiliates;
CREATE TRIGGER trigger_workflows_on_affiliate_update
  AFTER UPDATE ON affiliates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_affiliate_update();

-- Create trigger on affiliates table for deletes
DROP TRIGGER IF EXISTS trigger_workflows_on_affiliate_delete ON affiliates;
CREATE TRIGGER trigger_workflows_on_affiliate_delete
  AFTER DELETE ON affiliates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_affiliate_delete();

-- Add comments
COMMENT ON FUNCTION trigger_workflows_on_affiliate_add() IS 'Triggers workflows when a new affiliate is added';
COMMENT ON FUNCTION trigger_workflows_on_affiliate_update() IS 'Triggers workflows when an affiliate is updated';
COMMENT ON FUNCTION trigger_workflows_on_affiliate_delete() IS 'Triggers workflows when an affiliate is deleted';

-- ============================================================================
-- MIGRATION 5: 20251018183139_update_affiliate_triggers_for_api_webhooks.sql
-- ============================================================================
/*
  # Update Affiliate Triggers to Send Data to API Webhooks

  1. Changes
    - Update affiliate trigger functions to also send data to configured API webhooks
    - API webhooks receive all trigger data as JSON POST request
    - Track success/failure statistics for each webhook
    - Supports AFFILIATE_ADDED, AFFILIATE_UPDATED, and AFFILIATE_DELETED events

  2. Important Notes
    - API webhooks are simpler than workflow automations
    - They send ALL trigger data automatically, no field mapping needed
    - Multiple webhooks can be configured for the same trigger event
*/

-- Update trigger function for affiliate inserts
CREATE OR REPLACE FUNCTION trigger_workflows_on_affiliate_add()
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
    'affiliate_id', NEW.affiliate_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'commission_pct', NEW.commission_pct,
    'unique_link', NEW.unique_link,
    'referrals', NEW.referrals,
    'earnings_paid', NEW.earnings_paid,
    'earnings_pending', NEW.earnings_pending,
    'status', NEW.status,
    'company', NEW.company,
    'address', NEW.address,
    'notes', NEW.notes,
    'joined_on', NEW.joined_on,
    'last_activity', NEW.last_activity,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'AFFILIATE_ADDED'
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
    
    -- Check if this is an AFFILIATE_ADDED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'AFFILIATE_ADDED' THEN
      
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
        'AFFILIATE_ADDED',
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
          'trigger_type', 'AFFILIATE_ADDED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update trigger function for affiliate updates
CREATE OR REPLACE FUNCTION trigger_workflows_on_affiliate_update()
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
    'affiliate_id', NEW.affiliate_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'commission_pct', NEW.commission_pct,
    'unique_link', NEW.unique_link,
    'referrals', NEW.referrals,
    'earnings_paid', NEW.earnings_paid,
    'earnings_pending', NEW.earnings_pending,
    'status', NEW.status,
    'company', NEW.company,
    'address', NEW.address,
    'notes', NEW.notes,
    'joined_on', NEW.joined_on,
    'last_activity', NEW.last_activity,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'previous', jsonb_build_object(
      'status', OLD.status,
      'commission_pct', OLD.commission_pct,
      'referrals', OLD.referrals,
      'earnings_paid', OLD.earnings_paid,
      'earnings_pending', OLD.earnings_pending,
      'notes', OLD.notes,
      'last_activity', OLD.last_activity
    )
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'AFFILIATE_UPDATED'
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
    
    -- Check if this is an AFFILIATE_UPDATED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'AFFILIATE_UPDATED' THEN
      
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
        'AFFILIATE_UPDATED',
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
          'trigger_type', 'AFFILIATE_UPDATED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update trigger function for affiliate deletes
CREATE OR REPLACE FUNCTION trigger_workflows_on_affiliate_delete()
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
    'affiliate_id', OLD.affiliate_id,
    'name', OLD.name,
    'email', OLD.email,
    'phone', OLD.phone,
    'commission_pct', OLD.commission_pct,
    'unique_link', OLD.unique_link,
    'referrals', OLD.referrals,
    'earnings_paid', OLD.earnings_paid,
    'earnings_pending', OLD.earnings_pending,
    'status', OLD.status,
    'company', OLD.company,
    'address', OLD.address,
    'notes', OLD.notes,
    'joined_on', OLD.joined_on,
    'last_activity', OLD.last_activity,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'deleted_at', now()
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'AFFILIATE_DELETED'
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
    
    -- Check if this is an AFFILIATE_DELETED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'AFFILIATE_DELETED' THEN
      
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
        'AFFILIATE_DELETED',
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
          'trigger_type', 'AFFILIATE_DELETED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Update comments
COMMENT ON FUNCTION trigger_workflows_on_affiliate_add() IS 'Triggers both API webhooks and workflow automations when a new affiliate is added';
COMMENT ON FUNCTION trigger_workflows_on_affiliate_update() IS 'Triggers both API webhooks and workflow automations when an affiliate is updated';
COMMENT ON FUNCTION trigger_workflows_on_affiliate_delete() IS 'Triggers both API webhooks and workflow automations when an affiliate is deleted';

-- ============================================================================
-- MIGRATION 6: 20251018184329_add_trigger_event_to_all_webhook_payloads.sql
-- ============================================================================
/*
  # Add Trigger Event Name to All Webhook Payloads

  1. Changes
    - Update all trigger functions to include 'trigger_event' field in webhook payload
    - This allows webhook receivers to identify which event triggered the webhook
    - Applies to: Leads (add/update/delete), Affiliates (add/update/delete), Support Tickets (add/update/delete)

  2. Trigger Events Included
    - NEW_LEAD_ADDED
    - LEAD_UPDATED
    - LEAD_DELETED
    - AFFILIATE_ADDED
    - AFFILIATE_UPDATED
    - AFFILIATE_DELETED
    - TICKET_CREATED
    - TICKET_UPDATED
    - TICKET_DELETED
*/

-- Update LEAD INSERT trigger
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
  -- Build trigger data with trigger_event
  trigger_data := jsonb_build_object(
    'trigger_event', 'NEW_LEAD_ADDED',
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
      
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
        UPDATE api_webhooks
        SET 
          total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
        WHERE id = api_webhook_record.id;
        
        RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  -- Process Workflow Automations (existing logic unchanged)
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
       AND trigger_node->'properties'->>'event_name' = 'NEW_LEAD_ADDED' THEN
      
      v_total_steps := jsonb_array_length(automation_record.workflow_nodes) - 1;
      v_steps_completed := 0;
      
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
      
      BEGIN
        i := 1;
        WHILE i < jsonb_array_length(automation_record.workflow_nodes) LOOP
          action_node := automation_record.workflow_nodes->i;
          
          IF action_node->>'type' = 'action' 
             AND action_node->'properties'->>'action_type' = 'webhook' THEN
            
            webhook_config := action_node->'properties'->'webhook_config';
            
            IF webhook_config->>'webhook_url' IS NOT NULL THEN
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
        
        UPDATE workflow_executions
        SET 
          status = 'completed',
          steps_completed = v_steps_completed,
          completed_at = now()
        WHERE workflow_executions.id = execution_id;
        
        UPDATE automations
        SET 
          total_runs = COALESCE(automations.total_runs, 0) + 1,
          last_run = now()
        WHERE automations.id = automation_record.id;
        
      EXCEPTION
        WHEN OTHERS THEN
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

-- Update LEAD UPDATE trigger
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
  -- Build trigger data with trigger_event
  trigger_data := jsonb_build_object(
    'trigger_event', 'LEAD_UPDATED',
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

  -- Process API Webhooks
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'LEAD_UPDATED'
      AND is_active = true
  LOOP
    BEGIN
      webhook_success := false;
      
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
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

-- Update LEAD DELETE trigger
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
  -- Build trigger data with trigger_event
  trigger_data := jsonb_build_object(
    'trigger_event', 'LEAD_DELETED',
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

  -- Process API Webhooks
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'LEAD_DELETED'
      AND is_active = true
  LOOP
    BEGIN
      webhook_success := false;
      
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
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

-- Update AFFILIATE ADD trigger
CREATE OR REPLACE FUNCTION trigger_workflows_on_affiliate_add()
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
    'trigger_event', 'AFFILIATE_ADDED',
    'id', NEW.id,
    'affiliate_id', NEW.affiliate_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'commission_pct', NEW.commission_pct,
    'unique_link', NEW.unique_link,
    'referrals', NEW.referrals,
    'earnings_paid', NEW.earnings_paid,
    'earnings_pending', NEW.earnings_pending,
    'status', NEW.status,
    'company', NEW.company,
    'address', NEW.address,
    'notes', NEW.notes,
    'joined_on', NEW.joined_on,
    'last_activity', NEW.last_activity,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  -- Process API Webhooks
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'AFFILIATE_ADDED'
      AND is_active = true
  LOOP
    BEGIN
      webhook_success := false;
      
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
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
       AND trigger_node->'properties'->>'event_name' = 'AFFILIATE_ADDED' THEN
      
      INSERT INTO workflow_executions (
        automation_id,
        trigger_type,
        trigger_data,
        status,
        total_steps,
        started_at
      ) VALUES (
        automation_record.id,
        'AFFILIATE_ADDED',
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
          'trigger_type', 'AFFILIATE_ADDED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update AFFILIATE UPDATE trigger
CREATE OR REPLACE FUNCTION trigger_workflows_on_affiliate_update()
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
    'trigger_event', 'AFFILIATE_UPDATED',
    'id', NEW.id,
    'affiliate_id', NEW.affiliate_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'commission_pct', NEW.commission_pct,
    'unique_link', NEW.unique_link,
    'referrals', NEW.referrals,
    'earnings_paid', NEW.earnings_paid,
    'earnings_pending', NEW.earnings_pending,
    'status', NEW.status,
    'company', NEW.company,
    'address', NEW.address,
    'notes', NEW.notes,
    'joined_on', NEW.joined_on,
    'last_activity', NEW.last_activity,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'previous', jsonb_build_object(
      'status', OLD.status,
      'commission_pct', OLD.commission_pct,
      'referrals', OLD.referrals,
      'earnings_paid', OLD.earnings_paid,
      'earnings_pending', OLD.earnings_pending,
      'notes', OLD.notes,
      'last_activity', OLD.last_activity
    )
  );

  -- Process API Webhooks
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'AFFILIATE_UPDATED'
      AND is_active = true
  LOOP
    BEGIN
      webhook_success := false;
      
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
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
       AND trigger_node->'properties'->>'event_name' = 'AFFILIATE_UPDATED' THEN
      
      INSERT INTO workflow_executions (
        automation_id,
        trigger_type,
        trigger_data,
        status,
        total_steps,
        started_at
      ) VALUES (
        automation_record.id,
        'AFFILIATE_UPDATED',
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
          'trigger_type', 'AFFILIATE_UPDATED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update AFFILIATE DELETE trigger
CREATE OR REPLACE FUNCTION trigger_workflows_on_affiliate_delete()
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
    'trigger_event', 'AFFILIATE_DELETED',
    'id', OLD.id,
    'affiliate_id', OLD.affiliate_id,
    'name', OLD.name,
    'email', OLD.email,
    'phone', OLD.phone,
    'commission_pct', OLD.commission_pct,
    'unique_link', OLD.unique_link,
    'referrals', OLD.referrals,
    'earnings_paid', OLD.earnings_paid,
    'earnings_pending', OLD.earnings_pending,
    'status', OLD.status,
    'company', OLD.company,
    'address', OLD.address,
    'notes', OLD.notes,
    'joined_on', OLD.joined_on,
    'last_activity', OLD.last_activity,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'deleted_at', now()
  );

  -- Process API Webhooks
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'AFFILIATE_DELETED'
      AND is_active = true
  LOOP
    BEGIN
      webhook_success := false;
      
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
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
       AND trigger_node->'properties'->>'event_name' = 'AFFILIATE_DELETED' THEN
      
      INSERT INTO workflow_executions (
        automation_id,
        trigger_type,
        trigger_data,
        status,
        total_steps,
        started_at
      ) VALUES (
        automation_record.id,
        'AFFILIATE_DELETED',
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
          'trigger_type', 'AFFILIATE_DELETED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Update comments
COMMENT ON FUNCTION trigger_workflows_on_lead_insert() IS 'Triggers both API webhooks and workflow automations when a new lead is inserted. Includes trigger_event in payload.';
COMMENT ON FUNCTION trigger_workflows_on_lead_update() IS 'Triggers both API webhooks and workflow automations when a lead is updated. Includes trigger_event in payload.';
COMMENT ON FUNCTION trigger_workflows_on_lead_delete() IS 'Triggers both API webhooks and workflow automations when a lead is deleted. Includes trigger_event in payload.';
COMMENT ON FUNCTION trigger_workflows_on_affiliate_add() IS 'Triggers both API webhooks and workflow automations when a new affiliate is added. Includes trigger_event in payload.';
COMMENT ON FUNCTION trigger_workflows_on_affiliate_update() IS 'Triggers both API webhooks and workflow automations when an affiliate is updated. Includes trigger_event in payload.';
COMMENT ON FUNCTION trigger_workflows_on_affiliate_delete() IS 'Triggers both API webhooks and workflow automations when an affiliate is deleted. Includes trigger_event in payload.';

-- ============================================================================
-- MIGRATION 7: 20251018184416_add_trigger_event_to_support_ticket_webhooks.sql
-- ============================================================================
/*
  # Add Trigger Event Name to Support Ticket Webhook Payloads

  1. Changes
    - Update support ticket trigger functions to include 'trigger_event' field in webhook payload
    - This allows webhook receivers to identify which event triggered the webhook
    - Applies to: TICKET_CREATED, TICKET_UPDATED, TICKET_DELETED
*/

-- Update TICKET_CREATED trigger
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
  -- Build trigger data with trigger_event
  trigger_data := jsonb_build_object(
    'trigger_event', 'TICKET_CREATED',
    'id', NEW.id,
    'ticket_id', NEW.ticket_id,
    'enrolled_member_id', NEW.enrolled_member_id,
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
      
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
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

-- Update TICKET_UPDATED trigger
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
  -- Build trigger data with trigger_event
  trigger_data := jsonb_build_object(
    'trigger_event', 'TICKET_UPDATED',
    'id', NEW.id,
    'ticket_id', NEW.ticket_id,
    'enrolled_member_id', NEW.enrolled_member_id,
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
      
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
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

-- Update TICKET_DELETED trigger
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
  -- Build trigger data with trigger_event
  trigger_data := jsonb_build_object(
    'trigger_event', 'TICKET_DELETED',
    'id', OLD.id,
    'ticket_id', OLD.ticket_id,
    'enrolled_member_id', OLD.enrolled_member_id,
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
      
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
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

-- Update comments
COMMENT ON FUNCTION trigger_workflows_on_ticket_insert() IS 'Triggers both API webhooks and workflow automations when a support ticket is created. Includes trigger_event in payload.';
COMMENT ON FUNCTION trigger_workflows_on_ticket_update() IS 'Triggers both API webhooks and workflow automations when a support ticket is updated. Includes trigger_event in payload.';
COMMENT ON FUNCTION trigger_workflows_on_ticket_delete() IS 'Triggers both API webhooks and workflow automations when a support ticket is deleted. Includes trigger_event in payload.';

-- ============================================================================
-- MIGRATION 8: 20251018190601_create_enrolled_member_triggers.sql
-- ============================================================================
/*
  # Create Enrolled Member Trigger Events

  1. Changes
    - Create database trigger functions for enrolled member operations
    - Add triggers on enrolled_members table for INSERT, UPDATE, and DELETE operations
    - When a member is added/updated/deleted, check for active API webhooks
    - Send notification to configured webhook URLs
    - Track webhook statistics (total_calls, success_count, failure_count)

  2. New Trigger Events
    - MEMBER_ADDED: Triggers when a new enrolled member is created
    - MEMBER_UPDATED: Triggers when an enrolled member is updated
    - MEMBER_DELETED: Triggers when an enrolled member is deleted

  3. Functionality
    - Triggers both API webhooks and workflow automations based on member operations
    - Passes all enrolled member data to webhooks and workflows
    - For updates, includes both NEW and previous values
    - For deletes, includes the deleted member data with deleted_at timestamp
    - Supports multiple webhooks being triggered by the same event
    - Includes 'trigger_event' field in payload for easy event identification

  4. Security
    - Uses existing RLS policies on api_webhooks and workflow_executions tables
    - SECURITY DEFINER ensures triggers have permission to update statistics
*/

-- Create function to trigger workflows when a new enrolled member is added
CREATE OR REPLACE FUNCTION trigger_workflows_on_member_add()
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
    'trigger_event', 'MEMBER_ADDED',
    'id', NEW.id,
    'user_id', NEW.user_id,
    'email', NEW.email,
    'full_name', NEW.full_name,
    'phone', NEW.phone,
    'enrollment_date', NEW.enrollment_date,
    'status', NEW.status,
    'course_id', NEW.course_id,
    'course_name', NEW.course_name,
    'payment_status', NEW.payment_status,
    'payment_amount', NEW.payment_amount,
    'payment_date', NEW.payment_date,
    'subscription_type', NEW.subscription_type,
    'last_activity', NEW.last_activity,
    'progress_percentage', NEW.progress_percentage,
    'notes', NEW.notes,
    'date_of_birth', NEW.date_of_birth,
    'gender', NEW.gender,
    'education_level', NEW.education_level,
    'profession', NEW.profession,
    'experience', NEW.experience,
    'business_name', NEW.business_name,
    'address', NEW.address,
    'city', NEW.city,
    'state', NEW.state,
    'pincode', NEW.pincode,
    'gst_number', NEW.gst_number,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'MEMBER_ADDED'
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
    
    -- Check if this is a MEMBER_ADDED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'MEMBER_ADDED' THEN
      
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
        'MEMBER_ADDED',
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
          'trigger_type', 'MEMBER_ADDED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to trigger workflows when an enrolled member is updated
CREATE OR REPLACE FUNCTION trigger_workflows_on_member_update()
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
    'trigger_event', 'MEMBER_UPDATED',
    'id', NEW.id,
    'user_id', NEW.user_id,
    'email', NEW.email,
    'full_name', NEW.full_name,
    'phone', NEW.phone,
    'enrollment_date', NEW.enrollment_date,
    'status', NEW.status,
    'course_id', NEW.course_id,
    'course_name', NEW.course_name,
    'payment_status', NEW.payment_status,
    'payment_amount', NEW.payment_amount,
    'payment_date', NEW.payment_date,
    'subscription_type', NEW.subscription_type,
    'last_activity', NEW.last_activity,
    'progress_percentage', NEW.progress_percentage,
    'notes', NEW.notes,
    'date_of_birth', NEW.date_of_birth,
    'gender', NEW.gender,
    'education_level', NEW.education_level,
    'profession', NEW.profession,
    'experience', NEW.experience,
    'business_name', NEW.business_name,
    'address', NEW.address,
    'city', NEW.city,
    'state', NEW.state,
    'pincode', NEW.pincode,
    'gst_number', NEW.gst_number,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'previous', jsonb_build_object(
      'status', OLD.status,
      'payment_status', OLD.payment_status,
      'payment_amount', OLD.payment_amount,
      'subscription_type', OLD.subscription_type,
      'progress_percentage', OLD.progress_percentage,
      'last_activity', OLD.last_activity,
      'notes', OLD.notes
    )
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'MEMBER_UPDATED'
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
    
    -- Check if this is a MEMBER_UPDATED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'MEMBER_UPDATED' THEN
      
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
        'MEMBER_UPDATED',
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
          'trigger_type', 'MEMBER_UPDATED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to trigger workflows when an enrolled member is deleted
CREATE OR REPLACE FUNCTION trigger_workflows_on_member_delete()
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
    'trigger_event', 'MEMBER_DELETED',
    'id', OLD.id,
    'user_id', OLD.user_id,
    'email', OLD.email,
    'full_name', OLD.full_name,
    'phone', OLD.phone,
    'enrollment_date', OLD.enrollment_date,
    'status', OLD.status,
    'course_id', OLD.course_id,
    'course_name', OLD.course_name,
    'payment_status', OLD.payment_status,
    'payment_amount', OLD.payment_amount,
    'payment_date', OLD.payment_date,
    'subscription_type', OLD.subscription_type,
    'last_activity', OLD.last_activity,
    'progress_percentage', OLD.progress_percentage,
    'notes', OLD.notes,
    'date_of_birth', OLD.date_of_birth,
    'gender', OLD.gender,
    'education_level', OLD.education_level,
    'profession', OLD.profession,
    'experience', OLD.experience,
    'business_name', OLD.business_name,
    'address', OLD.address,
    'city', OLD.city,
    'state', OLD.state,
    'pincode', OLD.pincode,
    'gst_number', OLD.gst_number,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'deleted_at', now()
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'MEMBER_DELETED'
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
    
    -- Check if this is a MEMBER_DELETED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'MEMBER_DELETED' THEN
      
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
        'MEMBER_DELETED',
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
          'trigger_type', 'MEMBER_DELETED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on enrolled_members table for inserts
DROP TRIGGER IF EXISTS trigger_workflows_on_member_add ON enrolled_members;
CREATE TRIGGER trigger_workflows_on_member_add
  AFTER INSERT ON enrolled_members
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_member_add();

-- Create trigger on enrolled_members table for updates
DROP TRIGGER IF EXISTS trigger_workflows_on_member_update ON enrolled_members;
CREATE TRIGGER trigger_workflows_on_member_update
  AFTER UPDATE ON enrolled_members
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_member_update();

-- Create trigger on enrolled_members table for deletes
DROP TRIGGER IF EXISTS trigger_workflows_on_member_delete ON enrolled_members;
CREATE TRIGGER trigger_workflows_on_member_delete
  AFTER DELETE ON enrolled_members
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_member_delete();

-- Add comments
COMMENT ON FUNCTION trigger_workflows_on_member_add() IS 'Triggers both API webhooks and workflow automations when a new enrolled member is added. Includes trigger_event in payload.';
COMMENT ON FUNCTION trigger_workflows_on_member_update() IS 'Triggers both API webhooks and workflow automations when an enrolled member is updated. Includes trigger_event in payload.';
COMMENT ON FUNCTION trigger_workflows_on_member_delete() IS 'Triggers both API webhooks and workflow automations when an enrolled member is deleted. Includes trigger_event in payload.';

-- ============================================================================
-- MIGRATION 9: 20251018192404_create_team_user_triggers.sql
-- ============================================================================
/*
  # Create Team User Trigger Events

  1. Changes
    - Create database trigger functions for team member (admin_users) operations
    - Add triggers on admin_users table for INSERT, UPDATE, and DELETE operations
    - When a team member is added/updated/deleted, check for active API webhooks
    - Send notification to configured webhook URLs
    - Track webhook statistics (total_calls, success_count, failure_count)

  2. New Trigger Events
    - USER_ADDED: Triggers when a new team member is created
    - USER_UPDATED: Triggers when a team member is updated
    - USER_DELETED: Triggers when a team member is deleted

  3. Functionality
    - Triggers both API webhooks and workflow automations based on team member operations
    - Passes all team member data to webhooks and workflows (excluding password_hash for security)
    - For updates, includes both NEW and previous values
    - For deletes, includes the deleted team member data with deleted_at timestamp
    - Supports multiple webhooks being triggered by the same event
    - Includes 'trigger_event' field in payload for easy event identification

  4. Security
    - Password hash is NEVER included in webhook payloads
    - Uses existing RLS policies on api_webhooks and workflow_executions tables
    - SECURITY DEFINER ensures triggers have permission to update statistics
*/

-- Create function to trigger workflows when a new team member is added
CREATE OR REPLACE FUNCTION trigger_workflows_on_user_add()
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
  -- Build trigger data with trigger_event (excluding password_hash for security)
  trigger_data := jsonb_build_object(
    'trigger_event', 'USER_ADDED',
    'id', NEW.id,
    'email', NEW.email,
    'full_name', NEW.full_name,
    'role', NEW.role,
    'permissions', NEW.permissions,
    'is_active', NEW.is_active,
    'phone', NEW.phone,
    'department', NEW.department,
    'status', NEW.status,
    'member_id', NEW.member_id,
    'last_login', NEW.last_login,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'USER_ADDED'
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
    
    -- Check if this is a USER_ADDED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'USER_ADDED' THEN
      
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
        'USER_ADDED',
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
          'trigger_type', 'USER_ADDED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to trigger workflows when a team member is updated
CREATE OR REPLACE FUNCTION trigger_workflows_on_user_update()
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
  -- Build trigger data with trigger_event and previous values (excluding password_hash for security)
  trigger_data := jsonb_build_object(
    'trigger_event', 'USER_UPDATED',
    'id', NEW.id,
    'email', NEW.email,
    'full_name', NEW.full_name,
    'role', NEW.role,
    'permissions', NEW.permissions,
    'is_active', NEW.is_active,
    'phone', NEW.phone,
    'department', NEW.department,
    'status', NEW.status,
    'member_id', NEW.member_id,
    'last_login', NEW.last_login,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'previous', jsonb_build_object(
      'email', OLD.email,
      'full_name', OLD.full_name,
      'role', OLD.role,
      'permissions', OLD.permissions,
      'is_active', OLD.is_active,
      'phone', OLD.phone,
      'department', OLD.department,
      'status', OLD.status,
      'member_id', OLD.member_id
    )
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'USER_UPDATED'
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
    
    -- Check if this is a USER_UPDATED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'USER_UPDATED' THEN
      
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
        'USER_UPDATED',
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
          'trigger_type', 'USER_UPDATED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to trigger workflows when a team member is deleted
CREATE OR REPLACE FUNCTION trigger_workflows_on_user_delete()
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
  -- Build trigger data with trigger_event (excluding password_hash for security)
  trigger_data := jsonb_build_object(
    'trigger_event', 'USER_DELETED',
    'id', OLD.id,
    'email', OLD.email,
    'full_name', OLD.full_name,
    'role', OLD.role,
    'permissions', OLD.permissions,
    'is_active', OLD.is_active,
    'phone', OLD.phone,
    'department', OLD.department,
    'status', OLD.status,
    'member_id', OLD.member_id,
    'last_login', OLD.last_login,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'deleted_at', now()
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'USER_DELETED'
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
    
    -- Check if this is a USER_DELETED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'USER_DELETED' THEN
      
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
        'USER_DELETED',
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
          'trigger_type', 'USER_DELETED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on admin_users table for inserts
DROP TRIGGER IF EXISTS trigger_workflows_on_user_add ON admin_users;
CREATE TRIGGER trigger_workflows_on_user_add
  AFTER INSERT ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_user_add();

-- Create trigger on admin_users table for updates
DROP TRIGGER IF EXISTS trigger_workflows_on_user_update ON admin_users;
CREATE TRIGGER trigger_workflows_on_user_update
  AFTER UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_user_update();

-- Create trigger on admin_users table for deletes
DROP TRIGGER IF EXISTS trigger_workflows_on_user_delete ON admin_users;
CREATE TRIGGER trigger_workflows_on_user_delete
  AFTER DELETE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_user_delete();

-- Add comments
COMMENT ON FUNCTION trigger_workflows_on_user_add() IS 'Triggers both API webhooks and workflow automations when a new team member is added. Includes trigger_event in payload. Password hash excluded for security.';
COMMENT ON FUNCTION trigger_workflows_on_user_update() IS 'Triggers both API webhooks and workflow automations when a team member is updated. Includes trigger_event in payload. Password hash excluded for security.';
COMMENT ON FUNCTION trigger_workflows_on_user_delete() IS 'Triggers both API webhooks and workflow automations when a team member is deleted. Includes trigger_event in payload. Password hash excluded for security.';

-- ============================================================================
-- MIGRATION 10: 20251018194556_create_attendance_triggers.sql
-- ============================================================================
/*
  # Create Attendance Trigger Events

  1. Changes
    - Create database trigger functions for attendance operations
    - Add triggers on attendance table for INSERT and UPDATE operations
    - When a check-in occurs (INSERT), trigger ATTENDANCE_CHECKIN event
    - When a check-out occurs (UPDATE with check_out_time), trigger ATTENDANCE_CHECKOUT event
    - Send notifications to configured webhook URLs
    - Track webhook statistics (total_calls, success_count, failure_count)

  2. New Trigger Events
    - ATTENDANCE_CHECKIN: Triggers when an employee checks in (attendance record created)
    - ATTENDANCE_CHECKOUT: Triggers when an employee checks out (check_out_time updated)

  3. Functionality
    - Triggers both API webhooks and workflow automations based on attendance operations
    - Passes all attendance data to webhooks and workflows
    - For check-out, includes both current and check-in time data
    - Supports multiple webhooks being triggered by the same event
    - Includes 'trigger_event' field in payload for easy event identification

  4. Security
    - Uses existing RLS policies on api_webhooks and workflow_executions tables
    - SECURITY DEFINER ensures triggers have permission to update statistics
*/

-- Create function to trigger workflows when check-in occurs
CREATE OR REPLACE FUNCTION trigger_workflows_on_attendance_checkin()
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
  -- Build trigger data with trigger_event for check-in
  trigger_data := jsonb_build_object(
    'trigger_event', 'ATTENDANCE_CHECKIN',
    'id', NEW.id,
    'admin_user_id', NEW.admin_user_id,
    'date', NEW.date,
    'check_in_time', NEW.check_in_time,
    'check_in_selfie_url', NEW.check_in_selfie_url,
    'check_in_location', NEW.check_in_location,
    'status', NEW.status,
    'notes', NEW.notes,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'ATTENDANCE_CHECKIN'
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
    
    -- Check if this is an ATTENDANCE_CHECKIN trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'ATTENDANCE_CHECKIN' THEN
      
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
        'ATTENDANCE_CHECKIN',
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
          'trigger_type', 'ATTENDANCE_CHECKIN'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to trigger workflows when check-out occurs
CREATE OR REPLACE FUNCTION trigger_workflows_on_attendance_checkout()
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
  -- Only trigger if check_out_time was just set (was NULL and now has a value)
  IF OLD.check_out_time IS NULL AND NEW.check_out_time IS NOT NULL THEN
    -- Build trigger data with trigger_event for check-out
    trigger_data := jsonb_build_object(
      'trigger_event', 'ATTENDANCE_CHECKOUT',
      'id', NEW.id,
      'admin_user_id', NEW.admin_user_id,
      'date', NEW.date,
      'check_in_time', NEW.check_in_time,
      'check_out_time', NEW.check_out_time,
      'check_in_selfie_url', NEW.check_in_selfie_url,
      'check_in_location', NEW.check_in_location,
      'status', NEW.status,
      'notes', NEW.notes,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    );

    -- Process API Webhooks first
    FOR api_webhook_record IN
      SELECT *
      FROM api_webhooks
      WHERE trigger_event = 'ATTENDANCE_CHECKOUT'
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
      
      -- Check if this is an ATTENDANCE_CHECKOUT trigger
      IF trigger_node->>'type' = 'trigger' 
         AND trigger_node->'properties'->>'event_name' = 'ATTENDANCE_CHECKOUT' THEN
        
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
          'ATTENDANCE_CHECKOUT',
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
            'trigger_type', 'ATTENDANCE_CHECKOUT'
          )::text
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on attendance table for inserts (check-in)
DROP TRIGGER IF EXISTS trigger_workflows_on_attendance_checkin ON attendance;
CREATE TRIGGER trigger_workflows_on_attendance_checkin
  AFTER INSERT ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_attendance_checkin();

-- Create trigger on attendance table for updates (check-out)
DROP TRIGGER IF EXISTS trigger_workflows_on_attendance_checkout ON attendance;
CREATE TRIGGER trigger_workflows_on_attendance_checkout
  AFTER UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_attendance_checkout();

-- Add comments
COMMENT ON FUNCTION trigger_workflows_on_attendance_checkin() IS 'Triggers both API webhooks and workflow automations when an employee checks in. Includes trigger_event in payload.';
COMMENT ON FUNCTION trigger_workflows_on_attendance_checkout() IS 'Triggers both API webhooks and workflow automations when an employee checks out. Includes trigger_event in payload.';

/*
================================================================================
END OF GROUP 5: SUPPORT AND ATTENDANCE SYSTEMS
================================================================================
Next Group: group-06-products,-expenses,-and-leave-management.sql
*/
