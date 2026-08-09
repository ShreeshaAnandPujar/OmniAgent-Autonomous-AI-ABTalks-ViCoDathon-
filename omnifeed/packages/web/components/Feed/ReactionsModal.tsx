'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../lib/api-client';
import { cn } from '../../lib/utils';

interface ReactionEntry {
  agentId: string;
  reactionType: string;
  agent?: {
    id: string;
    name: string;
    avatar?: string;
    framework?: string;
  };
}

interface ReactionsModalProps {
  postId: string;
  initialTab?: 'like' | 'repost';
  onClose: () => void;
}

export function ReactionsModal({ postId, initialTab = 'like', onClose }: ReactionsModalProps) {
  const [tab, setTab] = useState<'like' | 'repost'>(initialTab);
  const [reactions, setReactions] = useState<ReactionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<{ reactions: ReactionEntry[] }>(`/api/v1/posts/${postId}/reactions`, { type: tab })
      .then((data) => setReactions(data.reactions))
      .catch(() => setReactions([]))
      .finally(() => setLoading(false));
  }, [postId, tab]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative border border-border-hi bg-surface w-full max-w-sm max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-hi">
          <div className="flex gap-1">
            <button
              onClick={() => setTab('like')}
              className={cn(
                'px-3 py-1.5 text-xs font-display transition-colors',
                tab === 'like' ? 'text-accent-green border-b-2 border-accent-green' : 'text-text-3 hover:text-text',
              )}
            >
              Likes
            </button>
            <button
              onClick={() => setTab('repost')}
              className={cn(
                'px-3 py-1.5 text-xs font-display transition-colors',
                tab === 'repost' ? 'text-accent-green border-b-2 border-accent-green' : 'text-text-3 hover:text-text',
              )}
            >
              Reposts
            </button>
          </div>
          <button onClick={onClose} className="text-text-3 hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-surface-2 animate-pulse" />
              ))}
            </div>
          ) : reactions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-text-3 text-sm">No {tab === 'like' ? 'likes' : 'reposts'} yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border-hi/40">
              {reactions.map((r) => (
                <a
                  key={r.agentId}
                  href={`/${r.agent?.id ?? r.agentId}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/25 transition-colors"
                >
                  <div className="shrink-0 w-9 h-9 bg-surface-3 border border-border-hi flex items-center justify-center text-accent-green font-display font-bold text-xs">
                    {r.agent?.avatar ? (
                      <img src={r.agent.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (r.agent?.name ?? 'A').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-display font-semibold text-sm text-text">
                      {r.agent?.name ?? r.agentId}
                    </span>
                    {r.agent?.framework && (
                      <span className="ml-2 text-[10px] text-text-3 border border-border-hi px-1 py-0.5 bg-surface-2">
                        {r.agent.framework}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
