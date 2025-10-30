/*
================================================================================
GROUP 6: PRODUCTS, EXPENSES, AND LEAVE MANAGEMENT
================================================================================

Products master, expenses, leave requests with their respective triggers

Total Files: 6
Dependencies: Group 5

Files Included (in execution order):
1. 20251018200513_create_expenses_table.sql
2. 20251018200610_create_expense_triggers.sql
3. 20251019121208_create_products_master_table.sql
4. 20251019121307_create_product_triggers.sql
5. 20251019124600_create_leave_requests_table.sql
6. 20251019124703_create_leave_request_triggers.sql

================================================================================
*/

-- ============================================================================
-- MIGRATION 1: 20251018200513_create_expenses_table.sql
-- ============================================================================
/*
  # Create Expenses Table

  1. New Tables
    - `expenses`
      - `id` (uuid, primary key)
      - `expense_id` (text, unique, human-readable ID like EXP001)
      - `admin_user_id` (uuid, foreign key to admin_users)
      - `category` (text, expense category)
      - `amount` (numeric, expense amount)
      - `currency` (text, default 'INR')
      - `description` (text, expense description)
      - `expense_date` (date, when the expense occurred)
      - `payment_method` (text, Cash, Card, UPI, etc.)
      - `receipt_url` (text, URL to receipt/invoice)
      - `status` (text, Pending, Approved, Rejected, Reimbursed)
      - `approved_by` (uuid, foreign key to admin_users)
      - `approved_at` (timestamptz, when approved)
      - `notes` (text, additional notes)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `expenses` table
    - Add policy for anonymous users to read all expenses
    - Add policy for anonymous users to insert expenses
    - Add policy for anonymous users to update expenses
    - Add policy for anonymous users to delete expenses

  3. Indexes
    - Index on admin_user_id for faster queries
    - Index on expense_date for filtering by date
    - Index on status for filtering by status
*/

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id text UNIQUE NOT NULL,
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE CASCADE,
  category text NOT NULL,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  currency text DEFAULT 'INR',
  description text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  receipt_url text,
  status text DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Reimbursed')),
  approved_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_expenses_admin_user_id ON expenses(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);

-- Create function to generate expense ID
CREATE OR REPLACE FUNCTION generate_expense_id()
RETURNS text AS $$
DECLARE
  next_id integer;
  new_expense_id text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_id FROM expenses;
  new_expense_id := 'EXP' || LPAD(next_id::text, 3, '0');
  
  WHILE EXISTS (SELECT 1 FROM expenses WHERE expense_id = new_expense_id) LOOP
    next_id := next_id + 1;
    new_expense_id := 'EXP' || LPAD(next_id::text, 3, '0');
  END LOOP;
  
  RETURN new_expense_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate expense_id
CREATE OR REPLACE FUNCTION set_expense_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expense_id IS NULL OR NEW.expense_id = '' THEN
    NEW.expense_id := generate_expense_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_expense_id ON expenses;
CREATE TRIGGER trigger_set_expense_id
  BEFORE INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION set_expense_id();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_expenses_updated_at_trigger ON expenses;
CREATE TRIGGER update_expenses_updated_at_trigger
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_expenses_updated_at();

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for anonymous access (temporary - should be restricted in production)
CREATE POLICY "Allow anonymous read access to expenses"
  ON expenses
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to expenses"
  ON expenses
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to expenses"
  ON expenses
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to expenses"
  ON expenses
  FOR DELETE
  TO anon
  USING (true);

-- Add comments
COMMENT ON TABLE expenses IS 'Stores expense records for team members';
COMMENT ON COLUMN expenses.expense_id IS 'Human-readable expense ID (e.g., EXP001)';
COMMENT ON COLUMN expenses.admin_user_id IS 'Team member who submitted the expense';
COMMENT ON COLUMN expenses.category IS 'Expense category (Travel, Food, Office Supplies, etc.)';
COMMENT ON COLUMN expenses.amount IS 'Expense amount';
COMMENT ON COLUMN expenses.currency IS 'Currency code (default: INR)';
COMMENT ON COLUMN expenses.status IS 'Expense status (Pending, Approved, Rejected, Reimbursed)';
COMMENT ON COLUMN expenses.approved_by IS 'Admin who approved/rejected the expense';
COMMENT ON COLUMN expenses.approved_at IS 'When the expense was approved/rejected';

