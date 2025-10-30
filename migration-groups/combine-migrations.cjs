#!/usr/bin/env node

/**
 * Migration Combiner Script
 *
 * This script combines individual SQL migration files into organized group files
 * based on functional domains and dependencies.
 */

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');
const OUTPUT_DIR = __dirname;

// Define migration groups with their constituent files
const migrationGroups = [
  {
    id: 1,
    name: 'Foundation and Core Tables',
    description: 'Foundational database setup for enrolled members, webhooks, admin users, and OTP verification',
    dependencies: 'None (base tables)',
    files: [
      '20251002164920_create_enrolled_members_table.sql',
      '20251002172736_add_personal_and_business_details_to_enrolled_members.sql',
      '20251002174138_create_webhooks_table.sql',
      '20251002175452_update_enrolled_members_rls_for_anon_access.sql',
      '20251002180016_create_admin_users_and_roles.sql',
      '20251002180034_update_all_tables_rls_for_admin_access.sql',
      '20251002182342_add_team_fields_to_admin_users.sql',
      '20251002184414_create_otp_verifications_table.sql'
    ]
  },
  {
    id: 2,
    name: 'Additional Foundation Tables',
    description: 'Admin sessions RLS, member tools access, support tickets, and leads tables',
    dependencies: 'Group 1',
    files: [
      '20251002185528_update_admin_users_rls_for_anon_access.sql',
      '20251002185543_update_admin_sessions_rls_for_anon_access.sql',
      '20251002191742_create_member_tools_access_table.sql',
      '20251002193332_create_support_tickets_table.sql',
      '20251003151739_create_leads_table.sql',
      '20251016101535_create_affiliates_table.sql',
      '20251016103409_create_partner_affiliates_otp_table.sql',
      '20251016111129_add_affiliate_id_to_leads_v2.sql'
    ]
  },
  {
    id: 3,
    name: 'LMS and Configuration Tables',
    description: 'Learning Management System tables, WhatsApp configuration, and automation infrastructure',
    dependencies: 'Group 1-2',
    files: [
      '20251016125738_create_lms_tables.sql',
      '20251016133530_add_thumbnail_to_lessons.sql',
      '20251016143047_create_whatsapp_config_table.sql',
      '20251016143523_update_whatsapp_config_rls_for_anon_access.sql',
      '20251016145124_create_automations_tables.sql',
      '20251016150826_update_automations_workflow_structure.sql',
      '20251016153328_create_workflow_triggers_table.sql',
      '20251016154448_create_workflow_actions_table.sql',
      '20251016155741_create_workflow_executions_and_trigger_system.sql',
      '20251016155840_update_workflow_trigger_to_call_edge_function.sql'
    ]
  },
  {
    id: 4,
    name: 'Workflow System Refinement',
    description: 'Workflow trigger execution, API webhooks, and lead triggers',
    dependencies: 'Group 3',
    files: [
      '20251016155911_simplify_workflow_trigger_execution.sql',
      '20251016160338_fix_ambiguous_column_reference_in_trigger.sql',
      '20251016162244_create_api_webhooks_table.sql',
      '20251016162454_update_trigger_to_send_to_api_webhooks.sql',
      '20251016162853_update_api_webhooks_rls_for_anon_access.sql',
      '20251016165211_add_lead_updated_trigger.sql',
      '20251016165212_add_lead_deleted_trigger.sql',
      '20251016165213_add_lead_deleted_trigger_data.sql',
      '20251016170137_20251016165212_add_lead_deleted_trigger.sql',
      '20251016170156_20251016165213_add_lead_deleted_trigger_data.sql',
      '20251016171744_20251016170500_update_lead_triggers_for_api_webhooks.sql'
    ]
  },
  {
    id: 5,
    name: 'Support and Attendance Systems',
    description: 'Support ticket triggers, attendance tracking, and affiliate triggers',
    dependencies: 'Group 4',
    files: [
      '20251016172937_create_support_ticket_triggers.sql',
      '20251016180012_create_attendance_table.sql',
      '20251016181148_update_attendance_rls_for_anon_read.sql',
      '20251018172938_add_affiliate_triggers.sql',
      '20251018183139_update_affiliate_triggers_for_api_webhooks.sql',
      '20251018184329_add_trigger_event_to_all_webhook_payloads.sql',
      '20251018184416_add_trigger_event_to_support_ticket_webhooks.sql',
      '20251018190601_create_enrolled_member_triggers.sql',
      '20251018192404_create_team_user_triggers.sql',
      '20251018194556_create_attendance_triggers.sql'
    ]
  },
  {
    id: 6,
    name: 'Products, Expenses, and Leave Management',
    description: 'Products master, expenses, leave requests with their respective triggers',
    dependencies: 'Group 5',
    files: [
      '20251018200513_create_expenses_table.sql',
      '20251018200610_create_expense_triggers.sql',
      '20251019121208_create_products_master_table.sql',
      '20251019121307_create_product_triggers.sql',
      '20251019124600_create_leave_requests_table.sql',
      '20251019124703_create_leave_request_triggers.sql'
    ]
  },
  {
    id: 7,
    name: 'Billing System Tables',
    description: 'Estimates, invoices, subscriptions, receipts, and their triggers',
    dependencies: 'Group 6',
    files: [
      '20251019132802_create_billing_estimates_table.sql',
      '20251019132857_create_billing_invoices_subscriptions_receipts_tables.sql',
      '20251019141632_create_estimate_triggers.sql',
      '20251019141702_create_invoice_triggers.sql',
      '20251019141731_create_subscription_triggers.sql',
      '20251019141758_create_receipt_triggers.sql',
      '20251019143739_create_webhook_events_table.sql',
      '20251019143825_update_billing_triggers_to_webhook_events.sql',
      '20251019144622_update_billing_triggers_to_api_webhooks.sql',
      '20251019144700_add_billing_workflow_triggers.sql',
      '20251019151010_20251019144700_add_billing_workflow_triggers.sql'
    ]
  },
  {
    id: 8,
    name: 'Contacts Master and Sync System',
    description: 'Contacts master table, lead-contact synchronization, and integrations',
    dependencies: 'Group 7',
    files: [
      '20251019153419_20251019151012_create_contacts_master_table.sql',
      '20251019154527_20251019153420_make_email_optional_in_contacts_master.sql',
      '20251019165319_20251019154527_make_email_optional_and_sync_leads_contacts.sql',
      '20251019170038_20251019165319_fix_sync_triggers.sql',
      '20251019170712_20251019170038_fix_sync_triggers.sql',
      '20251019195819_create_integrations_table.sql',
      '20251020072807_create_media_storage_tables.sql',
      '20251020090917_create_appearance_settings_table.sql',
      '20251020092723_update_appearance_settings_rls_for_system_defaults.sql',
      '20251020163000_create_contact_notes_table.sql',
      '20251020171159_create_contact_notes_table.sql'
    ]
  },
  {
    id: 9,
    name: 'Appointments and Calendar System',
    description: 'Appointments, calendars, and their workflow triggers',
    dependencies: 'Group 8',
    files: [
      '20251021115413_create_appointments_table.sql',
      '20251021123302_create_calendars_table.sql',
      '20251021134115_add_calendar_id_to_appointments.sql',
      '20251021140613_add_max_bookings_per_slot_to_calendars.sql',
      '20251022092642_create_appointment_triggers.sql',
      '20251022093500_add_appointment_workflow_triggers.sql',
      '20251022100748_add_created_by_to_appointments.sql'
    ]
  },
  {
    id: 10,
    name: 'Tasks Management System',
    description: 'Tasks table, RLS policies, and workflow triggers',
    dependencies: 'Group 9',
    files: [
      '20251021191200_create_tasks_table.sql',
      '20251021200351_create_tasks_table.sql',
      '20251021200855_update_tasks_rls_policies.sql',
      '20251021201624_update_tasks_rls_for_anon_access.sql',
      '20251022113231_add_contact_to_tasks.sql',
      '20251022120000_create_task_triggers.sql',
      '20251022122626_create_task_triggers.sql',
      '20251022123001_add_task_workflow_triggers.sql',
      '20251022124554_update_task_triggers_with_phone_numbers.sql',
      '20251022124628_update_task_workflow_triggers_schema_with_phone.sql'
    ]
  },
  {
    id: 11,
    name: 'Contact Triggers and Webhooks',
    description: 'Contact CRUD triggers, workflow automation, and webhook RLS updates',
    dependencies: 'Group 10',
    files: [
      '20251023124500_create_contact_triggers.sql',
      '20251023124600_add_contact_workflow_triggers.sql',
      '20251023135146_create_contact_triggers.sql',
      '20251023135225_add_contact_workflow_triggers.sql',
      '20251023142616_update_webhooks_rls_for_anon_access.sql'
    ]
  },
  {
    id: 12,
    name: 'Pipeline and Stage Management',
    description: 'Rename status to stage, create pipelines, and update related triggers',
    dependencies: 'Group 11',
    files: [
      '20251023150000_rename_status_to_stage_in_leads.sql',
      '20251023150001_update_lead_triggers_for_stage_rename.sql',
      '20251023194149_rename_status_to_stage_in_leads.sql',
      '20251023194213_update_lead_triggers_for_stage_rename.sql',
      '20251023200000_create_pipelines_tables.sql',
      '20251023200356_create_pipelines_tables.sql',
      '20251023202734_fix_lead_triggers.sql',
      '20251023202857_fix_workflow_triggers_for_stage.sql',
      '20251023210000_add_pipeline_to_leads.sql',
      '20251023210001_fix_lead_triggers.sql',
      '20251023210002_fix_workflow_triggers_for_stage.sql',
      '20251023212628_add_lead_update_sync_to_contact.sql',
      '20251023213631_add_auto_generate_lead_id_trigger.sql'
    ]
  },
  {
    id: 13,
    name: 'Support Tickets and Media Updates',
    description: 'Support ticket updates, media storage bucket, and AI agents tables',
    dependencies: 'Group 12',
    files: [
      '20251024081323_add_attachments_to_support_tickets.sql',
      '20251024082432_rename_enrolled_member_id_to_contact_id_in_support_tickets.sql',
      '20251024083631_create_media_files_storage_bucket.sql',
      '20251024084736_migrate_support_ticket_contacts_and_fix_fkey.sql',
      '20251024085201_update_support_ticket_triggers_to_use_contact_id.sql',
      '20251025000000_create_ai_agents_tables.sql',
      '20251025085835_create_ai_agents_tables.sql',
      '20251025152029_update_ai_agent_permissions_to_array_structure.sql',
      '20251026090901_remove_duplicate_contacts_and_add_unique_constraint.sql',
      '20251026123432_update_appointment_id_format.sql',
      '20251026134714_add_missing_modules_to_admin_permissions.sql'
    ]
  },
  {
    id: 14,
    name: 'Advanced Features and Optimizations',
    description: 'Task enhancements, custom fields, media folders, and task reminders',
    dependencies: 'Group 13',
    files: [
      '20251026141827_add_method_to_webhooks.sql',
      '20251026145852_add_task_denormalized_fields_trigger.sql',
      '20251026151051_update_task_id_format_to_sequential.sql',
      '20251026161241_update_support_tickets_assigned_to_uuid.sql',
      '20251026185603_create_ai_agent_chat_memory_table.sql',
      '20251027000000_create_media_folder_assignments_table.sql',
      '20251027100731_create_media_folder_assignments_table.sql',
      '20251027104205_add_ticket_trigger_events_to_media_folder_assignments.sql',
      '20251027104439_add_ticket_trigger_events_to_media_folder_assignments.sql',
      '20251027185316_fix_product_triggers_column_names.sql',
      '20251029165927_create_custom_lead_tabs_table.sql',
      '20251029170814_update_custom_lead_tabs_rls_for_anon_access.sql',
      '20251029172535_create_custom_fields_table.sql',
      '20251029183311_add_new_custom_field_types.sql',
      '20251029190000_update_tasks_remove_tags_notes_add_supporting_docs.sql',
      '20251029194626_update_tasks_remove_tags_notes_add_supporting_docs.sql',
      '20251029195000_fix_task_triggers_remove_tags_notes.sql',
      '20251029195245_fix_task_triggers_remove_tags_notes.sql',
      '20251029203201_update_tasks_datetime_fields.sql',
      '20251029212143_create_task_reminders_table.sql',
      '20251029214830_add_task_reminder_workflow_trigger.sql',
      '20251029214859_create_task_reminder_scheduler_function.sql'
    ]
  }
];

