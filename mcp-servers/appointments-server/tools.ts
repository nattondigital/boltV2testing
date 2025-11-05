/**
 * Appointment tools for MCP server
 * Provides CRUD operations for appointments
 */

import { getSupabase } from '../shared/supabase-client.js';
import { createLogger } from '../shared/logger.js';
import { createPermissionValidator } from '../shared/permission-validator.js';
import type { Appointment, AppointmentFilters, MCPResponse } from '../shared/types.js';

const logger = createLogger('AppointmentTools');

async function logAction(
  agentId: string,
  agentName: string,
  action: string,
  result: 'Success' | 'Error',
  details: any = null,
  errorMessage: string | null = null
): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.from('ai_agent_logs').insert({
      agent_id: agentId,
      agent_name: agentName,
      module: 'Appointments',
      action,
      result,
      error_message: errorMessage,
      user_context: 'MCP Server',
      details,
    });
  } catch (error: any) {
    logger.error('Failed to log action', { error: error.message });
  }
}

export const tools = [
  {
    name: 'get_appointments',
    description: 'Retrieve appointments with advanced filtering and search capabilities. Use appointment_id to get a specific appointment.',
    inputSchema: {
      type: 'object',
      properties: {
        appointment_id: {
          type: 'string',
          description: 'Get a specific appointment by its appointment_id',
        },
        id: {
          type: 'string',
          description: 'Get a specific appointment by its UUID',
        },
        status: {
          type: 'string',
          description: 'Filter by status',
          enum: ['Scheduled', 'Confirmed', 'Completed', 'No-Show'],
        },
        meeting_type: {
          type: 'string',
          description: 'Filter by meeting type',
          enum: ['In-Person', 'Phone Call', 'Video Call'],
        },
        contact_id: {
          type: 'string',
          description: 'Filter by contact ID',
        },
        assigned_to: {
          type: 'string',
          description: 'Filter by assigned user ID',
        },
        calendar_id: {
          type: 'string',
          description: 'Filter by calendar ID',
        },
        date_from: {
          type: 'string',
          description: 'Filter appointments from this date (YYYY-MM-DD)',
        },
        date_to: {
          type: 'string',
          description: 'Filter appointments to this date (YYYY-MM-DD)',
        },
        search: {
          type: 'string',
          description: 'Search in title, contact name, purpose, or notes',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of appointments to return (default: 100)',
        },
        offset: {
          type: 'number',
          description: 'Number of appointments to skip (for pagination)',
        },
      },
    },
  },
  {
    name: 'create_appointment',
    description: 'Create a new appointment',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Appointment title',
        },
        contact_name: {
          type: 'string',
          description: 'Contact name',
        },
        contact_phone: {
          type: 'string',
          description: 'Contact phone number',
        },
        contact_email: {
          type: 'string',
          description: 'Contact email',
        },
        contact_id: {
          type: 'string',
          description: 'Contact ID from contacts_master',
        },
        appointment_date: {
          type: 'string',
          description: 'Appointment date (YYYY-MM-DD)',
        },
        appointment_time: {
          type: 'string',
          description: 'Appointment time (HH:MM)',
        },
        duration_minutes: {
          type: 'number',
          description: 'Duration in minutes (default: 30)',
          default: 30,
        },
        location: {
          type: 'string',
          description: 'Meeting location or video call link',
        },
        meeting_type: {
          type: 'string',
          description: 'Type of meeting',
          enum: ['In-Person', 'Phone Call', 'Video Call'],
        },
        status: {
          type: 'string',
          description: 'Appointment status',
          enum: ['Scheduled', 'Confirmed', 'Completed', 'No-Show'],
          default: 'Scheduled',
        },
        purpose: {
          type: 'string',
          description: 'Purpose of the appointment',
        },
        notes: {
          type: 'string',
          description: 'Additional notes',
        },
        assigned_to: {
          type: 'string',
          description: 'Assigned user ID',
        },
        calendar_id: {
          type: 'string',
          description: 'Calendar ID',
        },
        created_by: {
          type: 'string',
          description: 'Creator user ID',
        },
      },
      required: ['title', 'contact_name', 'contact_phone', 'appointment_date', 'appointment_time', 'meeting_type', 'purpose'],
    },
  },
  {
    name: 'update_appointment',
    description: 'Update an existing appointment',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Appointment UUID',
        },
        title: {
          type: 'string',
          description: 'Appointment title',
        },
        contact_name: {
          type: 'string',
          description: 'Contact name',
        },
        contact_phone: {
          type: 'string',
          description: 'Contact phone number',
        },
        contact_email: {
          type: 'string',
          description: 'Contact email',
        },
        contact_id: {
          type: 'string',
          description: 'Contact ID',
        },
        appointment_date: {
          type: 'string',
          description: 'Appointment date (YYYY-MM-DD)',
        },
        appointment_time: {
          type: 'string',
          description: 'Appointment time (HH:MM)',
        },
        duration_minutes: {
          type: 'number',
          description: 'Duration in minutes',
        },
        location: {
          type: 'string',
          description: 'Meeting location or video call link',
        },
        meeting_type: {
          type: 'string',
          description: 'Type of meeting',
          enum: ['In-Person', 'Phone Call', 'Video Call'],
        },
        status: {
          type: 'string',
          description: 'Appointment status',
          enum: ['Scheduled', 'Confirmed', 'Completed', 'No-Show'],
        },
        purpose: {
          type: 'string',
          description: 'Purpose of the appointment',
        },
        notes: {
          type: 'string',
          description: 'Additional notes',
        },
        reminder_sent: {
          type: 'boolean',
          description: 'Whether reminder has been sent',
        },
        assigned_to: {
          type: 'string',
          description: 'Assigned user ID',
        },
        calendar_id: {
          type: 'string',
          description: 'Calendar ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_appointment',
    description: 'Delete an appointment',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Appointment UUID to delete',
        },
      },
      required: ['id'],
    },
  },
];

