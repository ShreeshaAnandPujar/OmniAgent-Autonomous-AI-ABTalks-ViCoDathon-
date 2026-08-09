import type { AgentProfile as AgentProfileType } from '@swarmfeed/shared';
import { BadgeDisplay } from '../Common/BadgeDisplay';
import { FollowButton } from './FollowButton';
import { formatCompactNumber } from '../../lib/utils';

interface AgentProfileProps {
  agent: AgentProfileType;
}

export function AgentProfile({ agent }: AgentProfileProps) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="shrink-0 w-16 h-16 bg-surface-3 border border-border-hi flex items-center justify-center text-accent-green font-display text-2xl font-bold">
          {agent.avatar ? (
            <img src={agent.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            agent.name.charAt(0).toUpperCase()
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-bold text-text">{agent.name}</h1>
              <p className="text-text-3 text-sm">@{agent.id}</p>
            </div>
            <FollowButton agentId={agent.id} initialFollowing={agent.isFollowing} />
          </div>

          {agent.description && (
            <p className="text-text-2 text-sm mt-3 leading-relaxed">{agent.description}</p>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="text-xs text-text-3 border border-border-hi bg-surface-2 px-2 py-0.5">
              {agent.framework}
            </span>
            <span className="text-xs text-text-3 border border-border-hi bg-surface-2 px-2 py-0.5">
              {agent.model}
            </span>
            <span className="text-xs text-text-3 border border-border-hi bg-surface-2 px-2 py-0.5">
              trust: {agent.trustLevel}
            </span>
          </div>

          {/* Badges */}
          {agent.badges.length > 0 && (
            <div className="mt-3">
              <BadgeDisplay badges={agent.badges} />
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 mt-6 pt-4 border-t border-border-hi/40">
        <StatItem label="Posts" value={agent.postCount} />
        <StatItem label="Followers" value={agent.followerCount} href={`/${agent.id}/followers`} />
        <StatItem label="Following" value={agent.followingCount} href={`/${agent.id}/following`} />
        <StatItem label="Tips" value={agent.totalTipsReceived} prefix="$" />
      </div>
    </div>
  );
}

function StatItem({ label, value, prefix, href }: { label: string; value: number; prefix?: string; href?: string }) {
  const inner = (
    <>
      <p className="text-text font-display font-bold text-sm">
        {prefix}{formatCompactNumber(value)}
      </p>
      <p className="text-text-3 text-xs mt-0.5">{label}</p>
    </>
  );

  if (href) {
    return (
      <a href={href} className="text-center hover:text-accent-green transition-colors">
        {inner}
      </a>
    );
  }

  return <div className="text-center">{inner}</div>;
}
