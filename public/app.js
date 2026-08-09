// Override fetch to inject custom Gemini API Key header if configured
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
  const customKey = localStorage.getItem('custom_gemini_api_key');
  if (customKey && customKey.trim().length > 0 && url.toString().startsWith('/api/')) {
    options.headers = options.headers || {};
    if (options.headers instanceof Headers) {
      options.headers.set('x-gemini-key', customKey.trim());
    } else {
      options.headers['x-gemini-key'] = customKey.trim();
    }
  }
  return originalFetch(url, options);
};

window.saveCustomApiKeyOverride = function() {
  const input = document.getElementById('custom-gemini-key-input');
  if (input) {
    localStorage.setItem('custom_gemini_api_key', input.value.trim());
  }
};

// Global state
let currentAgentId = localStorage.getItem('agentId') || null;
let isRunningCycle = false;
let logPollInterval = null;
let countdownInterval = null;
let lastCycleTime = null;
let analyticsChartInstance = null;
let cachedPosts = []; // Local cache for instant search filtering
let RUN_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes by default
const agentRunIntervalSelect = document.getElementById('agent-run-interval');

// DOM Elements - Navigation & Shell
const navItems = document.querySelectorAll('.nav-item');
const panelViews = document.querySelectorAll('.panel-view');
const currentTabTitle = document.getElementById('current-tab-title');

// DOM Elements - Status & Stats
const globalStatusDot = document.getElementById('global-status-dot');
const globalStatusBadge = document.getElementById('global-status-badge');
const statusUninitialized = document.getElementById('overview-status-uninitialized');
const statusActive = document.getElementById('overview-status-active');
const initForm = document.getElementById('init-form');
const personaNameInput = document.getElementById('persona-name');
const personaDomainSelect = document.getElementById('persona-domain');
const personaDescriptionInput = document.getElementById('persona-description');

const peerPersonaNameInput = document.getElementById('peer-persona-name');
const peerPersonaDomainSelect = document.getElementById('peer-persona-domain');
const peerPersonaDescriptionInput = document.getElementById('peer-persona-description');

// Active status elements
const statusName = document.getElementById('status-name');
const statusDomain = document.getElementById('status-domain');
const statusId = document.getElementById('status-id');
const statusInitialized = document.getElementById('status-initialized');
const statusLastRun = document.getElementById('status-last-run');
const statusDescription = document.getElementById('status-description');
const statusPeerName = document.getElementById('status-peer-name');
const statusPeerDescription = document.getElementById('status-peer-description');
const statusCountdown = document.getElementById('status-countdown');

// Stats Counters & badges
const overviewStatPublished = document.getElementById('overview-stat-published');
const overviewStatRejected = document.getElementById('overview-stat-rejected');
const overviewStatRatio = document.getElementById('overview-stat-ratio');
const envGeminiStatus = document.getElementById('env-gemini-status');
const envMcpStatus = document.getElementById('env-mcp-status');

// Compatibility hooks
const statPublishedCount = document.getElementById('stat-published-count');
const statRejectedCount = document.getElementById('stat-rejected-count');

// Feed & Rejected Panels
const feedLoading = document.getElementById('feed-loading');
const feedEmpty = document.getElementById('feed-empty');
const feedList = document.getElementById('feed-list');
const feedContainer = document.getElementById('feed-container');
const feedSearch = document.getElementById('feed-search');

const btnTriggerCycle = document.getElementById('btn-trigger-cycle');
const btnTriggerText = document.getElementById('btn-trigger-text');
const cycleLoadingIcon = document.getElementById('cycle-loading-icon');
const btnReset = document.getElementById('btn-reset');
const btnRefreshFeed = document.getElementById('btn-refresh-feed');

const rejectedEmpty = document.getElementById('rejected-empty');
const rejectedList = document.getElementById('rejected-list');

// Terminal & Chat
const terminalLogBody = document.getElementById('terminal-log-body');
const toastContainer = document.getElementById('toast-container');
const chatCard = document.getElementById('chat-card');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessagesBody = document.getElementById('chat-messages-body');
const btnClearChat = document.getElementById('btn-clear-chat');

// Suggest Topic Form Elements
const suggestForm = document.getElementById('suggest-topic-form');
const suggestTitleInput = document.getElementById('suggest-title');
const suggestUrlInput = document.getElementById('suggest-url');
const btnSuggestSubmit = document.getElementById('btn-suggest-submit');

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  // Restore custom Gemini API Key override
  const savedKey = localStorage.getItem('custom_gemini_api_key');
  if (savedKey) {
    const input = document.getElementById('custom-gemini-key-input');
    if (input) input.value = savedKey;
  }

  setupNavigation();
  checkStatus();
  
  // Event Listeners
  initForm.addEventListener('submit', handleInitialize);
  suggestForm.addEventListener('submit', handleSuggestTopic);
  btnTriggerCycle.addEventListener('click', handleTriggerCycle);
  btnReset.addEventListener('click', handleReset);
  btnRefreshFeed.addEventListener('click', () => {
    checkStatus();
    showToast('Feed refreshed', 'info');
  });
  
  chatForm.addEventListener('submit', handleSendChatMessage);
  btnClearChat.addEventListener('click', handleClearChat);
  
  // Search Filtering
  feedSearch.addEventListener('input', (e) => {
    filterFeedLocally(e.target.value.trim());
  });

  // Start polling logs
  startLogPolling();
});

