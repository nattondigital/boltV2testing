/*
  # Add CA Practice WhatsApp Templates

  1. Purpose
    - Insert 4 pre-configured WhatsApp templates for CA Practice
    - Templates for: New Lead Notification, Appointment Booking, Task Assignment, New Expense Added

  2. Templates Details
    - **New Lead Notification**: Notify team about new lead with client details
    - **Appointment Booking**: Confirm appointment booking with client
    - **Task Assignment**: Notify team member about new task assignment
    - **New Expense Added**: Alert about new expense submission for approval

  3. All templates
    - Type: Text
    - Status: Published
    - Created by: System
    - Include professional, clear messaging suitable for CA Practice
*/

-- Insert New Lead Notification Template
INSERT INTO whatsapp_templates (name, type, body_text, status, created_by)
VALUES (
  'New Lead Notification - CA Practice',
  'Text',
  '🔔 *New Lead Alert*

Hello Team,

A new lead has been added to the system:

👤 *Client Name:* {{contact_name}}
📱 *Phone:* {{phone_number}}
📧 *Email:* {{email}}
💼 *Service Interest:* {{service_type}}
🎯 *Lead Source:* {{lead_source}}
📊 *Current Stage:* {{stage}}

🔗 *Lead ID:* {{lead_id}}
📅 *Added On:* {{created_date}}

Please review and take necessary action.

Thank you!
_CA Practice Management System_',
  'Published',
  'System'
) ON CONFLICT DO NOTHING;

-- Insert Appointment Booking Template
INSERT INTO whatsapp_templates (name, type, body_text, status, created_by)
VALUES (
  'Appointment Confirmation - CA Practice',
  'Text',
  '✅ *Appointment Confirmed*

Dear {{contact_name}},

Your appointment has been successfully scheduled with our CA Practice.

📅 *Date:* {{appointment_date}}
⏰ *Time:* {{appointment_time}}
👤 *With:* {{assigned_to}}
📝 *Purpose:* {{appointment_title}}
📍 *Location:* {{location}}

🔗 *Appointment ID:* {{appointment_id}}

Please arrive 5-10 minutes early. If you need to reschedule, kindly inform us at least 24 hours in advance.

Looking forward to meeting you!

Best Regards,
_{{business_name}}_
_CA Practice Management_',
  'Published',
  'System'
) ON CONFLICT DO NOTHING;

-- Insert Task Assignment Template
INSERT INTO whatsapp_templates (name, type, body_text, status, created_by)
VALUES (
  'Task Assignment - CA Practice',
  'Text',
  '📋 *New Task Assigned*

Hello {{assignee_name}},

You have been assigned a new task:

📌 *Task:* {{task_title}}
👤 *Client:* {{contact_name}}
📱 *Client Phone:* {{contact_phone}}
⏰ *Due Date:* {{due_date}}
🎯 *Priority:* {{priority}}

📝 *Description:*
{{task_description}}

🔗 *Task ID:* {{task_id}}
📅 *Assigned On:* {{assigned_date}}

Please complete this task before the due date and update the status accordingly.

Thank you!
_CA Practice Management System_',
  'Published',
  'System'
) ON CONFLICT DO NOTHING;

-- Insert New Expense Added Template
INSERT INTO whatsapp_templates (name, type, body_text, status, created_by)
VALUES (
  'New Expense Alert - CA Practice',
  'Text',
  '💰 *New Expense Submitted*

Hello Team,

A new expense has been added for approval:

👤 *Submitted By:* {{employee_name}}
📂 *Category:* {{expense_category}}
💵 *Amount:* ₹{{amount}}
📅 *Expense Date:* {{expense_date}}
📝 *Description:* {{description}}

📎 *Receipt:* {{receipt_url}}
🆔 *Expense ID:* {{expense_id}}
📅 *Submitted On:* {{submission_date}}
⏳ *Status:* {{status}}

Please review and approve/reject this expense at your earliest convenience.

Thank you!
_CA Practice Finance Team_',
  'Published',
  'System'
) ON CONFLICT DO NOTHING;
