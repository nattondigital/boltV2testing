/*
  # Update Followup WhatsApp Function to Use pg_net

  1. Changes
    - Update send_followup_whatsapp function to use pg_net extension
    - pg_net is already available and provides async HTTP requests
    
  2. Notes
    - Calls the send-whatsapp-message edge function
    - Uses pg_net.http_post for async HTTP requests
    - Handles errors gracefully without blocking the main operation
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
  -- Build the edge function URL
  v_function_url := current_setting('app.settings.supabase_url', true);
  IF v_function_url IS NULL THEN
    -- Try to get from environment or use default pattern
    v_function_url := format('https://%s.supabase.co', current_database());
  END IF;
  v_function_url := v_function_url || '/functions/v1/send-whatsapp-message';
  
  -- Make async HTTP request using pg_net
  BEGIN
    SELECT net.http_post(
      url := v_function_url,
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
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send WhatsApp message: %', SQLERRM;
  END;
END;
$$;

COMMENT ON FUNCTION send_followup_whatsapp IS 'Sends WhatsApp message via DoubleTick API for followup assignments using pg_net';
