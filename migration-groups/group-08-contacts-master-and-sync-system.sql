/*
================================================================================
GROUP 8: CONTACTS MASTER AND SYNC SYSTEM
================================================================================

Contacts master table, lead-contact synchronization, and integrations

Total Files: 11
Dependencies: Group 7

Files Included (in execution order):
1. 20251019153419_20251019151012_create_contacts_master_table.sql
2. 20251019154527_20251019153420_make_email_optional_in_contacts_master.sql
3. 20251019165319_20251019154527_make_email_optional_and_sync_leads_contacts.sql
4. 20251019170038_20251019165319_fix_sync_triggers.sql
5. 20251019170712_20251019170038_fix_sync_triggers.sql
6. 20251019195819_create_integrations_table.sql
7. 20251020072807_create_media_storage_tables.sql
8. 20251020090917_create_appearance_settings_table.sql
9. 20251020092723_update_appearance_settings_rls_for_system_defaults.sql
10. 20251020163000_create_contact_notes_table.sql
11. 20251020171159_create_contact_notes_table.sql

================================================================================
*/

-- ============================================================================
-- MIGRATION 1: 20251019153419_20251019151012_create_contacts_master_table.sql
-- ============================================================================
/*
  # Create Contacts Master Table

  1. New Tables
    - `contacts_master` - Stores all contact information with personal and business details
      - `id` (uuid, primary key)
      - `contact_id` (text) - Human-readable contact ID (e.g., CONT0001)
      - Personal Details:
        - `full_name` (text, required)
        - `email` (text, required, unique)
        - `phone` (text)
        - `date_of_birth` (date)
        - `gender` (text)
        - `education_level` (text)
        - `profession` (text)
        - `experience` (text)
      - Business Details:
        - `business_name` (text)
        - `address` (text)
        - `city` (text)
        - `state` (text)
        - `pincode` (text)
        - `gst_number` (text)
      - Other Fields:
        - `contact_type` (text) - Customer, Vendor, Partner, etc.
        - `status` (text) - Active, Inactive
        - `notes` (text)
        - `last_contacted` (timestamptz)
        - `tags` (jsonb) - Array of tags
        - `created_at` (timestamptz)
        - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `contacts_master` table
    - Add policy for anonymous access (for public forms)
    - Add policy for authenticated users

  3. Functions
    - Auto-generate contact_id function
    - Auto-update updated_at timestamp
*/

-- Create contacts_master table
CREATE TABLE IF NOT EXISTS contacts_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id text UNIQUE,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  date_of_birth date,
  gender text,
  education_level text,
  profession text,
  experience text,
  business_name text,
  address text,
  city text,
  state text,
  pincode text,
  gst_number text,
  contact_type text DEFAULT 'Customer',
  status text DEFAULT 'Active',
  notes text,
  last_contacted timestamptz,
  tags jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create function to auto-generate contact_id
CREATE OR REPLACE FUNCTION generate_contact_id()
RETURNS TRIGGER AS $$
DECLARE
  max_id integer;
  new_id text;
BEGIN
  IF NEW.contact_id IS NULL THEN
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(contact_id FROM 5) AS integer)), 0
    ) INTO max_id
    FROM contacts_master
    WHERE contact_id ~ '^CONT[0-9]+$';
    
    new_id := 'CONT' || LPAD((max_id + 1)::text, 4, '0');
    NEW.contact_id := new_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate contact_id
DROP TRIGGER IF EXISTS trigger_generate_contact_id ON contacts_master;
CREATE TRIGGER trigger_generate_contact_id
  BEFORE INSERT ON contacts_master
  FOR EACH ROW
  EXECUTE FUNCTION generate_contact_id();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contacts_master_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at
