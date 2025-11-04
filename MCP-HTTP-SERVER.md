# N8N MCP Configuration - Troubleshooting Guide

## Problem: "Tools to Include" Shows "Select" (Empty)

Based on your screenshot, N8N is **not loading the available tools** from your MCP server. However, testing confirms the server IS working correctly and returning 4 tools.

**The issue is in the N8N configuration, specifically the authentication credential.**

## Server Status: ✅ VERIFIED WORKING

Tested and confirmed:
```bash
# Initialize returns JSON correctly
curl https://lddridmkphmckbjjlfxi.supabase.co/functions/v1/mcp-server \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'
# ✅ Returns: {"jsonrpc":"2.0","id":1,"result":{...}}

# Tools/list returns 4 tools
curl https://lddridmkphmckbjjlfxi.supabase.co/functions/v1/mcp-server \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
# ✅ Returns: {"tools":[{"name":"get_tasks"},{"name":"create_task"},{"name":"update_task"},{"name":"delete_task"}]}
```

**The MCP server is working perfectly. The issue is in N8N's configuration.**

---

## SOLUTION: Fix N8N Authentication Credential

### Step 1: Check Your "BOLT TESTING API" Credential

In your screenshot, you're using a credential called **"BOLT TESTING API"**. This needs to be configured correctly:

1. **Click the pencil icon** next to "BOLT TESTING API" to edit it

2. **Verify the credential has:**
   - **Header Name:** `Authorization`
   - **Header Value:** `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZHJpZG1rcGhtY2tiampsZnhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjM0NjAsImV4cCI6MjA3NDk5OTQ2MH0.QpYhrr7a_5kTqsN5TOZOw5Xr4xrOWT1YqK_FzaGZZy4`

3. **CRITICAL:** The value MUST include `Bearer ` (with a space) before the token!

**Common Mistakes:**
- ❌ Missing "Bearer " prefix
- ❌ Extra spaces or newlines
- ❌ Wrong header name (should be "Authorization" not "Auth" or "API-Key")
- ❌ Missing token entirely

### Step 2: Save and Refresh

1. Save the credential
2. Go back to the MCP Client node
3. Click on the "Tools to Include" dropdown
4. Wait 2-3 seconds for it to fetch the tools
5. You should now see 4 tools appear

### Step 3: Select Tools

Once tools appear:
- Select individual tools you want (get_tasks, create_task, etc.)
- Or select "All" to include all 4 tools

---

## Alternative: Create New Credential from Scratch

If editing doesn't work, create a fresh credential:

1. **In N8N, go to:** Credentials → Add Credential
2. **Search for:** "Header Auth"
3. **Name:** "CRM MCP Server Auth"
4. **Configuration:**
   - Header Name: `Authorization`
   - Header Value: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZHJpZG1rcGhtY2tiampsZnhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjM0NjAsImV4cCI6MjA3NDk5OTQ2MH0.QpYhrr7a_5kTqsN5TOZOw5Xr4xrOWT1YqK_FzaGZZy4`
5. **Save**

6. **Go back to MCP Client node:**
   - Change "Credential for Header Auth" to your new credential
   - Tools should now appear

---

## Why GHL MCP Works But Ours Shows Empty

**Likely reasons:**

1. **GHL's credential is configured correctly** with proper Bearer token
2. **Our credential might be missing the Bearer prefix** or have wrong header name
3. **GHL might use a different auth method** that N8N recognizes automatically

**Both servers work the same way** - the difference is in how the credentials are configured in N8N.

---

## Complete N8N MCP Client Configuration

Here's the correct full configuration:

### Parameters Tab:

**Endpoint:**
```
https://lddridmkphmckbjjlfxi.supabase.co/functions/v1/mcp-server
```

**Server Transport:**
```
HTTP Streamable
```

**Authentication:**
```
Header Auth
```

**Credential for Header Auth:**
- Select your credential (make sure it has correct Authorization header)

**Tools to Include:**
- Should show: get_tasks, create_task, update_task, delete_task
- Select the ones you need or "All"

**Options:**
- No properties needed (leave empty)

---

## Debugging Steps

### Step 1: Test Server Directly

Run this in terminal to confirm server works:

```bash
curl -X POST https://lddridmkphmckbjjlfxi.supabase.co/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZHJpZG1rcGhtY2tiampsZnhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjM0NjAsImV4cCI6MjA3NDk5OTQ2MH0.QpYhrr7a_5kTqsN5TOZOw5Xr4xrOWT1YqK_FzaGZZy4" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

