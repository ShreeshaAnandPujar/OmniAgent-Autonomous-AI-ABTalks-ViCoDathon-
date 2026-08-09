import { Hono } from 'hono';
import { ilike, or, isNull, and, eq, desc, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { posts, channels, hashtags, agents } from '../db/schema.js';
import type { AppEnv } from '../types/env.js';

const app = new Hono<AppEnv>();

/**
 * GET /search - Full-text search using SQL ILIKE
 * Query params: q (required), type (posts|channels|hashtags), limit, offset
 */
app.get('/', async (c) => {
  const query = c.req.query('q');

  if (!query || query.trim().length === 0) {
    return c.json({ error: 'Query parameter "q" is required' }, 400);
  }

  const searchType = c.req.query('type') ?? 'posts';
  const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') ?? '20', 10) || 20, 100));
  const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0', 10) || 0);
  const pattern = query === '*' ? '%' : `%${query}%`;

  const results: {
    posts?: Array<Record<string, unknown>>;
    agents?: Array<Record<string, unknown>>;
    channels?: Array<Record<string, unknown>>;
    hashtags?: Array<Record<string, unknown>>;
    total: number;
  } = { total: 0 };

  if (searchType === 'posts' || searchType === 'all') {
    const matchedPosts = await db
      .select()
      .from(posts)
      .where(
        and(
          ilike(posts.content, pattern),
          isNull(posts.deletedAt),
          eq(posts.isFlagged, false),
        ),
      )
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);

    // Join agent data
    const uniqueAgentIds = [...new Set(matchedPosts.map((p) => p.agentId))];
    const agentRows = uniqueAgentIds.length > 0
      ? await db.select({ id: agents.id, name: agents.name, avatar: agents.avatar, framework: agents.framework }).from(agents).where(inArray(agents.id, uniqueAgentIds))
      : [];
    const agentMap = new Map(agentRows.map((a) => [a.id, a]));

    results.posts = matchedPosts.map((p) => ({ ...p, agent: agentMap.get(p.agentId) ?? undefined }));
    results.total += matchedPosts.length;
  }

  if (searchType === 'agents' || searchType === 'all') {
    const matchedAgents = await db
      .select({
        id: agents.id,
        name: agents.name,
        avatar: agents.avatar,
        framework: agents.framework,
        bio: agents.bio,
        description: agents.description,
      })
      .from(agents)
      .where(
        and(
          or(
            ilike(agents.name, pattern),
            ilike(agents.id, pattern),
            ilike(agents.bio, pattern),
          ),
          eq(agents.isActive, true),
        ),
      )
      .limit(limit)
      .offset(offset);

    results.agents = matchedAgents;
    results.total += matchedAgents.length;
  }

  if (searchType === 'channels' || searchType === 'all') {
    const matchedChannels = await db
      .select()
      .from(channels)
      .where(
        or(
          ilike(channels.handle, pattern),
          ilike(channels.displayName, pattern),
          ilike(channels.description, pattern),
        ),
      )
      .limit(limit)
      .offset(offset);

    results.channels = matchedChannels;
    results.total += matchedChannels.length;
  }

  if (searchType === 'hashtags' || searchType === 'all') {
    const matchedHashtags = await db
      .select()
      .from(hashtags)
      .where(ilike(hashtags.tag, pattern))
      .orderBy(desc(hashtags.postCount))
      .limit(limit)
      .offset(offset);

    results.hashtags = matchedHashtags;
    results.total += matchedHashtags.length;
  }

  return c.json(results);
});

export default app;
