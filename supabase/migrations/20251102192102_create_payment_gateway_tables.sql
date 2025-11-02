/*
  # Create Payment Gateway Configuration and Transaction Tables

  1. New Tables
    - `payment_gateway_config`
      - `id` (uuid, primary key)
      - `gateway_type` (text) - 'Cashfree' or 'Razorpay'
      - `app_id` (text) - x-client-id for Cashfree, key_id for Razorpay
      - `secret_key` (text) - x-client-secret for Cashfree, key_secret for Razorpay
      - `environment` (text) - 'sandbox' or 'production'
      - `is_active` (boolean) - Whether gateway is configured
      - `is_default` (boolean) - Default gateway for payment links
      - `api_version` (text) - API version (mainly for Cashfree)
      - `webhook_secret` (text) - Webhook signature verification secret
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `payment_transactions`
      - `id` (uuid, primary key)
      - `transaction_id` (text) - Gateway transaction ID
      - `gateway_type` (text) - 'Cashfree' or 'Razorpay'
      - `gateway_order_id` (text) - Order/Link ID from gateway
      - `invoice_id` (uuid) - Reference to invoices table
      - `amount` (numeric) - Payment amount
      - `currency` (text) - Currency code
      - `status` (text) - Payment status
      - `payment_method` (text) - Payment method used
      - `customer_email` (text)
      - `customer_phone` (text)
      - `raw_webhook_data` (jsonb) - Full webhook payload
      - `processed_at` (timestamptz) - When webhook was processed
      - `created_at` (timestamptz)

  2. Updates to Existing Tables
    - Add payment gateway columns to `invoices` table

  3. Security
    - Enable RLS on all tables
    - Add policies for anonymous access

  4. Indexes
    - Indexes for efficient querying
*/

-- Create payment_gateway_config table
CREATE TABLE IF NOT EXISTS payment_gateway_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_type text NOT NULL CHECK (gateway_type IN ('Cashfree', 'Razorpay')),
  app_id text NOT NULL,
  secret_key text NOT NULL,
  environment text DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production', 'test', 'live')),
  is_active boolean DEFAULT false,
  is_default boolean DEFAULT false,
  api_version text DEFAULT '2023-08-01',
  webhook_secret text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(gateway_type)
);

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text NOT NULL,
  gateway_type text NOT NULL CHECK (gateway_type IN ('Cashfree', 'Razorpay')),
  gateway_order_id text,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  amount numeric(12, 2) NOT NULL,
  currency text DEFAULT 'INR',
  status text NOT NULL,
  payment_method text,
  customer_email text,
  customer_phone text,
  raw_webhook_data jsonb DEFAULT '{}'::jsonb,
  processed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Add payment gateway columns to invoices table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'payment_gateway_used'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payment_gateway_used text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'payment_link_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payment_link_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'payment_link_url'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payment_link_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'payment_link_status'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payment_link_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'payment_link_expiry'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payment_link_expiry timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'payment_link_created_at'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payment_link_created_at timestamptz;
  END IF;
END $$;

-- Create indexes for payment_gateway_config
CREATE INDEX IF NOT EXISTS idx_payment_gateway_config_gateway_type ON payment_gateway_config(gateway_type);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_config_is_default ON payment_gateway_config(is_default);

-- Create indexes for payment_transactions
CREATE INDEX IF NOT EXISTS idx_payment_transactions_transaction_id ON payment_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_invoice_id ON payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway_type ON payment_transactions(gateway_type);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);

-- Create indexes for invoices payment columns
CREATE INDEX IF NOT EXISTS idx_invoices_payment_link_status ON invoices(payment_link_status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_gateway_used ON invoices(payment_gateway_used);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_gateway_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for payment_gateway_config
DROP TRIGGER IF EXISTS trigger_update_payment_gateway_config_updated_at ON payment_gateway_config;
CREATE TRIGGER trigger_update_payment_gateway_config_updated_at
  BEFORE UPDATE ON payment_gateway_config
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_gateway_config_updated_at();

-- Enable RLS
ALTER TABLE payment_gateway_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment_gateway_config
CREATE POLICY "Allow anonymous read access to payment_gateway_config"
  ON payment_gateway_config FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert access to payment_gateway_config"
  ON payment_gateway_config FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update access to payment_gateway_config"
  ON payment_gateway_config FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous delete access to payment_gateway_config"
  ON payment_gateway_config FOR DELETE TO anon USING (true);

-- RLS policies for payment_transactions
CREATE POLICY "Allow anonymous read access to payment_transactions"
  ON payment_transactions FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert access to payment_transactions"
  ON payment_transactions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update access to payment_transactions"
  ON payment_transactions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous delete access to payment_transactions"
  ON payment_transactions FOR DELETE TO anon USING (true);

-- Comments
COMMENT ON TABLE payment_gateway_config IS 'Configuration for payment gateways (Cashfree and Razorpay)';
COMMENT ON TABLE payment_transactions IS 'Payment transactions received from payment gateways via webhooks';
COMMENT ON COLUMN payment_gateway_config.gateway_type IS 'Type of payment gateway: Cashfree or Razorpay';
COMMENT ON COLUMN payment_gateway_config.is_default IS 'Default gateway to use for generating payment links';
COMMENT ON COLUMN payment_transactions.raw_webhook_data IS 'Full webhook payload from gateway for debugging and audit';
