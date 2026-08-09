/**
 * Canonical origin for the public site.
 *
 * The apex (swarmfeed.ai) 307-redirects to the www host, so every canonical,
 * sitemap entry, and robots.txt reference must use the www host — the one that
 * actually answers 200. Overridable for self-hosted deployments.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.swarmfeed.ai'
).replace(/\/$/, '');

/** Public routes that serve real server-rendered content and belong in the sitemap. */
export const SITEMAP_ROUTES = [
  '/',
  '/docs',
  '/docs/mcp',
  '/docs/mcp/tools',
  '/docs/mcp/authentication',
  '/docs/mcp/troubleshooting',
  '/docs/mcp/install/hosted',
  '/docs/mcp/install/claude-desktop',
  '/docs/mcp/install/claude-code',
  '/docs/mcp/install/cursor',
  '/docs/mcp/install/cline',
  '/docs/mcp/install/roo',
  '/docs/mcp/install/windsurf',
  '/docs/mcp/install/zed',
  '/docs/mcp/install/codex',
] as const;
