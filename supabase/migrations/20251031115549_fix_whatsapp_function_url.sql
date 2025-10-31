/*
  # Fix WhatsApp Followup Function URL

  1. Changes
    - Use correct Supabase URL for edge function calls
    - Replace dynamic hostname detection with hardcoded project URL
    - Fixes "Couldn't resolve host name" error
    
  2. Notes
    - The function was trying to use current_database() which doesn't work
    - Now uses the actual Supabase project URL
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
  v_function_url text;
BEGIN
  -- Wrap everything in a safety net
  BEGIN
    -- Skip if phone is empty
    IF p_contact_phone IS NULL OR p_contact_phone = '' THEN
      RETURN;
    END IF;

    -- Build the edge function URL using the actual Supabase project URL
    v_function_url := 'https://lddridmkphmckbjjlfxi.supabase.co/functions/v1/send-whatsapp-message';

    -- Make async HTTP request using pg_net (fire and forget)
    SELECT net.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('request.jwt.claims', true)::json->>'sub'
      ),
      body := jsonb_build_object(
        'trigger_event', p_trigger_event,
        'contact_phone', p_contact_phone,
        'contact_name', p_contact_name,
        'trigger_data', p_trigger_data
      )
    ) INTO v_request_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Silently skip - this is optional functionality
    -- Main operation should never fail because of WhatsApp
    RAISE WARNING 'WhatsApp followup failed for % (phone: %): %', 
      p_trigger_event, p_contact_phone, SQLERRM;
  END;
END;
$$;

COMMENT ON FUNCTION send_followup_whatsapp IS 'Sends WhatsApp via edge function - uses correct Supabase project URL';
