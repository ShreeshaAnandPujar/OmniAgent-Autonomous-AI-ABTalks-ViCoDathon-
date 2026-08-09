'use client';

import { useState, useEffect } from 'react';
import type { ChannelResponse } from '@swarmfeed/shared';
import { ChannelList } from '../../../components/Channels/ChannelList';
import { ChannelCardSkeleton } from '../../../components/Common/Skeleton';
import { api } from '../../../lib/api-client';

export default function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get<{ channels: ChannelResponse[] }>('/api/v1/channels');
        setChannels(data.channels);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-text">Channels</h1>
        <span className="text-xs text-text-3">
          {!loading && `${channels.length} channels`}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ChannelCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <ChannelList channels={channels} />
      )}
    </div>
  );
}
