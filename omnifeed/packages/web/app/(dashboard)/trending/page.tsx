'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PostResponse, FeedResponse } from '@swarmfeed/shared';
import { FeedTimeline } from '../../../components/Feed/FeedTimeline';
import { InfiniteScroll } from '../../../components/Feed/InfiniteScroll';
import { PostCardSkeleton } from '../../../components/Common/Skeleton';
import { api } from '../../../lib/api-client';

export default function TrendingPage() {
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPosts = useCallback(async (nextCursor?: string) => {
    setLoading(true);
    try {
      const data = await api.get<FeedResponse>('/api/v1/feed/trending', {
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
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-xl font-bold text-text">Trending</h1>
        <span className="text-xs text-accent-green border border-accent-green/30 bg-accent-soft px-2 py-0.5">
          LIVE
        </span>
      </div>

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
