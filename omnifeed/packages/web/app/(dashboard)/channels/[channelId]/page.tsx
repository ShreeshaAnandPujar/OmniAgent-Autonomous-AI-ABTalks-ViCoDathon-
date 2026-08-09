'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { Hash, Users, ArrowLeft } from 'lucide-react';
import type { PostResponse, FeedResponse, ChannelResponse } from '@swarmfeed/shared';
import { PostComposer } from '../../../../components/Feed/PostComposer';
import { FeedTimeline } from '../../../../components/Feed/FeedTimeline';
import { InfiniteScroll } from '../../../../components/Feed/InfiniteScroll';
import { PostCardSkeleton, Skeleton } from '../../../../components/Common/Skeleton';
import { api } from '../../../../lib/api-client';
import { formatCompactNumber } from '../../../../lib/utils';

export default function ChannelFeedPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = use(params);
  const [channel, setChannel] = useState<ChannelResponse | null>(null);
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPosts = useCallback(async (nextCursor?: string) => {
    setLoading(true);
    try {
      const data = await api.get<FeedResponse>(`/api/v1/feed/channel/${channelId}`, {
        cursor: nextCursor,
        limit: 20,
      });
      setPosts((prev) => nextCursor ? [...prev, ...data.posts] : data.posts);
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch {
      setHasMore(false);
      setError(true);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    async function loadChannel() {
      try {
        const data = await api.get<ChannelResponse>(`/api/v1/channels/${channelId}`);
        setChannel(data);
      } catch {
        // silently fail
      }
    }
    loadChannel();
    fetchPosts();
  }, [channelId, fetchPosts]);

  function handleNewPost(post: PostResponse) {
    setPosts((prev) => [post, ...prev]);
  }

  return (
    <div className="space-y-4">
      {/* Back link */}
      <a
        href="/channels"
        className="inline-flex items-center gap-2 text-text-3 hover:text-accent-green text-sm transition-colors"
      >
        <ArrowLeft size={14} />
        All channels
      </a>

      {/* Channel header */}
      {channel ? (
        <div className="glass-card p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-accent-soft flex items-center justify-center shrink-0">
              <Hash size={18} className="text-accent-green" />
            </div>
            <div className="flex-1">
              <h1 className="font-display text-lg font-bold text-text">
                #{channel.handle}
              </h1>
              {channel.description && (
                <p className="text-text-2 text-sm mt-1">{channel.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3 text-xs text-text-3">
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  {formatCompactNumber(channel.memberCount)} members
                </span>
                <span>{formatCompactNumber(channel.postCount)} posts</span>
                {channel.isModerated && (
                  <span className="border border-border-hi bg-surface-2 px-1.5 py-0.5">
                    moderated
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="w-10 h-10" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        </div>
      )}

      <PostComposer
        channels={channel ? [channel] : []}
        onPostCreated={handleNewPost}
      />

      {initialLoading ? (
        <div className="space-y-px">
          {Array.from({ length: 5 }).map((_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <InfiniteScroll
          onLoadMore={() => fetchPosts(cursor)}
          hasMore={hasMore}
          loading={loading}
        >
          <FeedTimeline posts={posts} />
        </InfiniteScroll>
      )}

      {error && (
        <div className="text-center py-8">
          <p className="text-text-3 text-sm mb-3">Failed to load</p>
          <button
            onClick={() => { setError(false); setHasMore(true); fetchPosts(); }}
            className="px-4 py-2 text-sm border border-border-hi text-text-2 hover:text-accent-green hover:border-accent-green/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
