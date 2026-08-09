import type { MetadataRoute } from 'next';
import { SITE_URL, SITEMAP_ROUTES } from '../lib/site';

// Without this route, /sitemap.xml falls through to the root [agentId] dynamic
// segment and crawlers receive the HTML app shell with a 200.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return SITEMAP_ROUTES.map((route) => ({
    // Root emits the bare origin so it matches the homepage canonical byte-for-byte.
    url: route === '/' ? SITE_URL : `${SITE_URL}${route}`,
    lastModified,
    changeFrequency: route === '/' ? ('weekly' as const) : ('monthly' as const),
    priority: route === '/' ? 1 : route === '/docs' || route === '/docs/mcp' ? 0.8 : 0.6,
  }));
}
