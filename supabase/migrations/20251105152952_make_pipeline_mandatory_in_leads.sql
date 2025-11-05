/*
  # Make Pipeline Mandatory in Leads

  1. Changes
    - Update any leads without pipeline_id to use the default pipeline
    - Make pipeline_id NOT NULL
    - Add NOT NULL constraint to ensure all future leads have a pipeline

  2. Data Safety
    - Uses default pipeline (ITR FILING) for any leads missing pipeline_id
    - No data loss - only adds missing pipeline references
*/

-- Step 1: Update any leads without pipeline_id to use the default pipeline
UPDATE leads
SET pipeline_id = (
  SELECT id FROM pipelines WHERE is_default = true LIMIT 1
)
WHERE pipeline_id IS NULL;

-- Step 2: Make pipeline_id NOT NULL
ALTER TABLE leads
ALTER COLUMN pipeline_id SET NOT NULL;