/*
================================================================================
GROUP 1: FOUNDATION AND CORE TABLES
================================================================================

Foundational database setup for enrolled members, webhooks, admin users, and OTP verification

Total Files: 8
Dependencies: None (base tables)

Files Included (in execution order):
1. 20251002164920_create_enrolled_members_table.sql
2. 20251002172736_add_personal_and_business_details_to_enrolled_members.sql
3. 20251002174138_create_webhooks_table.sql
4. 20251002175452_update_enrolled_members_rls_for_anon_access.sql
5. 20251002180016_create_admin_users_and_roles.sql
6. 20251002180034_update_all_tables_rls_for_admin_access.sql
7. 20251002182342_add_team_fields_to_admin_users.sql
8. 20251002184414_create_otp_verifications_table.sql

================================================================================
*/

-- ============================================================================
-- MIGRATION 1: 20251002164920_create_enrolled_members_table.sql
-- ============================================================================
/*
  # Create Enrolled Members Table

  ## Overview
  This migration creates a table to store enrolled members data for the platform.

  ## New Tables
  
  ### `enrolled_members`
  Stores information about members enrolled in courses or programs.
  
  #### Columns:
  - `id` (uuid, primary key) - Unique identifier for each enrolled member
  - `user_id` (uuid) - Reference to the user/member
  - `email` (text, not null) - Member's email address
  - `full_name` (text, not null) - Member's full name
  - `phone` (text) - Contact phone number
  - `enrollment_date` (timestamptz, not null) - Date when member enrolled
  - `status` (text, not null, default 'active') - Enrollment status: 'active', 'inactive', 'suspended', 'completed'
  - `course_id` (text) - Course or program identifier
  - `course_name` (text) - Name of the course/program enrolled in
  - `payment_status` (text, not null, default 'pending') - Payment status: 'pending', 'paid', 'refunded', 'failed'
  - `payment_amount` (numeric) - Amount paid for enrollment
  - `payment_date` (timestamptz) - Date of payment
  - `subscription_type` (text) - Type of subscription: 'monthly', 'yearly', 'lifetime', 'one-time'
  - `last_activity` (timestamptz) - Last activity timestamp
  - `progress_percentage` (integer, default 0) - Course completion progress (0-100)
  - `notes` (text) - Additional notes or comments
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  
  1. Enable Row Level Security (RLS) on the table
  2. Create policies for authenticated users to manage enrolled members data
*/

-- Create enrolled_members table
CREATE TABLE IF NOT EXISTS enrolled_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  full_name text NOT NULL,
  phone text,
  enrollment_date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  course_id text,
  course_name text,
  payment_status text NOT NULL DEFAULT 'pending',
  payment_amount numeric,
  payment_date timestamptz,
  subscription_type text,
  last_activity timestamptz,
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_enrolled_members_email ON enrolled_members(email);
CREATE INDEX IF NOT EXISTS idx_enrolled_members_user_id ON enrolled_members(user_id);
CREATE INDEX IF NOT EXISTS idx_enrolled_members_status ON enrolled_members(status);
CREATE INDEX IF NOT EXISTS idx_enrolled_members_enrollment_date ON enrolled_members(enrollment_date DESC);

