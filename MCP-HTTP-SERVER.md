# MCP HTTP Server Implementation

## Overview

This document describes the HTTP-based Model Context Protocol (MCP) server implementation for your CRM system. This allows AI agents to interact with your CRM via standard HTTP requests using the MCP protocol.

## Architecture

```
┌─────────────────┐
│   AI Agent      │
│  (OpenRouter,   │
│   Claude, etc)  │
└────────┬────────┘
         │
         │ HTTP POST (JSON-RPC)
         │
         ▼
┌─────────────────────────────────────┐
│  Supabase Edge Function             │
│  /functions/v1/mcp-server           │
│                                     │
│  • Handles MCP Protocol             │
│  • Permission Validation            │
│  • Audit Logging                    │
└────────┬────────────────────────────┘
         │
         │ Supabase Client
         │
         ▼
┌─────────────────┐
│  Supabase DB    │
│  • tasks        │
│  • permissions  │
│  • audit logs   │
└─────────────────┘
```

## Endpoint

**URL:** `https://[YOUR-PROJECT].supabase.co/functions/v1/mcp-server`

**Method:** POST

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer [YOUR-SUPABASE-KEY]`

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

### Manual Testing with curl

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

## Comparison: MCP vs Direct Implementation

### Current (Direct Implementation)
- ✅ Simple and fast
- ✅ No protocol overhead
- ❌ Tool definitions duplicated in multiple places
- ❌ No standardization

### New (MCP HTTP Server)
- ✅ Standardized protocol (future-proof)
- ✅ Single source of truth for tools
- ✅ Easy to add new tools
- ✅ Compatible with MCP-aware AI services
- ❌ Slight protocol overhead
- ❌ Requires adapter for current AI services

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
