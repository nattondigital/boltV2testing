/*
================================================================================
GROUP 3: LMS AND CONFIGURATION TABLES
================================================================================

Learning Management System tables, WhatsApp configuration, and automation infrastructure

Total Files: 10
Dependencies: Group 1-2

Files Included (in execution order):
1. 20251016125738_create_lms_tables.sql
2. 20251016133530_add_thumbnail_to_lessons.sql
3. 20251016143047_create_whatsapp_config_table.sql
4. 20251016143523_update_whatsapp_config_rls_for_anon_access.sql
5. 20251016145124_create_automations_tables.sql
6. 20251016150826_update_automations_workflow_structure.sql
7. 20251016153328_create_workflow_triggers_table.sql
8. 20251016154448_create_workflow_actions_table.sql
9. 20251016155741_create_workflow_executions_and_trigger_system.sql
10. 20251016155840_update_workflow_trigger_to_call_edge_function.sql

================================================================================
*/

-- ============================================================================
-- MIGRATION 1: 20251016125738_create_lms_tables.sql
-- ============================================================================
/*
  # Create LMS (Learning Management System) Tables

  1. New Tables
    - `courses`
      - `id` (uuid, primary key) - Unique identifier
      - `course_id` (text, unique) - Human-readable course ID (e.g., C001)
      - `title` (text) - Course title
      - `description` (text) - Course description
      - `thumbnail_url` (text) - Course thumbnail image URL
      - `instructor` (text) - Instructor name
      - `duration` (text) - Estimated duration
      - `level` (text) - Beginner, Intermediate, Advanced
      - `status` (text) - Draft, Published, Archived
      - `price` (decimal) - Course price
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

    - `categories`
      - `id` (uuid, primary key) - Unique identifier
      - `course_id` (uuid, foreign key) - Reference to courses table
      - `title` (text) - Category/Module title
      - `description` (text) - Category description
      - `order_index` (integer) - Display order
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

    - `lessons`
      - `id` (uuid, primary key) - Unique identifier
      - `category_id` (uuid, foreign key) - Reference to categories table
      - `title` (text) - Lesson title
      - `description` (text) - Lesson description
      - `video_url` (text) - Video URL (YouTube, Vimeo, etc.)
      - `duration` (text) - Lesson duration
      - `order_index` (integer) - Display order within category
      - `is_free` (boolean) - Whether lesson is free to preview
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

    - `lesson_attachments`
      - `id` (uuid, primary key) - Unique identifier
      - `lesson_id` (uuid, foreign key) - Reference to lessons table
      - `file_name` (text) - Attachment file name
      - `file_url` (text) - File URL
      - `file_type` (text) - File type (PDF, DOC, ZIP, etc.)
      - `file_size` (text) - File size
      - `created_at` (timestamptz) - Creation timestamp

  2. Security
    - Enable RLS on all LMS tables
    - Allow anon and authenticated users to read published content
    - Allow anon users to manage all content (admin access)

  3. Indexes
    - Add indexes for foreign keys and frequently queried fields
*/

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  thumbnail_url text,
  instructor text DEFAULT 'Admin',
  duration text,
  level text DEFAULT 'Beginner',
  status text DEFAULT 'Draft',
  price decimal(10,2) DEFAULT 0.00,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  video_url text,
  duration text,
  order_index integer DEFAULT 0,
  is_free boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create lesson_attachments table
CREATE TABLE IF NOT EXISTS lesson_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_categories_course_id ON categories(course_id);
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(order_index);
CREATE INDEX IF NOT EXISTS idx_lessons_category_id ON lessons(category_id);
CREATE INDEX IF NOT EXISTS idx_lessons_order ON lessons(order_index);
CREATE INDEX IF NOT EXISTS idx_attachments_lesson_id ON lesson_attachments(lesson_id);

-- Enable RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for courses
CREATE POLICY "Allow anon to read courses"
  ON courses FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon to insert courses"
  ON courses FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon to update courses"
  ON courses FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon to delete courses"
  ON courses FOR DELETE TO anon USING (true);

