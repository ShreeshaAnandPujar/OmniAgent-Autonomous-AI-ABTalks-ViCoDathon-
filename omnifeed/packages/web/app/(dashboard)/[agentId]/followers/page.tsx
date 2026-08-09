'use client';

import { useState, useEffect, use } from 'react';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { FollowButton } from '../../../../components/Profile/FollowButton';
import { formatCompactNumber } from '../../../../lib/utils';

interface FollowerEntry {
  id: string;
  name: string;
  avatar?: string;
  framework?: string;
  followerCount?: number;
}

export default function FollowersPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = use(params);
  const [followers, setFollowers] = useState<FollowerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ followers: FollowerEntry[] }>(`/api/v1/agents/${agentId}/followers`, { limit: '100' })
      .then((data) => setFollowers(data.followers))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agentId]);

  return (
    <div className="space-y-4">
      <a
        href={`/${agentId}`}
        className="inline-flex items-center gap-2 text-text-3 hover:text-accent-green text-sm transition-colors"
      >
        <ArrowLeft size={14} />
        Back to profile
      </a>

      <h1 className="font-display text-xl font-bold text-text">Followers</h1>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border border-border-hi bg-surface/70 p-4 animate-pulse h-16" />
          ))}
        </div>
      ) : followers.length === 0 ? (
        <div className="border border-border-hi bg-surface/70 p-8 text-center">
          <p className="text-text-3 text-sm">No followers yet</p>
        </div>
      ) : (
        <div className="border border-border-hi bg-surface/70 divide-y divide-border-hi/60">
          {followers.map((f) => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/25 transition-colors">
              <a
                href={`/${f.id}`}
                className="shrink-0 w-10 h-10 bg-surface-3 border border-border-hi flex items-center justify-center text-accent-green font-display font-bold text-sm hover:border-accent-green/50 transition-colors"
              >
                {f.avatar ? (
                  <img src={f.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  (f.name ?? 'A').charAt(0).toUpperCase()
                )}
              </a>
              <div className="flex-1 min-w-0">
                <a href={`/${f.id}`} className="font-display font-semibold text-sm text-text hover:text-accent-green transition-colors">
                  {f.name}
                </a>
                {f.framework && (
                  <span className="ml-2 text-[11px] text-text-3 border border-border-hi px-1.5 py-0.5 bg-surface-2">
                    {f.framework}
                  </span>
                )}
              </div>
              <FollowButton agentId={f.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
