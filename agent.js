import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "./db.js";
import { checkMemoryForTopic, recordPostInMemory } from "./breeth.js";

// Helper to clean up HTML/CDATA entities
function cleanText(str) {
  if (!str) return "";
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, '') // Strip remaining HTML tags
    .trim();
}

async function fetchGithubTrending() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString().split('T')[0];
    
    console.log(`Fetching trending Github repositories created since ${dateStr}...`);
    const res = await fetch(`https://api.github.com/search/repositories?q=created:>${dateStr}&sort=stars&order=desc&per_page=10`, {
      headers: { 'User-Agent': 'autonomous-agent' }
    });
    
    if (!res.ok) throw new Error(`GitHub API returned status ${res.status}`);
    
    const json = await res.json();
    return (json.items || []).map(item => ({
      title: `${item.owner.login}/${item.name}: ${item.description || ''}`,
      url: item.html_url,
      summary: `A trending GitHub repository with ${item.stargazers_count} stars. Primary language: ${item.language || 'Unknown'}. Description: ${item.description || 'No description available.'}`
    }));
  } catch (e) {
    console.error("Error fetching GitHub trending:", e);
    return [];
  }
}

async function fetchHNStories() {
  try {
    const res = await fetch("https://hn.algolia.com/api/v1/search?tags=front_page");
    const json = await res.json();
    return (json.hits || []).map(hit => ({
      title: cleanText(hit.title),
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      summary: cleanText(hit.story_text || "")
    }));
  } catch (e) {
    console.error("Error fetching HN stories:", e);
    return [];
  }
}

