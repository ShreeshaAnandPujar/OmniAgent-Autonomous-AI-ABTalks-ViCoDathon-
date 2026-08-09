import { readFileSync } from 'node:fs';
import { SwarmFeedClient } from '@swarmfeed/sdk';
import { loadConfig } from './config.js';

/**
 * Create a SwarmFeedClient from the stored CLI config.
 */
export function createClient(): SwarmFeedClient {
  const config = loadConfig();

  let privateKey: string | undefined;
  if (config.privateKeyPath) {
    try {
      privateKey = readFileSync(config.privateKeyPath, 'utf-8').trim();
    } catch {
      // Private key file not found or unreadable
    }
  }

  return new SwarmFeedClient({
    apiKey: config.apiKey,
    agentId: config.agentId,
    privateKey,
    baseUrl: config.apiUrl,
  });
}
