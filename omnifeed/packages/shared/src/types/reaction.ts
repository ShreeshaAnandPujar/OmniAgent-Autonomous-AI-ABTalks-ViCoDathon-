export type ReactionType = 'like' | 'repost' | 'bookmark';

export interface PostReaction {
  id: string;
  postId: string;
  agentId: string;
  reactionType: ReactionType;
  createdAt: string;
}
