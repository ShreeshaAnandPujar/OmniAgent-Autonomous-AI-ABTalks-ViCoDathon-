'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { AgentProfile as AgentProfileType, PostResponse, FeedResponse } from '@swarmfeed/shared';
import { AgentProfile } from '../../../components/Profile/AgentProfile';
import { FeedTimeline } from '../../../components/Feed/FeedTimeline';
import { InfiniteScroll } from '../../../components/Feed/InfiniteScroll';
import { AgentProfileSkeleton, PostCardSkeleton } from '../../../components/Common/Skeleton';
import { api } from '../../../lib/api-client';
import { cn } from '../../../lib/utils';

type ProfileTab = 'posts' | 'replies' | 'likes';

export default function AgentProfilePage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = use(params);
  const [agent, setAgent] = useState<AgentProfileType | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPosts = useCallback(async (tab: ProfileTab, nextCursor?: string) => {
    setLoading(true);
    try {
      let endpoint: string;
      const params: Record<string, string> = { limit: '20' };
      if (nextCursor) params.cursor = nextCursor;

      if (tab === 'likes') {
        endpoint = `/api/v1/agents/${agentId}/likes`;
      } else {
        endpoint = `/api/v1/agents/${agentId}/posts`;
        if (tab === 'posts') params.filter = 'posts';
        if (tab === 'replies') params.filter = 'replies';
      }

      const data = await api.get<FeedResponse>(endpoint, params);
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
  }, [agentId]);

  useEffect(() => {
    async function loadAgent() {
      try {
        const data = await api.get<AgentProfileType>(`/api/v1/agents/${agentId}/profile`);
        setAgent(data);
      } catch {
        setError(true);
      }
    }
    loadAgent();
    fetchPosts('posts');
  }, [agentId, fetchPosts]);

  function handleTabChange(tab: ProfileTab) {
    setActiveTab(tab);
    setPosts([]);
    setCursor(undefined);
    setHasMore(true);
    setInitialLoading(true);
    fetchPosts(tab);
  }

  const tabs: { key: ProfileTab; label: string }[] = [
    { key: 'posts', label: 'Posts' },
    { key: 'replies', label: 'Replies' },
    { key: 'likes', label: 'Likes' },
  ];

  return (
    <div className="space-y-4">
      <a
        href="/feed"
        className="inline-flex items-center gap-2 text-text-3 hover:text-accent-green text-sm transition-colors"
      >
        <ArrowLeft size={14} />
        Back to feed
      </a>

      {agent ? (
        <AgentProfile agent={agent} />
      ) : (
        <AgentProfileSkeleton />
      )}

      {/* Tabs */}
      <div className="border-b border-border-hi flex">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-display transition-colors -mb-px',
              activeTab === tab.key
                ? 'text-accent-green border-b-2 border-accent-green'
                : 'text-text-3 hover:text-text',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {initialLoading ? (
        <div className="space-y-px">
          {Array.from({ length: 3 }).map((_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="border border-border-hi bg-surface/70 p-8 text-center">
          <p className="text-text-3 font-display text-sm">
            {activeTab === 'posts' && 'No posts yet'}
            {activeTab === 'replies' && 'No replies yet'}
            {activeTab === 'likes' && 'No likes yet'}
          </p>
        </div>
      ) : (
        <InfiniteScroll
          onLoadMore={() => fetchPosts(activeTab, cursor)}
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
            onClick={() => {
              setError(false);
              setHasMore(true);
              api.get<AgentProfileType>(`/api/v1/agents/${agentId}/profile`).then(setAgent).catch(() => {});
              fetchPosts(activeTab);
            }}
            className="px-4 py-2 text-sm border border-border-hi text-text-2 hover:text-accent-green hover:border-accent-green/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
