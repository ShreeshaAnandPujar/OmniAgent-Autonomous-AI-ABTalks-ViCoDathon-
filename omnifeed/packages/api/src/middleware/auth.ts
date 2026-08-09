import type { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
const { decodeUTF8 } = naclUtil;
import { db } from '../db/client.js';
import { agents } from '../db/schema.js';

export interface AuthContext {
  agentId: string;
  isAdmin: boolean;
}

// Use a generic context type to avoid Hono env mismatch errors.
// The route-level Hono<AppEnv> ensures `c.get('auth')` is typed.
type AnyContext = Context<Record<string, Record<string, unknown>>>;

const CHALLENGE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

function checkAdmin(c: AnyContext): boolean {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return false;
  const headerKey = c.req.header('X-Admin-Key');
  if (!headerKey) return false;
  if (adminKey.length !== headerKey.length) return false;
  return timingSafeEqual(Buffer.from(adminKey), Buffer.from(headerKey));
}

/**
 * Authentication middleware supporting two modes:
 *
 * 1. API key auth:   Authorization: Bearer sf_live_<key>
 * 2. Challenge auth:  Authorization: Bearer <agentId>:<challenge>:<signature>
 *
 * Sets `c.set('auth', { agentId, isAdmin })` on success.
 */
export async function authMiddleware(c: AnyContext, next: Next) {
  const header = c.req.header('Authorization');

  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = header.slice(7);
  const isAdmin = checkAdmin(c);

  // Mode 1 - API key auth
  if (token.startsWith('sf_live_')) {
    const agent = await db.query.agents.findFirst({
      where: eq(agents.apiKey, token),
    });

    if (!agent || !agent.isActive) {
      return c.json({ error: 'Invalid or inactive API key' }, 401);
    }

    c.set('auth', { agentId: agent.id, isAdmin } satisfies AuthContext);
    return next();
  }

  // Mode 2 - Challenge-response: <agentId>:<timestamp>:<uuid>:<signature>
  // Challenge format is "timestamp:uuid", so the full token is "agentId:timestamp:uuid:signature"
  const firstColon = token.indexOf(':');
  if (firstColon === -1) {
    return c.json({ error: 'Invalid token format' }, 401);
  }

  const agentId = token.slice(0, firstColon);
  const rest = token.slice(firstColon + 1);

  // Find the last colon to separate challenge from signature
  const lastColon = rest.lastIndexOf(':');
  if (lastColon === -1) {
    return c.json({ error: 'Invalid token format' }, 401);
  }

  const challenge = rest.slice(0, lastColon); // "timestamp:uuid"
  const signatureHex = rest.slice(lastColon + 1);

  // Validate challenge timestamp (first segment before colon)
  const challengeTimestamp = parseInt(challenge.split(':')[0], 10);
  if (isNaN(challengeTimestamp) || Date.now() - challengeTimestamp > CHALLENGE_MAX_AGE_MS) {
    return c.json({ error: 'Challenge expired or invalid' }, 401);
  }

  // Verify the agent exists and is active
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });

  if (!agent || !agent.isActive) {
    return c.json({ error: 'Agent not found or inactive' }, 401);
  }

  // Verify Ed25519 signature
  if (!agent.publicKey) {
    return c.json({ error: 'Agent has no public key configured' }, 401);
  }

  try {
    const messageBytes = decodeUTF8(challenge);
    const signatureBytes = new Uint8Array(Buffer.from(signatureHex, 'hex'));
    const publicKeyBytes = new Uint8Array(Buffer.from(agent.publicKey, 'hex'));

    const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    if (!valid) {
      return c.json({ error: 'Invalid signature' }, 401);
    }
  } catch {
    return c.json({ error: 'Signature verification failed' }, 401);
  }

  c.set('auth', { agentId, isAdmin } satisfies AuthContext);
  return next();
}

/**
 * Optional auth - extracts identity if present but does not reject unauthenticated requests.
 */
export async function optionalAuth(c: AnyContext, next: Next) {
  const header = c.req.header('Authorization');

  if (!header?.startsWith('Bearer ')) {
    c.set('auth', null);
    return next();
  }

  const token = header.slice(7);
  const isAdmin = checkAdmin(c);

  if (token.startsWith('sf_live_')) {
    const agent = await db.query.agents.findFirst({
      where: eq(agents.apiKey, token),
    });
    if (agent?.isActive) {
      c.set('auth', { agentId: agent.id, isAdmin } satisfies AuthContext);
    } else {
      c.set('auth', null);
    }
    return next();
  }

  // Challenge-response: <agentId>:<timestamp>:<uuid>:<signature>
  const firstColon = token.indexOf(':');
  if (firstColon === -1) {
    c.set('auth', null);
    return next();
  }

  const agentId = token.slice(0, firstColon);
  const rest = token.slice(firstColon + 1);
  const lastColon = rest.lastIndexOf(':');

  if (lastColon === -1) {
    c.set('auth', null);
    return next();
  }

  const challenge = rest.slice(0, lastColon);
  const signatureHex = rest.slice(lastColon + 1);
  const challengeTimestamp = parseInt(challenge.split(':')[0], 10);

  if (isNaN(challengeTimestamp) || Date.now() - challengeTimestamp > CHALLENGE_MAX_AGE_MS) {
    c.set('auth', null);
    return next();
  }

  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });

  if (!agent?.isActive || !agent.publicKey) {
    c.set('auth', null);
    return next();
  }

  try {
    const messageBytes = decodeUTF8(challenge);
    const signatureBytes = new Uint8Array(Buffer.from(signatureHex, 'hex'));
    const publicKeyBytes = new Uint8Array(Buffer.from(agent.publicKey, 'hex'));

    const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    if (valid) {
      c.set('auth', { agentId, isAdmin } satisfies AuthContext);
    } else {
      c.set('auth', null);
    }
  } catch {
    c.set('auth', null);
  }

  return next();
}

/**
 * Admin-only guard. Must be used after authMiddleware.
 */
export async function adminOnly(c: AnyContext, next: Next) {
  const auth = c.get('auth') as AuthContext | null;

  if (!auth?.isAdmin) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  return next();
}
