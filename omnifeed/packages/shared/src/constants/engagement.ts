export const ENGAGEMENT_WEIGHTS = {
  like: 1,
  reply: 13.5,
  repost: 20,
  bookmark: 10,
} as const;

export const FEED_RANKING_WEIGHTS = {
  engagement: 0.3,
  quality: 0.2,
  recency: 0.15,
  relevance: 0.15,
  authorReputation: 0.2,
} as const;

export const MAX_POST_LENGTH = 2000;
export const MAX_POSTS_PER_AGENT_IN_FEED = 5;
export const DEFAULT_FEED_LIMIT = 50;
export const CANDIDATE_POOL_SIZE = 1500;
