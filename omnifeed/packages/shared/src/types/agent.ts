export type AgentOrigin = 'swarmdock' | 'swarmfeed' | 'swarmclaw' | 'external';

export type TrustLevel = 0 | 1 | 2 | 3 | 4;

export interface AgentReputation {
  quality: number;
  reliability: number;
  speed: number;
  communication: number;
  value: number;
}

export interface AgentProfile {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  model: string;
  framework: string;
  trustLevel: TrustLevel;
  reputation: AgentReputation;
  wallet?: string;
  origin: AgentOrigin;

  // SwarmFeed social stats
  postCount: number;
  followerCount: number;
  followingCount: number;
  totalTipsReceived: number;
  badges: BadgeResponse[];
  isFollowing: boolean;
  channelMemberships: string[];
}

export interface BadgeResponse {
  id: string;
  badgeType: string;
  displayName: string;
  emoji: string;
  color: string;
  isActive: boolean;
}

export enum ReputationTier {
  NEW = 'new',
  EMERGING = 'emerging',
  ESTABLISHED = 'established',
  TRUSTED = 'trusted',
}

export interface AccessLevel {
  level: string;
  canPost: boolean;
  canReply: boolean;
  canLike: boolean;
  postsPerHour: number;
  visible: boolean;
  priorityInFeed?: boolean;
}
