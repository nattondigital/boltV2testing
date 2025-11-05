/*
  # Restructure AI Agents to MCP-Only Architecture

  ## Changes
  
  1. Remove Legacy Fields from ai_agents
     - Drop `use_mcp` column (everything is MCP now)
     - Drop `mcp_config` column (no longer needed)
     - Keep `system_prompt` but will be generated dynamically
  
  2. Restructure ai_agent_permissions
     - Change from module CRUD permissions to MCP tool permissions
     - New structure maps MCP servers to their tools
     - Example:
       {
         "tasks-server": {
           "enabled": true,
           "tools": ["get_tasks", "create_task", "update_task", "delete_task"]
         },
         "contacts-server": {
           "enabled": true,
           "tools": ["get_contacts", "create_contact", "update_contact"]
         }
       }
  
  3. Migration Strategy
     - Backup existing permissions
     - Convert CRUD permissions to tool permissions
     - Update all existing agents
  
  ## Migration Notes
  
  This migration converts from hardcoded tools to MCP-only architecture.
  - Tasks Module: can_view → get_tasks, can_create → create_task, etc.
  - Contacts Module: Similar mapping
  - Leads Module: Similar mapping
  - Appointments Module: Similar mapping
*/

-- First, let's create a backup of existing permissions
CREATE TABLE IF NOT EXISTS ai_agent_permissions_backup AS 
SELECT * FROM ai_agent_permissions;

-- Remove use_mcp and mcp_config from ai_agents
ALTER TABLE ai_agents DROP COLUMN IF EXISTS use_mcp;
ALTER TABLE ai_agents DROP COLUMN IF EXISTS mcp_config;

-- Create a function to convert old permissions to new MCP tool permissions
CREATE OR REPLACE FUNCTION convert_to_mcp_permissions(old_perms jsonb)
RETURNS jsonb AS $$
DECLARE
  new_perms jsonb := '{}'::jsonb;
  tasks_tools text[] := ARRAY[]::text[];
  contacts_tools text[] := ARRAY[]::text[];
  leads_tools text[] := ARRAY[]::text[];
  appointments_tools text[] := ARRAY[]::text[];
BEGIN
  -- Convert Tasks permissions
  IF (old_perms->'Tasks'->>'can_view')::boolean = true THEN
    tasks_tools := array_append(tasks_tools, 'get_tasks');
  END IF;
  IF (old_perms->'Tasks'->>'can_create')::boolean = true THEN
    tasks_tools := array_append(tasks_tools, 'create_task');
  END IF;
  IF (old_perms->'Tasks'->>'can_edit')::boolean = true THEN
    tasks_tools := array_append(tasks_tools, 'update_task');
  END IF;
  IF (old_perms->'Tasks'->>'can_delete')::boolean = true THEN
    tasks_tools := array_append(tasks_tools, 'delete_task');
  END IF;
  
  IF array_length(tasks_tools, 1) > 0 THEN
    new_perms := jsonb_set(new_perms, '{tasks-server}', 
      jsonb_build_object('enabled', true, 'tools', to_jsonb(tasks_tools)));
  END IF;
  
  -- Convert Contacts permissions
  IF (old_perms->'Contacts'->>'can_view')::boolean = true THEN
    contacts_tools := array_append(contacts_tools, 'get_contacts');
  END IF;
  IF (old_perms->'Contacts'->>'can_create')::boolean = true THEN
    contacts_tools := array_append(contacts_tools, 'create_contact');
  END IF;
  IF (old_perms->'Contacts'->>'can_edit')::boolean = true THEN
    contacts_tools := array_append(contacts_tools, 'update_contact');
  END IF;
  IF (old_perms->'Contacts'->>'can_delete')::boolean = true THEN
    contacts_tools := array_append(contacts_tools, 'delete_contact');
  END IF;
  
  IF array_length(contacts_tools, 1) > 0 THEN
    new_perms := jsonb_set(new_perms, '{contacts-server}', 
      jsonb_build_object('enabled', true, 'tools', to_jsonb(contacts_tools)));
  END IF;
  
  -- Convert Leads permissions
  IF (old_perms->'Leads'->>'can_view')::boolean = true THEN
    leads_tools := array_append(leads_tools, 'get_leads');
  END IF;
  IF (old_perms->'Leads'->>'can_create')::boolean = true THEN
    leads_tools := array_append(leads_tools, 'create_lead');
  END IF;
  IF (old_perms->'Leads'->>'can_edit')::boolean = true THEN
    leads_tools := array_append(leads_tools, 'update_lead');
  END IF;
  IF (old_perms->'Leads'->>'can_delete')::boolean = true THEN
    leads_tools := array_append(leads_tools, 'delete_lead');
  END IF;
  
  IF array_length(leads_tools, 1) > 0 THEN
    new_perms := jsonb_set(new_perms, '{leads-server}', 
      jsonb_build_object('enabled', true, 'tools', to_jsonb(leads_tools)));
  END IF;
  
  -- Convert Appointments permissions
  IF (old_perms->'Appointments'->>'can_view')::boolean = true THEN
    appointments_tools := array_append(appointments_tools, 'get_appointments');
  END IF;
  IF (old_perms->'Appointments'->>'can_create')::boolean = true THEN
    appointments_tools := array_append(appointments_tools, 'create_appointment');
  END IF;
  IF (old_perms->'Appointments'->>'can_edit')::boolean = true THEN
    appointments_tools := array_append(appointments_tools, 'update_appointment');
  END IF;
  IF (old_perms->'Appointments'->>'can_delete')::boolean = true THEN
    appointments_tools := array_append(appointments_tools, 'delete_appointment');
  END IF;
  
  IF array_length(appointments_tools, 1) > 0 THEN
    new_perms := jsonb_set(new_perms, '{appointments-server}', 
      jsonb_build_object('enabled', true, 'tools', to_jsonb(appointments_tools)));
  END IF;
  
  RETURN new_perms;
END;
$$ LANGUAGE plpgsql;

-- Update all existing permissions to new structure
UPDATE ai_agent_permissions
SET permissions = convert_to_mcp_permissions(permissions),
    updated_at = now();

-- Drop the conversion function (no longer needed)
DROP FUNCTION IF EXISTS convert_to_mcp_permissions(jsonb);

-- Add comment to document new structure
COMMENT ON COLUMN ai_agent_permissions.permissions IS 'MCP tool permissions structure: {"server-name": {"enabled": bool, "tools": ["tool1", "tool2"]}}';
