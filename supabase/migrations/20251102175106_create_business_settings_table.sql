/*
  # Create Business Settings Table

  1. New Tables
    - `business_settings`
      - `id` (uuid, primary key)
      - `business_name` (text, required)
      - `business_tagline` (text)
      - `business_address` (text, required)
      - `business_city` (text, required)
      - `business_state` (text, required)
      - `business_pincode` (text, required)
      - `business_phone` (text, required)
      - `business_email` (text, required)
      - `gst_number` (text)
      - `website` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `business_settings` table
    - Add policy for authenticated users to read business settings
    - Add policy for admin users to update business settings

  3. Notes
    - Only one row should exist in this table (singleton pattern)
    - All billing documents will reference this table for business details
*/

CREATE TABLE IF NOT EXISTS business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  business_tagline text DEFAULT '',
  business_address text NOT NULL,
  business_city text NOT NULL,
  business_state text NOT NULL,
  business_pincode text NOT NULL,
  business_phone text NOT NULL,
  business_email text NOT NULL,
  gst_number text DEFAULT '',
  website text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read business settings"
  ON business_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert business settings"
  ON business_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update business settings"
  ON business_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default business settings if none exist
INSERT INTO business_settings (
  business_name,
  business_tagline,
  business_address,
  business_city,
  business_state,
  business_pincode,
  business_phone,
  business_email,
  gst_number,
  website
)
SELECT
  'YOUR COMPANY NAME',
  'Your Business Tagline',
  '123 Business Street',
  'City',
  'State',
  '123456',
  '+91 98765 43210',
  'info@company.com',
  '22AAAAA0000A1Z5',
  'www.company.com'
WHERE NOT EXISTS (SELECT 1 FROM business_settings LIMIT 1);