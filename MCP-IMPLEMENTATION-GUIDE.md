# MCP Implementation Guide - Testing & Decision Making

## Current State

You now have **THREE AI agent implementations** running in parallel:

### 1. Web Interface AI Chat (Current Production)
**Location:** `src/components/Pages/AIAgentChat.tsx`

**How it works:**
```
User → Web UI → OpenRouter API (direct) → Tool Definition (inline) → Supabase (direct)
```

**Pros:**
- ✅ Fast and direct
- ✅ Real-time in browser
- ✅ Already working in production

**Cons:**
- ❌ Tool definitions in component code
- ❌ No standardization
- ❌ Hard to maintain when tools grow

### 2. Webhook AI Chat (Current Production)
**Location:** `supabase/functions/ai-chat/index.ts`

**How it works:**
```
External Service (WhatsApp) → Edge Function → OpenRouter API → Tool Definition (inline) → Supabase
```

**Pros:**
- ✅ Server-side execution
- ✅ Secure (no exposed keys)
- ✅ Works with WhatsApp

**Cons:**
- ❌ Tool definitions duplicated from web UI
- ❌ Same maintenance issues

### 3. MCP HTTP Server (NEW - For Testing)
**Location:** `supabase/functions/mcp-server/index.ts`

**How it works:**
```
AI Agent → MCP HTTP Endpoint → Tool Definition (centralized) → Supabase
```

**Pros:**
- ✅ Standardized MCP protocol
- ✅ Single source of truth for tools
- ✅ Future-proof (MCP is growing standard)
- ✅ Easy to expand to more modules
- ✅ Centralized permissions & logging

**Cons:**
- ⚠️ Requires adapter layer for OpenRouter
- ⚠️ New and needs testing
- ⚠️ Slightly more complex

## Testing Plan

### Step 1: Get Your Agent ID

```sql
-- Run this in Supabase SQL Editor
SELECT id, name, status FROM ai_agents WHERE status = 'active' LIMIT 1;
```

Copy the `id` value - you'll need it for testing.

### Step 2: Test MCP Server with curl

```bash
# Replace YOUR-PROJECT and YOUR-AGENT-UUID with your values
export SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
export SUPABASE_KEY="your-anon-key"
export AGENT_ID="your-agent-uuid"

# Test 1: Initialize
curl -X POST "$SUPABASE_URL/functions/v1/mcp-server" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize"
  }'

# Test 2: List Tools
curl -X POST "$SUPABASE_URL/functions/v1/mcp-server" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'

# Test 3: Get Tasks
curl -X POST "$SUPABASE_URL/functions/v1/mcp-server" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 3,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"get_tasks\",
      \"arguments\": {
        \"agent_id\": \"$AGENT_ID\",
        \"limit\": 5
      }
    }
  }"

# Test 4: Create a Task
curl -X POST "$SUPABASE_URL/functions/v1/mcp-server" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 4,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"create_task\",
      \"arguments\": {
        \"agent_id\": \"$AGENT_ID\",
        \"title\": \"Test task from MCP\",
        \"description\": \"Testing MCP HTTP server\",
        \"priority\": \"Medium\",
        \"status\": \"To Do\"
      }
    }
  }"

# Test 5: Get specific task by task_id
curl -X POST "$SUPABASE_URL/functions/v1/mcp-server" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 5,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"get_tasks\",
      \"arguments\": {
        \"agent_id\": \"$AGENT_ID\",
        \"task_id\": \"TASK-10031\"
      }
    }
  }"
```

### Step 3: Check Audit Logs

```sql
-- Verify logging works
SELECT
  created_at,
  agent_name,
  module,
  action,
  result,
  user_context,
  details
FROM ai_agent_logs
WHERE user_context = 'MCP Server HTTP'
ORDER BY created_at DESC
LIMIT 10;
```

### Step 4: Test Permissions

```sql
-- Disable create permission
UPDATE ai_agent_permissions
SET permissions = jsonb_set(
  permissions,
  '{Tasks,can_create}',
  'false'
)
WHERE agent_id = 'your-agent-id';

-- Try to create a task (should fail)
-- Then re-enable and try again
```

## Decision Matrix

After testing, use this to decide which approach to use:

### Scenario 1: Keep Current System
**Choose if:**
- Current system works well
- You don't plan to add many more tools
- Performance is critical
- You prefer simplicity

**Action:**
- Keep web UI and webhook AI chat as-is
- Use MCP server only for external MCP clients (Claude Desktop)

### Scenario 2: Migrate to MCP Gradually
**Choose if:**
- You want standardization
- Planning to add many more modules (Leads, Contacts, etc.)
- Want single source of truth
- Future-proofing is important

