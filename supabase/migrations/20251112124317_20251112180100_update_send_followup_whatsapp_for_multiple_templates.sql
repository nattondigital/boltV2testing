/*
  # Update Send Followup WhatsApp Function for Multiple Templates

  1. Changes
    - Modify send_followup_whatsapp to handle multiple template assignments
    - Fetch all 3 template IDs from followup_assignments
    - Loop through each template and send messages
    - Each template uses its own receiver_phone field

  2. Logic Flow
    - Get followup assignment with all 3 template IDs
    - For each template ID that exists:
      - Fetch template details
      - Resolve receiver_phone variables
      - Send WhatsApp message
      - Log result

  3. Benefits
    - Single trigger event can send to multiple recipients
    - Each template controls its own receiver
    - No duplicate code needed in triggers
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
  v_assignment record;
  v_template_ids uuid[];
  v_template_id uuid;
BEGIN
  -- Get Supabase URL and service role key
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- If settings not available, use environment default
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://' || current_setting('request.jwt.claims', true)::json->>'iss';
  END IF;

  -- Get the followup assignment with all template IDs
  SELECT 
    whatsapp_template_id,
    whatsapp_template_id_2,
    whatsapp_template_id_3
  INTO v_assignment
  FROM followup_assignments
  WHERE trigger_event = p_trigger_event;

  -- If no assignment found, exit
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Build array of template IDs (filter out nulls)
  v_template_ids := ARRAY[]::uuid[];
  IF v_assignment.whatsapp_template_id IS NOT NULL THEN
    v_template_ids := array_append(v_template_ids, v_assignment.whatsapp_template_id);
  END IF;
  IF v_assignment.whatsapp_template_id_2 IS NOT NULL THEN
    v_template_ids := array_append(v_template_ids, v_assignment.whatsapp_template_id_2);
  END IF;
  IF v_assignment.whatsapp_template_id_3 IS NOT NULL THEN
    v_template_ids := array_append(v_template_ids, v_assignment.whatsapp_template_id_3);
  END IF;

  -- If no templates assigned, exit
  IF array_length(v_template_ids, 1) IS NULL OR array_length(v_template_ids, 1) = 0 THEN
    RETURN;
  END IF;

  -- Loop through each template and send message
  FOREACH v_template_id IN ARRAY v_template_ids
  LOOP
    BEGIN
      -- Make HTTP request to edge function for this template
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
          'trigger_data', p_trigger_data,
          'template_id', v_template_id
        )::text
      )::http_request);
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      RAISE WARNING 'Failed to send WhatsApp message for template %: %', v_template_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION send_followup_whatsapp IS 'Sends WhatsApp messages via DoubleTick API - supports up to 3 templates per trigger event';
