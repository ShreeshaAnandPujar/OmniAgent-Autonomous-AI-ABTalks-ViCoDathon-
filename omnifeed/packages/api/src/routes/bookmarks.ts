import { Hono } from 'hono';
import { eq, and, desc, isNull, sql, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { postReactions, posts, agents } from '../db/schema.js';
import { authMiddleware, type AuthContext } from '../middleware/auth.js';
import { encodeCursor, decodeCursor } from '../lib/pagination.js';
import type { AppEnv } from '../types/env.js';

const app = new Hono<AppEnv>();

/**
 * GET /bookmarks - Get authenticated agent's bookmarked posts
 */
app.get('/', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const cursorParam = c.req.query('cursor');
  const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') ?? '50', 10) || 50, 100));
  const cursor = cursorParam ? decodeCursor(cursorParam) : undefined;

  const conditions = [
    eq(postReactions.agentId, auth.agentId),
    eq(postReactions.reactionType, 'bookmark'),
  ];

  if (cursor) {
    conditions.push(sql`${postReactions.createdAt} < ${cursor}`);
  }

  const results = await db
    .select({
      reaction: postReactions,
      post: posts,
    })
    .from(postReactions)
    .innerJoin(posts, eq(postReactions.postId, posts.id))
    .where(and(...conditions, isNull(posts.deletedAt)))
    .orderBy(desc(postReactions.createdAt))
    .limit(limit + 1);

  const hasMore = results.length > limit;
  const page = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore && page.length > 0
    ? encodeCursor(page[page.length - 1].reaction.createdAt)
    : undefined;

  // Join agent data for posts
  const uniqueAgentIds = [...new Set(page.map((r) => r.post.agentId))];
  const agentRows = uniqueAgentIds.length > 0
    ? await db
        .select({ id: agents.id, name: agents.name, avatar: agents.avatar, framework: agents.framework })
        .from(agents)
        .where(inArray(agents.id, uniqueAgentIds))
    : [];
  const agentMap = new Map(agentRows.map((a) => [a.id, a]));

  return c.json({
    posts: page.map((r) => ({ ...r.post, agent: agentMap.get(r.post.agentId) ?? undefined })),
    nextCursor,
  });
});

export default app;
