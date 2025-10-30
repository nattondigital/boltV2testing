/*
  # Add WhatsApp Followup to All Database Triggers

  1. Changes
    - Update all trigger functions to call send_followup_whatsapp
    - This enables automatic WhatsApp messages based on followup assignments
    
  2. Notes
    - WhatsApp messages are sent after workflows are triggered
    - Uses contact phone from trigger data
    - Runs asynchronously and doesn't block main operations
*/

-- LEAD TRIGGERS

CREATE OR REPLACE FUNCTION process_lead_triggers()
RETURNS TRIGGER AS $$
DECLARE
  v_trigger_event text;
  v_payload jsonb;
BEGIN
  -- Determine the trigger event
  IF (TG_OP = 'INSERT') THEN
    v_trigger_event := 'NEW_LEAD_ADDED';
    v_payload := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_trigger_event := 'LEAD_UPDATED';
    v_payload := jsonb_build_object(
      'new', to_jsonb(NEW),
      'old', to_jsonb(OLD)
    );
  ELSIF (TG_OP = 'DELETE') THEN
    v_trigger_event := 'LEAD_DELETED';
    v_payload := to_jsonb(OLD);
  END IF;

  -- Send to API webhooks
  INSERT INTO api_webhooks (trigger_event, payload)
  VALUES (v_trigger_event, v_payload);

  -- Send WhatsApp followup if phone is available
  IF (TG_OP = 'DELETE') THEN
    IF OLD.phone IS NOT NULL AND OLD.phone != '' THEN
      PERFORM send_followup_whatsapp(
        v_trigger_event,
        OLD.phone,
        OLD.name,
        v_payload
      );
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
      PERFORM send_followup_whatsapp(
        v_trigger_event,
        NEW.phone,
        NEW.name,
        v_payload
      );
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CONTACT TRIGGERS

CREATE OR REPLACE FUNCTION process_contact_triggers()
RETURNS TRIGGER AS $$
DECLARE
  v_trigger_event text;
  v_payload jsonb;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_trigger_event := 'CONTACT_ADDED';
    v_payload := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_trigger_event := 'CONTACT_UPDATED';
    v_payload := jsonb_build_object('new', to_jsonb(NEW), 'old', to_jsonb(OLD));
  ELSIF (TG_OP = 'DELETE') THEN
    v_trigger_event := 'CONTACT_DELETED';
    v_payload := to_jsonb(OLD);
  END IF;

  INSERT INTO api_webhooks (trigger_event, payload) VALUES (v_trigger_event, v_payload);

  -- Send WhatsApp followup
  IF (TG_OP = 'DELETE') THEN
    IF OLD.phone IS NOT NULL AND OLD.phone != '' THEN
      PERFORM send_followup_whatsapp(v_trigger_event, OLD.phone, OLD.name, v_payload);
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
      PERFORM send_followup_whatsapp(v_trigger_event, NEW.phone, NEW.name, v_payload);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TASK TRIGGERS

CREATE OR REPLACE FUNCTION process_task_triggers()
RETURNS TRIGGER AS $$
DECLARE
  v_trigger_event text;
  v_payload jsonb;
  v_contact_phone text;
  v_contact_name text;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_trigger_event := 'TASK_CREATED';
    v_payload := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_trigger_event := 'TASK_UPDATED';
    v_payload := jsonb_build_object('new', to_jsonb(NEW), 'old', to_jsonb(OLD));
  ELSIF (TG_OP = 'DELETE') THEN
    v_trigger_event := 'TASK_DELETED';
    v_payload := to_jsonb(OLD);
  END IF;

  INSERT INTO api_webhooks (trigger_event, payload) VALUES (v_trigger_event, v_payload);

  -- Get contact info for WhatsApp
  IF (TG_OP = 'DELETE') THEN
    IF OLD.contact_id IS NOT NULL THEN
      SELECT phone, name INTO v_contact_phone, v_contact_name
      FROM contacts_master WHERE id = OLD.contact_id;
      
      IF v_contact_phone IS NOT NULL AND v_contact_phone != '' THEN
        PERFORM send_followup_whatsapp(v_trigger_event, v_contact_phone, v_contact_name, v_payload);
      END IF;
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.contact_id IS NOT NULL THEN
      SELECT phone, name INTO v_contact_phone, v_contact_name
      FROM contacts_master WHERE id = NEW.contact_id;
      
      IF v_contact_phone IS NOT NULL AND v_contact_phone != '' THEN
        PERFORM send_followup_whatsapp(v_trigger_event, v_contact_phone, v_contact_name, v_payload);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- APPOINTMENT TRIGGERS

