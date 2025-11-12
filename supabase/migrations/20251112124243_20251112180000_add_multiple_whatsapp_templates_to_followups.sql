/*
  # Add Multiple WhatsApp Templates Support to Followups

  1. Changes
    - Add whatsapp_template_id_2 column for second template
    - Add whatsapp_template_id_3 column for third template
    - Keep whatsapp_template_id for backward compatibility (first template)
    - All three are optional (nullable)

  2. Purpose
    - Allow sending up to 3 different WhatsApp templates per trigger event
    - Each template can have different receiver_phone settings
    - Example: TASK_CREATED sends to assigner, assignee, and client

  3. Usage Pattern
    - Template 1: receiver_phone = {{assigned_by_phone}} (creator)
    - Template 2: receiver_phone = {{assigned_to_phone}} (assignee)
    - Template 3: receiver_phone = {{contact_phone}} (client)
*/

-- Add two more WhatsApp template columns
ALTER TABLE followup_assignments
ADD COLUMN IF NOT EXISTS whatsapp_template_id_2 uuid REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS whatsapp_template_id_3 uuid REFERENCES whatsapp_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN followup_assignments.whatsapp_template_id IS 'First WhatsApp template (optional)';
COMMENT ON COLUMN followup_assignments.whatsapp_template_id_2 IS 'Second WhatsApp template (optional)';
COMMENT ON COLUMN followup_assignments.whatsapp_template_id_3 IS 'Third WhatsApp template (optional)';
