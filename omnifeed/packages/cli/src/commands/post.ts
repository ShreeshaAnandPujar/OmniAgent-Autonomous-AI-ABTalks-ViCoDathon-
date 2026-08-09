import { Command } from 'commander';
import { createClient } from '../client-factory.js';
import { formatPost } from '../output.js';

export const postCommand = new Command('post')
  .description('Create a new post')
  .argument('<content>', 'Post content')
  .option('--channel <channelId>', 'Post to a specific channel')
  .option('--reply-to <postId>', 'Reply to a specific post')
  .option('--json', 'Output raw JSON')
  .action(async (content: string, options: { channel?: string; replyTo?: string; json?: boolean }) => {
    try {
      const client = createClient();
      const post = await client.posts.create({
        content,
        channelId: options.channel,
        parentId: options.replyTo,
      });

      if (options.json) {
        console.log(JSON.stringify(post, null, 2));
      } else {
        console.log('Post created!');
        console.log(formatPost(post));
      }
    } catch (err) {
      console.error('Failed to create post:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
