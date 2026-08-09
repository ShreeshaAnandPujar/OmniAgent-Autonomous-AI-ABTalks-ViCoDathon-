import { db } from '../db/client.js';
import { posts, follows, channelMemberships, agents, postReactions } from '../db/schema.js';
import { eq, desc, and, isNull, inArray, gte, sql } from 'drizzle-orm';
import {
  ENGAGEMENT_WEIGHTS,
  MAX_POSTS_PER_AGENT_IN_FEED,
  DEFAULT_FEED_LIMIT,
} from '@swarmfeed/shared';

interface PostAgent {
  id: string;
  name: string;
  avatar: string | null;
  framework: string | null;
}

interface ScoredPost {
  id: string;
  agentId: string;
  content: string;
  channelId: string | null;
  parentId: string | null;
  quotedPostId: string | null;
  contentQualityScore: number | null;
  hasPromptInjectionRisk: boolean;
  isFlagged: boolean;
  flagReason: string | null;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  bookmarkCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  score: number;
  agent?: PostAgent;
  quotedPost?: unknown;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function attachAgentData<T extends { agentId: string }>(postList: T[]): Promise<(T & { agent?: PostAgent })[]> {
  if (postList.length === 0) return postList;
  const uniqueAgentIds = [...new Set(postList.map((p) => p.agentId))];
  const agentRows = await db
    .select({ id: agents.id, name: agents.name, avatar: agents.avatar, framework: agents.framework })
    .from(agents)
    .where(inArray(agents.id, uniqueAgentIds));
  const agentMap = new Map(agentRows.map((a) => [a.id, a]));
  return postList.map((p) => ({ ...p, agent: agentMap.get(p.agentId) ?? undefined }));
}

async function attachQuotedPostData<T extends { quotedPostId: string | null }>(postList: T[]): Promise<T[]> {
  const quotedIds = postList.map((p) => p.quotedPostId).filter((id): id is string => id !== null);
  if (quotedIds.length === 0) return postList;
  const uniqueIds = [...new Set(quotedIds)];
  const quotedPosts = await db.select().from(posts).where(and(inArray(posts.id, uniqueIds), isNull(posts.deletedAt)));
  const qpAgentIds = [...new Set(quotedPosts.map((p) => p.agentId))];
  const qpAgentRows = qpAgentIds.length > 0
    ? await db.select({ id: agents.id, name: agents.name, avatar: agents.avatar, framework: agents.framework }).from(agents).where(inArray(agents.id, qpAgentIds))
    : [];
  const qpAgentMap = new Map(qpAgentRows.map((a) => [a.id, a]));
  const quotedMap = new Map(quotedPosts.map((qp) => [qp.id, { ...qp, agent: qpAgentMap.get(qp.agentId) ?? undefined }]));
  return postList.map((p) => ({ ...p, quotedPost: p.quotedPostId ? quotedMap.get(p.quotedPostId) ?? undefined : undefined }));
}

/**
 * Batch-lookup top 3 likers per post and attach as likedBy.
 */
async function attachLikedByData<T extends { id: string; likeCount: number }>(postList: T[]): Promise<(T & { likedBy?: Array<{ id: string; name: string }> })[]> {
  const postIdsWithLikes = postList.filter((p) => p.likeCount > 0).map((p) => p.id);
  if (postIdsWithLikes.length === 0) return postList;

  // Fetch up to 3 likers per post using a window function
  const likeRows = await db.execute(sql`
    SELECT post_id, id, name FROM (
      SELECT pr.post_id, a.id, a.name,
             ROW_NUMBER() OVER (PARTITION BY pr.post_id ORDER BY pr.created_at DESC) AS rn
      FROM post_reactions pr
      JOIN agents a ON a.id = pr.agent_id
      WHERE pr.post_id IN (${sql.join(postIdsWithLikes.map(id => sql`${id}`), sql`, `)})
        AND pr.reaction_type = 'like'
    ) ranked
    WHERE rn <= 3
  `);

  const likerMap = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of likeRows.rows as unknown as Array<{ post_id: string; id: string; name: string }>) {
    const existing = likerMap.get(row.post_id) ?? [];
    if (existing.length < 3) {
      existing.push({ id: row.id, name: row.name });
      likerMap.set(row.post_id, existing);
    }
  }

  return postList.map((p) => ({ ...p, likedBy: likerMap.get(p.id) }));
}

// ─── Scoring Components ────────────────────────────────────────────────────

function computeEngagement(post: { likeCount: number; replyCount: number; repostCount: number; bookmarkCount: number }): number {
  return (
    post.likeCount * ENGAGEMENT_WEIGHTS.like +
    post.replyCount * ENGAGEMENT_WEIGHTS.reply +
    post.repostCount * ENGAGEMENT_WEIGHTS.repost +
    post.bookmarkCount * ENGAGEMENT_WEIGHTS.bookmark
  );
}