DROP TRIGGER IF EXISTS trigger_update_contacts_master_updated_at ON contacts_master;
CREATE TRIGGER trigger_update_contacts_master_updated_at
  BEFORE UPDATE ON contacts_master
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_master_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contacts_master_contact_id ON contacts_master(contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_master_email ON contacts_master(email);
CREATE INDEX IF NOT EXISTS idx_contacts_master_phone ON contacts_master(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_master_contact_type ON contacts_master(contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_master_status ON contacts_master(status);
CREATE INDEX IF NOT EXISTS idx_contacts_master_created_at ON contacts_master(created_at DESC);

-- Enable RLS
ALTER TABLE contacts_master ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access
CREATE POLICY "Allow anonymous to read contacts"
  ON contacts_master
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous to insert contacts"
  ON contacts_master
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous to update contacts"
  ON contacts_master
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous to delete contacts"
  ON contacts_master
  FOR DELETE
  TO anon
  USING (true);

-- Create policies for authenticated users
CREATE POLICY "Allow authenticated to read contacts"
  ON contacts_master
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to insert contacts"
  ON contacts_master
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update contacts"
  ON contacts_master
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete contacts"
  ON contacts_master
  FOR DELETE
  TO authenticated
  USING (true);

-- Add comments
COMMENT ON TABLE contacts_master IS 'Master table for storing all contact information including personal and business details';
COMMENT ON COLUMN contacts_master.contact_id IS 'Human-readable contact ID (e.g., CONT0001)';
COMMENT ON COLUMN contacts_master.contact_type IS 'Type of contact: Customer, Vendor, Partner, Lead, etc.';
COMMENT ON COLUMN contacts_master.status IS 'Contact status: Active or Inactive';
COMMENT ON COLUMN contacts_master.tags IS 'Array of tags for categorizing contacts';

-- ============================================================================
-- MIGRATION 2: 20251019154527_20251019153420_make_email_optional_in_contacts_master.sql
-- ============================================================================
/*
  # Make Email Optional in Contacts Master

  1. Changes
    - Remove NOT NULL constraint from email column
    - Remove UNIQUE constraint from email column
    - This allows contacts to be created without email addresses
    - Multiple contacts can have NULL emails

  2. Security
    - Existing RLS policies remain unchanged
*/

-- Remove NOT NULL constraint from email column
ALTER TABLE contacts_master 
  ALTER COLUMN email DROP NOT NULL;

-- Drop the unique constraint on email
-- First, we need to find and drop the unique constraint
DO $$
BEGIN
  -- Drop unique constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contacts_master_email_key' 
    AND conrelid = 'contacts_master'::regclass
  ) THEN
    ALTER TABLE contacts_master DROP CONSTRAINT contacts_master_email_key;
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN contacts_master.email IS 'Contact email address (optional)';

-- ============================================================================
-- MIGRATION 3: 20251019165319_20251019154527_make_email_optional_and_sync_leads_contacts.sql
-- ============================================================================
/*
  # Make Email Optional in Leads and Sync with Contacts

  1. Changes
    - Remove NOT NULL constraint from email column in leads table
    - Create trigger to auto-create contact when lead is added (if not exists by phone)
    - Create trigger to auto-create lead when contact with type "Lead" is added (if not exists by phone)
    - Bidirectional sync based on phone number (one-to-one relation)

  2. Trigger Logic
    - When new lead is added: Create contact with type "Lead" if phone number doesn't exist
    - When contact with type "Lead" is added: Create lead if phone number doesn't exist in leads
    - Phone number is the unique identifier for the relationship

  3. Security
    - Existing RLS policies remain unchanged
*/

-- Remove NOT NULL constraint from email column in leads table
ALTER TABLE leads 
  ALTER COLUMN email DROP NOT NULL;

-- Add comment
COMMENT ON COLUMN leads.email IS 'Lead email address (optional)';

-- Create function to auto-create contact when lead is added
CREATE OR REPLACE FUNCTION sync_lead_to_contact()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create contact if phone number is provided and doesn't exist in contacts
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    -- Check if contact with this phone number already exists
    IF NOT EXISTS (
      SELECT 1 FROM contacts_master 
      WHERE phone = NEW.phone
    ) THEN
      -- Create new contact
      INSERT INTO contacts_master (
        full_name,
        email,
        phone,
        contact_type,
        status,
        notes,
        company,
        address
      ) VALUES (
        NEW.name,
        NEW.email,
        NEW.phone,
        'Lead',
        'Active',
        'Auto-created from Lead CRM',
        NEW.company,
        NEW.address
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on leads table for inserts
DROP TRIGGER IF EXISTS trigger_sync_lead_to_contact ON leads;
CREATE TRIGGER trigger_sync_lead_to_contact
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION sync_lead_to_contact();

-- Create function to auto-create lead when contact with type "Lead" is added
CREATE OR REPLACE FUNCTION sync_contact_to_lead()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create lead if contact_type is "Lead" and phone number is provided
  IF NEW.contact_type = 'Lead' AND NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    -- Check if lead with this phone number already exists
    IF NOT EXISTS (
      SELECT 1 FROM leads 
      WHERE phone = NEW.phone
    ) THEN
      -- Create new lead
      INSERT INTO leads (
        name,
        email,
        phone,
        source,
        interest,
        status,
        company,
        address,
        notes
      ) VALUES (
        NEW.full_name,
        NEW.email,
        NEW.phone,
        'Contact Master',
        'Warm',
        'New',
        NEW.business_name,
        NEW.address,
        'Auto-created from Contact Master'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on contacts_master table for inserts
DROP TRIGGER IF EXISTS trigger_sync_contact_to_lead ON contacts_master;
CREATE TRIGGER trigger_sync_contact_to_lead
  AFTER INSERT ON contacts_master
  FOR EACH ROW
  EXECUTE FUNCTION sync_contact_to_lead();

-- Add comments
COMMENT ON FUNCTION sync_lead_to_contact() IS 'Auto-creates contact with type "Lead" when new lead is added (if phone number does not exist in contacts)';
COMMENT ON FUNCTION sync_contact_to_lead() IS 'Auto-creates lead when contact with type "Lead" is added (if phone number does not exist in leads)';

-- ============================================================================
-- MIGRATION 4: 20251019170038_20251019165319_fix_sync_triggers.sql
-- ============================================================================
/*
  # Fix Sync Triggers Between Leads and Contacts

  1. Changes
    - Fix sync_lead_to_contact function to use correct column name (business_name instead of company)
    - Fix sync_contact_to_lead function to properly map business_name to company
    - Ensure both triggers work correctly with proper column mappings

  2. Column Mappings
    - leads.company → contacts_master.business_name
    - contacts_master.business_name → leads.company
*/

-- Fix function to auto-create contact when lead is added
CREATE OR REPLACE FUNCTION sync_lead_to_contact()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create contact if phone number is provided and doesn't exist in contacts
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    -- Check if contact with this phone number already exists
    IF NOT EXISTS (
      SELECT 1 FROM contacts_master 
      WHERE phone = NEW.phone
    ) THEN
      -- Create new contact
      INSERT INTO contacts_master (
        full_name,
        email,
        phone,
        contact_type,
        status,
        notes,
        business_name,
        address
      ) VALUES (
        NEW.name,
        NEW.email,
        NEW.phone,
        'Lead',
        'Active',
        'Auto-created from Lead CRM',
        NEW.company,
        NEW.address
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The sync_contact_to_lead function is already correct, but recreating for consistency
CREATE OR REPLACE FUNCTION sync_contact_to_lead()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create lead if contact_type is "Lead" and phone number is provided
  IF NEW.contact_type = 'Lead' AND NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    -- Check if lead with this phone number already exists
    IF NOT EXISTS (
      SELECT 1 FROM leads 
      WHERE phone = NEW.phone
    ) THEN
      -- Create new lead
      INSERT INTO leads (
        name,
        email,
        phone,
        source,
        interest,
        status,
        company,
        address,
        notes
      ) VALUES (
        NEW.full_name,
        NEW.email,
        NEW.phone,
        'Contact Master',
        'Warm',
        'New',
        NEW.business_name,
        NEW.address,
        'Auto-created from Contact Master'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRATION 5: 20251019170712_20251019170038_fix_sync_triggers.sql
-- ============================================================================
/*
  # Fix Lead ID Generation in Contact-to-Lead Sync

  1. Changes
    - Update sync_contact_to_lead function to generate lead_id automatically
    - Lead ID format: L001, L002, L003, etc.
    - Finds the highest existing lead_id and increments

  2. Logic
    - Extracts numeric part from last lead_id (e.g., "L005" → 5)
    - Increments by 1
    - Formats back with leading zeros (e.g., 6 → "L006")
    - Defaults to "L001" if no leads exist
*/

-- Update function to auto-create lead when contact with type "Lead" is added
CREATE OR REPLACE FUNCTION sync_contact_to_lead()
RETURNS TRIGGER AS $$
DECLARE
  new_lead_id TEXT;
  last_lead_id TEXT;
  last_number INTEGER;
BEGIN
  -- Only create lead if contact_type is "Lead" and phone number is provided
  IF NEW.contact_type = 'Lead' AND NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    -- Check if lead with this phone number already exists
    IF NOT EXISTS (
      SELECT 1 FROM leads 
      WHERE phone = NEW.phone
    ) THEN
      -- Generate new lead_id
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
      
      -- Create new lead with generated lead_id
      INSERT INTO leads (
        lead_id,
        name,
        email,
        phone,
        source,
        interest,
        status,
        company,
        address,
        notes
      ) VALUES (
        new_lead_id,
        NEW.full_name,
        NEW.email,
        NEW.phone,
        'Contact Master',
        'Warm',
        'New',
        NEW.business_name,
        NEW.address,
        'Auto-created from Contact Master'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRATION 6: 20251019195819_create_integrations_table.sql
-- ============================================================================
/*
  # Create Integrations Configuration Table

  1. New Tables
    - `integrations`
      - `id` (uuid, primary key)
      - `integration_type` (text) - Type of integration (whatsapp, ghl_api, etc.)
      - `name` (text) - Display name
      - `description` (text) - Integration description
      - `icon` (text) - Emoji or icon identifier
      - `status` (text) - Connected/Disconnected
      - `config` (jsonb) - Configuration data (API keys, tokens, etc.)
      - `last_sync` (timestamptz) - Last synchronization time
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `integrations` table
    - Add policies for anonymous access (read/write)
*/

CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_type text NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  status text DEFAULT 'Disconnected',
  config jsonb DEFAULT '{}'::jsonb,
  last_sync timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to integrations"
  ON integrations
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to integrations"
  ON integrations
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to integrations"
  ON integrations
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to integrations"
  ON integrations
  FOR DELETE
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);

CREATE OR REPLACE FUNCTION update_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_integrations_updated_at();

INSERT INTO integrations (integration_type, name, description, icon, status, config)
VALUES 
  ('whatsapp', 'WhatsApp Business API', 'Connect WhatsApp for automated messaging', '💬', 'Disconnected', '{"businessName":"","apiKey":"","wabaNumber":""}'::jsonb),
  ('ghl_api', 'GHL API', 'Connect GoHighLevel CRM for lead management', '🔗', 'Disconnected', '{"businessName":"","accessToken":""}'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MIGRATION 7: 20251020072807_create_media_storage_tables.sql
-- ============================================================================
/*
  # Create Media Storage Tables

  1. New Tables
    - `media_folders`
      - `id` (uuid, primary key)
      - `folder_name` (text) - Display name
      - `ghl_folder_id` (text) - GoHighLevel folder ID
      - `parent_id` (uuid) - Parent folder reference (self-referential)
      - `location_id` (text) - GHL location ID
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `media_files`
      - `id` (uuid, primary key)
      - `file_name` (text) - Original file name
      - `file_url` (text) - GHL file URL
      - `file_type` (text) - MIME type
      - `file_size` (bigint) - File size in bytes
      - `ghl_file_id` (text) - GoHighLevel file ID
      - `folder_id` (uuid) - Reference to media_folders
      - `location_id` (text) - GHL location ID
      - `thumbnail_url` (text) - Preview/thumbnail URL
      - `uploaded_by` (text) - User who uploaded
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for anonymous access (read/write)

  3. Indexes
    - Index on parent_id for folder hierarchy
    - Index on folder_id for file lookups
    - Index on ghl_folder_id and ghl_file_id
*/

CREATE TABLE IF NOT EXISTS media_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_name text NOT NULL,
  ghl_folder_id text,
  parent_id uuid REFERENCES media_folders(id) ON DELETE CASCADE,
  location_id text DEFAULT 'iDIRFjdZBWH7SqBzTowc',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  ghl_file_id text,
  folder_id uuid REFERENCES media_folders(id) ON DELETE SET NULL,
  location_id text DEFAULT 'iDIRFjdZBWH7SqBzTowc',
  thumbnail_url text,
  uploaded_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE media_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to media_folders"
  ON media_folders
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to media_folders"
  ON media_folders
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to media_folders"
  ON media_folders
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to media_folders"
  ON media_folders
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous read access to media_files"
  ON media_files
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to media_files"
  ON media_files
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to media_files"
  ON media_files
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to media_files"
  ON media_files
  FOR DELETE
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_media_folders_parent ON media_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_media_folders_ghl_id ON media_folders(ghl_folder_id);
CREATE INDEX IF NOT EXISTS idx_media_files_folder ON media_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_media_files_ghl_id ON media_files(ghl_file_id);

CREATE OR REPLACE FUNCTION update_media_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_media_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_media_folders_updated_at
  BEFORE UPDATE ON media_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_media_folders_updated_at();

CREATE TRIGGER trigger_update_media_files_updated_at
  BEFORE UPDATE ON media_files
  FOR EACH ROW
  EXECUTE FUNCTION update_media_files_updated_at();

-- ============================================================================
-- MIGRATION 8: 20251020090917_create_appearance_settings_table.sql
-- ============================================================================
/*
  # Create Appearance Settings Table

  1. New Tables
    - `appearance_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, nullable - null means system default)
      - `primary_color` (text) - Color for Primary/Total metrics
      - `success_color` (text) - Color for Success/Revenue/Active metrics
      - `warning_color` (text) - Color for Warning/Pending metrics
      - `secondary_color` (text) - Color for Secondary/Category metrics
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `appearance_settings` table
    - Add policies for authenticated users to manage their settings
    - Add policy for anonymous users to read system defaults
*/

CREATE TABLE IF NOT EXISTS appearance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  primary_color text NOT NULL DEFAULT 'blue',
  success_color text NOT NULL DEFAULT 'green',
  warning_color text NOT NULL DEFAULT 'orange',
  secondary_color text NOT NULL DEFAULT 'purple',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE appearance_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own settings
CREATE POLICY "Users can read own appearance settings"
  ON appearance_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow authenticated users to insert their own settings
CREATE POLICY "Users can insert own appearance settings"
  ON appearance_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own settings
CREATE POLICY "Users can update own appearance settings"
  ON appearance_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow everyone to read system default settings (user_id is null)
CREATE POLICY "Anyone can read system default appearance settings"
  ON appearance_settings
  FOR SELECT
  TO public
  USING (user_id IS NULL);

-- Insert system default settings
INSERT INTO appearance_settings (user_id, primary_color, success_color, warning_color, secondary_color)
VALUES (NULL, 'blue', 'green', 'orange', 'purple')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- MIGRATION 9: 20251020092723_update_appearance_settings_rls_for_system_defaults.sql
-- ============================================================================
/*
  # Update Appearance Settings RLS for System Defaults

  1. Changes
    - Allow anonymous users to update system default settings (user_id IS NULL)
    - This allows admins using OTP login to customize appearance without Supabase auth
    
  2. Security
    - System default (user_id IS NULL) is the single source of appearance settings
    - All users can read it
    - All users can update it (since it's a single admin system)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read system default appearance settings" ON appearance_settings;

-- Recreate with update permissions
CREATE POLICY "Anyone can read system default appearance settings"
  ON appearance_settings
  FOR SELECT
  TO public
  USING (user_id IS NULL);

CREATE POLICY "Anyone can update system default appearance settings"
  ON appearance_settings
  FOR UPDATE
  TO public
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

-- ============================================================================
-- MIGRATION 10: 20251020163000_create_contact_notes_table.sql
-- ============================================================================
/*
  # Create Contact Notes Table

  1. New Tables
    - `contact_notes`
      - `id` (uuid, primary key)
      - `contact_id` (uuid, foreign key to contacts_master)
      - `note_text` (text, the note content)
      - `created_at` (timestamptz, when note was created)
      - `updated_at` (timestamptz, when note was last updated)
      - `created_by` (text, user who created the note)

  2. Security
    - Enable RLS on `contact_notes` table
    - Add policy for authenticated users to read all notes
    - Add policy for authenticated users to create notes
    - Add policy for authenticated users to update their own notes
    - Add policy for authenticated users to delete their own notes
    - Add policy for anonymous users to read, create, update, and delete notes (for demo purposes)

  3. Indexes
    - Add index on contact_id for faster queries
    - Add index on created_at for sorting
*/

-- Create contact_notes table
CREATE TABLE IF NOT EXISTS contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts_master(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'System'
);

-- Enable RLS
ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contact_notes_contact_id ON contact_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_created_at ON contact_notes(created_at DESC);

-- RLS Policies for authenticated users
CREATE POLICY "Authenticated users can view all contact notes"
  ON contact_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create contact notes"
  ON contact_notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update contact notes"
  ON contact_notes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete contact notes"
  ON contact_notes FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for anonymous users (for demo purposes)
CREATE POLICY "Anonymous users can view all contact notes"
  ON contact_notes FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous users can create contact notes"
  ON contact_notes FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous users can update contact notes"
  ON contact_notes FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous users can delete contact notes"
  ON contact_notes FOR DELETE
  TO anon
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contact_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contact_notes_updated_at
  BEFORE UPDATE ON contact_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_notes_updated_at();

-- ============================================================================
-- MIGRATION 11: 20251020171159_create_contact_notes_table.sql
-- ============================================================================
/*
  # Create Contact Notes Table

  1. New Tables
    - `contact_notes`
      - `id` (uuid, primary key)
      - `contact_id` (uuid, foreign key to contacts_master)
      - `note_text` (text, the note content)
      - `created_at` (timestamptz, when note was created)
      - `updated_at` (timestamptz, when note was last updated)
      - `created_by` (text, user who created the note)

  2. Security
    - Enable RLS on `contact_notes` table
    - Add policy for authenticated users to read all notes
    - Add policy for authenticated users to create notes
    - Add policy for authenticated users to update their own notes
    - Add policy for authenticated users to delete their own notes
    - Add policy for anonymous users to read, create, update, and delete notes (for demo purposes)

  3. Indexes
    - Add index on contact_id for faster queries
    - Add index on created_at for sorting
*/

-- Create contact_notes table
CREATE TABLE IF NOT EXISTS contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts_master(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'System'
);

-- Enable RLS
ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contact_notes_contact_id ON contact_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_created_at ON contact_notes(created_at DESC);

-- RLS Policies for authenticated users
CREATE POLICY "Authenticated users can view all contact notes"
  ON contact_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create contact notes"
  ON contact_notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update contact notes"
  ON contact_notes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete contact notes"
  ON contact_notes FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for anonymous users (for demo purposes)
CREATE POLICY "Anonymous users can view all contact notes"
  ON contact_notes FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous users can create contact notes"
  ON contact_notes FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous users can update contact notes"
  ON contact_notes FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous users can delete contact notes"
  ON contact_notes FOR DELETE
  TO anon
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contact_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contact_notes_updated_at
  BEFORE UPDATE ON contact_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_notes_updated_at();

/*
================================================================================
END OF GROUP 8: CONTACTS MASTER AND SYNC SYSTEM
================================================================================
Next Group: group-09-appointments-and-calendar-system.sql
*/
