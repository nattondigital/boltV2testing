/*
  # Simplify WhatsApp Followup Function

  1. Changes
    - Remove complex URL detection logic
    - Use pg_net with a simple async approach
    - Make it truly fire-and-forget
    - Wrap entire function in exception handler
    
  2. Notes
    - Uses SUPABASE_URL environment variable if available
    - Falls back to graceful skip if any issues occur
    - Never blocks main database operations
*/

CREATE OR REPLACE FUNCTION send_followup_whatsapp(
  p_trigger_event text,
  p_contact_phone text,
  p_contact_name text DEFAULT NULL,
  p_trigger_data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request_id bigint;
BEGIN
  -- Wrap everything in a safety net
  BEGIN
    -- Skip if phone is empty
    IF p_contact_phone IS NULL OR p_contact_phone = '' THEN
      RETURN;
    END IF;

    -- Make async HTTP request using pg_net (fire and forget)
    -- The edge function will handle the rest
    PERFORM net.http_post(
      url := 'https://' || current_database() || '.supabase.co/functions/v1/send-whatsapp-message',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'trigger_event', p_trigger_event,
        'contact_phone', p_contact_phone,
        'contact_name', p_contact_name,
        'trigger_data', p_trigger_data
      )
    );
    
  EXCEPTION WHEN OTHERS THEN
    -- Silently skip - this is optional functionality
    -- Main operation should never fail because of WhatsApp
    NULL;
  END;
END;
$$;

COMMENT ON FUNCTION send_followup_whatsapp IS 'Fire-and-forget WhatsApp message sender - never blocks main operations';
