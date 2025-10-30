/*
  # Sync Followup Assignments with Workflow Triggers

  1. Changes
    - Delete old followup assignments with invalid trigger events
    - Insert new followup assignments for all workflow trigger events
    - Use the category from workflow_triggers as the module
    
  2. Notes
    - This migration syncs followup_assignments with actual workflow_triggers
    - All existing assignments will be cleared and recreated
    - WhatsApp templates will need to be reassigned
*/

-- Clear existing followup assignments
TRUNCATE followup_assignments;

-- Insert followup assignments for all workflow triggers
INSERT INTO followup_assignments (trigger_event, module, whatsapp_template_id)
SELECT 
  event_name as trigger_event,
  category as module,
  NULL as whatsapp_template_id
FROM workflow_triggers
WHERE is_active = true
ORDER BY category, event_name
ON CONFLICT (trigger_event) DO NOTHING;
