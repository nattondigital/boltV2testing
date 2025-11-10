/*
  # Fix Recurring Task Scheduler URL Issue

  1. Changes
    - Fix the trigger_recurring_task_generation() function to properly get Supabase URL
    - Use a simpler approach that works in pg_cron context
    
  2. Purpose
    - Resolve the failing cron jobs
    - Enable automatic task generation from recurring templates
*/

-- Drop and recreate the function with proper URL handling
CREATE OR REPLACE FUNCTION trigger_recurring_task_generation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text := 'https://lddridmkphmckbjjlfxi.supabase.co';
  supabase_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZHJpZG1rcGhtY2tiampsZnhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjM0NjAsImV4cCI6MjA3NDk5OTQ2MH0.QpYhrr7a_5kTqsN5TOZOw5Xr4xrOWT1YqK_FzaGZZy4';
  request_id bigint;
BEGIN
  -- Call the Edge Function using pg_net
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/generate-recurring-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || supabase_anon_key
    ),
    body := '{}'::jsonb
  ) INTO request_id;

  -- Log the request
  RAISE NOTICE 'Triggered recurring task generation with request_id: %', request_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error triggering recurring task generation: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION trigger_recurring_task_generation() IS 'Triggers the Edge Function to generate tasks from recurring templates every minute via pg_cron';
