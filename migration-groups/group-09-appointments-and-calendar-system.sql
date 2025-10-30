/*
================================================================================
GROUP 9: APPOINTMENTS AND CALENDAR SYSTEM
================================================================================

Appointments, calendars, and their workflow triggers

Total Files: 7
Dependencies: Group 8

Files Included (in execution order):
1. 20251021115413_create_appointments_table.sql
2. 20251021123302_create_calendars_table.sql
3. 20251021134115_add_calendar_id_to_appointments.sql
4. 20251021140613_add_max_bookings_per_slot_to_calendars.sql
5. 20251022092642_create_appointment_triggers.sql
6. 20251022093500_add_appointment_workflow_triggers.sql
7. 20251022100748_add_created_by_to_appointments.sql

================================================================================
*/

-- ============================================================================
-- MIGRATION 1: 20251021115413_create_appointments_table.sql
-- ============================================================================
/*
  # Create Appointments Table for Sales Management

  1. New Tables
    - `appointments`
      - `id` (uuid, primary key)
      - `appointment_id` (text, unique, auto-generated)
      - `title` (text, required)
      - `contact_id` (uuid, foreign key to contacts_master)
      - `contact_name` (text, required)
      - `contact_phone` (text, required)
      - `contact_email` (text, optional)
      - `appointment_date` (date, required)
      - `appointment_time` (time, required)
      - `duration_minutes` (integer, default 30)
      - `location` (text, optional)
      - `meeting_type` (text, required) - In-Person, Video Call, Phone Call
      - `status` (text, required) - Scheduled, Confirmed, Completed, Cancelled, No-Show
      - `purpose` (text, required) - Sales Meeting, Product Demo, Follow-up, Consultation, Other
      - `notes` (text, optional)
      - `reminder_sent` (boolean, default false)
      - `assigned_to` (uuid, foreign key to admin_users, optional)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `appointments` table
    - Add policy for anonymous users to read/write appointments (for public booking)
    - Add policy for authenticated admin users to manage all appointments

  3. Indexes
    - Index on appointment_date for efficient date-based queries
    - Index on status for filtering
    - Index on contact_id for relationship queries
*/

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id text UNIQUE NOT NULL DEFAULT 'APT-' || LPAD(FLOOR(RANDOM() * 999999999)::text, 9, '0'),
  title text NOT NULL,
  contact_id uuid REFERENCES contacts_master(id) ON DELETE SET NULL,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text,
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  duration_minutes integer DEFAULT 30,
  location text,
  meeting_type text NOT NULL CHECK (meeting_type IN ('In-Person', 'Video Call', 'Phone Call')),
  status text NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No-Show')),
  purpose text NOT NULL CHECK (purpose IN ('Sales Meeting', 'Product Demo', 'Follow-up', 'Consultation', 'Other')),
  notes text,
  reminder_sent boolean DEFAULT false,
  assigned_to uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_contact_id ON appointments(contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_to ON appointments(assigned_to);

-- Enable RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policy for anonymous users to create and read appointments (for public booking)
CREATE POLICY "Anyone can create appointments"
  ON appointments
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read appointments"
  ON appointments
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can update appointments"
  ON appointments
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete appointments"
  ON appointments
  FOR DELETE
  TO anon
  USING (true);

-- Policy for authenticated admin users to manage all appointments
CREATE POLICY "Authenticated users can read all appointments"
  ON appointments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create appointments"
  ON appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update all appointments"
  ON appointments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete appointments"
  ON appointments
  FOR DELETE
  TO authenticated
  USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_appointments_updated_at();

-- ============================================================================
-- MIGRATION 2: 20251021123302_create_calendars_table.sql
-- ============================================================================
/*
  # Create Calendars Table for Calendar Management

  1. New Tables
    - `calendars`
      - `id` (uuid, primary key)
      - `calendar_id` (text, unique, auto-generated)
      - `title` (text, required)
      - `description` (text, optional)
      - `thumbnail` (text, optional) - URL to thumbnail image
      - `availability` (jsonb, required) - JSON object with day/time availability
      - `assigned_user_id` (uuid, foreign key to admin_users, optional)
      - `slot_duration` (integer, required, default 30) - Duration in minutes
      - `meeting_type` (text[], required) - Array of meeting types allowed
      - `default_location` (text, optional)
      - `buffer_time` (integer, default 0) - Buffer time between meetings in minutes
      - `max_bookings_per_day` (integer, optional)
      - `booking_window_days` (integer, default 30) - How many days in advance can book
      - `color` (text, default '#3B82F6') - Calendar color for UI
      - `is_active` (boolean, default true)
      - `timezone` (text, default 'UTC')
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `calendars` table
    - Add policy for anonymous users to read active calendars
    - Add policy for authenticated admin users to manage all calendars

  3. Indexes
    - Index on is_active for filtering
    - Index on assigned_user_id for user-specific queries

  4. Notes
    - Availability JSON structure example:
      {
        "monday": { "enabled": true, "slots": [{"start": "09:00", "end": "17:00"}] },
        "tuesday": { "enabled": true, "slots": [{"start": "09:00", "end": "17:00"}] },
        ...
      }
    - meeting_type array can include: ["In-Person", "Video Call", "Phone Call"]
*/

-- Create calendars table
CREATE TABLE IF NOT EXISTS calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id text UNIQUE NOT NULL DEFAULT 'CAL-' || LPAD(FLOOR(RANDOM() * 999999999)::text, 9, '0'),
  title text NOT NULL,
  description text,
  thumbnail text,
  availability jsonb NOT NULL DEFAULT '{
    "monday": {"enabled": true, "slots": [{"start": "09:00", "end": "17:00"}]},
    "tuesday": {"enabled": true, "slots": [{"start": "09:00", "end": "17:00"}]},
    "wednesday": {"enabled": true, "slots": [{"start": "09:00", "end": "17:00"}]},
    "thursday": {"enabled": true, "slots": [{"start": "09:00", "end": "17:00"}]},
    "friday": {"enabled": true, "slots": [{"start": "09:00", "end": "17:00"}]},
    "saturday": {"enabled": false, "slots": []},
    "sunday": {"enabled": false, "slots": []}
  }'::jsonb,
  assigned_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  slot_duration integer NOT NULL DEFAULT 30 CHECK (slot_duration > 0),
  meeting_type text[] NOT NULL DEFAULT ARRAY['In-Person', 'Video Call', 'Phone Call'],
  default_location text,
  buffer_time integer DEFAULT 0 CHECK (buffer_time >= 0),
  max_bookings_per_day integer CHECK (max_bookings_per_day > 0),
  booking_window_days integer DEFAULT 30 CHECK (booking_window_days > 0),
  color text DEFAULT '#3B82F6',
  is_active boolean DEFAULT true,
  timezone text DEFAULT 'UTC',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_calendars_is_active ON calendars(is_active);
