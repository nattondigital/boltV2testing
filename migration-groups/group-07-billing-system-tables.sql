/*
================================================================================
GROUP 7: BILLING SYSTEM TABLES
================================================================================

Estimates, invoices, subscriptions, receipts, and their triggers

Total Files: 11
Dependencies: Group 6

Files Included (in execution order):
1. 20251019132802_create_billing_estimates_table.sql
2. 20251019132857_create_billing_invoices_subscriptions_receipts_tables.sql
3. 20251019141632_create_estimate_triggers.sql
4. 20251019141702_create_invoice_triggers.sql
5. 20251019141731_create_subscription_triggers.sql
6. 20251019141758_create_receipt_triggers.sql
7. 20251019143739_create_webhook_events_table.sql
8. 20251019143825_update_billing_triggers_to_webhook_events.sql
9. 20251019144622_update_billing_triggers_to_api_webhooks.sql
10. 20251019144700_add_billing_workflow_triggers.sql
11. 20251019151010_20251019144700_add_billing_workflow_triggers.sql

================================================================================
*/

-- ============================================================================
-- MIGRATION 1: 20251019132802_create_billing_estimates_table.sql
-- ============================================================================
/*
  # Create Estimates Table

  1. New Tables
    - `estimates`
      - `id` (uuid, primary key)
      - `estimate_id` (text, unique, human-readable ID like EST0001)
      - `customer_id` (uuid, nullable reference to enrolled_members or can be standalone)
      - `customer_name` (text, customer name)
      - `customer_email` (text, customer email)
      - `customer_phone` (text, customer phone)
      - `title` (text, estimate title/description)
      - `items` (jsonb, array of line items with description, quantity, rate, amount)
      - `subtotal` (numeric, sum of all items before tax and discount)
      - `discount` (numeric, discount amount)
      - `tax_rate` (numeric, tax rate percentage)
      - `tax_amount` (numeric, calculated tax amount)
      - `total_amount` (numeric, final amount)
      - `notes` (text, additional notes or terms)
      - `status` (text, 'Draft', 'Sent', 'Accepted', 'Rejected', 'Expired')
      - `valid_until` (date, estimate expiry date)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `sent_at` (timestamptz, when estimate was sent)
      - `responded_at` (timestamptz, when customer accepted/rejected)

  2. Security
    - Enable RLS on `estimates` table
    - Add policy for anonymous users to read all estimates
    - Add policy for anonymous users to insert estimates
    - Add policy for anonymous users to update estimates
    - Add policy for anonymous users to delete estimates

  3. Indexes
    - Index on customer_email for customer lookups
    - Index on status for filtering by status
    - Index on created_at for sorting

  4. Functions
    - Auto-generate estimate_id
    - Auto-update updated_at timestamp
*/

