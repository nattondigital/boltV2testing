/**
 * Appointment resources for MCP server
 * Provides read-only access to appointment data
 */

import { getSupabase } from '../shared/supabase-client.js';
import { createLogger } from '../shared/logger.js';
import type { Appointment, AppointmentStatistics } from '../shared/types.js';

const logger = createLogger('AppointmentResources');

export const resources = [
  {
    uri: 'appointments://all',
    name: 'All Appointments',
    description: 'Complete list of all appointments',
    mimeType: 'application/json',
  },
  {
    uri: 'appointments://today',
    name: 'Today\'s Appointments',
    description: 'Appointments scheduled for today',
    mimeType: 'application/json',
  },
  {
    uri: 'appointments://upcoming',
    name: 'Upcoming Appointments',
    description: 'Future appointments (next 30 days)',
    mimeType: 'application/json',
  },
  {
    uri: 'appointments://this-week',
    name: 'This Week Appointments',
    description: 'Appointments for the current week',
    mimeType: 'application/json',
  },
  {
    uri: 'appointments://confirmed',
    name: 'Confirmed Appointments',
    description: 'Appointments with Confirmed status',
    mimeType: 'application/json',
  },
  {
    uri: 'appointments://pending',
    name: 'Pending Appointments',
    description: 'Appointments with Scheduled status',
    mimeType: 'application/json',
  },
  {
    uri: 'appointments://statistics',
    name: 'Appointment Statistics',
    description: 'Aggregate statistics about appointments',
    mimeType: 'application/json',
  },
  {
    uri: 'appointments://appointment/{id}',
    name: 'Individual Appointment',
    description: 'Get details of a specific appointment by ID',
    mimeType: 'application/json',
  },
];

export async function readResource(uri: string): Promise<{ contents: { uri: string; mimeType: string; text: string }[] }> {
  logger.info('Reading resource', { uri });

  const supabase = getSupabase();

  try {
    if (uri === 'appointments://all') {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (error) throw error;

      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ appointments: data || [], count: data?.length || 0 }, null, 2),
        }],
      };
    }

    if (uri === 'appointments://today') {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('appointment_date', today)
        .order('appointment_time', { ascending: true });

      if (error) throw error;

      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ appointments: data || [], count: data?.length || 0 }, null, 2),
        }],
      };
    }

    if (uri === 'appointments://upcoming') {
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .gte('appointment_date', today)
        .lte('appointment_date', thirtyDaysFromNow)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (error) throw error;

      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ appointments: data || [], count: data?.length || 0 }, null, 2),
        }],
      };
    }

    if (uri === 'appointments://this-week') {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .gte('appointment_date', startOfWeek.toISOString().split('T')[0])
        .lte('appointment_date', endOfWeek.toISOString().split('T')[0])
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (error) throw error;

      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ appointments: data || [], count: data?.length || 0 }, null, 2),
        }],
      };
    }

    if (uri === 'appointments://confirmed') {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('status', 'Confirmed')
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (error) throw error;

      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ appointments: data || [], count: data?.length || 0 }, null, 2),
        }],
      };
    }

    if (uri === 'appointments://pending') {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('status', 'Scheduled')
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (error) throw error;

      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ appointments: data || [], count: data?.length || 0 }, null, 2),
        }],
      };
    }

    if (uri === 'appointments://statistics') {
      const { data: allAppointments, error } = await supabase
        .from('appointments')
        .select('status, meeting_type, appointment_date, duration_minutes');

      if (error) throw error;

      const today = new Date().toISOString().split('T')[0];
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      const statistics: AppointmentStatistics = {
        total: allAppointments?.length || 0,
        by_status: {
          Scheduled: 0,
          Confirmed: 0,
          Completed: 0,
          'No-Show': 0,
        },
        by_meeting_type: {
          'In-Person': 0,
          'Phone Call': 0,
          'Video Call': 0,
        },
        today: 0,
        this_week: 0,
        this_month: 0,
        upcoming: 0,
        past_due: 0,
        average_duration: 0,
        no_show_rate: 0,
      };

      let totalDuration = 0;
      let completedCount = 0;
      let noShowCount = 0;

      allAppointments?.forEach((apt: any) => {
        if (apt.status) {
          statistics.by_status[apt.status as keyof typeof statistics.by_status] =
            (statistics.by_status[apt.status as keyof typeof statistics.by_status] || 0) + 1;
        }

        if (apt.meeting_type) {
          statistics.by_meeting_type[apt.meeting_type as keyof typeof statistics.by_meeting_type] =
            (statistics.by_meeting_type[apt.meeting_type as keyof typeof statistics.by_meeting_type] || 0) + 1;
        }

        if (apt.appointment_date === today) {
          statistics.today++;
        }

        if (apt.appointment_date >= startOfWeek.toISOString().split('T')[0]) {
          statistics.this_week++;
        }

        if (apt.appointment_date >= startOfMonth.toISOString().split('T')[0]) {
          statistics.this_month++;
        }

        if (apt.appointment_date >= today) {
          statistics.upcoming++;
        } else if (apt.status === 'Scheduled' || apt.status === 'Confirmed') {
          statistics.past_due++;
        }

        if (apt.duration_minutes) {
          totalDuration += apt.duration_minutes;
        }

        if (apt.status === 'Completed') completedCount++;
        if (apt.status === 'No-Show') noShowCount++;
      });

      statistics.average_duration = allAppointments?.length
        ? Math.round(totalDuration / allAppointments.length)
        : 0;

      statistics.no_show_rate = (completedCount + noShowCount) > 0
        ? Math.round((noShowCount / (completedCount + noShowCount)) * 100)
        : 0;

      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(statistics, null, 2),
        }],
      };
    }

    if (uri.startsWith('appointments://appointment/')) {
      const appointmentId = uri.replace('appointments://appointment/', '');

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(`Appointment not found: ${appointmentId}`);
      }

      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2),
        }],
      };
    }

    throw new Error(`Unknown resource URI: ${uri}`);
  } catch (error: any) {
    logger.error('Error reading resource', { uri, error: error.message });
    throw error;
  }
}