CREATE INDEX IF NOT EXISTS idx_calendars_assigned_user_id ON calendars(assigned_user_id);

-- Enable RLS
ALTER TABLE calendars ENABLE ROW LEVEL SECURITY;

-- Policy for anonymous users to read active calendars
CREATE POLICY "Anyone can read active calendars"
  ON calendars
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Policy for anonymous users to create calendars (for public booking pages)
CREATE POLICY "Anyone can create calendars"
  ON calendars
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy for anonymous users to update calendars
CREATE POLICY "Anyone can update calendars"
  ON calendars
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Policy for anonymous users to delete calendars
CREATE POLICY "Anyone can delete calendars"
  ON calendars
  FOR DELETE
  TO anon
  USING (true);

-- Policy for authenticated admin users to read all calendars
CREATE POLICY "Authenticated users can read all calendars"
  ON calendars
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for authenticated admin users to create calendars
CREATE POLICY "Authenticated users can create calendars"
  ON calendars
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy for authenticated admin users to update calendars
CREATE POLICY "Authenticated users can update all calendars"
  ON calendars
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy for authenticated admin users to delete calendars
CREATE POLICY "Authenticated users can delete calendars"
  ON calendars
  FOR DELETE
  TO authenticated
  USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_calendars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calendars_updated_at
  BEFORE UPDATE ON calendars
  FOR EACH ROW
  EXECUTE FUNCTION update_calendars_updated_at();

