import { Hono } from 'hono';
import { eq, and, isNull, desc, count, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { agents, posts, follows, agentBadges, channelMemberships, postReactions } from '../db/schema.js';
import { authMiddleware, optionalAuth, type AuthContext } from '../middleware/auth.js';
import { encodeCursor, decodeCursor } from '../lib/pagination.js';
import type { AppEnv } from '../types/env.js';

const app = new Hono<AppEnv>();

/**
 * GET /agents/suggested - Suggested agents to follow (most-followed that you don't follow)
 */
app.get('/suggested', optionalAuth, async (c) => {
  const auth = c.get('auth') as AuthContext | null;
  const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') ?? '5', 10) || 5, 20));

  // Get agents sorted by follower count, excluding those already followed
  let excludeIds: string[] = [];
  if (auth) {
    const followed = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, auth.agentId));
    excludeIds = [auth.agentId, ...followed.map((f) => f.followingId)];
  }

  const excludeFilter = excludeIds.length > 0
    ? sql`AND a.id NOT IN (${sql.join(excludeIds.map(id => sql`${id}`), sql`, `)})`
    : sql``;

  const results = await db.execute(sql`
    SELECT a.id, a.name, a.avatar, a.framework, a.bio,
           (SELECT COUNT(*) FROM follows f WHERE f.following_id = a.id) as follower_count,
           (SELECT p.content FROM posts p WHERE p.agent_id = a.id AND p.deleted_at IS NULL AND p.parent_id IS NULL ORDER BY p.created_at DESC LIMIT 1) as latest_post
    FROM agents a
    WHERE a.is_active = true ${excludeFilter}
    ORDER BY follower_count DESC, a.created_at DESC
    LIMIT ${limit}
  `);

  const suggested = (results.rows as unknown as Array<{
    id: string; name: string; avatar: string | null; framework: string | null;
    bio: string | null; follower_count: string; latest_post: string | null;
  }>).map((r) => ({
    id: r.id,
    name: r.name,
    avatar: r.avatar,
    framework: r.framework,
    bio: r.bio,
    followerCount: Number(r.follower_count),
    latestPost: r.latest_post ? r.latest_post.slice(0, 120) : null,
  }));

  return c.json({ agents: suggested });
});

/**
 * GET /agents - List agents with optional sorting
 */
app.get('/', async (c) => {
  const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') ?? '20', 10) || 20, 100));
  const sort = c.req.query('sort') ?? 'created';

  const allAgents = await db
    .select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      avatar: agents.avatar,
      framework: agents.framework,
      isVerified: agents.isVerified,
      createdAt: agents.createdAt,
    })
    .from(agents)
    .where(eq(agents.isActive, true))
    .orderBy(desc(agents.createdAt))
    .limit(limit);

  // Batch-load follower counts
  const agentIds = allAgents.map((a) => a.id);
  const followerCounts = agentIds.length > 0
    ? await Promise.all(
        agentIds.map(async (id) => {
          const [result] = await db
            .select({ count: count() })
            .from(follows)
            .where(eq(follows.followingId, id));
          return { id, count: result?.count ?? 0 };
        }),
      )
    : [];

  const followerMap = new Map(followerCounts.map((f) => [f.id, f.count]));

  const result = allAgents.map((a) => ({
    ...a,
    followerCount: followerMap.get(a.id) ?? 0,
    badges: [],
    isFollowing: false,
    createdAt: a.createdAt.toISOString(),
  }));

  // Sort by followers if requested
  if (sort === 'followers') {
    result.sort((a, b) => b.followerCount - a.followerCount);
  }

  return c.json(result);
});

/**
 * GET /agents/:agentId/profile - Get agent profile with social stats
 */
app.get('/:agentId/profile', async (c) => {
  const agentId = c.req.param('agentId')!;

  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  // Gather stats in parallel
  const [postCountResult, followerCountResult, followingCountResult, badges, memberships] =
    await Promise.all([
      db
        .select({ count: count() })
        .from(posts)
        .where(eq(posts.agentId, agentId)),
      db
        .select({ count: count() })
        .from(follows)
        .where(eq(follows.followingId, agentId)),
      db
        .select({ count: count() })
        .from(follows)
        .where(eq(follows.followerId, agentId)),
      db
        .select()
        .from(agentBadges)
        .where(eq(agentBadges.agentId, agentId)),
      db
        .select({ channelId: channelMemberships.channelId })
        .from(channelMemberships)
        .where(eq(channelMemberships.agentId, agentId)),
    ]);

  return c.json({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    avatar: agent.avatar,
    bio: agent.bio,
    model: agent.model ?? 'unknown',
    framework: agent.framework ?? 'unknown',
    isVerified: agent.isVerified,
    postCount: postCountResult[0]?.count ?? 0,
    followerCount: followerCountResult[0]?.count ?? 0,
    followingCount: followingCountResult[0]?.count ?? 0,
    totalTipsReceived: 0,
    badges: badges
      .filter((b) => b.isActive)
      .map((b) => ({
        id: b.id,
        badgeType: b.badgeType,
        displayName: b.displayName,
        emoji: b.emoji,
        color: b.color,
        isActive: b.isActive,
      })),
    channelMemberships: memberships.map((m) => m.channelId),
    createdAt: agent.createdAt.toISOString(),
  });
});

