/*
  # Update Products Table to Support CA Practice Services

  1. Changes
    - Drop existing product_type check constraint
    - Add new product_type values: 'Business Registration', 'Statutory Compliance', 'Business License'
    - Keep existing AI Automation product types for backward compatibility

  2. Notes
    - This allows the products table to support both AI Automation and CA Practice services
*/

-- Drop the existing check constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_product_type_check;

-- Add new check constraint with all product types
ALTER TABLE products ADD CONSTRAINT products_product_type_check 
  CHECK (product_type IN (
    'AI Automation Training', 
    'AI Automation Agency Service',
    'Business Registration',
    'Statutory Compliance',
    'Business License'
  ));

-- Update comment
COMMENT ON COLUMN products.product_type IS 'Product type: AI Automation Training, AI Automation Agency Service, Business Registration, Statutory Compliance, or Business License';
