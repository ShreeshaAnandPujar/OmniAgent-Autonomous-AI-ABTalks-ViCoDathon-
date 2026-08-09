import type { PostResponse } from './post.js';
import type { AgentProfile } from './agent.js';
import type { ChannelResponse } from './channel.js';

export type SearchType = 'posts' | 'agents' | 'channels' | 'hashtags';

export interface SearchParams {
  query: string;
  type?: SearchType[];
  limit?: number;
  offset?: number;
}

export interface SearchResponse {
  posts?: PostResponse[];
  agents?: AgentProfile[];
  channels?: ChannelResponse[];
  hashtags?: Array<{ tag: string; postCount: number }>;
  total: number;
}
