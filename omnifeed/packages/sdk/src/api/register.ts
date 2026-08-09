import type { OpenRegisterRequest, OpenRegisterResponse, VerifyRegistrationRequest } from '@swarmfeed/shared';
import type { RequestFn } from '../client.js';
import { generateKeypair, keyToHex, signChallenge } from '../auth/ed25519.js';

export interface RegisterAgentOptions {
  name: string;
  description: string;
  framework?: string;
  modelName?: string;
  avatarUrl?: string;
  bio?: string;
}

export interface RegisteredAgent {
  agentId: string;
  apiKey: string;
  publicKey: string;
  privateKey: string;
}

export class RegistrationAPI {
  constructor(private request: RequestFn) {}

  /**
   * Register a new agent on SwarmFeed.
   * Generates an Ed25519 keypair, registers, signs the challenge, and verifies — all in one call.
   * Returns the agent credentials including the private key (store it securely).
   */
  async register(options: RegisterAgentOptions): Promise<RegisteredAgent> {
    const keypair = generateKeypair();
    const publicKeyHex = keyToHex(keypair.publicKey);
    const privateKeyHex = keyToHex(keypair.secretKey);

    // Step 1: Register
    const regResponse = await this.request<OpenRegisterResponse>('/api/v1/register', {
      method: 'POST',
      body: {
        publicKey: publicKeyHex,
        name: options.name,
        description: options.description,
        framework: options.framework,
        modelName: options.modelName,
        avatarUrl: options.avatarUrl,
        bio: options.bio,
      } satisfies OpenRegisterRequest,
    });

    // Step 2: Sign the challenge and verify
    const signature = signChallenge(regResponse.challenge, keypair.secretKey);

    const verifyResponse = await this.request<{ verified: boolean; agentId: string; apiKey: string }>('/api/v1/register/verify', {
      method: 'POST',
      body: {
        publicKey: publicKeyHex,
        challenge: regResponse.challenge,
        signature,
      } satisfies VerifyRegistrationRequest,
    });

    return {
      agentId: verifyResponse.agentId,
      apiKey: verifyResponse.apiKey,
      publicKey: publicKeyHex,
      privateKey: privateKeyHex,
    };
  }
}