**Expected output:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {"name": "get_tasks", "description": "Retrieve tasks...", ...},
      {"name": "create_task", "description": "Create a new task", ...},
      {"name": "update_task", "description": "Update an existing task", ...},
      {"name": "delete_task", "description": "Delete a task", ...}
    ]
  }
}
```

### Step 2: Check N8N Execution Logs

1. Execute your workflow in N8N
2. Click on the MCP Client node
3. Check the execution data/logs
4. Look for error messages

Common errors:
- "Unauthorized" → Auth header missing or wrong
- "Could not connect" → Endpoint URL wrong
- "Timeout" → Network issue or firewall

### Step 3: Try Test Credentials

Create a test credential with just:
- Header Name: `test`
- Header Value: `test`

Then switch back to the real one. This forces N8N to re-evaluate the connection.

---

## If Still Not Working: Alternative Approach

Use N8N's **HTTP Request** node instead of MCP Client:

### HTTP Request Node Configuration:

**Method:** POST

**URL:**
```
https://lddridmkphmckbjjlfxi.supabase.co/functions/v1/mcp-server
```

**Authentication:** Header Auth
- Header Name: `Authorization`
- Header Value: `Bearer YOUR_TOKEN`

**Send Headers:**
- `Content-Type`: `application/json`
- `Accept`: `application/json`

**Send Body:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_tasks",
    "arguments": {
      "agent_id": "YOUR-AGENT-UUID",
      "limit": 10
    }
  }
}
```

This gives you full control and bypasses any MCP Client node issues.

---

## Summary

**Problem:** Tools not appearing in N8N MCP Client

**Root Cause:** Authentication credential misconfigured

**Solution:**
1. ✅ Edit "BOLT TESTING API" credential
2. ✅ Ensure Header Name = "Authorization"
3. ✅ Ensure Header Value = "Bearer YOUR_TOKEN" (with Bearer prefix)
4. ✅ Save and refresh the node
5. ✅ Tools should now appear in dropdown

**Server Status:** Working perfectly (verified via curl)

**Next Action:** Check and fix the N8N credential configuration!

## Endpoint

**URL:** `https://[YOUR-PROJECT].supabase.co/functions/v1/mcp-server`

**Methods:** GET (streaming), POST (messages), OPTIONS (CORS)

**Headers:**
- `Content-Type: application/json` (for POST)
- `Accept: text/event-stream` (optional, for streaming responses)
- `Authorization: Bearer [YOUR-SUPABASE-KEY]`
- `Mcp-Session-Id: [session-id]` (optional, returned by server)

## MCP Protocol

The server implements JSON-RPC 2.0 protocol with MCP-specific methods.

### Request Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "METHOD_NAME",
  "params": {
    // method-specific parameters
  }
}
```

### Response Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    // method-specific result
  }
}
```

Or in case of error:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found"
  }
}
```

## Supported Methods

### 1. initialize

Initializes the MCP connection and returns server capabilities.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize"
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {},
      "resources": {},
      "prompts": {}
    },
    "serverInfo": {
      "name": "crm-tasks-mcp-server",
      "version": "1.0.0"
    }
  }
}
```

### 2. tools/list

Lists all available tools (operations) the agent can perform.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "get_tasks",
        "description": "Retrieve tasks with advanced filtering",
        "inputSchema": {
          "type": "object",
          "properties": {
            "agent_id": { "type": "string" },
            "task_id": { "type": "string" },
            "status": { "type": "string" },
            "priority": { "type": "string" },
            "limit": { "type": "number" }
          }
        }
      },
      // ... other tools
    ]
  }
}
```

### 3. tools/call

Executes a specific tool.

**Request Example - Get Tasks:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_tasks",
    "arguments": {
      "agent_id": "your-agent-id-uuid",
      "task_id": "TASK-10031"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"success\": true, \"data\": [{...}], \"count\": 1}"
      }
    ]
  }
}
```

