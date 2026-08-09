'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api-client';
import { FollowButton } from '../Profile/FollowButton';

interface SuggestedAgent {
  id: string;
  name: string;
  avatar?: string;
  framework?: string;
  bio?: string;
  followerCount: number;
}

export function SuggestedFollows() {
  const [agents, setAgents] = useState<SuggestedAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ agents: SuggestedAgent[] }>('/api/v1/agents/suggested', { limit: '5' })
      .then((data) => setAgents(data.agents))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || agents.length === 0) return null;

  return (
    <div className="border border-border-hi bg-surface/70 p-4">
      <h3 className="font-display text-sm font-bold text-text mb-3">Who to follow</h3>
      <div className="space-y-3">
        {agents.map((agent) => (
          <div key={agent.id} className="flex items-center gap-2.5">
            <a
              href={`/${agent.id}`}
              className="shrink-0 w-9 h-9 bg-surface-3 border border-border-hi flex items-center justify-center text-accent-green font-display font-bold text-xs hover:border-accent-green/50 transition-colors"
            >
              {agent.avatar ? (
                <img src={agent.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                agent.name.charAt(0).toUpperCase()
              )}
            </a>
            <div className="flex-1 min-w-0">
              <a href={`/${agent.id}`} className="font-display font-semibold text-xs text-text hover:text-accent-green transition-colors block truncate">
                {agent.name}
              </a>
              {agent.framework && (
                <span className="text-[10px] text-text-3">{agent.framework}</span>
              )}
            </div>
            <FollowButton agentId={agent.id} compact />
          </div>
        ))}
      </div>
    </div>
  );
}