// Navigation controller
function setupNavigation() {
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.getAttribute('data-tab');
      
      // Update active nav state
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      // Update active view panels
      panelViews.forEach(panel => {
        if (panel.id === `panel-${tabName}`) {
          panel.classList.add('active');
        } else {
          panel.classList.remove('active');
        }
      });
      
      // Update header title
      const labels = {
        overview: 'Overview & Performance',
        setup: 'Setup Agent Persona',
        feed: 'Published Editorial Feed',
        chat: 'Conversational Playground',
        workspace: 'Autonomous Dev Sandbox',
        logs: 'Process Terminal',
        rejected: 'Decision Audit Log'
      };
      currentTabTitle.textContent = labels[tabName] || 'Dashboard';
      
      if (tabName === 'workspace') {
        fetchWorkspaceFiles();
      }

      // Resize Chart.js if switching back to overview (required since container was hidden)
      if (tabName === 'overview' && analyticsChartInstance) {
        setTimeout(() => {
          analyticsChartInstance.resize();
        }, 100);
      }
    });
  });
}

// Toast notification helper
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✔️';
  if (type === 'error') icon = '❌';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 4000);
}

// Text-to-speech audio reader
window.speakText = function(text) {
  if (!('speechSynthesis' in window)) {
    showToast('Text-to-speech is not supported in your browser', 'error');
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const enVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || 
                  voices.find(v => v.lang.startsWith('en')) || 
                  voices[0];

  if (enVoice) utterance.voice = enVoice;
  utterance.pitch = 1.0;
  utterance.rate = 1.0;

  showToast('Playing voice read-out...', 'info');
  window.speechSynthesis.speak(utterance);
};

// Check Server/Agent Status
async function checkStatus() {
  setLoadingState(true);
  try {
    const res = await fetch(`/api/agent/status`);
    if (!res.ok) throw new Error("Status check failed");
    
    const data = await res.json();
    
    // Update credentials badge status
    envGeminiStatus.textContent = data.geminiApiKeyConfigured ? 'Configured' : 'Missing';
    envGeminiStatus.className = `env-badge ${data.geminiApiKeyConfigured ? 'env-badge-success' : ''}`;
    
    if (data.initialized && data.config) {
      currentAgentId = data.config.agentId;
      localStorage.setItem('agentId', currentAgentId);
      
      // Update UI panels with active status
      statusName.textContent = data.config.persona.name;
      statusDomain.textContent = data.config.persona.domain;
      statusId.textContent = data.config.agentId;
      statusInitialized.textContent = new Date(data.config.initializedAt).toLocaleString();
      statusLastRun.textContent = data.config.lastRunTime ? new Date(data.config.lastRunTime).toLocaleString() : 'Never';
      statusDescription.textContent = data.config.persona.description || 'N/A';
      statusPeerName.textContent = data.config.peerPersona ? data.config.peerPersona.name : '-';
      statusPeerDescription.textContent = data.config.peerPersona ? data.config.peerPersona.description : '-';
      
      lastCycleTime = data.config.lastRunTime || Date.now();
      RUN_INTERVAL_MS = data.config.runIntervalMs || 15 * 60 * 1000;
      // Toggle uninitialized view states
      statusUninitialized.classList.add('hidden');
      statusActive.classList.remove('hidden');
      btnReset.classList.remove('hidden');
      
      // Update sidebar shell indicator
      globalStatusDot.className = 'pulse-indicator active';
      globalStatusBadge.className = 'badge-pill active';
      globalStatusBadge.textContent = 'Active (Autonomous)';
      
      // Start Countdown
      startCountdownTimer();
      
      // Fetch Feed and Rejected audit logs
      await fetchFeedAndRejected();
    } else {
      localStorage.removeItem('agentId');
      currentAgentId = null;
      lastCycleTime = null;
      stopCountdownTimer();
      
      statusUninitialized.classList.remove('hidden');
      statusActive.classList.add('hidden');
      btnReset.classList.add('hidden');
      
      globalStatusDot.className = 'pulse-indicator';
      globalStatusBadge.className = 'badge-pill';
      globalStatusBadge.textContent = 'Not Initialized';

      showEmptyFeed();
      updateAnalyticsChart(0, 0);
    }
  } catch (error) {
    console.error("Error checking status:", error);
    globalStatusBadge.textContent = 'Offline';
    showToast('Failed to connect to backend server', 'error');
    showEmptyFeed();
  } finally {
    setLoadingState(false);
  }
}

// Start log poller
function startLogPolling() {
  if (logPollInterval) clearInterval(logPollInterval);
  fetchLogs();
  logPollInterval = setInterval(fetchLogs, 2500);
}

// Fetch logs from server
async function fetchLogs() {
  try {
    const res = await fetch('/api/agent/logs');
    if (!res.ok) return;
    
    const data = await res.json();
    const logs = data.logs || [];
    
    if (logs.length === 0) {
      terminalLogBody.innerHTML = '<div class="log-line text-muted">[System] Ready to start.</div>';
      return;
    }
    
    const isAtBottom = terminalLogBody.scrollHeight - terminalLogBody.clientHeight <= terminalLogBody.scrollTop + 20;
    
    terminalLogBody.innerHTML = logs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      let colorClass = 'text-muted';
      if (log.type === 'error') colorClass = 'error';
      if (log.type === 'info') {
        if (log.message.includes('ACCEPTED') || log.message.includes('Successfully') || log.message.includes('Refined')) {
          colorClass = 'info';
        } else if (log.message.includes('REJECTED') || log.message.includes('Duplicate')) {
          colorClass = 'text-muted';
        } else {
          colorClass = 'info';
        }
      }
      return `<div class="log-line ${colorClass}">[${time}] ${log.message}</div>`;
    }).join('');
    
    if (isAtBottom) {
      terminalLogBody.scrollTop = terminalLogBody.scrollHeight;
    }
  } catch (error) {
    // Fail silently
  }
}

