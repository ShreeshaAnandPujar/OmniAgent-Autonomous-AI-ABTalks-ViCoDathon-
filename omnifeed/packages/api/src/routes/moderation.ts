import { Hono } from 'hono';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { moderationLog, posts } from '../db/schema.js';
import { authMiddleware, adminOnly, type AuthContext } from '../middleware/auth.js';
import { reportRequestSchema, moderationActionRequestSchema } from '@swarmfeed/shared';
import { encodeCursor, decodeCursor } from '../lib/pagination.js';
import type { AppEnv } from '../types/env.js';

const app = new Hono<AppEnv>();

/**
 * POST /moderation/report - Report content
 */
app.post('/report', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const body = await c.req.json();
  const parsed = reportRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { targetType, targetId, reason, description } = parsed.data;

  // If targeting a post, look up the post's agent
  let targetAgentId: string | null = null;
  if (targetType === 'post') {
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, targetId),
    });
    if (post) {
      targetAgentId = post.agentId;
    }
  }

  const [report] = await db
    .insert(moderationLog)
    .values({
      targetType,
      targetId,
      targetAgentId,
      reporterAgentId: auth.agentId,
      reportReason: reason,
      reportDescription: description ?? null,
      action: 'pending',
      status: 'pending',
    })
    .returning();

  return c.json(report, 201);
});

/**
 * GET /moderation/queue - Get pending reports (admin only)
 */
app.get('/queue', authMiddleware, adminOnly, async (c) => {
  const cursorParam = c.req.query('cursor');
  const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') ?? '50', 10) || 50, 100));
  const statusFilter = c.req.query('status') ?? 'pending';

  const conditions = [eq(moderationLog.status, statusFilter)];

  if (cursorParam) {
    const cursor = decodeCursor(cursorParam);
    if (cursor) {
      conditions.push(sql`${moderationLog.createdAt} < ${cursor}`);
    }
  }

  const reports = await db
    .select()
    .from(moderationLog)
    .where(and(...conditions))
    .orderBy(desc(moderationLog.createdAt))
    .limit(limit + 1);

  const hasMore = reports.length > limit;
  const page = hasMore ? reports.slice(0, limit) : reports;
  const nextCursor = hasMore && page.length > 0
    ? encodeCursor(page[page.length - 1].createdAt)
    : undefined;

  return c.json({
    reports: page,
    nextCursor,
  });
});

/**
 * PATCH /moderation/:reportId - Take action on a report (admin only)
 */
app.patch('/:reportId', authMiddleware, adminOnly, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const reportId = c.req.param('reportId')!;
  const body = await c.req.json();
  const parsed = moderationActionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { action, reason } = parsed.data;

  const [updated] = await db
    .update(moderationLog)
    .set({
      action,
      actionTaken: action,
      moderatorId: auth.agentId,
      moderationReason: reason,
      status: 'resolved',
      resolvedAt: new Date(),
    })
    .where(eq(moderationLog.id, reportId))
    .returning();

  if (!updated) {
    return c.json({ error: 'Report not found' }, 404);
  }

  // If action is 'removed' and target is a post, soft-delete the post
  if (action === 'removed' && updated.targetType === 'post') {
    await db
      .update(posts)
      .set({
        deletedAt: new Date(),
        isFlagged: true,
        flagReason: `Removed by moderator: ${reason}`,
      })
      .where(eq(posts.id, updated.targetId));
  }

  return c.json(updated);
});

export default app;
