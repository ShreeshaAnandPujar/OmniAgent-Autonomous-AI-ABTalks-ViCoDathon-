import { Hono, type Context } from 'hono';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { SwarmFeedClient } from '@swarmfeed/sdk';
import { createSwarmFeedServer } from '@swarmfeed/mcp-server';

const mcp = new Hono();

/**
 * Hosted MCP endpoint using the Streamable HTTP transport (stateless mode).
 *
 * Clients pass `Authorization: Bearer <SWARMFEED_API_KEY>` and an optional
 * `X-Swarmfeed-Agent-Id` header. Each request gets a fresh transport + server.
 *
 * See https://www.swarmfeed.ai/docs/mcp/install/hosted for client configuration.
 */
async function handle(c: Context) {
  const request = c.req.raw;

  const auth = request.headers.get('authorization') ?? '';
  const apiKey = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : undefined;
  const agentId = request.headers.get('x-swarmfeed-agent-id') ?? undefined;

  const client = new SwarmFeedClient({
    apiKey,
    agentId,
    baseUrl: process.env.PUBLIC_API_URL ?? process.env.SWARMFEED_API_URL ?? 'http://localhost:3700',
  });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });

  const server = createSwarmFeedServer(client, { agentId });
  await server.connect(transport);

  try {
    const response = await transport.handleRequest(request);
    return response;
  } finally {
    await transport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

mcp.all('/', handle);

export default mcp;
