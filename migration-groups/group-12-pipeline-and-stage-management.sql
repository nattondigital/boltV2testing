/*
================================================================================
GROUP 12: PIPELINE AND STAGE MANAGEMENT
================================================================================

Rename status to stage, create pipelines, and update related triggers

Total Files: 13
Dependencies: Group 11

Files Included (in execution order):
1. 20251023150000_rename_status_to_stage_in_leads.sql
2. 20251023150001_update_lead_triggers_for_stage_rename.sql
3. 20251023194149_rename_status_to_stage_in_leads.sql
4. 20251023194213_update_lead_triggers_for_stage_rename.sql
5. 20251023200000_create_pipelines_tables.sql
6. 20251023200356_create_pipelines_tables.sql
7. 20251023202734_fix_lead_triggers.sql
8. 20251023202857_fix_workflow_triggers_for_stage.sql
9. 20251023210000_add_pipeline_to_leads.sql
10. 20251023210001_fix_lead_triggers.sql
11. 20251023210002_fix_workflow_triggers_for_stage.sql
12. 20251023212628_add_lead_update_sync_to_contact.sql
13. 20251023213631_add_auto_generate_lead_id_trigger.sql

================================================================================
*/

-- ============================================================================
-- MIGRATION 1: 20251023150000_rename_status_to_stage_in_leads.sql
-- ============================================================================
/*
  # Rename status column to stage in leads table

  1. Changes
    - Rename the `status` column to `stage` in the `leads` table
    - Update the index name from `idx_leads_status` to `idx_leads_stage`
    - Update any triggers or functions that reference the old column name

  2. Notes
    - This is a schema-only change and does not affect existing data
    - The column's default value and constraints remain unchanged
    - All existing lead records will retain their current status values under the new "stage" name
*/

-- Rename the status column to stage
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'status'
  ) THEN
    ALTER TABLE leads RENAME COLUMN status TO stage;
  END IF;
END $$;

-- Drop old index if it exists and create new one with updated name
DROP INDEX IF EXISTS idx_leads_status;
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);

-- ============================================================================
-- MIGRATION 2: 20251023150001_update_lead_triggers_for_stage_rename.sql
-- ============================================================================
/*
  # Update lead triggers to use stage instead of status

  1. Changes
    - Update lead insert/update/delete triggers to reference `stage` column instead of `status`
    - This migration updates webhook trigger functions that send lead data to external systems

  2. Notes
    - This must run after the column rename migration
    - Updates all trigger functions that reference the old status field
*/

-- Drop existing lead triggers
DROP TRIGGER IF EXISTS lead_insert_trigger ON leads;
DROP TRIGGER IF EXISTS lead_update_trigger ON leads;
DROP TRIGGER IF EXISTS lead_delete_trigger ON leads;

-- Drop existing trigger functions
DROP FUNCTION IF EXISTS notify_lead_insert();
DROP FUNCTION IF EXISTS notify_lead_update();
DROP FUNCTION IF EXISTS notify_lead_delete();

-- Recreate lead insert trigger function with stage field
CREATE OR REPLACE FUNCTION notify_lead_insert()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
  api_webhook_record RECORD;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'lead.created',
    'id', NEW.id,
    'lead_id', NEW.lead_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'source', NEW.source,
    'interest', NEW.interest,
    'stage', NEW.stage,
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

  FOR api_webhook_record IN
    SELECT url, headers, secret
    FROM api_webhooks
    WHERE is_active = true
      AND event_type = 'lead.created'
  LOOP
    INSERT INTO webhooks (event, payload, url, headers, secret)
    VALUES ('lead.created', trigger_data, api_webhook_record.url, api_webhook_record.headers, api_webhook_record.secret);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate lead update trigger function with stage field
CREATE OR REPLACE FUNCTION notify_lead_update()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
  api_webhook_record RECORD;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'lead.updated',
    'id', NEW.id,
    'lead_id', NEW.lead_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'source', NEW.source,
    'interest', NEW.interest,
    'stage', NEW.stage,
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
      'stage', OLD.stage,
      'interest', OLD.interest,
      'owner', OLD.owner,
      'notes', OLD.notes,
      'last_contact', OLD.last_contact,
      'lead_score', OLD.lead_score
    )
  );

  FOR api_webhook_record IN
    SELECT url, headers, secret
    FROM api_webhooks
    WHERE is_active = true
      AND event_type = 'lead.updated'
  LOOP
    INSERT INTO webhooks (event, payload, url, headers, secret)
    VALUES ('lead.updated', trigger_data, api_webhook_record.url, api_webhook_record.headers, api_webhook_record.secret);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate lead delete trigger function with stage field
CREATE OR REPLACE FUNCTION notify_lead_delete()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
  api_webhook_record RECORD;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'lead.deleted',
    'id', OLD.id,
    'lead_id', OLD.lead_id,
    'name', OLD.name,
    'email', OLD.email,
    'phone', OLD.phone,
    'source', OLD.source,
    'interest', OLD.interest,
    'stage', OLD.stage,
    'owner', OLD.owner,
    'address', OLD.address,
    'company', OLD.company,
    'notes', OLD.notes,
    'last_contact', OLD.last_contact,
    'lead_score', OLD.lead_score,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'affiliate_id', OLD.affiliate_id
  );

  FOR api_webhook_record IN
    SELECT url, headers, secret
    FROM api_webhooks
    WHERE is_active = true
      AND event_type = 'lead.deleted'
  LOOP
    INSERT INTO webhooks (event, payload, url, headers, secret)
    VALUES ('lead.deleted', trigger_data, api_webhook_record.url, api_webhook_record.headers, api_webhook_record.secret);
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
CREATE TRIGGER lead_insert_trigger
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_insert();

