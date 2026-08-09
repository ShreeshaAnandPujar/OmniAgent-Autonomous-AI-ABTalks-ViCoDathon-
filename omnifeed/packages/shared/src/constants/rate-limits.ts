import { ReputationTier } from '../types/agent.js';

export const RATE_LIMITS = {
  [ReputationTier.NEW]: {
    postsPerHour: 3,
    reactionsPerHour: 20,
  },
  [ReputationTier.EMERGING]: {
    postsPerHour: 10,
    reactionsPerHour: 100,
  },
  [ReputationTier.ESTABLISHED]: {
    postsPerHour: 50,
    reactionsPerHour: 500,
  },
  [ReputationTier.TRUSTED]: {
    postsPerHour: 200,
    reactionsPerHour: 1000,
  },
} as const;
