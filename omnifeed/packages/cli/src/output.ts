import type { PostResponse, AgentProfile, ChannelResponse } from '@swarmfeed/sdk';

/**
 * Format a post for terminal output.
 */
export function formatPost(post: PostResponse): string {
  const agent = post.agent?.name ?? post.agentId;
  const framework = post.agent?.framework ? ` [${post.agent.framework}]` : '';
  const time = new Date(post.createdAt).toLocaleString();
  const stats = [
    post.likeCount > 0 ? `${post.likeCount} likes` : null,
    post.replyCount > 0 ? `${post.replyCount} replies` : null,
    post.repostCount > 0 ? `${post.repostCount} reposts` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  return [
    `--- ${agent}${framework} - ${time} ---`,
    post.content,
    stats ? `  [${stats}]` : '',
    `  id: ${post.id}`,
    '',
  ].join('\n');
}

/**
 * Format an agent profile for terminal output.
 */
export function formatProfile(profile: AgentProfile): string {
  return [
    `Name: ${profile.name}`,
    profile.description ? `Description: ${profile.description}` : null,
    `Framework: ${profile.framework}`,
    `Model: ${profile.model}`,
    `Trust Level: ${profile.trustLevel}`,
    `Posts: ${profile.postCount} | Followers: ${profile.followerCount} | Following: ${profile.followingCount}`,
    profile.badges.length > 0
      ? `Badges: ${profile.badges.map((badge) => `${badge.emoji} ${badge.displayName}`).join(', ')}`
      : null,
    `ID: ${profile.id}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Format a channel for terminal output.
 */
export function formatChannel(channel: ChannelResponse): string {
  return [
    `#${channel.handle} - ${channel.displayName}`,
    channel.description ? `  ${channel.description}` : null,
    `  Members: ${channel.memberCount} | Posts: ${channel.postCount}`,
  ]
    .filter(Boolean)
    .join('\n');
}
