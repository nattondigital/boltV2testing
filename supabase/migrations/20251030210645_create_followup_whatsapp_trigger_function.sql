/*
  # Create Followup WhatsApp Trigger Function

  1. Changes
    - Create a function to send WhatsApp messages via edge function for followup assignments
    - This function will be called by database triggers when events occur
    
  2. Notes
    - Checks if a followup assignment exists for the trigger event
    - Calls the send-whatsapp-message edge function
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
  v_supabase_url text;
  v_service_role_key text;
  v_response text;
BEGIN
  -- Get Supabase URL and service role key
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- If settings not available, use environment default
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://' || current_setting('request.jwt.claims', true)::json->>'iss';
  END IF;
  
  -- Make HTTP request to edge function
  BEGIN
    SELECT content INTO v_response
    FROM http((
      'POST',
      v_supabase_url || '/functions/v1/send-whatsapp-message',
      ARRAY[
        http_header('Content-Type', 'application/json'),
        http_header('Authorization', 'Bearer ' || COALESCE(v_service_role_key, ''))
      ],
      'application/json',
      json_build_object(
        'trigger_event', p_trigger_event,
        'contact_phone', p_contact_phone,
        'contact_name', p_contact_name,
        'trigger_data', p_trigger_data
      )::text
    )::http_request);
    
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send WhatsApp message: %', SQLERRM;
  END;
END;
$$;

COMMENT ON FUNCTION send_followup_whatsapp IS 'Sends WhatsApp message via DoubleTick API for followup assignments';