-- ============================================================================
-- MIGRATION 2: 20251018200610_create_expense_triggers.sql
-- ============================================================================
/*
  # Create Expense Trigger Events

  1. Changes
    - Create database trigger functions for expense operations
    - Add triggers on expenses table for INSERT, UPDATE, and DELETE operations
    - When an expense is added/updated/deleted, check for active API webhooks
    - Send notification to configured webhook URLs
    - Track webhook statistics (total_calls, success_count, failure_count)

  2. New Trigger Events
    - EXPENSE_ADDED: Triggers when a new expense is created
    - EXPENSE_UPDATED: Triggers when an expense is updated
    - EXPENSE_DELETED: Triggers when an expense is deleted

  3. Functionality
    - Triggers both API webhooks and workflow automations based on expense operations
    - Passes all expense data to webhooks and workflows
    - For updates, includes both NEW and previous values
    - For deletes, includes the deleted expense data with deleted_at timestamp
    - Supports multiple webhooks being triggered by the same event
    - Includes 'trigger_event' field in payload for easy event identification

  4. Security
    - Uses existing RLS policies on api_webhooks and workflow_executions tables
    - SECURITY DEFINER ensures triggers have permission to update statistics
*/

-- Create function to trigger workflows when a new expense is added
CREATE OR REPLACE FUNCTION trigger_workflows_on_expense_add()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  api_webhook_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
  trigger_data jsonb;
  request_id bigint;
  webhook_success boolean;