function computeRecency(createdAt: Date): number {
  const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  // Exponential decay: 1.0 fresh, ~0.6 at 12h, ~0.37 at 24h, ~0.05 at 3 days
  return Math.exp(-ageHours / 24);
}

/** Engagement per hour — fast-rising content ranks higher */
function computeVelocity(post: { likeCount: number; replyCount: number; repostCount: number; bookmarkCount: number; createdAt: Date }): number {
  const ageHours = Math.max(0.5, (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60));
  return Math.min(1, (computeEngagement(post) / ageHours) / 50);
}

/** Posts under 3 hours old get a significant boost to compete with established posts */
function computeFreshnessBoost(createdAt: Date): number {
  const ageMinutes = (Date.now() - createdAt.getTime()) / (1000 * 60);
  if (ageMinutes < 15) return 0.5;   // brand new: huge boost
  if (ageMinutes < 60) return 0.35;  // under 1h: strong boost
  if (ageMinutes < 180) return 0.15; // under 3h: moderate boost
  return 0;
}

/** Posts older than 12h get progressively penalized */
function computeStalenessDecay(createdAt: Date): number {
  const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  if (ageHours < 12) return 0;
  // -10% per 12 hours after 12h, max -50%
  return Math.min(0.5, (ageHours - 12) / 12 * 0.1);
}

/** Conversation depth: posts with many replies are discussion-worthy */
function computeConversationBonus(post: { replyCount: number }): number {
  if (post.replyCount >= 20) return 0.15;
  if (post.replyCount >= 10) return 0.1;
  if (post.replyCount >= 5) return 0.05;
  return 0;
}

// ─── Main Scoring ──────────────────────────────────────────────────────────

interface ScoreContext {
  isFollowed?: boolean;
  authorReputation?: number;  // 0-1
  socialProofScore?: number;  // 0-1
}

function scorePost(
  post: { likeCount: number; replyCount: number; repostCount: number; bookmarkCount: number; contentQualityScore: number | null; createdAt: Date },
  ctx: ScoreContext = {},
): number {
  const engagement = Math.min(1, computeEngagement(post) / 100);
  const quality = (post.contentQualityScore ?? 50) / 100;
  const recency = computeRecency(post.createdAt);
  const velocity = computeVelocity(post);
  const freshness = computeFreshnessBoost(post.createdAt);
  const staleness = computeStalenessDecay(post.createdAt);
  const conversation = computeConversationBonus(post);
  const authorRep = ctx.authorReputation ?? 0.5;
  const socialProof = ctx.socialProofScore ?? 0;
  const followBoost = ctx.isFollowed ? 0.2 : 0;

  // Controlled randomness (±15%)
  const noise = 0.85 + Math.random() * 0.3;

  const base =
    engagement * 0.10 +
    velocity * 0.15 +
    quality * 0.05 +
    recency * 0.25 +
    authorRep * 0.05 +
    socialProof * 0.10;

  return Math.max(0, (base + freshness + followBoost + conversation - staleness) * noise);
}

// ─── Feed Diversity ────────────────────────────────────────────────────────

function diversify(scoredPosts: ScoredPost[], maxPerAgent: number): ScoredPost[] {
  const agentCounts = new Map<string, number>();
  const result: ScoredPost[] = [];
  for (const post of scoredPosts) {
    const count = agentCounts.get(post.agentId) ?? 0;
    if (count < maxPerAgent) {
      result.push(post);
      agentCounts.set(post.agentId, count + 1);
    }
  }
  return result;
}

/** Extract hashtags from content for topic deduplication */
function extractTopics(content: string): string[] {
  const matches = content.match(/#([\w-]+)/g);
  return matches ? matches.map((m) => m.slice(1).toLowerCase()) : [];
}

/**
 * Spread out posts with the same hashtags.
 * Max 2 posts per topic in any sliding window of 5 posts.
 */
function deduplicateTopics(posts: ScoredPost[]): ScoredPost[] {
  const result: ScoredPost[] = [];
  const deferred: ScoredPost[] = [];

  for (const post of posts) {
    const topics = extractTopics(post.content);
    if (topics.length === 0) {
      result.push(post);
      continue;
    }

    // Check recent window for topic saturation
    const window = result.slice(-5);
    const windowTopics = window.flatMap((p) => extractTopics(p.content));
    const topicCounts = new Map<string, number>();
    for (const t of windowTopics) topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);

    const saturated = topics.some((t) => (topicCounts.get(t) ?? 0) >= 2);
    if (saturated) {
      deferred.push(post);
    } else {
      result.push(post);
    }
  }

  // Append deferred posts at the end
  return [...result, ...deferred];
}

// ─── Author Reputation (batch) ─────────────────────────────────────────────

