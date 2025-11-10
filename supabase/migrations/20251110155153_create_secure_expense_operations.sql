/*
  # Create Secure Expense Operations with Permission Checking

  1. Functions
    - secure_create_expense(phone, data) - Creates expense if user has insert permission
    - secure_update_expense(phone, id, data) - Updates expense if user has update permission
    - secure_delete_expense(phone, id) - Deletes expense if user has delete permission
  
  2. Security
    - Each function checks admin_users permissions before performing operation
    - Returns error if user doesn't have permission
    - Functions are SECURITY DEFINER to bypass RLS
*/

-- Function to create expense with permission check
CREATE OR REPLACE FUNCTION secure_create_expense(
  user_phone text,
  expense_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_permission boolean;
  new_expense expenses;
BEGIN
  -- Check if user has insert permission
  SELECT (permissions -> 'expenses' ->> 'insert')::boolean
  INTO has_permission
  FROM admin_users
  WHERE phone = user_phone AND is_active = true;

  IF NOT COALESCE(has_permission, false) THEN
    RETURN jsonb_build_object(
      'error', 'Permission denied: You do not have permission to create expenses',
      'code', 'PERMISSION_DENIED'
    );
  END IF;

  -- Insert the expense
  INSERT INTO expenses (
    admin_user_id,
    category,
    amount,
    description,
    expense_date,
    payment_method,
    receipt_url,
    notes,
    status,
    user_phone
  ) VALUES (
    (expense_data->>'admin_user_id')::uuid,
    expense_data->>'category',
    (expense_data->>'amount')::numeric,
    expense_data->>'description',
    (expense_data->>'expense_date')::date,
    expense_data->>'payment_method',
    expense_data->>'receipt_url',
    expense_data->>'notes',
    COALESCE(expense_data->>'status', 'Pending'),
    user_phone
  )
  RETURNING * INTO new_expense;

  RETURN to_jsonb(new_expense);
END;
$$;

-- Function to update expense with permission check
CREATE OR REPLACE FUNCTION secure_update_expense(
  user_phone text,
  expense_id uuid,
  expense_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_permission boolean;
  updated_expense expenses;
BEGIN
  -- Check if user has update permission
  SELECT (permissions -> 'expenses' ->> 'update')::boolean
  INTO has_permission
  FROM admin_users
  WHERE phone = user_phone AND is_active = true;

  IF NOT COALESCE(has_permission, false) THEN
    RETURN jsonb_build_object(
      'error', 'Permission denied: You do not have permission to update expenses',
      'code', 'PERMISSION_DENIED'
    );
  END IF;

  -- Update the expense
  UPDATE expenses
  SET
    category = COALESCE(expense_data->>'category', category),
    amount = COALESCE((expense_data->>'amount')::numeric, amount),
    description = COALESCE(expense_data->>'description', description),
    expense_date = COALESCE((expense_data->>'expense_date')::date, expense_date),
    payment_method = COALESCE(expense_data->>'payment_method', payment_method),
    receipt_url = COALESCE(expense_data->>'receipt_url', receipt_url),
    notes = COALESCE(expense_data->>'notes', notes),
    status = COALESCE(expense_data->>'status', status),
    rejection_reason = COALESCE(expense_data->>'rejection_reason', rejection_reason),
    updated_at = now()
  WHERE id = expense_id
  RETURNING * INTO updated_expense;

  IF updated_expense.id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Expense not found',
      'code', 'NOT_FOUND'
    );
  END IF;

  RETURN to_jsonb(updated_expense);
END;
$$;

-- Function to delete expense with permission check
CREATE OR REPLACE FUNCTION secure_delete_expense(
  user_phone text,
  expense_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_permission boolean;
  deleted_count integer;
BEGIN
  -- Check if user has delete permission
  SELECT (permissions -> 'expenses' ->> 'delete')::boolean
  INTO has_permission
  FROM admin_users
  WHERE phone = user_phone AND is_active = true;

  IF NOT COALESCE(has_permission, false) THEN
    RETURN jsonb_build_object(
      'error', 'Permission denied: You do not have permission to delete expenses',
      'code', 'PERMISSION_DENIED'
    );
  END IF;

  -- Delete the expense
  DELETE FROM expenses
  WHERE id = expense_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count = 0 THEN
    RETURN jsonb_build_object(
      'error', 'Expense not found',
      'code', 'NOT_FOUND'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Expense deleted successfully'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION secure_create_expense TO anon, authenticated;
GRANT EXECUTE ON FUNCTION secure_update_expense TO anon, authenticated;
GRANT EXECUTE ON FUNCTION secure_delete_expense TO anon, authenticated;
