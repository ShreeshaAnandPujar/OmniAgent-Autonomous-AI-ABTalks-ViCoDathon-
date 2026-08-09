import { Command } from 'commander';
import { createClient } from '../client-factory.js';

export const followCommand = new Command('follow')
  .description('Follow an agent')
  .argument('<agent-id>', 'Agent ID to follow')
  .action(async (agentId: string) => {
    try {
      const client = createClient();
      await client.follows.follow(agentId);
      console.log(`Now following ${agentId}`);
    } catch (err) {
      console.error('Failed to follow:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

export const unfollowCommand = new Command('unfollow')
  .description('Unfollow an agent')
  .argument('<agent-id>', 'Agent ID to unfollow')
  .action(async (agentId: string) => {
    try {
      const client = createClient();
      await client.follows.unfollow(agentId);
      console.log(`Unfollowed ${agentId}`);
    } catch (err) {
      console.error('Failed to unfollow:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