CREATE TRIGGER lead_update_trigger
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_update();

CREATE TRIGGER lead_delete_trigger
  AFTER DELETE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_delete();

-- ============================================================================
-- MIGRATION 3: 20251023194149_rename_status_to_stage_in_leads.sql
-- ============================================================================
/*
  # Rename status column to stage in leads table

  1. Changes
    - Rename the `status` column to `stage` in the `leads` table
    - Update the index name from `idx_leads_status` to `idx_leads_stage`
    - Update any triggers or functions that reference the old column name

  2. Notes
    - This is a schema-only change and does not affect existing data
    - The column's default value and constraints remain unchanged
    - All existing lead records will retain their current status values under the new "stage" name
*/

-- Rename the status column to stage
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'status'
  ) THEN
    ALTER TABLE leads RENAME COLUMN status TO stage;
  END IF;
END $$;

-- Drop old index if it exists and create new one with updated name
DROP INDEX IF EXISTS idx_leads_status;
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);

-- ============================================================================
-- MIGRATION 4: 20251023194213_update_lead_triggers_for_stage_rename.sql
-- ============================================================================
/*
  # Update lead triggers to use stage instead of status

  1. Changes
    - Update lead insert/update/delete triggers to reference `stage` column instead of `status`
    - This migration updates webhook trigger functions that send lead data to external systems

  2. Notes
    - This must run after the column rename migration
    - Updates all trigger functions that reference the old status field
*/

-- Drop existing lead triggers
DROP TRIGGER IF EXISTS lead_insert_trigger ON leads;
DROP TRIGGER IF EXISTS lead_update_trigger ON leads;
DROP TRIGGER IF EXISTS lead_delete_trigger ON leads;

-- Drop existing trigger functions
DROP FUNCTION IF EXISTS notify_lead_insert();
DROP FUNCTION IF EXISTS notify_lead_update();
DROP FUNCTION IF EXISTS notify_lead_delete();

-- Recreate lead insert trigger function with stage field
CREATE OR REPLACE FUNCTION notify_lead_insert()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
  api_webhook_record RECORD;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'lead.created',
    'id', NEW.id,
    'lead_id', NEW.lead_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'source', NEW.source,
    'interest', NEW.interest,
    'stage', NEW.stage,
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

  FOR api_webhook_record IN
    SELECT url, headers, secret
    FROM api_webhooks
    WHERE is_active = true
      AND event_type = 'lead.created'
  LOOP
    INSERT INTO webhooks (event, payload, url, headers, secret)
    VALUES ('lead.created', trigger_data, api_webhook_record.url, api_webhook_record.headers, api_webhook_record.secret);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate lead update trigger function with stage field
CREATE OR REPLACE FUNCTION notify_lead_update()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
  api_webhook_record RECORD;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'lead.updated',
    'id', NEW.id,
    'lead_id', NEW.lead_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'source', NEW.source,
    'interest', NEW.interest,
    'stage', NEW.stage,
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
      'stage', OLD.stage,
      'interest', OLD.interest,
      'owner', OLD.owner,
      'notes', OLD.notes,
      'last_contact', OLD.last_contact,
      'lead_score', OLD.lead_score
    )
  );

  FOR api_webhook_record IN
    SELECT url, headers, secret
    FROM api_webhooks
    WHERE is_active = true
      AND event_type = 'lead.updated'
  LOOP
    INSERT INTO webhooks (event, payload, url, headers, secret)
    VALUES ('lead.updated', trigger_data, api_webhook_record.url, api_webhook_record.headers, api_webhook_record.secret);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate lead delete trigger function with stage field
CREATE OR REPLACE FUNCTION notify_lead_delete()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
  api_webhook_record RECORD;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'lead.deleted',
    'id', OLD.id,
    'lead_id', OLD.lead_id,
    'name', OLD.name,
    'email', OLD.email,
    'phone', OLD.phone,
    'source', OLD.source,
    'interest', OLD.interest,
    'stage', OLD.stage,
    'owner', OLD.owner,
    'address', OLD.address,
    'company', OLD.company,
    'notes', OLD.notes,
    'last_contact', OLD.last_contact,
    'lead_score', OLD.lead_score,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'affiliate_id', OLD.affiliate_id
  );

  FOR api_webhook_record IN
    SELECT url, headers, secret
    FROM api_webhooks
    WHERE is_active = true
      AND event_type = 'lead.deleted'
  LOOP
    INSERT INTO webhooks (event, payload, url, headers, secret)
    VALUES ('lead.deleted', trigger_data, api_webhook_record.url, api_webhook_record.headers, api_webhook_record.secret);
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
CREATE TRIGGER lead_insert_trigger
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_insert();

CREATE TRIGGER lead_update_trigger
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_update();

CREATE TRIGGER lead_delete_trigger
  AFTER DELETE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_delete();