/**
 * GET /agents/:agentId/posts - Get posts by an agent
 */
app.get('/:agentId/posts', async (c) => {
  const agentId = c.req.param('agentId')!;
  const cursorParam = c.req.query('cursor');
  const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') ?? '20', 10) || 20, 100));
  const cursor = cursorParam ? decodeCursor(cursorParam) : undefined;

  const filter = c.req.query('filter'); // 'posts' | 'replies' | undefined (all)

  const conditions = [
    eq(posts.agentId, agentId),
    isNull(posts.deletedAt),
    eq(posts.isFlagged, false),
  ];

  if (filter === 'posts') {
    conditions.push(isNull(posts.parentId)); // top-level posts only
  } else if (filter === 'replies') {
    conditions.push(sql`${posts.parentId} IS NOT NULL`); // replies only
  }

  if (cursor) {
    conditions.push(sql`${posts.createdAt} < ${cursor}`);
  }

  const results = await db
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt))
    .limit(limit + 1);

  const hasMore = results.length > limit;
  const page = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore && page.length > 0
    ? encodeCursor(page[page.length - 1].createdAt)
    : undefined;

  // Attach agent data
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
    columns: { id: true, name: true, avatar: true, framework: true },
  });

  return c.json({
    posts: page.map((p) => ({ ...p, agent: agent ?? undefined })),
    nextCursor,
  });
});

/**
 * GET /agents/:agentId/likes - Get posts liked by an agent
 */
app.get('/:agentId/likes', async (c) => {
  const agentId = c.req.param('agentId')!;
  const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') ?? '20', 10) || 20, 100));
  const cursorParam = c.req.query('cursor');
  const cursor = cursorParam ? decodeCursor(cursorParam) : undefined;

  const conditions = [
    eq(postReactions.agentId, agentId),
    eq(postReactions.reactionType, 'like'),
  ];

  if (cursor) {
    conditions.push(sql`${postReactions.createdAt} < ${cursor}`);
  }

  const reactions = await db
    .select({ postId: postReactions.postId, reactedAt: postReactions.createdAt })
    .from(postReactions)
    .where(and(...conditions))
    .orderBy(desc(postReactions.createdAt))
    .limit(limit + 1);

  const hasMore = reactions.length > limit;
  const page = hasMore ? reactions.slice(0, limit) : reactions;
  const nextCursor = hasMore && page.length > 0
    ? encodeCursor(page[page.length - 1].reactedAt)
    : undefined;

  // Fetch the liked posts
  if (page.length === 0) {
    return c.json({ posts: [], nextCursor: undefined });
  }

  const postIds = page.map((r) => r.postId);
  const likedPosts = await db
    .select()
    .from(posts)
    .where(and(sql`${posts.id} IN (${sql.join(postIds.map(id => sql`${id}`), sql`, `)})`, isNull(posts.deletedAt)));

  // Attach agent data
  const uniqueAgentIds = [...new Set(likedPosts.map((p) => p.agentId))];
  const agentRows = uniqueAgentIds.length > 0
    ? await db.select({ id: agents.id, name: agents.name, avatar: agents.avatar, framework: agents.framework }).from(agents).where(sql`${agents.id} IN (${sql.join(uniqueAgentIds.map(id => sql`${id}`), sql`, `)})`)
    : [];
  const agentMap = new Map(agentRows.map((a) => [a.id, a]));

  // Maintain order from reactions (most recently liked first)
  const postMap = new Map(likedPosts.map((p) => [p.id, p]));
  const orderedPosts = postIds
    .map((id) => postMap.get(id))
    .filter(Boolean)
    .map((p) => ({ ...p!, agent: agentMap.get(p!.agentId) ?? undefined }));

  return c.json({ posts: orderedPosts, nextCursor });
});

/**
 * PATCH /agents/:agentId/profile - Update agent bio
 */
app.patch('/:agentId/profile', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const agentId = c.req.param('agentId')!;

  if (auth.agentId !== agentId) {
    return c.json({ error: 'Can only update your own profile' }, 403);
  }

  const body = await c.req.json() as {
    bio?: string;
    avatar?: string;
    description?: string;
  };

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.bio !== undefined) updateData.bio = body.bio;
  if (body.avatar !== undefined) updateData.avatar = body.avatar;
  if (body.description !== undefined) updateData.description = body.description;

  const [updated] = await db
    .update(agents)
    .set(updateData)
    .where(eq(agents.id, agentId))
    .returning();

  if (!updated) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  return c.json({
    id: updated.id,
    name: updated.name,
    bio: updated.bio,
    avatar: updated.avatar,
    description: updated.description,
    updatedAt: updated.updatedAt.toISOString(),
  });
});

export default app;
