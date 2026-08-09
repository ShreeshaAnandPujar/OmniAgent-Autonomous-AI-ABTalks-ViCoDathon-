import { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { generateKeypair, keyToHex, SwarmFeedClient } from '@swarmfeed/sdk';
import { loadConfig, saveConfig, getConfigDir } from '../config.js';

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

export const registerCommand = new Command('register')
  .description('Register a new SwarmFeed agent')
  .option('--name <name>', 'Agent display name')
  .option('--description <description>', 'Agent description')
  .option('--framework <framework>', 'Agent framework (e.g., openclaw, langgraph)')
  .option('--api-url <url>', 'API base URL')
  .action(async (options: { name?: string; description?: string; framework?: string; apiUrl?: string }) => {
    try {
      const name = options.name ?? await prompt('Agent name: ');
      const description = options.description ?? await prompt('Agent description: ');
      const framework = options.framework ?? await prompt('Framework (optional): ');

      if (!name || !description) {
        console.error('Error: Name and description are required.');
        process.exit(1);
      }

      // Generate Ed25519 keypair
      const keypair = generateKeypair();
      const publicKeyHex = keyToHex(keypair.publicKey);
      const privateKeyHex = keyToHex(keypair.secretKey);

      const config = loadConfig();
      const baseUrl = options.apiUrl ?? config.apiUrl;
      const client = new SwarmFeedClient({ baseUrl });

      // Call the registration endpoint directly (no auth needed)
      const response = await fetch(`${baseUrl ?? 'https://api.swarmfeed.ai'}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: publicKeyHex,
          name,
          description,
          framework: framework || undefined,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Registration failed: ${response.status} ${response.statusText}`);
        console.error(errorBody);
        process.exit(1);
      }

      const result = await response.json() as {
        agentId: string;
        apiKey: string;
        did: string;
        profileUrl: string;
      };

      // Save private key to file
      const keyPath = join(getConfigDir(), 'agent.key');
      writeFileSync(keyPath, privateKeyHex, { mode: 0o600 });

      // Update config
      config.agentId = result.agentId;
      config.apiKey = result.apiKey;
      config.privateKeyPath = keyPath;
      if (baseUrl) config.apiUrl = baseUrl;
      saveConfig(config);

      console.log('Agent registered successfully!');
      console.log(`  Agent ID: ${result.agentId}`);
      console.log(`  DID: ${result.did}`);
      console.log(`  Profile: ${result.profileUrl}`);
      console.log(`  Private key saved to: ${keyPath}`);
      console.log(`  Config saved to: ~/.swarmfeed/config.json`);
    } catch (err) {
      console.error('Registration failed:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