-- ============================================================================
-- MIGRATION 5: 20251023200000_create_pipelines_tables.sql
-- ============================================================================
/*
  # Create Pipelines and Pipeline Stages Tables

  1. New Tables
    - `pipelines`
      - `id` (uuid, primary key) - Unique identifier for each pipeline
      - `pipeline_id` (text, unique) - Human-readable pipeline ID (e.g., P001)
      - `name` (text) - Pipeline name (e.g., "Sales Pipeline", "Recruitment Pipeline")
      - `description` (text) - Optional description of the pipeline
      - `entity_type` (text) - Type of entity this pipeline is for (e.g., "lead", "candidate", "project")
      - `is_default` (boolean) - Whether this is the default pipeline for this entity type
      - `is_active` (boolean) - Whether this pipeline is currently active
      - `display_order` (integer) - Order in which pipelines are displayed
      - `created_at` (timestamptz) - When the pipeline was created
      - `updated_at` (timestamptz) - When the pipeline was last updated

    - `pipeline_stages`
      - `id` (uuid, primary key) - Unique identifier for each stage
      - `pipeline_id` (uuid, foreign key) - Reference to parent pipeline
      - `stage_id` (text) - Human-readable stage ID within the pipeline
      - `name` (text) - Stage name (e.g., "New", "Contacted", "Demo Booked")
      - `description` (text) - Optional description of the stage
      - `color` (text) - Color for the stage card (e.g., "bg-blue-100", "#3B82F6")
      - `display_order` (integer) - Order in which stages appear in the pipeline
      - `is_active` (boolean) - Whether this stage is currently active
      - `created_at` (timestamptz) - When the stage was created
      - `updated_at` (timestamptz) - When the stage was last updated

  2. Security
    - Enable RLS on both tables
    - Add policies for anon and authenticated users to read, insert, update, and delete records

  3. Indexes
    - Add indexes for faster lookups on pipeline_id, entity_type, and display_order
*/

