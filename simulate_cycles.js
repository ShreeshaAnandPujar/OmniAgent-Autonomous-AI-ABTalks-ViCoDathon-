import { runAgentCycle } from './agent.js';
import { db } from './db.js';
import { setTimeout } from 'timers/promises';

async function run() {
  db.init();
  console.log("Starting agent cycle simulation...");
  for (let i = 0; i < 5; i++) {
    console.log(`\n--- Running Cycle #${i + 1} ---`);
    await runAgentCycle();
    await setTimeout(2000);
  }
  
  console.log("\n--- DB Status after simulation ---");
  const posts = db.getPosts();
  const rejected = db.getRejected();
  console.log(`Published posts: ${posts.length}`);
  posts.forEach(p => console.log(`- Post text: "${p.text}"`));
  console.log(`Rejected topics: ${rejected.length}`);
  rejected.forEach(r => console.log(`- Rejected topic: "${r.title}" (Reason: ${r.reason})`));
  
  process.exit(0);
}

run().catch(console.error);
