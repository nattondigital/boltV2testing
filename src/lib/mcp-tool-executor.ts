import { createMCPClient, getMCPToolsAsOpenRouterFunctions } from './mcp-client'
import { supabase } from './supabase'

interface MCPConfig {
  enabled: boolean
  server_url: string
  use_for_modules: string[]
}

interface ToolExecutionResult {
  success: boolean
  message?: string
  data?: any
  error?: string
  usedMCP?: boolean
}

export async function getAgentMCPConfig(agentId: string): Promise<MCPConfig | null> {
  try {
    const { data, error } = await supabase
      .from('ai_agents')
      .select('use_mcp, mcp_config')
      .eq('id', agentId)
      .single()

    if (error || !data || !data.use_mcp) {
      return null
    }

    return data.mcp_config as MCPConfig
  } catch (error) {
    console.error('Error fetching MCP config:', error)
    return null
  }
}

export async function getMCPTools(
  agentId: string,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<any[]> {
  const mcpConfig = await getAgentMCPConfig(agentId)

  if (!mcpConfig || !mcpConfig.enabled) {
    return []
  }

  const serverUrl = mcpConfig.server_url || `${supabaseUrl}/functions/v1/mcp-server`

  try {
    const mcpTools = await getMCPToolsAsOpenRouterFunctions(
      serverUrl,
      supabaseAnonKey,
      agentId
    )

    const enabledModules = mcpConfig.use_for_modules || []

    if (enabledModules.length === 0) {
      return mcpTools
    }

    return mcpTools.filter((tool: any) => {
      const toolName = tool.function.name.toLowerCase()
      return enabledModules.some(module =>
        toolName.includes(module.toLowerCase())
      )
    })
  } catch (error) {
    console.error('Error fetching MCP tools:', error)
    return []
  }
}

export async function executeMCPTool(
  agentId: string,
  toolName: string,
  args: any,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<ToolExecutionResult> {
  const mcpConfig = await getAgentMCPConfig(agentId)

  if (!mcpConfig || !mcpConfig.enabled) {
    return {
      success: false,
      error: 'MCP is not enabled for this agent',
      usedMCP: false
    }
  }

  const serverUrl = mcpConfig.server_url || `${supabaseUrl}/functions/v1/mcp-server`

  try {
    const client = createMCPClient({
      serverUrl,
      authToken: supabaseAnonKey,
      agentId
    })

    await client.initialize()

    const result = await client.callTool(toolName, args)

    console.log('=== DEBUG: MCP Tool Result ===')
    console.log('Tool Name:', toolName)
    console.log('Raw Result:', result)
    console.log('Result Type:', typeof result)
    console.log('Is Array:', Array.isArray(result))

    // MCP server returns data directly (arrays, objects, or strings)
    // For get_tasks: returns array of tasks
    // For create/update/delete: returns success message string

    // Check if result is an error structure
    if (result && typeof result === 'object' && 'error' in result) {
      return {
        success: false,
        error: result.error,
        usedMCP: true
      }
    }

    // Determine success message based on tool type
    let successMessage = 'Operation completed successfully'
    if (typeof result === 'string') {
      successMessage = result
    } else if (Array.isArray(result)) {
      if (result.length === 0) {
        successMessage = 'No results found'
      } else if (result.length === 1) {
        successMessage = 'Retrieved 1 item'
      } else {
        successMessage = `Retrieved ${result.length} items`
      }
    }

    const executionResult = {
      success: true,
      message: successMessage,
      data: result,
      usedMCP: true
    }

    console.log('=== DEBUG: Execution Result ===')
    console.log('Result Object:', executionResult)

    return executionResult
  } catch (error: any) {
    console.error('MCP tool execution error:', error)
    return {
      success: false,
      error: error.message || 'MCP execution failed',
      usedMCP: true
    }
  }
}

export function isTaskTool(toolName: string): boolean {
  const taskTools = ['get_tasks', 'create_task', 'update_task', 'delete_task']
  return taskTools.includes(toolName)
}

export async function shouldUseMCP(
  agentId: string,
  toolName: string
): Promise<boolean> {
  const mcpConfig = await getAgentMCPConfig(agentId)

  if (!mcpConfig || !mcpConfig.enabled) {
    return false
  }

  if (!isTaskTool(toolName)) {
    return false
  }

  const enabledModules = mcpConfig.use_for_modules || []

  if (enabledModules.length === 0) {
    return true
  }

  return enabledModules.includes('Tasks')
}
