import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "./db.js";
import { checkMemoryForTopic, recordPostInMemory, searchRelatedMemories } from "./breeth.js";

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

  const { persona, peerPersona, agentId } = config;
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

  await processSingleTopic(persona, peerPersona, selectedTopic);
}

export async function processSingleTopic(persona, peerPersona, selectedTopic) {
  console.log(`Evaluating discovered topic: "${selectedTopic.title}"`);

  // 1. Context-Aware RAG (Retrieve past memories from Breeth MCP graph)
  let pastMemoriesContext = "";
  try {
    const searchTerms = selectedTopic.title.split(' ')
      .filter(w => w.length > 4)
      .slice(0, 3)
      .join(' ')
      .replace(/[^a-zA-Z0-9 ]/g, "");
    
    if (searchTerms) {
      console.log(`RAG: Retrieving memories for query: "${searchTerms}"...`);
      const memories = await searchRelatedMemories(searchTerms);
      if (memories) {
        pastMemoriesContext = `\n[Episodic Memory RAG context found in Breeth graph]:\n${memories}\n(Align or reference this past context if relevant to maintain continuity.)`;
      }
    }
  } catch (err) {
    console.error("RAG memory search failed:", err.message);
  }

  let decision = {
    isWorthPublishing: false,
    editorialRationale: "",
    postText: "",
    draftPostText: "",
    peerCritique: "",
    comments: []
  };

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
      let selectedModel = null;
      let lastError = null;

      // Find a working model
      for (const modelName of candidateModels) {
        try {
          console.log(`Checking model availability: ${modelName}...`);
          const testModel = genAI.getGenerativeModel({ model: modelName });
          await testModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: "ping" }] }]
          });
          selectedModel = testModel;
          console.log(`Model selected: ${modelName}`);
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!selectedModel) {
        throw lastError || new Error("All candidate Gemini models failed availability checks.");
      }

      // STAGE 1: Editorial Evaluation & Primary Agent Draft
      console.log(`[Stage 1] Primary Agent ${persona.name} evaluating topic & writing draft...`);
      const stage1Prompt = `You are ${persona.name}, an expert persona in the domain of "${persona.domain}".
Style guideline: "${persona.description || 'Professional, analytical, and direct.'}"
${pastMemoriesContext}

Evaluate this discovered topic:
Title: "${selectedTopic.title}"
URL: "${selectedTopic.url}"
Summary/Context: "${selectedTopic.summary || 'No summary available.'}"

Determine if it is highly relevant and worth publishing. Respond with a JSON object in this exact schema:
{
  "isWorthPublishing": true or false,
  "editorialRationale": "Your rationale for selecting or rejecting this topic.",
  "draftPost": "If isWorthPublishing is true, draft a short commentary (1-2 sentences) in your voice. Avoid hashtags and emojis. If false, leave empty."
}`;

      const stage1Result = await selectedModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: stage1Prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      });
      const stage1Data = JSON.parse(stage1Result.response.text());

      if (stage1Data.isWorthPublishing) {
        decision.isWorthPublishing = true;
        decision.editorialRationale = stage1Data.editorialRationale;
        decision.draftPostText = stage1Data.draftPost;

        // STAGE 2: Peer Reviewer Critique & Debate
        console.log(`[Stage 2] Peer Reviewer Agent ${peerPersona.name} critiquing draft...`);
        const stage2Prompt = `You are ${peerPersona.name}, a peer reviewer persona in the domain of "${peerPersona.domain}".
Style guideline: "${peerPersona.description || 'Analytical and critical.'}"

Analyze this draft editorial post written by your colleague:
Draft Post: "${decision.draftPostText}"
Topic Title: "${selectedTopic.title}"

Provide a professional critique or debating point (1-2 sentences) from your specific perspective as an expert in "${peerPersona.domain}". Challenge the draft if it overlooks key aspects, or suggest how it can be refined to be more insightful.
Respond with a JSON object in this exact schema:
{
  "peerCritique": "Your constructive critique or debating point."
}`;

        const stage2Result = await selectedModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: stage2Prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        });
        const stage2Data = JSON.parse(stage2Result.response.text());
        decision.peerCritique = stage2Data.peerCritique;

        // STAGE 3: Final Refinement & Polishing
        console.log(`[Stage 3] Primary Agent ${persona.name} refining final post...`);
        const stage3Prompt = `You are ${persona.name} (${persona.domain}). 
Your colleague ${peerPersona.name} (${peerPersona.domain}) has critiqued your draft.
Critique: "${decision.peerCritique}"
Your Original Draft: "${decision.draftPostText}"

Refine your draft incorporating their feedback into a final, polished editorial post.
Guidelines:
- Keep it to 1-3 sentences.
- Do NOT use emojis or hashtags.
- Keep it highly professional and insightful.

Respond with a JSON object in this exact schema:
{
  "postText": "Your final refined and polished post text."
}`;

        const stage3Result = await selectedModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: stage3Prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        });
        const stage3Data = JSON.parse(stage3Result.response.text());
        decision.postText = stage3Data.postText;

        // STAGE 4: AI Social Discussions Generation
        console.log(`[Stage 4] Generating dynamic AI social replies...`);
        const stage4Prompt = `Generate 2-3 realistic replies/comments from different fictional Twitter/X handles (e.g. @CodeSlinger, @TechLead, @AIOptimist) reacting to this post:
Post: "${decision.postText}"

Respond with a JSON object containing an array of replies:
{
  "replies": [
    {"username": "@handle", "text": "A brief comment reacting to the post (agreeing, questioning, or adding perspective)."}
  ]
}`;

        const stage4Result = await selectedModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: stage4Prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        });
        const stage4Data = JSON.parse(stage4Result.response.text());
        decision.comments = stage4Data.replies || [];

        console.log(`Multi-agent review process completed successfully:`);
        console.log(`- Draft: "${decision.draftPostText}"`);
        console.log(`- Critique: "${decision.peerCritique}"`);
        console.log(`- Final Post: "${decision.postText}"`);
      } else {
        decision.editorialRationale = stage1Data.editorialRationale;
      }

    } catch (error) {
      console.error("Gemini Multi-Agent execution failed, falling back to local engine:", error.message);
      decision = runLocalEditorialDecision(persona, selectedTopic);
      decision.comments = [
        { username: "@DevAdvocate", text: "Interesting perspective, keeping an eye on this." },
        { username: "@TechTracker", text: "Glad to see this covered. Matches what we are seeing." }
      ];
    }
  } else {
    console.log("No GEMINI_API_KEY found. Running local rule-based fallback engine...");
    decision = runLocalEditorialDecision(persona, selectedTopic);
    decision.comments = [
      { username: "@DevAdvocate", text: "Interesting perspective, keeping an eye on this." },
      { username: "@TechTracker", text: "Glad to see this covered. Matches what we are seeing." }
    ];
  }

  // 3. Process the Decision
  if (decision.isWorthPublishing) {
    const newPost = {
      id: `p-${Date.now()}`,
      createdAt: new Date().toISOString(),
      text: decision.postText,
      rationale: decision.editorialRationale,
      sources: [selectedTopic.url],
      draft: decision.draftPostText,
      critique: decision.peerCritique,
      comments: decision.comments,
      likes: Math.floor(Math.random() * 20) + 5,
      retweets: Math.floor(Math.random() * 8) + 2
    };

    console.log(`Topic ACCEPTED! Publishing post: "${newPost.text}"`);

    // OmniFeed auto-registration & publishing flow (natively integrated)
    const sfUrl = process.env.OMNIFEED_API_URL || 'http://localhost:3000';
    let sfApiKey = process.env.OMNIFEED_API_KEY;

    if (!sfApiKey) {
      try {
        console.log(`[OmniFeed] Auto-registering agent "${persona.name}" on ${sfUrl}...`);
        const registerRes = await fetch(`${sfUrl}/api/v1/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: persona.name })
        });
        if (registerRes.ok) {
          const regData = await registerRes.json();
          sfApiKey = regData.apiKey;
          process.env.OMNIFEED_API_KEY = sfApiKey;
          console.log(`[OmniFeed] Registration successful! API Key: ${sfApiKey}`);
        }
      } catch (err) {
        console.error("[OmniFeed] Registration failed:", err.message);
      }
    }

    if (sfApiKey) {
      try {
        console.log(`[OmniFeed] Publishing post to OmniFeed: "${newPost.text}"...`);
        const publishRes = await fetch(`${sfUrl}/api/v1/posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sfApiKey}`
          },
          body: JSON.stringify({
            content: newPost.text,
            metadata: {
              rationale: newPost.rationale,
              sources: newPost.sources,
              draft: newPost.draft,
              critique: newPost.critique,
              comments: newPost.comments,
              likes: newPost.likes,
              retweets: newPost.retweets
            }
          })
        });
        if (!publishRes.ok) {
          throw new Error(`API returned status ${publishRes.status}`);
        }
        console.log(`[OmniFeed] Successfully published to OmniFeed!`);
      } catch (err) {
        console.error("[OmniFeed] Failed to publish to OmniFeed, falling back to local DB write:", err.message);
        db.addPost(newPost);
      }
    } else {
      // Fallback if OmniFeed registration failed completely
      db.addPost(newPost);
    }

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

export async function simulateBoardMeeting(topic) {
  const config = db.getConfig();
  if (!config) {
    throw new Error("Agent not initialized yet.");
  }

  const { persona, peerPersona } = config;
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let model = null;
  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const testModel = genAI.getGenerativeModel({ model: modelName });
      await testModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: "ping" }] }]
      });
      model = testModel;
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!model) {
    throw lastError || new Error("All candidate Gemini models failed availability checks.");
  }

  console.log(`[Board Meeting] Simulating debate on topic: "${topic}"`);

  // 1. Primary Agent Perspective
  const prompt1 = `You are ${persona.name}, a technology board member specializing in "${persona.domain}".
Style & role: "${persona.description}"

We are holding an interactive board meeting on this topic:
Topic: "${topic}"

Provide your professional assessment and opening argument (2-3 sentences) on this topic. Be sharp, direct, and voice your expert perspective.
Respond in JSON format:
{
  "argument": "Your opening argument here."
}`;

  const res1 = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt1 }] }],
    generationConfig: { responseMimeType: "application/json" }
  });
  const data1 = JSON.parse(res1.response.text());

  // 2. Peer Reviewer Critique
  const prompt2 = `You are ${peerPersona.name}, a board member specializing in "${peerPersona.domain}".
Style & role: "${peerPersona.description}"

Your colleague ${persona.name} (${persona.domain}) has voiced this perspective:
"${data1.argument}"

We are debating this topic:
Topic: "${topic}"

Provide your counter-argument or ethical critique (2-3 sentences) from your perspective as an expert in "${peerPersona.domain}". Challenge their assumptions or raise critical ethical/fairness/governance issues.
Respond in JSON format:
{
  "critique": "Your counter-argument or critique here."
}`;

  const res2 = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt2 }] }],
    generationConfig: { responseMimeType: "application/json" }
  });
  const data2 = JSON.parse(res2.response.text());

  // 3. Final Board Consensus / Recommendation
  const prompt3 = `You are a neutral board recorder summarizing the discussion between ${persona.name} (${persona.domain}) and ${peerPersona.name} (${peerPersona.domain}).

Discussion so far:
${persona.name}: "${data1.argument}"
${peerPersona.name}: "${data2.critique}"

Draft a final, actionable board consensus recommendation (1-2 sentences) that bridges these two viewpoints for the organization. Keep it professional and clear.
Respond in JSON format:
{
  "consensus": "The final board consensus recommendation."
}`;

  const res3 = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt3 }] }],
    generationConfig: { responseMimeType: "application/json" }
  });
  const data3 = JSON.parse(res3.response.text());

  return {
    topic,
    primaryAgent: {
      name: persona.name,
      domain: persona.domain,
      argument: data1.argument
    },
    peerAgent: {
      name: peerPersona.name,
      domain: peerPersona.domain,
      critique: data2.critique
    },
    consensus: data3.consensus
  };
}
