#!/usr/bin/env node
/**
 * Backfill: Import images for updates that have image_url but no image (file ID).
 * Connects ingested media to content that was created with external URL fallback.
 *
 * Run: node scripts/backfill-directus-images.js
 * Requires: DIRECTUS_TOKEN, PUBLIC_DIRECTUS_URL (or DIRECTUS_URL) in .env
 *
 * Options:
 *   --dry-run   - List what would be updated, no changes
 *   --limit=N   - Process at most N items (default: all)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
  console.error('Set DIRECTUS_URL (or PUBLIC_DIRECTUS_URL) and DIRECTUS_TOKEN in .env');
  process.exit(1);
}

const headers = () => ({
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${DIRECTUS_TOKEN}`,
  },
});

const imageUrlToFileId = new Map();

async function importImageToDirectus(imageUrl) {
  if (imageUrlToFileId.has(imageUrl)) {
    return imageUrlToFileId.get(imageUrl);
  }
  try {
    const res = await fetch(`${DIRECTUS_URL}/files/import`, {
      method: 'POST',
      ...headers(),
      body: JSON.stringify({ url: imageUrl }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`  Import failed: ${res.status} ${text.slice(0, 80)}`);
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
    console.warn(`  Import error: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('Fetching updates with image_url but no image...');

  const res = await fetch(
    `${DIRECTUS_URL}/items/updates?filter=${encodeURIComponent(
      JSON.stringify({
        _and: [{ image_url: { _nempty: true } }, { image: { _empty: true } }],
      })
    )}&fields=id,title,image_url`,
    headers()
  );

  if (!res.ok) {
    console.error('Fetch failed:', res.status, await res.text());
    process.exit(1);
  }

  const json = await res.json();
  const items = json.data ?? json;
  const toProcess = Array.isArray(items) ? items : [];

  if (toProcess.length === 0) {
    console.log('No updates need image backfill.');
    return;
  }

  const capped = limit ? toProcess.slice(0, limit) : toProcess;
  console.log(`Found ${toProcess.length} update(s) with image_url only. Processing ${capped.length}...`);

  if (dryRun) {
    capped.forEach((item) => console.log(`  [dry-run] Would import: ${item.title} <- ${item.image_url}`));
    console.log('Run without --dry-run to apply.');
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const item of capped) {
    const url = item.image_url;
    if (!url) continue;

    const fileId = await importImageToDirectus(url);
    if (!fileId) {
      failed++;
      continue;
    }

    const assetUrl = `${DIRECTUS_URL.replace(/\/$/, '')}/assets/${fileId}`;
    const patchRes = await fetch(`${DIRECTUS_URL}/items/updates/${item.id}`, {
      method: 'PATCH',
      ...headers(),
      body: JSON.stringify({ image: fileId, image_url: assetUrl }),
    });

    if (patchRes.ok) {
      updated++;
      process.stdout.write(`\rLinked ${updated}/${capped.length}...`);
    } else {
      failed++;
      console.warn(`\n  Patch failed for ${item.title}: ${patchRes.status}`);
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone. Linked: ${updated}, Failed: ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
