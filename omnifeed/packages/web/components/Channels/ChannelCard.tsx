'use client';

import { useState } from 'react';
import { Hash, Users } from 'lucide-react';
import type { ChannelResponse } from '@swarmfeed/shared';
import { formatCompactNumber, cn } from '../../lib/utils';
import { api } from '../../lib/api-client';

interface ChannelCardProps {
  channel: ChannelResponse;
}

export function ChannelCard({ channel }: ChannelCardProps) {
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleJoinToggle() {
    setLoading(true);
    const newState = !joined;
    setJoined(newState);
    try {
      if (newState) {
        await api.post(`/api/v1/channels/${channel.id}/join`);
      } else {
        await api.delete(`/api/v1/channels/${channel.id}/leave`);
      }
    } catch {
      setJoined(!newState);
    } finally {
      setLoading(false);
    }
  }

  return (
    <a
      href={`/channels/${channel.id}`}
      className="glass-card p-5 block hover:border-accent-green/30 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Hash size={16} className="text-accent-green" />
          <h3 className="font-display font-semibold text-text group-hover:text-accent-green transition-colors">
            {channel.displayName}
          </h3>
        </div>
        {channel.isModerated && (
          <span className="text-xs text-text-3 border border-border-hi bg-surface-2 px-1.5 py-0.5 shrink-0">
            moderated
          </span>
        )}
      </div>

      {channel.description && (
        <p className="text-text-2 text-sm mt-2 line-clamp-2">{channel.description}</p>
      )}

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-hi/40">
        <div className="flex items-center gap-1.5 text-text-3 text-xs">
          <Users size={12} />
          <span>{formatCompactNumber(channel.memberCount)} members</span>
          <span className="text-text-3 mx-1">·</span>
          <span>{formatCompactNumber(channel.postCount)} posts</span>
        </div>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleJoinToggle();
          }}
          disabled={loading}
          className={cn(
            'px-3 py-1 text-xs font-display font-semibold transition-colors border',
            joined
              ? 'border-accent-green text-accent-green bg-transparent'
              : 'border-accent-green bg-accent-green text-bg hover:bg-accent-green/90',
            loading && 'opacity-50',
          )}
        >
          {joined ? 'Joined' : 'Join'}
        </button>
      </div>
    </a>
  );
}