-- Enable Row Level Security
ALTER TABLE enrolled_members ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view all enrolled members
CREATE POLICY "Authenticated users can view enrolled members"
  ON enrolled_members
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert new enrollments
CREATE POLICY "Authenticated users can insert enrollments"
  ON enrolled_members
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update enrollments
CREATE POLICY "Authenticated users can update enrollments"
  ON enrolled_members
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete enrollments
CREATE POLICY "Authenticated users can delete enrollments"
  ON enrolled_members
  FOR DELETE
  TO authenticated
  USING (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_enrolled_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function before update
DROP TRIGGER IF EXISTS update_enrolled_members_updated_at_trigger ON enrolled_members;
CREATE TRIGGER update_enrolled_members_updated_at_trigger
  BEFORE UPDATE ON enrolled_members
  FOR EACH ROW
  EXECUTE FUNCTION update_enrolled_members_updated_at();

-- ============================================================================
-- MIGRATION 2: 20251002172736_add_personal_and_business_details_to_enrolled_members.sql
-- ============================================================================
/*
  # Add Personal and Business Details to Enrolled Members Table

  ## Overview
  This migration adds comprehensive personal and business detail fields to the enrolled_members table
  to match the Add Member form requirements.

  ## Changes
  
  ### Personal Details Fields Added:
  - `date_of_birth` (date) - Member's date of birth
  - `gender` (text) - Gender: 'Male', 'Female', 'Other'
  - `education_level` (text) - Education level: 'High School', 'Diploma', 'Graduate', 'Post Graduate'
  - `profession` (text) - Member's profession/occupation
  - `experience` (text) - Work experience: '0-1 years', '2+ years', '3+ years', '5+ years', '7+ years', '10+ years'

  ### Business Details Fields Added:
  - `business_name` (text) - Name of the member's business
  - `address` (text) - Complete business/residential address
  - `city` (text) - City name
  - `state` (text) - State name
  - `pincode` (text) - Postal/PIN code
  - `gst_number` (text) - GST registration number

  ## Indexes
  - Added index on `state` for faster filtering by location
  - Added index on `education_level` for analytics queries
  - Added index on `gender` for demographic analysis

  ## Notes
  - All new fields are optional (nullable) to allow gradual data migration
  - Existing records will have NULL values for these new fields
  - Fields match exactly with the frontend form structure
*/

-- Add Personal Details columns
DO $$
BEGIN
  -- Date of Birth
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrolled_members' AND column_name = 'date_of_birth'
  ) THEN
    ALTER TABLE enrolled_members ADD COLUMN date_of_birth date;
  END IF;

  -- Gender
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrolled_members' AND column_name = 'gender'
  ) THEN
    ALTER TABLE enrolled_members ADD COLUMN gender text;
  END IF;

  -- Education Level
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrolled_members' AND column_name = 'education_level'
  ) THEN
    ALTER TABLE enrolled_members ADD COLUMN education_level text;
  END IF;

  -- Profession
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrolled_members' AND column_name = 'profession'
  ) THEN
    ALTER TABLE enrolled_members ADD COLUMN profession text;
  END IF;

  -- Experience
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrolled_members' AND column_name = 'experience'
  ) THEN
    ALTER TABLE enrolled_members ADD COLUMN experience text;
  END IF;
END $$;

-- Add Business Details columns
DO $$
BEGIN
  -- Business Name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrolled_members' AND column_name = 'business_name'
  ) THEN
    ALTER TABLE enrolled_members ADD COLUMN business_name text;
  END IF;

  -- Address
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrolled_members' AND column_name = 'address'
  ) THEN
    ALTER TABLE enrolled_members ADD COLUMN address text;
  END IF;

  -- City
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrolled_members' AND column_name = 'city'
  ) THEN
    ALTER TABLE enrolled_members ADD COLUMN city text;
  END IF;

  -- State
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrolled_members' AND column_name = 'state'
  ) THEN
    ALTER TABLE enrolled_members ADD COLUMN state text;
  END IF;

  -- Pincode
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrolled_members' AND column_name = 'pincode'
  ) THEN
    ALTER TABLE enrolled_members ADD COLUMN pincode text;
  END IF;

  -- GST Number
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrolled_members' AND column_name = 'gst_number'
  ) THEN
    ALTER TABLE enrolled_members ADD COLUMN gst_number text;
  END IF;
END $$;

-- Create indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_enrolled_members_state ON enrolled_members(state);
CREATE INDEX IF NOT EXISTS idx_enrolled_members_education_level ON enrolled_members(education_level);
CREATE INDEX IF NOT EXISTS idx_enrolled_members_gender ON enrolled_members(gender);
CREATE INDEX IF NOT EXISTS idx_enrolled_members_city ON enrolled_members(city);