-- Create policies for categories
CREATE POLICY "Allow anon to read categories"
  ON categories FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon to insert categories"
  ON categories FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon to update categories"
  ON categories FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon to delete categories"
  ON categories FOR DELETE TO anon USING (true);

-- Create policies for lessons
CREATE POLICY "Allow anon to read lessons"
  ON lessons FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon to insert lessons"
  ON lessons FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon to update lessons"
  ON lessons FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon to delete lessons"
  ON lessons FOR DELETE TO anon USING (true);

-- Create policies for lesson_attachments
CREATE POLICY "Allow anon to read attachments"
  ON lesson_attachments FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon to insert attachments"
  ON lesson_attachments FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon to update attachments"
  ON lesson_attachments FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon to delete attachments"
  ON lesson_attachments FOR DELETE TO anon USING (true);

-- Create triggers to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- MIGRATION 2: 20251016133530_add_thumbnail_to_lessons.sql
-- ============================================================================
/*
  # Add Thumbnail URL to Lessons

  1. Changes
    - Add `thumbnail_url` column to `lessons` table for lesson preview images
    - This allows each lesson to have its own thumbnail/preview image

  2. Notes
    - Existing lessons will have NULL thumbnail_url by default
*/

-- Add thumbnail_url column to lessons table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lessons' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE lessons ADD COLUMN thumbnail_url text;
  END IF;
END $$;

-- ============================================================================
-- MIGRATION 3: 20251016143047_create_whatsapp_config_table.sql
-- ============================================================================
/*
  # Create WhatsApp Business API Configuration Table

  1. New Tables
    - `whatsapp_config`
      - `id` (uuid, primary key) - Unique identifier
      - `business_name` (text) - Business name for WhatsApp
      - `api_key` (text) - Doubletick API key (encrypted/sensitive)
      - `waba_number` (text) - WhatsApp Business Account phone number
      - `status` (text) - Connection status (Connected, Disconnected, Pending, Error)
      - `last_sync` (timestamptz) - Last synchronization timestamp
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp
  
  2. Security
    - Enable RLS on `whatsapp_config` table
    - Add policy for authenticated admin users to read configuration
    - Add policy for authenticated admin users to update configuration
    - Add policy for authenticated admin users to insert configuration
  
  3. Important Notes
    - Only one configuration record should exist (enforced by application logic)
    - The table stores sensitive API keys, ensure proper access control
    - Default status is 'Disconnected' for new records
*/

CREATE TABLE IF NOT EXISTS whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text DEFAULT '',
  api_key text DEFAULT '',
  waba_number text DEFAULT '',
  status text DEFAULT 'Disconnected',
  last_sync timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can view WhatsApp config"
  ON whatsapp_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Admin users can insert WhatsApp config"
  ON whatsapp_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Admin users can update WhatsApp config"
  ON whatsapp_config
  FOR UPDATE
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

CREATE POLICY "Admin users can delete WhatsApp config"
  ON whatsapp_config
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_whatsapp_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER whatsapp_config_updated_at
  BEFORE UPDATE ON whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_config_timestamp();

-- ============================================================================
-- MIGRATION 4: 20251016143523_update_whatsapp_config_rls_for_anon_access.sql
-- ============================================================================
/*
  # Update WhatsApp Config RLS for Anonymous Access

  1. Changes
    - Drop existing restrictive policies
    - Add policies allowing anonymous users to manage WhatsApp configuration
    - This matches the pattern used in other tables like admin_users and enrolled_members

  2. Security
    - Allow anonymous read access for WhatsApp configuration
    - Allow anonymous insert access for WhatsApp configuration
    - Allow anonymous update access for WhatsApp configuration
    - Allow anonymous delete access for WhatsApp configuration
*/

DROP POLICY IF EXISTS "Admin users can view WhatsApp config" ON whatsapp_config;
DROP POLICY IF EXISTS "Admin users can insert WhatsApp config" ON whatsapp_config;
DROP POLICY IF EXISTS "Admin users can update WhatsApp config" ON whatsapp_config;
DROP POLICY IF EXISTS "Admin users can delete WhatsApp config" ON whatsapp_config;

