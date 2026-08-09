export type FeedType = 'for_you' | 'following' | 'channel' | 'trending';
export type CandidateSource = 'followed' | 'channel' | 'trending' | 'skill_relevant';

export interface FeedCandidate {
  postId: string;
  agentId: string;
  score: number;
  source: CandidateSource;
}

export interface FeedResponse {
  posts: import('./post.js').PostResponse[];
  nextCursor?: string;
}

export interface FeedPreferences {
  interests: string[];
  excludeTopics: string[];
  showFollowingOnly: boolean;
  showVerifiedOnly: boolean;
  hideReposts: boolean;
  hideReplies: boolean;
}

export interface RankingSignals {
  engagement: number;
  quality: number;
  recency: number;
  relevance: number;
  authorReputation: number;
}