-- Create pipelines table
CREATE TABLE IF NOT EXISTS pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  entity_type text DEFAULT 'lead',
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create pipeline_stages table
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid REFERENCES pipelines(id) ON DELETE CASCADE,
  stage_id text NOT NULL,
  name text NOT NULL,
  description text,
  color text DEFAULT 'bg-gray-100',
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(pipeline_id, stage_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pipelines_pipeline_id ON pipelines(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_entity_type ON pipelines(entity_type);
CREATE INDEX IF NOT EXISTS idx_pipelines_display_order ON pipelines(display_order);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline_id ON pipeline_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_display_order ON pipeline_stages(display_order);

-- Enable RLS
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

-- Create policies for pipelines
CREATE POLICY "Allow anon to read pipelines"
  ON pipelines
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to read pipelines"
  ON pipelines
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to insert pipelines"
  ON pipelines
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to insert pipelines"
  ON pipelines
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update pipelines"
  ON pipelines
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update pipelines"
  ON pipelines
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete pipelines"
  ON pipelines
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to delete pipelines"
  ON pipelines
  FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for pipeline_stages
CREATE POLICY "Allow anon to read pipeline_stages"
  ON pipeline_stages
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to read pipeline_stages"
  ON pipeline_stages
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to insert pipeline_stages"
  ON pipeline_stages
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to insert pipeline_stages"
  ON pipeline_stages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update pipeline_stages"
  ON pipeline_stages
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update pipeline_stages"
  ON pipeline_stages
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete pipeline_stages"
  ON pipeline_stages
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to delete pipeline_stages"
  ON pipeline_stages
  FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger functions to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pipelines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pipeline_stages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_pipelines_updated_at_trigger
  BEFORE UPDATE ON pipelines
  FOR EACH ROW
  EXECUTE FUNCTION update_pipelines_updated_at();

CREATE TRIGGER update_pipeline_stages_updated_at_trigger
  BEFORE UPDATE ON pipeline_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_pipeline_stages_updated_at();

-- Insert default Sales Pipeline for leads
INSERT INTO pipelines (pipeline_id, name, description, entity_type, is_default, display_order)
VALUES ('P001', 'Sales Pipeline', 'Default pipeline for managing sales leads', 'lead', true, 1);

-- Insert default stages for the Sales Pipeline
INSERT INTO pipeline_stages (pipeline_id, stage_id, name, color, display_order)
SELECT
  id,
  'new',
  'New',
  'bg-blue-100',
  1
FROM pipelines WHERE pipeline_id = 'P001';

INSERT INTO pipeline_stages (pipeline_id, stage_id, name, color, display_order)
SELECT
  id,
  'contacted',
  'Contacted',
  'bg-yellow-100',
  2
FROM pipelines WHERE pipeline_id = 'P001';

INSERT INTO pipeline_stages (pipeline_id, stage_id, name, color, display_order)
SELECT
  id,
  'demo_booked',
  'Demo Booked',
  'bg-purple-100',
  3
FROM pipelines WHERE pipeline_id = 'P001';

INSERT INTO pipeline_stages (pipeline_id, stage_id, name, color, display_order)
SELECT
  id,
  'no_show',
  'No Show',
  'bg-red-100',
  4
FROM pipelines WHERE pipeline_id = 'P001';

INSERT INTO pipeline_stages (pipeline_id, stage_id, name, color, display_order)
SELECT
  id,
  'won',
  'Won',
  'bg-green-100',
  5
FROM pipelines WHERE pipeline_id = 'P001';

INSERT INTO pipeline_stages (pipeline_id, stage_id, name, color, display_order)
SELECT
  id,
  'lost',
  'Lost',
  'bg-gray-100',
  6
FROM pipelines WHERE pipeline_id = 'P001';

-- ============================================================================
-- MIGRATION 6: 20251023200356_create_pipelines_tables.sql
-- ============================================================================
/*
  # Create Pipelines and Pipeline Stages Tables

  1. New Tables
    - `pipelines`
      - `id` (uuid, primary key) - Unique identifier for each pipeline
      - `pipeline_id` (text, unique) - Human-readable pipeline ID (e.g., P001)
      - `name` (text) - Pipeline name (e.g., "Sales Pipeline", "Recruitment Pipeline")
      - `description` (text) - Optional description of the pipeline
      - `entity_type` (text) - Type of entity this pipeline is for (e.g., "lead", "candidate", "project")
      - `is_default` (boolean) - Whether this is the default pipeline for this entity type
      - `is_active` (boolean) - Whether this pipeline is currently active
      - `display_order` (integer) - Order in which pipelines are displayed
      - `created_at` (timestamptz) - When the pipeline was created
      - `updated_at` (timestamptz) - When the pipeline was last updated

    - `pipeline_stages`
      - `id` (uuid, primary key) - Unique identifier for each stage
      - `pipeline_id` (uuid, foreign key) - Reference to parent pipeline
      - `stage_id` (text) - Human-readable stage ID within the pipeline
      - `name` (text) - Stage name (e.g., "New", "Contacted", "Demo Booked")
      - `description` (text) - Optional description of the stage
      - `color` (text) - Color for the stage card (e.g., "bg-blue-100", "#3B82F6")
      - `display_order` (integer) - Order in which stages appear in the pipeline
      - `is_active` (boolean) - Whether this stage is currently active
      - `created_at` (timestamptz) - When the stage was created
      - `updated_at` (timestamptz) - When the stage was last updated

  2. Security
    - Enable RLS on both tables
    - Add policies for anon and authenticated users to read, insert, update, and delete records

  3. Indexes
    - Add indexes for faster lookups on pipeline_id, entity_type, and display_order
*/

-- Create pipelines table
CREATE TABLE IF NOT EXISTS pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  entity_type text DEFAULT 'lead',
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create pipeline_stages table
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid REFERENCES pipelines(id) ON DELETE CASCADE,
  stage_id text NOT NULL,
  name text NOT NULL,
  description text,
  color text DEFAULT 'bg-gray-100',
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(pipeline_id, stage_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pipelines_pipeline_id ON pipelines(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_entity_type ON pipelines(entity_type);
CREATE INDEX IF NOT EXISTS idx_pipelines_display_order ON pipelines(display_order);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline_id ON pipeline_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_display_order ON pipeline_stages(display_order);

-- Enable RLS
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

-- Create policies for pipelines
CREATE POLICY "Allow anon to read pipelines"
  ON pipelines
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to read pipelines"
  ON pipelines
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to insert pipelines"
  ON pipelines
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to insert pipelines"
  ON pipelines
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update pipelines"
  ON pipelines
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update pipelines"
  ON pipelines
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete pipelines"
  ON pipelines
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to delete pipelines"
  ON pipelines
  FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for pipeline_stages
CREATE POLICY "Allow anon to read pipeline_stages"
  ON pipeline_stages
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to read pipeline_stages"
  ON pipeline_stages
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to insert pipeline_stages"
  ON pipeline_stages
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to insert pipeline_stages"
  ON pipeline_stages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update pipeline_stages"
  ON pipeline_stages
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update pipeline_stages"
  ON pipeline_stages
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete pipeline_stages"
  ON pipeline_stages
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to delete pipeline_stages"
  ON pipeline_stages
  FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger functions to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pipelines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pipeline_stages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_pipelines_updated_at_trigger
  BEFORE UPDATE ON pipelines
  FOR EACH ROW
  EXECUTE FUNCTION update_pipelines_updated_at();

CREATE TRIGGER update_pipeline_stages_updated_at_trigger
  BEFORE UPDATE ON pipeline_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_pipeline_stages_updated_at();

-- Insert default Sales Pipeline for leads
INSERT INTO pipelines (pipeline_id, name, description, entity_type, is_default, display_order)
VALUES ('P001', 'Sales Pipeline', 'Default pipeline for managing sales leads', 'lead', true, 1);

-- Insert default stages for the Sales Pipeline
INSERT INTO pipeline_stages (pipeline_id, stage_id, name, color, display_order)
SELECT
  id,
  'new',
  'New',
  'bg-blue-100',
  1
FROM pipelines WHERE pipeline_id = 'P001';

INSERT INTO pipeline_stages (pipeline_id, stage_id, name, color, display_order)
SELECT
  id,
  'contacted',
  'Contacted',
  'bg-yellow-100',
  2
FROM pipelines WHERE pipeline_id = 'P001';

INSERT INTO pipeline_stages (pipeline_id, stage_id, name, color, display_order)
SELECT
  id,
  'demo_booked',
  'Demo Booked',
  'bg-purple-100',
  3
FROM pipelines WHERE pipeline_id = 'P001';

INSERT INTO pipeline_stages (pipeline_id, stage_id, name, color, display_order)
SELECT
  id,
  'no_show',
  'No Show',
  'bg-red-100',
  4
FROM pipelines WHERE pipeline_id = 'P001';

INSERT INTO pipeline_stages (pipeline_id, stage_id, name, color, display_order)
SELECT
  id,
  'won',
  'Won',
  'bg-green-100',
  5
FROM pipelines WHERE pipeline_id = 'P001';

INSERT INTO pipeline_stages (pipeline_id, stage_id, name, color, display_order)
SELECT
  id,
  'lost',
  'Lost',
  'bg-gray-100',
  6
FROM pipelines WHERE pipeline_id = 'P001';

-- ============================================================================
-- MIGRATION 7: 20251023202734_fix_lead_triggers.sql
-- ============================================================================
/*
  # Fix lead triggers to use correct api_webhooks column names

  1. Changes
    - Update lead triggers to use webhook_url instead of url
    - Remove references to headers and secret which don't exist

  2. Notes
    - Fixes compatibility with current api_webhooks table schema
*/

-- Drop existing lead triggers
DROP TRIGGER IF EXISTS lead_insert_trigger ON leads;
DROP TRIGGER IF EXISTS lead_update_trigger ON leads;
DROP TRIGGER IF EXISTS lead_delete_trigger ON leads;

-- Drop existing trigger functions
DROP FUNCTION IF EXISTS notify_lead_insert();
DROP FUNCTION IF EXISTS notify_lead_update();
DROP FUNCTION IF EXISTS notify_lead_delete();

-- Recreate lead insert trigger function
CREATE OR REPLACE FUNCTION notify_lead_insert()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
  api_webhook_record RECORD;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'lead.created',
    'id', NEW.id,
    'lead_id', NEW.lead_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'source', NEW.source,
    'interest', NEW.interest,
    'stage', NEW.stage,
    'owner', NEW.owner,
    'address', NEW.address,
    'company', NEW.company,
    'notes', NEW.notes,
    'last_contact', NEW.last_contact,
    'lead_score', NEW.lead_score,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'affiliate_id', NEW.affiliate_id,
    'pipeline_id', NEW.pipeline_id
  );

  FOR api_webhook_record IN
    SELECT webhook_url
    FROM api_webhooks
    WHERE is_active = true
      AND trigger_event = 'lead.created'
  LOOP
    INSERT INTO webhooks (event, payload, url)
    VALUES ('lead.created', trigger_data, api_webhook_record.webhook_url);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate lead update trigger function
CREATE OR REPLACE FUNCTION notify_lead_update()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
  api_webhook_record RECORD;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'lead.updated',
    'id', NEW.id,
    'lead_id', NEW.lead_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'source', NEW.source,
    'interest', NEW.interest,
    'stage', NEW.stage,
    'owner', NEW.owner,
    'address', NEW.address,
    'company', NEW.company,
    'notes', NEW.notes,
    'last_contact', NEW.last_contact,
    'lead_score', NEW.lead_score,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'affiliate_id', NEW.affiliate_id,
    'pipeline_id', NEW.pipeline_id,
    'previous', jsonb_build_object(
      'stage', OLD.stage,
      'interest', OLD.interest,
      'owner', OLD.owner,
      'notes', OLD.notes,
      'last_contact', OLD.last_contact,
      'lead_score', OLD.lead_score,
      'pipeline_id', OLD.pipeline_id
    )
  );

  FOR api_webhook_record IN
    SELECT webhook_url
    FROM api_webhooks
    WHERE is_active = true
      AND trigger_event = 'lead.updated'
  LOOP
    INSERT INTO webhooks (event, payload, url)
    VALUES ('lead.updated', trigger_data, api_webhook_record.webhook_url);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate lead delete trigger function
CREATE OR REPLACE FUNCTION notify_lead_delete()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
  api_webhook_record RECORD;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'lead.deleted',
    'id', OLD.id,
    'lead_id', OLD.lead_id,
    'name', OLD.name,
    'email', OLD.email,
    'phone', OLD.phone,
    'source', OLD.source,
    'interest', OLD.interest,
    'stage', OLD.stage,
    'owner', OLD.owner,
    'address', OLD.address,
    'company', OLD.company,
    'notes', OLD.notes,
    'last_contact', OLD.last_contact,
    'lead_score', OLD.lead_score,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'affiliate_id', OLD.affiliate_id,
    'pipeline_id', OLD.pipeline_id
  );

  FOR api_webhook_record IN
    SELECT webhook_url
    FROM api_webhooks
    WHERE is_active = true
      AND trigger_event = 'lead.deleted'
  LOOP
    INSERT INTO webhooks (event, payload, url)
    VALUES ('lead.deleted', trigger_data, api_webhook_record.webhook_url);
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
CREATE TRIGGER lead_insert_trigger
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_insert();

CREATE TRIGGER lead_update_trigger
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_update();

CREATE TRIGGER lead_delete_trigger
  AFTER DELETE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_delete();

-- ============================================================================
-- MIGRATION 8: 20251023202857_fix_workflow_triggers_for_stage.sql
-- ============================================================================
/*
  # Fix workflow triggers to use stage instead of status

  1. Changes
    - Update workflow trigger functions to reference stage column instead of status
    - This fixes the LEAD_UPDATED and LEAD_DELETED workflow triggers

  2. Notes
    - Required after renaming status to stage in leads table
*/

-- Drop existing workflow triggers for leads
DROP TRIGGER IF EXISTS trigger_workflows_on_lead_insert ON leads;
DROP TRIGGER IF EXISTS trigger_workflows_on_lead_update ON leads;
DROP TRIGGER IF EXISTS trigger_workflows_on_lead_delete ON leads;
DROP TRIGGER IF EXISTS trigger_workflows_on_new_lead ON leads;
DROP TRIGGER IF EXISTS trigger_workflows_on_updated_lead ON leads;
DROP TRIGGER IF EXISTS trigger_workflows_on_deleted_lead ON leads;

-- Drop existing workflow trigger functions with CASCADE
DROP FUNCTION IF EXISTS trigger_workflows_on_lead_insert() CASCADE;
DROP FUNCTION IF EXISTS trigger_workflows_on_lead_update() CASCADE;
DROP FUNCTION IF EXISTS trigger_workflows_on_lead_delete() CASCADE;

-- Recreate workflow trigger function for lead insert
CREATE OR REPLACE FUNCTION trigger_workflows_on_lead_insert()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'LEAD_CREATED',
    'id', NEW.id,
    'lead_id', NEW.lead_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'source', NEW.source,
    'interest', NEW.interest,
    'stage', NEW.stage,
    'owner', NEW.owner,
    'address', NEW.address,
    'company', NEW.company,
    'notes', NEW.notes,
    'last_contact', NEW.last_contact,
    'lead_score', NEW.lead_score,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'affiliate_id', NEW.affiliate_id,
    'pipeline_id', NEW.pipeline_id
  );

  INSERT INTO workflow_executions (trigger_type, trigger_data)
  VALUES ('LEAD_CREATED', trigger_data);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate workflow trigger function for lead update
