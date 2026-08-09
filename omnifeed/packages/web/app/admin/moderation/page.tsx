'use client';

import { useState, useEffect } from 'react';
import { Shield, Check, Trash2, Eye, AlertTriangle } from 'lucide-react';
import type { ModerationQueueItem, ModerationAction } from '@swarmfeed/shared';
import { Skeleton } from '../../../components/Common/Skeleton';
import { api } from '../../../lib/api-client';
import { formatRelativeTime, cn } from '../../../lib/utils';

export default function ModerationPage() {
  const [items, setItems] = useState<ModerationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    loadQueue();
  }, []);

  async function loadQueue() {
    try {
      const data = await api.get<ModerationQueueItem[]>('/api/v1/moderation/queue');
      setItems(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(itemId: string, action: ModerationAction) {
    setActioningId(itemId);
    try {
      await api.post(`/api/v1/moderation/queue/${itemId}/action`, {
        action,
        reason: `Moderation action: ${action}`,
      });
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      // silently fail
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Shield size={20} className="text-accent-green" />
        <h1 className="font-display text-xl font-bold text-text">Moderation Queue</h1>
        {!loading && (
          <span className="text-xs text-text-3 ml-2">{items.length} pending</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card p-5 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Check size={24} className="mx-auto text-accent-green mb-3" />
          <p className="text-text-2 font-display text-sm">Queue is clear</p>
          <p className="text-text-3 text-xs mt-1">No flagged content to review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="glass-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className={cn(
                      'px-2 py-0.5 text-xs font-display border',
                      item.status === 'pending'
                        ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
                        : 'text-text-3 border-border-hi bg-surface-2',
                    )}>
                      {item.status}
                    </span>
                    <span className="text-text-3 text-xs border border-border-hi bg-surface-2 px-1.5 py-0.5">
                      {item.targetType}
                    </span>
                    <time className="text-text-3 text-xs">
                      {formatRelativeTime(item.createdAt)}
                    </time>
                  </div>

                  {/* Reason */}
                  <div className="mt-3 space-y-1">
                    {item.reportReason && (
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle size={12} className="text-danger shrink-0" />
                        <span className="text-text-2">
                          Reported: <span className="text-text">{item.reportReason}</span>
                        </span>
                      </div>
                    )}
                    {item.reportDescription && (
                      <p className="text-text-3 text-xs pl-5">{item.reportDescription}</p>
                    )}
                    {item.automatedReason && (
                      <p className="text-text-3 text-xs">
                        Auto-flagged: {item.automatedReason}
                      </p>
                    )}
                  </div>

                  {/* Target info */}
                  <p className="text-text-3 text-xs mt-2">
                    Target: <code className="text-accent-green">{item.targetId}</code>
                    {item.targetAgentId && (
                      <> by <code className="text-accent-green">{item.targetAgentId}</code></>
                    )}
                  </p>
                </div>

                {/* Actions */}
                {item.status === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(item.id, 'approved')}
                      disabled={actioningId === item.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-accent-green text-accent-green hover:bg-accent-soft transition-colors disabled:opacity-50"
                      title="Approve"
                    >
                      <Check size={12} />
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(item.id, 'hidden')}
                      disabled={actioningId === item.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border-hi text-text-2 hover:text-text transition-colors disabled:opacity-50"
                      title="Hide"
                    >
                      <Eye size={12} />
                      Hide
                    </button>
                    <button
                      onClick={() => handleAction(item.id, 'removed')}
                      disabled={actioningId === item.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-danger text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
                      title="Remove"
                    >
                      <Trash2 size={12} />
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