-- ============================================================================
-- MIGRATION 3: 20251021134115_add_calendar_id_to_appointments.sql
-- ============================================================================
/*
  # Add Calendar Integration to Appointments

  1. Changes
    - Add calendar_id foreign key to appointments table
    - Add index on calendar_id for efficient queries

  2. Notes
    - calendar_id is optional to maintain backward compatibility
    - When a calendar is selected, appointment settings will auto-populate from calendar
*/

-- Add calendar_id column to appointments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'calendar_id'
  ) THEN
    ALTER TABLE appointments ADD COLUMN calendar_id uuid REFERENCES calendars(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index on calendar_id for efficient queries
CREATE INDEX IF NOT EXISTS idx_appointments_calendar_id ON appointments(calendar_id);

-- ============================================================================
-- MIGRATION 4: 20251021140613_add_max_bookings_per_slot_to_calendars.sql
-- ============================================================================
/*
  # Add Max Bookings Per Slot to Calendars

  1. Changes
    - Add max_bookings_per_slot column to calendars table
    - Default value is 1 (one booking per slot)
    - Must be a positive integer

  2. Notes
    - This field controls how many appointments can be booked in the same time slot
    - Value of 1 = exclusive slots (default behavior)
    - Values > 1 = allow multiple bookings per slot (e.g., for group sessions)
*/

-- Add max_bookings_per_slot column to calendars table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendars' AND column_name = 'max_bookings_per_slot'
  ) THEN
    ALTER TABLE calendars ADD COLUMN max_bookings_per_slot integer NOT NULL DEFAULT 1 CHECK (max_bookings_per_slot > 0);
  END IF;
END $$;

-- ============================================================================
-- MIGRATION 5: 20251022092642_create_appointment_triggers.sql
-- ============================================================================
/*
  # Create Appointment Triggers for Webhooks

  1. Overview
    - Creates database triggers for appointments table
    - Sends webhook notifications for create, update, and delete operations
    - Follows existing pattern used for leads, affiliates, and other tables

  2. Triggers Created
    - `trigger_appointment_created` - Fires when a new appointment is added
    - `trigger_appointment_updated` - Fires when an appointment is modified
    - `trigger_appointment_deleted` - Fires when an appointment is removed

  3. Webhook Integration
    - All triggers send data to `api_webhooks` table
    - Includes full appointment record in payload
    - Includes trigger event type for filtering

  4. Use Cases
    - Notify external systems when appointments are created
    - Sync appointment updates to third-party calendars
    - Track appointment lifecycle for reporting
    - Trigger automated reminders and notifications
*/

-- Function to handle appointment created event
CREATE OR REPLACE FUNCTION notify_appointment_created()
RETURNS TRIGGER AS $$
DECLARE
  webhook_record RECORD;
  payload jsonb;
