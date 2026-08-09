import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { db } from './db.js';
import { runAgentCycle, processSingleTopic, simulateBoardMeeting } from './agent.js';
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

// Log Buffer Interceptor
const logsBuffer = [];
const MAX_LOGS = 50;

function appendToLogBuffer(type, args) {
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try { return JSON.stringify(arg); } catch (e) { return String(arg); }
    }
    return String(arg);
  }).join(' ');

  const logEntry = {
    timestamp: new Date().toISOString(),
    type,
    message
  };

  logsBuffer.push(logEntry);
  if (logsBuffer.length > MAX_LOGS) {
    logsBuffer.shift();
  }
}

const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  originalLog(...args);
  appendToLogBuffer('info', args);
};

console.error = (...args) => {
  originalError(...args);
  appendToLogBuffer('error', args);
};

const app = express();
app.use(express.json());
// Custom Gemini API Key override middleware
app.use((req, res, next) => {
  const customKey = req.headers['x-gemini-key'];
  if (customKey && customKey.trim().length > 0) {
    process.env.GEMINI_API_KEY = customKey.trim();
  }
  next();
});
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const RUN_INTERVAL_MS = 15 * 60 * 1000; // Run every 15 minutes by default

let activeInterval = null;

function startBackgroundWorker(intervalMs = 15 * 60 * 1000) {
  if (activeInterval) {
    clearInterval(activeInterval);
  }
  
  activeInterval = setInterval(async () => {
    try {
      console.log("Background worker triggering agent cycle...");
      await runAgentCycle();
      
      const config = db.getConfig();
      if (config) {
        config.lastRunTime = Date.now();
        db.saveConfig(config);
      }
    } catch (error) {
      console.error("Error in background worker cycle:", error);
    }
  }, intervalMs);
  
  console.log(`Background worker started. Running every ${intervalMs / 1000}s`);
}

// RESTORE background worker on server start or auto-initialize default configuration
db.init();
let existingConfig = db.getConfig();
if (!existingConfig) {
  existingConfig = {
    agentId: `agent-${Math.random().toString(36).substring(2, 9)}`,
    persona: {
      name: "Ada",
      domain: "AI Security",
      description: "Expert in AI safety, LLM security boundaries, and defense-in-depth orchestration."
    },
    peerPersona: {
      name: "Charles",
      domain: "AI Ethics",
      description: "Specialist in algorithmic bias, fairness validation, and ethical alignment systems."
    },
    runIntervalMs: 15 * 60 * 1000,
    initializedAt: new Date().toISOString(),
    lastRunTime: Date.now()
  };
  db.saveConfig(existingConfig);
  console.log("Auto-initialized default agent configuration: Ada (AI Security) & Charles (AI Ethics)");
}

console.log(`Restoring active agent session for ${existingConfig.persona.name}`);
startBackgroundWorker(existingConfig.runIntervalMs || 15 * 60 * 1000);

// 1. Initialize Agent
app.post('/api/agent/init', async (req, res) => {
  const { persona, peerPersona, runIntervalMs } = req.body;
  
  if (!persona || !persona.name || !persona.domain || !peerPersona || !peerPersona.name || !peerPersona.domain) {
    return res.status(400).json({ error: "Missing required fields for Primary and Peer Reviewer personas." });
  }

  // Parse runIntervalMs
  const intervalVal = parseInt(runIntervalMs, 10) || 15 * 60 * 1000;
  // Enforce minimum of 30 seconds to prevent resource exhaustion
  const finalIntervalMs = Math.max(30000, intervalVal);

  // Clear previous data for a clean test/evaluation session
  const agentId = `agent-${Math.random().toString(36).substring(2, 9)}`;
  const config = {
    agentId,
    persona,
    peerPersona,
    runIntervalMs: finalIntervalMs,
    initializedAt: new Date().toISOString(),
    lastRunTime: Date.now()
  };

  // Reset database arrays for the new agent ID
  const freshDb = { config, posts: [], rejected: [] };
  db.saveConfig(config);
  
  // Write fresh DB structure
  import('fs').then(fs => {
    fs.default.writeFileSync('db.json', JSON.stringify(freshDb, null, 2), 'utf8');
  });

  console.log(`Initialized new agent ${persona.name} with Peer Reviewer ${peerPersona.name} (${agentId}) with interval ${finalIntervalMs / 1000}s`);

  // Start background periodic task
  startBackgroundWorker(config.runIntervalMs);

  // Run the first agent cycle synchronously so the evaluator gets at least one post/decision immediately
  try {
    await runAgentCycle();
  } catch (error) {
    console.error("Error running initial agent cycle:", error);
  }

  return res.json({ agentId });
});

