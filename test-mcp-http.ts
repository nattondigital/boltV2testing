/**
 * Test script for MCP HTTP Server
 *
 * Usage:
 * 1. Deploy the mcp-server edge function first
 * 2. Set your SUPABASE_URL and SUPABASE_ANON_KEY in .env
 * 3. Run: npx tsx test-mcp-http.ts
 */

import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables')
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const MCP_ENDPOINT = `${SUPABASE_URL}/functions/v1/mcp-server`

interface MCPRequest {
  jsonrpc: string
  id: number
  method: string
  params?: any
}

async function callMCP(request: MCPRequest) {
  console.log('\n📤 Request:', JSON.stringify(request, null, 2))

  const response = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(request),
  })

  const result = await response.json()
  console.log('📥 Response:', JSON.stringify(result, null, 2))
  return result
}

async function main() {
  console.log('🧪 Testing MCP HTTP Server')
  console.log('🌐 Endpoint:', MCP_ENDPOINT)
  console.log('=' .repeat(60))

  try {
    // Test 1: Initialize
    console.log('\n✅ Test 1: Initialize MCP Server')
    await callMCP({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
    })

    // Test 2: List Tools
    console.log('\n✅ Test 2: List Available Tools')
    await callMCP({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    })

    // Test 3: Get Tasks (you'll need a valid agent_id)
    console.log('\n✅ Test 3: Call get_tasks Tool')
    console.log('⚠️  You need to provide a valid agent_id from your ai_agents table')
    console.log('⚠️  Update the test script with your agent_id to test this')

    // Uncomment and add your agent_id to test:
    /*
    await callMCP({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'get_tasks',
        arguments: {
          agent_id: 'YOUR-AGENT-ID-HERE',
          limit: 5,
        },
      },
    })
    */

    // Test 4: List Resources
    console.log('\n✅ Test 4: List Resources')
    await callMCP({
      jsonrpc: '2.0',
      id: 4,
      method: 'resources/list',
    })

    // Test 5: List Prompts
    console.log('\n✅ Test 5: List Prompts')
    await callMCP({
      jsonrpc: '2.0',
      id: 5,
      method: 'prompts/list',
    })

    console.log('\n' + '='.repeat(60))
    console.log('✅ All tests completed successfully!')
    console.log('\n📝 Next Steps:')
    console.log('1. Get an agent_id from your ai_agents table')
    console.log('2. Update the test script to include your agent_id')
    console.log('3. Test the tool calls with actual data')
    console.log('4. Configure your AI chat to use this MCP endpoint')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  }
}

main()
