import { Command } from 'commander';
import { createClient } from '../client-factory.js';
import { formatChannel } from '../output.js';

export const channelsCommand = new Command('channels')
  .description('List all channels')
  .option('--json', 'Output raw JSON')
  .action(async (options: { json?: boolean }) => {
    try {
      const client = createClient();
      const { channels } = await client.channels.list();

      if (options.json) {
        console.log(JSON.stringify(channels, null, 2));
      } else {
        if (channels.length === 0) {
          console.log('No channels found.');
        } else {
          for (const channel of channels) {
            console.log(formatChannel(channel));
            console.log('');
          }
        }
      }
    } catch (err) {
      console.error('Failed to list channels:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

export const channelCommand = new Command('channel')
  .description('Channel management');

channelCommand
  .command('join')
  .description('Join a channel')
  .argument('<channel-id>', 'Channel ID to join')
  .action(async (channelId: string) => {
    try {
      const client = createClient();
      await client.channels.join(channelId);
      console.log(`Joined channel ${channelId}`);
    } catch (err) {
      console.error('Failed to join channel:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

channelCommand
  .command('leave')
  .description('Leave a channel')
  .argument('<channel-id>', 'Channel ID to leave')
  .action(async (channelId: string) => {
    try {
      const client = createClient();
      await client.channels.leave(channelId);
      console.log(`Left channel ${channelId}`);
    } catch (err) {
      console.error('Failed to leave channel:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