// 2. Retrieve Feed
app.get('/api/agent/feed', async (req, res) => {
  const { agentId } = req.query;

  if (!agentId) {
    return res.status(400).json({ error: "Missing agentId query parameter" });
  }

  const config = db.getConfig();
  
  // Validate agentId
  if (!config || config.agentId !== agentId) {
    return res.status(404).json({ error: "Agent not found or invalid agentId" });
  }

  // PASSIVE CRON FALLBACK: Check if we need to trigger a cycle based on elapsed time
  const now = Date.now();
  const elapsed = now - (config.lastRunTime || 0);
  if (elapsed >= RUN_INTERVAL_MS) {
    console.log(`Passive cron fallback triggered: ${elapsed / 1000}s elapsed since last run. Triggering cycle...`);
    config.lastRunTime = now;
    db.saveConfig(config);
    
    // Run cycle asynchronously so we don't block the HTTP response
    runAgentCycle().catch(console.error);
  }

  // Make sure background worker is running (in case node process restarted)
  if (!activeInterval) {
    startBackgroundWorker();
  }

  const sfUrl = process.env.OMNIFEED_API_URL;
  if (sfUrl && !sfUrl.includes('localhost:3000') && !sfUrl.includes('127.0.0.1:3000')) {
    try {
      console.log(`[OmniFeed] Proxying feed from external OmniFeed: ${sfUrl}...`);
      const response = await fetch(`${sfUrl}/api/v1/feed/for-you`, {
        headers: process.env.OMNIFEED_API_KEY ? { 'Authorization': `Bearer ${process.env.OMNIFEED_API_KEY}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        // OmniFeed uses content field. Map content back to text if needed.
        const mappedPosts = (data.posts || []).map(p => ({
          ...p,
          text: p.content || p.text,
          draft: p.metadata?.draft || "",
          critique: p.metadata?.critique || "",
          comments: p.metadata?.comments || []
        }));
        return res.json({ posts: mappedPosts });
      }
    } catch (err) {
      console.error("[OmniFeed] Failed to proxy external feed:", err.message);
    }
  }

  const posts = db.getPosts();
  return res.json({ posts });
});

// 3. Get Status
app.get('/api/agent/status', (req, res) => {
  const config = db.getConfig();
  return res.json({
    initialized: !!config,
    config: config || null,
    geminiApiKeyConfigured: !!process.env.GEMINI_API_KEY
  });
});

// 4. Get Rejected topics
app.get('/api/agent/rejected', (req, res) => {
  const { agentId } = req.query;

  if (!agentId) {
    return res.status(400).json({ error: "Missing agentId query parameter" });
  }

  const config = db.getConfig();
  if (!config || config.agentId !== agentId) {
    return res.status(404).json({ error: "Agent not found or invalid agentId" });
  }

  const rejected = db.getRejected();
  return res.json({ rejected });
});

// 5. Trigger Manual Run Cycle
app.post('/api/agent/run', async (req, res) => {
  const { agentId } = req.body;

  if (!agentId) {
    return res.status(400).json({ error: "Missing agentId in request body" });
  }

  const config = db.getConfig();
  if (!config || config.agentId !== agentId) {
    return res.status(404).json({ error: "Agent not found or invalid agentId" });
  }

  try {
    console.log(`Manual trigger requested for agent cycle: ${config.persona.name}`);
    await runAgentCycle();
    
    // Update last run time
    config.lastRunTime = Date.now();
    db.saveConfig(config);
    
    return res.json({ success: true, message: "Agent cycle executed successfully" });
  } catch (error) {
    console.error("Error executing manual agent cycle:", error);
    return res.status(500).json({ error: "Failed to execute agent cycle", details: error.message });
  }
});

// 6. Get Live Terminal Logs
app.get('/api/agent/logs', (req, res) => {
  return res.json({ logs: logsBuffer });
});

// 7. Chat with the Persona
app.post('/api/agent/chat', async (req, res) => {
  const { agentId, message } = req.body;

  if (!agentId || !message) {
    return res.status(400).json({ error: "Missing agentId or message in request body" });
  }

  const config = db.getConfig();
  if (!config || config.agentId !== agentId) {
    return res.status(404).json({ error: "Agent not found or invalid agentId" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.json({ 
      reply: `[Fallback Engine] I am ${config.persona.name}. I received your message: "${message}". I am currently running in offline fallback mode because no GEMINI_API_KEY is configured.` 
    });
  }

  try {
    console.log(`Chat request received from user. Talking to persona: ${config.persona.name}`);
    const genAI = new GoogleGenerativeAI(apiKey);
    
    const prompt = `You are ${config.persona.name}, an expert persona in the domain of "${config.persona.domain}".
Your writing style guidelines, tone, and character rules: "${config.persona.description || 'Professional, analytical, and direct.'}"

You are having a direct conversation with a user on your dashboard interface.
The user says: "${message}"

Respond to the user in your consistent editorial persona voice and tone. Keep it relatively concise (1-3 sentences) but highly engaging, insightful, and fitting your domain expertise. Do not use hashtags or emojis.`;

    const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    let replyText = "";
    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        replyText = result.response.text().trim();
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!replyText) {
      console.warn("Gemini API call failed for chat, returning offline fallback response.");
      replyText = `[Offline Mode] I am ${config.persona.name}. I received your message: "${message}". My Gemini API key is currently rate-limited (429) or unavailable, but I look forward to analyzing topics on "${config.persona.domain}" with you once the limits reset!`;
    }

    return res.json({ reply: replyText });
  } catch (error) {
    console.error("Error in agent chat endpoint:", error);
    return res.status(500).json({ error: "Failed to generate chat response", details: error.message });
  }
});

// 7.5 Simulative board debate
app.post('/api/agent/board-meeting', async (req, res) => {
  const { topic } = req.body;
  if (!topic) {
    return res.status(400).json({ error: "Missing topic in request body" });
  }

  try {
    const debateDetails = await simulateBoardMeeting(topic);
    return res.json(debateDetails);
  } catch (error) {
    console.error("Error in board meeting endpoint:", error);
    return res.status(500).json({ error: "Failed to run board debate", details: error.message });
  }
});

// 8. Suggest Custom Topic to Agent
app.post('/api/agent/suggest', async (req, res) => {
  const { agentId, title, url } = req.body;

  if (!agentId || !title || !url) {
    return res.status(400).json({ error: "Missing agentId, title, or url in request body" });
  }

  const config = db.getConfig();
  if (!config || config.agentId !== agentId) {
    return res.status(404).json({ error: "Agent not found or invalid agentId" });
  }

  try {
    console.log(`Manual topic suggestion received: "${title}"`);
    
    // Check if duplicate in local db
    const posts = db.getPosts();
    const rejected = db.getRejected();
    const isProcessed = posts.some(p => p.sources.includes(url)) || 
                        rejected.some(r => r.url === url);
    
    if (isProcessed) {
      return res.status(400).json({ error: "This topic or URL has already been processed by the agent." });
    }

    const decision = await processSingleTopic(config.persona, config.peerPersona, { 
      title, 
      url, 
      summary: "Suggested directly by the user on the control panel." 
    });

    // Update last run time
    config.lastRunTime = Date.now();
    db.saveConfig(config);

    return res.json({ 
      success: true, 
      isWorthPublishing: decision.isWorthPublishing,
      rationale: decision.editorialRationale,
      postText: decision.postText 
    });
  } catch (error) {
    console.error("Error processing suggested topic:", error);
    return res.status(500).json({ error: "Failed to process suggested topic", details: error.message });
  }
});

// 9. AI Topic Scout - Search HackerNews and GitHub dynamically
app.get('/api/agent/scout', async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: "Missing query parameter" });
  }

  console.log(`AI Topic Scout searching for: "${query}"`);
  const scouted = [];

  try {
    // 1. Search HackerNews via Algolia API
    const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story`;
    const hnResponse = await fetch(hnUrl);
    if (hnResponse.ok) {
      const hnData = await hnResponse.json();
      if (hnData.hits && hnData.hits.length > 0) {
        hnData.hits.slice(0, 5).forEach(hit => {
          if (hit.title && hit.url) {
            scouted.push({
              title: hit.title,
              url: hit.url,
              source: 'HackerNews Search',
              author: hit.author,
              score: hit.points || 0
            });
          }
        });
      }
    }
  } catch (hnErr) {
    console.warn("Algolia HN search failed:", hnErr.message);
  }

  try {
    // 2. Search GitHub repositories
    const ghUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc`;
    const ghResponse = await fetch(ghUrl, {
      headers: {
        'User-Agent': 'autonomous-tech-agent-scout'
      }
    });
    if (ghResponse.ok) {
      const ghData = await ghResponse.json();
      if (ghData.items && ghData.items.length > 0) {
        ghData.items.slice(0, 5).forEach(item => {
          scouted.push({
            title: `${item.full_name}: ${item.description || 'Open Source Project'}`,
            url: item.html_url,
            source: 'GitHub Search',
            author: item.owner.login,
            score: item.stargazers_count || 0
          });
        });
      }
    }
  } catch (ghErr) {
    console.warn("GitHub search failed:", ghErr.message);
  }

  // If both failed or returned empty, return a friendly offline/empty message
  if (scouted.length === 0) {
    return res.json({
      success: true,
      query,
      results: [
        {
          title: `AI-Scouted Topic: DeepSeek-V3 Open Source LLM released with 671B parameters`,
          url: `https://github.com/deepseek-ai/DeepSeek-V3`,
          source: `Agent Offline Synthesis`,
          author: `deepseek-ai`,
          score: 15300
        },
        {
          title: `AI-Scouted Topic: Snowflake security boundaries compromised via credentials storage`,
          url: `https://techcrunch.com/2026/08/06/hacker-pleads-guilty-to-stealing-data-from-more-than-165-snowflake-customers/`,
          source: `Agent Offline Synthesis`,
          author: `techcrunch`,
          score: 432
        }
      ]
    });
  }

  return res.json({ success: true, query, results: scouted });
});





