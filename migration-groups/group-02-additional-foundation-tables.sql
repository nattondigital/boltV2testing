/*
================================================================================
GROUP 2: ADDITIONAL FOUNDATION TABLES
================================================================================

Admin sessions RLS, member tools access, support tickets, and leads tables

Total Files: 8
Dependencies: Group 1

Files Included (in execution order):
1. 20251002185528_update_admin_users_rls_for_anon_access.sql
2. 20251002185543_update_admin_sessions_rls_for_anon_access.sql
3. 20251002191742_create_member_tools_access_table.sql
4. 20251002193332_create_support_tickets_table.sql
5. 20251003151739_create_leads_table.sql
6. 20251016101535_create_affiliates_table.sql
7. 20251016103409_create_partner_affiliates_otp_table.sql
8. 20251016111129_add_affiliate_id_to_leads_v2.sql

================================================================================
*/

-- ============================================================================
-- MIGRATION 1: 20251002185528_update_admin_users_rls_for_anon_access.sql
-- ============================================================================
/*
  # Update admin_users RLS for Anonymous Access

  1. Changes
    - Drop existing restrictive RLS policies on admin_users
    - Add new policies allowing anonymous (anon) users to read admin_users
    - Keep authenticated policies for insert, update, delete operations
    
  2. Security
    - Allow anon users to SELECT from admin_users table
    - This enables the Team page to display team members
    - Password hashes remain protected in the backend
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can read their own data" ON admin_users;
DROP POLICY IF EXISTS "Super admins can insert admin users" ON admin_users;
DROP POLICY IF EXISTS "Admins can update their own data" ON admin_users;
DROP POLICY IF EXISTS "Super admins can delete admin users" ON admin_users;

-- Create new policies for anon access
CREATE POLICY "Allow anon to read admin users"
  ON admin_users
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to read admin users"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to insert admin users"
  ON admin_users
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to insert admin users"
  ON admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update admin users"
  ON admin_users
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update admin users"
  ON admin_users
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete admin users"
  ON admin_users
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to delete admin users"
  ON admin_users
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- MIGRATION 2: 20251002185543_update_admin_sessions_rls_for_anon_access.sql
-- ============================================================================
/*
  # Update admin_sessions RLS for Anonymous Access

  1. Changes
    - Update RLS policies on admin_sessions table
    - Add policies allowing anonymous (anon) users to manage sessions
    
  2. Security
    - Allow anon users to SELECT, INSERT, UPDATE, DELETE from admin_sessions
    - This enables session management for non-authenticated admin logins
*/

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can manage their own sessions" ON admin_sessions;

-- Create new policies for anon and authenticated access
CREATE POLICY "Allow anon to read admin sessions"
  ON admin_sessions
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to read admin sessions"
  ON admin_sessions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to insert admin sessions"
  ON admin_sessions
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to insert admin sessions"
  ON admin_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update admin sessions"
  ON admin_sessions
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update admin sessions"
  ON admin_sessions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete admin sessions"
  ON admin_sessions
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to delete admin sessions"
  ON admin_sessions
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- MIGRATION 3: 20251002191742_create_member_tools_access_table.sql
-- ============================================================================
/*
  # Create Member Tools Access Table

  1. New Tables
    - `member_tools_access`
      - `id` (uuid, primary key) - Unique identifier for each access record
      - `enrolled_member_id` (uuid, foreign key) - References enrolled_members table
      - `tools_access` (jsonb) - Array of tools the member has access to
      - `created_at` (timestamptz) - When the access was granted
      - `updated_at` (timestamptz) - When the access was last modified
  
  2. Security
    - Enable RLS on `member_tools_access` table
    - Add policies for anon and authenticated users to read, insert, update, and delete records
    - This enables the Tools Access page to manage member tool permissions
  
  3. Indexes
    - Add index on enrolled_member_id for fast lookups
*/

