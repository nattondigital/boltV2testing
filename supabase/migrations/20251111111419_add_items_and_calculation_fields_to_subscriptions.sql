/*
  # Add Items and Calculation Fields to Subscriptions

  1. Changes
    - Add `items` column (jsonb) to store product line items
    - Add `subtotal` column to store pre-tax, pre-discount amount
    - Add `tax_rate` column to store tax percentage
    - Add `tax_amount` column to store calculated tax
    - Add `discount` column to store discount amount
    
  2. Purpose
    - Enable subscriptions to have multiple products/services
    - Support detailed pricing breakdowns similar to invoices
    - Maintain calculation transparency for billing
    
  3. Notes
    - All fields are optional for backward compatibility
    - Items field defaults to empty array
    - Calculation fields default to 0
*/

-- Add items and calculation fields to subscriptions table
DO $$ 
BEGIN
  -- Add items column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'items'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN items jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add subtotal column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'subtotal'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN subtotal numeric(12, 2) DEFAULT 0;
  END IF;

  -- Add tax_rate column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'tax_rate'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN tax_rate numeric(5, 2) DEFAULT 0;
  END IF;

  -- Add tax_amount column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'tax_amount'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN tax_amount numeric(12, 2) DEFAULT 0;
  END IF;

  -- Add discount column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'discount'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN discount numeric(12, 2) DEFAULT 0;
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN subscriptions.items IS 'Line items with product details, quantities, and prices stored as JSON';
COMMENT ON COLUMN subscriptions.subtotal IS 'Total before tax and discount';
COMMENT ON COLUMN subscriptions.tax_rate IS 'Tax percentage rate';
COMMENT ON COLUMN subscriptions.tax_amount IS 'Calculated tax amount';
COMMENT ON COLUMN subscriptions.discount IS 'Discount amount applied to subscription';
