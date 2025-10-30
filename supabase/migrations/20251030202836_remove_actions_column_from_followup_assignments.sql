/*
  # Remove Actions Column from Followup Assignments

  1. Changes
    - Drop the `actions` column from `followup_assignments` table
    
  2. Notes
    - This is a non-destructive operation for the table structure
    - Existing data in the actions column will be permanently deleted
*/

ALTER TABLE followup_assignments DROP COLUMN IF EXISTS actions;
