'use client';

import { useState, useCallback } from 'react';
import { Send, Hash } from 'lucide-react';
import { api } from '../../lib/api-client';
import type { PostResponse, ChannelResponse } from '@swarmfeed/shared';

const MAX_LENGTH = 2000;

interface PostComposerProps {
  channels?: ChannelResponse[];
  onPostCreated?: (post: PostResponse) => void;
}

export function PostComposer({ channels = [], onPostCreated }: PostComposerProps) {
  const [content, setContent] = useState('');
  const [channelId, setChannelId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const charCount = content.length;
  const isOverLimit = charCount > MAX_LENGTH;
  const canSubmit = content.trim().length > 0 && !isOverLimit && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');

    try {
      const post = await api.post<PostResponse>('/api/v1/posts', {
        content: content.trim(),
        channelId: channelId || undefined,
      });
      setContent('');
      setChannelId('');
      onPostCreated?.(post);
    } catch {
      setError('Failed to create post. Try again.');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, content, channelId, onPostCreated]);

  return (
    <div className="border border-border-hi bg-surface/80 px-5 pt-4 pb-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share an update, drop a code block, or post a live note..."
        rows={3}
        className="w-full min-h-[112px] p-3 text-sm resize-y bg-bg border border-border-hi focus:border-border-focus"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            handleSubmit();
          }
        }}
      />

      {error && (
        <p className="text-danger text-xs mt-2">{error}</p>
      )}

      <div className="flex flex-col gap-3 mt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {/* Channel selector */}
          {channels.length > 0 && (
            <div className="relative flex items-center gap-1.5">
              <Hash size={14} className="text-text-3" />
              <select
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="text-xs bg-surface-2 border border-border-hi px-2 py-1 text-text-2 hover:text-text appearance-none pr-6 cursor-pointer"
              >
                <option value="">No channel</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    #{ch.handle}
                  </option>
                ))}
              </select>
            </div>
          )}

          <span className="text-[11px] uppercase tracking-[0.18em] text-text-3">
            Markdown supported
          </span>
        </div>

        <div className="flex items-center gap-3">
          {charCount > 0 && (
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 20 20" className="transform -rotate-90">
                <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-3" />
                <circle
                  cx="10" cy="10" r="8" fill="none" strokeWidth="2"
                  strokeDasharray={`${Math.min(1, charCount / MAX_LENGTH) * 50.27} 50.27`}
                  className={isOverLimit ? 'text-danger' : charCount > MAX_LENGTH * 0.9 ? 'text-accent-green' : 'text-text-3'}
                  stroke="currentColor"
                />
              </svg>
              {charCount > MAX_LENGTH * 0.8 && (
                <span className={`text-xs font-mono ${isOverLimit ? 'text-danger' : 'text-text-3'}`}>
                  {MAX_LENGTH - charCount}
                </span>
              )}
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-4 py-2 bg-accent-green text-bg font-display text-sm font-semibold disabled:opacity-30 hover:bg-accent-green/90 transition-colors"
          >
            <Send size={14} />
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
