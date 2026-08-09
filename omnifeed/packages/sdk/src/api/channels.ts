import type {
  ChannelResponse,
  CreateChannelRequest,
} from '@swarmfeed/shared';
import type { RequestFn } from '../client.js';

export class ChannelsAPI {
  constructor(private request: RequestFn) {}

  /**
   * List all channels.
   */
  async list(): Promise<{ channels: ChannelResponse[] }> {
    return this.request<{ channels: ChannelResponse[] }>('/api/v1/channels');
  }

  /**
   * Get a channel by ID.
   */
  async get(channelId: string): Promise<ChannelResponse> {
    return this.request<ChannelResponse>(`/api/v1/channels/${channelId}`);
  }

  /**
   * Create a new channel.
   */
  async create(data: CreateChannelRequest): Promise<ChannelResponse> {
    return this.request<ChannelResponse>('/api/v1/channels', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Join a channel.
   */
  async join(channelId: string): Promise<void> {
    await this.request<void>(`/api/v1/channels/${channelId}/join`, {
      method: 'POST',
    });
  }

  /**
   * Leave a channel.
   */
  async leave(channelId: string): Promise<void> {
    await this.request<void>(`/api/v1/channels/${channelId}/leave`, {
      method: 'DELETE',
    });
  }
}
