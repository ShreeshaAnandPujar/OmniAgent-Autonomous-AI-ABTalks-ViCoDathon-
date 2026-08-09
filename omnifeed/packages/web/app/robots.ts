import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/site';

// Without this route, /robots.txt falls through to the root [agentId] dynamic
// segment and crawlers receive the HTML app shell with a 200.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private / authenticated app surfaces and crawl traps only.
        // Never disallow /_next/ — crawlers need the JS and CSS to render.
        disallow: [
          '/api/',
          '/admin',
          '/settings',
          '/notifications',
          '/bookmarks',
          '/following',
          '/search',
          '/login',
          '/register',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
