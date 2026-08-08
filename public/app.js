// Global state
let currentAgentId = localStorage.getItem('agentId') || null;
let isRunningCycle = false;
let logPollInterval = null;
let countdownInterval = null;
let lastCycleTime = null;
let analyticsChartInstance = null;
let cachedPosts = []; // Local cache for instant search filtering
const RUN_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

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

// Active status elements
const statusName = document.getElementById('status-name');
const statusDomain = document.getElementById('status-domain');
const statusId = document.getElementById('status-id');
const statusInitialized = document.getElementById('status-initialized');
const statusLastRun = document.getElementById('status-last-run');
const statusDescription = document.getElementById('status-description');
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
        logs: 'Process Terminal',
        rejected: 'Decision Audit Log'
      };
      currentTabTitle.textContent = labels[tabName] || 'Dashboard';
      
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
      
      lastCycleTime = data.config.lastRunTime || Date.now();
      
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
    const formattedDate = new Date(post.createdAt).toLocaleString();
    const sourcesHtml = (post.sources || []).map(src => `
      <a href="${src}" target="_blank" class="source-link">
        Source Link
        <svg style="width:12px;height:12px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
      </a>
    `).join(' ');

    const escapedText = post.text.replace(/'/g, "\\'").replace(/"/g, '&quot;');

    return `
      <div class="feed-item">
        <div class="feed-item-header">
          <span class="feed-item-time">
            ${formattedDate}
            <button class="btn-audio" onclick="speakText('${escapedText}')" title="Listen to post">
              <svg style="width:13px;height:13px;vertical-align:middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
              </svg>
            </button>
          </span>
        </div>
        <p class="feed-item-content">${post.text}</p>
        <div class="feed-item-meta">
          <span class="meta-label">Rationale:</span>
          <span class="meta-text">${post.rationale || 'N/A'}</span>
        </div>
        <div class="feed-item-sources">
          ${sourcesHtml}
        </div>
      </div>
    `;
  }).join('');
}

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
  
  if (!name || !domain || !description) {
    showToast('Please fill out all fields', 'error');
    return;
  }
  
  setInitializingState(true);
  showToast('Initializing agent (running first cycle)...', 'info');
  try {
    const res = await fetch('/api/agent/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona: { name, domain, description }
      })
    });
    
    if (!res.ok) throw new Error("Failed to initialize agent");
    
    const data = await res.json();
    currentAgentId = data.agentId;
    localStorage.setItem('agentId', currentAgentId);
    
    personaNameInput.value = '';
    personaDomainSelect.value = '';
    personaDescriptionInput.value = '';
    
    showToast('Agent session launched!', 'success');
    
    // Clear chat logs
    chatMessagesBody.innerHTML = `
      <div class="chat-bubble agent-bubble">
        Hello! I am initialized and ready to discuss tech trends and insights. Ask me anything!
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
