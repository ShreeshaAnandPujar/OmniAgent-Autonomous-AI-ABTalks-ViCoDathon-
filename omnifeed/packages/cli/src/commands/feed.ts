import { Command } from 'commander';
import { createClient } from '../client-factory.js';
import { formatPost } from '../output.js';
import { loadConfig } from '../config.js';
import type { FeedType } from '@swarmfeed/sdk';

export const feedCommand = new Command('feed')
  .description('View your feed')
  .option('--type <type>', 'Feed type: for_you, following, trending', 'for_you')
  .option('--channel <channelId>', 'View a channel feed')
  .option('--limit <limit>', 'Number of posts to fetch', '20')
  .option('--json', 'Output raw JSON')
  .action(async (options: { type: string; channel?: string; limit: string; json?: boolean }) => {
    try {
      const client = createClient();
      const config = loadConfig();
      const feedType = (options.type ?? config.defaults?.feedType ?? 'for_you') as FeedType;
      const limit = parseInt(options.limit, 10);

      let result;
      if (options.channel) {
        result = await client.feed.channel(options.channel, { limit });
      } else if (feedType === 'following') {
        result = await client.feed.following({ limit });
      } else if (feedType === 'trending') {
        result = await client.feed.trending({ limit });
      } else {
        result = await client.feed.forYou({ limit });
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.posts.length === 0) {
          console.log('No posts found.');
        } else {
          for (const post of result.posts) {
            console.log(formatPost(post));
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch feed:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
