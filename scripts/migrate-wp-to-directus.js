#!/usr/bin/env node
/**
 * Migrate WordPress blog posts from local34.org to Directus updates collection.
 * Ensures the updates collection and schema exist before migrating.
 * Featured images are imported via Directus /files/import (stored in GCS).
 *
 * Prerequisites:
 * 1. Create a static token in Directus: User → Token
 *
 * Usage:
 *   DIRECTUS_TOKEN=your_token node scripts/migrate-wp-to-directus.js
 *
 * Options:
 *   WP_API_URL     - WordPress REST API base (default: https://local34.org/wp-json/wp/v2)
 *   DIRECTUS_URL   - Directus base URL (default: PUBLIC_DIRECTUS_URL from .env)
 *   DIRECTUS_TOKEN - Required. Admin/static token for creating items
 *   --dry-run         - Fetch from WP but don't write to Directus
 *   --limit=N         - Limit to N posts (default: all)
 *   --truncate-content=N - If content exceeds N chars, truncate (last resort; loses data)
 *   --db-fallback         - On VALUE_TOO_LONG, insert via direct DB (needs Cloud SQL Proxy on 5433)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ensureUpdatesSchema } from './directus-schema-updates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const envPath = join(projectRoot, '.env');
try {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const val = valueParts
          .join('=')
          .trim()
          .replace(/^["']|["']$/g, '');
        process.env[key.trim()] = val;
      }
    }
  });
} catch {
  // .env optional
}

const WP_API = process.env.WP_API_URL || 'https://local34.org/wp-json/wp/v2';
const DIRECTUS_URL = (process.env.DIRECTUS_URL || process.env.PUBLIC_DIRECTUS_URL || '').replace(/\/$/, '');
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const truncateArg = args.find((a) => a.startsWith('--truncate-content='));
const truncateContent = truncateArg !== undefined ? parseInt(truncateArg.split('=')[1], 10) : 50000;
const dbFallback = args.includes('--db-fallback');

if (!DIRECTUS_TOKEN && !dryRun) {
  console.error('Set DIRECTUS_TOKEN (or use --dry-run)');
  process.exit(1);
}

if (!DIRECTUS_URL && !dryRun) {
  console.error('Set DIRECTUS_URL or PUBLIC_DIRECTUS_URL');
  process.exit(1);
}

/** Validate Directus token before migration; exit with helpful message if invalid */
async function validateDirectusToken() {
  const res = await fetch(`${DIRECTUS_URL}/users/me`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
  });
  if (res.ok) {
    const user = await res.json();
    console.log(`Directus: authenticated as ${user.data?.email ?? user.email ?? 'user'}`);
    return true;
  }
  const body = await res.text();
  console.error('\nDirectus token validation failed (401 Invalid user credentials).');
  console.error('Create a static token: Directus Admin → Settings (gear) → Access Tokens → Create');
  console.error('Or: User menu (top-right) → Account Settings → Token');
  console.error('Use the new token in .env: DIRECTUS_TOKEN=your_token');
  console.error(`\nResponse: ${res.status} ${body.slice(0, 200)}`);
  process.exit(1);
}

/** Decode HTML entities */
function decodeEntities(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/&amp;/g, '&');
}

/** Strip HTML tags */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract plain text from WordPress HTML (no styles, classes, or block markup) */
function htmlToPlainText(html) {
  if (!html) return '';
  let text = html
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // Wrap paragraphs in <p> for Directus WYSIWYG (no classes/styles)
  return text
    .split(/\n\n+/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${para}</p>`)
    .join('\n');
}

/** Fetch all WP posts (paginated) */
async function fetchWpPosts() {
  const posts = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${WP_API}/posts?per_page=100&page=${page}&_embed`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`WP fetch failed: ${res.status} ${res.url}`);
      break;
    }
    const batch = await res.json();
    if (!batch.length) break;

    for (const p of batch) {
      posts.push(p);
      if (limit && posts.length >= limit) break;
    }
    if (limit && posts.length >= limit) break;
    hasMore = batch.length === 100;
    page++;
    process.stdout.write(`\rFetched ${posts.length} posts...`);
  }
  console.log(`\nTotal: ${posts.length} posts`);
  return posts;
}

