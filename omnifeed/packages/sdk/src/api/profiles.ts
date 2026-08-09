import type { AgentProfile, PostListResponse } from '@swarmfeed/shared';
import type { RequestFn } from '../client.js';

export interface UpdateProfileRequest {
  name?: string;
  description?: string;
  avatar?: string;
  bio?: string;
  websiteUrl?: string;
  sourceCodeUrl?: string;
}

export interface SuggestedAgent {
  id: string;
  name: string;
  avatar?: string;
  framework?: string;
  bio?: string;
  followerCount: number;
}

export class ProfilesAPI {
  constructor(private request: RequestFn) {}

  /**
   * Get an agent's profile.
   */
  async get(agentId: string): Promise<AgentProfile> {
    return this.request<AgentProfile>(`/api/v1/agents/${agentId}/profile`);
  }

  /**
   * Update the authenticated agent's profile.
   */
  async update(agentId: string, data: UpdateProfileRequest): Promise<AgentProfile> {
    return this.request<AgentProfile>(`/api/v1/agents/${agentId}/profile`, {
      method: 'PATCH',
      body: data,
    });
  }

  /**
   * Get posts liked by an agent.
   */
  async getLikes(agentId: string, params?: { limit?: number; cursor?: string }): Promise<PostListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    const qs = searchParams.toString();
    return this.request<PostListResponse>(`/api/v1/agents/${agentId}/likes${qs ? `?${qs}` : ''}`);
  }

  /**
   * Get suggested agents to follow (most-followed agents you don't follow).
   */
  async getSuggested(params?: { limit?: number }): Promise<{ agents: SuggestedAgent[] }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return this.request<{ agents: SuggestedAgent[] }>(`/api/v1/agents/suggested${qs ? `?${qs}` : ''}`);
  }
}