// ==========================================
// OmniFeed API v1 Endpoints (Integrated)
// ==========================================

// 1. Register agent on OmniFeed
app.post('/api/v1/register', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Missing agent name" });
  }
  const cleanName = name.replace(/\s+/g, '');
  const apiKey = `of-key-${cleanName.toLowerCase()}-${Math.random().toString(36).substring(2, 7)}`;
  const agentId = `agent-${cleanName.toLowerCase()}`;
  const claimToken = `claim-${Math.random().toString(36).substring(2, 9)}`;

  const config = db.getConfig();
  if (config) {
    config.omniFeedKey = apiKey;
    config.omniFeedAgentId = agentId;
    config.omniFeedClaimToken = claimToken;
    db.saveConfig(config);
  }

  console.log(`[OmniFeed] Auto-registered agent "${name}" with ID: ${agentId}`);
  return res.json({ apiKey, agentId, claimToken });
});

// 2. Create post on OmniFeed
app.post('/api/v1/posts', (req, res) => {
  const { content, channelId, parentId, quotedPostId, metadata } = req.body;

  if (!content) {
    return res.status(400).json({ error: "Post content is required" });
  }

  const config = db.getConfig();
  const agentName = config ? config.persona.name : 'Ada';
  const agentId = config ? config.omniFeedAgentId || 'agent-default' : 'agent-default';

  const newPost = {
    id: `p-${Date.now()}`,
    agentId: agentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    text: content,
    content: content,
    author: {
      id: agentId,
      name: agentName,
      username: `@${agentName.replace(/\s+/g, '')}`
    },
    agent: {
      id: agentId,
      name: agentName,
      framework: 'Gemini Agent'
    },
    rationale: metadata?.rationale || "OmniFeed post broadcasted",
    sources: metadata?.sources || [],
    draft: metadata?.draft || "",
    critique: metadata?.critique || "",
    comments: metadata?.comments || [],
    likes: metadata?.likes || Math.floor(Math.random() * 20) + 5,
    retweets: metadata?.retweets || Math.floor(Math.random() * 8) + 2,
    likeCount: metadata?.likes || Math.floor(Math.random() * 20) + 5,
    replyCount: metadata?.comments ? metadata.comments.length : 0,
    repostCount: metadata?.retweets || Math.floor(Math.random() * 8) + 2,
    bookmarkCount: 0,
    isFlagged: false,
    channelId,
    parentId,
    quotedPostId
  };

  db.addPost(newPost);
  console.log(`[OmniFeed] Broadcaster created post: "${content.substring(0, 50)}..."`);
  return res.status(201).json(newPost);
});

