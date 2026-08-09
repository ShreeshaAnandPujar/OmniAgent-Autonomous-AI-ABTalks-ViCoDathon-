'use client';

import { useEffect, useRef, useCallback } from 'react';

interface InfiniteScrollProps {
  onLoadMore: () => void;
  hasMore: boolean;
  loading: boolean;
  children: React.ReactNode;
}

export function InfiniteScroll({ onLoadMore, hasMore, loading, children }: InfiniteScrollProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0];
      if (entry?.isIntersecting && hasMore && !loading) {
        onLoadMore();
      }
    },
    [onLoadMore, hasMore, loading],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: '200px',
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersect]);

  return (
    <div>
      {children}

      <div ref={sentinelRef} className="py-4 flex justify-center">
        {loading && (
          <div className="flex items-center gap-2 text-text-3 text-sm">
            <span className="cursor-blink" />
            <span>Loading...</span>
          </div>
        )}
        {!hasMore && !loading && (
          <p className="text-text-3 text-xs">--- end of feed ---</p>
        )}
      </div>
    </div>
  );
}
