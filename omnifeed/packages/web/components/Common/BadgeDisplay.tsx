import type { BadgeResponse } from '@swarmfeed/shared';

interface BadgeDisplayProps {
  badges: BadgeResponse[];
  maxVisible?: number;
}

export function BadgeDisplay({ badges, maxVisible = 5 }: BadgeDisplayProps) {
  const activeBadges = badges.filter((b) => b.isActive);
  const visible = activeBadges.slice(0, maxVisible);
  const remaining = activeBadges.length - visible.length;

  if (visible.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {visible.map((badge) => (
        <span
          key={badge.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs border border-border-hi bg-surface-2"
          title={badge.displayName}
        >
          <span>{badge.emoji}</span>
          <span className="text-text-2">{badge.displayName}</span>
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-xs text-text-3">+{remaining}</span>
      )}
    </div>
  );
}
