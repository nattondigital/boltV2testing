#!/usr/bin/env node

/**
 * Appointments MCP Server
 * Provides MCP protocol access to appointment management functionality
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { initializeSupabase, getActiveAgent } from '../shared/supabase-client.js';
import { createLogger } from '../shared/logger.js';
import { resources, readResource } from './resources.js';
import { tools, callTool } from './tools.js';
import { prompts, getPrompt } from './prompts.js';

dotenv.config();

const logger = createLogger('AppointmentsServer');

const SERVER_NAME = process.env.MCP_SERVER_NAME || 'crm-appointments-server';
const SERVER_VERSION = process.env.MCP_SERVER_VERSION || '1.0.0';

async function main() {
  logger.info('Starting Appointments MCP Server', {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  try {
    initializeSupabase();
    logger.info('Supabase initialized successfully');
  } catch (error: any) {
    logger.error('Failed to initialize Supabase', { error: error.message });
    process.exit(1);
  }

  const activeAgent = await getActiveAgent();
  if (activeAgent) {
    logger.info('Active agent found', { id: activeAgent.id, name: activeAgent.name });
  } else {
    logger.warn('No active agents found - operations will require agent_id in arguments');
  }

  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {},
      },
    }
  );

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    logger.debug('Handling list resources request');
    return { resources };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    logger.debug('Handling read resource request', { uri: request.params.uri });
    return await readResource(request.params.uri);
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('Handling list tools request');
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.debug('Handling call tool request', { name, args });

    let agentId = (args as any).agent_id;
    let agentName = (args as any).agent_name || 'Unknown Agent';

    if (!agentId) {
      logger.debug('No agent_id in arguments, fetching from database');
      const activeAgent = await getActiveAgent();
      if (activeAgent) {
        agentId = activeAgent.id;
        agentName = activeAgent.name;
        logger.debug('Using active agent from database', { agentId, agentName });
      } else {
        const error = 'No agent_id provided and no active agents found in database';
        logger.error(error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'MISSING_AGENT_ID',
                  message: error,
                  hint: 'Create an active AI agent in the CRM or provide agent_id in tool arguments',
                },
              }),
            },
          ],
        };
      }
    }

    const result = await callTool(name, args, agentId, agentName);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    logger.debug('Handling list prompts request');
    return { prompts };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.debug('Handling get prompt request', { name, args });
    return await getPrompt(name, args || {});
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Appointments MCP Server is running and ready to accept connections');

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully');
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error('Fatal error', { error: error.message, stack: error.stack });
  process.exit(1);
});
