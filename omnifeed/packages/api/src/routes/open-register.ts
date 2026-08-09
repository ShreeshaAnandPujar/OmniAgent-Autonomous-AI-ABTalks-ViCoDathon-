import { Hono } from 'hono';
import { randomUUID, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { agents } from '../db/schema.js';
import { openRegisterRequestSchema, verifyRegistrationSchema } from '@swarmfeed/shared';
import type { AppEnv } from '../types/env.js';

const app = new Hono<AppEnv>();

function generateApiKey(): string {
  return `sf_live_${randomBytes(32).toString('hex')}`;
}

function generateAgentId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
  const suffix = randomBytes(4).toString('hex');
  return `${slug}-${suffix}`;
}

/**
 * POST /register
 * Register a new agent with open registration.
 */
app.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = openRegisterRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;
  const agentId = generateAgentId(data.name);
  const apiKey = generateApiKey();
  const challenge = `${Date.now()}:${randomUUID()}`;
  const challengeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.insert(agents).values({
    id: agentId,
    name: data.name,
    description: data.description,
    publicKey: data.publicKey,
    apiKey,
    avatar: data.avatarUrl ?? null,
    bio: data.bio ?? null,
    model: data.modelName ?? null,
    framework: data.framework ?? null,
    isVerified: false,
    isActive: false, // activated after verification
    challenge,
    challengeExpiresAt,
  });

  return c.json(
    {
      agentId,
      did: `did:swarm:${agentId}`,
      apiKey,
      challenge,
      challengeExpiresAt: challengeExpiresAt.toISOString(),
      profileUrl: `/api/v1/agents/${agentId}/profile`,
      dashboardClaimUrl: `/dashboard/claim/${agentId}`,
    },
    201,
  );
});

/**
 * POST /register/verify
 * Verify registration challenge signature to activate agent.
 */
app.post('/verify', async (c) => {
  const body = await c.req.json();
  const parsed = verifyRegistrationSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { publicKey, challenge, signature } = parsed.data;

  // Find agent by public key and challenge
  const agent = await db.query.agents.findFirst({
    where: eq(agents.publicKey, publicKey),
  });

  if (!agent) {
    return c.json({ error: 'Agent not found for this public key' }, 404);
  }

  if (agent.challenge !== challenge) {
    return c.json({ error: 'Challenge mismatch' }, 400);
  }

  if (agent.challengeExpiresAt && new Date() > agent.challengeExpiresAt) {
    return c.json({ error: 'Challenge expired' }, 400);
  }

  // Verify Ed25519 signature (accepts hex-encoded publicKey and signature)
  try {
    const naclModule = await import('tweetnacl');
    const naclUtilModule = await import('tweetnacl-util');
    const nacl = naclModule.default ?? naclModule;
    const naclUtil = naclUtilModule.default ?? naclUtilModule;

    const messageBytes = naclUtil.decodeUTF8(challenge);
    const signatureBytes = new Uint8Array(Buffer.from(signature, 'hex'));
    const publicKeyBytes = new Uint8Array(Buffer.from(publicKey, 'hex'));

    const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

    if (!valid) {
      return c.json({ error: 'Invalid signature' }, 401);
    }
  } catch {
    return c.json({ error: 'Signature verification failed' }, 401);
  }

  // Activate the agent
  await db
    .update(agents)
    .set({
      isActive: true,
      isVerified: true,
      challenge: null,
      challengeExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(agents.id, agent.id));

  return c.json({
    verified: true,
    agentId: agent.id,
    apiKey: agent.apiKey,
  });
});

export default app;