/**
 * Read a migration file and return its content
 */
function readMigrationFile(filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: File not found: ${filename}`);
    return null;
  }

  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Create a combined migration file for a group
 */
function createGroupFile(group) {
  const outputFilename = `group-${String(group.id).padStart(2, '0')}-${group.name.toLowerCase().replace(/\s+/g, '-')}.sql`;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);

  let content = `/*
${'='.repeat(80)}
GROUP ${group.id}: ${group.name.toUpperCase()}
${'='.repeat(80)}

${group.description}

Total Files: ${group.files.length}
Dependencies: ${group.dependencies}

Files Included (in execution order):
${group.files.map((f, i) => `${i + 1}. ${f}`).join('\n')}

${'='.repeat(80)}
*/

`;

  // Add each migration file
  group.files.forEach((filename, index) => {
    const migrationContent = readMigrationFile(filename);

    if (migrationContent) {
      content += `-- ${'='.repeat(76)}\n`;
      content += `-- MIGRATION ${index + 1}: ${filename}\n`;
      content += `-- ${'='.repeat(76)}\n`;
      content += migrationContent.trim();
      content += '\n\n';
    }
  });

  content += `/*
${'='.repeat(80)}
END OF GROUP ${group.id}: ${group.name.toUpperCase()}
${'='.repeat(80)}`;

  if (group.id < migrationGroups.length) {
    const nextGroup = migrationGroups[group.id];
    content += `\nNext Group: group-${String(nextGroup.id).padStart(2, '0')}-${nextGroup.name.toLowerCase().replace(/\s+/g, '-')}.sql`;
  } else {
    content += `\nThis is the final migration group.`;
  }

  content += `\n*/\n`;

  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`✓ Created: ${outputFilename} (${group.files.length} files combined)`);

  return outputFilename;
}

/**
 * Main function to create all group files
 */
function combineAllMigrations() {
  console.log('Starting migration combination process...\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const createdFiles = [];
  let totalFiles = 0;

  migrationGroups.forEach(group => {
    const filename = createGroupFile(group);
    createdFiles.push(filename);
    totalFiles += group.files.length;
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log('Migration combination complete!');
  console.log(`${'='.repeat(80)}`);
  console.log(`Total groups created: ${migrationGroups.length}`);
  console.log(`Total migrations combined: ${totalFiles}`);
  console.log(`\nCreated files:`);
  createdFiles.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file}`);
  });
  console.log(`\nAll files saved to: ${OUTPUT_DIR}`);
}

// Run the combination process
if (require.main === module) {
  try {
    combineAllMigrations();
  } catch (error) {
    console.error('Error combining migrations:', error);
    process.exit(1);
  }
}

module.exports = { migrationGroups, combineAllMigrations };