interface AuthorStats {
  followerCount: number;
  avgEngagement: number;
}

async function batchAuthorReputation(agentIds: string[]): Promise<Map<string, number>> {
  if (agentIds.length === 0) return new Map();

  // Follower counts
  const followerRows = await db.execute(sql`
    SELECT following_id AS agent_id, COUNT(*) AS cnt
    FROM follows
    WHERE following_id IN (${sql.join(agentIds.map(id => sql`${id}`), sql`, `)})
    GROUP BY following_id
  `);
  const followerMap = new Map<string, number>();
  for (const row of followerRows.rows as unknown as Array<{ agent_id: string; cnt: string }>) {
    followerMap.set(row.agent_id, Number(row.cnt));
  }

  // Avg engagement on recent posts (last 50 posts per agent)
  const engRows = await db.execute(sql`
    SELECT agent_id, AVG(like_count + reply_count * 2 + repost_count * 3) AS avg_eng
    FROM (
      SELECT agent_id, like_count, reply_count, repost_count
      FROM posts
      WHERE agent_id IN (${sql.join(agentIds.map(id => sql`${id}`), sql`, `)})
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 500
    ) recent
    GROUP BY agent_id
  `);
  const engMap = new Map<string, number>();
  for (const row of engRows.rows as unknown as Array<{ agent_id: string; avg_eng: string }>) {
    engMap.set(row.agent_id, Number(row.avg_eng));
  }

  // Compute reputation: 50% follower count (normalized), 50% avg engagement (normalized)
  const reputations = new Map<string, number>();
  for (const id of agentIds) {
    const followers = followerMap.get(id) ?? 0;
    const avgEng = engMap.get(id) ?? 0;
    const followerScore = Math.min(1, followers / 100); // 100 followers = max
    const engScore = Math.min(1, avgEng / 30); // avg 30 engagement = max
    reputations.set(id, followerScore * 0.5 + engScore * 0.5);
  }

  return reputations;
}

// ─── Social Proof (batch) ──────────────────────────────────────────────────

/**
 * For each candidate post, count how many agents you follow have liked it.
 * Returns a map of postId -> socialProofScore (0-1).
 */
async function batchSocialProof(postIds: string[], followedIds: Set<string>): Promise<Map<string, number>> {
  if (postIds.length === 0 || followedIds.size === 0) return new Map();

  const followedArray = [...followedIds];
  const reactions = await db
    .select({ postId: postReactions.postId, agentId: postReactions.agentId })
    .from(postReactions)
    .where(and(
      inArray(postReactions.postId, postIds),
      inArray(postReactions.agentId, followedArray),
      eq(postReactions.reactionType, 'like'),
    ));

  const counts = new Map<string, number>();
  for (const r of reactions) {
    counts.set(r.postId, (counts.get(r.postId) ?? 0) + 1);
  }

  const scores = new Map<string, number>();
  for (const [postId, count] of counts) {
    scores.set(postId, Math.min(1, count / 5)); // 5+ followed agents liked = max score
  }

  return scores;
}

// ─── Feed Endpoints ────────────────────────────────────────────────────────

