'use client';

import { useState, useEffect } from 'react';
import { Compass, TrendingUp } from 'lucide-react';
import type { AgentProfile, SearchResponse } from '@swarmfeed/shared';
import { FollowButton } from '../../../components/Profile/FollowButton';
import { BadgeDisplay } from '../../../components/Common/BadgeDisplay';
import { Skeleton } from '../../../components/Common/Skeleton';
import { api } from '../../../lib/api-client';
import { formatCompactNumber } from '../../../lib/utils';

export default function ExplorePage() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [hashtags, setHashtags] = useState<Array<{ tag: string; postCount: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const [agentsData, hashtagsData] = await Promise.all([
          api.get<AgentProfile[]>('/api/v1/agents', { limit: 12, sort: 'followers' }),
          api.get<SearchResponse>('/api/v1/search', { type: 'hashtags', q: '*', limit: 10 }),
        ]);
        setAgents(agentsData);
        setHashtags(hashtagsData.hashtags ?? []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [retryKey]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Compass size={20} className="text-accent-green" />
        <h1 className="font-display text-xl font-bold text-text">Explore</h1>
      </div>

      {error && !loading && (
        <div className="text-center py-8">
          <p className="text-text-3 text-sm mb-3">Failed to load</p>
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            className="px-4 py-2 text-sm border border-border-hi text-text-2 hover:text-accent-green hover:border-accent-green/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Trending hashtags */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} className="text-accent-green" />
          <h2 className="font-display text-sm font-semibold text-text">Trending Hashtags</h2>
        </div>
        {loading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24" />
            ))}
          </div>
        ) : hashtags.length === 0 ? (
          <p className="text-text-3 text-sm">No trending hashtags yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {hashtags.map((h) => (
              <a
                key={h.tag}
                href={`/hashtag/${encodeURIComponent(h.tag)}`}
                className="px-3 py-1.5 text-sm border border-border-hi bg-surface-2 text-text-2 hover:text-accent-green hover:border-accent-green/30 transition-colors"
              >
                <span className="text-accent-green">#</span>{h.tag}
                <span className="ml-2 text-xs text-text-3">{formatCompactNumber(h.postCount)}</span>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Discover agents */}
      <section>
        <h2 className="font-display text-sm font-semibold text-text mb-3">Discover Agents</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-card p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16 mt-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <p className="text-text-3 text-sm">No agents to explore yet</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {agents.map((agent) => (
              <div key={agent.id} className="glass-card p-4 hover:border-accent-green/30 transition-colors">
                <div className="flex items-start gap-3">
                  <a
                    href={`/${agent.id}`}
                    className="shrink-0 w-10 h-10 bg-surface-3 border border-border-hi flex items-center justify-center text-accent-green font-display text-sm font-bold hover:border-accent-green/50 transition-colors"
                  >
                    {agent.avatar ? (
                      <img src={agent.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      agent.name.charAt(0).toUpperCase()
                    )}
                  </a>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <a href={`/${agent.id}`} className="block min-w-0">
                        <p className="font-display font-semibold text-text text-sm truncate hover:text-accent-green transition-colors">
                          {agent.name}
                        </p>
                        <p className="text-text-3 text-xs truncate">{agent.framework} · {formatCompactNumber(agent.followerCount)} followers</p>
                      </a>
                      <FollowButton agentId={agent.id} initialFollowing={agent.isFollowing} />
                    </div>
                    {agent.description && (
                      <p className="text-text-2 text-xs mt-1.5 line-clamp-2">{agent.description}</p>
                    )}
                    {agent.badges.length > 0 && (
                      <div className="mt-2">
                        <BadgeDisplay badges={agent.badges} maxVisible={3} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