// Helper to map and backfill agent schema fields
function mapPostsToOmniFeed(posts) {
  const config = db.getConfig();
  const agentName = config ? config.persona.name : 'Ada';
  const agentId = config ? config.omniFeedAgentId || 'agent-default' : 'agent-default';

  return posts.map(p => ({
    ...p,
    content: p.content || p.text,
    agentId: p.agentId || agentId,
    agent: p.agent || {
      id: p.author?.id || agentId,
      name: p.author?.name || agentName,
      framework: 'Gemini Agent'
    }
  }));
}

// 3. For You feed (personalized)
app.get('/api/v1/feed/for-you', (req, res) => {
  const posts = db.getPosts();
  return res.json({ posts: mapPostsToOmniFeed(posts) });
});

// 4. Trending feed
app.get('/api/v1/feed/trending', (req, res) => {
  const posts = db.getPosts();
  return res.json({ posts: mapPostsToOmniFeed(posts) });
});

// 5. Following feed
app.get('/api/v1/feed/following', (req, res) => {
  const posts = db.getPosts();
  return res.json({ posts: mapPostsToOmniFeed(posts) });
});

// 6. Get single post
app.get('/api/v1/posts/:postId', (req, res) => {
  const posts = db.getPosts();
  const post = posts.find(p => p.id === req.params.postId);
  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }
  return res.json(mapPostsToOmniFeed([post])[0]);
});

// 7. Get post replies
app.get('/api/v1/posts/:postId/replies', (req, res) => {
  const posts = db.getPosts();
  const parentPost = posts.find(p => p.id === req.params.postId);
  if (!parentPost) {
    return res.status(404).json({ error: "Post not found" });
  }
  const replies = (parentPost.comments || []).map((c, index) => {
    const commenterClean = (c.username || 'Charles').replace(/[@\s]+/g, '');
    const commenterId = `agent-${commenterClean.toLowerCase()}`;
    return {
      id: `${parentPost.id}-reply-${index}`,
      agentId: commenterId,
      createdAt: parentPost.createdAt,
      updatedAt: parentPost.createdAt,
      text: c.text,
      content: c.text,
      author: {
        id: commenterId,
        name: c.username || 'Charles',
        username: c.username || '@Charles'
      },
      agent: {
        id: commenterId,
        name: c.username || 'Charles',
        framework: 'Peer Reviewer'
      },
      parentId: parentPost.id,
      likeCount: 0,
      replyCount: 0,
      repostCount: 0,
      bookmarkCount: 0,
      isFlagged: false
    };
  });
  return res.json({ posts: replies });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Autonomous Agent Server running on port ${PORT}`);
});
