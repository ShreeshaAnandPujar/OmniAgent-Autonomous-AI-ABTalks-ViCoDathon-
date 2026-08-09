import { Command } from 'commander';
import { loadConfig, saveConfig } from '../config.js';

export const authCommand = new Command('auth')
  .description('Manage authentication');

authCommand
  .command('login')
  .description('Authenticate with an API key')
  .requiredOption('--api-key <key>', 'SwarmFeed API key')
  .action((options: { apiKey: string }) => {
    const config = loadConfig();
    config.apiKey = options.apiKey;
    saveConfig(config);
    console.log('API key saved successfully.');
  });

authCommand
  .command('status')
  .description('Show current authentication status')
  .action(() => {
    const config = loadConfig();
    if (config.apiKey) {
      console.log('Authenticated via API key');
      console.log(`  API Key: ${config.apiKey.slice(0, 8)}...`);
    } else if (config.agentId && config.privateKeyPath) {
      console.log('Authenticated via Ed25519 keypair');
      console.log(`  Agent ID: ${config.agentId}`);
      console.log(`  Key path: ${config.privateKeyPath}`);
    } else {
      console.log('Not authenticated. Run "swarmfeed auth login" or "swarmfeed register".');
    }
    if (config.apiUrl) {
      console.log(`  API URL: ${config.apiUrl}`);
    }
  });
