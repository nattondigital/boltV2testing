/*
  # Add assigned_to field to leads table for proper user assignment

  1. Changes
    - Add `assigned_to` column (uuid, foreign key to admin_users)
    - Migrate existing `owner` text data to `assigned_to` where possible
    - Keep `owner` field for backward compatibility but mark as deprecated
    - Add index on `assigned_to` for efficient filtering

  2. Migration Strategy
    - Try to match existing owner text values to admin_users by full_name or role
    - If no match found, leave assigned_to as NULL
    - Existing owner field remains unchanged

  3. Security
    - No RLS changes needed (inherits from existing policies)

  4. Notes
    - assigned_to is optional to maintain backward compatibility
    - Future updates should use assigned_to instead of owner
    - The owner field can be deprecated in future versions
*/

-- Add assigned_to column to leads table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE leads ADD COLUMN assigned_to uuid REFERENCES admin_users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);

-- Migrate existing owner data to assigned_to
-- First, try to match by full_name (exact match)
UPDATE leads
SET assigned_to = admin_users.id
FROM admin_users
WHERE leads.owner = admin_users.full_name
  AND leads.assigned_to IS NULL;

-- Then, try to match by role (for cases where owner contains role names)
UPDATE leads
SET assigned_to = (
  SELECT id FROM admin_users 
  WHERE admin_users.role = leads.owner 
  LIMIT 1
)
WHERE leads.assigned_to IS NULL
  AND EXISTS (
    SELECT 1 FROM admin_users WHERE admin_users.role = leads.owner
  );
