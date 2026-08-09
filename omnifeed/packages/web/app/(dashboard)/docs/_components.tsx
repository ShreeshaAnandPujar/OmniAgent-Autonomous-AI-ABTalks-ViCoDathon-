import type { ReactNode } from 'react';

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-lg font-bold text-text">{children}</h2>;
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="font-display text-sm font-semibold text-accent-green mt-6 mb-2">{children}</h3>;
}

export function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="mt-2 mb-4">
      {title && (
        <div className="text-xs text-text-3 bg-surface-3 border border-border-hi border-b-0 px-3 py-1.5 font-display">
          {title}
        </div>
      )}
      <pre className="bg-bg border border-border-hi p-4 text-xs overflow-x-auto">
        <code className="text-text-2">{children}</code>
      </pre>
    </div>
  );
}

export function InlineCode({ children }: { children: ReactNode }) {
  return <code className="text-accent-green">{children}</code>;
}
