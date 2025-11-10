/*
  # Auto-recalculate Next Recurrence on Update

  1. Changes
    - Create trigger function to recalculate next_recurrence when schedule fields change
    - Trigger fires on UPDATE of recurring_tasks
    - Automatically updates next_recurrence when:
      - recurrence_type changes
      - start_time changes
      - start_days changes (for weekly)
      - start_day_of_month changes (for monthly)
    
  2. Purpose
    - Ensure next_recurrence stays in sync with schedule changes
    - Eliminate manual calculation in frontend
    - Maintain data consistency
*/

-- Function to calculate next recurrence
CREATE OR REPLACE FUNCTION recalculate_next_recurrence()
RETURNS TRIGGER AS $$
DECLARE
  v_now timestamptz;
  v_kolkata_time timestamp;
  v_next_recurrence timestamp;
  v_start_hour integer;
  v_start_minute integer;
  v_current_day_of_week text;
  v_days_of_week text[] := ARRAY['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  v_current_day_index integer;
  v_start_day_index integer;
  v_days_to_add integer := 7;
  v_diff integer;
  v_start_day integer;
BEGIN
  -- Only recalculate if schedule-related fields changed
  IF (TG_OP = 'INSERT') OR 
     (NEW.recurrence_type IS DISTINCT FROM OLD.recurrence_type) OR
     (NEW.start_time IS DISTINCT FROM OLD.start_time) OR
     (NEW.start_days IS DISTINCT FROM OLD.start_days) OR
     (NEW.start_day_of_month IS DISTINCT FROM OLD.start_day_of_month) THEN
    
    -- Get current time in Asia/Kolkata timezone
    v_now := now();
    v_kolkata_time := v_now AT TIME ZONE 'Asia/Kolkata';
    v_next_recurrence := v_kolkata_time;
    
    -- Extract hour and minute from start_time
    v_start_hour := EXTRACT(HOUR FROM NEW.start_time);
    v_start_minute := EXTRACT(MINUTE FROM NEW.start_time);
    
    IF NEW.recurrence_type = 'daily' THEN
      -- For daily tasks, set to today at start time or tomorrow if passed
      v_next_recurrence := date_trunc('day', v_kolkata_time) + 
                          (v_start_hour || ' hours')::interval + 
                          (v_start_minute || ' minutes')::interval;
      IF v_next_recurrence <= v_kolkata_time THEN
        v_next_recurrence := v_next_recurrence + interval '1 day';
      END IF;
      
    ELSIF NEW.recurrence_type = 'weekly' THEN
      -- Get current day of week
      v_current_day_of_week := lower(to_char(v_kolkata_time, 'Dy'));
      v_current_day_index := array_position(v_days_of_week, v_current_day_of_week) - 1;
      
      -- Find the next occurrence day
      IF NEW.start_days IS NOT NULL AND array_length(NEW.start_days, 1) > 0 THEN
        FOREACH v_current_day_of_week IN ARRAY NEW.start_days LOOP
          v_start_day_index := array_position(v_days_of_week, v_current_day_of_week) - 1;
          v_diff := v_start_day_index - v_current_day_index;
          IF v_diff < 0 THEN
            v_diff := v_diff + 7;
          END IF;
          IF v_diff = 0 THEN
            v_next_recurrence := date_trunc('day', v_kolkata_time) + 
                                (v_start_hour || ' hours')::interval + 
                                (v_start_minute || ' minutes')::interval;
            IF v_next_recurrence <= v_kolkata_time THEN
              v_diff := 7;
            END IF;
          END IF;
          IF v_diff < v_days_to_add THEN
            v_days_to_add := v_diff;
          END IF;
        END LOOP;
      END IF;
      
      v_next_recurrence := date_trunc('day', v_kolkata_time) + 
                          (v_days_to_add || ' days')::interval + 
                          (v_start_hour || ' hours')::interval + 
                          (v_start_minute || ' minutes')::interval;
      
    ELSIF NEW.recurrence_type = 'monthly' THEN
      v_start_day := NEW.start_day_of_month;
      
      -- Handle "last day of month" (0 means last day)
      IF v_start_day = 0 THEN
        v_start_day := EXTRACT(DAY FROM (date_trunc('month', v_kolkata_time) + interval '1 month' - interval '1 day'));
      END IF;
      
      -- Set to start day of current month at start time
      v_next_recurrence := date_trunc('month', v_kolkata_time) + 
                          ((LEAST(v_start_day, EXTRACT(DAY FROM (date_trunc('month', v_kolkata_time) + interval '1 month' - interval '1 day'))::integer) - 1) || ' days')::interval + 
                          (v_start_hour || ' hours')::interval + 
                          (v_start_minute || ' minutes')::interval;
      
      -- If already passed, move to next month
      IF v_next_recurrence <= v_kolkata_time THEN
        v_next_recurrence := date_trunc('month', v_kolkata_time) + interval '1 month';
        IF NEW.start_day_of_month = 0 THEN
          v_start_day := EXTRACT(DAY FROM (v_next_recurrence + interval '1 month' - interval '1 day'));
        ELSE
          v_start_day := NEW.start_day_of_month;
        END IF;
        v_next_recurrence := v_next_recurrence + 
                            ((LEAST(v_start_day, EXTRACT(DAY FROM (v_next_recurrence + interval '1 month' - interval '1 day'))::integer) - 1) || ' days')::interval + 
                            (v_start_hour || ' hours')::interval + 
                            (v_start_minute || ' minutes')::interval;
      END IF;
    END IF;
    
    -- Convert to UTC and update
    NEW.next_recurrence := v_next_recurrence AT TIME ZONE 'Asia/Kolkata' AT TIME ZONE 'UTC';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT and UPDATE
DROP TRIGGER IF EXISTS recalculate_next_recurrence_on_change ON recurring_tasks;
CREATE TRIGGER recalculate_next_recurrence_on_change
  BEFORE INSERT OR UPDATE ON recurring_tasks
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_next_recurrence();

-- Add comment
COMMENT ON FUNCTION recalculate_next_recurrence() IS 'Automatically recalculates next_recurrence when schedule fields change';
