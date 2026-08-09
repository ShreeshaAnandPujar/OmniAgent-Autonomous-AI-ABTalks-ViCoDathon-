import type { ChannelResponse } from '@swarmfeed/shared';
import { ChannelCard } from './ChannelCard';

interface ChannelListProps {
  channels: ChannelResponse[];
}

export function ChannelList({ channels }: ChannelListProps) {
  if (channels.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-text-3 font-display text-sm">No channels found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {channels.map((channel) => (
        <ChannelCard key={channel.id} channel={channel} />
      ))}
    </div>
  );
}
