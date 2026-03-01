#!/usr/bin/env node
/**
 * Optimize Directus images and replace originals in the database.
 * Only optimizes images from items shown on live pages (published updates,
 * live events, wecantkeepup campaign).
 *
 * During build (or as a separate step), fetches image files from Directus,
 * optimizes them (resize, compress) with sharp, and PATCHes the optimized
 * file back to Directus in place.
 *
 * Run: node scripts/optimize-directus-images.js
 *
 * Options:
 *   --dry-run   - Log what would be optimized, no changes
 *   --limit=N   - Process at most N files (default: all)
 *   --all       - Optimize all images (ignore live-only filter)
 *
 * Environment:
 *   PUBLIC_DIRECTUS_URL or DIRECTUS_URL - Directus instance URL
 *   DIRECTUS_TOKEN - Admin token with files write access
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const envPath = join(projectRoot, '.env');

try {
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .forEach((line) => {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m) {
        const k = m[1].trim();
        const v = m[2].trim().replace(/^["']|["']$/g, '');
        process.env[k] = v;
      }
    });
} catch {
  /* ignore */
}

const DIRECTUS_URL = (process.env.DIRECTUS_URL || process.env.PUBLIC_DIRECTUS_URL || '').replace(/\/$/, '');
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const optimizeAll = args.includes('--all');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

const MAX_WIDTH = 2560;
const JPEG_QUALITY = 90;
const PNG_QUALITY = 92;

if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
  console.error('Set DIRECTUS_URL (or PUBLIC_DIRECTUS_URL) and DIRECTUS_TOKEN in .env');
  process.exit(1);
}

const headers = (contentType = 'application/json') => ({
  headers: {
    ...(contentType ? { 'Content-Type': contentType } : {}),
    Authorization: `Bearer ${DIRECTUS_TOKEN}`,
  },
});

const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

async function fetchFileIds() {
  const ids = new Set();

  const updatesFilter = optimizeAll ? '' : '&filter=' + encodeURIComponent(JSON.stringify({ status: { _eq: 'published' } }));
  const updatesRes = await fetch(
    `${DIRECTUS_URL}/items/updates?fields=image&limit=-1${updatesFilter}`,
    headers()
  );
  if (updatesRes.ok) {
    const { data } = await updatesRes.json();
    (data || []).forEach((item) => {
      const id = item?.image?.id ?? item?.image;
      if (id && typeof id === 'string') ids.add(id);
    });
  }

  const eventsFilter = optimizeAll
    ? ''
    : '&filter=' +
      encodeURIComponent(
        JSON.stringify({
          _or: [
            { status: { _in: ['published', 'active', 'live', 'scheduled'] } },
            { status: { _null: true } },
          ],
        })
      );
  for (const col of ['action_events', 'events', 'upcoming_events']) {
    try {
      const res = await fetch(
        `${DIRECTUS_URL}/items/${col}?fields=image,event_image,featured_image,banner_image&limit=-1${eventsFilter}`,
        headers()
      );
      if (!res.ok) continue;
      const { data } = await res.json();
      (data || []).forEach((item) => {
        for (const key of ['image', 'event_image', 'featured_image', 'banner_image']) {
          const val = item?.[key]?.id ?? item?.[key];
          if (val && typeof val === 'string') ids.add(val);
        }
      });
    } catch {
      /* collection may not exist */
    }
  }

  try {
    const res = await fetch(
      `${DIRECTUS_URL}/items/wecantkeepup?fields=profile_image&limit=-1`,
      headers()
    );
    if (res.ok) {
      const { data } = await res.json();
      (data || []).forEach((item) => {
        const id = item?.profile_image?.id ?? item?.profile_image;
        if (id && typeof id === 'string') ids.add(id);
      });
    }
  } catch {
    /* ignore */
  }

  return [...ids];
}

async function getFileMeta(id) {
  const res = await fetch(`${DIRECTUS_URL}/files/${id}?fields=id,type,filename_download`, headers());
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

async function downloadFile(id) {
  const token = encodeURIComponent(DIRECTUS_TOKEN);
  const url = `${DIRECTUS_URL}/assets/${id}?access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function optimizeImage(buffer, mimeType, filename) {
  let pipeline = sharp(buffer);
  const meta = await pipeline.metadata();
  const isImage = imageTypes.some((t) => (mimeType || meta.format).includes(t.replace('image/', '')));

  if (!isImage) return null;

  pipeline = pipeline.resize(MAX_WIDTH, null, { withoutEnlargement: true });

  const ext = (filename || '').split('.').pop()?.toLowerCase() || meta.format || 'jpeg';

  if (ext === 'png' || (meta.format && meta.format === 'png')) {
    return pipeline.png({ quality: PNG_QUALITY }).toBuffer();
  }
  if (ext === 'webp' || (meta.format && meta.format === 'webp')) {
    return pipeline.webp({ quality: JPEG_QUALITY }).toBuffer();
  }
  if (ext === 'gif' || (meta.format && meta.format === 'gif')) {
    return pipeline.gif().toBuffer();
  }
  return pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
}

async function patchFile(id, optimizedBuffer, filename, mimeType) {
  const form = new FormData();
  const blob = new Blob([optimizedBuffer], { type: mimeType || 'image/jpeg' });
  form.append('file', blob, filename || 'optimized.jpg');

  const res = await fetch(`${DIRECTUS_URL}/files/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
    },
    body: form,
  });

  return res.ok;
}

async function main() {
  console.log(optimizeAll ? 'Fetching all image file IDs...' : 'Fetching image file IDs (live pages only)...');

  const fileIds = await fetchFileIds();
  const toProcess = limit ? fileIds.slice(0, limit) : fileIds;

  console.log(`Found ${fileIds.length} image file(s). Processing ${toProcess.length}...`);

  if (dryRun) {
    for (const id of toProcess) {
      const meta = await getFileMeta(id);
      console.log(`  [dry-run] Would optimize: ${id} (${meta?.filename_download || 'unknown'})`);
    }
    console.log('Run without --dry-run to apply.');
    return;
  }

  let optimized = 0;
  let skipped = 0;
  let failed = 0;

  for (const id of toProcess) {
    try {
      const meta = await getFileMeta(id);
      if (!meta) {
        skipped++;
        continue;
      }

      const mimeType = meta.type || 'image/jpeg';
      if (!imageTypes.some((t) => mimeType.startsWith('image/'))) {
        skipped++;
        continue;
      }

      const buffer = await downloadFile(id);
      if (!buffer || buffer.length === 0) {
        failed++;
        continue;
      }

      const optimizedBuffer = await optimizeImage(buffer, mimeType, meta.filename_download);
      if (!optimizedBuffer) {
        skipped++;
        continue;
      }

      if (optimizedBuffer.length >= buffer.length) {
        skipped++;
        continue;
      }

      const ok = await patchFile(id, optimizedBuffer, meta.filename_download, mimeType);
      if (ok) {
        optimized++;
        const saved = ((1 - optimizedBuffer.length / buffer.length) * 100).toFixed(1);
        process.stdout.write(`\rOptimized ${optimized}/${toProcess.length} (${saved}% smaller): ${meta.filename_download}`);
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
      console.warn(`\n  Error for ${id}:`, err.message);
    }

    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\nDone. Optimized: ${optimized}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
