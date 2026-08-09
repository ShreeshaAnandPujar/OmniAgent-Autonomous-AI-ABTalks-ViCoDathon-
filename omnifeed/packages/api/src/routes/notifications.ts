import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { agents } from '../db/schema.js';
import { authMiddleware, type AuthContext } from '../middleware/auth.js';
import { encodeCursor, decodeCursor } from '../lib/pagination.js';
import type { AppEnv } from '../types/env.js';

const app = new Hono<AppEnv>();

interface Notification {
  id: string;
  type: 'mention' | 'reaction' | 'follow';
  actorId: string;
  actorName: string | null;
  postId: string | null;
  content: string | null;
  createdAt: Date;
}

/**
 * GET /notifications - Get notifications for the authenticated agent
 */
app.get('/', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const cursorParam = c.req.query('cursor');
  const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') ?? '50', 10) || 50, 100));
  const cursor = cursorParam ? decodeCursor(cursorParam) : undefined;

  const cursorFilter = cursor ? sql`AND sub.created_at < ${cursor}` : sql``;

  interface NotificationRow {
    id: string;
    type: string;
    actor_id: string;
    post_id: string | null;
    content: string | null;
    created_at: Date;
  }

  // Combine mentions, reactions on user's posts, and new followers into a single query
  const result = await db.execute(sql`
    SELECT * FROM (
      SELECT
        m.id,
        'mention' AS type,
        m.mentioned_by_agent_id AS actor_id,
        m.post_id,
        NULL AS content,
        m.created_at
      FROM mentions m
      WHERE m.mentioned_agent_id = ${auth.agentId}

      UNION ALL

      SELECT
        pr.id,
        'reaction' AS type,
        pr.agent_id AS actor_id,
        pr.post_id,
        pr.reaction_type AS content,
        pr.created_at
      FROM post_reactions pr
      INNER JOIN posts p ON p.id = pr.post_id
      WHERE p.agent_id = ${auth.agentId}
        AND pr.agent_id != ${auth.agentId}

      UNION ALL

      SELECT
        f.id,
        'follow' AS type,
        f.follower_id AS actor_id,
        NULL AS post_id,
        NULL AS content,
        f.followed_at AS created_at
      FROM follows f
      WHERE f.following_id = ${auth.agentId}
    ) sub
    WHERE 1=1 ${cursorFilter}
    ORDER BY sub.created_at DESC
    LIMIT ${limit + 1}
  `);

  const rows = result.rows as unknown as NotificationRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  // Gather unique actor IDs for name lookup
  const uniqueActorIds = [...new Set(page.map((r) => r.actor_id))];
  const agentRows = uniqueActorIds.length > 0
    ? await db
        .select({ id: agents.id, name: agents.name })
        .from(agents)
        .where(sql`${agents.id} IN ${uniqueActorIds}`)
    : [];
  const agentMap = new Map(agentRows.map((a) => [a.id, a.name]));

  const nextCursor = hasMore && page.length > 0
    ? encodeCursor(new Date(page[page.length - 1].created_at))
    : undefined;

  const notifications: Notification[] = page.map((r) => ({
    id: r.id,
    type: r.type as Notification['type'],
    actorId: r.actor_id,
    actorName: agentMap.get(r.actor_id) ?? null,
    postId: r.post_id ?? null,
    content: r.content ?? null,
    createdAt: new Date(r.created_at),
  }));

  return c.json({ notifications, nextCursor });
});

/**
 * GET /notifications/unread-count - Get count of recent notifications (last 24h)
 */
app.get('/unread-count', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result = await db.execute(sql`
    SELECT COUNT(*) as count FROM (
      SELECT m.id FROM mentions m
      WHERE m.mentioned_agent_id = ${auth.agentId} AND m.created_at > ${since}

      UNION ALL

      SELECT pr.id FROM post_reactions pr
      INNER JOIN posts p ON p.id = pr.post_id
      WHERE p.agent_id = ${auth.agentId}
        AND pr.agent_id != ${auth.agentId}
        AND pr.created_at > ${since}

      UNION ALL

      SELECT f.id FROM follows f
      WHERE f.following_id = ${auth.agentId} AND f.followed_at > ${since}
    ) sub
  `);

  const count = Number((result.rows[0] as { count: string }).count);
  return c.json({ count });
});

export default app;
