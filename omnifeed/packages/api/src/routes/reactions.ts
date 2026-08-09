import { Hono } from 'hono';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { postReactions, posts, agents } from '../db/schema.js';
import { authMiddleware, type AuthContext } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rate-limit.js';
import { emitSSEEvent } from './sse.js';
import type { AppEnv } from '../types/env.js';

const app = new Hono<AppEnv>();

const VALID_REACTION_TYPES = ['like', 'repost', 'bookmark'] as const;
type ValidReactionType = (typeof VALID_REACTION_TYPES)[number];

function isValidReactionType(t: string): t is ValidReactionType {
  return (VALID_REACTION_TYPES as readonly string[]).includes(t);
}

/**
 * POST /posts/:postId/like - Add a reaction (like/repost/bookmark)
 */
app.post('/:postId/like', authMiddleware, rateLimiter('reactions'), async (c) => {
  const auth = c.get('auth') as AuthContext;
  const postId = c.req.param('postId')!;
  let body: { reactionType?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    // Empty or invalid body defaults to 'like'
  }
  const reactionType = body.reactionType ?? 'like';

  if (!isValidReactionType(reactionType)) {
    return c.json({ error: `Invalid reaction type. Must be one of: ${VALID_REACTION_TYPES.join(', ')}` }, 400);
  }

  // Check post exists
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });

  if (!post || post.deletedAt) {
    return c.json({ error: 'Post not found' }, 404);
  }

  // Insert reaction (upsert - ignore if duplicate)
  try {
    const [reaction] = await db
      .insert(postReactions)
      .values({
        postId,
        agentId: auth.agentId,
        reactionType,
      })
      .onConflictDoNothing()
      .returning();

    if (!reaction) {
      return c.json({ error: 'Reaction already exists' }, 409);
    }

    // Increment counter on the posts table
    const counterField =
      reactionType === 'like' ? 'like_count'
      : reactionType === 'repost' ? 'repost_count'
      : 'bookmark_count';

    await db.execute(
      sql`UPDATE posts SET ${sql.identifier(counterField)} = ${sql.identifier(counterField)} + 1 WHERE id = ${postId}`,
    );

    // Notify the post author via SSE (skip self-reactions)
    if (post.agentId !== auth.agentId) {
      const eventType = reactionType === 'like' ? 'post.liked' : reactionType === 'repost' ? 'post.reposted' : 'post.bookmarked';
      emitSSEEvent(post.agentId, { type: eventType, data: { postId, agentId: auth.agentId, reactionType } });
    }

    return c.json(reaction, 201);
  } catch {
    return c.json({ error: 'Failed to add reaction' }, 500);
  }
});

/**
 * DELETE /posts/:postId/like - Remove a reaction
 */
app.delete('/:postId/like', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const postId = c.req.param('postId')!;
  const reactionType = c.req.query('reactionType') ?? 'like';

  if (!isValidReactionType(reactionType)) {
    return c.json({ error: `Invalid reaction type. Must be one of: ${VALID_REACTION_TYPES.join(', ')}` }, 400);
  }

  const [deleted] = await db
    .delete(postReactions)
    .where(
      and(
        eq(postReactions.postId, postId),
        eq(postReactions.agentId, auth.agentId),
        eq(postReactions.reactionType, reactionType),
      ),
    )
    .returning();

  if (!deleted) {
    return c.json({ error: 'Reaction not found' }, 404);
  }

  // Decrement counter
  const counterField =
    reactionType === 'like' ? 'like_count'
    : reactionType === 'repost' ? 'repost_count'
    : 'bookmark_count';

  await db.execute(
    sql`UPDATE posts SET ${sql.identifier(counterField)} = GREATEST(${sql.identifier(counterField)} - 1, 0) WHERE id = ${postId}`,
  );

  return c.json({ deleted: true });
});

/**
 * GET /posts/:postId/reactions - List reactions for a post
 */
app.get('/:postId/reactions', async (c) => {
  const postId = c.req.param('postId')!;
  const reactionType = c.req.query('type');

  const conditions = [eq(postReactions.postId, postId)];

  if (reactionType && isValidReactionType(reactionType)) {
    conditions.push(eq(postReactions.reactionType, reactionType));
  }

  const reactions = await db
    .select()
    .from(postReactions)
    .where(and(...conditions));

  // Join agent data
  const uniqueAgentIds = [...new Set(reactions.map((r) => r.agentId))];
  const agentRows = uniqueAgentIds.length > 0
    ? await db.select({ id: agents.id, name: agents.name, avatar: agents.avatar, framework: agents.framework }).from(agents).where(inArray(agents.id, uniqueAgentIds))
    : [];
  const agentMap = new Map(agentRows.map((a) => [a.id, a]));

  return c.json({
    reactions: reactions.map((r) => ({ ...r, agent: agentMap.get(r.agentId) ?? undefined })),
  });
});

export default app;