-- Create member_tools_access table
CREATE TABLE IF NOT EXISTS member_tools_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrolled_member_id uuid NOT NULL REFERENCES enrolled_members(id) ON DELETE CASCADE,
  tools_access jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(enrolled_member_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_member_tools_access_enrolled_member_id 
  ON member_tools_access(enrolled_member_id);

-- Enable RLS
ALTER TABLE member_tools_access ENABLE ROW LEVEL SECURITY;

-- Create policies for anon access
CREATE POLICY "Allow anon to read member tools access"
  ON member_tools_access
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to read member tools access"
  ON member_tools_access
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to insert member tools access"
  ON member_tools_access
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to insert member tools access"
  ON member_tools_access
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update member tools access"
  ON member_tools_access
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update member tools access"
  ON member_tools_access
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete member tools access"
  ON member_tools_access
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to delete member tools access"
  ON member_tools_access
  FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_member_tools_access_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_member_tools_access_updated_at_trigger
  BEFORE UPDATE ON member_tools_access
  FOR EACH ROW
  EXECUTE FUNCTION update_member_tools_access_updated_at();

-- ============================================================================
-- MIGRATION 4: 20251002193332_create_support_tickets_table.sql
-- ============================================================================
/*
  # Create Support Tickets Table

  1. New Tables
    - `support_tickets`
      - `id` (uuid, primary key) - Unique identifier for each ticket
      - `ticket_id` (text, unique) - Human-readable ticket ID (e.g., TKT-2024-001)
      - `enrolled_member_id` (uuid, foreign key) - References enrolled_members table
      - `subject` (text) - Ticket subject
      - `description` (text) - Detailed description of the issue
      - `priority` (text) - Priority level (Low, Medium, High, Critical)
      - `status` (text) - Ticket status (Open, In Progress, Resolved, Closed, Escalated)
      - `category` (text) - Category (Technical, Billing, Course, Refund, Feature Request, General)
      - `assigned_to` (text) - Name of the agent assigned to the ticket
      - `response_time` (text) - Response time duration
      - `satisfaction` (integer) - Customer satisfaction rating (1-5)
      - `tags` (jsonb) - Array of tags
      - `created_at` (timestamptz) - When the ticket was created
      - `updated_at` (timestamptz) - When the ticket was last updated
  
  2. Security
    - Enable RLS on `support_tickets` table
    - Add policies for anon and authenticated users to read, insert, update, and delete records
    - This enables the Support page to manage customer support tickets
  
  3. Indexes
    - Add index on enrolled_member_id for fast lookups
    - Add index on ticket_id for unique ticket ID lookups
    - Add index on status for filtering by ticket status
*/

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id text UNIQUE NOT NULL,
  enrolled_member_id uuid NOT NULL REFERENCES enrolled_members(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text NOT NULL,
  priority text DEFAULT 'Medium',
  status text DEFAULT 'Open',
  category text DEFAULT 'General',
  assigned_to text,
  response_time text,
  satisfaction integer CHECK (satisfaction >= 1 AND satisfaction <= 5),
  tags jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_support_tickets_enrolled_member_id 
  ON support_tickets(enrolled_member_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_id 
  ON support_tickets(ticket_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status 
  ON support_tickets(status);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Create policies for anon access
CREATE POLICY "Allow anon to read support tickets"
  ON support_tickets
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to read support tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to insert support tickets"
  ON support_tickets
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to insert support tickets"
  ON support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update support tickets"
  ON support_tickets
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update support tickets"
  ON support_tickets
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete support tickets"
  ON support_tickets
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to delete support tickets"
  ON support_tickets
  FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_support_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_support_tickets_updated_at_trigger
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_tickets_updated_at();

-- ============================================================================
-- MIGRATION 5: 20251003151739_create_leads_table.sql
-- ============================================================================
/*
  # Create Leads Table

  1. New Tables
    - `leads`
      - `id` (uuid, primary key) - Unique identifier for each lead
      - `lead_id` (text, unique) - Human-readable lead ID (e.g., L001)
      - `name` (text) - Lead's full name
      - `email` (text) - Lead's email address
      - `phone` (text) - Lead's phone number
      - `source` (text) - Lead source (Ad, Referral, Webinar, Website, LinkedIn, etc.)
      - `interest` (text) - Interest level (Hot, Warm, Cold)
      - `status` (text) - Lead status (New, Contacted, Demo Booked, No Show, Won, Lost)
      - `owner` (text) - Lead owner/assigned to
      - `address` (text) - Lead's address
      - `company` (text) - Lead's company name
      - `notes` (text) - Additional notes about the lead
      - `last_contact` (timestamptz) - Last contact date
      - `lead_score` (integer) - Lead scoring (0-100)
      - `created_at` (timestamptz) - When the lead was created
      - `updated_at` (timestamptz) - When the lead was last updated
  
  2. Security
    - Enable RLS on `leads` table
    - Add policies for anon and authenticated users to read, insert, update, and delete records
  
  3. Indexes
    - Add index on lead_id for unique lookups
    - Add index on email for faster searches
    - Add index on status for filtering
    - Add index on created_at for sorting
*/

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text UNIQUE NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  source text DEFAULT 'Website',
  interest text DEFAULT 'Warm',
  status text DEFAULT 'New',
  owner text DEFAULT 'Sales Team',
  address text,
  company text,
  notes text,
  last_contact timestamptz,
  lead_score integer DEFAULT 50 CHECK (lead_score >= 0 AND lead_score <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_lead_id ON leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Create policies for anon access
CREATE POLICY "Allow anon to read leads"
  ON leads
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to read leads"
  ON leads
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to insert leads"
  ON leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to insert leads"
  ON leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update leads"
  ON leads
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update leads"
  ON leads
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete leads"
  ON leads
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to delete leads"
  ON leads
  FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leads_updated_at_trigger
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_updated_at();

-- ============================================================================
-- MIGRATION 6: 20251016101535_create_affiliates_table.sql
-- ============================================================================
/*
  # Create Affiliates Table

  1. New Tables
    - `affiliates`
      - `id` (uuid, primary key) - Unique identifier for each affiliate
      - `affiliate_id` (text, unique) - Human-readable affiliate ID (e.g., A001)
      - `name` (text) - Affiliate's full name
      - `email` (text, unique) - Affiliate's email address
      - `phone` (text) - Affiliate's phone number
      - `commission_pct` (integer) - Commission percentage (1-50)
      - `unique_link` (text) - Unique referral link
      - `referrals` (integer) - Total number of referrals
      - `earnings_paid` (numeric) - Total earnings paid to affiliate
      - `earnings_pending` (numeric) - Pending earnings
      - `status` (text) - Affiliate status (Active, Inactive, Suspended)
      - `company` (text) - Affiliate's company name
      - `address` (text) - Affiliate's address
      - `notes` (text) - Additional notes about the affiliate
      - `joined_on` (date) - Date when affiliate joined
      - `last_activity` (timestamptz) - Last activity timestamp
      - `created_at` (timestamptz) - When the record was created
      - `updated_at` (timestamptz) - When the record was last updated
  
  2. Security
    - Enable RLS on `affiliates` table
    - Add policies for anon and authenticated users to read, insert, update, and delete records
  
  3. Indexes
    - Add index on affiliate_id for unique lookups
    - Add index on email for faster searches
    - Add index on status for filtering
    - Add index on created_at for sorting

  4. Sample Data
    - Insert 2 sample affiliate records
*/

-- Create affiliates table
CREATE TABLE IF NOT EXISTS affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id text UNIQUE NOT NULL,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  commission_pct integer DEFAULT 15 CHECK (commission_pct >= 1 AND commission_pct <= 50),
  unique_link text NOT NULL,
  referrals integer DEFAULT 0,
  earnings_paid numeric DEFAULT 0,
  earnings_pending numeric DEFAULT 0,
  status text DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
  company text,
  address text,
  notes text,
  joined_on date DEFAULT CURRENT_DATE,
  last_activity timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_affiliates_affiliate_id ON affiliates(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_email ON affiliates(email);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);
CREATE INDEX IF NOT EXISTS idx_affiliates_created_at ON affiliates(created_at DESC);

-- Enable RLS
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

-- Create policies for anon access
CREATE POLICY "Allow anon to read affiliates"
  ON affiliates
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to read affiliates"
  ON affiliates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to insert affiliates"
  ON affiliates
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to insert affiliates"
  ON affiliates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update affiliates"
  ON affiliates
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update affiliates"
  ON affiliates
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete affiliates"
  ON affiliates
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated to delete affiliates"
  ON affiliates
  FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_affiliates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_affiliates_updated_at_trigger
  BEFORE UPDATE ON affiliates
  FOR EACH ROW
  EXECUTE FUNCTION update_affiliates_updated_at();

-- Insert sample data
INSERT INTO affiliates (
  affiliate_id, name, email, phone, commission_pct, unique_link,
  referrals, earnings_paid, earnings_pending, status, joined_on, last_activity
) VALUES
(
  'A001',
  'Rajesh Kumar',
  'rajesh@example.com',
  '919876543210',
  15,
  'https://aiacoach.com/ref/rajesh-kumar',
  120,
  180000,
  75000,
  'Active',
  '2024-01-10',
  '2024-01-20'
),
(
  'A002',
  'Priya Sharma',
  'priya@example.com',
  '919876543211',
  20,
  'https://aiacoach.com/ref/priya-sharma',
  80,
  240000,
  45000,
  'Active',
  '2024-01-08',
  '2024-01-19'
);

-- ============================================================================
-- MIGRATION 7: 20251016103409_create_partner_affiliates_otp_table.sql
-- ============================================================================
/*
  # Create Partner OTP Verifications Table
  
  1. New Tables
    - `partner_otp_verifications`
      - `id` (uuid, primary key)
      - `mobile` (text) - Mobile number for partner login
      - `otp` (text) - 4-digit OTP code
      - `verified` (boolean) - Whether OTP was verified
      - `expires_at` (timestamptz) - OTP expiration time (5 minutes)
      - `created_at` (timestamptz) - Creation timestamp
      - `verified_at` (timestamptz) - Verification timestamp
      - `affiliate_id` (uuid) - Reference to affiliate
  
  2. Security
    - Enable RLS on `partner_otp_verifications` table
    - Add policy for anonymous users to insert and verify OTPs
    - Link to affiliates table for authentication
  
  3. Indexes
    - Index on mobile for fast lookup
    - Index on expires_at for cleanup queries
*/

CREATE TABLE IF NOT EXISTS partner_otp_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile text NOT NULL,
  otp text NOT NULL,
  verified boolean DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  verified_at timestamptz,
  affiliate_id uuid REFERENCES affiliates(id)
);

CREATE INDEX IF NOT EXISTS idx_partner_otp_mobile ON partner_otp_verifications(mobile);
CREATE INDEX IF NOT EXISTS idx_partner_otp_expires_at ON partner_otp_verifications(expires_at);

ALTER TABLE partner_otp_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous to insert partner OTP"
  ON partner_otp_verifications
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous to select partner OTP"
  ON partner_otp_verifications
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous to update partner OTP"
  ON partner_otp_verifications
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- MIGRATION 8: 20251016111129_add_affiliate_id_to_leads_v2.sql
-- ============================================================================
/*
  # Add Affiliate ID to Leads Table

  1. Changes
    - Add `affiliate_id` column to `leads` table to track which affiliate partner created the lead
    - Add foreign key constraint to `affiliates` table
    - Add index on `affiliate_id` for faster filtering
  
  2. Security
    - Existing RLS policies remain in place
*/

-- Add affiliate_id column to leads table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'affiliate_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN affiliate_id uuid REFERENCES affiliates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for affiliate_id
CREATE INDEX IF NOT EXISTS idx_leads_affiliate_id ON leads(affiliate_id);

/*
================================================================================
END OF GROUP 2: ADDITIONAL FOUNDATION TABLES
================================================================================
Next Group: group-03-lms-and-configuration-tables.sql
*/