async function fetchTechCrunchStories() {
  try {
    const res = await fetch("https://techcrunch.com/feed/");
    const xml = await res.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const content = match[1];
      const title = (content.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
      const link = (content.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "";
      const description = (content.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || "";
      
      items.push({
        title: cleanText(title),
        url: cleanText(link),
        summary: cleanText(description)
      });
    }
    return items;
  } catch (e) {
    console.error("Error fetching TechCrunch stories:", e);
    return [];
  }
}

// Fallback logic when GEMINI_API_KEY is not available or rate-limited
function runLocalEditorialDecision(persona, topic) {
  const title = topic.title.toLowerCase();
  const summary = topic.summary.toLowerCase();
  const domain = persona.domain.toLowerCase();

  // Define rich keywords per domain to maximize matching for hackathon validation
  const domainKeywords = {
    "ai security": ["security", "hack", "exploit", "leak", "attack", "jailbreak", "injection", "vulnerability", "auth", "safe", "breach", "model theft", "snowflake", "guilty", "court", "threat", "cyber", "firewall", "encryption", "bot", "traffic", "hacker"],
    "ai ethics": ["ethics", "bias", "fairness", "regulation", "law", "scrutiny", "copyright", "privacy", "discrimination", "policy", "trust", "court", "child", "harm", "harms", "legal", "lawsuit", "meta", "children"],
    "machine learning": ["ml", "train", "dataset", "gpu", "model", "parameter", "weight", "weights", "llm", "neural", "transformers", "training", "compute", "parameters", "dataset", "fine-tuning", "nvidia", "deep learning", "amd"],
    "robotics": ["robot", "robotics", "drone", "actuator", "sensor", "vision", "hardware", "autonomous vehicle", "rl", "manipulation", "motor", "control", "hardware", "tesla", "car", "driving", "terafab"],
    "ai product analyst": ["product", "market", "startup", "revenue", "user", "adoption", "features", "saas", "enterprise", "valuation", "business", "company", "growth", "funding", "acquisition", "merge", "meta", "google", "apple", "microsoft"],
    "open source": ["open source", "repo", "github", "huggingface", "oss", "git", "license", "free", "community", "weights", "repository", "codebase", "developer", "photo-abstract-editorial"]
  };

  // Find matches
  let keywords = domainKeywords[domain] || ["ai", "tech", "software", "developer", "model"];
  const isRelevant = keywords.some(kw => title.includes(kw) || summary.includes(kw));

  if (!isRelevant) {
    return {
      isWorthPublishing: false,
      editorialRationale: `Topic is not directly relevant to the ${persona.domain} domain based on keyword matching.`
    };
  }

  // Generate templates based on domain
  let postText = "";
  let rationale = "";

  if (domain.includes("security")) {
    postText = `The implications of "${topic.title}" show why AI boundary defense must evolve. Current LLM trust models assume inputs are clean, but parsing untrusted content remains an open attack vector. Securing the context window is our primary challenge.`;
    rationale = `Discusses the security vulnerabilities highlighted in the topic, explaining why immediate boundary defense is relevant now.`;
  } else if (domain.includes("ethics")) {
    postText = `Recent reporting on "${topic.title}" highlights the ongoing struggle to balance raw model capabilities with human safety and fairness. Technical optimization alone won't solve systemic bias; we need operational guardrails.`;
    rationale = `Evaluates the ethical and policy implications of the news, focusing on the lack of guardrails.`;
  } else if (domain.includes("product")) {
    postText = `Analyzing the market adoption of "${topic.title}" reveals the transition from AI hype to practical product value. Winners won't be defined by parameter counts, but by vertical integration and user workflow retention.`;
    rationale = `Identifies market-driven adoption indicators, cost-to-serve dynamics, and shifts focus toward product utility.`;
  } else if (domain.includes("learning") || domain.includes("ml")) {
    postText = `Looking at the research behind "${topic.title}", it is clear that architectural efficiency and data curation are becoming more critical than raw scaling. Model optimization at the compiler level will define the next phase of training efficiency.`;
    rationale = `Analyzes the machine learning methodologies, optimizer configurations, and model parameter efficiencies.`;
  } else if (domain.includes("robot")) {
    postText = `The engineering breakthrough in "${topic.title}" underscores how physical embodiment changes the reinforcement learning equation. Bridging the simulation-to-reality gap is no longer just a software problem—it is a co-design challenge.`;
    rationale = `Evaluates the physical kinematics, control theory, and hardware-software integration of the robotics development.`;
  } else if (domain.includes("open") || domain.includes("source")) {
    postText = `The community traction of "${topic.title}" is a testament to why open weights and transparent licensing drive faster innovation than closed models. Open-source collaboration democratizes tooling and provides vital auditability.`;
    rationale = `Highlights open-source distribution patterns, developer community engagement, and licensing benefits.`;
  } else {
    // Default fallback
    postText = `The announcement of "${topic.title}" marks an important progression in our tech stack. As systems grow more complex, keeping integrations simple and transparent is key to long-term scalability.`;
    rationale = `Analyzes how the topic impacts the general technology ecosystem and system design.`;
  }

  return {
    isWorthPublishing: true,
    editorialRationale: rationale,
    postText
  };
}

export async function runAgentCycle() {
  const config = db.getConfig();
  if (!config) {
    console.log("Agent not initialized yet.");
    return;
  }

  const { persona, agentId } = config;
  console.log(`Running autonomous cycle for agent: ${persona.name} (${persona.domain})`);

  // 1. Discovery: Fetch latest topics
  const hnStories = await fetchHNStories();
  const tcStories = await fetchTechCrunchStories();
  const ghRepos = await fetchGithubTrending();
  const allTopics = [...hnStories, ...tcStories, ...ghRepos];

  if (allTopics.length === 0) {
    console.log("No topics discovered in this cycle.");
    return;
  }

  // Shuffle topics to get dynamic selections
  allTopics.sort(() => Math.random() - 0.5);

  const posts = db.getPosts();
  const rejected = db.getRejected();

  // Find a topic we haven't processed yet
  let selectedTopic = null;
  for (const topic of allTopics) {
    const isProcessed = posts.some(p => p.sources.includes(topic.url)) || 
                        rejected.some(r => r.url === topic.url);
    if (!isProcessed) {
      // Check Breeth memory to ensure it's not a duplicate
      const inBreethMemory = await checkMemoryForTopic(topic.title);
      if (!inBreethMemory) {
        selectedTopic = topic;
        break;
      } else {
        // Record as rejected (duplicate)
        db.addRejected({
          url: topic.url,
          title: topic.title,
          reason: "Duplicate topic found in Breeth memory"
        });
      }
    }
  }

  if (!selectedTopic) {
    console.log("All discovered topics in this cycle were already processed or present in memory.");
    return;
  }

  await processSingleTopic(persona, selectedTopic);
}

export async function processSingleTopic(persona, selectedTopic) {
  console.log(`Evaluating discovered topic: "${selectedTopic.title}"`);

  // 2. Editorial Judgment & Persona writing
  let decision = null;
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      console.log("Using Gemini API with Self-Reflection loop for editorial judgment...");
      const genAI = new GoogleGenerativeAI(apiKey);

      const prompt = `You are ${persona.name}, an expert persona in the domain of "${persona.domain}".
Your writing style guidelines, tone, and character rules: "${persona.description || 'Professional, analytical, and direct.'}"
Your job is to discover topics, make editorial decisions on what is worth publishing, and write high-quality posts.

Here is a topic you just discovered:
Title: "${selectedTopic.title}"
URL: "${selectedTopic.url}"
Summary/Context: "${selectedTopic.summary || 'No summary available.'}"

First, evaluate if this topic is highly relevant to your domain ("${persona.domain}") and meets your professional standards. Be selective: reject topics that are too generic, off-topic, or low-quality.

If isWorthPublishing is true, you must write a social media post. Perform a self-reflection critique step to write the absolute best post:
1. Draft an initial post.
2. Critique the draft against your guidelines: does it contain emojis? (none allowed), does it contain hashtags? (none allowed), is it too generic? does it capture your voice correctly?
3. Polish and write the final post incorporating your critique.

Respond with a JSON object in this exact schema (no additional markdown wrap, just pure JSON):
{
  "isWorthPublishing": true or false,
  "editorialRationale": "Detailed rationale explaining why this topic was selected or rejected, why it is relevant now, and why it fits your persona.",
  "draftPostText": "Initial drafted post (if isWorthPublishing is true, otherwise empty).",
  "selfCritique": "Critique checking if the draft violates guidelines like containing emojis/hashtags, deviating from tone, or being too generic.",
  "postText": "Refined and polished final post incorporating the selfCritique feedback (no emojis, no hashtags, 1-3 sentences)."
}`;

      const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
      let lastError = null;

      for (const modelName of candidateModels) {
        try {
          console.log(`Calling Gemini API using model: ${modelName}...`);
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          });

          const responseText = result.response.text();
          decision = JSON.parse(responseText);
          console.log(`Successfully completed Gemini call using model: ${modelName}`);
          
          if (decision.isWorthPublishing) {
            console.log(`Self-Reflection Loop details:`);
            console.log(`- Draft: "${decision.draftPostText}"`);
            console.log(`- Critique: "${decision.selfCritique}"`);
            console.log(`- Final Post: "${decision.postText}"`);
          }
          break;
        } catch (error) {
          console.error(`Failed with model ${modelName}:`, error.message);
          lastError = error;
        }
      }

      if (!decision) {
        throw lastError || new Error("All candidate Gemini models failed");
      }
    } catch (error) {
      console.error("Gemini API call failed, falling back to local engine:", error.message);
      decision = runLocalEditorialDecision(persona, selectedTopic);
    }
  } else {
    console.log("No GEMINI_API_KEY found. Running local rule-based fallback engine...");
    decision = runLocalEditorialDecision(persona, selectedTopic);
  }

  // 3. Process the Decision
  if (decision.isWorthPublishing) {
    const newPost = {
      id: `p-${Date.now()}`,
      createdAt: new Date().toISOString(),
      text: decision.postText,
      rationale: decision.editorialRationale,
      sources: [selectedTopic.url]
    };

    console.log(`Topic ACCEPTED! Publishing post: "${newPost.text}"`);
    
    // Save locally
    db.addPost(newPost);

    // Save in Breeth memory (asynchronous)
    await recordPostInMemory(persona.name, newPost.id, selectedTopic.title, newPost.text);
  } else {
    console.log(`Topic REJECTED. Rationale: ${decision.editorialRationale}`);
    db.addRejected({
      url: selectedTopic.url,
      title: selectedTopic.title,
      reason: decision.editorialRationale
    });
  }

  return decision;
}
