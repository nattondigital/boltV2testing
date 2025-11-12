/*
  # Remove Notes Field from Expense Triggers

  1. Changes
    - Update expense triggers to remove notes field references
    - Notes column has been dropped from expenses table
    - Fix column name from 'name' to 'full_name' for admin_users table

  2. Notes
    - Updates all three expense trigger functions
    - Maintains all other fields including employee_name and global date/time variables
*/

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
  v_employee_name text;
BEGIN
  -- Get employee name from admin_users
  IF NEW.admin_user_id IS NOT NULL THEN
    SELECT full_name INTO v_employee_name
    FROM admin_users WHERE id = NEW.admin_user_id;
  END IF;

  -- Build trigger data with all fields plus employee_name and global date/time (notes removed)
  trigger_data := jsonb_build_object(
    'trigger_event', 'EXPENSE_ADDED',
    'id', NEW.id,
    'expense_id', NEW.expense_id,
    'admin_user_id', NEW.admin_user_id,
    'employee_name', COALESCE(v_employee_name, 'Unknown Employee'),
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
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'submission_date', to_char(NEW.created_at, 'YYYY-MM-DD HH24:MI:SS'),
    'current_date', to_char(now(), 'YYYY-MM-DD'),
    'current_time', to_char(now(), 'HH24:MI:SS')
  );

  -- Process API Webhooks
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

  -- Get admin user phone for WhatsApp
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
  v_employee_name text;
BEGIN
  -- Get employee name from admin_users
  IF NEW.admin_user_id IS NOT NULL THEN
    SELECT full_name INTO v_employee_name
    FROM admin_users WHERE id = NEW.admin_user_id;
  END IF;

  -- Build trigger data with all fields plus employee_name and global date/time (notes removed)
  trigger_data := jsonb_build_object(
    'trigger_event', 'EXPENSE_UPDATED',
    'id', NEW.id,
    'expense_id', NEW.expense_id,
    'admin_user_id', NEW.admin_user_id,
    'employee_name', COALESCE(v_employee_name, 'Unknown Employee'),
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
    'rejection_reason', NEW.rejection_reason,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'submission_date', to_char(NEW.created_at, 'YYYY-MM-DD HH24:MI:SS'),
    'current_date', to_char(now(), 'YYYY-MM-DD'),
    'current_time', to_char(now(), 'HH24:MI:SS'),
    'previous', jsonb_build_object(
      'category', OLD.category,
      'amount', OLD.amount,
      'status', OLD.status
    )
  );

  -- Process API Webhooks
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

  -- Get admin user phone for WhatsApp
  IF NEW.admin_user_id IS NOT NULL THEN
    SELECT phone, full_name INTO v_user_phone, v_user_name
    FROM admin_users WHERE id = NEW.admin_user_id;

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
  v_employee_name text;
BEGIN
  -- Get employee name from admin_users
  IF OLD.admin_user_id IS NOT NULL THEN
    SELECT full_name INTO v_employee_name
    FROM admin_users WHERE id = OLD.admin_user_id;
  END IF;

  -- Build trigger data with all fields plus employee_name and global date/time (notes removed)
  trigger_data := jsonb_build_object(
    'trigger_event', 'EXPENSE_DELETED',
    'id', OLD.id,
    'expense_id', OLD.expense_id,
    'admin_user_id', OLD.admin_user_id,
    'employee_name', COALESCE(v_employee_name, 'Unknown Employee'),
    'category', OLD.category,
    'amount', OLD.amount,
    'currency', OLD.currency,
    'description', OLD.description,
    'expense_date', OLD.expense_date,
    'payment_method', OLD.payment_method,
    'receipt_url', OLD.receipt_url,
    'status', OLD.status,
    'approved_by', OLD.approved_by,
    'approved_at', OLD.approved_at,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'deleted_at', now(),
    'submission_date', to_char(OLD.created_at, 'YYYY-MM-DD HH24:MI:SS'),
    'current_date', to_char(now(), 'YYYY-MM-DD'),
    'current_time', to_char(now(), 'HH24:MI:SS')
  );

  -- Process API Webhooks
  FOR api_webhook_record IN
    SELECT * FROM api_webhooks
    WHERE trigger_event = 'EXPENSE_DELETED' AND is_active = true
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

  -- Get admin user phone for WhatsApp
  IF OLD.admin_user_id IS NOT NULL THEN
    SELECT phone, full_name INTO v_user_phone, v_user_name
    FROM admin_users WHERE id = OLD.admin_user_id;

    IF v_user_phone IS NOT NULL AND v_user_phone != '' THEN
      PERFORM send_followup_whatsapp('EXPENSE_DELETED', v_user_phone, v_user_name, trigger_data);
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_workflows_on_expense_add() IS 'Triggers workflows for expense additions with employee_name lookup and global date/time variables (notes field removed, uses full_name)';
COMMENT ON FUNCTION trigger_workflows_on_expense_update() IS 'Triggers workflows for expense updates with employee_name lookup and global date/time variables (notes field removed, uses full_name)';
COMMENT ON FUNCTION trigger_workflows_on_expense_delete() IS 'Triggers workflows for expense deletions with employee_name lookup and global date/time variables (notes field removed, uses full_name)';