BEGIN
  -- Build trigger data with trigger_event
  trigger_data := jsonb_build_object(
    'trigger_event', 'EXPENSE_ADDED',
    'id', NEW.id,
    'expense_id', NEW.expense_id,
    'admin_user_id', NEW.admin_user_id,
    'category', NEW.category,
    'amount', NEW.amount,
    'currency', NEW.currency,
    'description', NEW.description,
    'expense_date', NEW.expense_date,
    'payment_method', NEW.payment_method,
    'receipt_url', NEW.receipt_url,
    'status', NEW.status,
    'approved_by', NEW.approved_by,
    'approved_at', NEW.approved_at,
    'notes', NEW.notes,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'EXPENSE_ADDED'
      AND is_active = true
  LOOP
    BEGIN
      webhook_success := false;
      
      -- Make HTTP POST request using pg_net
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      -- Update success statistics
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Update failure statistics
        UPDATE api_webhooks
        SET 
          total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
        WHERE id = api_webhook_record.id;
        
        RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  -- Process Workflow Automations
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
    
    -- Check if this is an EXPENSE_ADDED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'EXPENSE_ADDED' THEN
      
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
        'EXPENSE_ADDED',
        trigger_data,
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
          'trigger_type', 'EXPENSE_ADDED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to trigger workflows when an expense is updated
CREATE OR REPLACE FUNCTION trigger_workflows_on_expense_update()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  api_webhook_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
  trigger_data jsonb;
  request_id bigint;
  webhook_success boolean;
BEGIN
  -- Build trigger data with trigger_event and previous values
  trigger_data := jsonb_build_object(
    'trigger_event', 'EXPENSE_UPDATED',
    'id', NEW.id,
    'expense_id', NEW.expense_id,
    'admin_user_id', NEW.admin_user_id,
    'category', NEW.category,
    'amount', NEW.amount,
    'currency', NEW.currency,
    'description', NEW.description,
    'expense_date', NEW.expense_date,
    'payment_method', NEW.payment_method,
    'receipt_url', NEW.receipt_url,
    'status', NEW.status,
    'approved_by', NEW.approved_by,
    'approved_at', NEW.approved_at,
    'notes', NEW.notes,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'previous', jsonb_build_object(
      'category', OLD.category,
      'amount', OLD.amount,
      'description', OLD.description,
      'expense_date', OLD.expense_date,
      'payment_method', OLD.payment_method,
      'status', OLD.status,
      'approved_by', OLD.approved_by,
      'approved_at', OLD.approved_at
    )
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'EXPENSE_UPDATED'
      AND is_active = true
  LOOP
    BEGIN
      webhook_success := false;
      
      -- Make HTTP POST request using pg_net
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      -- Update success statistics
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Update failure statistics
        UPDATE api_webhooks
        SET 
          total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
        WHERE id = api_webhook_record.id;
        
        RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  -- Process Workflow Automations
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
    
    -- Check if this is an EXPENSE_UPDATED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'EXPENSE_UPDATED' THEN
      
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
        'EXPENSE_UPDATED',
        trigger_data,
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
          'trigger_type', 'EXPENSE_UPDATED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to trigger workflows when an expense is deleted
CREATE OR REPLACE FUNCTION trigger_workflows_on_expense_delete()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  api_webhook_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
  trigger_data jsonb;
  request_id bigint;
  webhook_success boolean;
BEGIN
  -- Build trigger data with trigger_event
  trigger_data := jsonb_build_object(
    'trigger_event', 'EXPENSE_DELETED',
    'id', OLD.id,
    'expense_id', OLD.expense_id,
    'admin_user_id', OLD.admin_user_id,
    'category', OLD.category,
    'amount', OLD.amount,
    'currency', OLD.currency,
    'description', OLD.description,
    'expense_date', OLD.expense_date,
    'payment_method', OLD.payment_method,
    'receipt_url', OLD.receipt_url,
    'status', OLD.status,
    'approved_by', OLD.approved_by,
    'approved_at', OLD.approved_at,
    'notes', OLD.notes,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'deleted_at', now()
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'EXPENSE_DELETED'
      AND is_active = true
  LOOP
    BEGIN
      webhook_success := false;
      
      -- Make HTTP POST request using pg_net
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      -- Update success statistics
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Update failure statistics
        UPDATE api_webhooks
        SET 
          total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
        WHERE id = api_webhook_record.id;
        
        RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  -- Process Workflow Automations
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
    
    -- Check if this is an EXPENSE_DELETED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'EXPENSE_DELETED' THEN
      
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
        'EXPENSE_DELETED',
        trigger_data,
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
          'trigger_type', 'EXPENSE_DELETED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on expenses table for inserts
DROP TRIGGER IF EXISTS trigger_workflows_on_expense_add ON expenses;
CREATE TRIGGER trigger_workflows_on_expense_add
  AFTER INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_expense_add();

-- Create trigger on expenses table for updates
DROP TRIGGER IF EXISTS trigger_workflows_on_expense_update ON expenses;
CREATE TRIGGER trigger_workflows_on_expense_update
  AFTER UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_expense_update();

-- Create trigger on expenses table for deletes
DROP TRIGGER IF EXISTS trigger_workflows_on_expense_delete ON expenses;
CREATE TRIGGER trigger_workflows_on_expense_delete
  AFTER DELETE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_expense_delete();

-- Add comments
COMMENT ON FUNCTION trigger_workflows_on_expense_add() IS 'Triggers both API webhooks and workflow automations when a new expense is added. Includes trigger_event in payload.';
COMMENT ON FUNCTION trigger_workflows_on_expense_update() IS 'Triggers both API webhooks and workflow automations when an expense is updated. Includes trigger_event in payload.';
COMMENT ON FUNCTION trigger_workflows_on_expense_delete() IS 'Triggers both API webhooks and workflow automations when an expense is deleted. Includes trigger_event in payload.';

-- ============================================================================
-- MIGRATION 3: 20251019121208_create_products_master_table.sql
-- ============================================================================
/*
  # Create Products Master Table

  1. New Tables
    - `products`
      - `id` (uuid, primary key)
      - `product_id` (text, unique, human-readable ID like PROD001)
      - `product_name` (text, product name)
      - `product_type` (text, 'AI Automation Training' or 'AI Automation Agency Service')
      - `description` (text, product description)
      - `pricing_model` (text, 'One-Time', 'Recurring', 'Mixed')
      - `course_price` (numeric, for training products - one-time price)
      - `onboarding_fee` (numeric, for agency service - one-time setup fee)
      - `retainer_fee` (numeric, for agency service - monthly recurring fee)
      - `currency` (text, default 'INR')
      - `features` (jsonb, array of product features)
      - `duration` (text, course duration or service commitment period)
      - `is_active` (boolean, product availability)
      - `category` (text, product category/subcategory)
      - `thumbnail_url` (text, product image)
      - `sales_page_url` (text, sales/landing page URL)
      - `total_sales` (integer, default 0)
      - `total_revenue` (numeric, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `products` table
    - Add policy for anonymous users to read all products
    - Add policy for anonymous users to insert products
    - Add policy for anonymous users to update products
    - Add policy for anonymous users to delete products

  3. Indexes
    - Index on product_type for filtering by vertical
    - Index on is_active for filtering active products
    - Index on category for categorization
*/

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text UNIQUE NOT NULL,
  product_name text NOT NULL,
  product_type text NOT NULL CHECK (product_type IN ('AI Automation Training', 'AI Automation Agency Service')),
  description text,
  pricing_model text NOT NULL CHECK (pricing_model IN ('One-Time', 'Recurring', 'Mixed')),
  course_price numeric(10, 2) DEFAULT 0,
  onboarding_fee numeric(10, 2) DEFAULT 0,
  retainer_fee numeric(10, 2) DEFAULT 0,
  currency text DEFAULT 'INR',
  features jsonb DEFAULT '[]'::jsonb,
  duration text,
  is_active boolean DEFAULT true,
  category text,
  thumbnail_url text,
  sales_page_url text,
  total_sales integer DEFAULT 0,
  total_revenue numeric(12, 2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Create function to generate product ID
CREATE OR REPLACE FUNCTION generate_product_id()
RETURNS text AS $$
DECLARE
  next_id integer;
  new_product_id text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_id FROM products;
  new_product_id := 'PROD' || LPAD(next_id::text, 3, '0');
  
  WHILE EXISTS (SELECT 1 FROM products WHERE product_id = new_product_id) LOOP
    next_id := next_id + 1;
    new_product_id := 'PROD' || LPAD(next_id::text, 3, '0');
  END LOOP;
  
  RETURN new_product_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate product_id
CREATE OR REPLACE FUNCTION set_product_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.product_id IS NULL OR NEW.product_id = '' THEN
    NEW.product_id := generate_product_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_product_id ON products;
CREATE TRIGGER trigger_set_product_id
  BEFORE INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION set_product_id();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_products_updated_at_trigger ON products;
CREATE TRIGGER update_products_updated_at_trigger
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for anonymous access
CREATE POLICY "Allow anonymous read access to products"
  ON products
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to products"
  ON products
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to products"
  ON products
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to products"
  ON products
  FOR DELETE
  TO anon
  USING (true);

-- Add comments
COMMENT ON TABLE products IS 'Master table for managing products across AI Automation Training and Agency Service verticals';
COMMENT ON COLUMN products.product_id IS 'Human-readable product ID (e.g., PROD001)';
COMMENT ON COLUMN products.product_type IS 'Product vertical: AI Automation Training or AI Automation Agency Service';
COMMENT ON COLUMN products.pricing_model IS 'Pricing structure: One-Time (training), Recurring (agency retainer), or Mixed (onboarding + retainer)';
COMMENT ON COLUMN products.course_price IS 'One-time price for training courses';
COMMENT ON COLUMN products.onboarding_fee IS 'One-time setup fee for agency services';
COMMENT ON COLUMN products.retainer_fee IS 'Monthly recurring fee for agency services';
COMMENT ON COLUMN products.features IS 'JSON array of product features/benefits';
COMMENT ON COLUMN products.duration IS 'Course duration or service commitment period';
COMMENT ON COLUMN products.total_sales IS 'Total number of units sold';
COMMENT ON COLUMN products.total_revenue IS 'Total revenue generated from this product';

-- ============================================================================
-- MIGRATION 4: 20251019121307_create_product_triggers.sql
-- ============================================================================
/*
  # Create Product Trigger Events

  1. Changes
    - Create database trigger functions for product operations
    - Add triggers on products table for INSERT, UPDATE, and DELETE operations
    - When a product is added/updated/deleted, check for active API webhooks
    - Send notification to configured webhook URLs
    - Track webhook statistics (total_calls, success_count, failure_count)

  2. New Trigger Events
    - PRODUCT_ADDED: Triggers when a new product is created
    - PRODUCT_UPDATED: Triggers when a product is updated
    - PRODUCT_DELETED: Triggers when a product is deleted

  3. Functionality
    - Triggers both API webhooks and workflow automations based on product operations
    - Passes all product data to webhooks and workflows
    - For updates, includes both NEW and previous values
    - For deletes, includes the deleted product data with deleted_at timestamp
    - Supports multiple webhooks being triggered by the same event
    - Includes 'trigger_event' field in payload for easy event identification

  4. Security
    - Uses existing RLS policies on api_webhooks and workflow_executions tables
    - SECURITY DEFINER ensures triggers have permission to update statistics
*/

-- Create function to trigger workflows when a new product is added
CREATE OR REPLACE FUNCTION trigger_workflows_on_product_add()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  api_webhook_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
  trigger_data jsonb;
  request_id bigint;
  webhook_success boolean;
BEGIN
  -- Build trigger data with trigger_event
  trigger_data := jsonb_build_object(
    'trigger_event', 'PRODUCT_ADDED',
    'id', NEW.id,
    'product_id', NEW.product_id,
    'product_name', NEW.product_name,
    'product_type', NEW.product_type,
    'description', NEW.description,
    'pricing_model', NEW.pricing_model,
    'course_price', NEW.course_price,
    'onboarding_fee', NEW.onboarding_fee,
    'retainer_fee', NEW.retainer_fee,
    'currency', NEW.currency,
    'features', NEW.features,
    'duration', NEW.duration,
    'is_active', NEW.is_active,
    'category', NEW.category,
    'thumbnail_url', NEW.thumbnail_url,
    'sales_page_url', NEW.sales_page_url,
    'total_sales', NEW.total_sales,
    'total_revenue', NEW.total_revenue,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'PRODUCT_ADDED'
      AND is_active = true
  LOOP
    BEGIN
      webhook_success := false;
      
      -- Make HTTP POST request using pg_net
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      -- Update success statistics
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Update failure statistics
        UPDATE api_webhooks
        SET 
          total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
        WHERE id = api_webhook_record.id;
        
        RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  -- Process Workflow Automations
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
    
    -- Check if this is a PRODUCT_ADDED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'PRODUCT_ADDED' THEN
      
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
        'PRODUCT_ADDED',
        trigger_data,
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
          'trigger_type', 'PRODUCT_ADDED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to trigger workflows when a product is updated
CREATE OR REPLACE FUNCTION trigger_workflows_on_product_update()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  api_webhook_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
  trigger_data jsonb;
  request_id bigint;
  webhook_success boolean;
BEGIN
  -- Build trigger data with trigger_event and previous values
  trigger_data := jsonb_build_object(
    'trigger_event', 'PRODUCT_UPDATED',
    'id', NEW.id,
    'product_id', NEW.product_id,
    'product_name', NEW.product_name,
    'product_type', NEW.product_type,
    'description', NEW.description,
    'pricing_model', NEW.pricing_model,
    'course_price', NEW.course_price,
    'onboarding_fee', NEW.onboarding_fee,
    'retainer_fee', NEW.retainer_fee,
    'currency', NEW.currency,
    'features', NEW.features,
    'duration', NEW.duration,
    'is_active', NEW.is_active,
    'category', NEW.category,
    'thumbnail_url', NEW.thumbnail_url,
    'sales_page_url', NEW.sales_page_url,
    'total_sales', NEW.total_sales,
    'total_revenue', NEW.total_revenue,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'previous', jsonb_build_object(
      'product_name', OLD.product_name,
      'product_type', OLD.product_type,
      'pricing_model', OLD.pricing_model,
      'course_price', OLD.course_price,
      'onboarding_fee', OLD.onboarding_fee,
      'retainer_fee', OLD.retainer_fee,
      'is_active', OLD.is_active,
      'category', OLD.category
    )
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'PRODUCT_UPDATED'
      AND is_active = true
  LOOP
    BEGIN
      webhook_success := false;
      
      -- Make HTTP POST request using pg_net
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      -- Update success statistics
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Update failure statistics
        UPDATE api_webhooks
        SET 
          total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
        WHERE id = api_webhook_record.id;
        
        RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  -- Process Workflow Automations
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
    
    -- Check if this is a PRODUCT_UPDATED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'PRODUCT_UPDATED' THEN
      
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
        'PRODUCT_UPDATED',
        trigger_data,
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
          'trigger_type', 'PRODUCT_UPDATED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to trigger workflows when a product is deleted
CREATE OR REPLACE FUNCTION trigger_workflows_on_product_delete()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  api_webhook_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
  trigger_data jsonb;
  request_id bigint;
  webhook_success boolean;
BEGIN
  -- Build trigger data with trigger_event
  trigger_data := jsonb_build_object(
    'trigger_event', 'PRODUCT_DELETED',
    'id', OLD.id,
    'product_id', OLD.product_id,
    'product_name', OLD.product_name,
    'product_type', OLD.product_type,
    'description', OLD.description,
    'pricing_model', OLD.pricing_model,
    'course_price', OLD.course_price,
    'onboarding_fee', OLD.onboarding_fee,
    'retainer_fee', OLD.retainer_fee,
    'currency', OLD.currency,
    'features', OLD.features,
    'duration', OLD.duration,
    'is_active', OLD.is_active,
    'category', OLD.category,
    'thumbnail_url', OLD.thumbnail_url,
    'sales_page_url', OLD.sales_page_url,
    'total_sales', OLD.total_sales,
    'total_revenue', OLD.total_revenue,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'deleted_at', now()
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'PRODUCT_DELETED'
      AND is_active = true
  LOOP
    BEGIN
      webhook_success := false;
      
      -- Make HTTP POST request using pg_net
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      -- Update success statistics
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Update failure statistics
        UPDATE api_webhooks
        SET 
          total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
        WHERE id = api_webhook_record.id;
        
        RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  -- Process Workflow Automations
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
    
    -- Check if this is a PRODUCT_DELETED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'PRODUCT_DELETED' THEN
      
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
        'PRODUCT_DELETED',
        trigger_data,
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
          'trigger_type', 'PRODUCT_DELETED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on products table for inserts
DROP TRIGGER IF EXISTS trigger_workflows_on_product_add ON products;
CREATE TRIGGER trigger_workflows_on_product_add
  AFTER INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_product_add();

-- Create trigger on products table for updates
DROP TRIGGER IF EXISTS trigger_workflows_on_product_update ON products;
CREATE TRIGGER trigger_workflows_on_product_update
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_product_update();

-- Create trigger on products table for deletes
DROP TRIGGER IF EXISTS trigger_workflows_on_product_delete ON products;
CREATE TRIGGER trigger_workflows_on_product_delete
  AFTER DELETE ON products
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_product_delete();

-- Add comments
COMMENT ON FUNCTION trigger_workflows_on_product_add() IS 'Triggers both API webhooks and workflow automations when a new product is added. Includes trigger_event in payload.';
COMMENT ON FUNCTION trigger_workflows_on_product_update() IS 'Triggers both API webhooks and workflow automations when a product is updated. Includes trigger_event in payload.';
COMMENT ON FUNCTION trigger_workflows_on_product_delete() IS 'Triggers both API webhooks and workflow automations when a product is deleted. Includes trigger_event in payload.';

-- ============================================================================
-- MIGRATION 5: 20251019124600_create_leave_requests_table.sql
-- ============================================================================
/*
  # Create Leave Requests Table

  1. New Tables
    - `leave_requests`
      - `id` (uuid, primary key)
      - `request_id` (text, unique, human-readable ID like LR001)
      - `admin_user_id` (uuid, foreign key to admin_users)
      - `request_type` (text, 'Leave', 'Work From Home', 'Half Day')
      - `start_date` (date, start date of leave/WFH)
      - `end_date` (date, end date of leave/WFH)
      - `total_days` (numeric, calculated duration)
      - `reason` (text, reason for request)
      - `status` (text, 'Pending', 'Approved', 'Rejected')
      - `approved_by` (uuid, foreign key to admin_users - who approved/rejected)
      - `approved_at` (timestamptz, when it was approved/rejected)
      - `rejection_reason` (text, reason for rejection if applicable)
      - `notes` (text, additional notes)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `leave_requests` table
    - Add policy for anonymous users to read all leave requests
    - Add policy for anonymous users to insert leave requests
    - Add policy for anonymous users to update leave requests
    - Add policy for anonymous users to delete leave requests

  3. Indexes
    - Index on admin_user_id for filtering by team member
    - Index on request_type for filtering by type
    - Index on status for filtering by status
    - Index on start_date for date-based queries

  4. Functions
    - Auto-generate request_id
    - Auto-update updated_at timestamp
    - Calculate total_days based on start_date and end_date
*/

-- Create leave_requests table
CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text UNIQUE NOT NULL,
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('Leave', 'Work From Home', 'Half Day')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_days numeric(4, 1) DEFAULT 0,
  reason text NOT NULL,
  status text DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  approved_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejection_reason text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leave_requests_admin_user_id ON leave_requests(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_request_type ON leave_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_start_date ON leave_requests(start_date);

-- Create function to generate request ID
CREATE OR REPLACE FUNCTION generate_leave_request_id()
RETURNS text AS $$
DECLARE
  next_id integer;
  new_request_id text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_id FROM leave_requests;
  new_request_id := 'LR' || LPAD(next_id::text, 4, '0');
  
  WHILE EXISTS (SELECT 1 FROM leave_requests WHERE request_id = new_request_id) LOOP
    next_id := next_id + 1;
    new_request_id := 'LR' || LPAD(next_id::text, 4, '0');
  END LOOP;
  
  RETURN new_request_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate total days
CREATE OR REPLACE FUNCTION calculate_leave_days()
RETURNS TRIGGER AS $$
BEGIN
  -- For Half Day, always set to 0.5
  IF NEW.request_type = 'Half Day' THEN
    NEW.total_days := 0.5;
  ELSE
    -- Calculate days including start and end date
    NEW.total_days := (NEW.end_date - NEW.start_date) + 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate request_id
CREATE OR REPLACE FUNCTION set_leave_request_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.request_id IS NULL OR NEW.request_id = '' THEN
    NEW.request_id := generate_leave_request_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_leave_request_id ON leave_requests;
CREATE TRIGGER trigger_set_leave_request_id
  BEFORE INSERT ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_leave_request_id();

-- Create trigger to calculate total days
DROP TRIGGER IF EXISTS trigger_calculate_leave_days ON leave_requests;
CREATE TRIGGER trigger_calculate_leave_days
  BEFORE INSERT OR UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION calculate_leave_days();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_leave_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_leave_requests_updated_at_trigger ON leave_requests;
CREATE TRIGGER update_leave_requests_updated_at_trigger
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_requests_updated_at();

-- Enable RLS
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for anonymous access
CREATE POLICY "Allow anonymous read access to leave_requests"
  ON leave_requests
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to leave_requests"
  ON leave_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to leave_requests"
  ON leave_requests
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to leave_requests"
  ON leave_requests
  FOR DELETE
  TO anon
  USING (true);

-- Add comments
COMMENT ON TABLE leave_requests IS 'Table for managing team member leave requests, work from home, and half day requests';
COMMENT ON COLUMN leave_requests.request_id IS 'Human-readable request ID (e.g., LR0001)';
COMMENT ON COLUMN leave_requests.request_type IS 'Type of request: Leave, Work From Home, or Half Day';
COMMENT ON COLUMN leave_requests.total_days IS 'Total days for the request (0.5 for half day, calculated for others)';
COMMENT ON COLUMN leave_requests.status IS 'Current status: Pending, Approved, or Rejected';
COMMENT ON COLUMN leave_requests.approved_by IS 'Admin user who approved or rejected the request';
COMMENT ON COLUMN leave_requests.rejection_reason IS 'Reason provided if request was rejected';

-- ============================================================================
-- MIGRATION 6: 20251019124703_create_leave_request_triggers.sql
-- ============================================================================
/*
  # Create Leave Request Trigger Events

  1. Changes
    - Create database trigger functions for leave request operations
    - Add triggers on leave_requests table for INSERT, UPDATE, and DELETE operations
    - When a leave request is added/updated/deleted, check for active API webhooks
    - Send notification to configured webhook URLs
    - Track webhook statistics (total_calls, success_count, failure_count)

  2. New Trigger Events
    - LEAVE_REQUEST_ADDED: Triggers when a new leave request is created
    - LEAVE_REQUEST_UPDATED: Triggers when a leave request is updated
    - LEAVE_REQUEST_DELETED: Triggers when a leave request is deleted

  3. Functionality
    - Triggers both API webhooks and workflow automations based on leave request operations
    - Passes all leave request data to webhooks and workflows
    - For updates, includes both NEW and previous values
    - For deletes, includes the deleted request data with deleted_at timestamp
    - Supports multiple webhooks being triggered by the same event
    - Includes 'trigger_event' field in payload for easy event identification

  4. Security
    - Uses existing RLS policies on api_webhooks and workflow_executions tables
    - SECURITY DEFINER ensures triggers have permission to update statistics
*/

-- Create function to trigger workflows when a new leave request is added
CREATE OR REPLACE FUNCTION trigger_workflows_on_leave_request_add()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  api_webhook_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
  trigger_data jsonb;
  request_id bigint;
  webhook_success boolean;
  team_member_name text;
  approver_name text;
BEGIN
  -- Get team member name
  SELECT full_name INTO team_member_name
  FROM admin_users
  WHERE id = NEW.admin_user_id;

  -- Get approver name if applicable
  IF NEW.approved_by IS NOT NULL THEN
    SELECT full_name INTO approver_name
    FROM admin_users
    WHERE id = NEW.approved_by;
  END IF;

  -- Build trigger data with trigger_event
  trigger_data := jsonb_build_object(
    'trigger_event', 'LEAVE_REQUEST_ADDED',
    'id', NEW.id,
    'request_id', NEW.request_id,
    'admin_user_id', NEW.admin_user_id,
    'team_member_name', team_member_name,
    'request_type', NEW.request_type,
    'start_date', NEW.start_date,
    'end_date', NEW.end_date,
    'total_days', NEW.total_days,
    'reason', NEW.reason,
    'status', NEW.status,
    'approved_by', NEW.approved_by,
    'approver_name', approver_name,
    'approved_at', NEW.approved_at,
    'rejection_reason', NEW.rejection_reason,
    'notes', NEW.notes,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'LEAVE_REQUEST_ADDED'
      AND is_active = true
  LOOP
    BEGIN
      webhook_success := false;
      
      -- Make HTTP POST request using pg_net
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      -- Update success statistics
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Update failure statistics
        UPDATE api_webhooks
        SET 
          total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
        WHERE id = api_webhook_record.id;
        
        RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  -- Process Workflow Automations
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
    
    -- Check if this is a LEAVE_REQUEST_ADDED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'LEAVE_REQUEST_ADDED' THEN
      
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
        'LEAVE_REQUEST_ADDED',
        trigger_data,
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
          'trigger_type', 'LEAVE_REQUEST_ADDED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to trigger workflows when a leave request is updated
CREATE OR REPLACE FUNCTION trigger_workflows_on_leave_request_update()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  api_webhook_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
  trigger_data jsonb;
  request_id bigint;
  webhook_success boolean;
  team_member_name text;
  approver_name text;
BEGIN
  -- Get team member name
  SELECT full_name INTO team_member_name
  FROM admin_users
  WHERE id = NEW.admin_user_id;

  -- Get approver name if applicable
  IF NEW.approved_by IS NOT NULL THEN
    SELECT full_name INTO approver_name
    FROM admin_users
    WHERE id = NEW.approved_by;
  END IF;

  -- Build trigger data with trigger_event and previous values
  trigger_data := jsonb_build_object(
    'trigger_event', 'LEAVE_REQUEST_UPDATED',
    'id', NEW.id,
    'request_id', NEW.request_id,
    'admin_user_id', NEW.admin_user_id,
    'team_member_name', team_member_name,
    'request_type', NEW.request_type,
    'start_date', NEW.start_date,
    'end_date', NEW.end_date,
    'total_days', NEW.total_days,
    'reason', NEW.reason,
    'status', NEW.status,
    'approved_by', NEW.approved_by,
    'approver_name', approver_name,
    'approved_at', NEW.approved_at,
    'rejection_reason', NEW.rejection_reason,
    'notes', NEW.notes,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'previous', jsonb_build_object(
      'request_type', OLD.request_type,
      'start_date', OLD.start_date,
      'end_date', OLD.end_date,
      'total_days', OLD.total_days,
      'reason', OLD.reason,
      'status', OLD.status,
      'approved_by', OLD.approved_by,
      'approved_at', OLD.approved_at,
      'rejection_reason', OLD.rejection_reason
    )
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'LEAVE_REQUEST_UPDATED'
      AND is_active = true
  LOOP
    BEGIN
      webhook_success := false;
      
      -- Make HTTP POST request using pg_net
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      -- Update success statistics
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Update failure statistics
        UPDATE api_webhooks
        SET 
          total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
        WHERE id = api_webhook_record.id;
        
        RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  -- Process Workflow Automations
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
    
    -- Check if this is a LEAVE_REQUEST_UPDATED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'LEAVE_REQUEST_UPDATED' THEN
      
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
        'LEAVE_REQUEST_UPDATED',
        trigger_data,
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
          'trigger_type', 'LEAVE_REQUEST_UPDATED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to trigger workflows when a leave request is deleted
CREATE OR REPLACE FUNCTION trigger_workflows_on_leave_request_delete()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  api_webhook_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
  trigger_data jsonb;
  request_id bigint;
  webhook_success boolean;
  team_member_name text;
  approver_name text;
BEGIN
  -- Get team member name
  SELECT full_name INTO team_member_name
  FROM admin_users
  WHERE id = OLD.admin_user_id;

  -- Get approver name if applicable
  IF OLD.approved_by IS NOT NULL THEN
    SELECT full_name INTO approver_name
    FROM admin_users
    WHERE id = OLD.approved_by;
  END IF;

  -- Build trigger data with trigger_event
  trigger_data := jsonb_build_object(
    'trigger_event', 'LEAVE_REQUEST_DELETED',
    'id', OLD.id,
    'request_id', OLD.request_id,
    'admin_user_id', OLD.admin_user_id,
    'team_member_name', team_member_name,
    'request_type', OLD.request_type,
    'start_date', OLD.start_date,
    'end_date', OLD.end_date,
    'total_days', OLD.total_days,
    'reason', OLD.reason,
    'status', OLD.status,
    'approved_by', OLD.approved_by,
    'approver_name', approver_name,
    'approved_at', OLD.approved_at,
    'rejection_reason', OLD.rejection_reason,
    'notes', OLD.notes,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'deleted_at', now()
  );

  -- Process API Webhooks first
  FOR api_webhook_record IN
    SELECT *
    FROM api_webhooks
    WHERE trigger_event = 'LEAVE_REQUEST_DELETED'
      AND is_active = true
  LOOP
    BEGIN
      webhook_success := false;
      
      -- Make HTTP POST request using pg_net
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := trigger_data
      ) INTO request_id;
      
      webhook_success := true;
      
      -- Update success statistics
      UPDATE api_webhooks
      SET 
        total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1,
        last_triggered = now()
      WHERE id = api_webhook_record.id;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Update failure statistics
        UPDATE api_webhooks
        SET 
          total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
        WHERE id = api_webhook_record.id;
        
        RAISE NOTICE 'API Webhook failed for %: %', api_webhook_record.name, SQLERRM;
    END;
  END LOOP;

  -- Process Workflow Automations
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
    
    -- Check if this is a LEAVE_REQUEST_DELETED trigger
    IF trigger_node->>'type' = 'trigger' 
       AND trigger_node->'properties'->>'event_name' = 'LEAVE_REQUEST_DELETED' THEN
      
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
        'LEAVE_REQUEST_DELETED',
        trigger_data,
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
          'trigger_type', 'LEAVE_REQUEST_DELETED'
        )::text
      );
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on leave_requests table for inserts
DROP TRIGGER IF EXISTS trigger_workflows_on_leave_request_add ON leave_requests;
CREATE TRIGGER trigger_workflows_on_leave_request_add
  AFTER INSERT ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_leave_request_add();

-- Create trigger on leave_requests table for updates
DROP TRIGGER IF EXISTS trigger_workflows_on_leave_request_update ON leave_requests;
CREATE TRIGGER trigger_workflows_on_leave_request_update
  AFTER UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_leave_request_update();

-- Create trigger on leave_requests table for deletes
DROP TRIGGER IF EXISTS trigger_workflows_on_leave_request_delete ON leave_requests;
CREATE TRIGGER trigger_workflows_on_leave_request_delete
  AFTER DELETE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflows_on_leave_request_delete();

-- Add comments
COMMENT ON FUNCTION trigger_workflows_on_leave_request_add() IS 'Triggers both API webhooks and workflow automations when a new leave request is added. Includes trigger_event in payload.';
COMMENT ON FUNCTION trigger_workflows_on_leave_request_update() IS 'Triggers both API webhooks and workflow automations when a leave request is updated. Includes trigger_event in payload.';
COMMENT ON FUNCTION trigger_workflows_on_leave_request_delete() IS 'Triggers both API webhooks and workflow automations when a leave request is deleted. Includes trigger_event in payload.';

/*
================================================================================
END OF GROUP 6: PRODUCTS, EXPENSES, AND LEAVE MANAGEMENT
================================================================================
Next Group: group-07-billing-system-tables.sql
*/