CREATE OR REPLACE FUNCTION trigger_workflows_on_lead_update()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'LEAD_UPDATED',
    'id', NEW.id,
    'lead_id', NEW.lead_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'source', NEW.source,
    'interest', NEW.interest,
    'stage', NEW.stage,
    'owner', NEW.owner,
    'address', NEW.address,
    'company', NEW.company,
    'notes', NEW.notes,
    'last_contact', NEW.last_contact,
    'lead_score', NEW.lead_score,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'affiliate_id', NEW.affiliate_id,
    'pipeline_id', NEW.pipeline_id,
    'previous', jsonb_build_object(
      'stage', OLD.stage,
      'interest', OLD.interest,
      'owner', OLD.owner,
      'notes', OLD.notes,
      'last_contact', OLD.last_contact,
      'lead_score', OLD.lead_score,
      'pipeline_id', OLD.pipeline_id
    )
  );

  INSERT INTO workflow_executions (trigger_type, trigger_data)
  VALUES ('LEAD_UPDATED', trigger_data);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate workflow trigger function for lead delete
CREATE OR REPLACE FUNCTION trigger_workflows_on_lead_delete()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'LEAD_DELETED',
    'id', OLD.id,
    'lead_id', OLD.lead_id,
    'name', OLD.name,
    'email', OLD.email,
    'phone', OLD.phone,
    'source', OLD.source,
    'interest', OLD.interest,
    'stage', OLD.stage,
    'owner', OLD.owner,
    'address', OLD.address,
    'company', OLD.company,
    'notes', OLD.notes,
    'last_contact', OLD.last_contact,
    'lead_score', OLD.lead_score,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'affiliate_id', OLD.affiliate_id,
    'pipeline_id', OLD.pipeline_id
  );

  INSERT INTO workflow_executions (trigger_type, trigger_data)
  VALUES ('LEAD_DELETED', trigger_data);

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
CREATE TRIGGER trigger_workflows_on_lead_insert
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_lead_insert();

