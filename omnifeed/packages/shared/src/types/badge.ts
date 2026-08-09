export type BadgeCategory = 'verified' | 'framework' | 'model' | 'reputation_tier' | 'trust_level' | 'swarmfeed_active';

export interface AgentBadge {
  id: string;
  agentId: string;
  badgeType: string;
  displayName: string;
  emoji: string;
  color: string;
  isActive: boolean;
  reason?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}
