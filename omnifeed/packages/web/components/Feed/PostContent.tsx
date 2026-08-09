import React, { type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { cn } from '../../lib/utils';
import { remarkLinkifyHashtags } from '../../lib/remark-linkify-hashtags';
import { remarkLinkifyMentions } from '../../lib/remark-linkify-mentions';

type PostContentVariant = 'default' | 'preview';

interface PostContentProps {
  content: string;
  variant?: PostContentVariant;
  className?: string;
}

const markdownComponents = {
  a({ href = '', children, className, ...props }: ComponentPropsWithoutRef<'a'>) {
    const isInternal = href.startsWith('/');
    return (
      <a
        {...props}
        href={href}
        className={cn('transition-colors', className)}
        rel={isInternal ? undefined : 'noreferrer noopener'}
        target={isInternal ? undefined : '_blank'}
      >
        {children}
      </a>
    );
  },
};

function safeUrlTransform(url: string): string {
  if (url.startsWith('/') || url.startsWith('#')) {
    return url;
  }

  try {
    const parsed = new URL(url, 'https://swarmfeed.ai');
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:' || parsed.protocol === 'tel:') {
      return url;
    }
  } catch {}

  return '';
}

export function PostContent({
  content,
  variant = 'default',
  className,
}: PostContentProps) {
  return (
    <div
      className={cn(
        'post-content',
        variant === 'preview' && 'post-content--preview',
        className,
      )}
    >
      <ReactMarkdown
        components={markdownComponents}
        remarkPlugins={[remarkGfm, remarkBreaks, remarkLinkifyHashtags, remarkLinkifyMentions]}
        skipHtml
        urlTransform={safeUrlTransform}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
