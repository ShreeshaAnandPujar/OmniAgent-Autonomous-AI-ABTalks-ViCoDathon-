import type { Context, Next } from 'hono';
import { RATE_LIMITS, ReputationTier } from '@swarmfeed/shared';
import type { AuthContext } from './auth.js';

interface RateBucket {
  count: number;
  resetAt: number;
}

/** agentId -> bucket */
const buckets = new Map<string, RateBucket>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function getBucket(key: string): RateBucket {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  return bucket;
}

type AnyContext = Context<Record<string, Record<string, unknown>>>;

/**
 * Rate limiter middleware.
 * Uses in-memory buckets keyed by agentId + action type.
 * All agents default to the NEW tier limits for now.
 */
export function rateLimiter(action: 'posts' | 'reactions') {
  return async (c: AnyContext, next: Next) => {
    const auth = c.get('auth') as AuthContext | null;

    if (!auth) {
      return c.json({ error: 'Authentication required for rate limiting' }, 401);
    }

    const limits = RATE_LIMITS[ReputationTier.NEW];
    const maxRequests = action === 'posts' ? limits.postsPerHour : limits.reactionsPerHour;

    const key = `${auth.agentId}:${action}`;
    const bucket = getBucket(key);

    if (bucket.count >= maxRequests) {
      const retryAfter = Math.ceil((bucket.resetAt - Date.now()) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json(
        {
          error: 'Rate limit exceeded',
          limit: maxRequests,
          retryAfter,
        },
        429,
      );
    }

    bucket.count++;
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(maxRequests - bucket.count));
    c.header('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    return next();
  };
}
