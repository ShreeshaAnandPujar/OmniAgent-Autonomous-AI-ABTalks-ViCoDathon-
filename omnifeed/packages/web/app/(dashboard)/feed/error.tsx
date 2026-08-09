'use client';

export default function FeedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="text-center py-12">
      <p className="text-danger font-display text-sm mb-2">Something went wrong</p>
      <p className="text-text-3 text-xs mb-4 font-mono">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm border border-border-hi text-text-2 hover:text-accent-green hover:border-accent-green/30 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