/** Get featured image URL from WP post (uses _embedded if available) */
function getFeaturedImageUrl(post) {
  const embed = post._embedded;
  if (embed?.['wp:featuredmedia']?.[0]) {
    const media = embed['wp:featuredmedia'][0];
    return media.source_url || media.media_details?.sizes?.full?.source_url;
  }
  if (post.featured_media && post.featured_media > 0) {
    return null; // Would need extra fetch
  }
  return null;
}

/** Fetch featured media if not embedded */
async function fetchFeaturedMediaUrl(mediaId) {
  const res = await fetch(`${WP_API}/media/${mediaId}`);
  if (!res.ok) return null;
  const media = await res.json();
  return media.source_url || media.media_details?.sizes?.full?.source_url;
}

/** Import image from URL into Directus (stored in GCS). Returns file ID or null. */
const imageUrlToFileId = new Map();

async function importImageToDirectus(imageUrl) {
  if (imageUrlToFileId.has(imageUrl)) {
    return imageUrlToFileId.get(imageUrl);
  }
  try {
    const res = await fetch(`${DIRECTUS_URL}/files/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      },
      body: JSON.stringify({ url: imageUrl }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`Import failed for ${imageUrl}: ${res.status} ${text}`);
      return null;
    }
    const json = await res.json();
    const fileId = json.data?.id ?? json.id;
    if (fileId) {
      imageUrlToFileId.set(imageUrl, fileId);
      return fileId;
    }
    return null;
  } catch (err) {
    console.warn(`Import error for ${imageUrl}:`, err.message);
    return null;
  }
}

/** Create one update in Directus */
async function createDirectusUpdate(payload) {
  const res = await fetch(`${DIRECTUS_URL}/items/updates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Directus ${res.status}: ${text}`);
  }
  return res.json();
}

/** Insert update directly into DB (bypasses Directus validation). Requires Cloud SQL Proxy on 5433. */
async function insertUpdateViaDb(payload) {
  const directusEnv = join(projectRoot, 'directus', '.env');
  let DB_HOST = process.env.DB_HOST || '127.0.0.1';
  let DB_PORT = parseInt(process.env.DB_PORT || '5433', 10);
  let DB_USER = 'directus';
  let DB_PASSWORD = '';
  let DB_DATABASE = 'local34site-directus-db';
  try {
    readFileSync(directusEnv, 'utf-8')
      .split('\n')
      .forEach((line) => {
        const m = line.match(/^\s*([^#=]+)=(.*)$/);
        if (m) {
          const k = m[1].trim();
          const v = m[2].trim().replace(/^["']|["']$/g, '');
          if (k === 'DB_USER') DB_USER = v;
          if (k === 'DB_PASSWORD') DB_PASSWORD = v;
          if (k === 'DB_DATABASE') DB_DATABASE = v;
        }
      });
  } catch {
    throw new Error('Could not read directus/.env for DB config');
  }
  const pg = await import('pg');
  const client = new pg.default.Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_DATABASE,
  });
  await client.connect();
  try {
    const { title, date, content, excerpt, status, image, image_url } = payload;
    const res = await client.query(
      `INSERT INTO updates (title, date, content, excerpt, status, image, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [title, date || null, content || null, excerpt || null, status || 'published', image || null, image_url || null]
    );
    return { data: res.rows[0] };
  } finally {
    await client.end();
  }
}

async function main() {
  if (!dryRun) {
    await validateDirectusToken();
    console.log('Ensuring updates collection schema...');
    await ensureUpdatesSchema({
      directusUrl: DIRECTUS_URL,
      token: DIRECTUS_TOKEN,
      dryRun: false,
    });
  }
  console.log('Fetching posts from WordPress...');
  const posts = await fetchWpPosts();

  if (posts.length === 0) {
    console.log('No posts to migrate.');
    return;
  }

  if (truncateContent > 0 && !dryRun) {
    console.log(`Content truncation: enabled (max ${truncateContent} chars). Use --truncate-content=0 for no limit.`);
  }
  if (dbFallback) {
    console.log('DB fallback: enabled (on VALUE_TOO_LONG, insert via direct DB). Cloud SQL Proxy on 5433 required.');
  }

  if (dryRun) {
    console.log('\n--- DRY RUN - sample of first 3 posts ---\n');
    for (const p of posts.slice(0, 3)) {
      const title = decodeEntities(p.title?.rendered || p.title);
      const excerpt = stripHtml(p.excerpt?.rendered || '').slice(0, 150);
      let imageUrl = getFeaturedImageUrl(p);
      if (!imageUrl && p.featured_media) {
        imageUrl = await fetchFeaturedMediaUrl(p.featured_media);
      }
      console.log(`Title: ${title}`);
      console.log(`Date: ${p.date}`);
      console.log(`Excerpt: ${excerpt}...`);
      console.log(`Image: ${imageUrl || '(none)'}`);
      console.log('---');
    }
    console.log(`Would migrate ${posts.length} posts. Run without --dry-run to import.`);
    return;
  }

  let created = 0;
  let failed = 0;

  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const title = decodeEntities(p.title?.rendered || p.title);
    let content = htmlToPlainText(p.content?.rendered || '');
    if (truncateContent > 0 && content.length > truncateContent) {
      content = content.slice(0, truncateContent) + '\n\n<!-- Content truncated during migration -->';
    }
    const excerpt = decodeEntities(stripHtml(p.excerpt?.rendered || '')).slice(0, 255);
    let imageUrl = getFeaturedImageUrl(p);
    if (!imageUrl && p.featured_media) {
      imageUrl = await fetchFeaturedMediaUrl(p.featured_media);
    }

    let imageId = null;
    if (imageUrl) {
      imageId = await importImageToDirectus(imageUrl);
      if (imageId) {
        await new Promise((r) => setTimeout(r, 100)); // small delay between import + create
      }
    }

    const payload = {
      title,
      date: p.date,
      content,
      excerpt: excerpt || undefined,
      status: 'published',
      ...(imageId && {
        image: imageId,
        image_url: `${DIRECTUS_URL.replace(/\/$/, '')}/assets/${imageId}`,
      }),
      // Fallback to external URL if Directus import failed (e.g. /files/import not available)
      ...(!imageId && imageUrl && { image_url: imageUrl }),
    };

    try {
      await createDirectusUpdate(payload);
      created++;
      process.stdout.write(`\rMigrated ${created}/${posts.length}...`);
    } catch (err) {
      const isTooLong = err.message?.includes('VALUE_TOO_LONG');
      if (isTooLong && dbFallback) {
        try {
          await insertUpdateViaDb(payload);
          created++;
          process.stdout.write(`\rMigrated ${created}/${posts.length}... (db-fallback)`);
        } catch (dbErr) {
          failed++;
          console.error(`\nFailed: ${title}: ${err.message}`);
          console.error(`  DB fallback failed: ${dbErr.message}`);
          console.error(
            '  Ensure Cloud SQL Proxy on 5433: cloud-sql-proxy local34org-assets:us-west1:local34org-directus-b --port=5433'
          );
        }
      } else {
        failed++;
        console.error(`\nFailed: ${title}: ${err.message}`);
        if (isTooLong && !truncateContent) {
          console.error('  → Run with --db-fallback (needs Cloud SQL Proxy on 5433)');
          console.error('  → Or: --truncate-content=50000  (truncates long content; loses data)');
        }
      }
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone. Created: ${created}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