BEGIN
  -- Build the payload with appointment data
  payload := jsonb_build_object(
    'trigger_event', 'APPOINTMENT_CREATED',
    'appointment_id', NEW.appointment_id,
    'id', NEW.id,
    'calendar_id', NEW.calendar_id,
    'contact_id', NEW.contact_id,
    'contact_name', NEW.contact_name,
    'contact_email', NEW.contact_email,
    'contact_phone', NEW.contact_phone,
    'title', NEW.title,
    'appointment_date', NEW.appointment_date,
    'appointment_time', NEW.appointment_time,
    'duration_minutes', NEW.duration_minutes,
    'status', NEW.status,
    'location', NEW.location,
    'meeting_type', NEW.meeting_type,
    'purpose', NEW.purpose,
    'notes', NEW.notes,
    'reminder_sent', NEW.reminder_sent,
    'assigned_to', NEW.assigned_to,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  -- Loop through all active webhooks for this trigger event
  FOR webhook_record IN
    SELECT id, webhook_url
    FROM api_webhooks
    WHERE trigger_event = 'APPOINTMENT_CREATED'
    AND is_active = true
  LOOP
    -- Send HTTP POST request to webhook URL using pg_net extension
    PERFORM net.http_post(
      url := webhook_record.webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload
    );

    -- Update webhook statistics
    UPDATE api_webhooks
    SET
      last_triggered = NOW(),
      total_calls = COALESCE(total_calls, 0) + 1,
      success_count = COALESCE(success_count, 0) + 1
    WHERE id = webhook_record.id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle appointment updated event
CREATE OR REPLACE FUNCTION notify_appointment_updated()
RETURNS TRIGGER AS $$
DECLARE
  webhook_record RECORD;
  payload jsonb;
BEGIN
  -- Build the payload with appointment data including previous values
  payload := jsonb_build_object(
    'trigger_event', 'APPOINTMENT_UPDATED',
    'appointment_id', NEW.appointment_id,
    'id', NEW.id,
    'calendar_id', NEW.calendar_id,
    'contact_id', NEW.contact_id,
    'contact_name', NEW.contact_name,
    'contact_email', NEW.contact_email,
    'contact_phone', NEW.contact_phone,
    'title', NEW.title,
    'appointment_date', NEW.appointment_date,
    'appointment_time', NEW.appointment_time,
    'duration_minutes', NEW.duration_minutes,
    'status', NEW.status,
    'location', NEW.location,
    'meeting_type', NEW.meeting_type,
    'purpose', NEW.purpose,
    'notes', NEW.notes,
    'reminder_sent', NEW.reminder_sent,
    'assigned_to', NEW.assigned_to,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'previous_status', OLD.status,
    'previous_appointment_date', OLD.appointment_date,
    'previous_appointment_time', OLD.appointment_time
  );

  -- Loop through all active webhooks for this trigger event
  FOR webhook_record IN
    SELECT id, webhook_url
    FROM api_webhooks
    WHERE trigger_event = 'APPOINTMENT_UPDATED'
    AND is_active = true
  LOOP
    -- Send HTTP POST request to webhook URL
    PERFORM net.http_post(
      url := webhook_record.webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload
    );

    -- Update webhook statistics
    UPDATE api_webhooks
    SET
      last_triggered = NOW(),
      total_calls = COALESCE(total_calls, 0) + 1,
      success_count = COALESCE(success_count, 0) + 1
    WHERE id = webhook_record.id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle appointment deleted event
CREATE OR REPLACE FUNCTION notify_appointment_deleted()
RETURNS TRIGGER AS $$
DECLARE
  webhook_record RECORD;
  payload jsonb;
BEGIN
  -- Build the payload with deleted appointment data
  payload := jsonb_build_object(
    'trigger_event', 'APPOINTMENT_DELETED',
    'appointment_id', OLD.appointment_id,
    'id', OLD.id,
    'calendar_id', OLD.calendar_id,
    'contact_id', OLD.contact_id,
    'contact_name', OLD.contact_name,
    'contact_email', OLD.contact_email,
    'contact_phone', OLD.contact_phone,
    'title', OLD.title,
    'appointment_date', OLD.appointment_date,
    'appointment_time', OLD.appointment_time,
    'duration_minutes', OLD.duration_minutes,
    'status', OLD.status,
    'location', OLD.location,
    'meeting_type', OLD.meeting_type,
    'purpose', OLD.purpose,
    'notes', OLD.notes,
    'deleted_at', NOW()
  );

  -- Loop through all active webhooks for this trigger event
  FOR webhook_record IN
    SELECT id, webhook_url
    FROM api_webhooks
    WHERE trigger_event = 'APPOINTMENT_DELETED'
    AND is_active = true
  LOOP
    -- Send HTTP POST request to webhook URL
    PERFORM net.http_post(
      url := webhook_record.webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload
    );

    -- Update webhook statistics
    UPDATE api_webhooks
    SET
      last_triggered = NOW(),
      total_calls = COALESCE(total_calls, 0) + 1,
      success_count = COALESCE(success_count, 0) + 1
    WHERE id = webhook_record.id;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_appointment_created ON appointments;
DROP TRIGGER IF EXISTS trigger_appointment_updated ON appointments;
DROP TRIGGER IF EXISTS trigger_appointment_deleted ON appointments;

-- Create trigger for appointment creation
CREATE TRIGGER trigger_appointment_created
  AFTER INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION notify_appointment_created();

-- Create trigger for appointment update
CREATE TRIGGER trigger_appointment_updated
  AFTER UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION notify_appointment_updated();

-- Create trigger for appointment deletion
CREATE TRIGGER trigger_appointment_deleted
  AFTER DELETE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION notify_appointment_deleted();

-- ============================================================================
-- MIGRATION 6: 20251022093500_add_appointment_workflow_triggers.sql
-- ============================================================================
/*
  # Add Appointment Workflow Triggers

  1. Overview
    - Adds appointment trigger definitions to workflow_triggers table
    - Enables appointment events to appear in workflow automation UI
    - Makes triggers available for use in automations and API webhooks

  2. New Workflow Triggers
    - APPOINTMENT_CREATED - Triggered when a new appointment is created
    - APPOINTMENT_UPDATED - Triggered when an appointment is modified
    - APPOINTMENT_DELETED - Triggered when an appointment is deleted

  3. Event Schemas
    - Each trigger includes detailed event schema with all relevant fields
    - Schemas define what data is available for workflow automations
    - Update event includes both current and previous values

  4. Important Notes
    - These triggers integrate with existing database triggers on appointments table
    - Triggers will show in Settings > API Webhooks section
    - Can be used to create automated workflows and notifications
*/

-- Insert APPOINTMENT_CREATED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'appointment_created',
  'Appointment Created',
  'Triggered when a new appointment is created',
  'APPOINTMENT_CREATED',
  '[
    {"field": "appointment_id", "type": "uuid", "description": "Unique appointment identifier"},
    {"field": "calendar_id", "type": "uuid", "description": "Calendar the appointment belongs to"},
    {"field": "contact_id", "type": "uuid", "description": "Contact ID (if linked to contacts)"},
    {"field": "contact_name", "type": "text", "description": "Name of the person booking"},
    {"field": "contact_email", "type": "text", "description": "Email of the person booking"},
    {"field": "contact_phone", "type": "text", "description": "Phone of the person booking"},
    {"field": "title", "type": "text", "description": "Appointment title"},
    {"field": "description", "type": "text", "description": "Appointment description"},
    {"field": "start_time", "type": "timestamptz", "description": "Appointment start date and time"},
    {"field": "end_time", "type": "timestamptz", "description": "Appointment end date and time"},
    {"field": "duration_minutes", "type": "integer", "description": "Duration in minutes"},
    {"field": "status", "type": "text", "description": "Status: Scheduled, Confirmed, Cancelled, Completed, No Show"},
    {"field": "location", "type": "text", "description": "Physical location or address"},
    {"field": "meeting_link", "type": "text", "description": "Virtual meeting link (Zoom, Meet, etc.)"},
    {"field": "notes", "type": "text", "description": "Additional notes"},
    {"field": "reminder_sent", "type": "boolean", "description": "Whether reminder was sent"},
    {"field": "created_at", "type": "timestamptz", "description": "When appointment was created"},
    {"field": "updated_at", "type": "timestamptz", "description": "When appointment was last updated"}
  ]'::jsonb,
  'Appointments',
  'calendar'
) ON CONFLICT (name) DO NOTHING;

