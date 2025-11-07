/*
  # Create Working Hours Settings Table

  1. New Tables
    - `working_hours_settings`
      - `id` (uuid, primary key)
      - `day` (text) - Day of week: monday, tuesday, wednesday, thursday, friday, saturday, sunday
      - `is_working_day` (boolean) - Whether this is a working day
      - `start_time` (time) - Office start time
      - `end_time` (time) - Office end time
      - `total_working_hours` (numeric) - Auto-calculated from start and end time
      - `full_day_hours` (numeric) - Hours required for full day
      - `half_day_hours` (numeric) - Hours required for half day
      - `overtime_hours` (numeric) - Hours considered as overtime
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `working_hours_settings` table
    - Add policies for authenticated users to manage working hours

  3. Default Data
    - Insert default working hours for all days
*/

-- Create working_hours_settings table
CREATE TABLE IF NOT EXISTS working_hours_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day text NOT NULL UNIQUE CHECK (day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  is_working_day boolean DEFAULT true,
  start_time time DEFAULT '09:00:00',
  end_time time DEFAULT '18:00:00',
  total_working_hours numeric DEFAULT 9.0,
  full_day_hours numeric DEFAULT 9.0,
  half_day_hours numeric DEFAULT 4.5,
  overtime_hours numeric DEFAULT 2.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE working_hours_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view working hours settings"
  ON working_hours_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert working hours settings"
  ON working_hours_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update working hours settings"
  ON working_hours_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete working hours settings"
  ON working_hours_settings
  FOR DELETE
  TO authenticated
  USING (true);

-- Insert default working hours for all days (Monday to Friday working days, Saturday and Sunday off)
INSERT INTO working_hours_settings (day, is_working_day, start_time, end_time, total_working_hours, full_day_hours, half_day_hours, overtime_hours)
VALUES
  ('monday', true, '09:00:00', '18:00:00', 9.0, 9.0, 4.5, 2.0),
  ('tuesday', true, '09:00:00', '18:00:00', 9.0, 9.0, 4.5, 2.0),
  ('wednesday', true, '09:00:00', '18:00:00', 9.0, 9.0, 4.5, 2.0),
  ('thursday', true, '09:00:00', '18:00:00', 9.0, 9.0, 4.5, 2.0),
  ('friday', true, '09:00:00', '18:00:00', 9.0, 9.0, 4.5, 2.0),
  ('saturday', false, '09:00:00', '18:00:00', 0.0, 9.0, 4.5, 2.0),
  ('sunday', false, '09:00:00', '18:00:00', 0.0, 9.0, 4.5, 2.0)
ON CONFLICT (day) DO NOTHING;

-- Create function to auto-calculate total working hours
CREATE OR REPLACE FUNCTION calculate_working_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate if it's a working day
  IF NEW.is_working_day THEN
    -- Calculate hours difference between start and end time
    NEW.total_working_hours := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600;
  ELSE
    NEW.total_working_hours := 0;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate working hours on insert/update
DROP TRIGGER IF EXISTS trigger_calculate_working_hours ON working_hours_settings;
CREATE TRIGGER trigger_calculate_working_hours
  BEFORE INSERT OR UPDATE ON working_hours_settings
  FOR EACH ROW
  EXECUTE FUNCTION calculate_working_hours();
