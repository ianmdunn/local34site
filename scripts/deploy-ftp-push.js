#!/usr/bin/env node

/**
 * Push dist/ to live site via FTP with [N/M] progress.
 * Mirrors local dist/ to remote (uploads new/changed, deletes removed).
 *
 * Env: DEPLOY_FTP_HOST, DEPLOY_FTP_USER, DEPLOY_FTP_PASSWORD, DEPLOY_PATH, DEPLOY_FTP_PORT
 *       DEPLOY_FTP_SECURE - set to "true" for FTPS (FTP over TLS)
 */

import { Client } from 'basic-ftp';
import { readdir, stat } from 'fs/promises';
import { readFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const distDir = join(projectRoot, 'dist');

// Load .env
try {
  const env = readFileSync(join(projectRoot, '.env'), 'utf-8');
  for (const line of env.split('\n')) {
    const t = line.trim();
    if (t && !t.startsWith('#')) {
      const idx = t.indexOf('=');
      if (idx > 0) {
        const k = t.slice(0, idx).trim();
        const v = t.slice(idx + 1).trim();
        if (!(k in process.env)) process.env[k] = v;
      }
    }
  }
} catch {}

const HOST = (process.env.DEPLOY_FTP_HOST || '').trim();
const USER = (process.env.DEPLOY_FTP_USER || '').trim();
const PASS = process.env.DEPLOY_FTP_PASSWORD || '';
const REMOTE_PATH = (process.env.DEPLOY_PATH || '').trim();
const PORT = parseInt(process.env.DEPLOY_FTP_PORT || '21', 10);
const SECURE = (process.env.DEPLOY_FTP_SECURE || '').toLowerCase() === 'true';
const isDryRun = process.argv.includes('--dry-run');

if (!HOST || !USER || !PASS || !REMOTE_PATH) {
  console.error('>>> FTP push skipped: DEPLOY_FTP_HOST, DEPLOY_FTP_USER, DEPLOY_FTP_PASSWORD, DEPLOY_PATH required in .env');
  console.error('    Deploy cannot complete without FTP upload. Add credentials and re-run.');
  process.exit(process.argv.includes('--dry-run') ? 0 : 1);
}

async function getAllFiles(dir, base = dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.name === '.DS_Store') continue;
    if (e.isDirectory()) {
      files.push(...(await getAllFiles(full, base)));
    } else {
      files.push(relative(base, full).replace(/\\/g, '/'));
    }
  }
  return files;
}

async function listRemoteRecursive(client, dir, base = '') {
  const items = await client.list(dir || '.');
  const files = [];
  for (const f of items) {
    if (f.name === '.' || f.name === '..') continue;
    const full = base ? `${base}/${f.name}` : f.name;
    if (f.isDirectory) {
      files.push(...(await listRemoteRecursive(client, full, full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const start = Date.now();

  try {
    await stat(distDir);
  } catch {
    console.error('Fatal: dist/ not found. Run build first.');
    process.exit(1);
  }

  const localFiles = await getAllFiles(distDir, distDir);
  const total = localFiles.length;

  console.log('');
  console.log(`>>> Pushing dist/ to ftp://${HOST}:${PORT}${REMOTE_PATH}`);
  if (isDryRun) console.log('    (dry run)');
  console.log(`    ${total} file(s) to sync`);
  console.log('');

  if (isDryRun) {
    console.log('[DRY RUN] Would upload:', localFiles.slice(0, 10).join(', '), total > 10 ? `... +${total - 10} more` : '');
    console.log('');
    return;
  }

  const client = new Client(60_000);

  try {
    await client.access({
      host: HOST,
      port: PORT,
      user: USER,
      password: PASS,
      secure: SECURE,
      secureOptions: SECURE ? { rejectUnauthorized: false } : undefined,
    });
    client.ftp.verbose = false;

    await client.ensureDir(REMOTE_PATH);
    await client.cd(REMOTE_PATH);

    // Ensure all parent dirs exist (ensureDir changes cwd, so reset each time)
    const parents = [...new Set(localFiles.map((r) => (r.includes('/') ? r.replace(/\/[^/]+$/, '') : null)).filter(Boolean))].sort();
    for (const p of parents) {
      await client.cd(REMOTE_PATH);
      await client.ensureDir(p);
    }
    await client.cd(REMOTE_PATH);

    // Upload with progress
    const localSet = new Set(localFiles);
    let uploaded = 0;
    let idx = 0;

    for (const rel of localFiles) {
      idx++;
      const localPath = join(distDir, rel);
      process.stdout.write(`[${idx}/${total}] `);
      await client.uploadFrom(localPath, rel);
      console.log(`✓ ${rel}`);
      uploaded++;
    }

    // Delete remote files not in local
    const remoteFiles = await listRemoteRecursive(client, '.', '');
    const toDelete = remoteFiles.filter((r) => !localSet.has(r));
    for (const r of toDelete) {
      try {
        await client.remove(r);
        console.log(`✗ Deleted: ${r}`);
      } catch (e) {
        console.error(`  (could not remove ${r}: ${e.message})`);
      }
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log('');
    console.log(`✓ FTP push complete — ${uploaded} uploaded, ${toDelete.length} deleted — ${elapsed}s`);
  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