CREATE TRIGGER trigger_workflows_on_lead_update
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_lead_update();

CREATE TRIGGER trigger_workflows_on_lead_delete
  AFTER DELETE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_lead_delete();

-- ============================================================================
-- MIGRATION 9: 20251023210000_add_pipeline_to_leads.sql
-- ============================================================================
/*
  # Add pipeline support to leads table

  1. Changes
    - Add `pipeline_id` column to leads table (foreign key to pipelines)
    - Set default pipeline for existing leads
    - Update indexes

  2. Notes
    - Existing leads will be assigned to the default Sales Pipeline
    - The pipeline_id is optional to support backwards compatibility
*/

-- Add pipeline_id column to leads table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'pipeline_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN pipeline_id uuid REFERENCES pipelines(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Set default pipeline for existing leads
UPDATE leads
SET pipeline_id = (SELECT id FROM pipelines WHERE pipeline_id = 'P001' AND entity_type = 'lead' LIMIT 1)
WHERE pipeline_id IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_id ON leads(pipeline_id);

-- ============================================================================
-- MIGRATION 10: 20251023210001_fix_lead_triggers.sql
-- ============================================================================
/*
  # Fix lead triggers to use correct api_webhooks column names

  1. Changes
    - Update lead triggers to use webhook_url instead of url
    - Remove references to headers and secret which don't exist

  2. Notes
    - Fixes compatibility with current api_webhooks table schema
*/

-- Drop existing lead triggers
DROP TRIGGER IF EXISTS lead_insert_trigger ON leads;
DROP TRIGGER IF EXISTS lead_update_trigger ON leads;
DROP TRIGGER IF EXISTS lead_delete_trigger ON leads;

-- Drop existing trigger functions
DROP FUNCTION IF EXISTS notify_lead_insert();
DROP FUNCTION IF EXISTS notify_lead_update();
DROP FUNCTION IF EXISTS notify_lead_delete();

