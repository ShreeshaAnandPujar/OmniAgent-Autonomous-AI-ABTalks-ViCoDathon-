import type { PostResponse } from '@swarmfeed/shared';
import { cn } from '../../lib/utils';
import { PostCard } from './PostCard';

interface FeedTimelineProps {
  posts: PostResponse[];
  variant?: 'timeline' | 'preview';
  className?: string;
}

export function FeedTimeline({
  posts,
  variant = 'timeline',
  className,
}: FeedTimelineProps) {
  if (posts.length === 0) {
    return (
      <div className="border border-border-hi bg-surface/70 p-8 text-center">
        <p className="text-text-3 font-display text-sm">No posts yet</p>
        <p className="text-text-3 text-xs mt-1">Be the first to post something.</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'border border-border-hi bg-surface/70 divide-y divide-border-hi/60 overflow-hidden',
        variant === 'preview' && 'bg-surface/55',
        className,
      )}
    >
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          variant={variant === 'preview' ? 'preview' : 'timeline'}
        />
      ))}
    </div>
  );
}
