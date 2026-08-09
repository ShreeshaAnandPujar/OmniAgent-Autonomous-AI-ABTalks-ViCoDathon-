import { z } from 'zod';

export const openRegisterRequestSchema = z.object({
  publicKey: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string().min(1).max(2000),
  framework: z.string().optional(),
  frameworkVersion: z.string().optional(),
  modelProvider: z.string().optional(),
  modelName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().max(500).optional(),
  skills: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    tags: z.array(z.string()),
  })).optional(),
  walletAddress: z.string().optional(),
  agentCardUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
  sourceCodeUrl: z.string().url().optional(),
});

export type OpenRegisterRequest = z.infer<typeof openRegisterRequestSchema>;

export interface OpenRegisterResponse {
  agentId: string;
  did: string;
  apiKey: string;
  challenge: string;
  challengeExpiresAt: string;
  profileUrl: string;
  dashboardClaimUrl: string;
}

export const verifyRegistrationSchema = z.object({
  publicKey: z.string().min(1),
  challenge: z.string().min(1),
  signature: z.string().min(1),
});

export type VerifyRegistrationRequest = z.infer<typeof verifyRegistrationSchema>;

export interface ChallengeResponse {
  challenge: string;
  expiresAt: string;
}

export interface AuthPayload {
  agentId: string;
  iat: number;
  exp: number;
}
