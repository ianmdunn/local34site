/**
 * Directus REST API client for fetching updates/news.
 * Collection: "updates" (create in Directus Admin)
 * Required fields: title, date (or date_created), content (or body), status
 */

const DIRECTUS_URL = (import.meta.env.PUBLIC_DIRECTUS_URL || '').replace(/\/$/, '');
/** When set, images use this proxy; token stays server-side and is never in HTML. */
const IMAGE_PROXY_URL = (import.meta.env.PUBLIC_DIRECTUS_IMAGE_PROXY_URL || '').replace(/\/$/, '');

/** Get DIRECTUS_TOKEN from import.meta.env or .env file. */
export async function getDirectusToken(): Promise<string | undefined> {
  const fromEnv = import.meta.env.DIRECTUS_TOKEN;
  if (fromEnv && typeof fromEnv === 'string') return fromEnv.trim();
  if (typeof process !== 'undefined' && process.env.DIRECTUS_TOKEN) {
    return String(process.env.DIRECTUS_TOKEN).trim();
  }
  try {
    const { createRequire } = await import('node:module');
    const nodeRequire = createRequire(import.meta.url);
    const { readFileSync } = nodeRequire('node:fs');
    const { join } = nodeRequire('node:path');
    const env = readFileSync(join(process.cwd(), '.env'), 'utf-8');
    const m = env.match(/^\s*DIRECTUS_TOKEN\s*=\s*(.+?)\s*$/m);
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
  } catch {
    return undefined;
  }
}

export interface DirectusUpdate {
  id: number | string;
  title: string;
  slug?: string;
  date?: string;
  date_created?: string;
  date_updated?: string;
  content?: string;
  body?: string;
  excerpt?: string;
  summary?: string;
  image?: string | { id: string };
  image_url?: string; // External URL (e.g. WordPress) for migrated posts
  author?: string;
  featured?: boolean;
  status?: string;
  [key: string]: unknown;
}

/** Build Directus asset URL from image field (file ID or object).
 * When proxyUrl is set, returns proxy URL (token stays server-side). Otherwise uses direct Directus URL. */
export function getDirectusImageUrl(
  image: string | { id: string } | undefined,
  baseUrl: string,
  options?: { accessToken?: string | null; proxyUrl?: string | null }
): string | undefined {
  if (!image) return undefined;
  const id = typeof image === 'string' ? image : image?.id;
  if (!id) return undefined;
  const proxy = options?.proxyUrl || IMAGE_PROXY_URL;
  if (proxy) return `${proxy}?id=${encodeURIComponent(id)}`;
  const base = baseUrl.replace(/\/$/, '');
  let url = `${base}/assets/${id}`;
  if (options?.accessToken) url += `?access_token=${encodeURIComponent(options.accessToken)}`;
  return url;
}

export interface DirectusUpdatesResponse {
  data: DirectusUpdate[];
  meta?: { total_count?: number };
}

/** Transform Directus item to a normalized update for display */
export interface UpdateItem {
  id: string;
  slug?: string;
  title: string;
  date: Date;
  excerpt: string;
  content: string;
  author?: string;
  featured?: boolean;
  imageUrl?: string;
}

export function toUpdateItem(
  item: DirectusUpdate,
  options?: { accessToken?: string | null; proxyUrl?: string | null }
): UpdateItem {
  const dateStr = item.date ?? item.date_created ?? item.date_updated;
  const content = item.content ?? item.body ?? '';
  const rawExcerpt = item.excerpt ?? item.summary ?? content.slice(0, 200);
  const stripped = typeof rawExcerpt === 'string' ? rawExcerpt.replace(/<[^>]*>/g, '').trim() : '';
  const excerpt = stripped.length > 200 ? stripped.slice(0, 200) + '…' : stripped;
  const proxy = options?.proxyUrl || IMAGE_PROXY_URL;
  const imageUrl = (() => {
    const built = getDirectusImageUrl(item.image, DIRECTUS_URL, options);
    if (built) return built;
    const ext = item.image_url;
    if (proxy) {
      const id =
        (typeof item.image === 'string' ? item.image : item.image?.id) ??
        ext?.match(/\/assets\/([a-f0-9-]+)/i)?.[1] ??
        ext?.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i)?.[1];
      if (id) return `${proxy}?id=${encodeURIComponent(id)}`;
    }
    if (ext && options?.accessToken && !proxy && ext.includes('/assets/')) {
      return `${ext}${ext.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(options.accessToken)}`;
    }
    return ext;
  })();
  return {
    id: String(item.id),
    slug: item.slug,
    title: item.title ?? 'Untitled',
    date: dateStr ? new Date(dateStr) : new Date(),
    excerpt,
    content,
    author: item.author,
    featured: item.featured === true,
    imageUrl,
  };
}

/** Fetch a single update by slug. Returns null if not found. */
export async function fetchUpdateBySlug(slug: string): Promise<DirectusUpdate | null> {
  if (!DIRECTUS_URL || !slug) return null;

  const token = await getDirectusToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const params = new URLSearchParams({
      limit: '1',
      fields: 'id,title,date,content,excerpt,image,image_url,status,slug,author,featured',
      filter: JSON.stringify({ slug: { _eq: slug } }),
    });
    const url = `${DIRECTUS_URL}/items/updates?${params}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const json = (await res.json()) as DirectusUpdatesResponse;
    const items = Array.isArray(json.data) ? json.data : [];
    return items[0] ?? null;
  } catch {
    return null;
  }
}

/** Fetch updates from Directus. Uses static token when Public role lacks read access (403). */
export async function fetchUpdates(options?: {
  limit?: number;
  sort?: string; // e.g. "-date_created" for newest first
  filterByStatus?: boolean; // If false, skip status filter (for collections without status field)
}): Promise<DirectusUpdate[]> {
  if (!DIRECTUS_URL) {
    return [];
  }

  const limit = options?.limit ?? 50;
  const sort = options?.sort ?? '-date';
  const filterByStatus = options?.filterByStatus ?? true;

  const token = await getDirectusToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const params = new URLSearchParams({
      limit: String(limit),
      sort,
      fields: 'id,title,date,content,excerpt,image,image_url,status,slug,author,featured',
    });
    if (filterByStatus) {
      params.set('filter', JSON.stringify({ status: { _eq: 'published' } }));
    }

    const url = `${DIRECTUS_URL}/items/updates?${params}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const body = await res.text();
      console.warn(`Directus fetch failed: ${res.status} ${res.statusText}`, body.slice(0, 200));
      if (res.status === 403) {
        if (!token) {
          console.warn('Tip: Add DIRECTUS_TOKEN=your_token to .env and restart dev server');
        } else {
          console.warn('Tip: In Directus Admin → Settings → Access Control → your role → enable READ on "updates"');
        }
      }
      return [];
    }

    const json = (await res.json()) as DirectusUpdatesResponse;
    return Array.isArray(json.data) ? json.data : [];
  } catch (err) {
    console.warn('Directus fetch error:', err);
    return [];
  }
}
