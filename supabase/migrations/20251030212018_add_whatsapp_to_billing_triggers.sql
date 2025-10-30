/*
  # Add WhatsApp Followup to Billing Triggers

  1. Changes
    - Update estimate triggers with WhatsApp followup
    - Update invoice triggers with WhatsApp followup
    - Update subscription triggers with WhatsApp followup
    - Update receipt triggers with WhatsApp followup
    - Update product triggers (products don't have contacts, so no WhatsApp)
    
  2. Notes
    - Gets contact phone from contact_id in billing records
    - Sends WhatsApp message only if contact phone is available
*/

-- ==========================================
-- ESTIMATE TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION process_estimate_triggers()
RETURNS TRIGGER AS $$
DECLARE
  v_trigger_event text;
  v_payload jsonb;
  v_contact_phone text;
  v_contact_name text;
  api_webhook_record RECORD;
  request_id bigint;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_trigger_event := 'ESTIMATE_CREATED';
    v_payload := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_trigger_event := 'ESTIMATE_UPDATED';
    v_payload := jsonb_build_object('new', to_jsonb(NEW), 'old', to_jsonb(OLD));
  ELSIF (TG_OP = 'DELETE') THEN
    v_trigger_event := 'ESTIMATE_DELETED';
    v_payload := to_jsonb(OLD);
  END IF;

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks WHERE trigger_event = v_trigger_event AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := v_payload
      ) INTO request_id;
      UPDATE api_webhooks SET total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1, last_triggered = now()
      WHERE id = api_webhook_record.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks SET total_calls = COALESCE(total_calls, 0) + 1,
        failure_count = COALESCE(failure_count, 0) + 1, last_triggered = now()
      WHERE id = api_webhook_record.id;
    END;
  END LOOP;

  IF (TG_OP = 'DELETE') THEN
    IF OLD.contact_id IS NOT NULL THEN
      SELECT phone, name INTO v_contact_phone, v_contact_name FROM contacts_master WHERE id = OLD.contact_id;
      IF v_contact_phone IS NOT NULL AND v_contact_phone != '' THEN
        PERFORM send_followup_whatsapp(v_trigger_event, v_contact_phone, v_contact_name, v_payload);
      END IF;
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.contact_id IS NOT NULL THEN
      SELECT phone, name INTO v_contact_phone, v_contact_name FROM contacts_master WHERE id = NEW.contact_id;
      IF v_contact_phone IS NOT NULL AND v_contact_phone != '' THEN
        PERFORM send_followup_whatsapp(v_trigger_event, v_contact_phone, v_contact_name, v_payload);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- INVOICE TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION process_invoice_triggers()
RETURNS TRIGGER AS $$
DECLARE
  v_trigger_event text;
  v_payload jsonb;
  v_contact_phone text;
  v_contact_name text;
  api_webhook_record RECORD;
  request_id bigint;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_trigger_event := 'INVOICE_CREATED';
    v_payload := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_trigger_event := 'INVOICE_UPDATED';
    v_payload := jsonb_build_object('new', to_jsonb(NEW), 'old', to_jsonb(OLD));
  ELSIF (TG_OP = 'DELETE') THEN
    v_trigger_event := 'INVOICE_DELETED';
    v_payload := to_jsonb(OLD);
  END IF;

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks WHERE trigger_event = v_trigger_event AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := v_payload
      ) INTO request_id;
      UPDATE api_webhooks SET total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1, last_triggered = now()
      WHERE id = api_webhook_record.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks SET total_calls = COALESCE(total_calls, 0) + 1,
        failure_count = COALESCE(failure_count, 0) + 1, last_triggered = now()
      WHERE id = api_webhook_record.id;
    END;
  END LOOP;

  IF (TG_OP = 'DELETE') THEN
    IF OLD.contact_id IS NOT NULL THEN
      SELECT phone, name INTO v_contact_phone, v_contact_name FROM contacts_master WHERE id = OLD.contact_id;
      IF v_contact_phone IS NOT NULL AND v_contact_phone != '' THEN
        PERFORM send_followup_whatsapp(v_trigger_event, v_contact_phone, v_contact_name, v_payload);
      END IF;
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.contact_id IS NOT NULL THEN
      SELECT phone, name INTO v_contact_phone, v_contact_name FROM contacts_master WHERE id = NEW.contact_id;
      IF v_contact_phone IS NOT NULL AND v_contact_phone != '' THEN
        PERFORM send_followup_whatsapp(v_trigger_event, v_contact_phone, v_contact_name, v_payload);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- SUBSCRIPTION TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION process_subscription_triggers()
