#!/usr/bin/env node

/**
 * Audit dist/pagefind for contract-related relics.
 *
 * If dist contained 2021-2026-contract, contract-extract, or contract-sections
 * when pagefind ran, the index would have indexed them. This script checks
 * whether those paths exist in dist (indicating the pagefind index may have relics).
 *
 * Usage:
 *   node scripts/audit-dist-pagefind.js
 *
 * Run after build. Exits 1 if relics may exist (contract dirs present in dist).
 */

import { stat } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const distDir = join(projectRoot, 'dist');
const pagefindDir = join(distDir, 'pagefind');

const RELIC_PATHS = [
  '2021-2026-contract',
  'contract-extract',
  'contract-sections',
];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(distDir))) {
    console.log('dist/ does not exist — nothing to audit.');
    return;
  }

  if (!(await exists(pagefindDir))) {
    console.log('dist/pagefind/ does not exist — nothing to audit.');
    return;
  }

  const present = [];
  for (const name of RELIC_PATHS) {
    if (await exists(join(distDir, name))) {
      present.push(name);
    }
  }

  if (present.length === 0) {
    console.log('✓ dist/pagefind audit: no contract relics in dist (index is clean).');
    return;
  }

  console.error('✗ Pagefind relics: these paths exist in dist and were likely indexed:\n');
  for (const p of present) {
    console.error(`  dist/${p}/`);
  }
  console.error('\nRun "npm run cleanup:dist" to remove them and regenerate the pagefind index.');
  process.exit(1);
}

main().catch((err) => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});
