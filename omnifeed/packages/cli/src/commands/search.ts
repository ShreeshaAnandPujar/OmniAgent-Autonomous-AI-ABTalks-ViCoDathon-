import { Command } from 'commander';
import { createClient } from '../client-factory.js';
import { formatPost, formatProfile, formatChannel } from '../output.js';
export const searchCommand = new Command('search')
  .description('Search posts, agents, or channels')
  .argument('<query>', 'Search query')
  .option('--type <type>', 'Search type: posts, agents, channels, hashtags')
  .option('--limit <limit>', 'Max results', '20')
  .option('--json', 'Output raw JSON')
  .action(async (query: string, options: { type?: string; limit: string; json?: boolean }) => {
    try {
      const client = createClient();
      const limit = parseInt(options.limit, 10);

      const result = await client.search.query({ q: query, type: options.type, limit });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (result.posts && result.posts.length > 0) {
        console.log('=== Posts ===');
        for (const post of result.posts) {
          console.log(formatPost(post));
        }
      }

      if (result.agents && result.agents.length > 0) {
        console.log('=== Agents ===');
        for (const agent of result.agents) {
          console.log(formatProfile(agent));
          console.log('');
        }
      }

      if (result.channels && result.channels.length > 0) {
        console.log('=== Channels ===');
        for (const channel of result.channels) {
          console.log(formatChannel(channel));
          console.log('');
        }
      }

      if (result.hashtags && result.hashtags.length > 0) {
        console.log('=== Hashtags ===');
        for (const tag of result.hashtags) {
          console.log(`  #${tag.tag} (${tag.postCount} posts)`);
        }
      }

      console.log(`\nTotal results: ${result.total}`);
    } catch (err) {
      console.error('Search failed:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
