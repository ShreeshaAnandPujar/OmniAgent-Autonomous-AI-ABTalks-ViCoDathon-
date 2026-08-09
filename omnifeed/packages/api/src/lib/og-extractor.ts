export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

const URL_PATTERN = /https?:\/\/[^\s)<>'"]+/;

// Block private/internal IPs to prevent SSRF
const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
const PRIVATE_IP_PATTERN = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;

/**
 * Extract the first URL from post content and fetch its Open Graph metadata.
 * Returns null if no URL found, fetch fails, or times out.
 */
export async function extractLinkPreview(content: string): Promise<LinkPreview | null> {
  const match = content.match(URL_PATTERN);
  if (!match) return null;

  const url = match[0].replace(/[.,;:!?)]+$/, ''); // Strip trailing punctuation

  try {
    const parsed = new URL(url);

    // Security: block private IPs and localhost
    if (BLOCKED_HOSTS.has(parsed.hostname) || PRIVATE_IP_PATTERN.test(parsed.hostname)) {
      return null;
    }

    // Fetch with 5s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SwarmFeed/1.0 (link preview)',
        'Accept': 'text/html',
      },
      signal: controller.signal as AbortSignal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) return null;

    // Only read first 50KB to avoid huge pages
    const reader = response.body?.getReader();
    if (!reader) return null;

    let html = '';
    const decoder = new TextDecoder();
    let bytesRead = 0;
    const maxBytes = 50_000;

    while (bytesRead < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      bytesRead += value.length;
    }
    reader.cancel().catch(() => {});

    const og = parseOpenGraph(html);

    // Must have at least a title to be useful
    if (!og.title && !og.description) return null;

    return { url, ...og };
  } catch {
    return null;
  }
}

function parseOpenGraph(html: string): Omit<LinkPreview, 'url'> {
  const result: Omit<LinkPreview, 'url'> = {};

  // OG tags (property="og:...")
  const ogTitle = extractMeta(html, 'og:title');
  const ogDesc = extractMeta(html, 'og:description');
  const ogImage = extractMeta(html, 'og:image');
  const ogSiteName = extractMeta(html, 'og:site_name');

  // Twitter card fallbacks
  const twTitle = extractMeta(html, 'twitter:title');
  const twDesc = extractMeta(html, 'twitter:description');
  const twImage = extractMeta(html, 'twitter:image');

  // Standard HTML fallbacks
  const htmlTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1];

  result.title = ogTitle ?? twTitle ?? htmlTitle;
  result.description = ogDesc ?? twDesc ?? metaDesc;
  result.image = ogImage ?? twImage;
  result.siteName = ogSiteName;

  // Decode HTML entities
  if (result.title) result.title = decodeEntities(result.title).slice(0, 200);
  if (result.description) result.description = decodeEntities(result.description).slice(0, 300);

  return result;
}

function extractMeta(html: string, property: string): string | undefined {
  // Match both property="og:X" content="Y" and content="Y" property="og:X" orders
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern1 = new RegExp(`<meta\\s+(?:property|name)=["']${escaped}["']\\s+content=["']([^"']+)["']`, 'i');
  const pattern2 = new RegExp(`<meta\\s+content=["']([^"']+)["']\\s+(?:property|name)=["']${escaped}["']`, 'i');
  return pattern1.exec(html)?.[1] ?? pattern2.exec(html)?.[1];
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}
