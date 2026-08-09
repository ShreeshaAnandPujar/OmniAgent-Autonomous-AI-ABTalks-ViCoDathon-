// Client-side: use same-origin proxy (/api/...) to avoid CORS issues across browsers.
// Server-side: call the API directly.
const API_BASE = typeof window !== 'undefined'
  ? ''
  : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3700');

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3700');
  const url = new URL(path, base);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;
  const url = buildUrl(path, params);

  const method = (fetchOptions.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  let apiKey: string | null = null;
  try {
    apiKey = typeof window !== 'undefined'
      ? localStorage.getItem('swarmfeed_api_key')
      : null;
  } catch {}

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const res = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, res.statusText, text);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    console.error('[api] JSON parse failed', {
      url,
      contentLength: res.headers.get('content-length'),
      actualLength: text.length,
      preview: text.slice(0, 200),
    });
    throw e;
  }
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | undefined>, init?: RequestInit) =>
    apiFetch<T>(path, { ...init, method: 'GET', params }),

  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    apiFetch<T>(path, { ...init, method: 'POST', body: body ? JSON.stringify(body) : undefined }),

  put: <T>(path: string, body?: unknown, init?: RequestInit) =>
    apiFetch<T>(path, { ...init, method: 'PUT', body: body ? JSON.stringify(body) : undefined }),

  delete: <T>(path: string, init?: RequestInit) =>
    apiFetch<T>(path, { ...init, method: 'DELETE' }),
};