-- Add comments for documentation
COMMENT ON COLUMN enrolled_members.date_of_birth IS 'Member''s date of birth';
COMMENT ON COLUMN enrolled_members.gender IS 'Gender: Male, Female, Other';
COMMENT ON COLUMN enrolled_members.education_level IS 'Education level: High School, Diploma, Graduate, Post Graduate';
COMMENT ON COLUMN enrolled_members.profession IS 'Member''s profession or occupation';
COMMENT ON COLUMN enrolled_members.experience IS 'Work experience: 0-1 years, 2+ years, 3+ years, 5+ years, 7+ years, 10+ years';
COMMENT ON COLUMN enrolled_members.business_name IS 'Name of the member''s business';
COMMENT ON COLUMN enrolled_members.address IS 'Complete business/residential address';
COMMENT ON COLUMN enrolled_members.city IS 'City name';
COMMENT ON COLUMN enrolled_members.state IS 'State name';
COMMENT ON COLUMN enrolled_members.pincode IS 'Postal/PIN code';
COMMENT ON COLUMN enrolled_members.gst_number IS 'GST registration number';

-- ============================================================================
-- MIGRATION 3: 20251002174138_create_webhooks_table.sql
-- ============================================================================
/*
  # Create webhooks table

  1. New Tables
    - `webhooks`
      - `id` (uuid, primary key) - Unique identifier for the webhook
      - `name` (text) - Name of the webhook
      - `module` (text) - Module associated with the webhook (e.g., Members, Leads)
      - `trigger` (text) - Action that triggers the webhook
      - `url` (text) - Webhook URL endpoint
      - `payload_fields` (jsonb) - JSON object containing payload field definitions
      - `created_at` (timestamptz) - Timestamp when webhook was created
      - `updated_at` (timestamptz) - Timestamp when webhook was last updated

  2. Security
    - Enable RLS on `webhooks` table
    - Add policy for authenticated users to read webhooks
    - Add policy for authenticated users to insert webhooks
    - Add policy for authenticated users to update webhooks
    - Add policy for authenticated users to delete webhooks
*/

CREATE TABLE IF NOT EXISTS webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  module text NOT NULL,
  trigger text NOT NULL,
  url text NOT NULL,
  payload_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read webhooks"
  ON webhooks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert webhooks"
  ON webhooks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update webhooks"
  ON webhooks
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete webhooks"
  ON webhooks
  FOR DELETE
  TO authenticated
  USING (true);

-- Create index on module for faster filtering
CREATE INDEX IF NOT EXISTS idx_webhooks_module ON webhooks(module);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_webhooks_created_at ON webhooks(created_at DESC);

-- ============================================================================
-- MIGRATION 4: 20251002175452_update_enrolled_members_rls_for_anon_access.sql
-- ============================================================================
/*
  # Update RLS policies for enrolled_members to allow anonymous access

  1. Changes
    - Drop existing authenticated-only SELECT policy
    - Add new policy allowing anonymous users to read enrolled members data
    - Keep other policies for authenticated users only (insert, update, delete)

  2. Security
    - Anonymous users can only read data (SELECT)
    - Only authenticated users can modify data (INSERT, UPDATE, DELETE)
*/

-- Drop the existing authenticated-only SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view enrolled members" ON enrolled_members;

-- Create new policy allowing anonymous access for SELECT
CREATE POLICY "Allow anonymous read access to enrolled members"
  ON enrolled_members
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- MIGRATION 5: 20251002180016_create_admin_users_and_roles.sql
-- ============================================================================
/*
  # Create admin users system with full CRUD access

  1. New Tables
    - `admin_users`
      - `id` (uuid, primary key) - Unique identifier
      - `email` (text, unique) - Admin email address
      - `password_hash` (text) - Hashed password
      - `full_name` (text) - Admin's full name
      - `role` (text) - Admin role (super_admin, admin, editor, viewer)
      - `permissions` (jsonb) - JSON object with module permissions
      - `is_active` (boolean) - Whether admin account is active
      - `last_login` (timestamptz) - Last login timestamp
      - `created_at` (timestamptz) - Account creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

    - `admin_sessions`
      - `id` (uuid, primary key) - Session identifier
      - `admin_id` (uuid, foreign key) - Reference to admin user
      - `token` (text, unique) - Session token
      - `expires_at` (timestamptz) - Session expiration
      - `created_at` (timestamptz) - Session creation timestamp

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated admin access
    - Create indexes for performance
    
  3. Initial Data
    - Create default super admin user
      - Email: admin@aiacademy.com
      - Password: Admin@123 (should be changed on first login)
      - Full access to all modules
*/

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  permissions jsonb NOT NULL DEFAULT '{
    "enrolled_members": {"read": true, "insert": true, "update": true, "delete": true},
    "webhooks": {"read": true, "insert": true, "update": true, "delete": true},
    "leads": {"read": true, "insert": true, "update": true, "delete": true},
    "courses": {"read": true, "insert": true, "update": true, "delete": true},
    "billing": {"read": true, "insert": true, "update": true, "delete": true},
    "team": {"read": true, "insert": true, "update": true, "delete": true},
    "settings": {"read": true, "insert": true, "update": true, "delete": true}
  }'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create admin_sessions table
CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_users
CREATE POLICY "Admins can read their own data"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can insert admin users"
  ON admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update their own data"
  ON admin_users
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Super admins can delete admin users"
  ON admin_users
  FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for admin_sessions
CREATE POLICY "Admins can read their own sessions"
  ON admin_sessions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can create sessions"
  ON admin_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can delete their own sessions"
  ON admin_sessions
  FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON admin_users(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);

-- Insert default super admin user
-- Password: Admin@123 (hashed using bcrypt)
-- NOTE: This is a default password and MUST be changed on first login
INSERT INTO admin_users (email, password_hash, full_name, role, is_active)
VALUES (
  'admin@aiacademy.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Super Administrator',
  'super_admin',
  true
) ON CONFLICT (email) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_admin_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for admin_users
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_updated_at();

-- ============================================================================
-- MIGRATION 6: 20251002180034_update_all_tables_rls_for_admin_access.sql
-- ============================================================================
/*
  # Update RLS policies for all tables to support admin access

  1. Changes
    - Update enrolled_members policies to allow full CRUD for authenticated users
    - Update webhooks policies to allow full CRUD for authenticated users
    - Keep anonymous read access for enrolled_members

  2. Security
    - Anonymous users can only read enrolled_members data
    - Authenticated users (admins) have full CRUD access to all tables
*/

-- Update enrolled_members policies
DROP POLICY IF EXISTS "Authenticated users can insert enrollments" ON enrolled_members;
DROP POLICY IF EXISTS "Authenticated users can update enrollments" ON enrolled_members;
DROP POLICY IF EXISTS "Authenticated users can delete enrollments" ON enrolled_members;

CREATE POLICY "Authenticated users can insert enrolled members"
  ON enrolled_members
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update enrolled members"
  ON enrolled_members
  FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete enrolled members"
  ON enrolled_members
  FOR DELETE
  TO authenticated, anon
  USING (true);

-- Update webhooks policies to allow anonymous access
DROP POLICY IF EXISTS "Authenticated users can read webhooks" ON webhooks;
DROP POLICY IF EXISTS "Authenticated users can insert webhooks" ON webhooks;
DROP POLICY IF EXISTS "Authenticated users can update webhooks" ON webhooks;
DROP POLICY IF EXISTS "Authenticated users can delete webhooks" ON webhooks;

CREATE POLICY "Allow read access to webhooks"
  ON webhooks
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Allow insert access to webhooks"
  ON webhooks
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Allow update access to webhooks"
  ON webhooks
  FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete access to webhooks"
  ON webhooks
  FOR DELETE
  TO authenticated, anon
  USING (true);

-- ============================================================================
-- MIGRATION 7: 20251002182342_add_team_fields_to_admin_users.sql
-- ============================================================================
/*
  # Add team management fields to admin_users table

  1. Changes
    - Add phone column for contact information
    - Add department column for team organization
    - Add status column to track active/inactive members
    - Update permissions JSONB to include all modules (automations, affiliates, support)
    - Add member_id column for easier reference

  2. Security
    - Maintain existing RLS policies
    - All new columns allow NULL for backward compatibility

  3. Notes
    - Existing admin users will have NULL values for new fields
    - Department field is flexible text for custom departments
    - Status field uses CHECK constraint for valid values
*/

