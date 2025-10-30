/*
  # Add WhatsApp Template Trigger Event to Media Folder Assignments

  1. Changes
    - Add WHATSAPP_TEMPLATE_CREATED trigger event for WhatsApp Templates module
    - Map to GHL folder: 9d74c5db-d17f-46c6-a1c0-e3c0d761a843

  2. Notes
    - This allows WhatsApp template media files to be organized in the specified GHL folder
*/

-- Insert WhatsApp template trigger event
INSERT INTO media_folder_assignments (trigger_event, module, media_folder_id)
VALUES
  ('WHATSAPP_TEMPLATE_CREATED', 'WhatsApp Templates', NULL)
ON CONFLICT (trigger_event) DO NOTHING;