-- Create estimates table
CREATE TABLE IF NOT EXISTS estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id text UNIQUE NOT NULL,
  customer_id uuid REFERENCES enrolled_members(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  title text NOT NULL,
  items jsonb DEFAULT '[]'::jsonb,
  subtotal numeric(12, 2) DEFAULT 0,
  discount numeric(12, 2) DEFAULT 0,
  tax_rate numeric(5, 2) DEFAULT 0,
  tax_amount numeric(12, 2) DEFAULT 0,
  total_amount numeric(12, 2) DEFAULT 0,
  notes text,
  status text DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired')),
  valid_until date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  responded_at timestamptz
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_estimates_customer_email ON estimates(customer_email);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_created_at ON estimates(created_at);

-- Create function to generate estimate ID
CREATE OR REPLACE FUNCTION generate_estimate_id()
RETURNS text AS $$
DECLARE
  next_id integer;
  new_estimate_id text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_id FROM estimates;
  new_estimate_id := 'EST' || LPAD(next_id::text, 4, '0');
  
  WHILE EXISTS (SELECT 1 FROM estimates WHERE estimate_id = new_estimate_id) LOOP
    next_id := next_id + 1;
    new_estimate_id := 'EST' || LPAD(next_id::text, 4, '0');
  END LOOP;
  
  RETURN new_estimate_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate estimate_id
CREATE OR REPLACE FUNCTION set_estimate_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estimate_id IS NULL OR NEW.estimate_id = '' THEN
    NEW.estimate_id := generate_estimate_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_estimate_id ON estimates;
CREATE TRIGGER trigger_set_estimate_id
  BEFORE INSERT ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION set_estimate_id();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_estimates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_estimates_updated_at_trigger ON estimates;
CREATE TRIGGER update_estimates_updated_at_trigger
  BEFORE UPDATE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_estimates_updated_at();

-- Enable RLS
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for anonymous access
CREATE POLICY "Allow anonymous read access to estimates"
  ON estimates
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to estimates"
  ON estimates
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to estimates"
  ON estimates
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to estimates"
  ON estimates
  FOR DELETE
  TO anon
  USING (true);

-- Add comments
COMMENT ON TABLE estimates IS 'Table for managing customer estimates/quotations';
COMMENT ON COLUMN estimates.estimate_id IS 'Human-readable estimate ID (e.g., EST0001)';
COMMENT ON COLUMN estimates.items IS 'JSON array of line items: [{description, quantity, rate, amount}]';
COMMENT ON COLUMN estimates.status IS 'Draft, Sent, Accepted, Rejected, or Expired';
COMMENT ON COLUMN estimates.valid_until IS 'Date when the estimate expires';

-- ============================================================================
-- MIGRATION 2: 20251019132857_create_billing_invoices_subscriptions_receipts_tables.sql
-- ============================================================================
/*
  # Create Invoices, Subscriptions, and Receipts Tables

  1. New Tables
    - `invoices`
      - Invoice management with line items, taxes, discounts
      - Status tracking: Draft, Sent, Paid, Partially Paid, Overdue, Cancelled
      
    - `subscriptions`
      - Recurring subscription management
      - Status: Active, Paused, Cancelled, Expired
      
    - `receipts`
      - Payment receipts for completed transactions
      - Links to invoices or subscriptions

  2. Security
    - Enable RLS on all tables
    - Add policies for anonymous access

  3. Indexes
    - Indexes for common queries

  4. Functions
    - Auto-generate IDs
    - Auto-update timestamps
*/

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id text UNIQUE NOT NULL,
  estimate_id uuid REFERENCES estimates(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES enrolled_members(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  title text NOT NULL,
  items jsonb DEFAULT '[]'::jsonb,
  subtotal numeric(12, 2) DEFAULT 0,
  discount numeric(12, 2) DEFAULT 0,
  tax_rate numeric(5, 2) DEFAULT 0,
  tax_amount numeric(12, 2) DEFAULT 0,
  total_amount numeric(12, 2) DEFAULT 0,
  paid_amount numeric(12, 2) DEFAULT 0,
  balance_due numeric(12, 2) DEFAULT 0,
  notes text,
  terms text,
  status text DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled')),
  payment_method text,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  paid_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id text UNIQUE NOT NULL,
  customer_id uuid REFERENCES enrolled_members(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  plan_name text NOT NULL,
  plan_type text NOT NULL CHECK (plan_type IN ('Monthly', 'Quarterly', 'Yearly', 'Custom')),
  amount numeric(12, 2) NOT NULL,
  currency text DEFAULT 'INR',
  billing_cycle_day integer DEFAULT 1,
  status text DEFAULT 'Active' CHECK (status IN ('Active', 'Paused', 'Cancelled', 'Expired')),
  payment_method text,
  start_date date NOT NULL,
  end_date date,
  next_billing_date date,
  last_billing_date date,
  auto_renew boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  cancelled_at timestamptz,
  cancelled_reason text
);

-- Create receipts table
CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id text UNIQUE NOT NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES enrolled_members(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  payment_method text NOT NULL,
  payment_reference text,
  amount_paid numeric(12, 2) NOT NULL,
  currency text DEFAULT 'INR',
  payment_date date NOT NULL,
  description text,
  notes text,
  status text DEFAULT 'Completed' CHECK (status IN ('Completed', 'Failed', 'Refunded', 'Pending')),
  refund_amount numeric(12, 2) DEFAULT 0,
  refund_date date,
  refund_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_customer_email ON invoices(customer_email);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

-- Create indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_email ON subscriptions(customer_email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing_date ON subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions(created_at);

-- Create indexes for receipts
CREATE INDEX IF NOT EXISTS idx_receipts_customer_email ON receipts(customer_email);
CREATE INDEX IF NOT EXISTS idx_receipts_payment_date ON receipts(payment_date);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_invoice_id ON receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_receipts_subscription_id ON receipts(subscription_id);

-- Functions to generate IDs
CREATE OR REPLACE FUNCTION generate_invoice_id()
RETURNS text AS $$
DECLARE
  next_id integer;
  new_id text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_id FROM invoices;
  new_id := 'INV' || LPAD(next_id::text, 4, '0');
  WHILE EXISTS (SELECT 1 FROM invoices WHERE invoice_id = new_id) LOOP
    next_id := next_id + 1;
    new_id := 'INV' || LPAD(next_id::text, 4, '0');
  END LOOP;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_subscription_id()
RETURNS text AS $$
DECLARE
  next_id integer;
  new_id text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_id FROM subscriptions;
  new_id := 'SUB' || LPAD(next_id::text, 4, '0');
  WHILE EXISTS (SELECT 1 FROM subscriptions WHERE subscription_id = new_id) LOOP
    next_id := next_id + 1;
    new_id := 'SUB' || LPAD(next_id::text, 4, '0');
  END LOOP;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_receipt_id()
RETURNS text AS $$
DECLARE
  next_id integer;
  new_id text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_id FROM receipts;
  new_id := 'REC' || LPAD(next_id::text, 4, '0');
  WHILE EXISTS (SELECT 1 FROM receipts WHERE receipt_id = new_id) LOOP
    next_id := next_id + 1;
    new_id := 'REC' || LPAD(next_id::text, 4, '0');
  END LOOP;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Triggers to set IDs
CREATE OR REPLACE FUNCTION set_invoice_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_id IS NULL OR NEW.invoice_id = '' THEN
    NEW.invoice_id := generate_invoice_id();
  END IF;
  NEW.balance_due := NEW.total_amount - NEW.paid_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_subscription_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subscription_id IS NULL OR NEW.subscription_id = '' THEN
    NEW.subscription_id := generate_subscription_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_receipt_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receipt_id IS NULL OR NEW.receipt_id = '' THEN
    NEW.receipt_id := generate_receipt_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_invoice_id ON invoices;
CREATE TRIGGER trigger_set_invoice_id
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_id();

DROP TRIGGER IF EXISTS trigger_set_subscription_id ON subscriptions;
CREATE TRIGGER trigger_set_subscription_id
  BEFORE INSERT ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_subscription_id();

DROP TRIGGER IF EXISTS trigger_set_receipt_id ON receipts;
CREATE TRIGGER trigger_set_receipt_id
  BEFORE INSERT ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION set_receipt_id();

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_receipts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invoices_updated_at_trigger ON invoices;
CREATE TRIGGER update_invoices_updated_at_trigger
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoices_updated_at();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at_trigger ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at_trigger
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

DROP TRIGGER IF EXISTS update_receipts_updated_at_trigger ON receipts;
CREATE TRIGGER update_receipts_updated_at_trigger
  BEFORE UPDATE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_receipts_updated_at();

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoices
CREATE POLICY "Allow anonymous read access to invoices"
  ON invoices FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert access to invoices"
  ON invoices FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update access to invoices"
  ON invoices FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous delete access to invoices"
  ON invoices FOR DELETE TO anon USING (true);

-- RLS policies for subscriptions
CREATE POLICY "Allow anonymous read access to subscriptions"
  ON subscriptions FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert access to subscriptions"
  ON subscriptions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update access to subscriptions"
  ON subscriptions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous delete access to subscriptions"
  ON subscriptions FOR DELETE TO anon USING (true);

-- RLS policies for receipts
CREATE POLICY "Allow anonymous read access to receipts"
  ON receipts FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert access to receipts"
  ON receipts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update access to receipts"
  ON receipts FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous delete access to receipts"
  ON receipts FOR DELETE TO anon USING (true);

-- Comments
COMMENT ON TABLE invoices IS 'Table for managing customer invoices with line items and payment tracking';
COMMENT ON TABLE subscriptions IS 'Table for managing recurring subscriptions and billing cycles';
COMMENT ON TABLE receipts IS 'Table for managing payment receipts and transaction records';
COMMENT ON COLUMN invoices.balance_due IS 'Automatically calculated as total_amount - paid_amount';
COMMENT ON COLUMN subscriptions.next_billing_date IS 'Next scheduled billing date for active subscriptions';
COMMENT ON COLUMN receipts.payment_reference IS 'External payment reference (transaction ID, check number, etc)';

-- ============================================================================
-- MIGRATION 3: 20251019141632_create_estimate_triggers.sql
-- ============================================================================
/*
  # Create Estimate Triggers for API Webhooks
  
  1. Triggers
    - Estimate Created: Fires when a new estimate is inserted
    - Estimate Updated: Fires when an estimate is updated
    - Estimate Deleted: Fires when an estimate is deleted
    
  2. Webhook Events
    - estimate.created
    - estimate.updated
    - estimate.deleted
    
  3. Payload Structure
    - trigger_event: The event type
    - table_name: 'estimates'
    - record_id: The estimate UUID
    - estimate_id: Human-readable estimate ID
    - data: The estimate record data
    - old_data: Previous data (for updates/deletes)
*/

-- Trigger for estimate created
CREATE OR REPLACE FUNCTION notify_estimate_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO api_webhooks (
    trigger_event,
    table_name,
    record_id,
    data
  ) VALUES (
    'estimate.created',
    'estimates',
    NEW.id,
    jsonb_build_object(
      'estimate_id', NEW.estimate_id,
      'customer_id', NEW.customer_id,
      'customer_name', NEW.customer_name,
      'customer_email', NEW.customer_email,
      'customer_phone', NEW.customer_phone,
      'title', NEW.title,
      'items', NEW.items,
      'subtotal', NEW.subtotal,
      'discount', NEW.discount,
      'tax_rate', NEW.tax_rate,
      'tax_amount', NEW.tax_amount,
      'total_amount', NEW.total_amount,
      'notes', NEW.notes,
      'status', NEW.status,
      'valid_until', NEW.valid_until,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at,
      'sent_at', NEW.sent_at,
      'responded_at', NEW.responded_at
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS estimate_created_trigger ON estimates;
CREATE TRIGGER estimate_created_trigger
  AFTER INSERT ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION notify_estimate_created();

-- Trigger for estimate updated
CREATE OR REPLACE FUNCTION notify_estimate_updated()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO api_webhooks (
    trigger_event,
    table_name,
    record_id,
    data
  ) VALUES (
    'estimate.updated',
    'estimates',
    NEW.id,
    jsonb_build_object(
      'estimate_id', NEW.estimate_id,
      'customer_id', NEW.customer_id,
      'customer_name', NEW.customer_name,
      'customer_email', NEW.customer_email,
      'customer_phone', NEW.customer_phone,
      'title', NEW.title,
      'items', NEW.items,
      'subtotal', NEW.subtotal,
      'discount', NEW.discount,
      'tax_rate', NEW.tax_rate,
      'tax_amount', NEW.tax_amount,
      'total_amount', NEW.total_amount,
      'notes', NEW.notes,
      'status', NEW.status,
      'valid_until', NEW.valid_until,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at,
      'sent_at', NEW.sent_at,
      'responded_at', NEW.responded_at,
      'old_status', OLD.status,
      'old_total_amount', OLD.total_amount
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS estimate_updated_trigger ON estimates;
CREATE TRIGGER estimate_updated_trigger
  AFTER UPDATE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION notify_estimate_updated();

-- Trigger for estimate deleted
CREATE OR REPLACE FUNCTION notify_estimate_deleted()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO api_webhooks (
    trigger_event,
    table_name,
    record_id,
    data
  ) VALUES (
    'estimate.deleted',
    'estimates',
    OLD.id,
    jsonb_build_object(
      'estimate_id', OLD.estimate_id,
      'customer_name', OLD.customer_name,
      'customer_email', OLD.customer_email,
      'title', OLD.title,
      'total_amount', OLD.total_amount,
      'status', OLD.status,
      'deleted_at', NOW()
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS estimate_deleted_trigger ON estimates;
CREATE TRIGGER estimate_deleted_trigger
  AFTER DELETE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION notify_estimate_deleted();

COMMENT ON FUNCTION notify_estimate_created() IS 'Sends webhook notification when estimate is created';
COMMENT ON FUNCTION notify_estimate_updated() IS 'Sends webhook notification when estimate is updated';
COMMENT ON FUNCTION notify_estimate_deleted() IS 'Sends webhook notification when estimate is deleted';

-- ============================================================================
-- MIGRATION 4: 20251019141702_create_invoice_triggers.sql
-- ============================================================================
/*
  # Create Invoice Triggers for API Webhooks
  
  1. Triggers
    - Invoice Created: Fires when a new invoice is inserted
    - Invoice Updated: Fires when an invoice is updated (status changes, payments)
    - Invoice Deleted: Fires when an invoice is deleted
    
  2. Webhook Events
    - invoice.created
    - invoice.updated
    - invoice.deleted
    - invoice.paid (special event when status changes to 'Paid')
    - invoice.overdue (special event when status changes to 'Overdue')
    
  3. Payload Structure
    - trigger_event: The event type
    - table_name: 'invoices'
    - record_id: The invoice UUID
    - invoice_id: Human-readable invoice ID
    - data: The invoice record data
    - old_data: Previous data (for updates/deletes)
*/

-- Trigger for invoice created
CREATE OR REPLACE FUNCTION notify_invoice_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO api_webhooks (
    trigger_event,
    table_name,
    record_id,
    data
  ) VALUES (
    'invoice.created',
    'invoices',
    NEW.id,
    jsonb_build_object(
      'invoice_id', NEW.invoice_id,
      'estimate_id', NEW.estimate_id,
      'customer_id', NEW.customer_id,
      'customer_name', NEW.customer_name,
      'customer_email', NEW.customer_email,
      'customer_phone', NEW.customer_phone,
      'title', NEW.title,
      'items', NEW.items,
      'subtotal', NEW.subtotal,
      'discount', NEW.discount,
      'tax_rate', NEW.tax_rate,
      'tax_amount', NEW.tax_amount,
      'total_amount', NEW.total_amount,
      'paid_amount', NEW.paid_amount,
      'balance_due', NEW.balance_due,
      'notes', NEW.notes,
      'terms', NEW.terms,
      'status', NEW.status,
      'payment_method', NEW.payment_method,
      'issue_date', NEW.issue_date,
      'due_date', NEW.due_date,
      'paid_date', NEW.paid_date,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_created_trigger ON invoices;
CREATE TRIGGER invoice_created_trigger
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION notify_invoice_created();

-- Trigger for invoice updated
CREATE OR REPLACE FUNCTION notify_invoice_updated()
RETURNS TRIGGER AS $$
DECLARE
  event_type text;
BEGIN
  event_type := 'invoice.updated';
  
  IF OLD.status != NEW.status THEN
    IF NEW.status = 'Paid' THEN
      event_type := 'invoice.paid';
    ELSIF NEW.status = 'Overdue' THEN
      event_type := 'invoice.overdue';
    END IF;
  END IF;
  
  INSERT INTO api_webhooks (
    trigger_event,
    table_name,
    record_id,
    data
  ) VALUES (
    event_type,
    'invoices',
    NEW.id,
    jsonb_build_object(
      'invoice_id', NEW.invoice_id,
      'customer_id', NEW.customer_id,
      'customer_name', NEW.customer_name,
      'customer_email', NEW.customer_email,
      'title', NEW.title,
      'total_amount', NEW.total_amount,
      'paid_amount', NEW.paid_amount,
      'balance_due', NEW.balance_due,
      'status', NEW.status,
      'payment_method', NEW.payment_method,
      'due_date', NEW.due_date,
      'paid_date', NEW.paid_date,
      'updated_at', NEW.updated_at,
      'old_status', OLD.status,
      'old_paid_amount', OLD.paid_amount,
      'old_balance_due', OLD.balance_due
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_updated_trigger ON invoices;
CREATE TRIGGER invoice_updated_trigger
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION notify_invoice_updated();

-- Trigger for invoice deleted
CREATE OR REPLACE FUNCTION notify_invoice_deleted()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO api_webhooks (
    trigger_event,
    table_name,
    record_id,
    data
  ) VALUES (
    'invoice.deleted',
    'invoices',
    OLD.id,
    jsonb_build_object(
      'invoice_id', OLD.invoice_id,
      'customer_name', OLD.customer_name,
      'customer_email', OLD.customer_email,
      'title', OLD.title,
      'total_amount', OLD.total_amount,
      'balance_due', OLD.balance_due,
      'status', OLD.status,
      'deleted_at', NOW()
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_deleted_trigger ON invoices;
CREATE TRIGGER invoice_deleted_trigger
  AFTER DELETE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION notify_invoice_deleted();

COMMENT ON FUNCTION notify_invoice_created() IS 'Sends webhook notification when invoice is created';
COMMENT ON FUNCTION notify_invoice_updated() IS 'Sends webhook notification when invoice is updated, including special events for paid and overdue';
COMMENT ON FUNCTION notify_invoice_deleted() IS 'Sends webhook notification when invoice is deleted';

-- ============================================================================
-- MIGRATION 5: 20251019141731_create_subscription_triggers.sql
-- ============================================================================
/*
  # Create Subscription Triggers for API Webhooks
  
  1. Triggers
    - Subscription Created: Fires when a new subscription is inserted
    - Subscription Updated: Fires when a subscription is updated
    - Subscription Deleted: Fires when a subscription is deleted
    
  2. Webhook Events
    - subscription.created
    - subscription.updated
    - subscription.cancelled (special event when status changes to 'Cancelled')
    - subscription.renewed (special event when next_billing_date is updated and status is Active)
    - subscription.paused (special event when status changes to 'Paused')
    - subscription.expired (special event when status changes to 'Expired')
    - subscription.deleted
    
  3. Payload Structure
    - trigger_event: The event type
    - table_name: 'subscriptions'
    - record_id: The subscription UUID
    - subscription_id: Human-readable subscription ID
    - data: The subscription record data
    - old_data: Previous data (for updates/deletes)
*/

-- Trigger for subscription created
CREATE OR REPLACE FUNCTION notify_subscription_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO api_webhooks (
    trigger_event,
    table_name,
    record_id,
    data
  ) VALUES (
    'subscription.created',
    'subscriptions',
    NEW.id,
    jsonb_build_object(
      'subscription_id', NEW.subscription_id,
      'customer_id', NEW.customer_id,
      'customer_name', NEW.customer_name,
      'customer_email', NEW.customer_email,
      'customer_phone', NEW.customer_phone,
      'plan_name', NEW.plan_name,
      'plan_type', NEW.plan_type,
      'amount', NEW.amount,
      'currency', NEW.currency,
      'billing_cycle_day', NEW.billing_cycle_day,
      'status', NEW.status,
      'payment_method', NEW.payment_method,
      'start_date', NEW.start_date,
      'end_date', NEW.end_date,
      'next_billing_date', NEW.next_billing_date,
      'last_billing_date', NEW.last_billing_date,
      'auto_renew', NEW.auto_renew,
      'notes', NEW.notes,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscription_created_trigger ON subscriptions;
CREATE TRIGGER subscription_created_trigger
  AFTER INSERT ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION notify_subscription_created();

-- Trigger for subscription updated
CREATE OR REPLACE FUNCTION notify_subscription_updated()
RETURNS TRIGGER AS $$
DECLARE
  event_type text;
BEGIN
  event_type := 'subscription.updated';
  
  IF OLD.status != NEW.status THEN
    IF NEW.status = 'Cancelled' THEN
      event_type := 'subscription.cancelled';
    ELSIF NEW.status = 'Paused' THEN
      event_type := 'subscription.paused';
    ELSIF NEW.status = 'Expired' THEN
      event_type := 'subscription.expired';
    END IF;
  ELSIF OLD.last_billing_date != NEW.last_billing_date AND NEW.status = 'Active' THEN
    event_type := 'subscription.renewed';
  END IF;
  
  INSERT INTO api_webhooks (
    trigger_event,
    table_name,
    record_id,
    data
  ) VALUES (
    event_type,
    'subscriptions',
    NEW.id,
    jsonb_build_object(
      'subscription_id', NEW.subscription_id,
      'customer_id', NEW.customer_id,
      'customer_name', NEW.customer_name,
      'customer_email', NEW.customer_email,
      'plan_name', NEW.plan_name,
      'plan_type', NEW.plan_type,
      'amount', NEW.amount,
      'status', NEW.status,
      'payment_method', NEW.payment_method,
      'next_billing_date', NEW.next_billing_date,
      'last_billing_date', NEW.last_billing_date,
      'auto_renew', NEW.auto_renew,
      'updated_at', NEW.updated_at,
      'cancelled_at', NEW.cancelled_at,
      'cancelled_reason', NEW.cancelled_reason,
      'old_status', OLD.status,
      'old_next_billing_date', OLD.next_billing_date,
      'old_last_billing_date', OLD.last_billing_date
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscription_updated_trigger ON subscriptions;
CREATE TRIGGER subscription_updated_trigger
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION notify_subscription_updated();

-- Trigger for subscription deleted
CREATE OR REPLACE FUNCTION notify_subscription_deleted()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO api_webhooks (
    trigger_event,
    table_name,
    record_id,
    data
  ) VALUES (
    'subscription.deleted',
    'subscriptions',
    OLD.id,
    jsonb_build_object(
      'subscription_id', OLD.subscription_id,
      'customer_name', OLD.customer_name,
      'customer_email', OLD.customer_email,
      'plan_name', OLD.plan_name,
      'amount', OLD.amount,
      'status', OLD.status,
      'deleted_at', NOW()
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscription_deleted_trigger ON subscriptions;
CREATE TRIGGER subscription_deleted_trigger
  AFTER DELETE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION notify_subscription_deleted();

COMMENT ON FUNCTION notify_subscription_created() IS 'Sends webhook notification when subscription is created';
COMMENT ON FUNCTION notify_subscription_updated() IS 'Sends webhook notification when subscription is updated, including special events for status changes and renewals';
COMMENT ON FUNCTION notify_subscription_deleted() IS 'Sends webhook notification when subscription is deleted';

-- ============================================================================
-- MIGRATION 6: 20251019141758_create_receipt_triggers.sql
-- ============================================================================
/*
  # Create Receipt Triggers for API Webhooks
  
  1. Triggers
    - Receipt Created: Fires when a new receipt is inserted
    - Receipt Updated: Fires when a receipt is updated
    - Receipt Deleted: Fires when a receipt is deleted
    
  2. Webhook Events
    - receipt.created
    - receipt.updated
    - receipt.refunded (special event when status changes to 'Refunded')
    - receipt.failed (special event when status changes to 'Failed')
    - receipt.deleted
    
  3. Payload Structure
    - trigger_event: The event type
    - table_name: 'receipts'
    - record_id: The receipt UUID
    - receipt_id: Human-readable receipt ID
    - data: The receipt record data
    - old_data: Previous data (for updates/deletes)
*/

-- Trigger for receipt created
CREATE OR REPLACE FUNCTION notify_receipt_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO api_webhooks (
    trigger_event,
    table_name,
    record_id,
    data
  ) VALUES (
    'receipt.created',
    'receipts',
    NEW.id,
    jsonb_build_object(
      'receipt_id', NEW.receipt_id,
      'invoice_id', NEW.invoice_id,
      'subscription_id', NEW.subscription_id,
      'customer_id', NEW.customer_id,
      'customer_name', NEW.customer_name,
      'customer_email', NEW.customer_email,
      'payment_method', NEW.payment_method,
      'payment_reference', NEW.payment_reference,
      'amount_paid', NEW.amount_paid,
      'currency', NEW.currency,
      'payment_date', NEW.payment_date,
      'description', NEW.description,
      'notes', NEW.notes,
      'status', NEW.status,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS receipt_created_trigger ON receipts;
CREATE TRIGGER receipt_created_trigger
  AFTER INSERT ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION notify_receipt_created();

-- Trigger for receipt updated
CREATE OR REPLACE FUNCTION notify_receipt_updated()
RETURNS TRIGGER AS $$
DECLARE
  event_type text;
BEGIN
  event_type := 'receipt.updated';
  
  IF OLD.status != NEW.status THEN
    IF NEW.status = 'Refunded' THEN
      event_type := 'receipt.refunded';
    ELSIF NEW.status = 'Failed' THEN
      event_type := 'receipt.failed';
    END IF;
  END IF;
  
  INSERT INTO api_webhooks (
    trigger_event,
    table_name,
    record_id,
    data
  ) VALUES (
    event_type,
    'receipts',
    NEW.id,
    jsonb_build_object(
      'receipt_id', NEW.receipt_id,
      'invoice_id', NEW.invoice_id,
      'subscription_id', NEW.subscription_id,
      'customer_name', NEW.customer_name,
      'customer_email', NEW.customer_email,
      'payment_method', NEW.payment_method,
      'payment_reference', NEW.payment_reference,
      'amount_paid', NEW.amount_paid,
      'status', NEW.status,
      'refund_amount', NEW.refund_amount,
      'refund_date', NEW.refund_date,
      'refund_reason', NEW.refund_reason,
      'updated_at', NEW.updated_at,
      'old_status', OLD.status,
      'old_refund_amount', OLD.refund_amount
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS receipt_updated_trigger ON receipts;
CREATE TRIGGER receipt_updated_trigger
  AFTER UPDATE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION notify_receipt_updated();

-- Trigger for receipt deleted
CREATE OR REPLACE FUNCTION notify_receipt_deleted()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO api_webhooks (
    trigger_event,
    table_name,
    record_id,
    data
  ) VALUES (
    'receipt.deleted',
    'receipts',
    OLD.id,
    jsonb_build_object(
      'receipt_id', OLD.receipt_id,
      'customer_name', OLD.customer_name,
      'customer_email', OLD.customer_email,
      'amount_paid', OLD.amount_paid,
      'payment_date', OLD.payment_date,
      'status', OLD.status,
      'deleted_at', NOW()
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS receipt_deleted_trigger ON receipts;
CREATE TRIGGER receipt_deleted_trigger
  AFTER DELETE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION notify_receipt_deleted();

COMMENT ON FUNCTION notify_receipt_created() IS 'Sends webhook notification when receipt is created';
COMMENT ON FUNCTION notify_receipt_updated() IS 'Sends webhook notification when receipt is updated, including special events for refunded and failed';
COMMENT ON FUNCTION notify_receipt_deleted() IS 'Sends webhook notification when receipt is deleted';

-- ============================================================================
-- MIGRATION 7: 20251019143739_create_webhook_events_table.sql
-- ============================================================================
/*
  # Drop Webhook Events Table (Not Needed)

  This migration was originally created to store webhook events in a separate table,
  but we've decided to follow the same pattern as other modules (leads, affiliates, etc.)
  by using the api_webhooks table and sending HTTP POST requests directly to configured
  webhook URLs.

  This migration now drops the webhook_events table if it exists.
*/

-- Drop the webhook_events table if it exists
DROP TABLE IF EXISTS webhook_events CASCADE;

-- The billing triggers now follow the same pattern as other modules:
-- They read from api_webhooks table and send HTTP POST requests to configured webhook URLs.

-- ============================================================================
-- MIGRATION 8: 20251019143825_update_billing_triggers_to_webhook_events.sql
-- ============================================================================
/*
  # Update Billing Triggers to Use API Webhooks Pattern

  Updates all estimate, invoice, subscription, and receipt triggers to follow
  the same pattern as other modules (leads, affiliates, etc.) by sending HTTP
  POST requests to configured webhooks in the api_webhooks table.
*/

-- Update Estimate Triggers
CREATE OR REPLACE FUNCTION notify_estimate_created()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'ESTIMATE_CREATED',
    'estimate_id', NEW.estimate_id,
    'customer_id', NEW.customer_id,
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'customer_phone', NEW.customer_phone,
    'title', NEW.title,
    'items', NEW.items,
    'subtotal', NEW.subtotal,
    'discount', NEW.discount,
    'tax_rate', NEW.tax_rate,
    'tax_amount', NEW.tax_amount,
    'total_amount', NEW.total_amount,
    'notes', NEW.notes,
    'status', NEW.status,
    'valid_until', NEW.valid_until,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'sent_at', NEW.sent_at,
    'responded_at', NEW.responded_at
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'ESTIMATE_CREATED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;

      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        failure_count = COALESCE(failure_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

      RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_estimate_updated()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'ESTIMATE_UPDATED',
    'estimate_id', NEW.estimate_id,
    'customer_id', NEW.customer_id,
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'customer_phone', NEW.customer_phone,
    'title', NEW.title,
    'items', NEW.items,
    'subtotal', NEW.subtotal,
    'discount', NEW.discount,
    'tax_rate', NEW.tax_rate,
    'tax_amount', NEW.tax_amount,
    'total_amount', NEW.total_amount,
    'notes', NEW.notes,
    'status', NEW.status,
    'valid_until', NEW.valid_until,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'sent_at', NEW.sent_at,
    'responded_at', NEW.responded_at,
    'old_status', OLD.status,
    'old_total_amount', OLD.total_amount
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'ESTIMATE_UPDATED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;

      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        failure_count = COALESCE(failure_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

      RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_estimate_deleted()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'ESTIMATE_DELETED',
    'estimate_id', OLD.estimate_id,
    'customer_name', OLD.customer_name,
    'customer_email', OLD.customer_email,
    'title', OLD.title,
    'total_amount', OLD.total_amount,
    'status', OLD.status,
    'deleted_at', NOW()
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'ESTIMATE_DELETED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;

      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        failure_count = COALESCE(failure_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

      RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Invoice Triggers
CREATE OR REPLACE FUNCTION notify_invoice_created()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'INVOICE_CREATED',
    'invoice_id', NEW.invoice_id,
    'estimate_id', NEW.estimate_id,
    'customer_id', NEW.customer_id,
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'customer_phone', NEW.customer_phone,
    'title', NEW.title,
    'items', NEW.items,
    'subtotal', NEW.subtotal,
    'discount', NEW.discount,
    'tax_rate', NEW.tax_rate,
    'tax_amount', NEW.tax_amount,
    'total_amount', NEW.total_amount,
    'paid_amount', NEW.paid_amount,
    'balance_due', NEW.balance_due,
    'notes', NEW.notes,
    'terms', NEW.terms,
    'status', NEW.status,
    'payment_method', NEW.payment_method,
    'issue_date', NEW.issue_date,
    'due_date', NEW.due_date,
    'paid_date', NEW.paid_date,
    'created_at', NEW.created_at
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'INVOICE_CREATED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;

      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        failure_count = COALESCE(failure_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

      RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_invoice_updated()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'INVOICE_UPDATED',
    'invoice_id', NEW.invoice_id,
    'customer_id', NEW.customer_id,
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'title', NEW.title,
    'total_amount', NEW.total_amount,
    'paid_amount', NEW.paid_amount,
    'balance_due', NEW.balance_due,
    'status', NEW.status,
    'payment_method', NEW.payment_method,
    'due_date', NEW.due_date,
    'paid_date', NEW.paid_date,
    'updated_at', NEW.updated_at,
    'old_status', OLD.status,
    'old_paid_amount', OLD.paid_amount,
    'old_balance_due', OLD.balance_due
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'INVOICE_UPDATED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;

      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        failure_count = COALESCE(failure_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

      RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_invoice_deleted()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'INVOICE_DELETED',
    'invoice_id', OLD.invoice_id,
    'customer_name', OLD.customer_name,
    'customer_email', OLD.customer_email,
    'title', OLD.title,
    'total_amount', OLD.total_amount,
    'balance_due', OLD.balance_due,
    'status', OLD.status,
    'deleted_at', NOW()
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'INVOICE_DELETED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;

      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        failure_count = COALESCE(failure_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

      RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Subscription Triggers
CREATE OR REPLACE FUNCTION notify_subscription_created()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'SUBSCRIPTION_CREATED',
    'subscription_id', NEW.subscription_id,
    'customer_id', NEW.customer_id,
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'customer_phone', NEW.customer_phone,
    'plan_name', NEW.plan_name,
    'plan_type', NEW.plan_type,
    'amount', NEW.amount,
    'currency', NEW.currency,
    'billing_cycle_day', NEW.billing_cycle_day,
    'status', NEW.status,
    'payment_method', NEW.payment_method,
    'start_date', NEW.start_date,
    'end_date', NEW.end_date,
    'next_billing_date', NEW.next_billing_date,
    'last_billing_date', NEW.last_billing_date,
    'auto_renew', NEW.auto_renew,
    'notes', NEW.notes,
    'created_at', NEW.created_at
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'SUBSCRIPTION_CREATED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;

      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        failure_count = COALESCE(failure_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

      RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_subscription_updated()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'SUBSCRIPTION_UPDATED',
    'subscription_id', NEW.subscription_id,
    'customer_id', NEW.customer_id,
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'plan_name', NEW.plan_name,
    'plan_type', NEW.plan_type,
    'amount', NEW.amount,
    'status', NEW.status,
    'payment_method', NEW.payment_method,
    'next_billing_date', NEW.next_billing_date,
    'last_billing_date', NEW.last_billing_date,
    'auto_renew', NEW.auto_renew,
    'updated_at', NEW.updated_at,
    'cancelled_at', NEW.cancelled_at,
    'cancelled_reason', NEW.cancelled_reason,
    'old_status', OLD.status,
    'old_next_billing_date', OLD.next_billing_date,
    'old_last_billing_date', OLD.last_billing_date
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'SUBSCRIPTION_UPDATED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;

      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        failure_count = COALESCE(failure_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

      RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_subscription_deleted()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'SUBSCRIPTION_DELETED',
    'subscription_id', OLD.subscription_id,
    'customer_name', OLD.customer_name,
    'customer_email', OLD.customer_email,
    'plan_name', OLD.plan_name,
    'amount', OLD.amount,
    'status', OLD.status,
    'deleted_at', NOW()
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'SUBSCRIPTION_DELETED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;

      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        failure_count = COALESCE(failure_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

      RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Receipt Triggers
CREATE OR REPLACE FUNCTION notify_receipt_created()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'RECEIPT_CREATED',
    'receipt_id', NEW.receipt_id,
    'invoice_id', NEW.invoice_id,
    'subscription_id', NEW.subscription_id,
    'customer_id', NEW.customer_id,
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'payment_method', NEW.payment_method,
    'payment_reference', NEW.payment_reference,
    'amount_paid', NEW.amount_paid,
    'currency', NEW.currency,
    'payment_date', NEW.payment_date,
    'description', NEW.description,
    'notes', NEW.notes,
    'status', NEW.status,
    'created_at', NEW.created_at
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'RECEIPT_CREATED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;

      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        failure_count = COALESCE(failure_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

      RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_receipt_updated()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'RECEIPT_UPDATED',
    'receipt_id', NEW.receipt_id,
    'invoice_id', NEW.invoice_id,
    'subscription_id', NEW.subscription_id,
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'payment_method', NEW.payment_method,
    'payment_reference', NEW.payment_reference,
    'amount_paid', NEW.amount_paid,
    'status', NEW.status,
    'refund_amount', NEW.refund_amount,
    'refund_date', NEW.refund_date,
    'refund_reason', NEW.refund_reason,
    'updated_at', NEW.updated_at,
    'old_status', OLD.status,
    'old_refund_amount', OLD.refund_amount
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'RECEIPT_UPDATED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;

      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        failure_count = COALESCE(failure_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

      RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_receipt_deleted()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'RECEIPT_DELETED',
    'receipt_id', OLD.receipt_id,
    'customer_name', OLD.customer_name,
    'customer_email', OLD.customer_email,
    'amount_paid', OLD.amount_paid,
    'payment_date', OLD.payment_date,
    'status', OLD.status,
    'deleted_at', NOW()
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'RECEIPT_DELETED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;

      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET
        total_calls = COALESCE(total_calls, 0) + 1,
        failure_count = COALESCE(failure_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;

      RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON FUNCTION notify_estimate_created() IS 'Sends HTTP POST to configured API webhooks when an estimate is created';
COMMENT ON FUNCTION notify_estimate_updated() IS 'Sends HTTP POST to configured API webhooks when an estimate is updated';
COMMENT ON FUNCTION notify_estimate_deleted() IS 'Sends HTTP POST to configured API webhooks when an estimate is deleted';
COMMENT ON FUNCTION notify_invoice_created() IS 'Sends HTTP POST to configured API webhooks when an invoice is created';
COMMENT ON FUNCTION notify_invoice_updated() IS 'Sends HTTP POST to configured API webhooks when an invoice is updated';
COMMENT ON FUNCTION notify_invoice_deleted() IS 'Sends HTTP POST to configured API webhooks when an invoice is deleted';
COMMENT ON FUNCTION notify_subscription_created() IS 'Sends HTTP POST to configured API webhooks when a subscription is created';
COMMENT ON FUNCTION notify_subscription_updated() IS 'Sends HTTP POST to configured API webhooks when a subscription is updated';
COMMENT ON FUNCTION notify_subscription_deleted() IS 'Sends HTTP POST to configured API webhooks when a subscription is deleted';
COMMENT ON FUNCTION notify_receipt_created() IS 'Sends HTTP POST to configured API webhooks when a receipt is created';
COMMENT ON FUNCTION notify_receipt_updated() IS 'Sends HTTP POST to configured API webhooks when a receipt is updated';
COMMENT ON FUNCTION notify_receipt_deleted() IS 'Sends HTTP POST to configured API webhooks when a receipt is deleted';

-- ============================================================================
-- MIGRATION 9: 20251019144622_update_billing_triggers_to_api_webhooks.sql
-- ============================================================================
/*
  # Update Billing Triggers to Use api_webhooks Table (Same as Other Modules)
  
  1. Changes
    - Drop webhook_events table (not needed)
    - Update all billing triggers to use api_webhooks table
    - Send HTTP POST requests to configured webhook URLs
    - Track success/failure statistics
    - Follow the same pattern as leads, affiliates, and other modules
    
  2. Trigger Events
    - ESTIMATE_CREATED, ESTIMATE_UPDATED, ESTIMATE_DELETED
    - INVOICE_CREATED, INVOICE_UPDATED, INVOICE_DELETED, INVOICE_PAID, INVOICE_OVERDUE
    - SUBSCRIPTION_CREATED, SUBSCRIPTION_UPDATED, SUBSCRIPTION_DELETED, SUBSCRIPTION_CANCELLED, SUBSCRIPTION_RENEWED
    - RECEIPT_CREATED, RECEIPT_UPDATED, RECEIPT_DELETED, RECEIPT_REFUNDED
*/

-- Drop webhook_events table (not needed)
DROP TABLE IF EXISTS webhook_events CASCADE;

-- ESTIMATE TRIGGERS
CREATE OR REPLACE FUNCTION trigger_webhooks_on_estimate_create()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'ESTIMATE_CREATED',
    'id', NEW.id,
    'estimate_id', NEW.estimate_id,
    'customer_id', NEW.customer_id,
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'customer_phone', NEW.customer_phone,
    'title', NEW.title,
    'items', NEW.items,
    'subtotal', NEW.subtotal,
    'discount', NEW.discount,
    'tax_rate', NEW.tax_rate,
    'tax_amount', NEW.tax_amount,
    'total_amount', NEW.total_amount,
    'notes', NEW.notes,
    'status', NEW.status,
    'valid_until', NEW.valid_until,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'ESTIMATE_CREATED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;
      
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          success_count = COALESCE(success_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trigger_webhooks_on_estimate_update()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'ESTIMATE_UPDATED',
    'id', NEW.id,
    'estimate_id', NEW.estimate_id,
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'title', NEW.title,
    'total_amount', NEW.total_amount,
    'status', NEW.status,
    'updated_at', NEW.updated_at,
    'previous', jsonb_build_object(
      'status', OLD.status,
      'total_amount', OLD.total_amount
    )
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'ESTIMATE_UPDATED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;
      
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          success_count = COALESCE(success_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trigger_webhooks_on_estimate_delete()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'ESTIMATE_DELETED',
    'id', OLD.id,
    'estimate_id', OLD.estimate_id,
    'customer_name', OLD.customer_name,
    'customer_email', OLD.customer_email,
    'title', OLD.title,
    'total_amount', OLD.total_amount,
    'status', OLD.status,
    'deleted_at', now()
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'ESTIMATE_DELETED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;
      
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          success_count = COALESCE(success_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    END;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- INVOICE TRIGGERS
CREATE OR REPLACE FUNCTION trigger_webhooks_on_invoice_create()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'INVOICE_CREATED',
    'id', NEW.id,
    'invoice_id', NEW.invoice_id,
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'title', NEW.title,
    'total_amount', NEW.total_amount,
    'balance_due', NEW.balance_due,
    'status', NEW.status,
    'issue_date', NEW.issue_date,
    'due_date', NEW.due_date,
    'created_at', NEW.created_at
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'INVOICE_CREATED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;
      
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          success_count = COALESCE(success_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trigger_webhooks_on_invoice_update()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
  event_name text;
BEGIN
  event_name := 'INVOICE_UPDATED';
  
  IF OLD.status != NEW.status THEN
    IF NEW.status = 'Paid' THEN
      event_name := 'INVOICE_PAID';
    ELSIF NEW.status = 'Overdue' THEN
      event_name := 'INVOICE_OVERDUE';
    END IF;
  END IF;

  trigger_data := jsonb_build_object(
    'trigger_event', event_name,
    'id', NEW.id,
    'invoice_id', NEW.invoice_id,
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'title', NEW.title,
    'total_amount', NEW.total_amount,
    'paid_amount', NEW.paid_amount,
    'balance_due', NEW.balance_due,
    'status', NEW.status,
    'updated_at', NEW.updated_at,
    'previous', jsonb_build_object(
      'status', OLD.status,
      'paid_amount', OLD.paid_amount,
      'balance_due', OLD.balance_due
    )
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event IN ('INVOICE_UPDATED', event_name) AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;
      
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          success_count = COALESCE(success_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trigger_webhooks_on_invoice_delete()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'INVOICE_DELETED',
    'id', OLD.id,
    'invoice_id', OLD.invoice_id,
    'customer_name', OLD.customer_name,
    'customer_email', OLD.customer_email,
    'title', OLD.title,
    'total_amount', OLD.total_amount,
    'status', OLD.status,
    'deleted_at', now()
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'INVOICE_DELETED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;
      
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          success_count = COALESCE(success_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    END;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SUBSCRIPTION TRIGGERS
CREATE OR REPLACE FUNCTION trigger_webhooks_on_subscription_create()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'SUBSCRIPTION_CREATED',
    'id', NEW.id,
    'subscription_id', NEW.subscription_id,
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'plan_name', NEW.plan_name,
    'plan_type', NEW.plan_type,
    'amount', NEW.amount,
    'status', NEW.status,
    'start_date', NEW.start_date,
    'next_billing_date', NEW.next_billing_date,
    'created_at', NEW.created_at
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'SUBSCRIPTION_CREATED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;
      
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          success_count = COALESCE(success_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trigger_webhooks_on_subscription_update()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
  event_name text;
BEGIN
  event_name := 'SUBSCRIPTION_UPDATED';
  
  IF OLD.status != NEW.status THEN
    IF NEW.status = 'Cancelled' THEN
      event_name := 'SUBSCRIPTION_CANCELLED';
    ELSIF NEW.status = 'Paused' THEN
      event_name := 'SUBSCRIPTION_PAUSED';
    ELSIF NEW.status = 'Expired' THEN
      event_name := 'SUBSCRIPTION_EXPIRED';
    END IF;
  ELSIF OLD.last_billing_date != NEW.last_billing_date AND NEW.status = 'Active' THEN
    event_name := 'SUBSCRIPTION_RENEWED';
  END IF;

  trigger_data := jsonb_build_object(
    'trigger_event', event_name,
    'id', NEW.id,
    'subscription_id', NEW.subscription_id,
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'plan_name', NEW.plan_name,
    'amount', NEW.amount,
    'status', NEW.status,
    'next_billing_date', NEW.next_billing_date,
    'updated_at', NEW.updated_at,
    'previous', jsonb_build_object(
      'status', OLD.status,
      'next_billing_date', OLD.next_billing_date
    )
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event IN ('SUBSCRIPTION_UPDATED', event_name) AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;
      
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          success_count = COALESCE(success_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trigger_webhooks_on_subscription_delete()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'SUBSCRIPTION_DELETED',
    'id', OLD.id,
    'subscription_id', OLD.subscription_id,
    'customer_name', OLD.customer_name,
    'customer_email', OLD.customer_email,
    'plan_name', OLD.plan_name,
    'amount', OLD.amount,
    'status', OLD.status,
    'deleted_at', now()
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'SUBSCRIPTION_DELETED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;
      
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          success_count = COALESCE(success_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    END;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RECEIPT TRIGGERS
CREATE OR REPLACE FUNCTION trigger_webhooks_on_receipt_create()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'RECEIPT_CREATED',
    'id', NEW.id,
    'receipt_id', NEW.receipt_id,
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'payment_method', NEW.payment_method,
    'payment_reference', NEW.payment_reference,
    'amount_paid', NEW.amount_paid,
    'payment_date', NEW.payment_date,
    'status', NEW.status,
    'created_at', NEW.created_at
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'RECEIPT_CREATED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;
      
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          success_count = COALESCE(success_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trigger_webhooks_on_receipt_update()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
  event_name text;
BEGIN
  event_name := 'RECEIPT_UPDATED';
  
  IF OLD.status != NEW.status THEN
    IF NEW.status = 'Refunded' THEN
      event_name := 'RECEIPT_REFUNDED';
    ELSIF NEW.status = 'Failed' THEN
      event_name := 'RECEIPT_FAILED';
    END IF;
  END IF;

  trigger_data := jsonb_build_object(
    'trigger_event', event_name,
    'id', NEW.id,
    'receipt_id', NEW.receipt_id,
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'amount_paid', NEW.amount_paid,
    'status', NEW.status,
    'refund_amount', NEW.refund_amount,
    'updated_at', NEW.updated_at,
    'previous', jsonb_build_object(
      'status', OLD.status
    )
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event IN ('RECEIPT_UPDATED', event_name) AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;
      
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          success_count = COALESCE(success_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trigger_webhooks_on_receipt_delete()
RETURNS TRIGGER AS $$
DECLARE
  api_webhook_record RECORD;
  trigger_data jsonb;
  request_id bigint;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'RECEIPT_DELETED',
    'id', OLD.id,
    'receipt_id', OLD.receipt_id,
    'customer_name', OLD.customer_name,
    'customer_email', OLD.customer_email,
    'amount_paid', OLD.amount_paid,
    'status', OLD.status,
    'deleted_at', now()
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'RECEIPT_DELETED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;
      
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          success_count = COALESCE(success_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    END;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger definitions
DROP TRIGGER IF EXISTS estimate_created_trigger ON estimates;
CREATE TRIGGER estimate_created_trigger
  AFTER INSERT ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhooks_on_estimate_create();

DROP TRIGGER IF EXISTS estimate_updated_trigger ON estimates;
CREATE TRIGGER estimate_updated_trigger
  AFTER UPDATE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhooks_on_estimate_update();

DROP TRIGGER IF EXISTS estimate_deleted_trigger ON estimates;
CREATE TRIGGER estimate_deleted_trigger
  AFTER DELETE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhooks_on_estimate_delete();

DROP TRIGGER IF EXISTS invoice_created_trigger ON invoices;
CREATE TRIGGER invoice_created_trigger
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhooks_on_invoice_create();

DROP TRIGGER IF EXISTS invoice_updated_trigger ON invoices;
CREATE TRIGGER invoice_updated_trigger
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhooks_on_invoice_update();

DROP TRIGGER IF EXISTS invoice_deleted_trigger ON invoices;
CREATE TRIGGER invoice_deleted_trigger
  AFTER DELETE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhooks_on_invoice_delete();

DROP TRIGGER IF EXISTS subscription_created_trigger ON subscriptions;
CREATE TRIGGER subscription_created_trigger
  AFTER INSERT ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhooks_on_subscription_create();

DROP TRIGGER IF EXISTS subscription_updated_trigger ON subscriptions;
CREATE TRIGGER subscription_updated_trigger
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhooks_on_subscription_update();

DROP TRIGGER IF EXISTS subscription_deleted_trigger ON subscriptions;
CREATE TRIGGER subscription_deleted_trigger
  AFTER DELETE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhooks_on_subscription_delete();

DROP TRIGGER IF EXISTS receipt_created_trigger ON receipts;
CREATE TRIGGER receipt_created_trigger
  AFTER INSERT ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhooks_on_receipt_create();

DROP TRIGGER IF EXISTS receipt_updated_trigger ON receipts;
CREATE TRIGGER receipt_updated_trigger
  AFTER UPDATE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhooks_on_receipt_update();

DROP TRIGGER IF EXISTS receipt_deleted_trigger ON receipts;
CREATE TRIGGER receipt_deleted_trigger
  AFTER DELETE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhooks_on_receipt_delete();

-- Add comments
COMMENT ON FUNCTION trigger_webhooks_on_estimate_create() IS 'Sends HTTP POST to configured API webhooks when estimate is created';
COMMENT ON FUNCTION trigger_webhooks_on_estimate_update() IS 'Sends HTTP POST to configured API webhooks when estimate is updated';
COMMENT ON FUNCTION trigger_webhooks_on_estimate_delete() IS 'Sends HTTP POST to configured API webhooks when estimate is deleted';

COMMENT ON FUNCTION trigger_webhooks_on_invoice_create() IS 'Sends HTTP POST to configured API webhooks when invoice is created';
COMMENT ON FUNCTION trigger_webhooks_on_invoice_update() IS 'Sends HTTP POST to configured API webhooks when invoice is updated';
COMMENT ON FUNCTION trigger_webhooks_on_invoice_delete() IS 'Sends HTTP POST to configured API webhooks when invoice is deleted';

COMMENT ON FUNCTION trigger_webhooks_on_subscription_create() IS 'Sends HTTP POST to configured API webhooks when subscription is created';
COMMENT ON FUNCTION trigger_webhooks_on_subscription_update() IS 'Sends HTTP POST to configured API webhooks when subscription is updated';
COMMENT ON FUNCTION trigger_webhooks_on_subscription_delete() IS 'Sends HTTP POST to configured API webhooks when subscription is deleted';

COMMENT ON FUNCTION trigger_webhooks_on_receipt_create() IS 'Sends HTTP POST to configured API webhooks when receipt is created';
COMMENT ON FUNCTION trigger_webhooks_on_receipt_update() IS 'Sends HTTP POST to configured API webhooks when receipt is updated';
COMMENT ON FUNCTION trigger_webhooks_on_receipt_delete() IS 'Sends HTTP POST to configured API webhooks when receipt is deleted';

-- ============================================================================
-- MIGRATION 10: 20251019144700_add_billing_workflow_triggers.sql
-- ============================================================================
/*
  # Add Billing Workflow Triggers

  Adds trigger definitions for estimates, invoices, subscriptions, and receipts
  to the workflow_triggers table so they appear in the workflow builder UI
  and can be used to trigger automations.

  1. New Workflow Triggers
    - ESTIMATE_CREATED, ESTIMATE_UPDATED, ESTIMATE_DELETED
    - INVOICE_CREATED, INVOICE_UPDATED, INVOICE_DELETED
    - SUBSCRIPTION_CREATED, SUBSCRIPTION_UPDATED, SUBSCRIPTION_DELETED
    - RECEIPT_CREATED, RECEIPT_UPDATED, RECEIPT_DELETED

  2. Event Schemas
    - Each trigger includes detailed event schema with all relevant fields
    - Schemas define what data is available for workflow automations
    - Includes both current and previous values for update events
*/

-- Insert ESTIMATE_CREATED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'estimate_created',
  'Estimate Created',
  'Triggered when a new estimate is created',
  'ESTIMATE_CREATED',
  '[
    {"field": "estimate_id", "type": "text", "description": "Human-readable estimate ID (e.g., EST0001)"},
    {"field": "customer_id", "type": "uuid", "description": "Customer unique identifier"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "customer_phone", "type": "text", "description": "Customer phone"},
    {"field": "title", "type": "text", "description": "Estimate title"},
    {"field": "items", "type": "jsonb", "description": "Line items array"},
    {"field": "subtotal", "type": "numeric", "description": "Subtotal amount"},
    {"field": "discount", "type": "numeric", "description": "Discount amount"},
    {"field": "tax_rate", "type": "numeric", "description": "Tax rate percentage"},
    {"field": "tax_amount", "type": "numeric", "description": "Calculated tax amount"},
    {"field": "total_amount", "type": "numeric", "description": "Total amount"},
    {"field": "notes", "type": "text", "description": "Internal notes"},
    {"field": "status", "type": "text", "description": "Draft, Sent, Accepted, Declined, Expired"},
    {"field": "valid_until", "type": "date", "description": "Estimate validity date"},
    {"field": "created_at", "type": "timestamptz", "description": "When created"},
    {"field": "sent_at", "type": "timestamptz", "description": "When sent to customer"}
  ]'::jsonb,
  'Billing',
  'file-text'
) ON CONFLICT (name) DO NOTHING;

-- Insert ESTIMATE_UPDATED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'estimate_updated',
  'Estimate Updated',
  'Triggered when an estimate is updated',
  'ESTIMATE_UPDATED',
  '[
    {"field": "estimate_id", "type": "text", "description": "Human-readable estimate ID (e.g., EST0001)"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "title", "type": "text", "description": "Estimate title"},
    {"field": "total_amount", "type": "numeric", "description": "Total amount"},
    {"field": "status", "type": "text", "description": "Draft, Sent, Accepted, Declined, Expired"},
    {"field": "updated_at", "type": "timestamptz", "description": "When updated"},
    {"field": "old_status", "type": "text", "description": "Previous status"},
    {"field": "old_total_amount", "type": "numeric", "description": "Previous total amount"}
  ]'::jsonb,
  'Billing',
  'file-text'
) ON CONFLICT (name) DO NOTHING;

-- Insert ESTIMATE_DELETED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'estimate_deleted',
  'Estimate Deleted',
  'Triggered when an estimate is deleted',
  'ESTIMATE_DELETED',
  '[
    {"field": "estimate_id", "type": "text", "description": "Human-readable estimate ID (e.g., EST0001)"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "title", "type": "text", "description": "Estimate title"},
    {"field": "total_amount", "type": "numeric", "description": "Total amount"},
    {"field": "status", "type": "text", "description": "Status at deletion"},
    {"field": "deleted_at", "type": "timestamptz", "description": "When deleted"}
  ]'::jsonb,
  'Billing',
  'file-text'
) ON CONFLICT (name) DO NOTHING;

-- Insert INVOICE_CREATED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'invoice_created',
  'Invoice Created',
  'Triggered when a new invoice is created',
  'INVOICE_CREATED',
  '[
    {"field": "invoice_id", "type": "text", "description": "Human-readable invoice ID (e.g., INV0001)"},
    {"field": "estimate_id", "type": "text", "description": "Related estimate ID (if converted)"},
    {"field": "customer_id", "type": "uuid", "description": "Customer unique identifier"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "title", "type": "text", "description": "Invoice title"},
    {"field": "items", "type": "jsonb", "description": "Line items array"},
    {"field": "total_amount", "type": "numeric", "description": "Total amount"},
    {"field": "paid_amount", "type": "numeric", "description": "Amount paid"},
    {"field": "balance_due", "type": "numeric", "description": "Balance due"},
    {"field": "status", "type": "text", "description": "Draft, Sent, Paid, Overdue, Cancelled"},
    {"field": "payment_method", "type": "text", "description": "Payment method"},
    {"field": "issue_date", "type": "date", "description": "Invoice issue date"},
    {"field": "due_date", "type": "date", "description": "Payment due date"},
    {"field": "created_at", "type": "timestamptz", "description": "When created"}
  ]'::jsonb,
  'Billing',
  'receipt'
) ON CONFLICT (name) DO NOTHING;

-- Insert INVOICE_UPDATED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'invoice_updated',
  'Invoice Updated',
  'Triggered when an invoice is updated (status change, payment received)',
  'INVOICE_UPDATED',
  '[
    {"field": "invoice_id", "type": "text", "description": "Human-readable invoice ID (e.g., INV0001)"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "title", "type": "text", "description": "Invoice title"},
    {"field": "total_amount", "type": "numeric", "description": "Total amount"},
    {"field": "paid_amount", "type": "numeric", "description": "Amount paid"},
    {"field": "balance_due", "type": "numeric", "description": "Balance due"},
    {"field": "status", "type": "text", "description": "Draft, Sent, Paid, Overdue, Cancelled"},
    {"field": "payment_method", "type": "text", "description": "Payment method"},
    {"field": "due_date", "type": "date", "description": "Payment due date"},
    {"field": "paid_date", "type": "date", "description": "Date payment received"},
    {"field": "updated_at", "type": "timestamptz", "description": "When updated"},
    {"field": "old_status", "type": "text", "description": "Previous status"},
    {"field": "old_paid_amount", "type": "numeric", "description": "Previous paid amount"},
    {"field": "old_balance_due", "type": "numeric", "description": "Previous balance due"}
  ]'::jsonb,
  'Billing',
  'receipt'
) ON CONFLICT (name) DO NOTHING;

-- Insert INVOICE_DELETED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'invoice_deleted',
  'Invoice Deleted',
  'Triggered when an invoice is deleted',
  'INVOICE_DELETED',
  '[
    {"field": "invoice_id", "type": "text", "description": "Human-readable invoice ID (e.g., INV0001)"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "title", "type": "text", "description": "Invoice title"},
    {"field": "total_amount", "type": "numeric", "description": "Total amount"},
    {"field": "balance_due", "type": "numeric", "description": "Balance due at deletion"},
    {"field": "status", "type": "text", "description": "Status at deletion"},
    {"field": "deleted_at", "type": "timestamptz", "description": "When deleted"}
  ]'::jsonb,
  'Billing',
  'receipt'
) ON CONFLICT (name) DO NOTHING;

-- Insert SUBSCRIPTION_CREATED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'subscription_created',
  'Subscription Created',
  'Triggered when a new subscription is created',
  'SUBSCRIPTION_CREATED',
  '[
    {"field": "subscription_id", "type": "text", "description": "Human-readable subscription ID (e.g., SUB0001)"},
    {"field": "customer_id", "type": "uuid", "description": "Customer unique identifier"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "plan_name", "type": "text", "description": "Subscription plan name"},
    {"field": "plan_type", "type": "text", "description": "Monthly, Quarterly, Yearly, Lifetime"},
    {"field": "amount", "type": "numeric", "description": "Subscription amount"},
    {"field": "currency", "type": "text", "description": "Currency code"},
    {"field": "billing_cycle_day", "type": "integer", "description": "Day of month for billing (1-31)"},
    {"field": "status", "type": "text", "description": "Active, Paused, Cancelled, Expired"},
    {"field": "payment_method", "type": "text", "description": "Payment method"},
    {"field": "start_date", "type": "date", "description": "Subscription start date"},
    {"field": "end_date", "type": "date", "description": "Subscription end date"},
    {"field": "next_billing_date", "type": "date", "description": "Next billing date"},
    {"field": "auto_renew", "type": "boolean", "description": "Auto-renewal enabled"},
    {"field": "created_at", "type": "timestamptz", "description": "When created"}
  ]'::jsonb,
  'Billing',
  'repeat'
) ON CONFLICT (name) DO NOTHING;

-- Insert SUBSCRIPTION_UPDATED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'subscription_updated',
  'Subscription Updated',
  'Triggered when a subscription is updated (status change, renewal, cancellation)',
  'SUBSCRIPTION_UPDATED',
  '[
    {"field": "subscription_id", "type": "text", "description": "Human-readable subscription ID (e.g., SUB0001)"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "plan_name", "type": "text", "description": "Subscription plan name"},
    {"field": "amount", "type": "numeric", "description": "Subscription amount"},
    {"field": "status", "type": "text", "description": "Active, Paused, Cancelled, Expired"},
    {"field": "payment_method", "type": "text", "description": "Payment method"},
    {"field": "next_billing_date", "type": "date", "description": "Next billing date"},
    {"field": "auto_renew", "type": "boolean", "description": "Auto-renewal enabled"},
    {"field": "updated_at", "type": "timestamptz", "description": "When updated"},
    {"field": "cancelled_at", "type": "timestamptz", "description": "When cancelled (if applicable)"},
    {"field": "cancelled_reason", "type": "text", "description": "Cancellation reason"},
    {"field": "old_status", "type": "text", "description": "Previous status"},
    {"field": "old_next_billing_date", "type": "date", "description": "Previous next billing date"}
  ]'::jsonb,
  'Billing',
  'repeat'
) ON CONFLICT (name) DO NOTHING;

-- Insert SUBSCRIPTION_DELETED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'subscription_deleted',
  'Subscription Deleted',
  'Triggered when a subscription is deleted from the system',
  'SUBSCRIPTION_DELETED',
  '[
    {"field": "subscription_id", "type": "text", "description": "Human-readable subscription ID (e.g., SUB0001)"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "plan_name", "type": "text", "description": "Subscription plan name"},
    {"field": "amount", "type": "numeric", "description": "Subscription amount"},
    {"field": "status", "type": "text", "description": "Status at deletion"},
    {"field": "deleted_at", "type": "timestamptz", "description": "When deleted"}
  ]'::jsonb,
  'Billing',
  'repeat'
) ON CONFLICT (name) DO NOTHING;

-- Insert RECEIPT_CREATED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'receipt_created',
  'Receipt Created',
  'Triggered when a new payment receipt is created',
  'RECEIPT_CREATED',
  '[
    {"field": "receipt_id", "type": "text", "description": "Human-readable receipt ID (e.g., REC0001)"},
    {"field": "invoice_id", "type": "text", "description": "Related invoice ID (if applicable)"},
    {"field": "subscription_id", "type": "text", "description": "Related subscription ID (if applicable)"},
    {"field": "customer_id", "type": "uuid", "description": "Customer unique identifier"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "payment_method", "type": "text", "description": "Payment method"},
    {"field": "payment_reference", "type": "text", "description": "Payment reference/transaction ID"},
    {"field": "amount_paid", "type": "numeric", "description": "Amount paid"},
    {"field": "currency", "type": "text", "description": "Currency code"},
    {"field": "payment_date", "type": "date", "description": "Payment date"},
    {"field": "description", "type": "text", "description": "Payment description"},
    {"field": "status", "type": "text", "description": "Completed, Pending, Failed, Refunded"},
    {"field": "created_at", "type": "timestamptz", "description": "When created"}
  ]'::jsonb,
  'Billing',
  'credit-card'
) ON CONFLICT (name) DO NOTHING;

-- Insert RECEIPT_UPDATED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'receipt_updated',
  'Receipt Updated',
  'Triggered when a receipt is updated (status change, refund processed)',
  'RECEIPT_UPDATED',
  '[
    {"field": "receipt_id", "type": "text", "description": "Human-readable receipt ID (e.g., REC0001)"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "payment_method", "type": "text", "description": "Payment method"},
    {"field": "payment_reference", "type": "text", "description": "Payment reference/transaction ID"},
    {"field": "amount_paid", "type": "numeric", "description": "Amount paid"},
    {"field": "status", "type": "text", "description": "Completed, Pending, Failed, Refunded"},
    {"field": "refund_amount", "type": "numeric", "description": "Refund amount (if applicable)"},
    {"field": "refund_date", "type": "date", "description": "Refund date"},
    {"field": "refund_reason", "type": "text", "description": "Refund reason"},
    {"field": "updated_at", "type": "timestamptz", "description": "When updated"},
    {"field": "old_status", "type": "text", "description": "Previous status"},
    {"field": "old_refund_amount", "type": "numeric", "description": "Previous refund amount"}
  ]'::jsonb,
  'Billing',
  'credit-card'
) ON CONFLICT (name) DO NOTHING;

-- Insert RECEIPT_DELETED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'receipt_deleted',
  'Receipt Deleted',
  'Triggered when a receipt is deleted from the system',
  'RECEIPT_DELETED',
  '[
    {"field": "receipt_id", "type": "text", "description": "Human-readable receipt ID (e.g., REC0001)"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "amount_paid", "type": "numeric", "description": "Amount paid"},
    {"field": "payment_date", "type": "date", "description": "Payment date"},
    {"field": "status", "type": "text", "description": "Status at deletion"},
    {"field": "deleted_at", "type": "timestamptz", "description": "When deleted"}
  ]'::jsonb,
  'Billing',
  'credit-card'
) ON CONFLICT (name) DO NOTHING;

-- Add comments
COMMENT ON COLUMN workflow_triggers.name IS 'Unique trigger name used in code and database triggers';
COMMENT ON COLUMN workflow_triggers.event_name IS 'Event name used in api_webhooks and workflow automations';

-- ============================================================================
-- MIGRATION 11: 20251019151010_20251019144700_add_billing_workflow_triggers.sql
-- ============================================================================
/*
  # Add Billing Workflow Triggers

  Adds trigger definitions for estimates, invoices, subscriptions, and receipts
  to the workflow_triggers table so they appear in the workflow builder UI
  and can be used to trigger automations.

  1. New Workflow Triggers
    - ESTIMATE_CREATED, ESTIMATE_UPDATED, ESTIMATE_DELETED
    - INVOICE_CREATED, INVOICE_UPDATED, INVOICE_DELETED
    - SUBSCRIPTION_CREATED, SUBSCRIPTION_UPDATED, SUBSCRIPTION_DELETED
    - RECEIPT_CREATED, RECEIPT_UPDATED, RECEIPT_DELETED

  2. Event Schemas
    - Each trigger includes detailed event schema with all relevant fields
    - Schemas define what data is available for workflow automations
    - Includes both current and previous values for update events
*/

-- Insert ESTIMATE_CREATED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'estimate_created',
  'Estimate Created',
  'Triggered when a new estimate is created',
  'ESTIMATE_CREATED',
  '[
    {"field": "estimate_id", "type": "text", "description": "Human-readable estimate ID (e.g., EST0001)"},
    {"field": "customer_id", "type": "uuid", "description": "Customer unique identifier"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "customer_phone", "type": "text", "description": "Customer phone"},
    {"field": "title", "type": "text", "description": "Estimate title"},
    {"field": "items", "type": "jsonb", "description": "Line items array"},
    {"field": "subtotal", "type": "numeric", "description": "Subtotal amount"},
    {"field": "discount", "type": "numeric", "description": "Discount amount"},
    {"field": "tax_rate", "type": "numeric", "description": "Tax rate percentage"},
    {"field": "tax_amount", "type": "numeric", "description": "Calculated tax amount"},
    {"field": "total_amount", "type": "numeric", "description": "Total amount"},
    {"field": "notes", "type": "text", "description": "Internal notes"},
    {"field": "status", "type": "text", "description": "Draft, Sent, Accepted, Declined, Expired"},
    {"field": "valid_until", "type": "date", "description": "Estimate validity date"},
    {"field": "created_at", "type": "timestamptz", "description": "When created"},
    {"field": "sent_at", "type": "timestamptz", "description": "When sent to customer"}
  ]'::jsonb,
  'Billing',
  'file-text'
) ON CONFLICT (name) DO NOTHING;

-- Insert ESTIMATE_UPDATED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'estimate_updated',
  'Estimate Updated',
  'Triggered when an estimate is updated',
  'ESTIMATE_UPDATED',
  '[
    {"field": "estimate_id", "type": "text", "description": "Human-readable estimate ID (e.g., EST0001)"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "title", "type": "text", "description": "Estimate title"},
    {"field": "total_amount", "type": "numeric", "description": "Total amount"},
    {"field": "status", "type": "text", "description": "Draft, Sent, Accepted, Declined, Expired"},
    {"field": "updated_at", "type": "timestamptz", "description": "When updated"},
    {"field": "old_status", "type": "text", "description": "Previous status"},
    {"field": "old_total_amount", "type": "numeric", "description": "Previous total amount"}
  ]'::jsonb,
  'Billing',
  'file-text'
) ON CONFLICT (name) DO NOTHING;

-- Insert ESTIMATE_DELETED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'estimate_deleted',
  'Estimate Deleted',
  'Triggered when an estimate is deleted',
  'ESTIMATE_DELETED',
  '[
    {"field": "estimate_id", "type": "text", "description": "Human-readable estimate ID (e.g., EST0001)"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "title", "type": "text", "description": "Estimate title"},
    {"field": "total_amount", "type": "numeric", "description": "Total amount"},
    {"field": "status", "type": "text", "description": "Status at deletion"},
    {"field": "deleted_at", "type": "timestamptz", "description": "When deleted"}
  ]'::jsonb,
  'Billing',
  'file-text'
) ON CONFLICT (name) DO NOTHING;

-- Insert INVOICE_CREATED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'invoice_created',
  'Invoice Created',
  'Triggered when a new invoice is created',
  'INVOICE_CREATED',
  '[
    {"field": "invoice_id", "type": "text", "description": "Human-readable invoice ID (e.g., INV0001)"},
    {"field": "estimate_id", "type": "text", "description": "Related estimate ID (if converted)"},
    {"field": "customer_id", "type": "uuid", "description": "Customer unique identifier"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "title", "type": "text", "description": "Invoice title"},
    {"field": "items", "type": "jsonb", "description": "Line items array"},
    {"field": "total_amount", "type": "numeric", "description": "Total amount"},
    {"field": "paid_amount", "type": "numeric", "description": "Amount paid"},
    {"field": "balance_due", "type": "numeric", "description": "Balance due"},
    {"field": "status", "type": "text", "description": "Draft, Sent, Paid, Overdue, Cancelled"},
    {"field": "payment_method", "type": "text", "description": "Payment method"},
    {"field": "issue_date", "type": "date", "description": "Invoice issue date"},
    {"field": "due_date", "type": "date", "description": "Payment due date"},
    {"field": "created_at", "type": "timestamptz", "description": "When created"}
  ]'::jsonb,
  'Billing',
  'receipt'
) ON CONFLICT (name) DO NOTHING;

-- Insert INVOICE_UPDATED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'invoice_updated',
  'Invoice Updated',
  'Triggered when an invoice is updated (status change, payment received)',
  'INVOICE_UPDATED',
  '[
    {"field": "invoice_id", "type": "text", "description": "Human-readable invoice ID (e.g., INV0001)"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "title", "type": "text", "description": "Invoice title"},
    {"field": "total_amount", "type": "numeric", "description": "Total amount"},
    {"field": "paid_amount", "type": "numeric", "description": "Amount paid"},
    {"field": "balance_due", "type": "numeric", "description": "Balance due"},
    {"field": "status", "type": "text", "description": "Draft, Sent, Paid, Overdue, Cancelled"},
    {"field": "payment_method", "type": "text", "description": "Payment method"},
    {"field": "due_date", "type": "date", "description": "Payment due date"},
    {"field": "paid_date", "type": "date", "description": "Date payment received"},
    {"field": "updated_at", "type": "timestamptz", "description": "When updated"},
    {"field": "old_status", "type": "text", "description": "Previous status"},
    {"field": "old_paid_amount", "type": "numeric", "description": "Previous paid amount"},
    {"field": "old_balance_due", "type": "numeric", "description": "Previous balance due"}
  ]'::jsonb,
  'Billing',
  'receipt'
) ON CONFLICT (name) DO NOTHING;

-- Insert INVOICE_DELETED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'invoice_deleted',
  'Invoice Deleted',
  'Triggered when an invoice is deleted',
  'INVOICE_DELETED',
  '[
    {"field": "invoice_id", "type": "text", "description": "Human-readable invoice ID (e.g., INV0001)"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "title", "type": "text", "description": "Invoice title"},
    {"field": "total_amount", "type": "numeric", "description": "Total amount"},
    {"field": "balance_due", "type": "numeric", "description": "Balance due at deletion"},
    {"field": "status", "type": "text", "description": "Status at deletion"},
    {"field": "deleted_at", "type": "timestamptz", "description": "When deleted"}
  ]'::jsonb,
  'Billing',
  'receipt'
) ON CONFLICT (name) DO NOTHING;

-- Insert SUBSCRIPTION_CREATED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'subscription_created',
  'Subscription Created',
  'Triggered when a new subscription is created',
  'SUBSCRIPTION_CREATED',
  '[
    {"field": "subscription_id", "type": "text", "description": "Human-readable subscription ID (e.g., SUB0001)"},
    {"field": "customer_id", "type": "uuid", "description": "Customer unique identifier"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "plan_name", "type": "text", "description": "Subscription plan name"},
    {"field": "plan_type", "type": "text", "description": "Monthly, Quarterly, Yearly, Lifetime"},
    {"field": "amount", "type": "numeric", "description": "Subscription amount"},
    {"field": "currency", "type": "text", "description": "Currency code"},
    {"field": "billing_cycle_day", "type": "integer", "description": "Day of month for billing (1-31)"},
    {"field": "status", "type": "text", "description": "Active, Paused, Cancelled, Expired"},
    {"field": "payment_method", "type": "text", "description": "Payment method"},
    {"field": "start_date", "type": "date", "description": "Subscription start date"},
    {"field": "end_date", "type": "date", "description": "Subscription end date"},
    {"field": "next_billing_date", "type": "date", "description": "Next billing date"},
    {"field": "auto_renew", "type": "boolean", "description": "Auto-renewal enabled"},
    {"field": "created_at", "type": "timestamptz", "description": "When created"}
  ]'::jsonb,
  'Billing',
  'repeat'
) ON CONFLICT (name) DO NOTHING;

-- Insert SUBSCRIPTION_UPDATED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'subscription_updated',
  'Subscription Updated',
  'Triggered when a subscription is updated (status change, renewal, cancellation)',
  'SUBSCRIPTION_UPDATED',
  '[
    {"field": "subscription_id", "type": "text", "description": "Human-readable subscription ID (e.g., SUB0001)"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "plan_name", "type": "text", "description": "Subscription plan name"},
    {"field": "amount", "type": "numeric", "description": "Subscription amount"},
    {"field": "status", "type": "text", "description": "Active, Paused, Cancelled, Expired"},
    {"field": "payment_method", "type": "text", "description": "Payment method"},
    {"field": "next_billing_date", "type": "date", "description": "Next billing date"},
    {"field": "auto_renew", "type": "boolean", "description": "Auto-renewal enabled"},
    {"field": "updated_at", "type": "timestamptz", "description": "When updated"},
    {"field": "cancelled_at", "type": "timestamptz", "description": "When cancelled (if applicable)"},
    {"field": "cancelled_reason", "type": "text", "description": "Cancellation reason"},
    {"field": "old_status", "type": "text", "description": "Previous status"},
    {"field": "old_next_billing_date", "type": "date", "description": "Previous next billing date"}
  ]'::jsonb,
  'Billing',
  'repeat'
) ON CONFLICT (name) DO NOTHING;

-- Insert SUBSCRIPTION_DELETED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'subscription_deleted',
  'Subscription Deleted',
  'Triggered when a subscription is deleted from the system',
  'SUBSCRIPTION_DELETED',
  '[
    {"field": "subscription_id", "type": "text", "description": "Human-readable subscription ID (e.g., SUB0001)"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "plan_name", "type": "text", "description": "Subscription plan name"},
    {"field": "amount", "type": "numeric", "description": "Subscription amount"},
    {"field": "status", "type": "text", "description": "Status at deletion"},
    {"field": "deleted_at", "type": "timestamptz", "description": "When deleted"}
  ]'::jsonb,
  'Billing',
  'repeat'
) ON CONFLICT (name) DO NOTHING;

-- Insert RECEIPT_CREATED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'receipt_created',
  'Receipt Created',
  'Triggered when a new payment receipt is created',
  'RECEIPT_CREATED',
  '[
    {"field": "receipt_id", "type": "text", "description": "Human-readable receipt ID (e.g., REC0001)"},
    {"field": "invoice_id", "type": "text", "description": "Related invoice ID (if applicable)"},
    {"field": "subscription_id", "type": "text", "description": "Related subscription ID (if applicable)"},
    {"field": "customer_id", "type": "uuid", "description": "Customer unique identifier"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "payment_method", "type": "text", "description": "Payment method"},
    {"field": "payment_reference", "type": "text", "description": "Payment reference/transaction ID"},
    {"field": "amount_paid", "type": "numeric", "description": "Amount paid"},
    {"field": "currency", "type": "text", "description": "Currency code"},
    {"field": "payment_date", "type": "date", "description": "Payment date"},
    {"field": "description", "type": "text", "description": "Payment description"},
    {"field": "status", "type": "text", "description": "Completed, Pending, Failed, Refunded"},
    {"field": "created_at", "type": "timestamptz", "description": "When created"}
  ]'::jsonb,
  'Billing',
  'credit-card'
) ON CONFLICT (name) DO NOTHING;

-- Insert RECEIPT_UPDATED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'receipt_updated',
  'Receipt Updated',
  'Triggered when a receipt is updated (status change, refund processed)',
  'RECEIPT_UPDATED',
  '[
    {"field": "receipt_id", "type": "text", "description": "Human-readable receipt ID (e.g., REC0001)"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "payment_method", "type": "text", "description": "Payment method"},
    {"field": "payment_reference", "type": "text", "description": "Payment reference/transaction ID"},
    {"field": "amount_paid", "type": "numeric", "description": "Amount paid"},
    {"field": "status", "type": "text", "description": "Completed, Pending, Failed, Refunded"},
    {"field": "refund_amount", "type": "numeric", "description": "Refund amount (if applicable)"},
    {"field": "refund_date", "type": "date", "description": "Refund date"},
    {"field": "refund_reason", "type": "text", "description": "Refund reason"},
    {"field": "updated_at", "type": "timestamptz", "description": "When updated"},
    {"field": "old_status", "type": "text", "description": "Previous status"},
    {"field": "old_refund_amount", "type": "numeric", "description": "Previous refund amount"}
  ]'::jsonb,
  'Billing',
  'credit-card'
) ON CONFLICT (name) DO NOTHING;

-- Insert RECEIPT_DELETED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'receipt_deleted',
  'Receipt Deleted',
  'Triggered when a receipt is deleted from the system',
  'RECEIPT_DELETED',
  '[
    {"field": "receipt_id", "type": "text", "description": "Human-readable receipt ID (e.g., REC0001)"},
    {"field": "customer_name", "type": "text", "description": "Customer name"},
    {"field": "customer_email", "type": "text", "description": "Customer email"},
    {"field": "amount_paid", "type": "numeric", "description": "Amount paid"},
    {"field": "payment_date", "type": "date", "description": "Payment date"},
    {"field": "status", "type": "text", "description": "Status at deletion"},
    {"field": "deleted_at", "type": "timestamptz", "description": "When deleted"}
  ]'::jsonb,
  'Billing',
  'credit-card'
) ON CONFLICT (name) DO NOTHING;

-- Add comments
COMMENT ON COLUMN workflow_triggers.name IS 'Unique trigger name used in code and database triggers';
COMMENT ON COLUMN workflow_triggers.event_name IS 'Event name used in api_webhooks and workflow automations';

/*
================================================================================
END OF GROUP 7: BILLING SYSTEM TABLES
================================================================================
Next Group: group-08-contacts-master-and-sync-system.sql
*/
