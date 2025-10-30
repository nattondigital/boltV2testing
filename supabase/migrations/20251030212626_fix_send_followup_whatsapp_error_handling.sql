/*
  # Fix WhatsApp Followup Function Error Handling

  1. Changes
    - Improve error handling in send_followup_whatsapp function
    - Make it completely fail-safe so it never blocks the main transaction
    - Add better logging for debugging
    
  2. Notes
    - All errors are caught and logged as warnings
    - Function always returns successfully
    - Main operations (like creating expenses) are never blocked
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
  v_function_url text;
  v_request_id bigint;
BEGIN
  -- Skip if phone is empty or null
  IF p_contact_phone IS NULL OR p_contact_phone = '' THEN
    RETURN;
  END IF;

  -- Build the edge function URL - use a simple hardcoded approach
  BEGIN
    -- Make async HTTP request using pg_net
    -- This is fire-and-forget, we don't wait for response
    SELECT net.http_post(
      url := format('%s/functions/v1/send-whatsapp-message', 
        current_setting('request.headers', true)::json->>'origin'
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'trigger_event', p_trigger_event,
        'contact_phone', p_contact_phone,
        'contact_name', p_contact_name,
        'trigger_data', p_trigger_data
      )
    ) INTO v_request_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Just log and continue - never block the main operation
    RAISE WARNING 'WhatsApp followup skipped for % (phone: %): %', 
      p_trigger_event, p_contact_phone, SQLERRM;
  END;
  
  -- Always return successfully
  RETURN;
END;
$$;

COMMENT ON FUNCTION send_followup_whatsapp IS 'Sends WhatsApp message via DoubleTick API - fully fail-safe, never blocks operations';
