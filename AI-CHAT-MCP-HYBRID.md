# AI Chat MCP Hybrid Implementation

## Overview

The `ai-chat` edge function now supports **hybrid mode** - it can use either MCP protocol or hardcoded tools based on per-agent configuration.

## Architecture

```
External Tools (n8n, Make.com, etc.)
    ↓ HTTP webhook request
AI Chat Webhook (/functions/v1/ai-chat)
    ↓ Check agent.use_mcp
    ├─ MCP Enabled → MCP Client → MCP Server → Database
    └─ MCP Disabled → Hardcoded Tools → Direct DB calls
```

## Key Changes

### 1. MCP Client Implementation (Lines 18-155)

Added a Deno-compatible MCP client that:
- Initializes connection with MCP server
- Lists available tools dynamically
- Executes tools via MCP protocol
- Converts MCP tools to OpenRouter function format

### 2. Hybrid Tool Loading (Lines 267-300)

```typescript
const useMCP = agent.use_mcp && agent.mcp_config?.enabled

if (useMCP) {
  // Initialize MCP client and load tools from MCP server
  mcpClient = new MCPClient(...)
  await mcpClient.initialize()
  const mcpTools = await mcpClient.listTools()

  // Filter tools based on use_for_modules config
  tools = filteredTools.map(convertMCPToolToOpenRouterFunction)
}

if (!useMCP || tools.length === 0) {
  // Fall back to hardcoded tools based on permissions
  // ... existing hardcoded tool logic
}
```

### 3. Hybrid Tool Execution (Lines 573-584)

```typescript
if (useMCP && mcpClient) {
  // Execute via MCP protocol
  const result = await mcpClient.callTool(functionName, functionArgs)
  toolResults.push(result)
} else {
  // Execute via hardcoded implementations
  // ... existing tool execution logic
}
```

## Database Configuration

### Agent Configuration Fields

- `use_mcp` (boolean): Enable/disable MCP integration
- `mcp_config` (jsonb): MCP server configuration

```json
{
  "enabled": true,
  "server_url": "https://[project].supabase.co/functions/v1/mcp-server",
  "use_for_modules": ["Tasks", "Contacts", "Leads"]
}
```

## Benefits

✅ **Per-agent choice** - Each agent decides its mode
✅ **Backward compatible** - Existing agents work unchanged
✅ **Gradual migration** - Move agents to MCP incrementally
✅ **Fallback support** - Falls back to hardcoded if MCP fails
✅ **Module filtering** - Use MCP only for specific modules
✅ **Single entry point** - n8n and other tools use same webhook

## Usage Examples

### Example 1: Enable MCP for Tasks Module

```sql
UPDATE ai_agents
SET
  use_mcp = true,
  mcp_config = '{
    "enabled": true,
    "server_url": "https://yourproject.supabase.co/functions/v1/mcp-server",
    "use_for_modules": ["Tasks"]
  }'::jsonb
WHERE id = 'your-agent-id';
```

### Example 2: Disable MCP (Use Hardcoded Tools)

```sql
UPDATE ai_agents
SET use_mcp = false
WHERE id = 'your-agent-id';
```

### Example 3: n8n Webhook Request

```json
POST https://yourproject.supabase.co/functions/v1/ai-chat

{
  "agent_id": "your-agent-id",
  "phone_number": "+1234567890",
  "message": "Get task TASK-10031"
}
```

The agent will:
- Check `use_mcp` setting
- If enabled: Use MCP server to get the task
- If disabled: Use hardcoded `get_tasks` tool
- Return response to n8n

## Testing

### Test MCP Mode

1. Enable MCP for an agent:
```sql
UPDATE ai_agents SET use_mcp = true WHERE name = 'Test Agent';
```

2. Send request via curl:
```bash
curl -X POST https://yourproject.supabase.co/functions/v1/ai-chat \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent-uuid",
    "phone_number": "+1234567890",
    "message": "Show me my tasks"
  }'
```

3. Check logs:
```
Agent Test Agent - MCP Enabled: true
Using MCP mode for agent: Test Agent
Loaded 4 MCP tools for agent
```

### Test Hardcoded Mode

1. Disable MCP:
```sql
UPDATE ai_agents SET use_mcp = false WHERE name = 'Test Agent';
```

2. Send same request

3. Check logs:
```
Agent Test Agent - MCP Enabled: false
Using hardcoded tools mode for agent: Test Agent
Total tools available: 11
```

## Deployment

Deploy the updated function:

```bash
supabase functions deploy ai-chat
```

## Logging

The function logs:
- Agent mode (MCP/hardcoded)
- MCP configuration when enabled
- Tool loading success/failure
- Tool execution details
- Fallback triggers

## Error Handling

- MCP initialization fails → Falls back to hardcoded tools
- MCP tool execution fails → Returns error message to AI
- Hardcoded tool fails → Returns error message to AI
- All errors logged for debugging

## Next Steps

1. **Deploy the function** to Supabase
2. **Test with one agent** in MCP mode
3. **Verify n8n integration** works with both modes
4. **Gradually migrate agents** to MCP as needed
5. **Extend MCP server** with more modules (Contacts, Leads, etc.)

## Future Enhancements

- [ ] Add resource support (read-only context data)
- [ ] Add prompt templates for better AI guidance
- [ ] Support multiple MCP servers per agent
- [ ] Add MCP performance monitoring
- [ ] Implement MCP tool caching
