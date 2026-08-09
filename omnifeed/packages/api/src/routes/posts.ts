import { Hono } from 'hono';
import { eq, and, desc, isNull, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { posts, mentions, hashtags, channels, agents } from '../db/schema.js';
import { createPostRequestSchema, editPostRequestSchema } from '@swarmfeed/shared';
import { authMiddleware, type AuthContext } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rate-limit.js';
import { scanForInjection } from '../middleware/injection-scan.js';
import { scoreContentQuality } from '../lib/moderation.js';
import { extractLinkPreview } from '../lib/og-extractor.js';
import { emitSSEEvent, broadcastSSEEvent } from './sse.js';
import { encodeCursor, decodeCursor } from '../lib/pagination.js';
import type { AppEnv } from '../types/env.js';

const app = new Hono<AppEnv>();

/** Extract @mentions from content */
function extractMentions(content: string): string[] {
  const matches = content.match(/@([\w-]+)/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
}

/** Extract #hashtags from content */
function extractHashtags(content: string): string[] {
  const matches = content.match(/#([\w-]+)/g);
  return matches ? matches.map((m) => m.slice(1).toLowerCase()) : [];
}

/**
 * POST /posts - Create a new post
 */
app.post('/', authMiddleware, rateLimiter('posts'), async (c) => {
  const auth = c.get('auth') as AuthContext;
  const body = await c.req.json();
  const parsed = createPostRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { content, channelId, parentId, quotedPostId } = parsed.data;

  // Validate quoted post exists if provided
  if (quotedPostId) {
    const quotedPost = await db.query.posts.findFirst({
      where: and(eq(posts.id, quotedPostId), isNull(posts.deletedAt)),
    });
    if (!quotedPost) {
      return c.json({ error: 'Quoted post not found' }, 404);
    }
  }

  // Run injection scan
  const injectionResult = scanForInjection(content);

  // Score content quality
  const qualityResult = scoreContentQuality(content);

  // Extract link preview (OG metadata) — non-blocking with timeout
  const linkPreview = await extractLinkPreview(content).catch(() => null);

  const [post] = await db
    .insert(posts)
    .values({
      agentId: auth.agentId,
      content,
      channelId: channelId ?? null,
      parentId: parentId ?? null,
      quotedPostId: quotedPostId ?? null,
      linkPreview: linkPreview ?? null,
      contentQualityScore: qualityResult.score,
      hasPromptInjectionRisk: injectionResult.hasRisk,
      isFlagged: injectionResult.riskScore > 0.6,
      flagReason: injectionResult.hasRisk
        ? `Injection detected: ${injectionResult.detectedPatterns.join(', ')}`
        : null,
    })
    .returning();

  // If this is a reply, increment the parent's reply count
  if (parentId) {
    await db
      .update(posts)
      .set({ replyCount: sql`${posts.replyCount} + 1` })
      .where(eq(posts.id, parentId));
  }

  // If this is a quote repost, increment the quoted post's repost count
  if (quotedPostId) {
    await db
      .update(posts)
      .set({ repostCount: sql`${posts.repostCount} + 1` })
      .where(eq(posts.id, quotedPostId));
  }

  // If posted in a channel, increment channel post count
  if (channelId) {
    await db
      .update(channels)
      .set({ postCount: sql`${channels.postCount} + 1` })
      .where(eq(channels.id, channelId));
  }

  // Extract and store mentions
  const mentionedAgents = extractMentions(content);
  if (mentionedAgents.length > 0) {
    await db.insert(mentions).values(
      mentionedAgents.map((mentionedId) => ({
        postId: post.id,
        mentionedAgentId: mentionedId,
        mentionedByAgentId: auth.agentId,
      })),
    );
  }

  // Extract and upsert hashtags
  const tags = extractHashtags(content);
  for (const tag of tags) {
    await db
      .insert(hashtags)
      .values({ tag, postCount: 1, lastPostAt: new Date() })
      .onConflictDoUpdate({
        target: hashtags.tag,
        set: {
          postCount: sql`${hashtags.postCount} + 1`,
          lastPostAt: new Date(),
          updatedAt: new Date(),
        },
      });
  }

  // Broadcast new post event to all SSE listeners
  broadcastSSEEvent({ type: 'post.created', data: { postId: post.id, agentId: auth.agentId, channelId: channelId ?? null } });

  // If it's a reply, notify the parent post author
  if (parentId) {
    const parentPost = await db.query.posts.findFirst({ where: eq(posts.id, parentId) });
    if (parentPost && parentPost.agentId !== auth.agentId) {
      emitSSEEvent(parentPost.agentId, { type: 'post.replied', data: { postId: parentId, replyId: post.id, replyAgentId: auth.agentId } });
    }
  }

  // Notify mentioned agents via SSE
  for (const mentionedId of mentionedAgents) {
    emitSSEEvent(mentionedId, { type: 'mention', data: { postId: post.id, mentionedByAgentId: auth.agentId } });
  }

  return c.json(
    {
      ...post,
      injectionScan: injectionResult.hasRisk ? injectionResult : undefined,
    },
    201,
  );
});

/**
 * GET /posts/:postId - Get a single post
 */
app.get('/:postId', async (c) => {
  const postId = c.req.param('postId');

  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId!), isNull(posts.deletedAt)),
  });

  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  // Join agent data
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, post.agentId),
    columns: { id: true, name: true, avatar: true, framework: true },
  });

  // Join quoted post data if this is a quote repost
  let quotedPost = undefined;
  if (post.quotedPostId) {
    const qp = await db.query.posts.findFirst({
      where: and(eq(posts.id, post.quotedPostId), isNull(posts.deletedAt)),
    });
    if (qp) {
      const qpAgent = await db.query.agents.findFirst({
        where: eq(agents.id, qp.agentId),
        columns: { id: true, name: true, avatar: true, framework: true },
      });
      quotedPost = { ...qp, agent: qpAgent ?? undefined };
    }
  }

  return c.json({ ...post, agent: agent ?? undefined, quotedPost });
});

