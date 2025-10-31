/*
  # Simplify WhatsApp Function Call

  1. Changes
    - Remove JWT authentication header (not available in trigger context)
    - Use service role approach via edge function
    - Simplify to just send the payload
    
  2. Notes
    - Database triggers don't have user JWT context
    - Edge function will use service role key internally
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
    -- No authentication needed - edge function is public for webhooks
    SELECT net.http_post(
      url := 'https://lddridmkphmckbjjlfxi.supabase.co/functions/v1/send-whatsapp-message',
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
    -- Silently skip - this is optional functionality
    RAISE WARNING 'WhatsApp followup skipped for %: %', p_trigger_event, SQLERRM;
  END;
END;
$$;

COMMENT ON FUNCTION send_followup_whatsapp IS 'Sends WhatsApp message via edge function - simplified, no auth required';
