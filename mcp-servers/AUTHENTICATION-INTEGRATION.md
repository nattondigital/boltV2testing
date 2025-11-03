# MCP Server Authentication Integration

## Your Custom OTP Authentication System

Your CRM uses a **custom OTP-based authentication system** (not Supabase Auth). Here's how it integrates with the MCP server:

### Current Authentication Flow

```
1. User enters mobile number
   ↓
2. OTP generated and stored in otp_verifications table
   ↓
3. OTP sent via webhook to n8n
   ↓
4. User enters OTP
   ↓
5. OTP verified against otp_verifications table
   ↓
6. Session stored in localStorage (mobile + timestamp)
   ↓
7. User profile fetched from admin_users table (by phone)
```

### Database Tables Used

#### `admin_users`
```sql
- id (uuid) - Primary key
- email (text) - Email address
- phone (text) - Mobile number (used for authentication)
- full_name (text) - User's full name
- role (text) - Owner, Admin, Manager, Team Member
- department (text) - User's department
- status (text) - Active, Inactive, Suspended
- is_active (boolean) - Account status
- permissions (jsonb) - Module-level permissions
- last_login (timestamptz) - Last login time
```

#### `otp_verifications`
```sql
- id (uuid) - Primary key
- mobile (text) - Phone number
- otp (text) - 4-digit OTP code
- expires_at (timestamptz) - OTP expiration
- verified (boolean) - Verification status
- verified_at (timestamptz) - Verification time
```

### Session Management

**Storage**: localStorage
- `admin_mobile` - User's phone number
- `admin_auth_timestamp` - Login timestamp

**Duration**: 24 hours

**Validation**:
- Checked on app load
- Session expired if > 24 hours
- User profile fetched from `admin_users` by phone

## MCP Server Authentication

The MCP server **bypasses user authentication** by using the **service_role_key**, which has full database access regardless of RLS policies.

### Why Service Role Key?

1. **Server-Side Operation**: MCP server runs server-side, not in browser
2. **Agent Context**: Operations are performed by AI agents, not users
3. **Permission System**: Uses `ai_agent_permissions` table instead of user permissions
4. **Audit Trail**: All operations logged with agent ID in `ai_agent_logs`

### MCP Server Access Control

Instead of user authentication, the MCP server uses:

#### 1. Agent Permissions (`ai_agent_permissions`)

```sql
CREATE TABLE ai_agent_permissions (
  agent_id uuid REFERENCES ai_agents(id),
  permissions jsonb -- Module permissions for the agent
);
```

**Example permissions structure:**
```json
{
  "Tasks": {
    "can_view": true,
    "can_create": true,
    "can_edit": true,
    "can_delete": false
  },
  "Leads": {
    "can_view": true,
    "can_create": false,
    "can_edit": false,
    "can_delete": false
  }
}
```

#### 2. Permission Validation Flow

```
Client → MCP Server (with agent_id)
         ↓
Permission Validator → Check ai_agent_permissions table
         ↓
         ├─ Has Permission → Execute Operation
         │                   ↓
         │                   Log to ai_agent_logs
         │                   ↓
         │                   Return Result
         │
         └─ No Permission → Return "Permission Denied" Error
```

#### 3. Audit Logging (`ai_agent_logs`)

Every MCP operation is logged:

```sql
INSERT INTO ai_agent_logs (
  agent_id,
  agent_name,
  module,      -- "Tasks"
  action,      -- "create_task", "get_tasks", etc.
  result,      -- "Success" or "Error"
  user_context, -- "MCP Server"
  details      -- Operation details (what was created/updated)
);
```

## Integration with Frontend

### Current: Direct Function Calls

Your AI chat currently uses direct function calls:

```typescript
// In AIAgentChat.tsx
const functions = [
  {
    name: "create_task",
    function: async (args) => {
      // Direct database call
      const { data, error } = await supabase
        .from('tasks')
        .insert(args);
      return data;
    }
  }
];
```

### Future: MCP Integration

With MCP server integration:

```typescript
// Initialize MCP client
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const mcpClient = new Client({
  name: 'crm-chat-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

// Connect to MCP server
await mcpClient.connect(transport);

// Use MCP tools instead of direct functions
const result = await mcpClient.callTool({
  name: 'create_task',
  arguments: taskData
});
```

### Authentication Flow Comparison

#### Current System (User Authentication)
```
User Login (OTP)
  ↓
Session in localStorage
  ↓
Direct Database Calls (with anon_key)
  ↓
RLS checks admin_users.phone
```

#### MCP System (Agent Authentication)
```
AI Agent Registered
  ↓
Agent ID in ai_agents table
  ↓
Permissions in ai_agent_permissions
  ↓
MCP Server (with service_role_key)
  ↓
Permission Validator checks agent permissions
  ↓
Executes operation
  ↓
Logs to ai_agent_logs
```

## Security Considerations

### User Operations vs Agent Operations

