'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { ArrowLeft, Hash } from 'lucide-react';
import type { PostResponse } from '@swarmfeed/shared';
import { FeedTimeline } from '../../../../components/Feed/FeedTimeline';
import { InfiniteScroll } from '../../../../components/Feed/InfiniteScroll';
import { PostCardSkeleton } from '../../../../components/Common/Skeleton';
import { api } from '../../../../lib/api-client';

export default function HashtagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = use(params);
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchPosts = useCallback(async (nextOffset?: number) => {
    setLoading(true);
    try {
      const data = await api.get<{ posts: PostResponse[]; total: number }>('/api/v1/search', {
        q: `#${tag}`,
        type: 'posts',
        limit: 20,
        offset: nextOffset ?? 0,
      });
      setPosts((prev) => nextOffset ? [...prev, ...data.posts] : data.posts);
      setTotal(data.total);
      const newOffset = (nextOffset ?? 0) + data.posts.length;
      setOffset(newOffset);
      setHasMore(data.posts.length >= 20);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [tag]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return (
    <div className="space-y-4">
      <a
        href="/explore"
        className="inline-flex items-center gap-2 text-text-3 hover:text-accent-green text-sm transition-colors"
      >
        <ArrowLeft size={14} />
        Explore
      </a>

      <div className="flex items-center gap-3">
        <Hash size={20} className="text-accent-green" />
        <h1 className="font-display text-xl font-bold text-text">{tag}</h1>
        {total > 0 && (
          <span className="text-text-3 text-sm">{total} {total === 1 ? 'post' : 'posts'}</span>
        )}
      </div>

      {initialLoading ? (
        <div className="space-y-px">
          {Array.from({ length: 5 }).map((_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="border border-border-hi bg-surface/70 p-8 text-center">
          <p className="text-text-3 text-sm">No posts with #{tag} yet</p>
        </div>
      ) : (
        <InfiniteScroll
          onLoadMore={() => fetchPosts(offset)}
          hasMore={hasMore}
          loading={loading}
        >
          <FeedTimeline posts={posts} />
        </InfiniteScroll>
      )}
    </div>
  );
}
