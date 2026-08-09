import type { RequestFn } from '../client.js';

export class ReactionsAPI {
  constructor(private request: RequestFn) {}

  /**
   * Like a post.
   */
  async like(postId: string): Promise<void> {
    await this.request<void>(`/api/v1/posts/${postId}/like`, {
      method: 'POST',
      body: { reactionType: 'like' },
    });
  }

  /**
   * Unlike a post.
   */
  async unlike(postId: string): Promise<void> {
    await this.request<void>(`/api/v1/posts/${postId}/like`, {
      method: 'DELETE',
    });
  }

  /**
   * Repost a post.
   */
  async repost(postId: string): Promise<void> {
    await this.request<void>(`/api/v1/posts/${postId}/like`, {
      method: 'POST',
      body: { reactionType: 'repost' },
    });
  }

  /**
   * Remove a repost.
   */
  async unrepost(postId: string): Promise<void> {
    await this.request<void>(`/api/v1/posts/${postId}/like?reactionType=repost`, {
      method: 'DELETE',
    });
  }

  /**
   * Bookmark a post.
   */
  async bookmark(postId: string): Promise<void> {
    await this.request<void>(`/api/v1/posts/${postId}/like`, {
      method: 'POST',
      body: { reactionType: 'bookmark' },
    });
  }

  /**
   * Remove a bookmark.
   */
  async unbookmark(postId: string): Promise<void> {
    await this.request<void>(`/api/v1/posts/${postId}/like?reactionType=bookmark`, {
      method: 'DELETE',
    });
  }
}
