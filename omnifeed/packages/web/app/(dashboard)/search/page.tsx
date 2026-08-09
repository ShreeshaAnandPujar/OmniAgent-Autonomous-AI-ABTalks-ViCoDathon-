'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search as SearchIcon } from 'lucide-react';
import type { SearchResponse, SearchType } from '@swarmfeed/shared';
import { FeedTimeline } from '../../../components/Feed/FeedTimeline';
import { ChannelList } from '../../../components/Channels/ChannelList';
import { PostCardSkeleton } from '../../../components/Common/Skeleton';
import { api } from '../../../lib/api-client';
import { cn } from '../../../lib/utils';

const TABS: { value: SearchType; label: string }[] = [
  { value: 'posts', label: 'Posts' },
  { value: 'agents', label: 'Agents' },
  { value: 'channels', label: 'Channels' },
];

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<SearchType>('posts');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery, 'posts');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  async function performSearch(q: string, type: SearchType = activeTab) {
    if (!q.trim()) return;
    setLoading(true);
    setError(false);
    try {
      const data = await api.get<SearchResponse>('/api/v1/search', {
        q: q.trim(),
        type,
        limit: 20,
      });
      setResults(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    performSearch(query);
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-text">Search</h1>

      {/* Search input */}
      <form onSubmit={handleSubmit} className="relative">
        <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search agents, posts, channels..."
          className="w-full pl-10 pr-4 py-3 text-sm bg-bg border border-border-hi focus:border-border-focus"
        />
      </form>

      {/* Tabs */}
      <div className="flex items-center gap-px border-b border-border-hi">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setActiveTab(tab.value);
              if (query.trim()) performSearch(query, tab.value);
            }}
            className={cn(
              'px-4 py-2.5 text-sm font-display transition-colors border-b-2 -mb-px',
              activeTab === tab.value
                ? 'text-accent-green border-accent-green'
                : 'text-text-3 border-transparent hover:text-text',
            )}
          >
            {tab.label}
            {results && (
              <span className="ml-1.5 text-xs text-text-3">
                {activeTab === 'posts' && results.posts?.length}
                {activeTab === 'agents' && results.agents?.length}
                {activeTab === 'channels' && results.channels?.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Results */}
      {error && !loading ? (
        <div className="text-center py-8">
          <p className="text-text-3 text-sm mb-3">Failed to load</p>
          <button
            onClick={() => performSearch(query)}
            className="px-4 py-2 text-sm border border-border-hi text-text-2 hover:text-accent-green hover:border-accent-green/30 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-px">
          {Array.from({ length: 3 }).map((_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      ) : results ? (
        <div>
          {activeTab === 'posts' && results.posts && (
            <FeedTimeline posts={results.posts} />
          )}

          {activeTab === 'agents' && results.agents && (
            <div className="space-y-2">
              {results.agents.length === 0 ? (
                <p className="text-text-3 text-sm text-center py-8">No agents found</p>
              ) : (
                results.agents.map((agent) => (
                  <a
                    key={agent.id}
                    href={`/${agent.id}`}
                    className="glass-card p-4 flex items-center gap-3 hover:border-accent-green/30 transition-colors block"
                  >
                    <div className="w-10 h-10 bg-surface-3 border border-border-hi flex items-center justify-center text-accent-green font-display text-sm font-bold shrink-0">
                      {agent.avatar ? (
                        <img src={agent.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        agent.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-semibold text-text text-sm truncate">{agent.name}</p>
                      <p className="text-text-3 text-xs truncate">{agent.description}</p>
                    </div>
                    <span className="text-xs text-text-3 shrink-0">{agent.followerCount} followers</span>
                  </a>
                ))
              )}
            </div>
          )}

          {activeTab === 'channels' && results.channels && (
            <ChannelList channels={results.channels} />
          )}
        </div>
      ) : (
        <div className="glass-card p-8 text-center">
          <p className="text-text-3 font-display text-sm">Enter a query to search</p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <h1 className="font-display text-xl font-bold text-text">Search</h1>
          <div className="space-y-px">
            {Array.from({ length: 3 }).map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
