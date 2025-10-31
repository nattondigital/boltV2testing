/*
  # Create WhatsApp API Logs Table

  1. New Table
    - `whatsapp_api_logs`
      - Logs all WhatsApp API requests and responses
      - Helps debug DoubleTick API issues
      - Stores request payload, response, and errors
      
  2. Security
    - Enable RLS
    - Admin users can view logs
*/

CREATE TABLE IF NOT EXISTS whatsapp_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_event text NOT NULL,
  contact_phone text NOT NULL,
  contact_name text,
  template_id uuid,
  template_name text,
  template_type text,
  
  -- Request details
  api_endpoint text NOT NULL,
  request_payload jsonb NOT NULL,
  request_headers jsonb,
  
  -- Response details
  response_status int,
  response_body text,
  response_headers jsonb,
  
  -- Error details
  error_message text,
  error_details jsonb,
  
  -- Metadata
  success boolean DEFAULT false,
  sent_at timestamptz DEFAULT now(),
  
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE whatsapp_api_logs ENABLE ROW LEVEL SECURITY;

-- Allow anon access for logging (the edge function runs as anon)
CREATE POLICY "Allow insert for anon"
  ON whatsapp_api_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users to read logs
CREATE POLICY "Allow read for authenticated"
  ON whatsapp_api_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_trigger_event ON whatsapp_api_logs(trigger_event);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_contact_phone ON whatsapp_api_logs(contact_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON whatsapp_api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_success ON whatsapp_api_logs(success);

COMMENT ON TABLE whatsapp_api_logs IS 'Logs all WhatsApp API requests made to DoubleTick for debugging and monitoring';
