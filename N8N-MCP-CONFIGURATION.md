# N8N MCP Server Configuration Guide

## Problem

N8N MCP Client Tool requires proper authentication to connect to Supabase Edge Functions. Using custom credentials like "BOLT TESTING API" won't work because Supabase validates JWT tokens before requests reach your edge function.

## Solution: Use Supabase Anon Key

### Step 1: Get Your Supabase Anon Key

Your Supabase Anon Key is:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZHJpZG1rcGhtY2tiampsZnhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjM0NjAsImV4cCI6MjA3NDk5OTQ2MH0.QpYhrr7a_5kTqsN5TOZOw5Xr4xrOWT1YqK_FzaGZZy4
```

This key is safe to use in N8N because:
- It's the public "anon" key (not the service role key)
- It only allows operations permitted by Row Level Security (RLS)
- Your edge function has additional permission checks

### Step 2: Configure N8N MCP Client Tool

1. **Endpoint**
   ```
   https://lddridmkphmckbjjlfxi.supabase.co/functions/v1/mcp-server
   ```

2. **Server Transport**
   - Select: `HTTP Streamable`

3. **Authentication**
   - Select: `Header Auth`

4. **Credential for Header Auth**
   - **Header Name**: `Authorization`
   - **Header Value**: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZHJpZG1rcGhtY2tiampsZnhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjM0NjAsImV4cCI6MjA3NDk5OTQ2MH0.QpYhrr7a_5kTqsN5TOZOw5Xr4xrOWT1YqK_FzaGZZy4`

   Note: Include the word "Bearer" followed by a space before the token.

5. **Tools to Include**
   - Select: `Selected` or `All`
   - You should now see: `get_tasks`, `create_task`, `update_task`, `delete_task`

### Step 3: Test the Connection

1. Click "Fetch options" or "Test" button in N8N
2. You should see the available tools load successfully
3. If you see "Error fetching options from MCP Client Tool", check:
   - The Authorization header format is correct: `Bearer <token>`
   - The endpoint URL is exactly: `https://lddridmkphmckbjjlfxi.supabase.co/functions/v1/mcp-server`
   - You selected "HTTP Streamable" as transport

## Testing with curl

Verify the endpoint works:

```bash
# Test tools/list
curl -X POST https://lddridmkphmckbjjlfxi.supabase.co/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZHJpZG1rcGhtY2tiampsZnhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjM0NjAsImV4cCI6MjA3NDk5OTQ2MH0.QpYhrr7a_5kTqsN5TOZOw5Xr4xrOWT1YqK_FzaGZZy4" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

Expected response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "get_tasks",
        "description": "Retrieve tasks with advanced filtering...",
        ...
      },
      ...
    ]
  }
}
```

## Using the Tools

### Example: Get Tasks

In N8N, when using the MCP Client Tool:

1. **Tool**: `get_tasks`
2. **Arguments**:
   ```json
   {
     "agent_id": "YOUR-AGENT-UUID-HERE",
     "limit": 10,
     "status": "To Do"
   }
   ```

**Important**: You need a valid `agent_id` from your `ai_agents` table. The agent must have permissions set in `ai_agent_permissions` table.

### Example: Create Task

1. **Tool**: `create_task`
2. **Arguments**:
   ```json
   {
     "agent_id": "YOUR-AGENT-UUID-HERE",
     "title": "Follow up with client",
     "description": "Call about proposal",
     "priority": "High",
     "status": "To Do",
     "due_date": "2025-11-10"
   }
   ```

## Troubleshooting

### Error: "Invalid JWT"
- Make sure you're using the full anon key
- Check that "Bearer " (with space) is before the token
- Verify the endpoint URL is correct

### Error: "agent_id is required"
- All tools require an `agent_id` parameter
- Create an AI agent in your CRM system first
- Use the agent's UUID in the arguments

### Error: "Agent does not have permission"
- Check the `ai_agent_permissions` table
- Ensure the agent has the required permission (e.g., `can_view`, `can_create`, etc.)
- Update permissions in the CRM AI Agents settings

### Error: "Method not found"
- Verify you're calling a valid method: `initialize`, `tools/list`, `tools/call`, `resources/list`, `prompts/list`
- Check the JSON-RPC format is correct

### Tools not loading in N8N
- Verify "HTTP Streamable" transport is selected
- Check Authentication is set to "Header Auth"
- Ensure the Authorization header includes "Bearer " prefix
- Test the endpoint with curl first to verify it works

## Security Notes

**Anon Key Safety:**
- The anon key is safe to use in N8N workflows
- It's already public in your frontend application
- All database operations are protected by RLS policies
- The MCP server adds additional agent-based permission checks

**Agent Permissions:**
- Each agent has specific permissions defined in `ai_agent_permissions`
- Agents can only perform actions they have permission for
- All actions are logged in `ai_agent_logs` for audit

**Production Best Practices:**
- Create separate AI agents for different N8N workflows
- Grant minimum required permissions to each agent
- Monitor `ai_agent_logs` regularly
- Rotate credentials if compromised

## Alternative: API Key Authentication

If you prefer custom API key authentication instead of Supabase tokens, you would need to:

1. Create a separate public edge function (not possible to disable JWT on existing functions)
2. Implement your own authentication layer
3. Proxy requests to the MCP server

This is more complex and not recommended for most use cases. The Supabase anon key approach is simpler and equally secure.

## Next Steps

1. Configure N8N with the Supabase anon key
2. Create an AI agent in your CRM (or get an existing agent UUID)
3. Set up agent permissions for the Tasks module
4. Test calling tools from N8N
5. Build your automation workflow

## Support

For more details on:
- MCP Protocol: See `MCP-HTTP-SERVER.md`
- Implementation: See `MCP-IMPLEMENTATION-GUIDE.md`
- Testing: See `test-mcp-http.ts`
