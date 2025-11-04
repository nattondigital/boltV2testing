# AI Agent - MCP Server Only Mode

## Summary

The AI agent chat system has been updated to **use MCP server ONLY** instead of a hybrid approach with hardcoded tools. This eliminates potential conflicts and ensures all tool execution goes through the MCP server.

## Changes Made

### 1. Mandatory MCP Requirement

**File:** `supabase/functions/ai-chat/index.ts`

- Added validation that **requires MCP to be enabled** before the agent can function
- If MCP is not enabled, the function returns an error message:
  ```json
  {
    "error": "MCP server is required but not enabled for this agent. Please enable MCP in agent settings.",
    "mcp_enabled": false
  }
  ```

### 2. Removed All Hardcoded Tools

**Before:** The system had 9+ hardcoded tool implementations including:
- `create_expense`
- `create_task`
- `create_support_ticket`
- `create_lead`
- `create_appointment`
- `get_support_tickets`
- `get_expenses`
- `get_tasks`
- `get_leads`
- `get_appointments`
- `get_contacts`

**After:** All hardcoded tools have been completely removed. The system now:
1. Connects to the MCP server
2. Fetches available tools from the MCP server
3. Uses only MCP tools for all operations

### 3. Simplified Tool Execution

**Before:** Complex conditional logic to decide whether to use MCP or hardcoded tools:
```typescript
if (useMCP && mcpClient) {
  // Use MCP
} else {
  // Use hardcoded tool
}
```

**After:** Direct MCP tool execution:
```typescript
const result = await mcpClient!.callTool(functionName, functionArgs)
```

### 4. Error Handling

If the MCP server fails to connect or initialize:
```json
{
  "error": "Failed to connect to MCP server",
  "details": "error message"
}
```

## Benefits

1. **No More Conflicts:** Eliminates issues caused by having two different implementations of the same tools
2. **Single Source of Truth:** All tool implementations are in the MCP server
3. **Easier Maintenance:** Updates only need to be made in one place (MCP server)
4. **Cleaner Code:** Reduced from 967 lines to 500 lines by removing duplicate code
5. **Better Permission Control:** MCP server handles all permission validation centrally

## Required Configuration

To use the AI agent, you MUST:

1. **Enable MCP in Agent Settings:**
   - Go to AI Agents page
   - Edit the agent
   - Check "Enable MCP"
   - Configure MCP settings:
     - Server URL (defaults to your Supabase MCP server)
     - Select modules to enable (e.g., Tasks, Expenses, Support Tickets)

2. **Ensure MCP Server is Deployed:**
   - The MCP server edge function must be deployed at `/functions/v1/mcp-server`
   - It should have the tasks-server and other module servers running

3. **Configure OpenRouter API Key:**
   - Settings > Integrations > OpenRouter
   - Add your API key

## Migration Notes

- **Existing agents will require MCP to be enabled** to continue functioning
- If you try to use an agent without MCP enabled, you'll receive a clear error message
- All existing tool functionality remains the same, just executed through MCP instead of hardcoded

## Testing

To test the MCP-only implementation:

1. Enable MCP for an agent
2. Try creating a task: "create a task for tomorrow"
3. Try retrieving data: "show me my pending tasks"
4. Verify that all operations work through MCP

## Future

If this implementation works perfectly:
- We can consider removing the `use_mcp` flag entirely (since MCP is now mandatory)
- All agents will be MCP-based by default
- This paves the way for more dynamic tool loading and plugin systems