CREATE POLICY "Anyone can view WhatsApp config"
  ON whatsapp_config
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert WhatsApp config"
  ON whatsapp_config
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update WhatsApp config"
  ON whatsapp_config
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete WhatsApp config"
  ON whatsapp_config
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- MIGRATION 5: 20251016145124_create_automations_tables.sql
-- ============================================================================
/*
  # Create Automations Module Tables

  1. New Tables
    - `automations`
      - `id` (uuid, primary key) - Unique identifier
      - `name` (text) - Automation name
      - `description` (text) - Automation description
      - `status` (text) - Status: Active, Paused, Draft, Error
      - `trigger` (text) - Trigger name/description
      - `trigger_type` (text) - Type: Lead Capture, Course Progress, Payment Event, Calendar Event, Affiliate Event
      - `actions` (jsonb) - Array of action names
      - `category` (text) - Category: Lead Nurturing, Student Engagement, Payment Recovery, Demo Management, Affiliate Management
      - `runs_today` (integer) - Number of runs today
      - `total_runs` (integer) - Total number of runs
      - `success_rate` (numeric) - Success rate percentage
      - `last_run` (timestamptz) - Last run timestamp
      - `created_by` (text) - Creator name
      - `tags` (jsonb) - Array of tags
      - `workflow_config` (jsonb) - Complete workflow configuration
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Update timestamp

    - `automation_templates`
      - `id` (uuid, primary key) - Unique identifier
      - `name` (text) - Template name
      - `description` (text) - Template description
      - `category` (text) - Category
      - `uses` (integer) - Number of times used
      - `rating` (numeric) - Rating (0-5)
      - `actions` (jsonb) - Array of action names
      - `thumbnail` (text) - Thumbnail URL
      - `workflow_config` (jsonb) - Template workflow configuration
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Update timestamp

    - `automation_runs`
      - `id` (uuid, primary key) - Unique identifier
      - `automation_id` (uuid, foreign key) - Reference to automation
      - `status` (text) - success, failed, running
      - `trigger_data` (jsonb) - Data that triggered the automation
      - `result_data` (jsonb) - Result of the automation
      - `error_message` (text) - Error message if failed
      - `duration_ms` (integer) - Duration in milliseconds
      - `created_at` (timestamptz) - Run timestamp

  2. Security
    - Enable RLS on all tables
    - Allow anonymous and authenticated access for all operations
    - This matches the pattern used in other admin tables

  3. Important Notes
    - JSONB fields store arrays and complex data structures
    - Automation runs are logged for analytics and debugging
    - Success rate is calculated from automation_runs table
*/

