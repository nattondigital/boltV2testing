/*
  # Create Followup Assignments Table

  1. New Tables
    - `followup_assignments`
      - `id` (uuid, primary key) - Unique identifier
      - `trigger_event` (text) - Trigger event name (e.g., LEAD_CREATED, TASK_COMPLETED)
      - `module` (text) - Module name (e.g., Leads, Tasks, Contacts)
      - `whatsapp_template_id` (uuid) - Reference to whatsapp_templates table
      - `actions` (text) - Actions to take (e.g., Send Message, Create Task, Update Status)
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Update timestamp

  2. Security
    - Enable RLS on table
    - Add policies for anonymous access (read/write)

  3. Indexes
    - Index on trigger_event for fast lookups
    - Index on module for filtering
    - Index on whatsapp_template_id for joins
    - Unique constraint on trigger_event to prevent duplicates

  4. Initial Data
    - Add default assignments for common sales triggers
*/

CREATE TABLE IF NOT EXISTS followup_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_event text UNIQUE NOT NULL,
  module text NOT NULL,
  whatsapp_template_id uuid REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  actions text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE followup_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to followup_assignments"
  ON followup_assignments
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to followup_assignments"
  ON followup_assignments
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to followup_assignments"
  ON followup_assignments
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to followup_assignments"
  ON followup_assignments
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated read access to followup_assignments"
  ON followup_assignments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert access to followup_assignments"
  ON followup_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update access to followup_assignments"
  ON followup_assignments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete access to followup_assignments"
  ON followup_assignments
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_followup_assignments_trigger_event ON followup_assignments(trigger_event);
CREATE INDEX IF NOT EXISTS idx_followup_assignments_module ON followup_assignments(module);
CREATE INDEX IF NOT EXISTS idx_followup_assignments_template_id ON followup_assignments(whatsapp_template_id);

CREATE OR REPLACE FUNCTION update_followup_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_followup_assignments_updated_at
  BEFORE UPDATE ON followup_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_followup_assignments_updated_at();

-- Insert default followup assignments for common sales triggers
INSERT INTO followup_assignments (trigger_event, module, whatsapp_template_id, actions)
VALUES
  ('LEAD_CREATED', 'Leads', NULL, 'Send Welcome Message'),
  ('LEAD_UPDATED', 'Leads', NULL, 'Send Update Notification'),
  ('TASK_COMPLETED', 'Tasks', NULL, 'Send Completion Message'),
  ('APPOINTMENT_SCHEDULED', 'Appointments', NULL, 'Send Confirmation Message'),
  ('APPOINTMENT_CANCELLED', 'Appointments', NULL, 'Send Cancellation Message')
ON CONFLICT (trigger_event) DO NOTHING;

COMMENT ON TABLE followup_assignments IS 'Maps trigger events to WhatsApp templates and actions for automated followups';
COMMENT ON COLUMN followup_assignments.trigger_event IS 'The trigger event name from workflow_triggers or database triggers';
COMMENT ON COLUMN followup_assignments.module IS 'The module this trigger belongs to (for grouping in UI)';
COMMENT ON COLUMN followup_assignments.whatsapp_template_id IS 'The WhatsApp template to use for this followup';
COMMENT ON COLUMN followup_assignments.actions IS 'The actions to perform when this event is triggered';
