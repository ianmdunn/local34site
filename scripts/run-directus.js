#!/usr/bin/env node
/**
 * Pull fresh Directus data and rebuild the site.
 * Directus content is fetched at build time; this script validates connectivity
 * then runs the Astro build so the site is generated with the latest CMS data.
 *
 * Usage:
 *   npm run run:directus          # Validate Directus + build
 *   npm run run:directus -- --deploy   # Build + deploy (FTP push)
 *
 * Requires: .env with PUBLIC_DIRECTUS_URL (and DIRECTUS_TOKEN if collections need auth)
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Load .env into process.env
function loadEnv() {
  const envPath = join(projectRoot, '.env');
  try {
    const envFile = readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eq = trimmed.indexOf('=');
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
          process.env[key] = val;
        }
      }
    });
  } catch {
    // .env optional
  }
}

const DIRECTUS_URL = (process.env.PUBLIC_DIRECTUS_URL || process.env.DIRECTUS_URL || '').replace(/\/$/, '');
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN?.trim();

async function pingDirectus() {
  if (!DIRECTUS_URL) {
    console.error('PUBLIC_DIRECTUS_URL or DIRECTUS_URL not set in .env');
    process.exit(1);
  }
  const url = `${DIRECTUS_URL}/server/ping`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      console.log(`Directus: reachable (${DIRECTUS_URL})`);
      if (data?.status) console.log(`  Status: ${data.status}`);
    } else {
      console.warn(`Directus ping returned ${res.status} (continuing anyway)`);
    }
  } catch (err) {
    console.error('Directus unreachable:', err.message);
    console.error('Check PUBLIC_DIRECTUS_URL and network. Build will likely fail.');
    process.exit(1);
  }
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, NODE_OPTIONS: '--no-deprecation' },
      ...options,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const doDeploy = args.includes('--deploy');

  loadEnv();

  console.log('\n📡 run-directus: pull fresh Directus data and rebuild site\n');
  await pingDirectus();

  if (doDeploy) {
    console.log('\n🚀 Running full deploy (build + FTP push)...\n');
    await run('node', ['scripts/deploy-with-progress.js']);
  } else {
    console.log('\n🔨 Building site (fetches Directus at build time)...\n');
    await run('npm', ['run', 'build']);
    console.log('\n✓ Build complete. Output in dist/.');
    console.log('  Run with --deploy to also push to the live site.');
  }
}

main().catch((err) => {
  console.error('\n✗', err.message);
  process.exit(1);
});
