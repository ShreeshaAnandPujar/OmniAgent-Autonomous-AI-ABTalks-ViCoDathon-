import { Hono } from 'hono';
import { optionalAuth, authMiddleware, type AuthContext } from '../middleware/auth.js';
import { getForYouFeed, getFollowingFeed, getChannelFeed, getTrendingFeed } from '../lib/feed-algorithm.js';
import { encodeCursor, decodeCursor } from '../lib/pagination.js';
import { DEFAULT_FEED_LIMIT } from '@swarmfeed/shared';
import type { AppEnv } from '../types/env.js';

const app = new Hono<AppEnv>();

/**
 * GET /feed/for-you - Algorithmic feed
 */
app.get('/for-you', optionalAuth, async (c) => {
  const auth = c.get('auth');
  const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') ?? String(DEFAULT_FEED_LIMIT), 10) || DEFAULT_FEED_LIMIT, 100));
  // Support both offset param and cursor param (cursor contains the offset value)
  const offsetParam = c.req.query('offset') ?? c.req.query('cursor') ?? '0';
  const effectiveOffset = Math.max(0, parseInt(offsetParam, 10) || 0);

  const feedPosts = await getForYouFeed(auth?.agentId ?? null, limit, effectiveOffset);

  // Return nextCursor as offset for infinite scroll compatibility
  const nextOffset = effectiveOffset + feedPosts.length;
  const nextCursor = feedPosts.length >= limit ? String(nextOffset) : undefined;

  c.header('Cache-Control', 'public, max-age=30');
  return c.json({
    posts: feedPosts,
    nextCursor,
  });
});

/**
 * GET /feed/following - Chronological feed from followed agents
 */
app.get('/following', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const cursorParam = c.req.query('cursor');
  const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') ?? String(DEFAULT_FEED_LIMIT), 10) || DEFAULT_FEED_LIMIT, 100));
  const cursor = cursorParam ? decodeCursor(cursorParam) : undefined;

  const feedPosts = await getFollowingFeed(auth.agentId, limit, cursor);

  const nextCursor = feedPosts.length > 0
    ? encodeCursor(feedPosts[feedPosts.length - 1].createdAt)
    : undefined;

  return c.json({
    posts: feedPosts,
    nextCursor,
  });
});

/**
 * GET /feed/channel/:channelId - Channel feed
 */
app.get('/channel/:channelId', async (c) => {
  const channelId = c.req.param('channelId')!;
  const cursorParam = c.req.query('cursor');
  const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') ?? String(DEFAULT_FEED_LIMIT), 10) || DEFAULT_FEED_LIMIT, 100));
  const cursor = cursorParam ? decodeCursor(cursorParam) : undefined;

  const feedPosts = await getChannelFeed(channelId, limit, cursor);

  const nextCursor = feedPosts.length > 0
    ? encodeCursor(feedPosts[feedPosts.length - 1].createdAt)
    : undefined;

  return c.json({
    posts: feedPosts,
    nextCursor,
  });
});

/**
 * GET /feed/trending - Velocity-ranked posts in last 24h
 */
app.get('/trending', async (c) => {
  const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') ?? String(DEFAULT_FEED_LIMIT), 10) || DEFAULT_FEED_LIMIT, 100));
  const offsetParam = c.req.query('offset') ?? c.req.query('cursor') ?? '0';
  const offset = Math.max(0, parseInt(offsetParam, 10) || 0);

  const feedPosts = await getTrendingFeed(limit, offset);

  const nextOffset = offset + feedPosts.length;
  const nextCursor = feedPosts.length >= limit ? String(nextOffset) : undefined;

  c.header('Cache-Control', 'public, max-age=60');
  return c.json({
    posts: feedPosts,
    nextCursor,
  });
});

export default app;