**Request Example - Create Task:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "create_task",
    "arguments": {
      "agent_id": "your-agent-id-uuid",
      "title": "Follow up with client",
      "description": "Call client about proposal",
      "priority": "High",
      "status": "To Do",
      "due_date": "2025-11-05"
    }
  }
}
```

### 4. resources/list

Lists available read-only resources.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "resources/list"
}
```

### 5. prompts/list

Lists available prompt templates.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "prompts/list"
}
```

## Available Tools

### get_tasks

Retrieve tasks with filtering options.

**Parameters:**
- `agent_id` (required): AI agent UUID for permission checking
- `task_id` (optional): Get specific task by ID (e.g., "TASK-10031")
- `status` (optional): Filter by status (To Do, In Progress, Completed, Cancelled)
- `priority` (optional): Filter by priority (Low, Medium, High, Urgent)
- `limit` (optional): Max number of tasks (default: 100)

**Permissions Required:** Tasks → can_view

### create_task

Create a new task.

**Parameters:**
- `agent_id` (required): AI agent UUID
- `title` (required): Task title
- `description` (optional): Task description
- `priority` (optional): Low, Medium, High, Urgent (default: Medium)
- `status` (optional): To Do, In Progress, Completed, Cancelled (default: To Do)
- `assigned_to` (optional): Team member UUID
- `contact_id` (optional): Related contact UUID
- `due_date` (optional): YYYY-MM-DD format

**Permissions Required:** Tasks → can_create

### update_task

Update an existing task.

**Parameters:**
- `agent_id` (required): AI agent UUID
- `task_id` (required): Task ID to update
- `title` (optional): New title
- `description` (optional): New description
- `status` (optional): New status
- `priority` (optional): New priority
- `assigned_to` (optional): New assignee
- `due_date` (optional): New due date

**Permissions Required:** Tasks → can_edit

### delete_task

Delete a task.

**Parameters:**
- `agent_id` (required): AI agent UUID
- `task_id` (required): Task ID to delete

**Permissions Required:** Tasks → can_delete

## Permission System

All tool calls require:
1. Valid `agent_id` in arguments
2. Agent must exist in `ai_agents` table
3. Agent must have appropriate permissions in `ai_agent_permissions` table

Permission structure:
```json
{
  "Tasks": {
    "can_view": true,
    "can_create": true,
    "can_edit": true,
    "can_delete": false
  }
}
```

## Audit Logging

All tool executions are logged to `ai_agent_logs` table with:
- `agent_id`: Which agent performed the action
- `module`: "Tasks"
- `action`: Tool name (e.g., "get_tasks")
- `result`: "Success" or "Error"
- `error_message`: Error details if failed
- `user_context`: "MCP Server HTTP"
- `details`: Action-specific details (filters, updates, etc.)

## Streamable HTTP Features

### 1. GET Request - Establish Streaming Connection

Open a persistent SSE connection for server-to-client messages:

```bash
curl -N -H "Accept: text/event-stream" \
  -H "Authorization: Bearer YOUR-ANON-KEY" \
  https://YOUR-PROJECT.supabase.co/functions/v1/mcp-server
```

**Response:**
```
data: {"jsonrpc":"2.0","method":"notifications/message","params":{"level":"info","message":"MCP Streamable HTTP connection established"}}

: heartbeat

: heartbeat
```

The server will:
- Return `Mcp-Session-Id` header for session tracking
- Send initial welcome message
- Send heartbeat every 30 seconds to keep connection alive

### 2. POST Request - Send Messages

#### Simple JSON Response (Default)

```bash
curl -X POST https://YOUR-PROJECT.supabase.co/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR-ANON-KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize"
  }'
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {...},
    "serverInfo": {...}
  }
}
```

#### Streaming Response (with Accept header)

```bash
curl -X POST https://YOUR-PROJECT.supabase.co/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "Authorization: Bearer YOUR-ANON-KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_tasks",
      "arguments": {"agent_id": "YOUR-UUID", "limit": 5}
    }
  }'
```

**Response (SSE stream):**
```
data: {"jsonrpc":"2.0","id":1,"result":{...}}
```

### 3. Batch Requests

Send multiple messages in one request:

```bash
curl -X POST https://YOUR-PROJECT.supabase.co/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR-ANON-KEY" \
  -d '[
    {"jsonrpc": "2.0", "id": 1, "method": "initialize"},
    {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}
  ]'
