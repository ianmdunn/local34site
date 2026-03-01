#!/usr/bin/env node

/**
 * Upload nginx/nginx.conf to the server via FTP.
 * Uses DEPLOY_FTP_* and DEPLOY_PATH from .env.
 *
 * The file is uploaded as nginx-local34.conf alongside the site. You'll need to
 * move it to /etc/nginx/ and reload nginx via SSH (FTP typically can't write there).
 *
 * Usage: node scripts/deploy-ftp-nginx.js
 */

import { Client } from 'basic-ftp';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

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

const LOCAL_FILE = join(projectRoot, 'nginx', 'nginx.conf');
const REMOTE_FILE = 'nginx-local34.conf';

if (!HOST || !USER || !PASS || !REMOTE_PATH) {
  console.error('>>> Missing: DEPLOY_FTP_HOST, DEPLOY_FTP_USER, DEPLOY_FTP_PASSWORD, DEPLOY_PATH in .env');
  process.exit(1);
}

async function main() {
  const content = readFileSync(LOCAL_FILE, 'utf-8');

  console.log('');
  console.log(`>>> Uploading nginx config to ftp://${HOST}:${PORT}${REMOTE_PATH}/${REMOTE_FILE}`);
  console.log('');

  const client = new Client(30_000);

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
    await client.uploadFrom(LOCAL_FILE, REMOTE_FILE);

    console.log(`✓ Uploaded ${REMOTE_FILE}`);
    console.log('');
    console.log('Next steps (SSH access required to activate):');
    console.log(`  1. ssh to your server`);
    console.log(`  2. sudo cp <your-site-dir>/${REMOTE_FILE} /etc/nginx/nginx.conf`);
    console.log(`  3. sudo nginx -t && sudo systemctl reload nginx`);
    console.log('');
  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