RETURNS TRIGGER AS $$
DECLARE
  v_trigger_event text;
  v_payload jsonb;
  v_contact_phone text;
  v_contact_name text;
  api_webhook_record RECORD;
  request_id bigint;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_trigger_event := 'SUBSCRIPTION_CREATED';
    v_payload := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_trigger_event := 'SUBSCRIPTION_UPDATED';
    v_payload := jsonb_build_object('new', to_jsonb(NEW), 'old', to_jsonb(OLD));
  ELSIF (TG_OP = 'DELETE') THEN
    v_trigger_event := 'SUBSCRIPTION_DELETED';
    v_payload := to_jsonb(OLD);
  END IF;

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks WHERE trigger_event = v_trigger_event AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := v_payload
      ) INTO request_id;
      UPDATE api_webhooks SET total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1, last_triggered = now()
      WHERE id = api_webhook_record.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks SET total_calls = COALESCE(total_calls, 0) + 1,
        failure_count = COALESCE(failure_count, 0) + 1, last_triggered = now()
      WHERE id = api_webhook_record.id;
    END;
  END LOOP;

  IF (TG_OP = 'DELETE') THEN
    IF OLD.contact_id IS NOT NULL THEN
      SELECT phone, name INTO v_contact_phone, v_contact_name FROM contacts_master WHERE id = OLD.contact_id;
      IF v_contact_phone IS NOT NULL AND v_contact_phone != '' THEN
        PERFORM send_followup_whatsapp(v_trigger_event, v_contact_phone, v_contact_name, v_payload);
      END IF;
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.contact_id IS NOT NULL THEN
      SELECT phone, name INTO v_contact_phone, v_contact_name FROM contacts_master WHERE id = NEW.contact_id;
      IF v_contact_phone IS NOT NULL AND v_contact_phone != '' THEN
        PERFORM send_followup_whatsapp(v_trigger_event, v_contact_phone, v_contact_name, v_payload);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- RECEIPT TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION process_receipt_triggers()
RETURNS TRIGGER AS $$
DECLARE
  v_trigger_event text;
  v_payload jsonb;
  v_contact_phone text;
  v_contact_name text;
  api_webhook_record RECORD;
  request_id bigint;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_trigger_event := 'RECEIPT_CREATED';
    v_payload := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_trigger_event := 'RECEIPT_UPDATED';
    v_payload := jsonb_build_object('new', to_jsonb(NEW), 'old', to_jsonb(OLD));
  ELSIF (TG_OP = 'DELETE') THEN
    v_trigger_event := 'RECEIPT_DELETED';
    v_payload := to_jsonb(OLD);
  END IF;

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks WHERE trigger_event = v_trigger_event AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := v_payload
      ) INTO request_id;
      UPDATE api_webhooks SET total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1, last_triggered = now()
      WHERE id = api_webhook_record.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks SET total_calls = COALESCE(total_calls, 0) + 1,
        failure_count = COALESCE(failure_count, 0) + 1, last_triggered = now()
      WHERE id = api_webhook_record.id;
    END;
  END LOOP;

  IF (TG_OP = 'DELETE') THEN
    IF OLD.contact_id IS NOT NULL THEN
      SELECT phone, name INTO v_contact_phone, v_contact_name FROM contacts_master WHERE id = OLD.contact_id;
      IF v_contact_phone IS NOT NULL AND v_contact_phone != '' THEN
        PERFORM send_followup_whatsapp(v_trigger_event, v_contact_phone, v_contact_name, v_payload);
      END IF;
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.contact_id IS NOT NULL THEN
      SELECT phone, name INTO v_contact_phone, v_contact_name FROM contacts_master WHERE id = NEW.contact_id;
      IF v_contact_phone IS NOT NULL AND v_contact_phone != '' THEN
        PERFORM send_followup_whatsapp(v_trigger_event, v_contact_phone, v_contact_name, v_payload);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PRODUCT TRIGGERS (No WhatsApp - products don't have contacts)
-- ==========================================

CREATE OR REPLACE FUNCTION process_product_triggers()
RETURNS TRIGGER AS $$
DECLARE
  v_trigger_event text;
  v_payload jsonb;
  api_webhook_record RECORD;
  request_id bigint;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_trigger_event := 'PRODUCT_ADDED';
    v_payload := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_trigger_event := 'PRODUCT_UPDATED';
    v_payload := jsonb_build_object('new', to_jsonb(NEW), 'old', to_jsonb(OLD));
  ELSIF (TG_OP = 'DELETE') THEN
    v_trigger_event := 'PRODUCT_DELETED';
    v_payload := to_jsonb(OLD);
  END IF;

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks WHERE trigger_event = v_trigger_event AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := v_payload
      ) INTO request_id;
      UPDATE api_webhooks SET total_calls = COALESCE(total_calls, 0) + 1,
        success_count = COALESCE(success_count, 0) + 1, last_triggered = now()
      WHERE id = api_webhook_record.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks SET total_calls = COALESCE(total_calls, 0) + 1,
        failure_count = COALESCE(failure_count, 0) + 1, last_triggered = now()
      WHERE id = api_webhook_record.id;
    END;
  END LOOP;

  -- Note: Products don't have direct contacts, so no WhatsApp followup

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_estimate_triggers IS 'Billing triggers updated with WhatsApp followup support';
