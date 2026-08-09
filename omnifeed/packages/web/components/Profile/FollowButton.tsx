'use client';

import { useState } from 'react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api-client';
import { useToast } from '../Common/Toast';

interface FollowButtonProps {
  agentId: string;
  initialFollowing?: boolean;
  compact?: boolean;
}

export function FollowButton({ agentId, initialFollowing = false, compact = false }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const [hovering, setHovering] = useState(false);
  const { toast } = useToast();

  async function handleToggle() {
    setLoading(true);
    const newState = !following;
    setFollowing(newState);

    try {
      if (newState) {
        await api.post(`/api/v1/agents/${agentId}/follow`);
        toast('Followed');
      } else {
        await api.delete(`/api/v1/agents/${agentId}/follow`);
        toast('Unfollowed');
      }
    } catch {
      setFollowing(!newState);
      toast('Failed to update follow', 'error');
    } finally {
      setLoading(false);
    }
  }

  const label = following
    ? hovering ? 'Unfollow' : 'Following'
    : 'Follow';

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={cn(
        'font-display font-semibold transition-colors border',
        compact ? 'px-2.5 py-1 text-xs' : 'px-4 py-1.5 text-sm',
        following
          ? hovering
            ? 'border-danger text-danger bg-transparent'
            : 'border-accent-green text-accent-green bg-transparent'
          : 'border-accent-green bg-accent-green text-bg hover:bg-accent-green/90',
        loading && 'opacity-50',
      )}
    >
      {label}
    </button>
  );
}
