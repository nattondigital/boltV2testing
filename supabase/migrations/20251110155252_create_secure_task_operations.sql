/*
  # Create Secure Task Operations with Permission Checking

  1. Functions
    - secure_create_task(phone, data) - Creates task if user has insert permission
    - secure_update_task(phone, id, data) - Updates task if user has update permission
    - secure_delete_task(phone, id) - Deletes task if user has delete permission
  
  2. Security
    - Each function checks admin_users permissions before performing operation
    - Returns error if user doesn't have permission
*/

-- Function to create task with permission check
CREATE OR REPLACE FUNCTION secure_create_task(
  user_phone text,
  task_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_permission boolean;
  new_task tasks;
BEGIN
  -- Check if user has insert permission
  SELECT (permissions -> 'tasks' ->> 'insert')::boolean
  INTO has_permission
  FROM admin_users
  WHERE phone = user_phone AND is_active = true;

  IF NOT COALESCE(has_permission, false) THEN
    RETURN jsonb_build_object(
      'error', 'Permission denied: You do not have permission to create tasks',
      'code', 'PERMISSION_DENIED'
    );
  END IF;

  -- Insert the task
  INSERT INTO tasks (
    task_id,
    title,
    description,
    priority,
    status,
    assigned_to,
    contact_id,
    contact_name,
    contact_phone,
    contact_email,
    due_date,
    due_time,
    created_by,
    supporting_docs
  ) VALUES (
    task_data->>'task_id',
    task_data->>'title',
    task_data->>'description',
    task_data->>'priority',
    COALESCE(task_data->>'status', 'Open'),
    (task_data->>'assigned_to')::uuid,
    (task_data->>'contact_id')::uuid,
    task_data->>'contact_name',
    task_data->>'contact_phone',
    task_data->>'contact_email',
    (task_data->>'due_date')::date,
    (task_data->>'due_time')::time,
    task_data->>'created_by',
    (task_data->>'supporting_docs')::jsonb
  )
  RETURNING * INTO new_task;

  RETURN to_jsonb(new_task);
END;
$$;

-- Function to update task with permission check
CREATE OR REPLACE FUNCTION secure_update_task(
  user_phone text,
  task_id uuid,
  task_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_permission boolean;
  updated_task tasks;
BEGIN
  -- Check if user has update permission
  SELECT (permissions -> 'tasks' ->> 'update')::boolean
  INTO has_permission
  FROM admin_users
  WHERE phone = user_phone AND is_active = true;

  IF NOT COALESCE(has_permission, false) THEN
    RETURN jsonb_build_object(
      'error', 'Permission denied: You do not have permission to update tasks',
      'code', 'PERMISSION_DENIED'
    );
  END IF;

  -- Update the task
  UPDATE tasks
  SET
    title = COALESCE(task_data->>'title', title),
    description = COALESCE(task_data->>'description', description),
    priority = COALESCE(task_data->>'priority', priority),
    status = COALESCE(task_data->>'status', status),
    assigned_to = COALESCE((task_data->>'assigned_to')::uuid, assigned_to),
    contact_id = COALESCE((task_data->>'contact_id')::uuid, contact_id),
    contact_name = COALESCE(task_data->>'contact_name', contact_name),
    contact_phone = COALESCE(task_data->>'contact_phone', contact_phone),
    contact_email = COALESCE(task_data->>'contact_email', contact_email),
    due_date = COALESCE((task_data->>'due_date')::date, due_date),
    due_time = COALESCE((task_data->>'due_time')::time, due_time),
    supporting_docs = COALESCE((task_data->>'supporting_docs')::jsonb, supporting_docs),
    updated_at = now()
  WHERE id = task_id
  RETURNING * INTO updated_task;

  IF updated_task.id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Task not found',
      'code', 'NOT_FOUND'
    );
  END IF;

  RETURN to_jsonb(updated_task);
END;
$$;

-- Function to delete task with permission check
CREATE OR REPLACE FUNCTION secure_delete_task(
  user_phone text,
  task_id uuid
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
  SELECT (permissions -> 'tasks' ->> 'delete')::boolean
  INTO has_permission
  FROM admin_users
  WHERE phone = user_phone AND is_active = true;

  IF NOT COALESCE(has_permission, false) THEN
    RETURN jsonb_build_object(
      'error', 'Permission denied: You do not have permission to delete tasks',
      'code', 'PERMISSION_DENIED'
    );
  END IF;

  -- Delete the task
  DELETE FROM tasks
  WHERE id = task_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count = 0 THEN
    RETURN jsonb_build_object(
      'error', 'Task not found',
      'code', 'NOT_FOUND'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Task deleted successfully'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION secure_create_task TO anon, authenticated;
GRANT EXECUTE ON FUNCTION secure_update_task TO anon, authenticated;
GRANT EXECUTE ON FUNCTION secure_delete_task TO anon, authenticated;
