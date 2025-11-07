/*
  # Update Attendance Status with Payroll Policy Logic

  1. Changes
    - Update status field to support new values: Present, Absent, Full Day, Half Day, Overtime
    - Add `actual_working_hours` (numeric) - Calculated from check_in_time and check_out_time
    - Change default status to 'Absent'
    - Add trigger to auto-calculate status based on payroll policy and user working hours

  2. Status Logic
    - **Absent**: Default when no check-in (check_in_time is null)
    - **Present**: When check-in is done but no check-out yet
    - **Full Day**: When actual working hours >= full_day_hours (from user or default settings)
    - **Half Day**: When actual working hours < half_day_hours
    - **Overtime**: When actual working hours >= overtime_hours

  3. Working Hours Priority
    - First check user_working_hours_settings for user-specific hours
    - Fall back to working_hours_settings (global defaults) if no user-specific settings exist
*/

-- Add actual_working_hours column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'actual_working_hours'
  ) THEN
    ALTER TABLE attendance ADD COLUMN actual_working_hours numeric DEFAULT 0;
  END IF;
END $$;

-- Update status field default to 'Absent'
ALTER TABLE attendance ALTER COLUMN status SET DEFAULT 'Absent';

-- Create function to calculate attendance status based on payroll policy
CREATE OR REPLACE FUNCTION calculate_attendance_status()
RETURNS TRIGGER AS $$
DECLARE
  v_day_of_week text;
  v_full_day_hours numeric;
  v_half_day_hours numeric;
  v_overtime_hours numeric;
  v_actual_hours numeric := 0;
BEGIN
  -- If no check-in, status is Absent
  IF NEW.check_in_time IS NULL THEN
    NEW.status := 'Absent';
    NEW.actual_working_hours := 0;
    RETURN NEW;
  END IF;

  -- If check-in exists but no check-out, status is Present
  IF NEW.check_out_time IS NULL THEN
    NEW.status := 'Present';
    NEW.actual_working_hours := 0;
    RETURN NEW;
  END IF;

  -- Calculate actual working hours from check-in and check-out
  v_actual_hours := EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 3600;
  NEW.actual_working_hours := v_actual_hours;

  -- Get day of week from date
  v_day_of_week := LOWER(TO_CHAR(NEW.date, 'Day'));
  v_day_of_week := TRIM(v_day_of_week);

  -- Try to get user-specific working hours first
  SELECT 
    full_day_hours,
    half_day_hours,
    overtime_hours
  INTO 
    v_full_day_hours,
    v_half_day_hours,
    v_overtime_hours
  FROM user_working_hours_settings
  WHERE user_id = NEW.admin_user_id
    AND day = v_day_of_week
  LIMIT 1;

  -- If no user-specific settings, fall back to default working hours
  IF v_full_day_hours IS NULL THEN
    SELECT 
      full_day_hours,
      half_day_hours,
      overtime_hours
    INTO 
      v_full_day_hours,
      v_half_day_hours,
      v_overtime_hours
    FROM working_hours_settings
    WHERE day = v_day_of_week
    LIMIT 1;
  END IF;

  -- If still no settings found, use default values
  IF v_full_day_hours IS NULL THEN
    v_full_day_hours := 9.0;
    v_half_day_hours := 4.5;
    v_overtime_hours := 10.0;
  END IF;

  -- Apply payroll policy rules
  -- Rule 3: Overtime - if actual hours >= overtime hours
  IF v_actual_hours >= v_overtime_hours THEN
    NEW.status := 'Overtime';
  -- Rule 1: Full Day - if actual hours >= full day hours
  ELSIF v_actual_hours >= v_full_day_hours THEN
    NEW.status := 'Full Day';
  -- Rule 2: Half Day - if actual hours < half day hours
  ELSIF v_actual_hours < v_half_day_hours THEN
    NEW.status := 'Half Day';
  -- Between half day and full day hours
  ELSE
    NEW.status := 'Present';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_calculate_attendance_status ON attendance;

-- Create trigger to calculate status on insert/update
CREATE TRIGGER trigger_calculate_attendance_status
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION calculate_attendance_status();

-- Update existing records to recalculate status
UPDATE attendance SET updated_at = now();

-- Update comment on status column
COMMENT ON COLUMN attendance.status IS 'Attendance status: Absent (no check-in), Present (checked in), Full Day (hours >= full_day_hours), Half Day (hours < half_day_hours), Overtime (hours >= overtime_hours)';
COMMENT ON COLUMN attendance.actual_working_hours IS 'Actual working hours calculated from check-in and check-out times';