-- Automations table
CREATE TABLE IF NOT EXISTS automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  status text DEFAULT 'Draft',
  trigger text DEFAULT '',
  trigger_type text DEFAULT '',
  actions jsonb DEFAULT '[]'::jsonb,
  category text DEFAULT '',
  runs_today integer DEFAULT 0,
  total_runs integer DEFAULT 0,
  success_rate numeric DEFAULT 0,
  last_run timestamptz,
  created_by text DEFAULT '',
  tags jsonb DEFAULT '[]'::jsonb,
  workflow_config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view automations"
  ON automations
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert automations"
  ON automations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update automations"
  ON automations
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete automations"
  ON automations
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Automation templates table
CREATE TABLE IF NOT EXISTS automation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  category text DEFAULT '',
  uses integer DEFAULT 0,
  rating numeric DEFAULT 0,
  actions jsonb DEFAULT '[]'::jsonb,
  thumbnail text DEFAULT '',
  workflow_config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE automation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view automation templates"
  ON automation_templates
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert automation templates"
  ON automation_templates
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update automation templates"
  ON automation_templates
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete automation templates"
  ON automation_templates
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Automation runs table (for logging and analytics)
CREATE TABLE IF NOT EXISTS automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES automations(id) ON DELETE CASCADE,
  status text DEFAULT 'running',
  trigger_data jsonb DEFAULT '{}'::jsonb,
  result_data jsonb DEFAULT '{}'::jsonb,
  error_message text,
  duration_ms integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view automation runs"
  ON automation_runs
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert automation runs"
  ON automation_runs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update automation runs"
  ON automation_runs
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete automation runs"
  ON automation_runs
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_automations_status ON automations(status);
CREATE INDEX IF NOT EXISTS idx_automations_category ON automations(category);
CREATE INDEX IF NOT EXISTS idx_automations_created_at ON automations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id ON automation_runs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_created_at ON automation_runs(created_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_automations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER automations_updated_at
  BEFORE UPDATE ON automations
  FOR EACH ROW
  EXECUTE FUNCTION update_automations_timestamp();

CREATE TRIGGER automation_templates_updated_at
  BEFORE UPDATE ON automation_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_automations_timestamp();

-- ============================================================================
-- MIGRATION 6: 20251016150826_update_automations_workflow_structure.sql
-- ============================================================================
/*
  # Update Automations to Workflow Structure

  1. Changes to Tables
    - Update `automations` table structure for workflow-based design
    - Remove old trigger/action fields
    - Add workflow nodes structure (trigger node + action nodes)
    - Each node has: type, name, properties (JSONB for configuration)

  2. New Structure
    - `workflow_nodes` (jsonb) - Array of nodes:
      - Each node: { id, type, name, properties, position }
      - First node is always trigger
      - Subsequent nodes are actions
    - Remove: trigger, trigger_type, actions fields
    - Keep: status, category, description for workflow metadata

  3. Important Notes
    - Workflow nodes stored as JSONB for flexibility
    - Each node type will have custom properties
    - Position data for visual workflow builder
*/

-- Add workflow_nodes column and remove old fields
DO $$
BEGIN
  -- Add new workflow_nodes column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automations' AND column_name = 'workflow_nodes'
  ) THEN
    ALTER TABLE automations ADD COLUMN workflow_nodes jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Drop old columns if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automations' AND column_name = 'trigger'
  ) THEN
    ALTER TABLE automations DROP COLUMN trigger;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automations' AND column_name = 'trigger_type'
  ) THEN
    ALTER TABLE automations DROP COLUMN trigger_type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automations' AND column_name = 'actions'
  ) THEN
    ALTER TABLE automations DROP COLUMN actions;
  END IF;
END $$;

-- Create index for workflow_nodes for better query performance
CREATE INDEX IF NOT EXISTS idx_automations_workflow_nodes ON automations USING gin(workflow_nodes);

-- Update workflow_config to be more flexible
COMMENT ON COLUMN automations.workflow_nodes IS 'Array of workflow nodes: [{id, type, name, properties, position}]';
COMMENT ON COLUMN automations.workflow_config IS 'Additional workflow configuration and metadata';

-- ============================================================================
-- MIGRATION 7: 20251016153328_create_workflow_triggers_table.sql
-- ============================================================================
/*
  # Create Workflow Triggers Table

  1. New Tables
    - `workflow_triggers` - Stores trigger definitions
      - `id` (uuid, primary key) - Unique identifier
      - `name` (text, unique) - Trigger name (e.g., "LEADS")
      - `display_name` (text) - Display name for UI
      - `description` (text) - Description of the trigger
      - `event_name` (text) - Event name (e.g., "NEW_LEAD_ADDED")
      - `event_schema` (jsonb) - Schema of data provided by this trigger
        Contains field definitions with: field_name, data_type, description
      - `category` (text) - Category for grouping triggers
      - `icon` (text) - Icon name for UI display
      - `is_active` (boolean) - Whether trigger is active
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Update timestamp

  2. Security
    - Enable RLS on `workflow_triggers` table
    - Add policies for authenticated users to read
    - Add policies for admin users to manage triggers

  3. Initial Data
    - Insert LEADS trigger with NEW_LEAD_ADDED event
    - Event schema includes all lead table fields

  4. Important Notes
    - Triggers define what data is available for workflow actions
    - Event schema helps with mapping data to action properties
    - Each trigger can have multiple events in future
*/