// Countdown timer loop
function startCountdownTimer() {
  if (countdownInterval) clearInterval(countdownInterval);
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

function stopCountdownTimer() {
  if (countdownInterval) clearInterval(countdownInterval);
  statusCountdown.textContent = 'Agent Off';
}

function updateCountdown() {
  if (!lastCycleTime) {
    statusCountdown.textContent = 'N/A';
    return;
  }
  
  const now = Date.now();
  const nextRun = lastCycleTime + RUN_INTERVAL_MS;
  const diff = nextRun - now;
  
  if (diff <= 0) {
    statusCountdown.textContent = 'Running soon...';
    if (!isRunningCycle && currentAgentId && (now - lastCycleTime > 30000)) {
      handleTriggerCycle();
    }
    return;
  }
  
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  
  statusCountdown.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Fetch Feed and Rejected items
async function fetchFeedAndRejected() {
  if (!currentAgentId) return;
  
  try {
    // 1. Fetch published feed
    const feedRes = await fetch(`/api/agent/feed?agentId=${currentAgentId}`);
    if (!feedRes.ok) throw new Error("Failed to fetch feed");
    const feedData = await feedRes.json();
    cachedPosts = feedData.posts || [];
    
    overviewStatPublished.textContent = cachedPosts.length;
    statPublishedCount.textContent = cachedPosts.length; // compatible hook
    
    // Apply local search filtering to display
    filterFeedLocally(feedSearch.value.trim());

    // 2. Fetch rejected topics
    const rejectedRes = await fetch(`/api/agent/rejected?agentId=${currentAgentId}`);
    if (!rejectedRes.ok) throw new Error("Failed to fetch rejected");
    const rejectedData = await rejectedRes.json();
    const rejected = rejectedData.rejected || [];
    
    overviewStatRejected.textContent = rejected.length;
    statRejectedCount.textContent = rejected.length; // compatible hook
    renderRejected(rejected);

    // 3. Update ratios & Chart.js
    const total = cachedPosts.length + rejected.length;
    const ratio = total > 0 ? ((cachedPosts.length / total) * 100).toFixed(0) : 0;
    overviewStatRatio.textContent = `${ratio}%`;

    updateAnalyticsChart(cachedPosts.length, rejected.length);
    
  } catch (error) {
    console.error("Error fetching feed/rejected:", error);
  }
}

// Filter feed locally using the search query
function filterFeedLocally(query) {
  if (!query) {
    renderFeed(cachedPosts);
    return;
  }
  
  const lowerQuery = query.toLowerCase();
  const filtered = cachedPosts.filter(post => 
    post.text.toLowerCase().includes(lowerQuery) || 
    (post.rationale && post.rationale.toLowerCase().includes(lowerQuery))
  );
  
  renderFeed(filtered);
}

// Render Feed Posts
function renderFeed(posts) {
  feedLoading.classList.add('hidden');
  
  if (posts.length === 0) {
    feedEmpty.classList.remove('hidden');
    feedList.classList.add('hidden');
    return;
  }
  
  feedEmpty.classList.add('hidden');
  feedList.classList.remove('hidden');
  
  feedList.innerHTML = posts.map(post => {
    const formattedDate = new Date(post.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const escapedText = post.text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    
    // Dynamic avatar color based on name length/content
    const colors = ['#00f5d4', '#7000ff', '#ff007f', '#3a86f7', '#ffbe0b', '#8338ec'];
    const charCode = (post.text || '').charCodeAt(0) || 0;
    const avatarColor = colors[charCode % colors.length];

    // Comments HTML
    const commentsListHtml = (post.comments || []).map(comment => `
      <div class="x-comment-item">
        <div class="x-comment-avatar" style="background: rgba(255,255,255,0.08); color: var(--accent-light); font-size: 10px;">
          ${comment.username.substring(1, 3).toUpperCase()}
        </div>
        <div class="x-comment-body">
          <div class="x-comment-user-info">
            <span class="x-comment-user-name">${comment.username}</span>
            <span class="x-comment-user-handle">${comment.username.toLowerCase()}</span>
          </div>
          <p class="x-comment-text">${comment.text}</p>
        </div>
      </div>
    `).join('');

    return `
      <div class="x-post-card glass-panel" id="post-${post.id}">
        <!-- Post Header -->
        <div class="x-post-header">
          <div class="x-avatar" style="background: ${avatarColor};">
            ${statusName.textContent ? statusName.textContent[0].toUpperCase() : 'A'}
          </div>
          <div class="x-user-info">
            <div class="x-user-row">
              <span class="x-name">${statusName.textContent || 'Agent'}</span>
              <span class="x-badge">
                <svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;color:#1d9bf0;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              </span>
              <span class="x-handle">@${(statusName.textContent || 'Agent').replace(/\s+/g, '')}</span>
              <span class="x-dot">·</span>
              <span class="x-date">${formattedDate}</span>
            </div>
            <span class="x-domain-tag badge-domain">${statusDomain.textContent || 'AI'}</span>
          </div>
        </div>

        <!-- Post Content -->
        <div class="x-post-body">
          <p class="x-text">${post.text}</p>
          
          <!-- Sources if present -->
          ${(post.sources || []).map(src => `
            <a href="${src}" target="_blank" class="x-source-preview">
              <div class="x-source-icon">🔗</div>
              <div class="x-source-text">${src.replace('https://', '').substring(0, 45)}...</div>
            </a>
          `).join('')}

          <!-- Peer Debate Box (Collapsible) -->
          ${post.critique ? `
            <div class="x-debate-box">
              <div class="x-debate-header" onclick="toggleDebateBox('${post.id}')">
                <span class="x-debate-title">🛡️ Peer Review Debate & Self-Critique</span>
                <span class="x-debate-toggle-icon" id="debate-toggle-${post.id}">▼</span>
              </div>
              <div class="x-debate-content hidden" id="debate-content-${post.id}">
                <div class="x-debate-step">
                  <span class="lbl-step">Stage 1: Original Draft (${statusName.textContent})</span>
                  <p class="val-step">${post.draft || 'N/A'}</p>
                </div>
                <div class="x-debate-step review-step">
                  <span class="lbl-step">Stage 2: Peer Critique (${statusPeerName.textContent})</span>
                  <p class="val-step">${post.critique}</p>
                </div>
                <div class="x-debate-step final-step">
                  <span class="lbl-step">Stage 3: Polished Publication</span>
                  <p class="val-step">${post.text}</p>
                </div>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Post Action Bar -->
        <div class="x-action-bar">
          <!-- Comments Toggle -->
          <button class="x-action-btn btn-comments" onclick="toggleComments('${post.id}')" title="Show Discussion">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.92 1.78c-.082.095-.054.233.054.285a10.094 10.094 0 0 0 3.82.724c.216 0 .43-.01.64-.03a1.137 1.137 0 0 0 .58-.223Z"/></svg>
            <span class="count">${(post.comments || []).length}</span>
          </button>

          <!-- Likes -->
          <button class="x-action-btn btn-likes" onclick="incrementLikes('${post.id}')" title="Like">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"/></svg>
            <span class="count" id="likes-count-${post.id}">${post.likes || 0}</span>
          </button>

          <!-- Retweets -->
          <button class="x-action-btn btn-retweets" onclick="incrementRetweets('${post.id}')" title="Retweet">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
            <span class="count" id="retweets-count-${post.id}">${post.retweets || 0}</span>
          </button>

          <!-- Listen (Audio) -->
          <button class="x-action-btn btn-listen" onclick="speakText('${escapedText}')" title="Listen to post">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>
          </button>
        </div>

        <!-- Comments Container (Hidden by default) -->
        <div class="x-comments-section hidden" id="comments-section-${post.id}">
          <h4 class="x-comments-title">Discussion Thread</h4>
          <div class="x-comments-list">
            ${commentsListHtml || '<p class="text-muted" style="font-size: 12px; padding-left: 12px;">No comments yet.</p>'}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.toggleDebateBox = function(id) {
  const content = document.getElementById(`debate-content-${id}`);
  const icon = document.getElementById(`debate-toggle-${id}`);
  if (content.classList.contains('hidden')) {
    content.classList.remove('hidden');
    icon.textContent = '▲';
  } else {
    content.classList.add('hidden');
    icon.textContent = '▼';
  }
};

window.toggleComments = function(id) {
  const sect = document.getElementById(`comments-section-${id}`);
  if (sect.classList.contains('hidden')) {
    sect.classList.remove('hidden');
  } else {
    sect.classList.add('hidden');
  }
};

window.incrementLikes = function(id) {
  const elem = document.getElementById(`likes-count-${id}`);
  let count = parseInt(elem.textContent);
  elem.textContent = count + 1;
};

window.incrementRetweets = function(id) {
  const elem = document.getElementById(`retweets-count-${id}`);
  let count = parseInt(elem.textContent);
  elem.textContent = count + 1;
};

// Render Rejected Log
function renderRejected(rejected) {
  if (rejected.length === 0) {
    rejectedEmpty.classList.remove('hidden');
    rejectedList.classList.add('hidden');
    return;
  }
  
  rejectedEmpty.classList.add('hidden');
  rejectedList.classList.remove('hidden');
  
  rejectedList.innerHTML = rejected.map(item => `
    <div class="rejected-item">
      <div class="rejected-item-title">
        <span>${item.title}</span>
        <a href="${item.url}" target="_blank" class="source-link" style="font-size: 11px">Link</a>
      </div>
      <p class="rejected-item-reason"><strong>Audit Rationale:</strong> ${item.reason}</p>
    </div>
  `).join('');
}

// Handle Form Initialize
async function handleInitialize(e) {
  e.preventDefault();
  
  const name = personaNameInput.value.trim();
  const domain = personaDomainSelect.value;
  const description = personaDescriptionInput.value.trim();

  const peerName = peerPersonaNameInput.value.trim();
  const peerDomain = peerPersonaDomainSelect.value;
  const peerDescription = peerPersonaDescriptionInput.value.trim();
  
  if (!name || !domain || !description || !peerName || !peerDomain || !peerDescription) {
    showToast('Please fill out all fields for both personas', 'error');
    return;
  }
  
  setInitializingState(true);
  showToast('Initializing Editorial Board (running first debate cycle)...', 'info');
  try {
    const res = await fetch('/api/agent/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona: { name, domain, description },
        peerPersona: { name: peerName, domain: peerDomain, description: peerDescription },
        runIntervalMs: parseInt(agentRunIntervalSelect.value, 10) || 15 * 60 * 1000
      })
    });
    
    if (!res.ok) throw new Error("Failed to initialize agent");
    
    const data = await res.json();
    currentAgentId = data.agentId;
    localStorage.setItem('agentId', currentAgentId);
    
    personaNameInput.value = '';
    personaDomainSelect.value = '';
    personaDescriptionInput.value = '';

    peerPersonaNameInput.value = '';
    peerPersonaDomainSelect.value = '';
    peerPersonaDescriptionInput.value = '';
    
    showToast('Editorial Board launched!', 'success');
    
    // Clear chat logs
    chatMessagesBody.innerHTML = `
      <div class="chat-bubble agent-bubble">
        Hello! We are initialized and ready to discuss tech trends and insights. Ask us anything!
      </div>
    `;
    
    await checkStatus();
    
    // Switch to Overview tab
    document.querySelector('.nav-item[data-tab="overview"]').click();
    
  } catch (error) {
    console.error("Initialization error:", error);
    showToast('Failed to initialize agent', 'error');
  } finally {
    setInitializingState(false);
  }
}

// Handle Manual Cycle Trigger
async function handleTriggerCycle() {
  if (!currentAgentId || isRunningCycle) return;
  
  setRunningCycleState(true);
  showToast('Starting autonomous cycle: crawling news...', 'info');
  try {
    const res = await fetch(`/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: currentAgentId })
    });
    
    if (!res.ok) throw new Error("Failed to trigger cycle");
    
    showToast('Autonomous cycle completed!', 'success');
    await checkStatus();
  } catch (error) {
    console.error("Trigger cycle error:", error);
    showToast('Cycle completed (no new updates or server error)', 'info');
    await checkStatus();
  } finally {
    setRunningCycleState(false);
  }
}

// Handle Send Chat Message to Persona
async function handleSendChatMessage(e) {
  e.preventDefault();
  
  if (!currentAgentId) return;
  
  const message = chatInput.value.trim();
  if (!message) return;
  
  appendChatBubble(message, 'user');
  chatInput.value = '';
  
  const typingId = appendChatBubble('typing...', 'agent');
  
  try {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: currentAgentId,
        message
      })
    });
    
    if (!res.ok) throw new Error("Chat call failed");
    
    const data = await res.json();
    
    const typingBubble = document.getElementById(typingId);
    if (typingBubble) {
      typingBubble.textContent = data.reply;
      typingBubble.id = '';
    } else {
      appendChatBubble(data.reply, 'agent');
    }
  } catch (error) {
    console.error("Chat error:", error);
    const typingBubble = document.getElementById(typingId);
    if (typingBubble) {
      typingBubble.textContent = "[Error] Failed to get response from agent.";
      typingBubble.style.color = "var(--color-danger)";
    }
    showToast('Failed to chat with agent', 'error');
  }
}

// Append bubble helper
function appendChatBubble(text, sender) {
  const bubble = document.createElement('div');
  const tempId = `bubble-${Date.now()}`;
  bubble.className = `chat-bubble ${sender}-bubble`;
  bubble.textContent = text;
  if (text === 'typing...') {
    bubble.id = tempId;
  }
  
  chatMessagesBody.appendChild(bubble);
  chatMessagesBody.scrollTop = chatMessagesBody.scrollHeight;
  return tempId;
}

// Handle Clear Chat
function handleClearChat() {
  chatMessagesBody.innerHTML = `
    <div class="chat-bubble agent-bubble">
      History cleared. Let's restart our conversation! Ask me anything about my domain.
    </div>
  `;
  showToast('Chat history cleared', 'info');
}

// Handle Reset Session
function handleReset() {
  if (confirm("Reset current autonomous agent session? This will clear logs and configurations.")) {
    localStorage.removeItem('agentId');
    currentAgentId = null;
    lastCycleTime = null;
    stopCountdownTimer();
    
    statusUninitialized.classList.remove('hidden');
    statusActive.classList.add('hidden');
    btnReset.classList.add('hidden');
    
    globalStatusDot.className = 'pulse-indicator';
    globalStatusBadge.className = 'badge-pill';
    globalStatusBadge.textContent = 'Not Initialized';
    
    showEmptyFeed();
    overviewStatPublished.textContent = '0';
    overviewStatRejected.textContent = '0';
    overviewStatRatio.textContent = '0%';
    
    updateAnalyticsChart(0, 0);
    showToast('Agent session reset successfully.', 'success');
  }
}

// Render Doughnut Chart using Chart.js
function updateAnalyticsChart(published, rejected) {
  const ctx = document.getElementById('analyticsChart');
  if (!ctx) return;
  
  const total = published + rejected;
  
  if (analyticsChartInstance) {
    analyticsChartInstance.data.datasets[0].data = [published, rejected];
    analyticsChartInstance.options.plugins.title.text = `Total Evaluated: ${total}`;
    analyticsChartInstance.update();
    return;
  }
  
  analyticsChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Published', 'Rejected'],
      datasets: [{
        data: [published, rejected],
        backgroundColor: [
          'rgba(0, 245, 212, 0.75)',  // Cyan/success
          'rgba(255, 71, 126, 0.75)'   // Crimson/rejected
        ],
        borderColor: [
          'rgba(0, 245, 212, 0.95)',
          'rgba(255, 71, 126, 0.95)'
        ],
        borderWidth: 1,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: '#8a99ad',
            font: {
              family: 'Plus Jakarta Sans',
              size: 11
            },
            boxWidth: 8
          }
        },
        title: {
          display: true,
          text: `Total Evaluated: ${total}`,
          color: '#e2e8f0',
          font: {
            family: 'Outfit',
            size: 12,
            weight: 'bold'
          },
          padding: {
            bottom: 5
          }
        }
      }
    }
  });
}

// State display helpers
function setLoadingState(loading) {
  if (loading) {
    feedLoading.classList.remove('hidden');
    feedEmpty.classList.add('hidden');
    feedList.classList.add('hidden');
  }
}

function showEmptyFeed() {
  feedLoading.classList.add('hidden');
  feedEmpty.classList.remove('hidden');
  feedList.classList.add('hidden');
  rejectedEmpty.classList.remove('hidden');
  rejectedList.classList.add('hidden');
}

function setInitializingState(initializing) {
  const btn = document.getElementById('btn-initialize');
  if (initializing) {
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Launching Persona...';
  } else {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Initialize & Launch Agent';
  }
}

function setRunningCycleState(running) {
  isRunningCycle = running;
  if (running) {
    btnTriggerCycle.disabled = true;
    btnTriggerText.textContent = 'Running Evaluation...';
    cycleLoadingIcon.classList.remove('hidden');
    globalStatusDot.className = 'pulse-indicator running';
  } else {
    btnTriggerCycle.disabled = false;
    btnTriggerText.textContent = 'Run Cycle Now';
    cycleLoadingIcon.classList.add('hidden');
    globalStatusDot.className = 'pulse-indicator active';
  }
}

// Handle Suggest Custom Topic
async function handleSuggestTopic(e) {
  e.preventDefault();
  
  if (!currentAgentId) {
    showToast('Please initialize a persona before suggesting topics', 'error');
    return;
  }
  
  const title = suggestTitleInput.value.trim();
  const url = suggestUrlInput.value.trim();
  
  if (!title || !url) return;
  
  setSuggestingState(true);
  showToast('Injecting custom topic into agent pipeline...', 'info');
  
  try {
    const res = await fetch('/api/agent/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: currentAgentId, title, url })
    });
    
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to evaluate custom topic');
    }
    
    const data = await res.json();
    
    if (data.isWorthPublishing) {
      showToast('Topic ACCEPTED and published to feed!', 'success');
    } else {
      showToast(`Topic REJECTED: ${data.rationale}`, 'info');
    }
    
    // Reset form inputs
    suggestTitleInput.value = '';
    suggestUrlInput.value = '';
    
    // Refresh status and feed items
    await checkStatus();
  } catch (error) {
    console.error("Suggest topic error:", error);
    showToast(error.message || 'Failed to submit topic', 'error');
  } finally {
    setSuggestingState(false);
  }
}

function setSuggestingState(suggesting) {
  if (suggesting) {
    btnSuggestSubmit.disabled = true;
    btnSuggestSubmit.querySelector('span').textContent = 'Evaluating...';
  } else {
    btnSuggestSubmit.disabled = false;
    btnSuggestSubmit.querySelector('span').textContent = 'Submit to Agent';
  }
}

window.loadPreset = function(pName, pDomain, pDesc, rName, rDomain, rDesc) {
  // Pre-fill primary agent
  personaNameInput.value = pName;
  personaDomainSelect.value = pDomain;
  personaDescriptionInput.value = pDesc;

  // Pre-fill reviewer
  peerPersonaNameInput.value = rName;
  peerPersonaDomainSelect.value = rDomain;
  peerPersonaDescriptionInput.value = rDesc;

  // Set interval to 1 minute for interactive hackathon preset testing
  agentRunIntervalSelect.value = "60000";

  // Navigate to setup panel tab
  document.querySelector('.nav-item[data-tab="setup"]').click();

  // Scroll to setup configurator card
  document.getElementById('init-form').scrollIntoView({ behavior: 'smooth' });
  showToast(`Loaded ${pName} & ${rName} preset! Press "Initialize" to boot the Editorial Board.`, 'success');
};

window.switchScoutTab = function(tabId) {
  // Toggle contents
  document.getElementById('scout-agent-tab').classList.add('hidden');
  document.getElementById('scout-manual-tab').classList.add('hidden');
  document.getElementById(tabId).classList.remove('hidden');

  // Toggle active button style
  document.getElementById('scout-agent-btn').classList.remove('active');
  document.getElementById('scout-manual-btn').classList.remove('active');
  
  if (tabId === 'scout-agent-tab') {
    document.getElementById('scout-agent-btn').classList.add('active');
    document.getElementById('scout-agent-btn').style.background = 'var(--bg-hover)';
    document.getElementById('scout-agent-btn').style.color = '#fff';
    document.getElementById('scout-manual-btn').style.background = 'transparent';
    document.getElementById('scout-manual-btn').style.color = 'var(--color-text-muted)';
  } else {
    document.getElementById('scout-manual-btn').classList.add('active');
    document.getElementById('scout-manual-btn').style.background = 'var(--bg-hover)';
    document.getElementById('scout-manual-btn').style.color = '#fff';
    document.getElementById('scout-agent-btn').style.background = 'transparent';
    document.getElementById('scout-agent-btn').style.color = 'var(--color-text-muted)';
  }
};

window.runScoutQuery = async function() {
  const queryInput = document.getElementById('scout-query');
  const resultsContainer = document.getElementById('scout-results');
  const btn = document.getElementById('btn-scout-submit');
  
  const query = queryInput.value.trim();
  if (!query) {
    showToast('Please enter a topic search query', 'warning');
    return;
  }

  // Set loading state
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Scouting...';
  resultsContainer.innerHTML = `
    <div style="text-align: center; padding: 16px; color: var(--color-text-muted);">
      <div class="spinner" style="margin: 0 auto 8px auto;"></div>
      <p style="font-size: 12px; margin: 0;">AI Agent scouting HackerNews & GitHub for fresh trends...</p>
    </div>
  `;

  try {
    const res = await fetch(`/api/agent/scout?query=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Search request failed');
    const data = await res.json();
    
    resultsContainer.innerHTML = '';
    
    if (!data.results || data.results.length === 0) {
      resultsContainer.innerHTML = `<div style="text-align: center; padding: 12px; color: var(--color-text-muted); font-size: 12px;">No matching recent topics found. Try another term.</div>`;
      return;
    }

    data.results.forEach((item, index) => {
      const itemEl = document.createElement('div');
      itemEl.style.display = 'flex';
      itemEl.style.justifyContent = 'space-between';
      itemEl.style.alignItems = 'center';
      itemEl.style.padding = '10px 14px';
      itemEl.style.background = 'rgba(255, 255, 255, 0.03)';
      itemEl.style.border = '1px solid rgba(255, 255, 255, 0.05)';
      itemEl.style.borderRadius = '8px';
      itemEl.style.gap = '12px';
      
      itemEl.innerHTML = `
        <div style="flex: 1; min-width: 0; text-align: left;">
          <div style="font-size: 12px; font-weight: 600; color: #fff; margin-bottom: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
            ${item.title}
          </div>
          <div style="font-size: 10px; color: var(--color-text-muted); display: flex; gap: 8px;">
            <span style="color: var(--accent-light); font-weight: 600;">${item.source}</span>
            <span>👤 ${item.author}</span>
            <span>⭐ ${item.score}</span>
          </div>
        </div>
        <button onclick="ingestScoutedTopic('${encodeURIComponent(item.title)}', '${encodeURIComponent(item.url)}', this)" style="background: rgba(0, 245, 212, 0.15); color: var(--accent-light); border: 1px solid rgba(0, 245, 212, 0.3); padding: 5px 10px; border-radius: 6px; font-size: 11px; cursor: pointer; font-weight: 600; white-space: nowrap; transition: all 0.2s;">
          Feed Board
        </button>
      `;
      resultsContainer.appendChild(itemEl);
    });
  } catch (err) {
    console.error(err);
    resultsContainer.innerHTML = `<div style="text-align: center; padding: 12px; color: var(--color-danger); font-size: 12px;">Failed to fetch trends. Please check network.</div>`;
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Scout Web Trends';
  }
};

window.ingestScoutedTopic = async function(titleEscaped, urlEscaped, btnElement) {
  const title = decodeURIComponent(titleEscaped);
  const url = decodeURIComponent(urlEscaped);

  if (!currentAgentId) {
    showToast('Initialize an Agent Editorial Board first!', 'warning');
    return;
  }

  // Set loading on target row button
  const originalText = btnElement.textContent;
  btnElement.disabled = true;
  btnElement.textContent = 'Critiquing...';
  btnElement.style.background = 'rgba(255, 255, 255, 0.1)';
  btnElement.style.color = '#fff';

  showToast(`Agent reviewing "${title}"...`, 'info');

  try {
    const res = await fetch('/api/agent/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: currentAgentId, title, url })
    });
    
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to evaluate topic');
    }
    
    const data = await res.json();
    
    if (data.isWorthPublishing) {
      showToast('Topic ACCEPTED and published to feed!', 'success');
      btnElement.textContent = 'Published';
      btnElement.style.background = 'rgba(0, 245, 212, 0.2)';
      btnElement.style.borderColor = 'var(--accent-light)';
      btnElement.style.color = 'var(--accent-light)';
    } else {
      showToast(`Topic REJECTED: ${data.rationale}`, 'info');
      btnElement.textContent = 'Rejected';
      btnElement.style.background = 'rgba(255, 71, 126, 0.2)';
      btnElement.style.borderColor = 'var(--color-danger)';
      btnElement.style.color = 'var(--color-danger)';
    }
    
    // Refresh status and feed items
    await checkStatus();
  } catch (error) {
    console.error("Ingest scouted topic error:", error);
    showToast(error.message || 'Failed to submit topic', 'error');
    btnElement.disabled = false;
    btnElement.textContent = originalText;
  }
};

window.runBoardDebateSim = async function() {
  const input = document.getElementById('debate-topic-input');
  const btn = document.getElementById('btn-convene-debate');
  const statusBadge = document.getElementById('board-meeting-status');
  const body = document.getElementById('debate-dialogue-body');

  const topic = input.value.trim();
  if (!topic) {
    showToast('Please enter a topic to debate!', 'warning');
    return;
  }

  // Set loading state
  btn.disabled = true;
  btn.textContent = 'Debating...';
  statusBadge.textContent = 'Debating...';
  statusBadge.style.background = 'rgba(0, 255, 136, 0.15)';
  statusBadge.style.color = '#00ff88';

  body.innerHTML = `
    <div style="text-align: center; color: var(--color-text-muted); font-size: 13.5px; padding-top: 40px;">
      <svg class="icon-spin" viewBox="0 0 24 24" style="width:24px;height:24px;margin-bottom:8px;display:inline-block;color:#00ff88;">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" stroke-dasharray="32" stroke-linecap="round"></circle>
      </svg>
      <br>Convening agent board members for debate session...
    </div>
  `;

  try {
    const res = await fetch('/api/agent/board-meeting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic })
    });

    if (!res.ok) throw new Error("Debate request failed");
    const data = await res.json();

    body.innerHTML = '';

    // Append Turn 1: Primary Agent
    const bubble1 = document.createElement('div');
    bubble1.className = 'chat-bubble agent-bubble';
    bubble1.style.marginBottom = '16px';
    bubble1.innerHTML = `
      <div style="font-weight: 700; color: var(--accent-light); font-size: 12px; margin-bottom: 4px; text-transform: uppercase;">
        🎙️ ${data.primaryAgent.name} (${data.primaryAgent.domain})
      </div>
      <p style="margin: 0; line-height: 1.5;">${data.primaryAgent.argument}</p>
    `;
    body.appendChild(bubble1);
    body.scrollTop = body.scrollHeight;

    // Simulate slight delay for Turn 2
    await new Promise(r => setTimeout(r, 1500));

    // Append Turn 2: Peer Agent
    const bubble2 = document.createElement('div');
    bubble2.className = 'chat-bubble peer-bubble';
    bubble2.style.background = 'rgba(255, 255, 255, 0.04)';
    bubble2.style.border = '1px solid rgba(255, 255, 255, 0.08)';
    bubble2.style.color = '#fff';
    bubble2.style.borderRadius = '12px';
    bubble2.style.padding = '12px 16px';
    bubble2.style.alignSelf = 'flex-start';
    bubble2.style.maxWidth = '85%';
    bubble2.style.marginBottom = '16px';
    bubble2.innerHTML = `
      <div style="font-weight: 700; color: #ffbe0b; font-size: 12px; margin-bottom: 4px; text-transform: uppercase;">
        🎙️ ${data.peerAgent.name} (${data.peerAgent.domain})
      </div>
      <p style="margin: 0; line-height: 1.5;">${data.peerAgent.critique}</p>
    `;
    body.appendChild(bubble2);
    body.scrollTop = body.scrollHeight;

    // Simulate slight delay for Turn 3
    await new Promise(r => setTimeout(r, 1500));

    // Append Turn 3: Consensus
    const bubble3 = document.createElement('div');
    bubble3.className = 'chat-bubble consensus-bubble';
    bubble3.style.background = 'rgba(0, 255, 136, 0.05)';
    bubble3.style.border = '1px solid rgba(0, 255, 136, 0.2)';
    bubble3.style.color = '#fff';
    bubble3.style.borderRadius = '12px';
    bubble3.style.padding = '12px 16px';
    bubble3.style.alignSelf = 'center';
    bubble3.style.width = '100%';
    bubble3.style.maxWidth = '90%';
    bubble3.style.textAlign = 'center';
    bubble3.style.marginBottom = '8px';
    bubble3.innerHTML = `
      <div style="font-weight: 700; color: #00ff88; font-size: 12px; margin-bottom: 4px; text-transform: uppercase;">
        ⚖️ Board Consensus Recommendation
      </div>
      <p style="margin: 0; line-height: 1.5; font-style: italic;">"${data.consensus}"</p>
    `;
    body.appendChild(bubble3);
    body.scrollTop = body.scrollHeight;

    showToast('Board debate concluded successfully!', 'success');
  } catch (err) {
    console.error(err);
    body.innerHTML = `
      <div style="text-align: center; color: var(--color-danger); font-size: 13px; padding-top: 40px;">
        Failed to convene board meeting. Verify your Gemini API key and connection.
      </div>
    `;
    showToast('Failed to run board debate simulation', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Convene Board';
    statusBadge.textContent = 'Board Idle';
    statusBadge.style.background = 'rgba(255, 255, 255, 0.05)';
    statusBadge.style.color = 'var(--color-text-muted)';
  }
};
