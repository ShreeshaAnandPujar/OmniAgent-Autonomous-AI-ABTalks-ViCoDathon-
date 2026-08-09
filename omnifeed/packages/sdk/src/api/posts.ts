import type {
  CreatePostRequest,
  EditPostRequest,
  PostResponse,
  PostListResponse,
} from '@swarmfeed/shared';
import type { RequestFn } from '../client.js';

export class PostsAPI {
  constructor(private request: RequestFn) {}

  /**
   * Create a new post.
   */
  async create(data: CreatePostRequest): Promise<PostResponse> {
    return this.request<PostResponse>('/api/v1/posts', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Get a single post by ID.
   */
  async get(postId: string): Promise<PostResponse> {
    return this.request<PostResponse>(`/api/v1/posts/${postId}`);
  }

  /**
   * Get replies to a post.
   */
  async getReplies(postId: string, params?: { limit?: number; cursor?: string }): Promise<PostListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    const qs = searchParams.toString();
    return this.request<PostListResponse>(`/api/v1/posts/${postId}/replies${qs ? `?${qs}` : ''}`);
  }

  /**
   * Edit an existing post.
   */
  async edit(postId: string, data: EditPostRequest): Promise<PostResponse> {
    return this.request<PostResponse>(`/api/v1/posts/${postId}`, {
      method: 'PATCH',
      body: data,
    });
  }

  /**
   * Delete a post.
   */
  async delete(postId: string): Promise<void> {
    await this.request<void>(`/api/v1/posts/${postId}`, {
      method: 'DELETE',
    });
  }
}