export async function callTool(
  name: string,
  args: any,
  agentId: string,
  agentName: string
): Promise<MCPResponse> {
  logger.info('Tool called', { name, args, agentId });

  const supabase = getSupabase();
  const validator = createPermissionValidator(agentId);

  try {
    if (name === 'get_appointments') {
      await validator.validateOrThrow('Appointments', 'view');

      let query = supabase.from('appointments').select('*');

      if (args.appointment_id) {
        query = query.eq('appointment_id', args.appointment_id);
      }

      if (args.id) {
        query = query.eq('id', args.id);
      }

      if (args.status) query = query.eq('status', args.status);
      if (args.meeting_type) query = query.eq('meeting_type', args.meeting_type);
      if (args.contact_id) query = query.eq('contact_id', args.contact_id);
      if (args.assigned_to) query = query.eq('assigned_to', args.assigned_to);
      if (args.calendar_id) query = query.eq('calendar_id', args.calendar_id);
      if (args.date_from) query = query.gte('appointment_date', args.date_from);
      if (args.date_to) query = query.lte('appointment_date', args.date_to);

      if (args.search) {
        query = query.or(
          `title.ilike.%${args.search}%,contact_name.ilike.%${args.search}%,purpose.ilike.%${args.search}%,notes.ilike.%${args.search}%`
        );
      }

      query = query.order('appointment_date', { ascending: true }).order('appointment_time', { ascending: true });

      if (args.limit) query = query.limit(args.limit);
      if (args.offset) query = query.range(args.offset, args.offset + (args.limit || 100) - 1);

      const { data, error } = await query;

      if (error) throw error;

      await logAction(agentId, agentName, 'get_appointments', 'Success', {
        filters: args,
        count: data?.length || 0,
      });

      return {
        success: true,
        data: { appointments: data || [], count: data?.length || 0 },
      };
    }

    if (name === 'create_appointment') {
      await validator.validateOrThrow('Appointments', 'create');

      const { data, error } = await supabase
        .from('appointments')
        .insert({
          title: args.title,
          contact_name: args.contact_name,
          contact_phone: args.contact_phone,
          contact_email: args.contact_email || null,
          contact_id: args.contact_id || null,
          appointment_date: args.appointment_date,
          appointment_time: args.appointment_time,
          duration_minutes: args.duration_minutes || 30,
          location: args.location || null,
          meeting_type: args.meeting_type,
          status: args.status || 'Scheduled',
          purpose: args.purpose,
          notes: args.notes || null,
          assigned_to: args.assigned_to || null,
          calendar_id: args.calendar_id || null,
          created_by: args.created_by || null,
        })
        .select()
        .single();

      if (error) throw error;

      await logAction(agentId, agentName, 'create_appointment', 'Success', {
        appointment_id: data.id,
        title: data.title,
        date: data.appointment_date,
        time: data.appointment_time,
      });

      return {
        success: true,
        data: { appointment: data },
      };
    }

    if (name === 'update_appointment') {
      await validator.validateOrThrow('Appointments', 'edit');

      const updates: any = { updated_at: new Date().toISOString() };
      if (args.title !== undefined) updates.title = args.title;
      if (args.contact_name !== undefined) updates.contact_name = args.contact_name;
      if (args.contact_phone !== undefined) updates.contact_phone = args.contact_phone;
      if (args.contact_email !== undefined) updates.contact_email = args.contact_email;
      if (args.contact_id !== undefined) updates.contact_id = args.contact_id;
      if (args.appointment_date !== undefined) updates.appointment_date = args.appointment_date;
      if (args.appointment_time !== undefined) updates.appointment_time = args.appointment_time;
      if (args.duration_minutes !== undefined) updates.duration_minutes = args.duration_minutes;
      if (args.location !== undefined) updates.location = args.location;
      if (args.meeting_type !== undefined) updates.meeting_type = args.meeting_type;
      if (args.status !== undefined) updates.status = args.status;
      if (args.purpose !== undefined) updates.purpose = args.purpose;
      if (args.notes !== undefined) updates.notes = args.notes;
      if (args.reminder_sent !== undefined) updates.reminder_sent = args.reminder_sent;
      if (args.assigned_to !== undefined) updates.assigned_to = args.assigned_to;
      if (args.calendar_id !== undefined) updates.calendar_id = args.calendar_id;

      const { data, error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', args.id)
        .select()
        .single();

      if (error) throw error;

      await logAction(agentId, agentName, 'update_appointment', 'Success', {
        appointment_id: args.id,
        updates,
      });

      return {
        success: true,
        data: { appointment: data },
      };
    }

    if (name === 'delete_appointment') {
      await validator.validateOrThrow('Appointments', 'delete');

      const { error } = await supabase.from('appointments').delete().eq('id', args.id);

      if (error) throw error;

      await logAction(agentId, agentName, 'delete_appointment', 'Success', {
        appointment_id: args.id,
      });

      return {
        success: true,
        data: { deleted: true, appointment_id: args.id },
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    logger.error('Tool execution failed', { name, error: error.message });

    await logAction(agentId, agentName, name, 'Error', { args }, error.message);

    return {
      success: false,
      error: {
        code: 'TOOL_ERROR',
        message: error.message,
        details: { name, args },
      },
    };
  }
}