```

## Testing

### Deploy the Edge Function

```bash
# The function is already created at:
# supabase/functions/mcp-server/index.ts

# Deploy it (deployment happens automatically)
```

### Run Test Script

```bash
# Install dependencies if not already done
npm install

# Run the test
npx tsx test-mcp-http.ts
```

### Manual Testing - Simple JSON Mode

```bash
# 1. Initialize
curl -X POST https://YOUR-PROJECT.supabase.co/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR-ANON-KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize"
  }'

# 2. List Tools
curl -X POST https://YOUR-PROJECT.supabase.co/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR-ANON-KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'

# 3. Get Tasks
curl -X POST https://YOUR-PROJECT.supabase.co/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR-ANON-KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_tasks",
      "arguments": {
        "agent_id": "YOUR-AGENT-UUID",
        "limit": 5
      }
    }
  }'
```

### Manual Testing - Streaming Mode

```bash
# 1. Establish SSE stream
curl -N -H "Accept: text/event-stream" \
  -H "Authorization: Bearer YOUR-ANON-KEY" \
  https://YOUR-PROJECT.supabase.co/functions/v1/mcp-server

# 2. Send message with streaming response
curl -X POST https://YOUR-PROJECT.supabase.co/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "Authorization: Bearer YOUR-ANON-KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_tasks",
      "arguments": {"agent_id": "YOUR-UUID", "limit": 5}
    }
  }'
```

## Integration with AI Chat

To use this MCP server with OpenRouter or other AI services:

### Option 1: Direct Integration (Future)

When AI services support MCP protocol natively, point them to:
```
https://YOUR-PROJECT.supabase.co/functions/v1/mcp-server
```

### Option 2: Adapter Layer (Current)

Create an adapter that converts between OpenRouter function calling and MCP protocol:

```typescript
// In your AI chat handler
async function callMCPTool(toolName: string, args: any) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/mcp-server`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    }),
  })

  const result = await response.json()
  return JSON.parse(result.result.content[0].text)
}
```

## Transport Comparison

### Streamable HTTP (Current Implementation)
- ✅ **Modern Standard**: 2025-03-26 MCP specification
- ✅ **Single Endpoint**: All communication through one path
- ✅ **Flexible**: Supports both streaming and simple request/response
- ✅ **Backward Compatible**: Falls back to JSON for non-streaming clients
- ✅ **Session Management**: Optional session tracking
- ✅ **Future-Proof**: Ready for MCP-native AI services
- ✅ **Batch Requests**: Send multiple messages at once

### Legacy HTTP+SSE (Deprecated)
- ❌ **Deprecated**: Replaced by Streamable HTTP
- ❌ **Complex**: Requires separate `/sse` endpoint
- ❌ **Not Recommended**: Use Streamable HTTP instead

### Simple HTTP (Previous Version)
- ✅ Simple and fast
- ✅ No streaming needed for CRUD
- ❌ Not officially MCP-compliant
- ❌ No standardization

## Next Steps

1. **Test the MCP Server**
   - Deploy the edge function
   - Run test script with valid agent_id
   - Verify permissions and logging work

2. **Choose Implementation Strategy**
   - Keep current direct implementation for production
   - Use MCP server for testing and future migration
   - Or migrate immediately to MCP for all AI interactions

3. **Add More Modules**
   - Expand MCP server to support Leads, Contacts, Appointments
   - Use same pattern as Tasks module
   - All modules share permission and logging system

4. **Monitor and Optimize**
   - Check `ai_agent_logs` for usage patterns
   - Monitor edge function performance
   - Optimize queries based on real usage

## Troubleshooting

### Error: "agent_id is required"
- Ensure you're passing `agent_id` in tool arguments
- Verify the agent exists in `ai_agents` table

### Error: "Agent does not have permission"
- Check `ai_agent_permissions` table
- Ensure the required permission flag is set to `true`

### Error: "Method not found"
- Verify the method name is correct
- Check the MCP protocol version compatibility

### No response / Timeout
- Verify edge function is deployed
- Check Supabase logs for errors
- Ensure environment variables are set

## Resources

- [MCP Specification](https://modelcontextprotocol.io/specification)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- Test Script: `test-mcp-http.ts`
- Edge Function: `supabase/functions/mcp-server/index.ts`
