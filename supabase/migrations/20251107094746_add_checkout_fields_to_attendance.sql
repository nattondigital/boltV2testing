/*
  # Add Checkout Fields to Attendance Table

  1. Changes
    - Add `check_out_selfie_url` (text) - URL to checkout selfie image
    - Add `check_out_location` (jsonb) - GPS coordinates for checkout {lat, lng, address}

  2. Notes
    - These fields will store checkout selfie and location similar to check-in fields
    - Fields are nullable as they will be filled when user checks out
*/

-- Add checkout selfie and location fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'check_out_selfie_url'
  ) THEN
    ALTER TABLE attendance ADD COLUMN check_out_selfie_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'check_out_location'
  ) THEN
    ALTER TABLE attendance ADD COLUMN check_out_location jsonb;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN attendance.check_out_selfie_url IS 'URL to selfie image captured during checkout';
COMMENT ON COLUMN attendance.check_out_location IS 'GPS coordinates and address for checkout in JSON format: {lat, lng, address}';
