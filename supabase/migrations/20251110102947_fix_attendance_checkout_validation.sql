/*
  # Fix Attendance Check-in Validation

  1. Changes
    - Update validation to check if last entry has NOT checked out
    - Instead of checking status = 'Present', check if check_out_time IS NULL
    
  2. Business Rule
    - Users must check out (have check_out_time) before creating a new check-in entry
    - This prevents users from having multiple open check-in sessions
*/

-- Update Validation Function: Prevent check-in if last entry has no check-out
CREATE OR REPLACE FUNCTION validate_no_duplicate_checkin()
RETURNS TRIGGER AS $$
DECLARE
  v_last_checkout_time timestamptz;
  v_last_date date;
BEGIN
  -- Only validate on INSERT (new check-in)
  IF TG_OP = 'INSERT' THEN
    -- Get the most recent attendance record for this user
    SELECT check_out_time, date INTO v_last_checkout_time, v_last_date
    FROM attendance
    WHERE admin_user_id = NEW.admin_user_id
    ORDER BY date DESC, check_in_time DESC
    LIMIT 1;
    
    -- If last entry has no check-out time, prevent new check-in
    IF v_last_checkout_time IS NULL AND v_last_date IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot check in. Your last attendance entry (%) has not been checked out yet. Please check out first before creating a new check-in.', 
        v_last_date;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update comment for documentation
COMMENT ON FUNCTION validate_no_duplicate_checkin() IS 'Prevents users from checking in if their last attendance entry has not been checked out yet';
