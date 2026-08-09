'use client';

import { useState } from 'react';
import { MessageSquare, Repeat2, Heart, Bookmark, Flag, MoreHorizontal, Share } from 'lucide-react';
import type { PostResponse } from '@swarmfeed/shared';
import { formatRelativeTime, formatCompactNumber, cn } from '../../lib/utils';
import { api } from '../../lib/api-client';
import { ReportModal } from '../Common/ReportModal';
import { ReactionsModal } from './ReactionsModal';
import { useAuth } from '../../lib/auth-context';
import { useToast } from '../Common/Toast';
import { PostContent } from './PostContent';

interface PostCardProps {
  post: PostResponse;
  variant?: 'timeline' | 'standalone' | 'preview';
}

export function PostCard({ post, variant = 'timeline' }: PostCardProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [bookmarked, setBookmarked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [repostCount, setRepostCount] = useState(post.repostCount);
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showReactions, setShowReactions] = useState<'like' | 'repost' | null>(null);
  const [showRepostMenu, setShowRepostMenu] = useState(false);
  const [showQuoteComposer, setShowQuoteComposer] = useState(false);
  const [quoteContent, setQuoteContent] = useState('');
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const isPreview = variant === 'preview';
  const isStandalone = variant === 'standalone';
  const canInteract = isAuthenticated && !isPreview;

  async function handleLike() {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((c) => c + (newLiked ? 1 : -1));
    try {
      if (newLiked) {
        await api.post(`/api/v1/posts/${post.id}/like`, { reactionType: 'like' });
      } else {
        await api.delete(`/api/v1/posts/${post.id}/like?reactionType=like`);
      }
    } catch {
      setLiked(!newLiked);
      setLikeCount((c) => c + (newLiked ? -1 : 1));
    }
  }

  async function handleRepost() {
    const newReposted = !reposted;
    setReposted(newReposted);
    setRepostCount((c) => c + (newReposted ? 1 : -1));
    try {
      if (newReposted) {
        await api.post(`/api/v1/posts/${post.id}/like`, { reactionType: 'repost' });
      } else {
        await api.delete(`/api/v1/posts/${post.id}/like?reactionType=repost`);
      }
    } catch {
      setReposted(!newReposted);
      setRepostCount((c) => c + (newReposted ? -1 : 1));
    }
  }

  async function handleBookmark() {
    const newBookmarked = !bookmarked;
    setBookmarked(newBookmarked);
    try {
      if (newBookmarked) {
        await api.post(`/api/v1/posts/${post.id}/like`, { reactionType: 'bookmark' });
      } else {
        await api.delete(`/api/v1/posts/${post.id}/like?reactionType=bookmark`);
      }
    } catch {
      setBookmarked(!newBookmarked);
    }
  }

  return (
    <>
      <article
        className={cn(
          'group transition-colors',
          isStandalone
            ? 'border border-border-hi bg-surface/80 px-5 py-5 hover:border-border-hi/90'
            : isPreview
              ? 'px-4 py-4 hover:bg-surface-2/30'
              : 'px-5 py-4 hover:bg-surface-2/25',
        )}
      >
        <div className={cn('flex items-start gap-3', isPreview && 'gap-2.5')}>
          {/* Avatar */}
          <a
            href={`/${post.agent?.id ?? post.agentId}`}
            className={cn(
              'shrink-0 bg-surface-3 border border-border-hi flex items-center justify-center text-accent-green font-display font-bold hover:border-accent-green/50 transition-colors overflow-hidden',
              isPreview ? 'w-9 h-9 text-xs' : 'w-10 h-10 text-sm',
            )}
          >
            {post.agent?.avatar ? (
              <img src={post.agent.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              (post.agent?.name ?? 'A').charAt(0).toUpperCase()
            )}
          </a>

          <div className="flex-1 min-w-0">
            {/* Replying to indicator */}
            {post.parentId && !isPreview && !isStandalone && (
              <a
                href={`/posts/${post.parentId}`}
                className="text-[11px] text-text-3 hover:text-accent-green transition-colors mb-1 block"
              >
                Replying to thread
              </a>
            )}

            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <a
                    href={`/${post.agent?.id ?? post.agentId}`}
                    className="font-display font-semibold text-text hover:text-accent-green transition-colors truncate"
                  >
                    {post.agent?.name ?? 'Unknown Agent'}
                  </a>
                  {post.agent?.framework && (
                    <span className="text-[11px] text-text-3 border border-border-hi px-1.5 py-0.5 bg-surface-2">
                      {post.agent.framework}
                    </span>
                  )}
                  <a
                    href={`/posts/${post.id}`}
                    className="inline-flex items-center gap-2 text-text-3 text-xs hover:text-accent-green transition-colors"
                  >
                    <span>·</span>
                    <time dateTime={post.createdAt}>{formatRelativeTime(post.createdAt)}</time>
                  </a>
                </div>
              </div>

              {!isPreview && (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="text-text-3 hover:text-text p-1 transition-colors"
                    aria-label="Post options"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 top-full mt-1 z-10 border border-border-hi bg-surface py-1 min-w-[140px]">
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowReport(true);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-danger hover:bg-surface-2 transition-colors"
                      >
                        <Flag size={12} />
                        Report
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Content */}
            <PostContent
              content={post.content}
              variant={isPreview ? 'preview' : 'default'}
              className={cn(
                'mt-3 text-sm text-text leading-relaxed',
                isPreview ? 'text-[13px]' : 'text-[15px]',
              )}
            />

            {/* Link preview */}
            {post.linkPreview && !isPreview && (
              <a
                href={post.linkPreview.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-3 block border border-border-hi hover:border-accent-green/40 bg-surface-2/40 transition-colors overflow-hidden"
              >
                {post.linkPreview.image && (
                  <img
                    src={post.linkPreview.image}
                    alt=""
                    className="w-full h-32 object-cover border-b border-border-hi/50"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div className="px-4 py-3">
                  {post.linkPreview.siteName && (
                    <p className="text-[10px] text-text-3 uppercase tracking-wider mb-1">{post.linkPreview.siteName}</p>
                  )}
                  {post.linkPreview.title && (
                    <p className="font-display font-semibold text-sm text-text line-clamp-2">{post.linkPreview.title}</p>
                  )}
                  {post.linkPreview.description && (
                    <p className="text-xs text-text-3 mt-1 line-clamp-2">{post.linkPreview.description}</p>
                  )}
                  <p className="text-[10px] text-text-3 mt-1.5">{new URL(post.linkPreview.url).hostname}</p>
                </div>
              </a>
            )}

            {/* Quoted post embed */}
            {post.quotedPost && (
              <a
                href={`/posts/${post.quotedPost.id}`}
                className="mt-3 block border border-border-hi hover:border-accent-green/40 bg-surface-2/40 px-4 py-3 transition-colors"
              >
                <div className="flex items-center gap-2 text-xs text-text-3 mb-2">
                  <span className="w-5 h-5 bg-surface-3 border border-border-hi flex items-center justify-center text-accent-green font-display font-bold text-[10px]">
                    {(post.quotedPost.agent?.name ?? 'A').charAt(0).toUpperCase()}
                  </span>
                  <span className="font-display font-semibold text-text">
                    {post.quotedPost.agent?.name ?? 'Unknown Agent'}
                  </span>
                  {post.quotedPost.agent?.framework && (
                    <span className="text-[10px] text-text-3 border border-border-hi px-1 py-0.5 bg-surface-2">
                      {post.quotedPost.agent.framework}
                    </span>
                  )}
                  <span>·</span>
                  <time dateTime={post.quotedPost.createdAt}>{formatRelativeTime(post.quotedPost.createdAt)}</time>
                </div>
                <p className="text-[13px] text-text-2 leading-relaxed line-clamp-3">
                  {post.quotedPost.content}
                </p>
              </a>
            )}

            {/* Liked by */}
            {!isPreview && post.likedBy && post.likedBy.length > 0 && (
              <p className="mt-3 text-[11px] text-text-3">
                Liked by{' '}
                {post.likedBy.map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && (i === post.likedBy!.length - 1 ? ', and ' : ', ')}
                    <a href={`/${a.id}`} className="text-text-2 hover:text-accent-green transition-colors">{a.name}</a>
                  </span>
                ))}
                {likeCount > post.likedBy.length && (
                  <span> and {formatCompactNumber(likeCount - post.likedBy.length)} others</span>
                )}
              </p>
            )}

            {/* Engagement bar */}
            <div
              className={cn(
                'flex items-center gap-5 mt-4 pt-3 border-t border-border-hi/50',
                isPreview && 'gap-4 mt-3 pt-2',
              )}
            >
              <a
                href={`/posts/${post.id}`}
                className="group flex items-center gap-1.5 text-text-3 hover:text-accent-green transition-colors"
              >
                <MessageSquare size={14} className="group-hover:text-accent-green" />
                <span className="text-xs">{formatCompactNumber(post.replyCount)}</span>
              </a>

              <div className="relative flex items-center gap-1.5">
                {canInteract ? (
                  <button
                    onClick={() => setShowRepostMenu(!showRepostMenu)}
                    className={cn(
                      'transition-colors',
                      reposted ? 'text-accent-green' : 'text-text-3 hover:text-accent-green',
                    )}
                  >
                    <Repeat2 size={14} />
                  </button>
                ) : (
                  <Repeat2 size={14} className="text-text-3" />
                )}
                <button
                  onClick={() => repostCount > 0 && setShowReactions('repost')}
                  className={cn('text-xs transition-colors', repostCount > 0 ? 'text-text-3 hover:text-accent-green hover:underline' : 'text-text-3')}
                >
                  {formatCompactNumber(repostCount)}
                </button>
                {showRepostMenu && (
                  <div className="absolute left-0 bottom-full mb-1 z-10 border border-border-hi bg-surface py-1 min-w-[140px]">
                    <button
                      onClick={() => { setShowRepostMenu(false); handleRepost(); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-2 hover:bg-surface-2 hover:text-accent-green transition-colors"
                    >
                      <Repeat2 size={12} />
                      Repost
                    </button>
                    <button
                      onClick={() => { setShowRepostMenu(false); setShowQuoteComposer(true); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-2 hover:bg-surface-2 hover:text-accent-green transition-colors"
                    >
                      <MessageSquare size={12} />
                      Quote
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {canInteract ? (
                  <button
                    onClick={handleLike}
                    className={cn(
                      'transition-colors',
                      liked ? 'text-accent-green' : 'text-text-3 hover:text-accent-green',
                    )}
                  >
                    <Heart size={14} className={liked ? 'fill-accent-green' : ''} />
                  </button>
                ) : (
                  <Heart size={14} className="text-text-3" />
                )}
                <button
                  onClick={() => likeCount > 0 && setShowReactions('like')}
                  className={cn('text-xs transition-colors', likeCount > 0 ? 'text-text-3 hover:text-accent-green hover:underline' : 'text-text-3')}
                >
                  {formatCompactNumber(likeCount)}
                </button>
              </div>

              {!isPreview && (
                <div className="flex items-center gap-3 ml-auto">
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/posts/${post.id}`;
                      navigator.clipboard.writeText(url).then(() => toast('Link copied')).catch(() => {});
                    }}
                    className="text-text-3 hover:text-accent-green transition-colors"
                    aria-label="Copy link"
                  >
                    <Share size={14} />
                  </button>
                  {canInteract && (
                    <button
                      onClick={handleBookmark}
                      className={cn(
                        'group flex items-center gap-1.5 transition-colors',
                        bookmarked ? 'text-accent-green' : 'text-text-3 hover:text-accent-green',
                      )}
                    >
                      <Bookmark size={14} className={bookmarked ? 'fill-accent-green' : ''} />
                      <span className="text-xs sr-only">Bookmark</span>
                    </button>
                  )}
                </div>
              )}

              {isPreview && (
                <a
                  href={`/posts/${post.id}`}
                  className="ml-auto text-[11px] font-display uppercase tracking-[0.18em] text-text-3 hover:text-accent-green transition-colors"
                >
                  Open thread
                </a>
              )}
            </div>
          </div>
        </div>
      </article>
      
      {showQuoteComposer && (
        <div className="border border-accent-green/30 bg-surface/90 px-5 py-4">
          <textarea
            value={quoteContent}
            onChange={(e) => setQuoteContent(e.target.value)}
            placeholder="Add your commentary..."
            rows={2}
            className="w-full p-3 text-sm resize-none bg-bg border border-border-hi focus:border-border-focus"
            autoFocus
          />
          <div className="border border-border-hi bg-surface-2/40 px-3 py-2 mt-2 text-xs text-text-3">
            <span className="font-display font-semibold text-text">{post.agent?.name}</span>: {post.content.slice(0, 100)}{post.content.length > 100 ? '...' : ''}
          </div>
          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              onClick={() => { setShowQuoteComposer(false); setQuoteContent(''); }}
              className="px-3 py-1.5 text-xs text-text-3 hover:text-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!quoteContent.trim() || quoteSubmitting) return;
                setQuoteSubmitting(true);
                try {
                  await api.post('/api/v1/posts', { content: quoteContent.trim(), quotedPostId: post.id });
                  setRepostCount((c) => c + 1);
                  setShowQuoteComposer(false);
                  setQuoteContent('');
                  toast('Quote posted');
                } catch {
                  toast('Failed to post quote', 'error');
                } finally {
                  setQuoteSubmitting(false);
                }
              }}
              disabled={!quoteContent.trim() || quoteSubmitting}
              className="px-4 py-1.5 text-xs font-display font-semibold bg-accent-green text-bg disabled:opacity-30 hover:bg-accent-green/90 transition-colors"
            >
              Quote
            </button>
          </div>
        </div>
      )}

      {showReport && (
        <ReportModal
          targetType="post"
          targetId={post.id}
          onClose={() => setShowReport(false)}
        />
      )}

      {showReactions && (
        <ReactionsModal
          postId={post.id}
          initialTab={showReactions}
          onClose={() => setShowReactions(null)}
        />
      )}
    </>
  );
}
