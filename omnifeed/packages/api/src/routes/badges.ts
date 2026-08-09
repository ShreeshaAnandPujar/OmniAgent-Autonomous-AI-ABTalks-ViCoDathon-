import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { agentBadges } from '../db/schema.js';
import { authMiddleware, adminOnly, type AuthContext } from '../middleware/auth.js';
import { BADGE_TYPES } from '@swarmfeed/shared';
import type { AppEnv } from '../types/env.js';

const app = new Hono<AppEnv>();

/**
 * GET /agents/:agentId/badges - List badges for an agent
 */
app.get('/:agentId/badges', async (c) => {
  const agentId = c.req.param('agentId')!;

  const badges = await db
    .select()
    .from(agentBadges)
    .where(eq(agentBadges.agentId, agentId));

  return c.json({
    badges: badges.map((b) => ({
      id: b.id,
      badgeType: b.badgeType,
      displayName: b.displayName,
      emoji: b.emoji,
      color: b.color,
      isActive: b.isActive,
      reason: b.reason,
      expiresAt: b.expiresAt?.toISOString() ?? null,
      createdAt: b.createdAt.toISOString(),
    })),
  });
});

/**
 * POST /agents/:agentId/badges - Award a badge (admin only)
 */
app.post('/:agentId/badges', authMiddleware, adminOnly, async (c) => {
  const agentId = c.req.param('agentId')!;
  const body = await c.req.json() as {
    badgeType?: string;
    reason?: string;
    expiresAt?: string;
  };

  if (!body.badgeType) {
    return c.json({ error: 'badgeType is required' }, 400);
  }

  // Look up badge metadata from shared constants
  const badgeMeta = BADGE_TYPES[body.badgeType as keyof typeof BADGE_TYPES];

  if (!badgeMeta) {
    return c.json({ error: `Unknown badge type: ${body.badgeType}` }, 400);
  }

  const [badge] = await db
    .insert(agentBadges)
    .values({
      agentId,
      badgeType: body.badgeType,
      displayName: badgeMeta.displayName,
      emoji: badgeMeta.emoji,
      color: badgeMeta.color,
      reason: body.reason ?? null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    })
    .returning();

  return c.json(badge, 201);
});

/**
 * DELETE /agents/:agentId/badges/:badgeId - Revoke a badge (admin only)
 */
app.delete('/:agentId/badges/:badgeId', authMiddleware, adminOnly, async (c) => {
  const agentId = c.req.param('agentId')!;
  const badgeId = c.req.param('badgeId')!;

  const [updated] = await db
    .update(agentBadges)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(agentBadges.id, badgeId),
        eq(agentBadges.agentId, agentId),
      ),
    )
    .returning();

  if (!updated) {
    return c.json({ error: 'Badge not found' }, 404);
  }

  return c.json({ revoked: true, badge: updated });
});

export default app;
