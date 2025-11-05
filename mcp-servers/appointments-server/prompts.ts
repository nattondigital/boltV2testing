/**
 * Appointment prompts for MCP server
 * Provides context-aware templates for AI interactions
 */

import { getSupabase } from '../shared/supabase-client.js';
import { createLogger } from '../shared/logger.js';

const logger = createLogger('AppointmentPrompts');

export const prompts = [
  {
    name: 'appointment_summary',
    description: 'Generate a comprehensive summary of appointments with statistics',
    arguments: [
      {
        name: 'include_today',
        description: 'Whether to include today\'s appointments list',
        required: false,
      },
    ],
  },
  {
    name: 'scheduling_best_practices',
    description: 'Best practices for effective appointment scheduling and management',
    arguments: [],
  },
  {
    name: 'reminder_strategies',
    description: 'Strategies for appointment reminders and reducing no-shows',
    arguments: [],
  },
  {
    name: 'calendar_management',
    description: 'Tips for effective calendar and time management',
    arguments: [],
  },
  {
    name: 'get_appointment_by_id',
    description: 'Instructions for retrieving a specific appointment by its ID',
    arguments: [
      {
        name: 'appointment_id',
        description: 'The appointment ID to retrieve',
        required: true,
      },
    ],
  },
];

export async function getPrompt(name: string, args: any = {}): Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }> {
  logger.info('Getting prompt', { name, args });

  const supabase = getSupabase();

  try {
    if (name === 'appointment_summary') {
      const { data: allAppointments } = await supabase.from('appointments').select('*');

      const today = new Date().toISOString().split('T')[0];
      const todayAppointments = allAppointments?.filter((a: any) => a.appointment_date === today) || [];
      const upcoming = allAppointments?.filter((a: any) => a.appointment_date >= today) || [];
      const scheduled = allAppointments?.filter((a: any) => a.status === 'Scheduled') || [];
      const confirmed = allAppointments?.filter((a: any) => a.status === 'Confirmed') || [];
      const completed = allAppointments?.filter((a: any) => a.status === 'Completed') || [];
      const noShow = allAppointments?.filter((a: any) => a.status === 'No-Show') || [];

      let summary = `# Appointment Management Summary\n\n`;
      summary += `## Overview\n`;
      summary += `- **Total Appointments**: ${allAppointments?.length || 0}\n`;
      summary += `- **Today's Appointments**: ${todayAppointments.length}\n`;
      summary += `- **Upcoming**: ${upcoming.length}\n\n`;

      summary += `## Status Breakdown\n`;
      summary += `- **Scheduled**: ${scheduled.length}\n`;
      summary += `- **Confirmed**: ${confirmed.length}\n`;
      summary += `- **Completed**: ${completed.length}\n`;
      summary += `- **No-Show**: ${noShow.length}\n\n`;

      const noShowRate = (completed.length + noShow.length) > 0
        ? Math.round((noShow.length / (completed.length + noShow.length)) * 100)
        : 0;

      summary += `## Performance Metrics\n`;
      summary += `- **No-Show Rate**: ${noShowRate}%\n`;

      const meetingTypes = allAppointments?.reduce((acc: any, apt: any) => {
        if (apt.meeting_type) {
          acc[apt.meeting_type] = (acc[apt.meeting_type] || 0) + 1;
        }
        return acc;
      }, {});

      if (meetingTypes && Object.keys(meetingTypes).length > 0) {
        summary += `\n## Meeting Types\n`;
        Object.entries(meetingTypes).forEach(([type, count]: any) => {
          summary += `- **${type}**: ${count} appointments\n`;
        });
        summary += `\n`;
      }

      if (args.include_today !== false && todayAppointments.length > 0) {
        summary += `## 📅 Today's Schedule\n\n`;
        todayAppointments
          .sort((a: any, b: any) => a.appointment_time.localeCompare(b.appointment_time))
          .forEach((apt: any) => {
            summary += `- **${apt.appointment_time}** - ${apt.title}`;
            summary += ` (${apt.contact_name}, ${apt.meeting_type})`;
            if (apt.status !== 'Scheduled') summary += ` - *${apt.status}*`;
            summary += `\n`;
          });
        summary += `\n`;
      }

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: summary,
            },
          },
        ],
      };
    }

    if (name === 'scheduling_best_practices') {
      const guide = `# Appointment Scheduling Best Practices

## Pre-Scheduling

### 1. Calendar Preparation
- Block out unavailable time slots
- Set buffer time between appointments
- Reserve time for breaks and preparation
- Mark recurring commitments
- Account for travel time (in-person meetings)

### 2. Appointment Types
Define clear categories:
- **Sales Calls**: Product demos, proposals
- **Consultations**: Discovery, assessment calls
- **Follow-ups**: Post-sale check-ins
- **Internal**: Team meetings, planning
- **Support**: Customer service, troubleshooting

### 3. Duration Guidelines
Standard durations by type:
- Quick calls: 15 minutes
- Standard meetings: 30 minutes
- Consultations: 45-60 minutes
- Workshops/training: 90-120 minutes
- Buffer time: 5-10 minutes between

## During Scheduling

### 1. Information Collection
Always capture:
- Full name and contact details
- Phone number (required)
- Email address
- Purpose of meeting
- Preferred meeting type
- Any special requirements

### 2. Confirmation Process
1. Send immediate confirmation
2. Include all appointment details
3. Provide calendar invite
4. Share meeting link (video calls)
5. Give clear location (in-person)
6. Set expectations on duration

### 3. Scheduling Etiquette
- Offer multiple time options
- Respect timezone differences
- Allow reschedule flexibility
- Be clear about cancellation policy
- Confirm 24-48 hours before

## Appointment Management

### 1. Status Tracking
Maintain accurate status:
- **Scheduled**: Initial booking
- **Confirmed**: Attendee confirmed
- **Completed**: Meeting finished
- **No-Show**: Attendee missed
- **Cancelled**: Appointment cancelled
- **Rescheduled**: New time set

### 2. Follow-up Protocol
After scheduling:
- Send confirmation email immediately
- Calendar invite with details
- Reminder 24 hours before
- Reminder 1 hour before (optional)
- Post-meeting follow-up

### 3. Documentation
Record essential details:
- Meeting notes
- Action items
- Next steps
- Follow-up requirements
- Outcomes and decisions

## Reducing No-Shows

### 1. Multiple Reminders
- Email confirmation (immediate)
- SMS reminder (24 hours)
- Email reminder (24 hours)
- SMS reminder (2 hours)
- Call for high-value appointments

### 2. Easy Rescheduling
- Provide self-service option
- Make it easy to reschedule
- No penalty for advance notice
- Clear cancellation link
- Simple process

### 3. Value Communication
Remind them of:
- What they'll gain
- Problems you'll solve
- Preparation needed
- Time investment value
- Next steps after meeting

### 4. Confirmation Requirements
- Request explicit confirmation
- Use two-way communication
- Ask them to respond
- Calendar acceptance tracking
- Personal touch for VIPs

## Technology Tips

### 1. Calendar Integration
- Sync across all devices
- Use calendar sharing
- Set up automatic reminders
- Enable availability checking
- Block personal time

### 2. Booking Systems
Features to use:
- Online booking forms
- Real-time availability
- Automatic confirmations
- Buffer time management
- Timezone detection

### 3. Communication Tools
- Email templates
- SMS automation
- Video call links
- Calendar invites
- Reminder systems

## Common Mistakes to Avoid

### Don'ts
✗ Back-to-back scheduling
✗ No buffer time
✗ Unclear meeting purpose
✗ Missing contact details
✗ No confirmation sent
✗ Single reminder only
✗ No rescheduling option
✗ Forgetting timezones

### Do's
✓ Strategic time blocking
✓ Built-in buffers
✓ Clear agendas
✓ Complete information
✓ Immediate confirmation
✓ Multiple reminders
✓ Easy rescheduling
✓ Timezone awareness

## Meeting Types Best Practices

### In-Person Meetings
- Clear address and directions
- Parking information
- Building access details
- Contact person info
- Backup phone number

### Phone Calls
- Who calls whom
- Backup number
- Best number to reach
- Call time confirmation
- Duration expectation

### Video Calls
- Meeting link in advance
- Platform requirements
- Test connection beforehand
- Backup contact method
- Screen share needs

## Time Management

### Optimal Scheduling
- Peak productivity hours first
- Group similar appointments
- Batch admin time
- Protect deep work time
- Allow catch-up time

### Weekly Planning
- Review calendar Sunday/Monday
- Identify conflicts early
- Prepare materials ahead
- Block preparation time
- Plan follow-ups

### Daily Preparation
- Review tomorrow's schedule
- Prepare materials
- Confirm appointments
- Check location/links
- Set reminders

## Metrics to Track

Monitor these KPIs:
- No-show rate
- Cancellation rate
- Reschedule rate
- Average duration
- Time utilization
- Meeting outcomes
- Client satisfaction
- Revenue per appointment
`;

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: guide,
            },
          },
        ],
      };
    }

    if (name === 'reminder_strategies') {
      const guide = `# Appointment Reminder Strategies

## Why Reminders Matter

- Reduce no-shows by 30-50%
- Improve attendance rates
- Better time management
- Increase revenue
- Enhance customer experience
- Build professional reputation

## Multi-Channel Approach

### Email Reminders
**Confirmation Email (Immediate)**
- All appointment details
- Calendar invite attachment
- Meeting purpose
- Preparation instructions
- Contact information

**24-Hour Reminder**
- Subject: "Reminder: [Meeting Title] Tomorrow"
- Date, time, duration
- Location/meeting link
- Purpose recap
- Reschedule link

**2-Hour Reminder** (Optional)
- Brief reminder
- Quick details
- Meeting link
- Contact number

### SMS Reminders
**Advantages:**
- High open rates (98%)
- Immediate delivery
- Mobile-friendly
- Short and direct

**Best Times:**
- 24 hours before
- 2-4 hours before
- 30 minutes before (VIP only)

**Sample SMS:**
"Hi [Name], reminder: [Meeting Title] tomorrow at [Time]. [Location/Link]. Reply C to confirm or R to reschedule."

### Phone Call Reminders
**When to Use:**
- High-value appointments
- VIP clients
- History of no-shows
- First-time appointments
- Complex meetings

**Call Script:**
1. Identify yourself
2. Confirm appointment
3. Verify they can attend
4. Offer reschedule if needed
5. Answer questions

### App/Push Notifications
- Calendar integration
- CRM notifications
- Booking app alerts
- Native phone alerts
- Smart assistant reminders

## Timing Strategy

### The 3-2-1 System
**3 Days Before:**
- Confirmation email
- Calendar invite
- Meeting preparation

**2 Days Before:**
- Email reminder
- Value reinforcement
- Questions welcome

**1 Day Before:**
- SMS reminder
- Final confirmation
- Last-chance reschedule

### Alternative: 24-2-15
**24 Hours:**
- Email reminder
- SMS reminder

**2 Hours:**
- SMS reminder
- Meeting link

**15 Minutes:**
- Final SMS (VIP only)

## Reminder Content Elements

### Must Include
1. **Who**: Your name/company
2. **What**: Meeting purpose
3. **When**: Date and time
4. **Where**: Location or link
5. **Duration**: How long
6. **Contact**: How to reach you

### Should Include
- Reschedule link
- Confirmation option
- Preparation items
- Parking/access info
- Cancellation policy

### Nice to Have
- What they'll gain
- Materials to bring
- Dress code (if relevant)
- Pre-meeting questionnaire
- Related resources

## Confirmation Requests

### Two-Way Communication
Request active confirmation:
- "Reply Y to confirm"
- "Click here to confirm"
- "Accept calendar invite"
- "Call us to confirm"

### Benefits
- Engagement indicator
- Early warning of no-shows
- Opportunity to reschedule
- Shows commitment
- Reduces last-minute cancellations

## Personalization

### Basic
- Use their name
- Reference previous meetings
- Mention specific topics
- Include relevant details

### Advanced
- Meeting history
- Personal preferences
- Communication style
- Timezone awareness
- Industry-specific language

## Automation Best Practices

### What to Automate
✓ Confirmation emails
✓ Standard reminders
✓ Calendar invites
✓ Follow-up emails
✓ Reschedule links

### Keep Manual
✓ VIP communications
✓ Complex appointments
✓ Special circumstances
✓ Problem resolution
✓ Personal touches

## Handling Responses

### Confirmation
- Thank them
- Share additional details
- Offer help if needed
- Send final reminder

### Reschedule Request
- Respond immediately
- Offer alternatives
- Be flexible
- Confirm new time
- Update all systems

### No Response
- Additional reminder
- Try different channel
- Phone call backup
- Mark as unconfirmed
- Prepare for no-show

## No-Show Prevention

### Pre-Appointment
1. Multiple touchpoints
2. Clear value communication
3. Easy rescheduling
4. Personal connection
5. Confirm 24 hours before

### Day of Appointment
1. Morning reminder
2. 2-hour reminder
3. Personal call (important)
4. Be ready early
5. Have backup plan

### Post No-Show
1. Reach out same day
2. Understand reason
3. Offer reschedule
4. Learn and improve
5. Update records

## Technology Solutions

### Reminder Software
Features to look for:
- Multi-channel support
- Automatic scheduling
- Customizable templates
- Two-way messaging
- Analytics tracking
- Calendar integration

### Popular Tools
- Calendar apps
- CRM systems
- Booking platforms
- SMS services
- Email automation
- WhatsApp Business

## Metrics to Monitor

Track effectiveness:
- Reminder delivery rate
- Open/read rates
- Confirmation rate
- No-show rate
- Reschedule rate
- Channel effectiveness
- Time-to-confirm
- Cost per reminder

## Testing and Optimization

### A/B Testing
Test variations:
- Reminder timing
- Message content
- Communication channel
- Tone and style
- Call-to-action
- Personalization level

### Continuous Improvement
- Review metrics monthly
- Survey no-shows
- Ask for feedback
- Update templates
- Refine timing
- Try new channels

## Special Considerations

### First-Time Clients
- Extra confirmation step
- More detailed reminders
- Personal phone call
- Clear expectations
- Welcome message

### Repeat Clients
- Less frequent reminders
- More casual tone
- Reference history
- Loyalty appreciation
- Streamlined process

### High-Value Appointments
- Personal outreach
- Multiple reminders
- Phone confirmation
- Executive attention
- Special preparation

## Best Practices Summary

### Do's
✓ Use multiple channels
✓ Time reminders strategically
✓ Personalize messages
✓ Make rescheduling easy
✓ Request confirmation
✓ Track and optimize
✓ Be consistent

### Don'ts
✗ Over-remind (spam)
✗ Generic messages only
✗ Single channel dependency
✗ Ignore no-responses
✗ Make changes hard
✗ Forget timezone
✗ Skip follow-up
`;

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: guide,
            },
          },
        ],
      };
    }

    if (name === 'calendar_management') {
      const guide = `# Calendar and Time Management Guide

## Calendar Setup

### 1. Structure Your Calendar
**Time Blocks:**
- Deep work time (2-3 hour blocks)
- Meeting windows (specific hours)
- Buffer time (between meetings)
- Admin/email time (daily blocks)
- Break time (lunch, short breaks)
- Planning time (weekly review)

**Color Coding:**
- Red: Urgent/High priority
- Blue: Regular appointments
- Green: Personal/breaks
- Yellow: Internal meetings
- Purple: Preparation time
- Gray: Buffer/flex time

### 2. Multiple Calendars
Separate calendars for:
- Work appointments
- Personal commitments
- Team events
- Blocked/unavailable time
- Out of office
- Shared calendars

## Time Blocking Strategies

### The Pomodoro Technique
- 25 minutes focused work
- 5-minute break
- Repeat 4 times
- 15-30 minute longer break
- Use for deep work blocks

### Time Boxing
- Assign specific time to tasks
- Set hard start and end times
- No task bleeding
- Honor the box
- Move on when time's up

### Theme Days
- Monday: Planning/Strategy
- Tuesday: Meetings
- Wednesday: Deep work
- Thursday: Collaboration
- Friday: Review/Admin

## Meeting Management

### Before Scheduling
Questions to ask:
- Is this meeting necessary?
- Can it be an email?
- Who really needs to attend?
- What's the objective?
- How long is actually needed?

### Meeting Time Optimization
- Default to 25/50 min (not 30/60)
- Start on time always
- End early if possible
- Have clear agenda
- Assign action items
- Send follow-up notes

### Meeting-Free Time
Protect these periods:
- Early mornings (focus time)
- After lunch (energy dip)
- End of day (wrap-up)
- Specific days (deep work)
- Friday afternoons (planning)

## Energy Management

### Peak Performance Times
Identify your:
- High energy hours
- Creative peak times
- Decision-making best times
- Low energy periods
- Social energy availability

### Schedule Accordingly
- Hard tasks: Peak energy
- Meetings: Mid-energy
- Admin: Low energy
- Creative: Peak creative time
- Strategic: High cognition time

## Buffer Time Strategy

### Why Buffers Matter
- Prevents back-to-back stress
- Allows for overruns
- Travel time (in-person)
- Preparation time
- Mental reset
- Handle emergencies

### Buffer Guidelines
- 10-15 min between appointments
- 30 min before important meetings
- 5 min after each hour
- Full hour between time zones
- 15 min commute buffer

## Availability Management

### Office Hours
Set specific times for:
- Scheduled appointments
- Drop-in availability
- Phone calls
- Email responses
- Team collaboration
- Personal time

### Protect Your Time
- Block focus time
- Set expectations
- Use "busy" strategically
- Share availability
- Decline low-value meetings
- Batch similar activities

## Calendar Hygiene

### Daily Maintenance
- Review tomorrow's schedule
- Prepare for meetings
- Block focus time
- Update status changes
- Clear completed items
- Note action items

### Weekly Review
- Review past week
- Plan upcoming week
- Identify conflicts
- Adjust as needed
- Block important time
- Schedule priorities first

### Monthly Planning
- Review goals progress
- Plan major initiatives
- Block strategic time
- Schedule reviews
- Update recurring items
- Align with team

## Technology Best Practices

### Calendar Tools
Essential features:
- Multi-device sync
- Sharing capabilities
- Reminder system
- Time zone support
- Color coding
- Search function

### Integrations
Connect with:
- Email system
- CRM platform
- Project management
- Video conferencing
- Scheduling tools
- Communication apps

### Automation
Automate:
- Meeting reminders
- Buffer time creation
- Recurring appointments
- Follow-up scheduling
- Calendar invites
- Status updates

## Prioritization Framework

### Eisenhower Matrix
**Urgent & Important:** Do now
**Important, Not Urgent:** Schedule
**Urgent, Not Important:** Delegate
**Neither:** Eliminate

### Time Allocation
- 60% Scheduled appointments
- 20% Flex/buffer time
- 10% Planning/admin
- 10% Emergency reserve

## Common Calendar Mistakes

### Mistakes to Avoid
✗ No buffer time
✗ Back-to-back meetings
✗ Ignoring energy levels
✗ Always saying yes
✗ No protection for focus time
✗ Unrealistic scheduling
✗ Forgetting preparation time
✗ No review process

### Best Practices
✓ Strategic blocking
✓ Realistic timing
✓ Energy-aware scheduling
✓ Selective acceptance
✓ Protected focus time
✓ Built-in flexibility
✓ Preparation time
✓ Regular reviews

## Time Audit

### Track Your Time
For one week, log:
- Actual appointment times
- Preparation needed
- Buffer usage
- Wasted time
- High-value activities
- Energy patterns

### Analyze and Adjust
- Which meetings matter?
- Where's time wasted?
- When are you most productive?
- What can be eliminated?
- What needs more time?
- How to optimize?

## Communication Guidelines

### Setting Expectations
Be clear about:
- Your availability
- Response times
- Booking process
- Cancellation policy
- Preferred contact method
- Emergency procedures

### Calendar Sharing
Decide what to share:
- Availability only
- Meeting titles
- Full details
- Team calendar
- Public calendar

## Work-Life Balance

### Boundaries
Set clear:
- Work hours
- Off-hours
- Weekend policy
- Vacation time
- Emergency only
- Family time

### Personal Time
Block calendar for:
- Exercise
- Family commitments
- Personal development
- Hobbies
- Rest/recovery
- Social activities

## Productivity Tips

### The 2-Minute Rule
If it takes less than 2 minutes:
- Do it now
- Don't schedule it
- Clear immediately
- Maintain momentum

### Batch Processing
Group similar tasks:
- All calls together
- Email in blocks
- Admin work batched
- Similar meetings
- Location-based tasks

### Say No Gracefully
When to decline:
- Not aligned with goals
- Can be handled another way
- Someone else better suited
- Too many commitments
- Low value activity
- Conflicts with priorities

## Success Metrics

Track these indicators:
- Meeting attendance rate
- On-time start/finish
- Prep time adequacy
- Focus time protected
- Goals achieved
- Stress levels
- Work-life balance
- Energy management
`;

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: guide,
            },
          },
        ],
      };
    }

    if (name === 'get_appointment_by_id') {
      const appointmentId = args.appointment_id;
      if (!appointmentId) {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: '# How to Retrieve an Appointment by ID\n\nTo get details of a specific appointment, use the `get_appointments` tool with the `id` parameter:\n\n```json\n{\n  "id": "uuid-here"\n}\n```\n\nOr use the appointment_id parameter:\n\n```json\n{\n  "appointment_id": "APT-1001"\n}\n```\n\nThis will return the complete appointment details including contact information, date, time, location, and status.',
              },
            },
          ],
        };
      }

      const { data: appointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId);

      if (!appointments || appointments.length === 0) {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `# Appointment Not Found\n\nAppointment with ID **${appointmentId}** was not found in the system.\n\nPlease verify the appointment ID and try again.`,
              },
            },
          ],
        };
      }

      const apt = appointments[0];
      let details = `# Appointment Details: ${apt.appointment_id}\n\n`;
      details += `## ${apt.title}\n\n`;

      details += `### Date & Time\n`;
      details += `- **Date**: ${apt.appointment_date}\n`;
      details += `- **Time**: ${apt.appointment_time}\n`;
      details += `- **Duration**: ${apt.duration_minutes} minutes\n`;
      details += `- **Status**: ${apt.status}\n\n`;

      details += `### Contact Information\n`;
      details += `- **Name**: ${apt.contact_name}\n`;
      details += `- **Phone**: ${apt.contact_phone}\n`;
      if (apt.contact_email) details += `- **Email**: ${apt.contact_email}\n`;
      details += `\n`;

      details += `### Meeting Details\n`;
      details += `- **Type**: ${apt.meeting_type}\n`;
      if (apt.location) details += `- **Location**: ${apt.location}\n`;
      details += `- **Purpose**: ${apt.purpose}\n\n`;

      if (apt.notes) {
        details += `### Notes\n${apt.notes}\n\n`;
      }

      details += `### Additional Information\n`;
      details += `- **Reminder Sent**: ${apt.reminder_sent ? 'Yes' : 'No'}\n`;
      details += `- **Created**: ${apt.created_at}\n`;
      details += `- **Last Updated**: ${apt.updated_at}\n`;

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: details,
            },
          },
        ],
      };
    }

    throw new Error(`Unknown prompt: ${name}`);
  } catch (error: any) {
    logger.error('Error generating prompt', { name, error: error.message });
    throw error;
  }
}
