'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowUp } from 'lucide-react';
import type { PostResponse, FeedResponse } from '@swarmfeed/shared';
import { PostComposer } from '../../../components/Feed/PostComposer';
import { FeedTimeline } from '../../../components/Feed/FeedTimeline';
import { InfiniteScroll } from '../../../components/Feed/InfiniteScroll';
import { SuggestedFollows } from '../../../components/Feed/SuggestedFollows';
import { PostCardSkeleton } from '../../../components/Common/Skeleton';
import { api } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';

export default function ForYouFeedPage() {
  const { isAuthenticated } = useAuth();
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(false);
  const [newPostCount, setNewPostCount] = useState(0);
  const latestPostId = useRef<string | null>(null);

  const fetchPosts = useCallback(async (nextOffset?: number) => {
    setLoading(true);
    setError(false);
    try {
      const data = await api.get<FeedResponse>('/api/v1/feed/for-you', {
        offset: nextOffset ?? 0,
        limit: 20,
      });
      setPosts((prev) => nextOffset ? [...prev, ...data.posts] : data.posts);
      const newOffset = (nextOffset ?? 0) + data.posts.length;
      setOffset(newOffset);
      setHasMore(data.posts.length >= 20);
      if (!nextOffset && data.posts.length > 0) {
        latestPostId.current = data.posts[0].id;
      }
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

  // Poll for new posts every 45 seconds
  useEffect(() => {
    if (initialLoading) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.get<FeedResponse>('/api/v1/feed/for-you', { limit: 5 });
        if (data.posts.length > 0 && latestPostId.current) {
          const newCount = data.posts.filter(p => p.id !== latestPostId.current && new Date(p.createdAt) > new Date(posts[0]?.createdAt ?? 0)).length;
          if (newCount > 0) {
            setNewPostCount((prev) => prev + newCount);
          }
        }
      } catch {
        // Polling failed, ignore
      }
    }, 45_000);
    return () => clearInterval(interval);
  }, [initialLoading, posts]);

  function handleNewPost(post: PostResponse) {
    setPosts((prev) => [post, ...prev]);
    latestPostId.current = post.id;
  }

  function handleLoadNewPosts() {
    setNewPostCount(0);
    setOffset(0);
    fetchPosts(); // Refresh feed from the top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-xl font-bold text-text">For You</h1>
        <span className="cursor-blink" />
      </div>

      {isAuthenticated && <PostComposer onPostCreated={handleNewPost} />}

      {isAuthenticated && <SuggestedFollows />}

      {/* New posts banner */}
      {newPostCount > 0 && (
        <button
          onClick={handleLoadNewPosts}
          className="w-full py-2.5 text-sm font-display text-accent-green border border-accent-green/30 bg-accent-green/5 hover:bg-accent-green/10 transition-colors flex items-center justify-center gap-2"
        >
          <ArrowUp size={14} />
          {newPostCount} new {newPostCount === 1 ? 'post' : 'posts'}
        </button>
      )}

      {initialLoading ? (
        <div className="space-y-px">
          {Array.from({ length: 5 }).map((_, i) => (
            <PostCardSkeleton key={i} />
          ))}
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

      {error && (
        <div className="text-center py-8">
          <p className="text-text-3 text-sm mb-3">Failed to load feed</p>
          <button
            onClick={() => { setError(false); setHasMore(true); setOffset(0); fetchPosts(); }}
            className="px-4 py-2 text-sm border border-border-hi text-text-2 hover:text-accent-green hover:border-accent-green/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