**Action:**
1. Keep current systems running
2. Test MCP server thoroughly
3. Create adapter layer in AI chat to call MCP server
4. Gradually migrate one module at a time

### Scenario 3: Full MCP Adoption
**Choose if:**
- Ready for complete rewrite
- Want full standardization now
- Have time for thorough testing
- Confident in MCP being the future

**Action:**
1. Create adapter in web UI to call MCP server
2. Create adapter in webhook to call MCP server
3. Remove inline tool implementations
4. Use MCP server as single backend

## Migration Example (If You Choose Scenario 2 or 3)

### Current Code (Direct Implementation)
```typescript
// In AIAgentChat.tsx
case 'get_tasks':
  let tasksQuery = supabase.from('tasks').select('*')
  if (args.task_id) tasksQuery = tasksQuery.eq('task_id', args.task_id)
  const { data } = await tasksQuery
  return { success: true, data }
```

### New Code (MCP Adapter)
```typescript
// In AIAgentChat.tsx
case 'get_tasks':
  const mcpResult = await callMCPServer('get_tasks', args)
  return mcpResult

// Helper function
async function callMCPServer(toolName: string, args: any) {
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
        arguments: {
          ...args,
          agent_id: currentAgentId,
        },
      },
    }),
  })

  const mcpResponse = await response.json()
  return JSON.parse(mcpResponse.result.content[0].text)
}
```

## Performance Comparison

### Current System (Direct)
- Response time: ~200-500ms
- Network hops: 1 (browser → Supabase)
- Code complexity: Low
- Maintenance: Medium (duplicated code)

### MCP Server
- Response time: ~300-700ms (additional hop)
- Network hops: 2 (browser → edge function → Supabase)
- Code complexity: Medium (protocol overhead)
- Maintenance: Low (single source of truth)

**Verdict:** ~100-200ms overhead, but better maintainability

## Recommendations

### For Your Use Case (CRM with Multiple Modules)

**Short Term (Next 2 weeks):**
1. ✅ Keep current web UI and webhook chat running
2. ✅ Test MCP server thoroughly with all CRUD operations
3. ✅ Monitor audit logs and performance
4. ✅ Add more modules to MCP server (Leads, Contacts)

**Medium Term (1-2 months):**
1. Create adapter layer in web UI to optionally use MCP
2. Run A/B test: some agents use MCP, others use direct
3. Compare performance, reliability, ease of development

**Long Term (3+ months):**
1. If MCP proves successful, migrate fully
2. Keep web UI calling MCP server
3. Expand MCP server with all CRM modules
4. Consider exposing MCP server to external developers

### The Best of Both Worlds

You can run **hybrid mode**:

```typescript
// In AIAgentChat.tsx
const USE_MCP = localStorage.getItem('use_mcp') === 'true' // Feature flag

async function executeTool(name: string, args: any) {
  if (USE_MCP) {
    return await callMCPServer(name, args)
  } else {
    return await executeDirectly(name, args)
  }
}
```

This lets you:
- ✅ Test MCP without risk
- ✅ Toggle between implementations
- ✅ Gradual migration
- ✅ Easy rollback if issues

## Next Steps

1. **Test Now:**
   ```bash
   npx tsx test-mcp-http.ts
   ```

2. **Check Logs:**
   - Go to Supabase → Table Editor → ai_agent_logs
   - Look for entries with user_context = "MCP Server HTTP"

3. **Try Different Scenarios:**
   - Get tasks with different filters
   - Create, update, delete tasks
   - Test with invalid agent_id (should fail gracefully)
   - Test without permissions (should block operation)

4. **Make Decision:**
   - Use the decision matrix above
   - Consider your team's capacity
   - Think about future plans for the CRM

5. **Report Back:**
   - What worked well?
   - What failed?
   - Performance acceptable?
   - Ready for migration or keep current?

## Files Created

1. **MCP Server:** `supabase/functions/mcp-server/index.ts`
2. **Test Script:** `test-mcp-http.ts`
3. **Documentation:**
   - `MCP-HTTP-SERVER.md` (Technical details)
   - `MCP-IMPLEMENTATION-GUIDE.md` (This file - Decision guide)

## Support

If you encounter issues:
1. Check Supabase logs: Dashboard → Edge Functions → mcp-server → Logs
2. Verify environment variables are set
3. Ensure agent has proper permissions
4. Check that edge function is deployed

---

**Remember:** There's no wrong choice here. Both approaches work. MCP is about future-proofing and standardization, while direct implementation is about simplicity and performance. Choose based on your priorities!
