/*
  # Add MCP Configuration to AI Agents

  1. Changes
    - Add `use_mcp` boolean field to enable/disable MCP integration per agent
    - Add `mcp_config` JSONB field to store MCP server connection settings
    - Update existing agents to have MCP disabled by default

  2. MCP Config Structure
    ```json
    {
      "enabled": true,
      "server_url": "https://project.supabase.co/functions/v1/mcp-server",
      "use_for_modules": ["Tasks"]
    }
    ```

  3. Notes
    - MCP integration is opt-in per agent
    - Agents can selectively use MCP for specific modules
    - Configuration is flexible for future expansion
*/

-- Add MCP configuration columns
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS use_mcp boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS mcp_config jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN ai_agents.use_mcp IS 'Enable MCP protocol integration for this agent';
COMMENT ON COLUMN ai_agents.mcp_config IS 'MCP server configuration (server_url, enabled modules, etc.)';

-- Update existing agents to have MCP disabled
UPDATE ai_agents
SET use_mcp = false
WHERE use_mcp IS NULL;