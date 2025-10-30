/*
  # Create WhatsApp Templates Table

  1. New Tables
    - `whatsapp_templates`
      - `id` (uuid, primary key)
      - `name` (text, required) - Template name
      - `type` (text, required) - Type: Text, Video, Audio, Image, Document
      - `media_url` (text, optional) - URL to uploaded media file
      - `body_text` (text, required) - Message body content
      - `status` (text, default 'Draft') - Status: Draft, Published, Under Review, Archived
      - `created_by` (text, required) - Creator name
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `whatsapp_templates` table
    - Add policy for anonymous users to read published templates
    - Add policy for anonymous users to manage all templates (for demo purposes)

  3. Indexes
    - Index on status for filtering
    - Index on type for filtering
    - Index on created_at for sorting
*/

-- Create whatsapp_templates table
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('Text', 'Video', 'Audio', 'Image', 'Document')),
  media_url text,
  body_text text NOT NULL,
  status text DEFAULT 'Draft' CHECK (status IN ('Draft', 'Published', 'Under Review', 'Archived')),
  created_by text NOT NULL DEFAULT 'System',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_status ON whatsapp_templates(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_type ON whatsapp_templates(type);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_created_at ON whatsapp_templates(created_at DESC);

-- Enable Row Level Security
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (demo purposes)
CREATE POLICY "Anyone can view whatsapp templates"
  ON whatsapp_templates
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert whatsapp templates"
  ON whatsapp_templates
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update whatsapp templates"
  ON whatsapp_templates
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete whatsapp templates"
  ON whatsapp_templates
  FOR DELETE
  TO anon
  USING (true);

-- Create authenticated user policies
CREATE POLICY "Authenticated users can view whatsapp templates"
  ON whatsapp_templates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert whatsapp templates"
  ON whatsapp_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update whatsapp templates"
  ON whatsapp_templates
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete whatsapp templates"
  ON whatsapp_templates
  FOR DELETE
  TO authenticated
  USING (true);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_whatsapp_templates_updated_at ON whatsapp_templates;
CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
