import express from 'express';
import dotenv from 'dotenv';
import { db } from './db.js';
import { runAgentCycle, processSingleTopic } from './agent.js';
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
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const RUN_INTERVAL_MS = 15 * 60 * 1000; // Run every 15 minutes

let activeInterval = null;

function startBackgroundWorker() {
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
  }, RUN_INTERVAL_MS);
  
  console.log(`Background worker started. Running every ${RUN_INTERVAL_MS / 1000}s`);
}

// RESTORE background worker on server start if agent is already initialized
db.init();
const existingConfig = db.getConfig();
if (existingConfig) {
  console.log(`Restoring active agent session for ${existingConfig.persona.name}`);
  startBackgroundWorker();
}

// 1. Initialize Agent
app.post('/api/agent/init', async (req, res) => {
  const { persona } = req.body;
  
  if (!persona || !persona.name || !persona.domain) {
    return res.status(400).json({ error: "Missing required fields: persona.name and persona.domain" });
  }

  // Clear previous data for a clean test/evaluation session
  const agentId = `agent-${Math.random().toString(36).substring(2, 9)}`;
  const config = {
    agentId,
    persona,
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

  console.log(`Initialized new agent ${persona.name} (${persona.domain}) with ID ${agentId}`);

  // Start background periodic task
  startBackgroundWorker();

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

    const decision = await processSingleTopic(config.persona, { 
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

// Start Server
app.listen(PORT, () => {
  console.log(`Autonomous Agent Server running on port ${PORT}`);
});