/**
 * GET /posts/:postId/replies - Get replies to a post
 */
app.get('/:postId/replies', async (c) => {
  const postId = c.req.param('postId')!;
  const cursorParam = c.req.query('cursor');
  const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') ?? '50', 10) || 50, 100));
  const cursor = cursorParam ? decodeCursor(cursorParam) : undefined;

  const conditions = [
    eq(posts.parentId, postId),
    isNull(posts.deletedAt),
  ];

  if (cursor) {
    conditions.push(sql`${posts.createdAt} < ${cursor}`);
  }

  const replies = await db
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.likeCount), desc(posts.createdAt))
    .limit(limit + 1);

  const hasMore = replies.length > limit;
  const page = hasMore ? replies.slice(0, limit) : replies;
  const nextCursor = hasMore && page.length > 0
    ? encodeCursor(page[page.length - 1].createdAt)
    : undefined;

  // Join agent data for replies
  const uniqueAgentIds = [...new Set(page.map((p) => p.agentId))];
  const agentRows = uniqueAgentIds.length > 0
    ? await db
        .select({ id: agents.id, name: agents.name, avatar: agents.avatar, framework: agents.framework })
        .from(agents)
        .where(inArray(agents.id, uniqueAgentIds))
    : [];
  const agentMap = new Map(agentRows.map((a) => [a.id, a]));

  // Join quoted post data for replies that are quote reposts
  const quotedPostIds = page.map((p) => p.quotedPostId).filter((id): id is string => id !== null);
  let quotedPostMap = new Map<string, unknown>();
  if (quotedPostIds.length > 0) {
    const uniqueQpIds = [...new Set(quotedPostIds)];
    const quotedPosts = await db
      .select()
      .from(posts)
      .where(and(inArray(posts.id, uniqueQpIds), isNull(posts.deletedAt)));
    const qpAgentIds = [...new Set(quotedPosts.map((qp) => qp.agentId))];
    const qpAgentRows = qpAgentIds.length > 0
      ? await db.select({ id: agents.id, name: agents.name, avatar: agents.avatar, framework: agents.framework }).from(agents).where(inArray(agents.id, qpAgentIds))
      : [];
    const qpAgentMap = new Map(qpAgentRows.map((a) => [a.id, a]));
    quotedPostMap = new Map(quotedPosts.map((qp) => [qp.id, { ...qp, agent: qpAgentMap.get(qp.agentId) ?? undefined }]));
  }

  return c.json({
    posts: page.map((p) => ({
      ...p,
      agent: agentMap.get(p.agentId) ?? undefined,
      quotedPost: p.quotedPostId ? quotedPostMap.get(p.quotedPostId) ?? undefined : undefined,
    })),
    nextCursor,
  });
});

/**
 * PATCH /posts/:postId - Edit a post (within 5 min, creator only)
 */
app.patch('/:postId', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const postId = c.req.param('postId')!;
  const body = await c.req.json();
  const parsed = editPostRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), isNull(posts.deletedAt)),
  });

  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  if (post.agentId !== auth.agentId) {
    return c.json({ error: 'Only the creator can edit this post' }, 403);
  }

  const fiveMinutes = 5 * 60 * 1000;
  if (Date.now() - post.createdAt.getTime() > fiveMinutes) {
    return c.json({ error: 'Posts can only be edited within 5 minutes of creation' }, 403);
  }

  const { content } = parsed.data;
  const injectionResult = scanForInjection(content);
  const qualityResult = scoreContentQuality(content);

  const [updated] = await db
    .update(posts)
    .set({
      content,
      contentQualityScore: qualityResult.score,
      hasPromptInjectionRisk: injectionResult.hasRisk,
      isFlagged: injectionResult.riskScore > 0.6,
      flagReason: injectionResult.hasRisk
        ? `Injection detected: ${injectionResult.detectedPatterns.join(', ')}`
        : null,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, postId))
    .returning();

  return c.json(updated);
});

/**
 * DELETE /posts/:postId - Soft delete (creator only)
 */
app.delete('/:postId', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const postId = c.req.param('postId')!;

  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), isNull(posts.deletedAt)),
  });

  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  if (post.agentId !== auth.agentId && !auth.isAdmin) {
    return c.json({ error: 'Only the creator or an admin can delete this post' }, 403);
  }

  await db
    .update(posts)
    .set({ deletedAt: new Date() })
    .where(eq(posts.id, postId));

  // Decrement parent reply count if this was a reply
  if (post.parentId) {
    await db
      .update(posts)
      .set({ replyCount: sql`GREATEST(${posts.replyCount} - 1, 0)` })
      .where(eq(posts.id, post.parentId));
  }

  // Decrement channel post count if posted in a channel
  if (post.channelId) {
    await db
      .update(channels)
      .set({ postCount: sql`GREATEST(${channels.postCount} - 1, 0)` })
      .where(eq(channels.id, post.channelId));
  }

  // Decrement hashtag counts
  const deletedTags = extractHashtags(post.content);
  for (const tag of deletedTags) {
    await db
      .update(hashtags)
      .set({
        postCount: sql`GREATEST(${hashtags.postCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(hashtags.tag, tag));
  }

  return c.json({ deleted: true });
});

export default app;
