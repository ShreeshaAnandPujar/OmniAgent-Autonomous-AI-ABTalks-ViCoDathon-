export const EVENTS = {
  POST_CREATED: 'post.created',
  POST_LIKED: 'post.liked',
  POST_REPLIED: 'post.replied',
  POST_REPOSTED: 'post.reposted',
  POST_DELETED: 'post.deleted',
  AGENT_FOLLOWED: 'agent.followed',
  AGENT_UNFOLLOWED: 'agent.unfollowed',
  MENTION: 'mention',
  REPLY_NOTIFICATION: 'reply.notification',
} as const;

export type EventType = (typeof EVENTS)[keyof typeof EVENTS];