-- Recreate lead insert trigger function
CREATE OR REPLACE FUNCTION notify_lead_insert()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
  api_webhook_record RECORD;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'lead.created',
    'id', NEW.id,
    'lead_id', NEW.lead_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'source', NEW.source,
    'interest', NEW.interest,
    'stage', NEW.stage,
    'owner', NEW.owner,
    'address', NEW.address,
    'company', NEW.company,
    'notes', NEW.notes,
    'last_contact', NEW.last_contact,
    'lead_score', NEW.lead_score,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'affiliate_id', NEW.affiliate_id,
    'pipeline_id', NEW.pipeline_id
  );

  FOR api_webhook_record IN
    SELECT webhook_url
    FROM api_webhooks
    WHERE is_active = true
      AND trigger_event = 'lead.created'
  LOOP
    INSERT INTO webhooks (event, payload, url)
    VALUES ('lead.created', trigger_data, api_webhook_record.webhook_url);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate lead update trigger function
CREATE OR REPLACE FUNCTION notify_lead_update()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
  api_webhook_record RECORD;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'lead.updated',
    'id', NEW.id,
    'lead_id', NEW.lead_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'source', NEW.source,
    'interest', NEW.interest,
    'stage', NEW.stage,
    'owner', NEW.owner,
    'address', NEW.address,
    'company', NEW.company,
    'notes', NEW.notes,
    'last_contact', NEW.last_contact,
    'lead_score', NEW.lead_score,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'affiliate_id', NEW.affiliate_id,
    'pipeline_id', NEW.pipeline_id,
    'previous', jsonb_build_object(
      'stage', OLD.stage,
      'interest', OLD.interest,
      'owner', OLD.owner,
      'notes', OLD.notes,
      'last_contact', OLD.last_contact,
      'lead_score', OLD.lead_score,
      'pipeline_id', OLD.pipeline_id
    )
  );

  FOR api_webhook_record IN
    SELECT webhook_url
    FROM api_webhooks
    WHERE is_active = true
      AND trigger_event = 'lead.updated'
  LOOP
    INSERT INTO webhooks (event, payload, url)
    VALUES ('lead.updated', trigger_data, api_webhook_record.webhook_url);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate lead delete trigger function
CREATE OR REPLACE FUNCTION notify_lead_delete()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
  api_webhook_record RECORD;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'lead.deleted',
    'id', OLD.id,
    'lead_id', OLD.lead_id,
    'name', OLD.name,
    'email', OLD.email,
    'phone', OLD.phone,
    'source', OLD.source,
    'interest', OLD.interest,
    'stage', OLD.stage,
    'owner', OLD.owner,
    'address', OLD.address,
    'company', OLD.company,
    'notes', OLD.notes,
    'last_contact', OLD.last_contact,
    'lead_score', OLD.lead_score,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'affiliate_id', OLD.affiliate_id,
    'pipeline_id', OLD.pipeline_id
  );

  FOR api_webhook_record IN
    SELECT webhook_url
    FROM api_webhooks
    WHERE is_active = true
      AND trigger_event = 'lead.deleted'
  LOOP
    INSERT INTO webhooks (event, payload, url)
    VALUES ('lead.deleted', trigger_data, api_webhook_record.webhook_url);
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
CREATE TRIGGER lead_insert_trigger
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_insert();

CREATE TRIGGER lead_update_trigger
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_update();

CREATE TRIGGER lead_delete_trigger
  AFTER DELETE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_delete();

-- ============================================================================
-- MIGRATION 11: 20251023210002_fix_workflow_triggers_for_stage.sql
-- ============================================================================
/*
  # Fix workflow triggers to use stage instead of status

  1. Changes
    - Update workflow trigger functions to reference stage column instead of status
    - This fixes the LEAD_UPDATED and LEAD_DELETED workflow triggers

  2. Notes
    - Required after renaming status to stage in leads table
*/

-- Drop existing workflow triggers for leads
DROP TRIGGER IF EXISTS trigger_workflows_on_lead_insert ON leads;
DROP TRIGGER IF EXISTS trigger_workflows_on_lead_update ON leads;
DROP TRIGGER IF EXISTS trigger_workflows_on_lead_delete ON leads;
DROP TRIGGER IF EXISTS trigger_workflows_on_new_lead ON leads;
DROP TRIGGER IF EXISTS trigger_workflows_on_updated_lead ON leads;
DROP TRIGGER IF EXISTS trigger_workflows_on_deleted_lead ON leads;

-- Drop existing workflow trigger functions with CASCADE
DROP FUNCTION IF EXISTS trigger_workflows_on_lead_insert() CASCADE;
DROP FUNCTION IF EXISTS trigger_workflows_on_lead_update() CASCADE;
DROP FUNCTION IF EXISTS trigger_workflows_on_lead_delete() CASCADE;

-- Recreate workflow trigger function for lead insert
CREATE OR REPLACE FUNCTION trigger_workflows_on_lead_insert()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'LEAD_CREATED',
    'id', NEW.id,
    'lead_id', NEW.lead_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'source', NEW.source,
    'interest', NEW.interest,
    'stage', NEW.stage,
    'owner', NEW.owner,
    'address', NEW.address,
    'company', NEW.company,
    'notes', NEW.notes,
    'last_contact', NEW.last_contact,
    'lead_score', NEW.lead_score,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'affiliate_id', NEW.affiliate_id,
    'pipeline_id', NEW.pipeline_id
  );

  INSERT INTO workflow_executions (trigger_type, trigger_data)
  VALUES ('LEAD_CREATED', trigger_data);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate workflow trigger function for lead update