-- Insert APPOINTMENT_UPDATED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'appointment_updated',
  'Appointment Updated',
  'Triggered when an appointment is modified',
  'APPOINTMENT_UPDATED',
  '[
    {"field": "appointment_id", "type": "uuid", "description": "Unique appointment identifier"},
    {"field": "calendar_id", "type": "uuid", "description": "Calendar the appointment belongs to"},
    {"field": "contact_id", "type": "uuid", "description": "Contact ID (if linked to contacts)"},
    {"field": "contact_name", "type": "text", "description": "Name of the person booking"},
    {"field": "contact_email", "type": "text", "description": "Email of the person booking"},
    {"field": "contact_phone", "type": "text", "description": "Phone of the person booking"},
    {"field": "title", "type": "text", "description": "Appointment title"},
    {"field": "description", "type": "text", "description": "Appointment description"},
    {"field": "start_time", "type": "timestamptz", "description": "Appointment start date and time"},
    {"field": "end_time", "type": "timestamptz", "description": "Appointment end date and time"},
    {"field": "duration_minutes", "type": "integer", "description": "Duration in minutes"},
    {"field": "status", "type": "text", "description": "Status: Scheduled, Confirmed, Cancelled, Completed, No Show"},
    {"field": "location", "type": "text", "description": "Physical location or address"},
    {"field": "meeting_link", "type": "text", "description": "Virtual meeting link (Zoom, Meet, etc.)"},
    {"field": "notes", "type": "text", "description": "Additional notes"},
    {"field": "reminder_sent", "type": "boolean", "description": "Whether reminder was sent"},
    {"field": "previous_status", "type": "text", "description": "Previous status before update"},
    {"field": "previous_start_time", "type": "timestamptz", "description": "Previous start time"},
    {"field": "previous_end_time", "type": "timestamptz", "description": "Previous end time"},
    {"field": "created_at", "type": "timestamptz", "description": "When appointment was created"},
    {"field": "updated_at", "type": "timestamptz", "description": "When appointment was last updated"}
  ]'::jsonb,
  'Appointments',
  'calendar'
) ON CONFLICT (name) DO NOTHING;

