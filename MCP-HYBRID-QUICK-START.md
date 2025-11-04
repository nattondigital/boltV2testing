# MCP Hybrid Mode - Quick Start Guide

## What Was Implemented?

Your `ai-chat` edge function now supports **two modes**:

1. **MCP Mode** - AI agent discovers and uses tools via MCP protocol
2. **Hardcoded Mode** - AI agent uses pre-defined hardcoded tools (existing behavior)

This is **per-agent configurable** - each AI agent can choose its own mode!

## How Does It Work?

```
n8n/External Tool
    ↓ (webhook)
ai-chat edge function
    ↓ (checks agent.use_mcp)
    ├─ MCP Enabled? → MCP Server → Dynamic tools
    └─ MCP Disabled? → Hardcoded tools
```

## Configuration

### Step 1: Deploy the Updated Function

```bash
supabase functions deploy ai-chat
```

### Step 2: Enable MCP for an Agent

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

**Configuration Options:**

- `enabled`: Must be `true` to use MCP
- `server_url`: Your MCP server endpoint (defaults to same project)
- `use_for_modules`: Array of modules to use MCP for (empty array = all modules)

### Step 3: Test from n8n

Your n8n webhook stays **exactly the same**:

```
POST https://yourproject.supabase.co/functions/v1/ai-chat
Content-Type: application/json

{
  "agent_id": "your-agent-id",
  "phone_number": "+1234567890",
  "message": "Get my tasks"
}
```

## Module Filtering

You can selectively enable MCP for specific modules:

### Example 1: Use MCP for Tasks Only

```json
{
  "enabled": true,
  "server_url": "...",
  "use_for_modules": ["Tasks"]
}
```

- Task operations → MCP server
- Everything else → Hardcoded tools

### Example 2: Use MCP for Tasks and Contacts

```json
{
  "enabled": true,
  "server_url": "...",
  "use_for_modules": ["Tasks", "Contacts"]
}
```

### Example 3: Use MCP for All Modules

```json
{
  "enabled": true,
  "server_url": "...",
  "use_for_modules": []
}
```

Empty array = all available MCP tools

## Advantages

### For Your Current Setup:

✅ **No changes to n8n workflows** - Same webhook endpoint
✅ **No changes to existing agents** - They continue using hardcoded tools
✅ **Gradual migration** - Move one agent at a time to MCP
✅ **Automatic fallback** - If MCP fails, uses hardcoded tools
✅ **Better AI performance** - MCP provides better context to AI

### For Future:

✅ **Easy to extend** - Add new modules to MCP server
✅ **Consistent tools** - Web app and n8n use same MCP server
✅ **Single source of truth** - Update once, works everywhere
✅ **Better logging** - All actions logged in ai_agent_logs table

## Real-World Scenario

### Scenario: You have 3 AI agents

1. **Basic Agent** - Simple tasks, doesn't need MCP
   - `use_mcp = false`
   - Uses fast hardcoded tools

2. **Advanced Agent** - Complex task management
   - `use_mcp = true`
   - `use_for_modules = ["Tasks"]`
   - Gets rich context from MCP resources

3. **Super Agent** - Full CRM access
   - `use_mcp = true`
   - `use_for_modules = []` (all modules)
   - Maximum capabilities

## n8n Integration Example

### n8n Workflow:

1. **Webhook Trigger** - Receives WhatsApp message
2. **HTTP Request Node** - Calls ai-chat function
   ```
   POST {{$env.SUPABASE_URL}}/functions/v1/ai-chat
   Body:
   {
     "agent_id": "{{$env.AGENT_ID}}",
     "phone_number": "{{$json.from}}",
     "message": "{{$json.message}}"
   }
   ```
3. **Response Node** - Sends AI response back

**Nothing changes!** The agent decides internally whether to use MCP or hardcoded tools.

## Monitoring

### Check What Mode Agent Is Using

```sql
SELECT
  name,
  use_mcp,
  mcp_config
FROM ai_agents
WHERE id = 'your-agent-id';
```

### View Agent Activity Logs

```sql
SELECT
  action,
  details,
  created_at
FROM ai_agent_logs
WHERE agent_id = 'your-agent-id'
ORDER BY created_at DESC
LIMIT 10;
```

## Troubleshooting

### Agent not using MCP?

Check:
1. `use_mcp = true`
2. `mcp_config.enabled = true`
3. `server_url` is correct
4. MCP server is deployed

### Falls back to hardcoded tools?

This is normal when:
- MCP server initialization fails
- MCP server is unreachable
- Tool not found in MCP server
- Permission denied

Check function logs for details.

## Migration Strategy

### Phase 1: Test with One Agent (Current)
- Enable MCP for one test agent
- Verify n8n integration works
- Compare performance

### Phase 2: Extend MCP Server
- Add more modules (Contacts, Leads, Appointments)
- Add resources for better context
- Add prompts for better guidance

### Phase 3: Migrate Production Agents
- Move agents one by one
- Monitor performance
- Keep critical agents on hardcoded tools if needed

### Phase 4: Consolidate
- Remove hardcoded tool implementations
- All agents use MCP
- Single source of truth

## Summary

**What you built:**
- Hybrid system supporting both MCP and hardcoded tools
- Per-agent configuration
- Backward compatible
- Same n8n webhook interface

**What's next:**
1. Deploy ai-chat function
2. Test with one agent
3. Extend MCP server as needed
4. Gradually migrate agents

Your architecture is now **future-proof** and **scalable**!