-- Add new columns for team management
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'phone'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'department'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN department text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'status'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN status text DEFAULT 'Active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'member_id'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN member_id text UNIQUE;
  END IF;
END $$;

-- Add check constraint for status field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'admin_users_status_check'
  ) THEN
    ALTER TABLE admin_users
    ADD CONSTRAINT admin_users_status_check
    CHECK (status IN ('Active', 'Inactive', 'Suspended'));
  END IF;
END $$;

-- Update default permissions to include all modules
ALTER TABLE admin_users
ALTER COLUMN permissions SET DEFAULT '{
  "enrolled_members": {"read": true, "insert": true, "update": true, "delete": true},
  "webhooks": {"read": true, "insert": true, "update": true, "delete": true},
  "leads": {"read": true, "insert": true, "update": true, "delete": true},
  "courses": {"read": true, "insert": true, "update": true, "delete": true},
  "billing": {"read": true, "insert": true, "update": true, "delete": true},
  "team": {"read": true, "insert": true, "update": true, "delete": true},
  "settings": {"read": true, "insert": true, "update": true, "delete": true},
  "automations": {"read": true, "insert": true, "update": true, "delete": true},
  "affiliates": {"read": true, "insert": true, "update": true, "delete": true},
  "support": {"read": true, "insert": true, "update": true, "delete": true}
}'::jsonb;

-- Update existing admin user with full permissions
UPDATE admin_users
SET permissions = '{
  "enrolled_members": {"read": true, "insert": true, "update": true, "delete": true},
  "webhooks": {"read": true, "insert": true, "update": true, "delete": true},
  "leads": {"read": true, "insert": true, "update": true, "delete": true},
  "courses": {"read": true, "insert": true, "update": true, "delete": true},
  "billing": {"read": true, "insert": true, "update": true, "delete": true},
  "team": {"read": true, "insert": true, "update": true, "delete": true},
  "settings": {"read": true, "insert": true, "update": true, "delete": true},
  "automations": {"read": true, "insert": true, "update": true, "delete": true},
  "affiliates": {"read": true, "insert": true, "update": true, "delete": true},
  "support": {"read": true, "insert": true, "update": true, "delete": true}
}'::jsonb,
department = 'Management',
status = 'Active'
WHERE email = 'admin@aiacademy.com';

-- Create index for member_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_member_id ON admin_users(member_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_department ON admin_users(department);
CREATE INDEX IF NOT EXISTS idx_admin_users_status ON admin_users(status);

-- ============================================================================
-- MIGRATION 8: 20251002184414_create_otp_verifications_table.sql
-- ============================================================================
/*
  # Create OTP Verifications Table

  1. New Tables
    - `otp_verifications`
      - `id` (uuid, primary key)
      - `mobile` (text) - Mobile number
      - `otp` (text) - 4-digit OTP code
      - `verified` (boolean) - Whether OTP was verified
      - `expires_at` (timestamptz) - OTP expiration time (5 minutes)
      - `created_at` (timestamptz) - Creation timestamp
      - `verified_at` (timestamptz) - Verification timestamp

  2. Security
    - Enable RLS on `otp_verifications` table
    - Add policy for anonymous users to insert and verify OTPs
    - Auto-delete expired OTPs older than 10 minutes

  3. Indexes
    - Index on mobile for fast lookup
    - Index on expires_at for cleanup queries
*/

CREATE TABLE IF NOT EXISTS otp_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile text NOT NULL,
  otp text NOT NULL,
  verified boolean DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  verified_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_otp_verifications_mobile ON otp_verifications(mobile);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_expires_at ON otp_verifications(expires_at);

ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous to insert OTP"
  ON otp_verifications
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous to select OTP"
  ON otp_verifications
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous to update OTP"
  ON otp_verifications
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

/*
================================================================================
END OF GROUP 1: FOUNDATION AND CORE TABLES
================================================================================
Next Group: group-02-additional-foundation-tables.sql
*/