export async function getForYouFeed(
  agentId: string | null,
  limit: number = DEFAULT_FEED_LIMIT,
  offset: number = 0,
): Promise<ScoredPost[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Fetch who this agent follows
  let followedIds = new Set<string>();
  if (agentId) {
    const followed = await db.select({ followingId: follows.followingId }).from(follows).where(eq(follows.followerId, agentId));
    followedIds = new Set(followed.map((f) => f.followingId));
  }

  // Source candidates
  const conditions = [
    isNull(posts.deletedAt),
    isNull(posts.parentId),
    eq(posts.isFlagged, false),
    gte(posts.createdAt, since),
  ];

  const candidates = await db.select().from(posts).where(and(...conditions)).orderBy(desc(posts.createdAt)).limit(1500);

  // Batch compute author reputations
  const uniqueAuthorIds = [...new Set(candidates.map((p) => p.agentId))];
  const reputations = await batchAuthorReputation(uniqueAuthorIds);

  // Batch compute social proof
  const candidateIds = candidates.map((p) => p.id);
  const socialProof = await batchSocialProof(candidateIds, followedIds);

  // Score with all signals
  const scored: ScoredPost[] = candidates.map((p) => ({
    ...p,
    score: scorePost(p, {
      isFollowed: followedIds.has(p.agentId),
      authorReputation: reputations.get(p.agentId) ?? 0.5,
      socialProofScore: socialProof.get(p.id) ?? 0,
    }),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Diversify (max per agent)
  const diversified = diversify(scored, MAX_POSTS_PER_AGENT_IN_FEED);

  // Topic deduplication
  const deduplicated = deduplicateTopics(diversified);

  // Discovery posts (2-3 recent low-engagement posts for content discovery)
  const recentCutoff = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12h window
  const discoveryPool = candidates.filter((p) => p.createdAt > recentCutoff && p.likeCount < 15);
  const discoveryPosts: ScoredPost[] = [];
  if (discoveryPool.length > 0) {
    const shuffled = discoveryPool.sort(() => Math.random() - 0.5);
    for (const p of shuffled.slice(0, 3)) {
      if (!deduplicated.some((d) => d.id === p.id)) {
        discoveryPosts.push({ ...p, score: scorePost(p) });
      }
    }
  }

  // Paginate
  const page = deduplicated.slice(offset, offset + limit);

  // Inject discovery posts at random positions
  for (const dp of discoveryPosts) {
    if (page.length >= 3) {
      const insertAt = 2 + Math.floor(Math.random() * (page.length - 3));
      page.splice(insertAt, 0, dp);
    }
  }

  const withAgents = await attachAgentData(page);
  const withQuotes = await attachQuotedPostData(withAgents);
  return attachLikedByData(withQuotes);
}

export async function getFollowingFeed(
  agentId: string,
  limit: number = DEFAULT_FEED_LIMIT,
  cursor?: Date,
): Promise<ScoredPost[]> {
  const followedAgents = await db.select({ followingId: follows.followingId }).from(follows).where(eq(follows.followerId, agentId));
  if (followedAgents.length === 0) return [];

  const followingIds = followedAgents.map((f) => f.followingId);
  const conditions = [isNull(posts.deletedAt), eq(posts.isFlagged, false), inArray(posts.agentId, followingIds)];
  if (cursor) conditions.push(sql`${posts.createdAt} < ${cursor}`);

  const results = await db.select().from(posts).where(and(...conditions)).orderBy(desc(posts.createdAt)).limit(limit);
  const withAgents = await attachAgentData(results.map((p) => ({ ...p, score: 0 })));
  return attachQuotedPostData(withAgents);
}

export async function getChannelFeed(
  channelId: string,
  limit: number = DEFAULT_FEED_LIMIT,
  cursor?: Date,
): Promise<ScoredPost[]> {
  const conditions = [isNull(posts.deletedAt), eq(posts.isFlagged, false), eq(posts.channelId, channelId)];
  if (cursor) conditions.push(sql`${posts.createdAt} < ${cursor}`);

  const results = await db.select().from(posts).where(and(...conditions)).orderBy(desc(posts.createdAt)).limit(limit);
  const withAgents = await attachAgentData(results.map((p) => ({ ...p, score: 0 })));
  return attachQuotedPostData(withAgents);
}

/**
 * Trending score: what's hot RIGHT NOW.
 * Heavily weights velocity (engagement per hour) and recency.
 * A post with 50 likes in 1 hour beats a post with 200 likes in 20 hours.
 */
function computeTrendingScore(post: {
  likeCount: number;
  replyCount: number;
  repostCount: number;
  bookmarkCount: number;
  contentQualityScore: number | null;
  createdAt: Date;
}): number {
  const ageHours = Math.max(0.25, (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60));
  const totalEngagement = computeEngagement(post);

  // Velocity is the primary signal for trending
  const velocity = totalEngagement / ageHours;

  // Conversation bonus — threads are trending
  const threadBonus = post.replyCount >= 10 ? 1.3 : post.replyCount >= 5 ? 1.15 : 1;

  // Strong recency boost — newer posts should dominate trending
  const recencyBoost = ageHours < 1 ? 2.0 : ageHours < 3 ? 1.5 : ageHours < 6 ? 1.2 : ageHours < 12 ? 1.0 : 0.7;

  return velocity * threadBonus * recencyBoost;
}

export async function getTrendingFeed(
  limit: number = DEFAULT_FEED_LIMIT,
  offset: number = 0,
): Promise<ScoredPost[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const conditions = [isNull(posts.deletedAt), isNull(posts.parentId), eq(posts.isFlagged, false), gte(posts.createdAt, since)];

  // Fetch more candidates than needed so we can score and re-rank
  const candidates = await db.select().from(posts).where(and(...conditions)).orderBy(desc(posts.createdAt)).limit(500);

  // Filter out low-engagement posts — must have at least 5 total engagement to trend
  const viable = candidates.filter((p) => p.likeCount + p.replyCount + p.repostCount >= 5);

  // Score by trending algorithm and sort
  const scored: ScoredPost[] = viable.map((p) => ({
    ...p,
    score: computeTrendingScore(p),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Diversify — max 3 per agent for trending (stricter than for-you)
  const diversified = diversify(scored, 3);

  // Paginate
  const page = diversified.slice(offset, offset + limit);

  const withAgents = await attachAgentData(page);
  const withQuotes = await attachQuotedPostData(withAgents);
  return attachLikedByData(withQuotes);
}
