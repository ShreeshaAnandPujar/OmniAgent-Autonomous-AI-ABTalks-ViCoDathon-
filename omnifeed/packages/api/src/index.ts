import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';

import authRoutes from './routes/auth.js';
import openRegisterRoutes from './routes/open-register.js';
import postRoutes from './routes/posts.js';
import reactionRoutes from './routes/reactions.js';
import followRoutes from './routes/follows.js';
import channelRoutes from './routes/channels.js';
import profileRoutes from './routes/profiles.js';
import feedRoutes from './routes/feed.js';
import badgeRoutes from './routes/badges.js';
import searchRoutes from './routes/search.js';
import moderationRoutes from './routes/moderation.js';
import notificationRoutes from './routes/notifications.js';
import bookmarkRoutes from './routes/bookmarks.js';
import sseRoutes from './routes/sse.js';
import mcpRoutes from './routes/mcp.js';

const app = new Hono();

// ─── Global Middleware ───────────────────────────────────────────────────────

const corsOrigins = process.env.CORS_ORIGINS;
app.use(
  '*',
  cors({
    origin: corsOrigins ? corsOrigins.split(',').map((o) => o.trim()) : '*',
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
  }),
);

app.use('*', logger());

// ─── Global Error Handler ────────────────────────────────────────────────────

app.onError((err, c) => {
  console.error('[API Error]', err);
  const status = 'status' in err && typeof err.status === 'number' ? err.status : 500;
  return c.json(
    { error: err.message || 'Internal Server Error' },
    status as Parameters<typeof c.json>[1],
  );
});

// ─── Health Check ────────────────────────────────────────────────────────────

app.get('/api/v1/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Route Groups ────────────────────────────────────────────────────────────

app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/register', openRegisterRoutes);
app.route('/api/v1/posts', postRoutes);
app.route('/api/v1/posts', reactionRoutes);
app.route('/api/v1/agents', followRoutes);
app.route('/api/v1/channels', channelRoutes);
app.route('/api/v1/agents', profileRoutes);
app.route('/api/v1/feed', feedRoutes);
app.route('/api/v1/agents', badgeRoutes);
app.route('/api/v1/search', searchRoutes);
app.route('/api/v1/moderation', moderationRoutes);
app.route('/api/v1/notifications', notificationRoutes);
app.route('/api/v1/bookmarks', bookmarkRoutes);
app.route('/api/v1/sse', sseRoutes);
app.route('/mcp', mcpRoutes);

// ─── Start Server ────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT ?? '3700', 10);

console.log(`SwarmFeed API starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`SwarmFeed API listening on http://localhost:${port}`);

export default app;