-- Create workflow_triggers table
CREATE TABLE IF NOT EXISTS workflow_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  event_name text NOT NULL,
  event_schema jsonb DEFAULT '[]'::jsonb,
  category text DEFAULT 'General',
  icon text DEFAULT 'zap',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_name ON workflow_triggers(name);
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_event_name ON workflow_triggers(event_name);
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_category ON workflow_triggers(category);
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_is_active ON workflow_triggers(is_active);

-- Enable RLS
ALTER TABLE workflow_triggers ENABLE ROW LEVEL SECURITY;

-- Create policies for anon and authenticated users to read
CREATE POLICY "Allow anon to read workflow triggers"
  ON workflow_triggers
  FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "Allow authenticated to read workflow triggers"
  ON workflow_triggers
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for authenticated users to manage (will be restricted to admin later)
CREATE POLICY "Allow authenticated to insert workflow triggers"
  ON workflow_triggers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update workflow triggers"
  ON workflow_triggers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete workflow triggers"
  ON workflow_triggers
  FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workflow_triggers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workflow_triggers_updated_at_trigger
  BEFORE UPDATE ON workflow_triggers
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_triggers_updated_at();

-- Insert LEADS trigger with NEW_LEAD_ADDED event
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'LEADS',
  'Leads',
  'Trigger when a new lead is added to the system',
  'NEW_LEAD_ADDED',
  '[
    {"field": "id", "type": "uuid", "description": "Unique identifier for the lead"},
    {"field": "lead_id", "type": "text", "description": "Human-readable lead ID"},
    {"field": "name", "type": "text", "description": "Lead full name"},
    {"field": "email", "type": "text", "description": "Lead email address"},
    {"field": "phone", "type": "text", "description": "Lead phone number"},
    {"field": "source", "type": "text", "description": "Lead source (Ad, Referral, Webinar, Website, etc.)"},
    {"field": "interest", "type": "text", "description": "Interest level (Hot, Warm, Cold)"},
    {"field": "status", "type": "text", "description": "Lead status (New, Contacted, Demo Booked, etc.)"},
    {"field": "owner", "type": "text", "description": "Lead owner/assigned to"},
    {"field": "address", "type": "text", "description": "Lead address"},
    {"field": "company", "type": "text", "description": "Lead company name"},
    {"field": "notes", "type": "text", "description": "Additional notes about the lead"},
    {"field": "last_contact", "type": "timestamptz", "description": "Last contact date"},
    {"field": "lead_score", "type": "integer", "description": "Lead scoring (0-100)"},
    {"field": "created_at", "type": "timestamptz", "description": "When the lead was created"},
    {"field": "updated_at", "type": "timestamptz", "description": "When the lead was last updated"},
    {"field": "affiliate_id", "type": "uuid", "description": "Affiliate who referred this lead (if applicable)"}
  ]'::jsonb,
  'Lead Management',
  'users'
) ON CONFLICT (name) DO NOTHING;

-- Add comment
COMMENT ON TABLE workflow_triggers IS 'Stores workflow trigger definitions with their event schemas';
COMMENT ON COLUMN workflow_triggers.event_schema IS 'JSON schema defining available data fields for this trigger';

-- ============================================================================
-- MIGRATION 8: 20251016154448_create_workflow_actions_table.sql
-- ============================================================================
/*
  # Create Workflow Actions Table

  1. New Tables
    - `workflow_actions` - Stores action definitions
      - `id` (uuid, primary key) - Unique identifier
      - `name` (text, unique) - Action name (e.g., "WEBHOOK")
      - `display_name` (text) - Display name for UI
      - `description` (text) - Description of the action
      - `action_type` (text) - Type of action (e.g., "webhook", "email", "sms")
      - `config_schema` (jsonb) - Schema defining required configuration fields
        Contains field definitions with: field_name, data_type, description, required
      - `category` (text) - Category for grouping actions
      - `icon` (text) - Icon name for UI display
      - `is_active` (boolean) - Whether action is active
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Update timestamp

  2. Security
    - Enable RLS on `workflow_actions` table
    - Add policies for authenticated users to read
    - Add policies for admin users to manage actions

  3. Initial Data
    - Insert WEBHOOK action with POST method
    - Config schema includes: webhook_url, query_params, headers, body

  4. Important Notes
    - Actions define what operations can be performed in workflows
    - Config schema helps validate action configuration
    - Actions can use data from trigger event schema
*/

