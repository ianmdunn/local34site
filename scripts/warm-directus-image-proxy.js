#!/usr/bin/env node
/**
 * Pre-process existing update images through the proxy (face detection + smart crop).
 * Fetches each image URL so the Cloud Function runs face detection and crops.
 * Use after deploying the proxy to "warm" images or verify the pipeline.
 *
 * Run: node scripts/warm-directus-image-proxy.js
 * Requires: PUBLIC_DIRECTUS_IMAGE_PROXY_URL, DIRECTUS_TOKEN, PUBLIC_DIRECTUS_URL in .env
 *
 * Options:
 *   --dry-run   - List images that would be processed, no fetches
 *   --limit=N   - Process at most N images (default: all)
 *   --save=dir  - Save processed images to directory (optional)
 */

import { readFileSync, mkdirSync, writeFileSync } from 'fs';
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

const PROXY_URL = (process.env.PUBLIC_DIRECTUS_IMAGE_PROXY_URL || '').replace(/\/$/, '');
const DIRECTUS_URL = (process.env.DIRECTUS_URL || process.env.PUBLIC_DIRECTUS_URL || '').replace(/\/$/, '');
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const saveArg = args.find((a) => a.startsWith('--save='));
const saveDir = saveArg ? saveArg.split('=')[1] : null;

if (!PROXY_URL) {
  console.error('Set PUBLIC_DIRECTUS_IMAGE_PROXY_URL in .env');
  process.exit(1);
}

if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
  console.error('Set DIRECTUS_URL (or PUBLIC_DIRECTUS_URL) and DIRECTUS_TOKEN in .env');
  process.exit(1);
}

async function main() {
  console.log('Fetching updates with images from Directus...');

  const res = await fetch(`${DIRECTUS_URL}/items/updates?limit=200&fields=id,title,image,image_url`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, Accept: 'application/json' },
  });

  if (!res.ok) {
    console.error('Fetch failed:', res.status, await res.text());
    process.exit(1);
  }

  const json = await res.json();
  const items = Array.isArray(json.data) ? json.data : [];

  const toProcess = items
    .map((item) => {
      const fileId = item.image && (typeof item.image === 'string' ? item.image : item.image?.id);
      if (!fileId) {
        const m = item.image_url?.match(/\/assets\/([a-f0-9-]+)/i);
        if (m) return { id: item.id, title: item.title, fileId: m[1] };
        return null;
      }
      return { id: item.id, title: item.title, fileId };
    })
    .filter(Boolean);

  const capped = limit ? toProcess.slice(0, limit) : toProcess;

  if (capped.length === 0) {
    console.log('No updates with images to process.');
    return;
  }

  console.log(`Found ${toProcess.length} image(s). Processing ${capped.length}...`);

  if (dryRun) {
    capped.forEach(({ title, fileId }) =>
      console.log(`  [dry-run] Would process: ${title} -> ${PROXY_URL}?id=${fileId}`)
    );
    console.log('Run without --dry-run to fetch (triggers face detection + crop).');
    return;
  }

  if (saveDir) {
    mkdirSync(saveDir, { recursive: true });
  }

  let ok = 0;
  let failed = 0;

  for (const { title, fileId } of capped) {
    const url = `${PROXY_URL}?id=${encodeURIComponent(fileId)}`;
    try {
      const imgRes = await fetch(url);
      if (!imgRes.ok) {
        console.warn(`  Failed: ${title} (${imgRes.status})`);
        failed++;
        continue;
      }
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      if (saveDir) {
        const ext = (imgRes.headers.get('content-type') || '').includes('png') ? 'png' : 'jpg';
        const safe = title.replace(/[^a-z0-9-]/gi, '_').slice(0, 50);
        writeFileSync(join(saveDir, `${safe}-${fileId.slice(0, 8)}.${ext}`), buffer);
      }
      ok++;
      process.stdout.write(`\rProcessed ${ok + failed}/${capped.length}...`);
    } catch (err) {
      console.warn(`\n  Error: ${title}: ${err.message}`);
      failed++;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nDone. Processed: ${ok}, Failed: ${failed}`);
  if (saveDir) console.log(`Saved to: ${saveDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
