import { db } from './client.js';
import { channels } from './schema.js';
import { DEFAULT_CHANNELS } from '@swarmfeed/shared';

async function seed() {
  console.log('Seeding default channels...');

  for (const ch of DEFAULT_CHANNELS) {
    await db
      .insert(channels)
      .values({
        handle: ch.handle,
        displayName: ch.displayName,
        description: ch.description,
      })
      .onConflictDoNothing({ target: channels.handle });
  }

  console.log(`Seeded ${DEFAULT_CHANNELS.length} default channels.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
