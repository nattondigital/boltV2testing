# Appointments MCP Server

A fully-featured MCP (Model Context Protocol) server for managing appointments and calendar scheduling in the CRM system.

## Features

### Tools (4)
1. **get_appointments** - Retrieve appointments with advanced filtering
   - Filter by: status, meeting_type, contact, assigned user, calendar, date range
   - Search across: title, contact name, purpose, notes
   - Pagination support

2. **create_appointment** - Create new appointments
   - Required: title, contact_name, contact_phone, appointment_date, appointment_time, meeting_type, purpose
   - Optional: All other appointment fields
   - Auto-generates appointment_id

3. **update_appointment** - Update existing appointments
   - Update any field including status, reminder_sent
   - Tracks updated_at automatically

4. **delete_appointment** - Remove appointments
   - Soft delete recommended in production

### Resources (8)
1. **appointments://all** - All appointments
2. **appointments://today** - Today's appointments
3. **appointments://upcoming** - Next 30 days
4. **appointments://this-week** - Current week appointments
5. **appointments://confirmed** - Confirmed status
6. **appointments://pending** - Scheduled status
7. **appointments://statistics** - Aggregate statistics
8. **appointments://appointment/{id}** - Individual appointment by ID

### Prompts (5)
1. **appointment_summary** - Comprehensive appointment overview with today's schedule
2. **scheduling_best_practices** - Complete scheduling and management guide
3. **reminder_strategies** - Multi-channel reminder system for reducing no-shows
4. **calendar_management** - Time blocking, energy management, and productivity tips
5. **get_appointment_by_id** - Instructions for retrieving specific appointments

## Usage

### Running the Server
```bash
cd mcp-servers
npm run dev:appointments
```

### Configuration
The server uses environment variables from `.env`:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `MCP_SERVER_NAME` - Optional server name (default: crm-appointments-server)
- `MCP_SERVER_VERSION` - Optional version (default: 1.0.0)

## Database Schema

### appointments Table
- **id** (uuid) - Primary key
- **appointment_id** (text) - Human-readable ID (auto-generated)
- **title** (text) - Required
- **contact_id** (uuid) - FK to contacts_master
- **contact_name** (text) - Required
- **contact_phone** (text) - Required
- **contact_email** (text)
- **appointment_date** (date) - Required
- **appointment_time** (time) - Required
- **duration_minutes** (integer) - Default: 30
- **location** (text) - Address or video link
- **meeting_type** (text) - In-Person, Phone Call, Video Call (Required)
- **status** (text) - Scheduled, Confirmed, Completed, No-Show (Default: Scheduled)
- **purpose** (text) - Required
- **notes** (text)
- **reminder_sent** (boolean) - Default: false
- **assigned_to** (uuid) - FK to admin_users
- **calendar_id** (uuid) - FK to calendars
- **created_by** (uuid) - FK to admin_users
- **created_at** (timestamptz)
- **updated_at** (timestamptz)

## Permissions

The server integrates with the AI Agent permission system:
- **View** - Required for get_appointments
- **Create** - Required for create_appointment
- **Edit** - Required for update_appointment
- **Delete** - Required for delete_appointment

## Logging

All operations are logged to `ai_agent_logs` table with:
- Agent ID and name
- Module: "Appointments"
- Action performed
- Result (Success/Error)
- Details and error messages

## Security

- Permission validation on every operation
- Agent authentication required
- RLS policies enforced at database level
- Comprehensive audit trail

## Examples

### Get Today's Appointments
```json
{
  "name": "get_appointments",
  "arguments": {
    "date_from": "2025-11-05",
    "date_to": "2025-11-05"
  }
}
```

### Search by Contact Name
```json
{
  "name": "get_appointments",
  "arguments": {
    "search": "john",
    "status": "Scheduled"
  }
}
```

### Create New Appointment
```json
{
  "name": "create_appointment",
  "arguments": {
    "title": "Product Demo",
    "contact_name": "John Doe",
    "contact_phone": "+919876543210",
    "contact_email": "john@example.com",
    "appointment_date": "2025-11-10",
    "appointment_time": "14:00",
    "duration_minutes": 60,
    "meeting_type": "Video Call",
    "location": "https://meet.google.com/abc-defg-hij",
    "purpose": "Demonstrate premium features",
    "notes": "Interested in enterprise plan"
  }
}
```

### Update Appointment Status
```json
{
  "name": "update_appointment",
  "arguments": {
    "id": "uuid-here",
    "status": "Confirmed",
    "reminder_sent": true,
    "notes": "Client confirmed via email"
  }
}
```

### Filter by Date Range
```json
{
  "name": "get_appointments",
  "arguments": {
    "date_from": "2025-11-05",
    "date_to": "2025-11-12",
    "status": "Confirmed",
    "meeting_type": "Video Call"
  }
}
```

## Best Practices

### Scheduling
- Collect complete contact information
- Set realistic duration times
- Include buffer time between meetings
- Send immediate confirmation
- Provide clear meeting instructions

### Reminders
- Send confirmation immediately
- Reminder 24 hours before
- Reminder 2 hours before (optional)
- Use multiple channels (email, SMS)
- Request explicit confirmation

### No-Show Prevention
- Multiple reminder touchpoints
- Clear value communication
- Easy rescheduling option
- Personal follow-up for VIPs
- Track no-show patterns

### Calendar Management
- Use time blocking strategies
- Respect energy management
- Protect focus time
- Build in buffer periods
- Regular calendar reviews

## Statistics

The server tracks comprehensive metrics:
- Total appointments
- Status breakdown
- Meeting type distribution
- Today/week/month counts
- Upcoming appointments
- Past due appointments
- Average duration
- No-show rate

## Architecture

The server follows the modular MCP pattern:
- **index.ts** - Server setup and request routing
- **tools.ts** - CRUD operations implementation
- **resources.ts** - Read-only data access
- **prompts.ts** - Scheduling and time management guidance
- **shared/** - Reusable utilities (logger, permissions, types)

## Dependencies

- `@modelcontextprotocol/sdk` - MCP protocol
- `@supabase/supabase-js` - Database client
- `dotenv` - Environment configuration

## Integration

Works seamlessly with other CRM modules:
- Links to Contacts via contact_id
- Assigns to team members via assigned_to
- Organizes by calendar_id
- Tracks creator via created_by
- Syncs with Tasks and Leads

## Completed MCP Servers

1. ✅ Tasks Server
2. ✅ Contacts Server
3. ✅ Leads Server
4. ✅ Appointments Server

## Next Steps

Continue building additional module servers:
- Support Tickets Server
- Expenses Server
- Billing Server
- Products Server
- Team Server
