/*
  # Create Recurring Task Scheduler

  1. Function
    - Creates a function to call the Edge Function via HTTP
    - This function will be called by pg_cron every minute

  2. Schedule
    - Sets up pg_cron to run every minute
    - Calls the Edge Function to generate tasks from recurring templates

  Note: pg_cron extension must be enabled in Supabase project
*/

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to call the Edge Function
CREATE OR REPLACE FUNCTION trigger_recurring_task_generation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  supabase_anon_key text;
  request_id bigint;
BEGIN
  -- Get the Supabase URL from environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);

  -- If settings are not available, use default pattern
  IF supabase_url IS NULL THEN
    supabase_url := 'https://' || current_setting('request.jwt.claims', true)::json->>'iss';
  END IF;

  -- Call the Edge Function using pg_net
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/generate-recurring-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || supabase_anon_key
    ),
    body := '{}'::jsonb
  ) INTO request_id;

  -- Log the request (optional)
  RAISE NOTICE 'Triggered recurring task generation with request_id: %', request_id;
END;
$$;

-- Schedule the function to run every minute
-- Note: This requires pg_cron to be enabled in your Supabase project
-- You may need to enable it from the Supabase dashboard under Database > Extensions

SELECT cron.schedule(
  'generate-recurring-tasks',
  '* * * * *', -- Every minute
  $$SELECT trigger_recurring_task_generation()$$
);

COMMENT ON FUNCTION trigger_recurring_task_generation() IS 'Triggers the Edge Function to generate tasks from recurring templates';
