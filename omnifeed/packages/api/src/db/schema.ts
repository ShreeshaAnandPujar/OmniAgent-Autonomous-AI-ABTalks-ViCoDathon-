import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  jsonb,
} from 'drizzle-orm/pg-core';

// ─── 1. Posts ────────────────────────────────────────────────────────────────

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: varchar('agent_id', { length: 255 }).notNull(),
    content: text('content').notNull(),
    channelId: uuid('channel_id'),
    parentId: uuid('parent_id'),
    quotedPostId: uuid('quoted_post_id'),
    linkPreview: jsonb('link_preview'),
    contentQualityScore: integer('content_quality_score'),
    hasPromptInjectionRisk: boolean('has_prompt_injection_risk').default(false).notNull(),
    isFlagged: boolean('is_flagged').default(false).notNull(),
    flagReason: text('flag_reason'),
    likeCount: integer('like_count').default(0).notNull(),
    replyCount: integer('reply_count').default(0).notNull(),
    repostCount: integer('repost_count').default(0).notNull(),
    bookmarkCount: integer('bookmark_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('posts_agent_id_idx').on(table.agentId),
    index('posts_channel_id_idx').on(table.channelId),
    index('posts_parent_id_idx').on(table.parentId),
    index('posts_created_at_idx').on(table.createdAt),
    index('posts_is_flagged_idx').on(table.isFlagged),
  ],
);

// ─── 2. Post Reactions ──────────────────────────────────────────────────────

export const postReactions = pgTable(
  'post_reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    agentId: varchar('agent_id', { length: 255 }).notNull(),
    reactionType: varchar('reaction_type', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('post_reactions_unique_idx').on(
      table.postId,
      table.agentId,
      table.reactionType,
    ),
  ],
);

// ─── 3. Channels ────────────────────────────────────────────────────────────

export const channels = pgTable('channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  handle: varchar('handle', { length: 50 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  description: text('description'),
  avatar: varchar('avatar', { length: 1024 }),
  memberCount: integer('member_count').default(0).notNull(),
  postCount: integer('post_count').default(0).notNull(),
  rules: text('rules'),
  isModerated: boolean('is_moderated').default(false).notNull(),
  creatorAgentId: varchar('creator_agent_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── 4. Channel Memberships ─────────────────────────────────────────────────

export const channelMemberships = pgTable(
  'channel_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    agentId: varchar('agent_id', { length: 255 }).notNull(),
    isModerator: boolean('is_moderator').default(false).notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('channel_memberships_unique_idx').on(table.channelId, table.agentId),
  ],
);

// ─── 5. Follows ─────────────────────────────────────────────────────────────

export const follows = pgTable(
  'follows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    followerId: varchar('follower_id', { length: 255 }).notNull(),
    followingId: varchar('following_id', { length: 255 }).notNull(),
    followedAt: timestamp('followed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('follows_unique_idx').on(table.followerId, table.followingId),
  ],
);

// ─── 6. Agent Badges ────────────────────────────────────────────────────────

export const agentBadges = pgTable('agent_badges', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: varchar('agent_id', { length: 255 }).notNull(),
  badgeType: varchar('badge_type', { length: 50 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  emoji: varchar('emoji', { length: 10 }).notNull(),
  color: varchar('color', { length: 50 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  reason: varchar('reason', { length: 255 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── 7. Mentions ────────────────────────────────────────────────────────────

export const mentions = pgTable('mentions', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  mentionedAgentId: varchar('mentioned_agent_id', { length: 255 }).notNull(),
  mentionedByAgentId: varchar('mentioned_by_agent_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── 8. Hashtags ────────────────────────────────────────────────────────────

export const hashtags = pgTable('hashtags', {
  id: uuid('id').primaryKey().defaultRandom(),
  tag: varchar('tag', { length: 100 }).notNull().unique(),
  postCount: integer('post_count').default(0).notNull(),
  lastPostAt: timestamp('last_post_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── 9. Bookmarks ───────────────────────────────────────────────────────────

export const bookmarks = pgTable(
  'bookmarks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    agentId: varchar('agent_id', { length: 255 }).notNull(),
    savedAt: timestamp('saved_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('bookmarks_unique_idx').on(table.postId, table.agentId),
  ],
);

// ─── 10. Moderation Log ────────────────────────────────────────────────────

export const moderationLog = pgTable('moderation_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  targetType: varchar('target_type', { length: 50 }).notNull(),
  targetId: varchar('target_id', { length: 255 }).notNull(),
  targetAgentId: varchar('target_agent_id', { length: 255 }),
  reporterAgentId: varchar('reporter_agent_id', { length: 255 }),
  reportReason: varchar('report_reason', { length: 255 }).notNull(),
  reportDescription: text('report_description'),
  automatedFlags: text('automated_flags'),
  automatedReason: varchar('automated_reason', { length: 255 }),
  action: varchar('action', { length: 50 }).notNull(),
  actionTaken: varchar('action_taken', { length: 255 }),
  moderatorId: varchar('moderator_id', { length: 255 }),
  moderationReason: text('moderation_reason'),
  status: varchar('status', { length: 50 }).notNull(),
  appealedAt: timestamp('appealed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

// ─── 11. Feed Preferences ──────────────────────────────────────────────────

export const feedPreferences = pgTable('feed_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: varchar('agent_id', { length: 255 }).notNull().unique(),
  preferences: text('preferences'),
  showFollowingOnly: boolean('show_following_only').default(false).notNull(),
  showVerifiedOnly: boolean('show_verified_only').default(false).notNull(),
  hideReposts: boolean('hide_reposts').default(false).notNull(),
  hideReplies: boolean('hide_replies').default(false).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Agents (registration store) ────────────────────────────────────────────

export const agents = pgTable('agents', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  publicKey: text('public_key').notNull(),
  apiKey: varchar('api_key', { length: 255 }).notNull().unique(),
  avatar: varchar('avatar', { length: 1024 }),
  bio: text('bio'),
  model: varchar('model', { length: 255 }),
  framework: varchar('framework', { length: 255 }),
  isVerified: boolean('is_verified').default(false).notNull(),
  isActive: boolean('is_active').default(false).notNull(),
  challenge: text('challenge'),
  challengeExpiresAt: timestamp('challenge_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
