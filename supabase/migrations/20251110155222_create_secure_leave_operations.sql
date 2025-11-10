/*
  # Create Secure Leave Request Operations with Permission Checking

  1. Functions
    - secure_create_leave_request(phone, data) - Creates leave request if user has insert permission
    - secure_update_leave_request(phone, id, data) - Updates leave request if user has update permission
    - secure_delete_leave_request(phone, id) - Deletes leave request if user has delete permission
  
  2. Security
    - Each function checks admin_users permissions before performing operation
    - Returns error if user doesn't have permission
*/

-- Function to create leave request with permission check
CREATE OR REPLACE FUNCTION secure_create_leave_request(
  user_phone text,
  leave_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_permission boolean;
  new_leave leave_requests;
BEGIN
  -- Check if user has insert permission
  SELECT (permissions -> 'leave' ->> 'insert')::boolean
  INTO has_permission
  FROM admin_users
  WHERE phone = user_phone AND is_active = true;

  IF NOT COALESCE(has_permission, false) THEN
    RETURN jsonb_build_object(
      'error', 'Permission denied: You do not have permission to create leave requests',
      'code', 'PERMISSION_DENIED'
    );
  END IF;

  -- Insert the leave request
  INSERT INTO leave_requests (
    admin_user_id,
    start_date,
    end_date,
    leave_type,
    reason,
    status,
    leave_category
  ) VALUES (
    (leave_data->>'admin_user_id')::uuid,
    (leave_data->>'start_date')::date,
    (leave_data->>'end_date')::date,
    leave_data->>'leave_type',
    leave_data->>'reason',
    COALESCE(leave_data->>'status', 'Pending'),
    leave_data->>'leave_category'
  )
  RETURNING * INTO new_leave;

  RETURN to_jsonb(new_leave);
END;
$$;

-- Function to update leave request with permission check
CREATE OR REPLACE FUNCTION secure_update_leave_request(
  user_phone text,
  leave_id uuid,
  leave_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_permission boolean;
  updated_leave leave_requests;
BEGIN
  -- Check if user has update permission
  SELECT (permissions -> 'leave' ->> 'update')::boolean
  INTO has_permission
  FROM admin_users
  WHERE phone = user_phone AND is_active = true;

  IF NOT COALESCE(has_permission, false) THEN
    RETURN jsonb_build_object(
      'error', 'Permission denied: You do not have permission to update leave requests',
      'code', 'PERMISSION_DENIED'
    );
  END IF;

  -- Update the leave request
  UPDATE leave_requests
  SET
    start_date = COALESCE((leave_data->>'start_date')::date, start_date),
    end_date = COALESCE((leave_data->>'end_date')::date, end_date),
    leave_type = COALESCE(leave_data->>'leave_type', leave_type),
    reason = COALESCE(leave_data->>'reason', reason),
    status = COALESCE(leave_data->>'status', status),
    leave_category = COALESCE(leave_data->>'leave_category', leave_category),
    updated_at = now()
  WHERE id = leave_id
  RETURNING * INTO updated_leave;

  IF updated_leave.id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Leave request not found',
      'code', 'NOT_FOUND'
    );
  END IF;

  RETURN to_jsonb(updated_leave);
END;
$$;

-- Function to delete leave request with permission check
CREATE OR REPLACE FUNCTION secure_delete_leave_request(
  user_phone text,
  leave_id uuid
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
  SELECT (permissions -> 'leave' ->> 'delete')::boolean
  INTO has_permission
  FROM admin_users
  WHERE phone = user_phone AND is_active = true;

  IF NOT COALESCE(has_permission, false) THEN
    RETURN jsonb_build_object(
      'error', 'Permission denied: You do not have permission to delete leave requests',
      'code', 'PERMISSION_DENIED'
    );
  END IF;

  -- Delete the leave request
  DELETE FROM leave_requests
  WHERE id = leave_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count = 0 THEN
    RETURN jsonb_build_object(
      'error', 'Leave request not found',
      'code', 'NOT_FOUND'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Leave request deleted successfully'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION secure_create_leave_request TO anon, authenticated;
GRANT EXECUTE ON FUNCTION secure_update_leave_request TO anon, authenticated;
GRANT EXECUTE ON FUNCTION secure_delete_leave_request TO anon, authenticated;
