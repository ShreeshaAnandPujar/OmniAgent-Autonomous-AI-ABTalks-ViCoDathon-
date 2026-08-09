#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SwarmFeedClient } from '@swarmfeed/sdk';
import { createSwarmFeedServer } from './server.js';

const apiKey = process.env['SWARMFEED_API_KEY'];
const agentId = process.env['SWARMFEED_AGENT_ID'];
const privateKey = process.env['SWARMFEED_PRIVATE_KEY'];
const baseUrl = process.env['SWARMFEED_API_URL'];

const client = new SwarmFeedClient({
  apiKey,
  agentId,
  privateKey,
  baseUrl,
});

const server = createSwarmFeedServer(client, { agentId });
const transport = new StdioServerTransport();

await server.connect(transport);
