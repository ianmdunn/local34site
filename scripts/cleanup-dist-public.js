#!/usr/bin/env node

/**
 * Clean dist/ for server upload – remove assets that are served from GCS
 *
 * Run this AFTER upload:optimized so dist/ only contains:
 * - HTML pages
 * - _astro/ JS and CSS (needed for the site)
 *
 * Removes:
 * 1. Public folder copies (served from GCS via upload:assets)
 * 2. _astro images and other static assets (served from GCS via upload:optimized)
 *
 * Usage:
 *   node scripts/cleanup-dist-public.js
 */

import { readdir, stat, rm } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const distDir = join(projectRoot, 'dist');
const astroDir = join(distDir, '_astro');

// Extensions of _astro files uploaded to GCS by upload:optimized (remove from dist)
const GCS_ASSET_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.ico', '.avif'];

// Folders to remove entirely (no index.html inside – assets served from GCS)
const FOLDERS_TO_REMOVE = ['zoom-backgrounds', 'hero-backgrounds', 'fonts'];

// Folders that contain BOTH index.html (page) and assets – remove only assets, keep index.html
const FOLDERS_WITH_PAGES = ['how-we-win', 'our-contract'];

// Files to remove from dist root
const FILES_TO_REMOVE = ['robots.txt', '_headers'];

const ASSET_EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.pdf', '.avif'];

async function removePublicCopies() {
  let removed = 0;

  // Remove entire folders (no pages inside)
  for (const item of FOLDERS_TO_REMOVE) {
    const distPath = join(distDir, item);
    try {
      await stat(distPath);
      await rm(distPath, { recursive: true, force: true });
      console.log(`  ✓ Removed: dist/${item}`);
      removed++;
    } catch {
      // Doesn't exist
    }
  }

  // For how-we-win and our-contract: remove only asset files, keep index.html
  for (const folder of FOLDERS_WITH_PAGES) {
    const folderPath = join(distDir, folder);
    try {
      const entries = await readdir(folderPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name !== 'index.html') {
          const ext = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase();
          if (ASSET_EXTENSIONS.includes(ext)) {
            await rm(join(folderPath, entry.name), { force: true });
            console.log(`  ✓ Removed: dist/${folder}/${entry.name}`);
            removed++;
          }
        }
      }
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
    }
  }

  // Remove root files
  for (const item of FILES_TO_REMOVE) {
    const distPath = join(distDir, item);
    try {
      await stat(distPath);
      await rm(distPath, { force: true });
      console.log(`  ✓ Removed: dist/${item}`);
      removed++;
    } catch {
      // Doesn't exist
    }
  }

  return removed;
}

async function removeAstroAssets() {
  let removed = 0;
  try {
    const entries = await readdir(astroDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase();
      if (GCS_ASSET_EXTENSIONS.includes(ext)) {
        const fullPath = join(astroDir, entry.name);
        await rm(fullPath, { force: true });
        console.log(`  ✓ Removed: _astro/${entry.name}`);
        removed++;
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return removed;
}

async function main() {
  console.log('\nCleaning dist/ for server upload (removing GCS assets)...\n');

  const publicRemoved = await removePublicCopies();
  const astroRemoved = await removeAstroAssets();

  console.log(`\n✓ Cleanup complete:`);
  console.log(`  Public copies removed: ${publicRemoved}`);
  console.log(`  _astro assets removed: ${astroRemoved}`);
  console.log(`  dist/ is ready for server upload (HTML + JS + CSS only)\n`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
