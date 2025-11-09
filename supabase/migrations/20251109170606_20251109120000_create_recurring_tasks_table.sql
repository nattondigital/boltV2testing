/*
  # Create Recurring Tasks System

  1. New Tables
    - `recurring_tasks`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `contact_id` (uuid, foreign key to contacts_master)
      - `assigned_to` (uuid, foreign key to admin_users)
      - `priority` (text: low, medium, high)
      - `recurrence_type` (text: daily, weekly, monthly)
      - `recurrence_time` (time) - Time of day for the task
      - `recurrence_days` (text[]) - For weekly: array of days (mon, tue, wed, etc)
      - `recurrence_day_of_month` (integer) - For monthly: 1-31 or 0 for last day
      - `supporting_docs` (jsonb) - Array of document objects
      - `is_active` (boolean)
      - `created_by` (uuid, foreign key to admin_users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `recurring_tasks` table
    - Add policy for anonymous access (for now)
    - Add policy for authenticated users

  3. Indexes
    - Index on contact_id for faster lookups
    - Index on assigned_to for filtering
    - Index on is_active for filtering active recurring tasks
*/

-- Create recurring_tasks table
CREATE TABLE IF NOT EXISTS recurring_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  contact_id uuid REFERENCES contacts_master(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  recurrence_type text NOT NULL CHECK (recurrence_type IN ('daily', 'weekly', 'monthly')),
  recurrence_time time NOT NULL,
  recurrence_days text[], -- For weekly: ['mon', 'tue', 'wed', etc.]
  recurrence_day_of_month integer, -- For monthly: 1-31, or 0 for last day
  supporting_docs jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraints for recurrence fields
ALTER TABLE recurring_tasks
  ADD CONSTRAINT check_weekly_days
  CHECK (
    recurrence_type != 'weekly' OR
    (recurrence_days IS NOT NULL AND array_length(recurrence_days, 1) > 0)
  );

ALTER TABLE recurring_tasks
  ADD CONSTRAINT check_monthly_day
  CHECK (
    recurrence_type != 'monthly' OR
    (recurrence_day_of_month IS NOT NULL AND recurrence_day_of_month >= 0 AND recurrence_day_of_month <= 31)
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_contact ON recurring_tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_assigned_to ON recurring_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_is_active ON recurring_tasks(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_recurrence_type ON recurring_tasks(recurrence_type);

-- Enable RLS
ALTER TABLE recurring_tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow anonymous read access to recurring_tasks"
  ON recurring_tasks FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to recurring_tasks"
  ON recurring_tasks FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to recurring_tasks"
  ON recurring_tasks FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to recurring_tasks"
  ON recurring_tasks FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated read access to recurring_tasks"
  ON recurring_tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert access to recurring_tasks"
  ON recurring_tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update access to recurring_tasks"
  ON recurring_tasks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete access to recurring_tasks"
  ON recurring_tasks FOR DELETE
  TO authenticated
  USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_recurring_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_recurring_tasks_updated_at
  BEFORE UPDATE ON recurring_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_tasks_updated_at();
