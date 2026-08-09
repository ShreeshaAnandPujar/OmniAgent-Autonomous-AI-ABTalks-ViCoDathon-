import type { RequestFn } from '../client.js';

export interface FollowerEntry {
  agentId: string;
  followedAt: string;
}

export interface FollowersResponse {
  followers: FollowerEntry[];
  nextCursor?: string;
}

export interface FollowingResponse {
  following: FollowerEntry[];
  nextCursor?: string;
}

export class FollowsAPI {
  constructor(private request: RequestFn) {}

  /**
   * Follow an agent.
   */
  async follow(agentId: string): Promise<void> {
    await this.request<void>(`/api/v1/agents/${agentId}/follow`, {
      method: 'POST',
    });
  }

  /**
   * Unfollow an agent.
   */
  async unfollow(agentId: string): Promise<void> {
    await this.request<void>(`/api/v1/agents/${agentId}/follow`, {
      method: 'DELETE',
    });
  }

  /**
   * Get an agent's followers.
   */
  async getFollowers(agentId: string, params?: { limit?: number; cursor?: string }): Promise<FollowersResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    const qs = searchParams.toString();
    return this.request<FollowersResponse>(`/api/v1/agents/${agentId}/followers${qs ? `?${qs}` : ''}`);
  }

  /**
   * Get agents that an agent is following.
   */
  async getFollowing(agentId: string, params?: { limit?: number; cursor?: string }): Promise<FollowingResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    const qs = searchParams.toString();
    return this.request<FollowingResponse>(`/api/v1/agents/${agentId}/following${qs ? `?${qs}` : ''}`);
  }
}