-- Create workflow_actions table
CREATE TABLE IF NOT EXISTS workflow_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  action_type text NOT NULL,
  config_schema jsonb DEFAULT '[]'::jsonb,
  category text DEFAULT 'General',
  icon text DEFAULT 'play',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workflow_actions_name ON workflow_actions(name);
CREATE INDEX IF NOT EXISTS idx_workflow_actions_action_type ON workflow_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_workflow_actions_category ON workflow_actions(category);
CREATE INDEX IF NOT EXISTS idx_workflow_actions_is_active ON workflow_actions(is_active);

-- Enable RLS
ALTER TABLE workflow_actions ENABLE ROW LEVEL SECURITY;

-- Create policies for anon and authenticated users to read
CREATE POLICY "Allow anon to read workflow actions"
  ON workflow_actions
  FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "Allow authenticated to read workflow actions"
  ON workflow_actions
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for authenticated users to manage (will be restricted to admin later)
CREATE POLICY "Allow authenticated to insert workflow actions"
  ON workflow_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update workflow actions"
  ON workflow_actions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete workflow actions"
  ON workflow_actions
  FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workflow_actions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workflow_actions_updated_at_trigger
  BEFORE UPDATE ON workflow_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_actions_updated_at();

-- Insert WEBHOOK action
INSERT INTO workflow_actions (
  name,
  display_name,
  description,
  action_type,
  config_schema,
  category,
  icon
) VALUES (
  'WEBHOOK',
  'Webhook POST',
  'Send data to an external webhook URL using HTTP POST method',
  'webhook',
  '{
    "fields": [
      {
        "name": "webhook_url",
        "label": "Webhook URL",
        "type": "text",
        "description": "The URL to send the POST request to",
        "required": true,
        "placeholder": "https://example.com/webhook"
      },
      {
        "name": "query_params",
        "label": "Query Parameters",
        "type": "key_value_list",
        "description": "URL query parameters to append to the webhook URL",
        "required": false,
        "default": []
      },
      {
        "name": "headers",
        "label": "Headers",
        "type": "key_value_list",
        "description": "HTTP headers to include in the request",
        "required": false,
        "default": [{"key": "Content-Type", "value": "application/json"}]
      },
      {
        "name": "body",
        "label": "Request Body",
        "type": "key_value_list",
        "description": "Data to send in the request body (will be sent as JSON)",
        "required": false,
        "default": [],
        "supports_mapping": true
      }
    ]
  }'::jsonb,
  'Integration',
  'globe'
) ON CONFLICT (name) DO NOTHING;

-- Add comment
COMMENT ON TABLE workflow_actions IS 'Stores workflow action definitions with their configuration schemas';
COMMENT ON COLUMN workflow_actions.config_schema IS 'JSON schema defining required configuration fields for this action';

