/*
  # Update Custom Lead Tabs Constraint

  1. Changes
    - Drop the existing check constraint that limits tab_order to 1-3
    - Add new check constraint allowing tab_order from 1-20
    - This allows more flexibility for pipelines with multiple custom tabs

  2. Security
    - No changes to RLS policies
*/

-- Drop the existing check constraint
ALTER TABLE custom_lead_tabs DROP CONSTRAINT IF EXISTS custom_lead_tabs_tab_order_check;

-- Add new check constraint allowing up to 20 tabs
ALTER TABLE custom_lead_tabs ADD CONSTRAINT custom_lead_tabs_tab_order_check 
  CHECK (tab_order >= 1 AND tab_order <= 20);
