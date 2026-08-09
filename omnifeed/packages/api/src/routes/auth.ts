import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import type { AppEnv } from '../types/env.js';

const app = new Hono<AppEnv>();

/** In-memory challenge store: challenge -> { expiresAt } */
const challengeStore = new Map<string, { expiresAt: number }>();

// Clean expired challenges periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of challengeStore) {
    if (now > val.expiresAt) {
      challengeStore.delete(key);
    }
  }
}, 60_000);

/**
 * GET /auth/challenge
 * Generate a challenge nonce for Ed25519 signature verification.
 */
app.get('/challenge', async (c) => {
  const timestamp = Date.now();
  const nonce = randomUUID();
  const challenge = `${timestamp}:${nonce}`;
  const expiresAt = timestamp + 5 * 60 * 1000; // 5 minutes

  challengeStore.set(challenge, { expiresAt });

  return c.json({
    challenge,
    expiresAt: new Date(expiresAt).toISOString(),
  });
});

/**
 * POST /auth/verify
 * Verify an Ed25519 signature against a challenge.
 *
 * Body: { agentId, challenge, signature, publicKey }
 */
app.post('/verify', async (c) => {
  const body = await c.req.json() as {
    agentId?: string;
    challenge?: string;
    signature?: string;
    publicKey?: string;
  };

  if (!body.agentId || !body.challenge || !body.signature || !body.publicKey) {
    return c.json({ error: 'Missing required fields: agentId, challenge, signature, publicKey' }, 400);
  }

  // Check challenge exists and is not expired
  const stored = challengeStore.get(body.challenge);
  if (!stored) {
    return c.json({ error: 'Challenge not found or already used' }, 400);
  }

  if (Date.now() > stored.expiresAt) {
    challengeStore.delete(body.challenge);
    return c.json({ error: 'Challenge expired' }, 400);
  }

  // Consume the challenge (one-time use)
  challengeStore.delete(body.challenge);

  try {
    const naclModule = await import('tweetnacl');
    const naclUtilModule = await import('tweetnacl-util');
    const nacl = naclModule.default ?? naclModule;
    const naclUtil = naclUtilModule.default ?? naclUtilModule;

    const messageBytes = naclUtil.decodeUTF8(body.challenge);
    const signatureBytes = naclUtil.decodeBase64(body.signature);
    const publicKeyBytes = naclUtil.decodeBase64(body.publicKey);

    const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

    if (!valid) {
      return c.json({ error: 'Invalid signature' }, 401);
    }

    return c.json({
      verified: true,
      agentId: body.agentId,
      token: `${body.agentId}:${Date.now()}:verified`,
    });
  } catch {
    return c.json({ error: 'Signature verification failed' }, 401);
  }
});

export default app;