-- Insert APPOINTMENT_DELETED trigger
INSERT INTO workflow_triggers (
  name,
  display_name,
  description,
  event_name,
  event_schema,
  category,
  icon
) VALUES (
  'appointment_deleted',
  'Appointment Deleted',
  'Triggered when an appointment is deleted',
  'APPOINTMENT_DELETED',
  '[
    {"field": "appointment_id", "type": "uuid", "description": "Unique appointment identifier"},
    {"field": "calendar_id", "type": "uuid", "description": "Calendar the appointment belongs to"},
    {"field": "contact_id", "type": "uuid", "description": "Contact ID (if linked to contacts)"},
    {"field": "contact_name", "type": "text", "description": "Name of the person booking"},
    {"field": "contact_email", "type": "text", "description": "Email of the person booking"},
    {"field": "contact_phone", "type": "text", "description": "Phone of the person booking"},
    {"field": "title", "type": "text", "description": "Appointment title"},
    {"field": "description", "type": "text", "description": "Appointment description"},
    {"field": "start_time", "type": "timestamptz", "description": "Appointment start date and time"},
    {"field": "end_time", "type": "timestamptz", "description": "Appointment end date and time"},
    {"field": "duration_minutes", "type": "integer", "description": "Duration in minutes"},
    {"field": "status", "type": "text", "description": "Status at time of deletion"},
    {"field": "location", "type": "text", "description": "Physical location or address"},
    {"field": "meeting_link", "type": "text", "description": "Virtual meeting link"},
    {"field": "notes", "type": "text", "description": "Additional notes"},
    {"field": "deleted_at", "type": "timestamptz", "description": "When appointment was deleted"}
  ]'::jsonb,
  'Appointments',
  'calendar'
) ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- MIGRATION 7: 20251022100748_add_created_by_to_appointments.sql
-- ============================================================================
/*
  # Add created_by field to appointments table

  1. Changes
    - Add `created_by` column to appointments table (references admin_users)
    - Set default to NULL to allow appointments created without authentication
    
  2. Purpose
    - Track which user created each appointment
    - Enable audit trail for appointment creation
    - Support webhook payloads with creator information
*/

-- Add created_by column to appointments table
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL;

-- Create index for created_by lookups
CREATE INDEX IF NOT EXISTS idx_appointments_created_by ON appointments(created_by);

/*
================================================================================
END OF GROUP 9: APPOINTMENTS AND CALENDAR SYSTEM
================================================================================
Next Group: group-10-tasks-management-system.sql
*/
