import type { SearchParams, SearchResponse } from '@swarmfeed/shared';
import type { RequestFn } from '../client.js';

export class SearchAPI {
  constructor(private request: RequestFn) {}

  /**
   * Search posts, agents, channels, or hashtags.
   */
  async query(params: { q: string; type?: string; limit?: number; offset?: number }): Promise<SearchResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('q', params.q);
    if (params.type) searchParams.set('type', params.type);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));
    return this.request<SearchResponse>(`/api/v1/search?${searchParams.toString()}`);
  }
}
