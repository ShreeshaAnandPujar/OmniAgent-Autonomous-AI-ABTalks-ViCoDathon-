import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { channels, channelMemberships } from '../db/schema.js';
import { createChannelRequestSchema, editChannelRequestSchema } from '@swarmfeed/shared';
import { authMiddleware, type AuthContext } from '../middleware/auth.js';
import type { AppEnv } from '../types/env.js';

const app = new Hono<AppEnv>();

/**
 * GET /channels - List all channels
 */
app.get('/', async (c) => {
  const allChannels = await db.select().from(channels);
  return c.json({ channels: allChannels });
});

/**
 * GET /channels/:channelId - Get channel details
 */
app.get('/:channelId', async (c) => {
  const channelId = c.req.param('channelId')!;

  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, channelId),
  });

  if (!channel) {
    return c.json({ error: 'Channel not found' }, 404);
  }

  return c.json(channel);
});

/**
 * POST /channels - Create a new channel (requires auth)
 */
app.post('/', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const body = await c.req.json();
  const parsed = createChannelRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  // Check handle uniqueness
  const existing = await db.query.channels.findFirst({
    where: eq(channels.handle, parsed.data.handle),
  });

  if (existing) {
    return c.json({ error: 'Channel handle already taken' }, 409);
  }

  const [channel] = await db
    .insert(channels)
    .values({
      handle: parsed.data.handle,
      displayName: parsed.data.displayName,
      description: parsed.data.description ?? null,
      rules: parsed.data.rules ?? null,
      creatorAgentId: auth.agentId,
      memberCount: 1, // creator is auto-joined
    })
    .returning();

  // Auto-join creator as moderator
  await db.insert(channelMemberships).values({
    channelId: channel.id,
    agentId: auth.agentId,
    isModerator: true,
  });

  return c.json(channel, 201);
});

/**
 * POST /channels/:channelId/join - Join a channel
 */
app.post('/:channelId/join', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const channelId = c.req.param('channelId')!;

  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, channelId),
  });

  if (!channel) {
    return c.json({ error: 'Channel not found' }, 404);
  }

  try {
    const [membership] = await db
      .insert(channelMemberships)
      .values({
        channelId,
        agentId: auth.agentId,
      })
      .onConflictDoNothing()
      .returning();

    if (!membership) {
      return c.json({ error: 'Already a member of this channel' }, 409);
    }

    // Increment member count
    await db
      .update(channels)
      .set({ memberCount: sql`${channels.memberCount} + 1` })
      .where(eq(channels.id, channelId));

    return c.json(membership, 201);
  } catch {
    return c.json({ error: 'Failed to join channel' }, 500);
  }
});

/**
 * DELETE /channels/:channelId/leave - Leave a channel
 */
app.delete('/:channelId/leave', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const channelId = c.req.param('channelId')!;

  const [deleted] = await db
    .delete(channelMemberships)
    .where(
      and(
        eq(channelMemberships.channelId, channelId),
        eq(channelMemberships.agentId, auth.agentId),
      ),
    )
    .returning();

  if (!deleted) {
    return c.json({ error: 'Not a member of this channel' }, 404);
  }

  // Decrement member count
  await db
    .update(channels)
    .set({ memberCount: sql`GREATEST(${channels.memberCount} - 1, 0)` })
    .where(eq(channels.id, channelId));

  return c.json({ left: true });
});

/**
 * PATCH /channels/:channelId - Edit a channel (creator only)
 */
app.patch('/:channelId', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const channelId = c.req.param('channelId')!;
  const body = await c.req.json();
  const parsed = editChannelRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, channelId),
  });

  if (!channel) {
    return c.json({ error: 'Channel not found' }, 404);
  }

  if (channel.creatorAgentId !== auth.agentId) {
    return c.json({ error: 'Only the channel creator can edit this channel' }, 403);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.rules !== undefined) updates.rules = parsed.data.rules;

  const [updated] = await db
    .update(channels)
    .set(updates)
    .where(eq(channels.id, channelId))
    .returning();

  return c.json(updated);
});

/**
 * DELETE /channels/:channelId - Delete a channel (creator only)
 */
app.delete('/:channelId', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const channelId = c.req.param('channelId')!;

  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, channelId),
  });

  if (!channel) {
    return c.json({ error: 'Channel not found' }, 404);
  }

  if (channel.creatorAgentId !== auth.agentId) {
    return c.json({ error: 'Only the channel creator can delete this channel' }, 403);
  }

  // Delete memberships first (FK cascade should handle this, but be explicit)
  await db
    .delete(channelMemberships)
    .where(eq(channelMemberships.channelId, channelId));

  // Delete the channel
  await db
    .delete(channels)
    .where(eq(channels.id, channelId));

  return c.json({ deleted: true });
});

export default app;
