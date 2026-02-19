/**
 * Fetch Worker Profile Campaign (wecantkeepup) items from Directus.
 * Fields: name, department, testimonial, profile_image_url (GCS URL), profile_image_focus_x/y (0–1).
 */

const DIRECTUS_URL = (import.meta.env.PUBLIC_DIRECTUS_URL || '').replace(/\/$/, '');

export interface WeCantKeepUpItem {
  id: number | string;
  name: string;
  department: string;
  testimonial: string;
  profile_image_url: string | null;
  profile_image_focus_x: number | null;
  profile_image_focus_y: number | null;
}

interface WeCantKeepUpResponse {
  data: WeCantKeepUpItem[];
  meta?: { total_count?: number };
}

/** Get DIRECTUS_TOKEN from env (same as directus.ts). */
async function getDirectusToken(): Promise<string | undefined> {
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

/** Fetch all wecantkeepup items for the campaign posters page. */
export async function fetchWeCantKeepUpItems(options?: { limit?: number; sort?: string }): Promise<WeCantKeepUpItem[]> {
  if (!DIRECTUS_URL) return [];

  const limit = options?.limit ?? 100;
  const sort = options?.sort ?? 'name';

  const token = await getDirectusToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const params = new URLSearchParams({
      limit: String(limit),
      sort,
      fields: 'id,name,department,testimonial,profile_image_url,profile_image_focus_x,profile_image_focus_y',
    });
    const url = `${DIRECTUS_URL}/items/wecantkeepup?${params}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const body = await res.text();
      console.warn(`Directus wecantkeepup fetch failed: ${res.status}`, body.slice(0, 200));
      return [];
    }

    const json = (await res.json()) as WeCantKeepUpResponse;
    const raw = Array.isArray(json.data) ? json.data : [];
    return raw.map((item) => ({
      id: item.id,
      name: item.name ?? '',
      department: item.department ?? '',
      testimonial: item.testimonial ?? '',
      profile_image_url: item.profile_image_url ?? null,
      profile_image_focus_x: item.profile_image_focus_x != null ? Number(item.profile_image_focus_x) : null,
      profile_image_focus_y: item.profile_image_focus_y != null ? Number(item.profile_image_focus_y) : null,
    }));
  } catch (err) {
    console.warn('Directus wecantkeepup fetch error:', err);
    return [];
  }
}
