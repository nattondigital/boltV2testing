/**
 * Shared type definitions for MCP servers
 */

export interface Task {
  id: string;
  task_id: string;
  title: string;
  description: string | null;
  status: 'To Do' | 'In Progress' | 'Completed' | 'Cancelled';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  due_date: string | null;
  due_time: string | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  supporting_docs: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface TaskFilters {
  status?: string;
  priority?: string;
  assigned_to?: string;
  contact_id?: string;
  due_date_from?: string;
  due_date_to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface TaskStatistics {
  total: number;
  by_status: {
    'To Do': number;
    'In Progress': number;
    'Completed': number;
    'Cancelled': number;
  };
  by_priority: {
    'Low': number;
    'Medium': number;
    'High': number;
    'Urgent': number;
  };
  overdue: number;
  due_today: number;
  due_this_week: number;
}

export interface AgentPermissions {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface AIAgent {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  model: string;
  created_at: string;
  updated_at: string;
}

export interface AIAgentPermission {
  agent_id: string;
  permissions: Record<string, AgentPermissions>;
}

export interface AIAgentLog {
  id: string;
  agent_id: string;
  agent_name: string;
  module: string;
  action: string;
  result: 'Success' | 'Error';
  error_message: string | null;
  user_context: string;
  details: Record<string, any> | null;
  created_at: string;
}

export interface MCPError {
  code: string;
  message: string;
  details?: any;
}

export interface MCPResponse<T = any> {
  success: boolean;
  data?: T;
  error?: MCPError;
}

export interface Contact {
  id: string;
  contact_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  education_level: string | null;
  profession: string | null;
  experience: string | null;
  business_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gst_number: string | null;
  contact_type: string;
  status: string;
  notes: string | null;
  last_contacted: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ContactFilters {
  contact_type?: string;
  status?: string;
  city?: string;
  state?: string;
  search?: string;
  tags?: string[];
  created_from?: string;
  created_to?: string;
  limit?: number;
  offset?: number;
}

export interface ContactStatistics {
  total: number;
  by_type: {
    Customer: number;
    Lead: number;
    Vendor: number;
    individual: number;
  };
  by_status: {
    Active: number;
    Inactive: number;
  };
  by_city: Record<string, number>;
  by_state: Record<string, number>;
  recent_contacts: number;
  with_email: number;
  with_phone: number;
}

export interface Lead {
  id: string;
  lead_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  interest: string;
  stage: string;
  owner: string;
  address: string | null;
  company: string | null;
  notes: string | null;
  last_contact: string | null;
  lead_score: number;
  created_at: string;
  updated_at: string;
  affiliate_id: string | null;
  contact_id: string | null;
  pipeline_id: string | null;
}

export interface LeadFilters {
  stage?: string;
  interest?: string;
  source?: string;
  owner?: string;
  pipeline_id?: string;
  lead_score_min?: number;
  lead_score_max?: number;
  search?: string;
  created_from?: string;
  created_to?: string;
  limit?: number;
  offset?: number;
}

export interface LeadStatistics {
  total: number;
  by_stage: Record<string, number>;
  by_interest: {
    Hot: number;
    Warm: number;
    Cold: number;
  };
  by_source: Record<string, number>;
  by_owner: Record<string, number>;
  average_score: number;
  high_score_leads: number;
  recent_leads: number;
  with_email: number;
  with_phone: number;
  contacted_recently: number;
}

export interface Appointment {
  id: string;
  appointment_id: string;
  title: string;
  contact_id: string | null;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  location: string | null;
  meeting_type: string;
  status: string;
  purpose: string;
  notes: string | null;
  reminder_sent: boolean;
  assigned_to: string | null;
  calendar_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentFilters {
  status?: string;
  meeting_type?: string;
  contact_id?: string;
  assigned_to?: string;
  calendar_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AppointmentStatistics {
  total: number;
  by_status: {
    Scheduled: number;
    Confirmed: number;
    Completed: number;
    'No-Show': number;
  };
  by_meeting_type: {
    'In-Person': number;
    'Phone Call': number;
    'Video Call': number;
  };
  today: number;
  this_week: number;
  this_month: number;
  upcoming: number;
  past_due: number;
  average_duration: number;
  no_show_rate: number;
}
