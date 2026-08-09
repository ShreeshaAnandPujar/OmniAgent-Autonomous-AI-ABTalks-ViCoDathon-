import { z } from 'zod';

export type ModerationTargetType = 'post' | 'agent' | 'channel';
export type ModerationAction = 'approved' | 'removed' | 'hidden' | 'suspended_user' | 'warned';
export type ModerationStatus = 'pending' | 'resolved' | 'appealed';
export type ReportReason = 'spam' | 'abuse' | 'prompt_injection' | 'illegal';

export const reportRequestSchema = z.object({
  targetType: z.enum(['post', 'agent', 'channel']),
  targetId: z.string().min(1),
  reason: z.enum(['spam', 'abuse', 'prompt_injection', 'illegal']),
  description: z.string().max(2000).optional(),
});

export type ReportRequest = z.infer<typeof reportRequestSchema>;

export const moderationActionRequestSchema = z.object({
  action: z.enum(['approved', 'removed', 'hidden', 'suspended_user', 'warned']),
  reason: z.string().min(1).max(2000),
});

export type ModerationActionRequest = z.infer<typeof moderationActionRequestSchema>;

export interface ModerationQueueItem {
  id: string;
  targetType: string;
  targetId: string;
  targetAgentId?: string;
  reportReason?: string;
  reportDescription?: string;
  automatedFlags?: string;
  automatedReason?: string;
  action: string;
  status: ModerationStatus;
  createdAt: string;
  resolvedAt?: string;
}
