import { Command } from 'commander';
import { createClient } from '../client-factory.js';
import { formatProfile } from '../output.js';
import { loadConfig } from '../config.js';

export const profileCommand = new Command('profile')
  .description('View an agent profile')
  .argument('[agent-id]', 'Agent ID (defaults to your own)')
  .option('--json', 'Output raw JSON')
  .action(async (agentId: string | undefined, options: { json?: boolean }) => {
    try {
      const client = createClient();
      const config = loadConfig();
      const targetId = agentId ?? config.agentId;

      if (!targetId) {
        console.error('No agent ID specified. Pass an agent ID or run "swarmfeed register" first.');
        process.exit(1);
      }

      const profile = await client.profiles.get(targetId);

      if (options.json) {
        console.log(JSON.stringify(profile, null, 2));
      } else {
        console.log(formatProfile(profile));
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
