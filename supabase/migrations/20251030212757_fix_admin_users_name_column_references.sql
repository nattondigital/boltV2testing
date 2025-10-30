/*
  # Fix Admin Users Column Name References

  1. Changes
    - Fix all triggers that reference admin_users.name to use admin_users.full_name
    - Affects: expenses, attendance, leave_requests triggers
    
  2. Notes
    - The admin_users table has full_name, not name
    - This was causing insert/update failures
*/

-- ==========================================
-- FIX EXPENSE TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION trigger_workflows_on_expense_add()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
  api_webhook_record RECORD;
  execution_id uuid;
  trigger_node jsonb;
  trigger_data jsonb;
  request_id bigint;
  webhook_success boolean;
  v_user_phone text;
  v_user_name text;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'EXPENSE_ADDED',
    'id', NEW.id,
    'expense_id', NEW.expense_id,
    'admin_user_id', NEW.admin_user_id,
    'category', NEW.category,
    'amount', NEW.amount,
    'currency', NEW.currency,
    'description', NEW.description,
    'expense_date', NEW.expense_date,
    'payment_method', NEW.payment_method,
    'receipt_url', NEW.receipt_url,
    'status', NEW.status,
    'approved_by', NEW.approved_by,
    'approved_at', NEW.approved_at,
    'notes', NEW.notes,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'EXPENSE_ADDED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
      ) INTO request_id;
      
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          success_count = COALESCE(success_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE api_webhooks
      SET total_calls = COALESCE(total_calls, 0) + 1,
          failure_count = COALESCE(failure_count, 0) + 1,
          last_triggered = now()
      WHERE id = api_webhook_record.id;
    END;
  END LOOP;

  -- Get admin user phone for WhatsApp (FIXED: use full_name)
  IF NEW.admin_user_id IS NOT NULL THEN
    SELECT phone, full_name INTO v_user_phone, v_user_name
    FROM admin_users WHERE id = NEW.admin_user_id;
    
    IF v_user_phone IS NOT NULL AND v_user_phone != '' THEN
      PERFORM send_followup_whatsapp('EXPENSE_ADDED', v_user_phone, v_user_name, trigger_data);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trigger_workflows_on_expense_update()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
  api_webhook_record RECORD;
  request_id bigint;
  v_user_phone text;
  v_user_name text;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'EXPENSE_UPDATED',
    'id', NEW.id,
    'expense_id', NEW.expense_id,
    'admin_user_id', NEW.admin_user_id,
    'category', NEW.category,
    'amount', NEW.amount,
    'currency', NEW.currency,
    'description', NEW.description,
    'expense_date', NEW.expense_date,
    'payment_method', NEW.payment_method,
    'receipt_url', NEW.receipt_url,
    'status', NEW.status,
    'approved_by', NEW.approved_by,
    'approved_at', NEW.approved_at,
    'notes', NEW.notes,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'previous', jsonb_build_object(
      'category', OLD.category,
      'amount', OLD.amount,
      'status', OLD.status
    )
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'EXPENSE_UPDATED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
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

  IF NEW.admin_user_id IS NOT NULL THEN
    SELECT phone, full_name INTO v_user_phone, v_user_name FROM admin_users WHERE id = NEW.admin_user_id;
    IF v_user_phone IS NOT NULL AND v_user_phone != '' THEN
      PERFORM send_followup_whatsapp('EXPENSE_UPDATED', v_user_phone, v_user_name, trigger_data);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trigger_workflows_on_expense_delete()
RETURNS TRIGGER AS $$
DECLARE
  trigger_data jsonb;
  api_webhook_record RECORD;
  request_id bigint;
  v_user_phone text;
  v_user_name text;
BEGIN
  trigger_data := jsonb_build_object(
    'trigger_event', 'EXPENSE_DELETED',
    'id', OLD.id,
    'expense_id', OLD.expense_id,
    'admin_user_id', OLD.admin_user_id,
    'category', OLD.category,
    'amount', OLD.amount,
    'deleted_at', now()
  );

  FOR api_webhook_record IN
    SELECT * FROM api_webhooks WHERE trigger_event = 'EXPENSE_DELETED' AND is_active = true
  LOOP
    BEGIN
      SELECT net.http_post(
        url := api_webhook_record.webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := trigger_data
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

  IF OLD.admin_user_id IS NOT NULL THEN
    SELECT phone, full_name INTO v_user_phone, v_user_name FROM admin_users WHERE id = OLD.admin_user_id;
    IF v_user_phone IS NOT NULL AND v_user_phone != '' THEN
      PERFORM send_followup_whatsapp('EXPENSE_DELETED', v_user_phone, v_user_name, trigger_data);
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- FIX ATTENDANCE TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION process_attendance_triggers()
RETURNS TRIGGER AS $$
DECLARE
  v_trigger_event text;
  v_payload jsonb;
  v_user_phone text;
  v_user_name text;
BEGIN
  IF NEW.check_out IS NULL AND OLD.check_out IS NULL THEN
    v_trigger_event := 'ATTENDANCE_CHECKIN';
  ELSIF NEW.check_out IS NOT NULL AND OLD.check_out IS NULL THEN
    v_trigger_event := 'ATTENDANCE_CHECKOUT';
  ELSE
    RETURN NEW;
  END IF;

  v_payload := to_jsonb(NEW);
  INSERT INTO api_webhooks (trigger_event, payload) VALUES (v_trigger_event, v_payload);

  IF NEW.admin_user_id IS NOT NULL THEN
    SELECT phone, full_name INTO v_user_phone, v_user_name FROM admin_users WHERE id = NEW.admin_user_id;
    IF v_user_phone IS NOT NULL AND v_user_phone != '' THEN
      PERFORM send_followup_whatsapp(v_trigger_event, v_user_phone, v_user_name, v_payload);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- FIX LEAVE REQUEST TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION process_leave_request_triggers()
RETURNS TRIGGER AS $$
DECLARE
  v_trigger_event text;
  v_payload jsonb;
  v_user_phone text;
  v_user_name text;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_trigger_event := 'LEAVE_REQUEST_ADDED';
    v_payload := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_trigger_event := 'LEAVE_REQUEST_UPDATED';
    v_payload := jsonb_build_object('new', to_jsonb(NEW), 'old', to_jsonb(OLD));
  ELSIF (TG_OP = 'DELETE') THEN
    v_trigger_event := 'LEAVE_REQUEST_DELETED';
    v_payload := to_jsonb(OLD);
  END IF;

  INSERT INTO api_webhooks (trigger_event, payload) VALUES (v_trigger_event, v_payload);

  IF (TG_OP = 'DELETE') THEN
    IF OLD.admin_user_id IS NOT NULL THEN
      SELECT phone, full_name INTO v_user_phone, v_user_name FROM admin_users WHERE id = OLD.admin_user_id;
      IF v_user_phone IS NOT NULL AND v_user_phone != '' THEN
        PERFORM send_followup_whatsapp(v_trigger_event, v_user_phone, v_user_name, v_payload);
      END IF;
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.admin_user_id IS NOT NULL THEN
      SELECT phone, full_name INTO v_user_phone, v_user_name FROM admin_users WHERE id = NEW.admin_user_id;
      IF v_user_phone IS NOT NULL AND v_user_phone != '' THEN
        PERFORM send_followup_whatsapp(v_trigger_event, v_user_phone, v_user_name, v_payload);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_workflows_on_expense_add IS 'Fixed: Uses full_name instead of name from admin_users table';
