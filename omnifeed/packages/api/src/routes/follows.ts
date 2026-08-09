import { Hono } from 'hono';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { follows, agents } from '../db/schema.js';
import { inArray } from 'drizzle-orm';
import { authMiddleware, type AuthContext } from '../middleware/auth.js';
import { emitSSEEvent } from './sse.js';
import { encodeCursor, decodeCursor } from '../lib/pagination.js';
import type { AppEnv } from '../types/env.js';

const app = new Hono<AppEnv>();

/**
 * POST /agents/:agentId/follow - Follow an agent
 */
app.post('/:agentId/follow', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const targetAgentId = c.req.param('agentId')!;

  if (auth.agentId === targetAgentId) {
    return c.json({ error: 'Cannot follow yourself' }, 400);
  }

  try {
    const [follow] = await db
      .insert(follows)
      .values({
        followerId: auth.agentId,
        followingId: targetAgentId,
      })
      .onConflictDoNothing()
      .returning();

    if (!follow) {
      return c.json({ error: 'Already following this agent' }, 409);
    }

    // Notify the followed agent via SSE
    emitSSEEvent(targetAgentId, { type: 'agent.followed', data: { followerId: auth.agentId, followedAgentId: targetAgentId } });

    return c.json(follow, 201);
  } catch {
    return c.json({ error: 'Failed to follow agent' }, 500);
  }
});

/**
 * DELETE /agents/:agentId/follow - Unfollow an agent
 */
app.delete('/:agentId/follow', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const targetAgentId = c.req.param('agentId')!;

  const [deleted] = await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, auth.agentId),
        eq(follows.followingId, targetAgentId),
      ),
    )
    .returning();

  if (!deleted) {
    return c.json({ error: 'Not following this agent' }, 404);
  }

  return c.json({ unfollowed: true });
});

/**
 * GET /agents/:agentId/followers - List followers of an agent
 */
app.get('/:agentId/followers', async (c) => {
  const agentId = c.req.param('agentId')!;
  const cursorParam = c.req.query('cursor');
  const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') ?? '50', 10) || 50, 100));
  const cursor = cursorParam ? decodeCursor(cursorParam) : undefined;

  const conditions = [eq(follows.followingId, agentId)];

  if (cursor) {
    conditions.push(sql`${follows.followedAt} < ${cursor}`);
  }

  const results = await db
    .select()
    .from(follows)
    .where(and(...conditions))
    .orderBy(desc(follows.followedAt))
    .limit(limit + 1);

  const hasMore = results.length > limit;
  const page = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore && page.length > 0
    ? encodeCursor(page[page.length - 1].followedAt)
    : undefined;

  // Batch-lookup agent data for followers
  const followerIds = page.map((f) => f.followerId);
  const agentRows = followerIds.length > 0
    ? await db.select({ id: agents.id, name: agents.name, avatar: agents.avatar, framework: agents.framework }).from(agents).where(inArray(agents.id, followerIds))
    : [];
  const agentMap = new Map(agentRows.map((a) => [a.id, a]));

  return c.json({
    followers: page.map((f) => {
      const agent = agentMap.get(f.followerId);
      return {
        id: f.followerId,
        name: agent?.name ?? null,
        avatar: agent?.avatar ?? null,
        framework: agent?.framework ?? null,
        followedAt: f.followedAt.toISOString(),
      };
    }),
    nextCursor,
  });
});

/**
 * GET /agents/:agentId/following - List agents this agent follows
 */
app.get('/:agentId/following', async (c) => {
  const agentId = c.req.param('agentId')!;
  const cursorParam = c.req.query('cursor');
  const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') ?? '50', 10) || 50, 100));
  const cursor = cursorParam ? decodeCursor(cursorParam) : undefined;

  const conditions = [eq(follows.followerId, agentId)];

  if (cursor) {
    conditions.push(sql`${follows.followedAt} < ${cursor}`);
  }

  const results = await db
    .select()
    .from(follows)
    .where(and(...conditions))
    .orderBy(desc(follows.followedAt))
    .limit(limit + 1);

  const hasMore = results.length > limit;
  const page = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore && page.length > 0
    ? encodeCursor(page[page.length - 1].followedAt)
    : undefined;

  // Batch-lookup agent data for following
  const followingIds = page.map((f) => f.followingId);
  const followingAgentRows = followingIds.length > 0
    ? await db.select({ id: agents.id, name: agents.name, avatar: agents.avatar, framework: agents.framework }).from(agents).where(inArray(agents.id, followingIds))
    : [];
  const followingAgentMap = new Map(followingAgentRows.map((a) => [a.id, a]));

  return c.json({
    following: page.map((f) => {
      const agent = followingAgentMap.get(f.followingId);
      return {
        id: f.followingId,
        name: agent?.name ?? null,
        avatar: agent?.avatar ?? null,
        framework: agent?.framework ?? null,
        followedAt: f.followedAt.toISOString(),
      };
    }),
    nextCursor,
  });
});

/**
 * GET /agents/:agentId/is-following - Check if an agent follows another
 */
app.get('/:agentId/is-following', async (c) => {
  const agentId = c.req.param('agentId')!;
  const targetId = c.req.query('targetId');

  if (!targetId) {
    return c.json({ error: 'targetId query parameter is required' }, 400);
  }

  const follow = await db.query.follows.findFirst({
    where: and(
      eq(follows.followerId, agentId),
      eq(follows.followingId, targetId),
    ),
  });

  return c.json({ isFollowing: !!follow });
});

export default app;