CREATE OR REPLACE FUNCTION process_appointment_triggers()
RETURNS TRIGGER AS $$
DECLARE
  v_trigger_event text;
  v_payload jsonb;
  v_contact_phone text;
  v_contact_name text;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_trigger_event := 'APPOINTMENT_CREATED';
    v_payload := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_trigger_event := 'APPOINTMENT_UPDATED';
    v_payload := jsonb_build_object('new', to_jsonb(NEW), 'old', to_jsonb(OLD));
  ELSIF (TG_OP = 'DELETE') THEN
    v_trigger_event := 'APPOINTMENT_DELETED';
    v_payload := to_jsonb(OLD);
  END IF;

  INSERT INTO api_webhooks (trigger_event, payload) VALUES (v_trigger_event, v_payload);

  -- Get contact info
  IF (TG_OP = 'DELETE') THEN
    IF OLD.contact_id IS NOT NULL THEN
      SELECT phone, name INTO v_contact_phone, v_contact_name
      FROM contacts_master WHERE id = OLD.contact_id;
      
      IF v_contact_phone IS NOT NULL AND v_contact_phone != '' THEN
        PERFORM send_followup_whatsapp(v_trigger_event, v_contact_phone, v_contact_name, v_payload);
      END IF;
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.contact_id IS NOT NULL THEN
      SELECT phone, name INTO v_contact_phone, v_contact_name
      FROM contacts_master WHERE id = NEW.contact_id;
      
      IF v_contact_phone IS NOT NULL AND v_contact_phone != '' THEN
        PERFORM send_followup_whatsapp(v_trigger_event, v_contact_phone, v_contact_name, v_payload);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SUPPORT TICKET TRIGGERS

CREATE OR REPLACE FUNCTION process_support_ticket_triggers()
RETURNS TRIGGER AS $$
DECLARE
  v_trigger_event text;
  v_payload jsonb;
  v_contact_phone text;
  v_contact_name text;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_trigger_event := 'TICKET_CREATED';
    v_payload := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_trigger_event := 'TICKET_UPDATED';
    v_payload := jsonb_build_object('new', to_jsonb(NEW), 'old', to_jsonb(OLD));
  ELSIF (TG_OP = 'DELETE') THEN
    v_trigger_event := 'TICKET_DELETED';
    v_payload := to_jsonb(OLD);
  END IF;

  INSERT INTO api_webhooks (trigger_event, payload) VALUES (v_trigger_event, v_payload);

  -- Get contact info
  IF (TG_OP = 'DELETE') THEN
    IF OLD.contact_id IS NOT NULL THEN
      SELECT phone, name INTO v_contact_phone, v_contact_name
      FROM contacts_master WHERE id = OLD.contact_id;
      
      IF v_contact_phone IS NOT NULL AND v_contact_phone != '' THEN
        PERFORM send_followup_whatsapp(v_trigger_event, v_contact_phone, v_contact_name, v_payload);
      END IF;
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.contact_id IS NOT NULL THEN
      SELECT phone, name INTO v_contact_phone, v_contact_name
      FROM contacts_master WHERE id = NEW.contact_id;
      
      IF v_contact_phone IS NOT NULL AND v_contact_phone != '' THEN
        PERFORM send_followup_whatsapp(v_trigger_event, v_contact_phone, v_contact_name, v_payload);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION send_followup_whatsapp IS 'All trigger functions now include WhatsApp followup functionality';
