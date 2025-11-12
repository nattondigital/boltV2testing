/*
  # Fix checkout validation to use Indian timezone

  1. Problem
    - validate_checkout_same_date was comparing dates in UTC timezone
    - When checking out on 2025-11-13 in India, UTC date is still 2025-11-12
    - This caused validation error preventing checkout
    
  2. Solution
    - Convert check_out_time to Asia/Kolkata timezone before extracting date
    - Compare dates in the same timezone as business operates
    
  3. Changes
    - Update validate_checkout_same_date function to use Indian timezone
*/

CREATE OR REPLACE FUNCTION validate_checkout_same_date()
RETURNS TRIGGER AS $$
BEGIN
-- Only validate when check_out_time is being set
IF NEW.check_out_time IS NOT NULL THEN
-- Extract date from check_out_time in Indian timezone and compare with attendance.date
IF DATE(NEW.check_out_time AT TIME ZONE 'Asia/Kolkata') != NEW.date THEN
RAISE EXCEPTION 'Check-out must be done on the same date as check-in. Check-in date: %, Check-out date: %', 
NEW.date, 
DATE(NEW.check_out_time AT TIME ZONE 'Asia/Kolkata');
END IF;
END IF;

RETURN NEW;
END;
$$ LANGUAGE plpgsql;