-- ============================================================================
-- MIGRATION 9: 20251016155741_create_workflow_executions_and_trigger_system.sql
-- ============================================================================
/*
  # Create Workflow Execution System

  1. New Tables
    - `workflow_executions` - Stores workflow execution logs
      - `id` (uuid, primary key) - Unique identifier
      - `automation_id` (uuid) - Reference to the automation/workflow
      - `trigger_type` (text) - Type of trigger that started this execution
      - `trigger_data` (jsonb) - The data from the trigger event
      - `status` (text) - Execution status (pending, running, completed, failed)
      - `steps_completed` (integer) - Number of steps completed
      - `total_steps` (integer) - Total number of steps in workflow
      - `error_message` (text) - Error message if failed
      - `started_at` (timestamptz) - When execution started
      - `completed_at` (timestamptz) - When execution completed
      - `created_at` (timestamptz) - Creation timestamp

  2. New Functions
    - `trigger_workflows_on_lead_insert()` - Function that triggers workflows when a new lead is added
    - This function will be called by a database trigger on the leads table

  3. Security
    - Enable RLS on `workflow_executions` table
    - Add policies for authenticated users to read and create executions

  4. Important Notes
    - When a new lead is inserted, all active workflows with LEADS trigger will be executed
    - Workflow execution is async and handled by edge functions
    - This migration creates the infrastructure for workflow execution
*/

-- Create workflow_executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES automations(id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  trigger_data jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  steps_completed integer DEFAULT 0,
  total_steps integer DEFAULT 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workflow_executions_automation_id ON workflow_executions(automation_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_trigger_type ON workflow_executions(trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_created_at ON workflow_executions(created_at DESC);

-- Enable RLS
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow anon to read workflow executions"
  ON workflow_executions
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to read workflow executions"
  ON workflow_executions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to insert workflow executions"
  ON workflow_executions
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to insert workflow executions"
  ON workflow_executions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update workflow executions"
  ON workflow_executions
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update workflow executions"
  ON workflow_executions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to trigger workflows when a new lead is inserted
CREATE OR REPLACE FUNCTION trigger_workflows_on_lead_insert()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
BEGIN
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
          'affiliate_id', NEW.affiliate_id
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
          'trigger_type', 'NEW_LEAD_ADDED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on leads table
DROP TRIGGER IF EXISTS trigger_workflows_on_new_lead ON leads;
CREATE TRIGGER trigger_workflows_on_new_lead
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_lead_insert();

-- Add comments
COMMENT ON TABLE workflow_executions IS 'Stores workflow execution logs and status';
COMMENT ON FUNCTION trigger_workflows_on_lead_insert() IS 'Triggers workflows when a new lead is inserted';

-- ============================================================================
-- MIGRATION 10: 20251016155840_update_workflow_trigger_to_call_edge_function.sql
-- ============================================================================
/*
  # Update Workflow Trigger to Call Edge Function

  1. Changes
    - Update trigger_workflows_on_lead_insert() function to call the execute-workflow edge function
    - Use pg_net extension to make HTTP requests to the edge function

  2. Important Notes
    - The edge function will handle the actual workflow execution
    - This keeps the database trigger lightweight and fast
    - Edge function can handle complex operations like HTTP requests
*/

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Update the function to call the edge function
CREATE OR REPLACE FUNCTION trigger_workflows_on_lead_insert()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
  supabase_url text;
  supabase_anon_key text;
  request_id bigint;
BEGIN
  -- Get Supabase URL and key from environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);
  
  -- Fallback to default if not set
  IF supabase_url IS NULL THEN
    supabase_url := 'https://' || current_setting('request.header.host', true);
  END IF;

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
          'affiliate_id', NEW.affiliate_id
        ),
        'pending',
        jsonb_array_length(automation_record.workflow_nodes) - 1,
        now()
      ) RETURNING id INTO execution_id;

      -- Call the edge function asynchronously using pg_net
      BEGIN
        SELECT net.http_post(
          url := supabase_url || '/functions/v1/execute-workflow',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || COALESCE(supabase_anon_key, '')
          ),
          body := jsonb_build_object(
            'execution_id', execution_id
          )
        ) INTO request_id;
      EXCEPTION
        WHEN OTHERS THEN
          -- If edge function call fails, just log it and continue
          RAISE NOTICE 'Failed to call edge function: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger
DROP TRIGGER IF EXISTS trigger_workflows_on_new_lead ON leads;
CREATE TRIGGER trigger_workflows_on_new_lead
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_lead_insert();

/*
================================================================================
END OF GROUP 3: LMS AND CONFIGURATION TABLES
================================================================================
Next Group: group-04-workflow-system-refinement.sql
*/
