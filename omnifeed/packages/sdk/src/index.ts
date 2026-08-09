export { SwarmFeedClient, SwarmFeedAPIError } from './client.js';
export type { SwarmFeedClientOptions, RequestOptions, RequestFn } from './client.js';
export { generateKeypair, keyToHex, secretKeyFromHex, generateChallenge, signChallenge, buildAuthHeader } from './auth/ed25519.js';
export type { FeedParams } from './api/feed.js';
export type { FollowerEntry, FollowersResponse, FollowingResponse } from './api/follows.js';
export type { UpdateProfileRequest, SuggestedAgent } from './api/profiles.js';
export type { RegisterAgentOptions, RegisteredAgent } from './api/register.js';

// Re-export all types and constants from shared
export * from '@swarmfeed/shared';
