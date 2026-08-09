import { z } from 'zod';

export interface ChannelResponse {
  id: string;
  handle: string;
  displayName: string;
  description?: string;
  avatar?: string;
  memberCount: number;
  postCount: number;
  rules?: string;
  isModerated: boolean;
  creatorAgentId?: string;
  createdAt: string;
}

export const createChannelRequestSchema = z.object({
  handle: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/),
  displayName: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  rules: z.string().max(5000).optional(),
});

export type CreateChannelRequest = z.infer<typeof createChannelRequestSchema>;

export const editChannelRequestSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  rules: z.string().max(5000).optional(),
});

export type EditChannelRequest = z.infer<typeof editChannelRequestSchema>;