CREATE OR REPLACE FUNCTION trigger_workflows_on_lead_update()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'LEAD_UPDATED',
    'id', NEW.id,
    'lead_id', NEW.lead_id,
    'name', NEW.name,
    'email', NEW.email,
    'phone', NEW.phone,
    'source', NEW.source,
    'interest', NEW.interest,
    'stage', NEW.stage,
    'owner', NEW.owner,
    'address', NEW.address,
    'company', NEW.company,
    'notes', NEW.notes,
    'last_contact', NEW.last_contact,
    'lead_score', NEW.lead_score,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'affiliate_id', NEW.affiliate_id,
    'pipeline_id', NEW.pipeline_id,
    'previous', jsonb_build_object(
      'stage', OLD.stage,
      'interest', OLD.interest,
      'owner', OLD.owner,
      'notes', OLD.notes,
      'last_contact', OLD.last_contact,
      'lead_score', OLD.lead_score,
      'pipeline_id', OLD.pipeline_id
    )
  );

  INSERT INTO workflow_executions (trigger_type, trigger_data)
  VALUES ('LEAD_UPDATED', trigger_data);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate workflow trigger function for lead delete
CREATE OR REPLACE FUNCTION trigger_workflows_on_lead_delete()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'LEAD_DELETED',
    'id', OLD.id,
    'lead_id', OLD.lead_id,
    'name', OLD.name,
    'email', OLD.email,
    'phone', OLD.phone,
    'source', OLD.source,
    'interest', OLD.interest,
    'stage', OLD.stage,
    'owner', OLD.owner,
    'address', OLD.address,
    'company', OLD.company,
    'notes', OLD.notes,
    'last_contact', OLD.last_contact,
    'lead_score', OLD.lead_score,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'affiliate_id', OLD.affiliate_id,
    'pipeline_id', OLD.pipeline_id
  );

  INSERT INTO workflow_executions (trigger_type, trigger_data)
  VALUES ('LEAD_DELETED', trigger_data);

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
CREATE TRIGGER trigger_workflows_on_lead_insert
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_lead_insert();

CREATE TRIGGER trigger_workflows_on_lead_update
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_lead_update();

CREATE TRIGGER trigger_workflows_on_lead_delete
  AFTER DELETE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_lead_delete();

-- ============================================================================
-- MIGRATION 12: 20251023212628_add_lead_update_sync_to_contact.sql
-- ============================================================================
/*
  # Add Lead Update Sync to Contact

  1. Changes
    - Create trigger to sync lead updates to contacts_master table
    - When a lead is updated, update the corresponding contact record
    - Match contacts by phone number
    - Update all relevant fields from lead to contact

  2. Fields Synced
    - name → full_name
    - email → email
    - phone → phone
    - company → business_name
    - address → address

  3. Notes
    - Only updates if a matching contact exists
    - Uses phone number as the primary lookup key
    - Handles phone number changes by looking up the old phone first
*/

-- Create function to sync lead updates to contact
CREATE OR REPLACE FUNCTION sync_lead_update_to_contact()
RETURNS TRIGGER AS $$
BEGIN
  -- Update contact if it exists (match by OLD phone number first, then NEW phone number)
  UPDATE contacts_master
  SET
    full_name = NEW.name,
    email = NEW.email,
    phone = NEW.phone,
    business_name = NEW.company,
    address = NEW.address,
    updated_at = NOW()
  WHERE phone = OLD.phone OR phone = NEW.phone;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_sync_lead_update_to_contact ON leads;

-- Create trigger for lead updates
CREATE TRIGGER trigger_sync_lead_update_to_contact
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION sync_lead_update_to_contact();

-- ============================================================================
-- MIGRATION 13: 20251023213631_add_auto_generate_lead_id_trigger.sql
-- ============================================================================
/*
  # Add Auto-Generate Lead ID Trigger

  1. Changes
    - Create a BEFORE INSERT trigger to automatically generate lead_id
    - Lead ID format: L001, L002, L003, etc.
    - Finds the highest existing lead_id and increments

  2. Logic
    - Runs BEFORE INSERT to generate lead_id if not provided
    - Extracts numeric part from last lead_id (e.g., "L005" → 5)
    - Increments by 1
    - Formats back with leading zeros (e.g., 6 → "L006")
    - Defaults to "L001" if no leads exist

  3. Notes
    - This fixes the "Failed to create lead" error
    - Users no longer need to manually provide lead_id
*/

-- Create function to auto-generate lead_id
CREATE OR REPLACE FUNCTION generate_lead_id()
RETURNS TRIGGER AS $$
DECLARE
  new_lead_id TEXT;
  last_lead_id TEXT;
  last_number INTEGER;
BEGIN
  -- Only generate if lead_id is not provided or is empty
  IF NEW.lead_id IS NULL OR NEW.lead_id = '' THEN
    -- Get the last lead_id
    SELECT lead_id INTO last_lead_id
    FROM leads
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF last_lead_id IS NULL THEN
      new_lead_id := 'L001';
    ELSE
      -- Extract number from last lead_id (e.g., 'L005' -> 5)
      last_number := CAST(SUBSTRING(last_lead_id FROM 2) AS INTEGER);
      -- Increment and format with leading zeros
      new_lead_id := 'L' || LPAD((last_number + 1)::TEXT, 3, '0');
    END IF;
    
    NEW.lead_id := new_lead_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_generate_lead_id ON leads;

-- Create BEFORE INSERT trigger
CREATE TRIGGER trigger_generate_lead_id
  BEFORE INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION generate_lead_id();

/*
================================================================================
END OF GROUP 12: PIPELINE AND STAGE MANAGEMENT
================================================================================
Next Group: group-13-support-tickets-and-media-updates.sql
*/
