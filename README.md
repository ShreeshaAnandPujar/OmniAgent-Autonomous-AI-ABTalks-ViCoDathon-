# OmniAgent: Autonomous Tech Persona Agent 🤖✨

OmniAgent is an autonomous AI agent designed and developed for the **abtalks vicodathon** hackathon. 

It functions as a domain-expert technology persona that operates completely independently: discovering news, making editorial decisions on what is worth sharing, refining posts through self-reflection critique, and logging its long-term episodic memory to a remote context graph.

The project features a state-of-the-art **glassmorphic desktop-grade control center** with sidebar navigation, active statistics analytics, live log streams, text-to-speech audio readers, and direct persona conversation chats.

---

## 🚀 Key Features & Capabilities

- **abtalks vicodathon Special Edition:** Built from the ground up for high-fidelity agentic autonomy, micro-interactions, and visual elegance.
- **Multi-Source Discovery:** Background workers continuously crawl:
  - **Hacker News:** Front-page stories and threads.
  - **TechCrunch:** Top tech news RSS feed.
  - **GitHub Trending:** Top trending repositories created in the last 7 days.
- **AI Self-Reflection & Critique Loop:** Powered by **Gemini-2.5-Flash** (with fallback to 2.0-Flash / 1.5-Flash). When a topic is evaluated:
  1. *Drafts* an initial commentary matching its character description.
  2. *Critiques* the draft against style guidelines (no hashtags, no emojis, professional voice).
  3. *Refines* and writes the polished final post.
- **Episodic Memory Graph (Breeth MCP):** Connects to the **Breeth Model Context Protocol server** over SSE to record published posts and perform memory checks to avoid duplicating articles.
- **Interactive Control Center Dashboard:**
  - **Overview panel:** Displays active domain, initialized logs, and a dynamic **Chart.js Doughnut chart** showing the ratio of Published vs. Rejected topics.
  - **Custom Topic Suggestion:** Directly inject custom news items/URLs into the agent's editorial pipeline to force immediate evaluation.
  - **Persona Chat Playground:** Hold a real-time conversation directly with the active persona, powered by Gemini. Features a graceful offline fallback if API quotas are exhausted.
  - **Process Terminal:** View live console logs stream from the server showing crawls, memory hits, and critique steps.
  - **Speech Audio Playback:** Click "Listen" on any card to hear the agent read its post aloud using the browser's speech synthesis engine.

---

## 🛠️ Technology Stack

- **Backend:** Node.js, Express (with stdout log interceptors)
- **Frontend:** Vanilla HTML5, CSS3 Grid/Flex, Javascript
- **Data Analytics:** Chart.js (CDN-delivered, responsive resize-optimized)
- **Database:** Local JSON-based persistent storage (`db.json`)
- **APIs & MCP:** Google `@google/generative-ai` SDK, `@modelcontextprotocol/sdk` client

---

## 💻 Local Setup & Installation

1. **Clone & Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Start the Control Center:**
   ```bash
   npm start
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser to access the control panel.

---

## ☁️ Deployment Instructions

### Render (Full Autonomous Server)
Render is recommended as it supports background cron processes natively:

1. Push this codebase to a public GitHub repository.
2. Log in to [Render](https://render.com/) and create a new **Web Service**.
3. Link your GitHub repository.
4. Configure these fields:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Go to the **Environment** tab and add your key:
   - Key: `GEMINI_API_KEY` | Value: `your-actual-api-key`
6. Click **Deploy**. Render will host the service and provide a live URL.

*Note: Render free tier instances sleep after 15 minutes of inactivity. When a user visits the dashboard, the server automatically wakes up, and a passive cron trigger checks the time delta since the last run. If >= 15 minutes, it launches a background worker cycle immediately, keeping the feed fully fresh without missing a beat.*
