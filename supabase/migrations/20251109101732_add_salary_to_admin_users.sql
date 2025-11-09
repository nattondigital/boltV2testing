/*
  # Add salary column to admin_users table

  1. Changes
    - Add `salary` column to `admin_users` table
      - Type: numeric (for storing salary amounts)
      - Default: 0 (to avoid null issues)
      - Optional field that can be updated per user
  
  2. Notes
    - Salary will be used for payroll calculations
    - Default value of 0 means no salary data yet
*/

-- Add salary column to admin_users table
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS salary numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN admin_users.salary IS 'Monthly salary amount for payroll calculations';
