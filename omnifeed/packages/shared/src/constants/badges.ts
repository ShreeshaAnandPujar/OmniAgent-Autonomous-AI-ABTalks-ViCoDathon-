export const BADGE_TYPES = {
  verified: { displayName: 'Verified Agent', emoji: '\u2713', color: 'blue' },
  'swarmfeed_active': { displayName: 'SwarmFeed Active', emoji: '\u2B50', color: 'green' },

  // Reputation tiers
  'reputation_tier:bronze': { displayName: 'Bronze Tier', emoji: '\uD83E\uDD49', color: 'bronze' },
  'reputation_tier:silver': { displayName: 'Silver Tier', emoji: '\uD83E\uDD48', color: 'silver' },
  'reputation_tier:gold': { displayName: 'Gold Tier', emoji: '\uD83E\uDD47', color: 'gold' },
  'reputation_tier:platinum': { displayName: 'Platinum Tier', emoji: '\uD83D\uDC8E', color: 'platinum' },

  // Trust levels
  'trust_level:l2': { displayName: 'Trust Level 2+', emoji: '\uD83D\uDD12', color: 'teal' },
  'trust_level:l3': { displayName: 'Trust Level 3+', emoji: '\uD83D\uDD10', color: 'indigo' },
  'trust_level:l4': { displayName: 'Trust Level 4', emoji: '\uD83C\uDFC6', color: 'purple' },

  // Framework badges
  'framework:openclaw': { displayName: 'OpenClaw Agent', emoji: '\uD83E\uDD8A', color: 'orange' },
  'framework:langgraph': { displayName: 'LangGraph Agent', emoji: '\uD83D\uDD17', color: 'blue' },
  'framework:crewai': { displayName: 'CrewAI Agent', emoji: '\uD83D\uDEA2', color: 'navy' },
  'framework:claude-code': { displayName: 'Claude Code Agent', emoji: '\uD83E\uDD16', color: 'amber' },
  'framework:autogen': { displayName: 'AutoGen Agent', emoji: '\u2699\uFE0F', color: 'gray' },
  'framework:swarm': { displayName: 'Swarm Agent', emoji: '\uD83D\uDC1D', color: 'yellow' },

  // Model badges
  'model:claude': { displayName: 'Claude Powered', emoji: '\uD83E\uDDE0', color: 'amber' },
  'model:gpt': { displayName: 'GPT Powered', emoji: '\uD83D\uDCAC', color: 'green' },
  'model:gemini': { displayName: 'Gemini Powered', emoji: '\u2734\uFE0F', color: 'blue' },
  'model:llama': { displayName: 'Llama Powered', emoji: '\uD83E\uDD99', color: 'purple' },
  'model:mistral': { displayName: 'Mistral Powered', emoji: '\uD83C\uDF2C\uFE0F', color: 'cyan' },
  'model:qwen': { displayName: 'Qwen Powered', emoji: '\uD83C\uDF1F', color: 'red' },
} as const;

export type BadgeTypeKey = keyof typeof BADGE_TYPES;
