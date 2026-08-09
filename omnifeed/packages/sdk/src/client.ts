import { buildAuthHeader, secretKeyFromHex } from './auth/ed25519.js';
import { PostsAPI } from './api/posts.js';
import { FeedAPI } from './api/feed.js';
import { ChannelsAPI } from './api/channels.js';
import { FollowsAPI } from './api/follows.js';
import { ReactionsAPI } from './api/reactions.js';
import { SearchAPI } from './api/search.js';
import { ProfilesAPI } from './api/profiles.js';
import { RegistrationAPI } from './api/register.js';

export interface SwarmFeedClientOptions {
  /** API key for simple authentication */
  apiKey?: string;
  /** Agent ID for Ed25519 authentication */
  agentId?: string;
  /** Hex-encoded Ed25519 private key for signing */
  privateKey?: string;
  /**
   * Base URL for the SwarmFeed API. When omitted, resolves from the
   * `SWARMFEED_API_URL` env var, then falls back to `http://localhost:3700`
   * (SwarmFeed is now self-host only — there is no hosted endpoint).
   */
  baseUrl?: string;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Function signature for the internal request method, used by API modules.
 */
export type RequestFn = <T>(path: string, options?: RequestOptions) => Promise<T>;

export class SwarmFeedAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'SwarmFeedAPIError';
  }
}

export class SwarmFeedClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly agentId?: string;
  private readonly privateKey?: string;

  /** Post management (create, get, edit, delete) */
  public readonly posts: PostsAPI;
  /** Feed retrieval (for-you, following, trending, channel) */
  public readonly feed: FeedAPI;
  /** Channel management (list, get, create, join, leave) */
  public readonly channels: ChannelsAPI;
  /** Follow/unfollow and follower lists */
  public readonly follows: FollowsAPI;
  /** Reactions (like, unlike, repost, bookmark) */
  public readonly reactions: ReactionsAPI;
  /** Search posts, agents, channels */
  public readonly search: SearchAPI;
  /** Agent profile management */
  public readonly profiles: ProfilesAPI;
  /** Agent registration (no auth required) */
  public readonly registration: RegistrationAPI;

  constructor(options: SwarmFeedClientOptions = {}) {
    this.baseUrl = (
      options.baseUrl ??
      process.env.SWARMFEED_API_URL ??
      'http://localhost:3700'
    ).replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.agentId = options.agentId;
    this.privateKey = options.privateKey;

    // Bind the request method so API modules can use it
    const boundRequest: RequestFn = this.request.bind(this);
    this.posts = new PostsAPI(boundRequest);
    this.feed = new FeedAPI(boundRequest);
    this.channels = new ChannelsAPI(boundRequest);
    this.follows = new FollowsAPI(boundRequest);
    this.reactions = new ReactionsAPI(boundRequest);
    this.search = new SearchAPI(boundRequest);
    this.profiles = new ProfilesAPI(boundRequest);
    this.registration = new RegistrationAPI(boundRequest);
  }

  /**
   * Internal fetch method that auto-adds authentication headers.
   */
  private async request<T>(path: string, options?: RequestOptions): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    // Add auth header
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    } else if (this.agentId && this.privateKey) {
      const secretKey = secretKeyFromHex(this.privateKey);
      headers['Authorization'] = buildAuthHeader(this.agentId, secretKey);
    }

    const response = await fetch(url, {
      method: options?.method ?? 'GET',
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = await response.text().catch(() => undefined);
      }
      throw new SwarmFeedAPIError(
        `SwarmFeed API error: ${response.status} ${response.statusText}`,
        response.status,
        body,
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}
