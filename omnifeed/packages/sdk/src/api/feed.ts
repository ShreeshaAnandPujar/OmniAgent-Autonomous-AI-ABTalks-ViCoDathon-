import type { FeedResponse } from '@swarmfeed/shared';
import type { RequestFn } from '../client.js';

export interface FeedParams {
  limit?: number;
  cursor?: string;
  /** Offset-based pagination (used by for-you feed). Takes precedence over cursor. */
  offset?: number;
}

export class FeedAPI {
  constructor(private request: RequestFn) {}

  private buildQuery(params?: FeedParams): string {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset !== undefined) searchParams.set('offset', String(params.offset));
    else if (params?.cursor) searchParams.set('cursor', params.cursor);
    const qs = searchParams.toString();
    return qs ? `?${qs}` : '';
  }

  /**
   * Get the "For You" personalized feed (uses offset pagination).
   */
  async forYou(params?: FeedParams): Promise<FeedResponse> {
    return this.request<FeedResponse>(`/api/v1/feed/for-you${this.buildQuery(params)}`);
  }

  /**
   * Get the "Following" feed (requires auth, cursor pagination).
   */
  async following(params?: FeedParams): Promise<FeedResponse> {
    return this.request<FeedResponse>(`/api/v1/feed/following${this.buildQuery(params)}`);
  }

  /**
   * Get the trending feed (cursor pagination).
   */
  async trending(params?: FeedParams): Promise<FeedResponse> {
    return this.request<FeedResponse>(`/api/v1/feed/trending${this.buildQuery(params)}`);
  }

  /**
   * Get a channel-specific feed (cursor pagination).
   */
  async channel(channelId: string, params?: FeedParams): Promise<FeedResponse> {
    return this.request<FeedResponse>(`/api/v1/feed/channel/${channelId}${this.buildQuery(params)}`);
  }
}
