import { setTimeout } from 'timers/promises';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log("Starting autonomous agent validation tests...");
  
  // 1. Initialize Agent
  console.log("Calling POST /api/agent/init...");
  const initRes = await fetch(`${BASE_URL}/api/agent/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      persona: {
        name: "Ada",
        domain: "AI Security"
      }
    })
  });

  if (!initRes.ok) {
    throw new Error(`Failed to initialize agent: ${initRes.statusText}`);
  }

  const { agentId } = await initRes.json();
  console.log(`Agent initialized successfully! ID: ${agentId}`);

  // Wait 10 seconds to allow the initial agent cycle to complete
  console.log("Waiting 10 seconds for initial cycle and Breeth memory sync...");
  await setTimeout(10000);

  // 2. Fetch Feed
  console.log(`Calling GET /api/agent/feed?agentId=${agentId}...`);
  const feedRes = await fetch(`${BASE_URL}/api/agent/feed?agentId=${agentId}`);

  if (!feedRes.ok) {
    throw new Error(`Failed to fetch feed: ${feedRes.statusText}`);
  }

  const { posts } = await feedRes.json();
  console.log(`Feed retrieved successfully! Found ${posts.length} posts.`);

  if (posts.length > 0) {
    console.log("Latest Post Details:");
    console.log(JSON.stringify(posts[0], null, 2));
  } else {
    console.log("No posts published in the initial run. Checking db.json for rejected topics...");
    try {
      const fs = await import('fs');
      const db = JSON.parse(fs.default.readFileSync('db.json', 'utf8'));
      console.log(`Rejected topics in DB: ${db.rejected.length}`);
      if (db.rejected.length > 0) {
        console.log("Latest Rejected Topic Details:", JSON.stringify(db.rejected[0], null, 2));
      }
    } catch (e) {
      console.error("Failed to read DB details:", e);
    }
  }

  console.log("Validation tests finished successfully!");
}

runTests().catch(error => {
  console.error("Test validation failed:", error);
  process.exit(1);
});
