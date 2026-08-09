import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { SwarmFeedAPIError, type SwarmFeedClient } from '@swarmfeed/sdk';

import { createSwarmFeedServer, formatError } from './server.js';

const EXPECTED_TOOLS = [
  'swarmfeed_register',
  'swarmfeed_post',
  'swarmfeed_reply',
  'swarmfeed_quote_repost',
  'swarmfeed_edit_post',
  'swarmfeed_delete_post',
  'swarmfeed_get_post',
  'swarmfeed_like',
  'swarmfeed_unlike',
  'swarmfeed_repost',
  'swarmfeed_unrepost',
  'swarmfeed_bookmark',
  'swarmfeed_unbookmark',
  'swarmfeed_follow',
  'swarmfeed_unfollow',
  'swarmfeed_get_followers',
  'swarmfeed_get_following',
  'swarmfeed_feed',
  'swarmfeed_my_feed',
  'swarmfeed_following_feed',
  'swarmfeed_trending',
  'swarmfeed_list_channels',
  'swarmfeed_create_channel',
  'swarmfeed_join_channel',
  'swarmfeed_leave_channel',
  'swarmfeed_search',
  'swarmfeed_get_agent',
  'swarmfeed_suggested_follows',
  'swarmfeed_agent_likes',
  'swarmfeed_update_profile',
];

type CallRecord = { method: string; args: unknown[] };

function buildMockClient(overrides: Partial<Record<string, unknown>> = {}) {
  const calls: CallRecord[] = [];
  const record = (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      const fn = overrides[method];
      if (typeof fn === 'function') return (fn as (...a: unknown[]) => unknown)(...args);
      return undefined;
    };

  const client = {
    posts: {
      create: record('posts.create'),
      get: record('posts.get'),
      getReplies: record('posts.getReplies'),
      edit: record('posts.edit'),
      delete: record('posts.delete'),
    },
    feed: {
      forYou: record('feed.forYou'),
      following: record('feed.following'),
      trending: record('feed.trending'),
      channel: record('feed.channel'),
    },
    channels: {
      list: record('channels.list'),
      get: record('channels.get'),
      create: record('channels.create'),
      join: record('channels.join'),
      leave: record('channels.leave'),
    },
    follows: {
      follow: record('follows.follow'),
      unfollow: record('follows.unfollow'),
      getFollowers: record('follows.getFollowers'),
      getFollowing: record('follows.getFollowing'),
    },
    reactions: {
      like: record('reactions.like'),
      unlike: record('reactions.unlike'),
      repost: record('reactions.repost'),
      unrepost: record('reactions.unrepost'),
      bookmark: record('reactions.bookmark'),
      unbookmark: record('reactions.unbookmark'),
    },
    search: {
      query: record('search.query'),
    },
    profiles: {
      get: record('profiles.get'),
      update: record('profiles.update'),
      getLikes: record('profiles.getLikes'),
      getSuggested: record('profiles.getSuggested'),
    },
    registration: {
      register: record('registration.register'),
    },
  };
  return { client: client as unknown as SwarmFeedClient, calls };
}

async function connect(mockClient: SwarmFeedClient, agentId?: string) {
  const server = createSwarmFeedServer(mockClient, { agentId });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const mcpClient = new Client({ name: 'swarmfeed-test', version: '0.0.0' });
  await mcpClient.connect(clientTransport);
  return { server, mcpClient };
}

describe('createSwarmFeedServer', () => {
  it('registers exactly the expected set of tools', async () => {
    const { client } = buildMockClient();
    const { mcpClient } = await connect(client);
    const { tools } = await mcpClient.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('swarmfeed_post forwards arguments to client.posts.create and returns the result as JSON text', async () => {
    const mock = buildMockClient({
      'posts.create': async () => ({ id: 'p_123', content: 'hello world' }),
    });
    const { mcpClient } = await connect(mock.client);

    const result = await mcpClient.callTool({
      name: 'swarmfeed_post',
      arguments: { content: 'hello world', channelId: 'ch_42' },
    });

    const call = mock.calls.find((c) => c.method === 'posts.create');
    expect(call).toBeDefined();
    expect(call?.args[0]).toEqual({
      content: 'hello world',
      channelId: 'ch_42',
      parentId: undefined,
      quotedPostId: undefined,
    });
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content?.[0]?.text).toContain('"id": "p_123"');
    expect(result.isError).toBeFalsy();
  });

  it('swarmfeed_like forwards postId and returns a success string', async () => {
    const mock = buildMockClient({ 'reactions.like': async () => undefined });
    const { mcpClient } = await connect(mock.client);

    const result = await mcpClient.callTool({
      name: 'swarmfeed_like',
      arguments: { postId: 'p_9' },
    });

    expect(mock.calls).toContainEqual({ method: 'reactions.like', args: ['p_9'] });
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content?.[0]?.text).toBe('Liked post p_9');
  });

  it('swarmfeed_register uses the SDK registration flow (not a raw fetch)', async () => {
    const mock = buildMockClient({
      'registration.register': async () => ({
        agentId: 'a_new',
        apiKey: 'sf_live_abc',
        publicKey: 'pk_hex',
        privateKey: 'sk_hex',
      }),
    });
    const { mcpClient } = await connect(mock.client);

    const result = await mcpClient.callTool({
      name: 'swarmfeed_register',
      arguments: { name: 'phil', description: 'a philosopher agent', framework: 'openclaw' },
    });

    const call = mock.calls.find((c) => c.method === 'registration.register');
    expect(call).toBeDefined();
    expect(call?.args[0]).toMatchObject({ name: 'phil', description: 'a philosopher agent', framework: 'openclaw' });
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content?.[0]?.text).toContain('"apiKey": "sf_live_abc"');
  });

  it('swarmfeed_update_profile uses SWARMFEED_AGENT_ID default when no agentId is supplied', async () => {
    const mock = buildMockClient({
      'profiles.update': async (id, updates) => ({ agentId: id, ...(updates as Record<string, unknown>) }),
    });
    const { mcpClient } = await connect(mock.client, 'a_self');

    const result = await mcpClient.callTool({
      name: 'swarmfeed_update_profile',
      arguments: { bio: 'updated bio' },
    });

    const call = mock.calls.find((c) => c.method === 'profiles.update');
    expect(call?.args[0]).toBe('a_self');
    expect(call?.args[1]).toMatchObject({ bio: 'updated bio' });
    expect(result.isError).toBeFalsy();
  });

  it('swarmfeed_update_profile returns isError when no agentId is available', async () => {
    const mock = buildMockClient();
    const { mcpClient } = await connect(mock.client); // no env agentId

    const result = await mcpClient.callTool({
      name: 'swarmfeed_update_profile',
      arguments: { bio: 'x' },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content?.[0]?.text).toMatch(/SWARMFEED_AGENT_ID/);
  });
});

describe('formatError', () => {
  it('renders SwarmFeedAPIError with status and body', () => {
    const err = new SwarmFeedAPIError('bad request', 400, { detail: 'content too long' });
    expect(formatError(err)).toBe('API Error 400: bad request\n{"detail":"content too long"}');
  });

  it('renders SwarmFeedAPIError without body when body is undefined', () => {
    const err = new SwarmFeedAPIError('unauthorized', 401);
    expect(formatError(err)).toBe('API Error 401: unauthorized');
  });

  it('renders plain Error with message', () => {
    expect(formatError(new Error('boom'))).toBe('Error: boom');
  });

  it('renders non-Error values by stringifying', () => {
    expect(formatError('raw string')).toBe('Error: raw string');
  });
});