**User Operations** (Current):
- Authenticated via OTP
- Access controlled by admin_users.permissions
- RLS policies check admin_users.phone
- Operations logged to module-specific triggers

**Agent Operations** (MCP):
- Authenticated via agent_id
- Access controlled by ai_agent_permissions
- No RLS (service_role_key bypasses)
- Operations logged to ai_agent_logs

### Best Practices

1. **Service Role Key Security**:
   - ✅ Store in `.env` file (server-side only)
   - ✅ Never expose in client code
   - ✅ Never commit to git
   - ✅ Rotate if compromised

2. **Agent Permission Management**:
   - ✅ Create agents with minimal required permissions
   - ✅ Review agent logs regularly
   - ✅ Disable agents that are no longer needed
   - ✅ Use different agents for different purposes

3. **Audit Trail**:
   - ✅ All MCP operations logged to `ai_agent_logs`
   - ✅ Review logs for suspicious activity
   - ✅ Set up alerts for failed permission checks
   - ✅ Monitor token usage and costs

## Linking User Sessions with Agent Operations

When a user interacts with an AI agent in the chat, you can link the operation to both:

1. **User Context**: Who initiated the chat?
   ```typescript
   // In chat component
   const userProfile = useAuth().userProfile;

   // Pass to MCP operation
   const result = await mcpClient.callTool({
     name: 'create_task',
     arguments: {
       ...taskData,
       created_by_name: userProfile.full_name,
       created_by_phone: userProfile.phone
     }
   });
   ```

2. **Agent Context**: Which AI agent performed the operation?
   ```typescript
   // Already handled by MCP server
   // AGENT_ID env variable identifies the agent
   ```

This creates a complete audit trail:
- **User**: John Doe (phone: 9876543210)
- **Agent**: Tasks Assistant (agent_id: abc-123)
- **Action**: Created task "Review Q4 Report"
- **Result**: Success

## Setup Checklist

To integrate MCP with your OTP authentication system:

### 1. Environment Configuration

```bash
# MCP Server .env
SUPABASE_URL=https://lddridmkphmckbjjlfxi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # NOT the anon key
AGENT_ID=your_agent_id  # From ai_agents table
```

### 2. Create AI Agent

```sql
-- Create an agent in your database
INSERT INTO ai_agents (name, description, status, model)
VALUES (
  'Tasks Assistant',
  'AI agent for task management operations',
  'active',
  'gpt-4'
);

-- Get the agent ID
SELECT id FROM ai_agents WHERE name = 'Tasks Assistant';
```

### 3. Configure Agent Permissions

```sql
-- Set permissions for the agent
INSERT INTO ai_agent_permissions (agent_id, permissions)
VALUES (
  'your-agent-id',
  '{
    "Tasks": {
      "can_view": true,
      "can_create": true,
      "can_edit": true,
      "can_delete": true
    }
  }'::jsonb
);
```

### 4. Test MCP Server

```bash
cd mcp-servers
npm run test:client
```

### 5. Integrate with Chat (Optional)

Update your AI chat component to use MCP client instead of direct Supabase calls.

## Common Questions

### Q: Can users authenticate directly with the MCP server?

**A**: No. The MCP server is designed for **AI agent operations**, not user operations. Users should continue using your OTP authentication system for direct CRM access.

### Q: How do I restrict what an AI agent can do?

**A**: Configure permissions in the `ai_agent_permissions` table. Each module has granular permissions (view, create, edit, delete).

### Q: Can I have multiple AI agents?

**A**: Yes! Create different agents with different permission sets:
- **Read-Only Agent**: Only view permissions
- **Task Manager Agent**: Full tasks permissions, no other modules
- **Full Admin Agent**: All permissions across all modules

### Q: How do I audit agent operations?

**A**: Query the `ai_agent_logs` table:

```sql
SELECT
  created_at,
  agent_name,
  module,
  action,
  result,
  details
FROM ai_agent_logs
WHERE agent_id = 'your-agent-id'
ORDER BY created_at DESC
LIMIT 100;
```

### Q: What if I want users to control agents?

**A**: Build a permission bridge:

1. Check user has permission in `admin_users.permissions`
2. If yes, allow them to use agent with matching permissions
3. Log both user and agent context in operations

Example:
```typescript
// Check user permission
const userCan = userProfile.permissions.tasks?.create;

// If user can, use agent
if (userCan) {
  const result = await mcpClient.callTool({
    name: 'create_task',
    arguments: {
      ...taskData,
      created_by: userProfile.id
    }
  });
}
```

## Summary

Your OTP authentication system and the MCP server work **independently**:

- **OTP Auth**: For user login and direct CRM access
- **MCP Server**: For AI agent operations with separate permissions

Both systems can coexist, and you can link them through audit logs to track:
- **Who** (user) initiated an action
- **What** (agent) performed the action
- **When** and **What** the result was

This provides complete traceability while maintaining security boundaries between user operations and agent operations.
