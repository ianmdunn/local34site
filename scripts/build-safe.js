#!/usr/bin/env node

import { access, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const CONTRACT_BUILD_ENABLED = process.env.CONTRACT_READER_BUILD === 'true';
const TEMP_SUFFIX = '.build-disabled';

/** Always exclude from production build (dev only) */
const DEV_ONLY_PATHS = [
  join(projectRoot, 'src/pages/dev/contract-mdx.astro'),
  join(projectRoot, 'src/pages/updates/index.astro'),
  join(projectRoot, 'src/pages/updates/[slug].astro'),
];

/** Exclude unless CONTRACT_READER_BUILD=true */
const CONTRACT_BUILD_PATHS = [
  join(projectRoot, 'src/pages/2021-2026-contract.astro'),
  join(projectRoot, 'src/pages/contract-extract.astro'),
  join(projectRoot, 'public/2021-2026-contract'),
];

const PRIVATE_DIST_PATHS = [
  join(projectRoot, 'dist/2021-2026-contract'),
  join(projectRoot, 'dist/contract-extract'),
  join(projectRoot, 'dist/dev'),
  join(projectRoot, 'dist/updates'),
];
/** When CONTRACT_READER_BUILD=true, contract dist exists; only assert dev is absent */
const DEV_DIST_PATHS = [join(projectRoot, 'dist/dev')];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, env) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      env,
    });
    child.on('error', rejectPromise);
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function hidePrivateBuildInputs() {
  const moved = [];
  const toHide = [
    ...DEV_ONLY_PATHS,
    ...(CONTRACT_BUILD_ENABLED ? [] : CONTRACT_BUILD_PATHS),
  ];
  for (const originalPath of toHide) {
    if (!(await exists(originalPath))) continue;
    const hiddenPath = `${originalPath}${TEMP_SUFFIX}`;
    await rename(originalPath, hiddenPath);
    moved.push({ originalPath, hiddenPath });
  }
  return moved;
}

async function restoreHiddenInputs(moved) {
  for (let i = moved.length - 1; i >= 0; i--) {
    const { originalPath, hiddenPath } = moved[i];
    if (await exists(hiddenPath)) {
      await rename(hiddenPath, originalPath);
    }
  }
}

/** Enable contract pages for build when only .build-disabled versions exist */
async function ensureContractPagesEnabled() {
  const enabled = [];
  for (const originalPath of CONTRACT_BUILD_PATHS) {
    if (await exists(originalPath)) continue;
    const hiddenPath = `${originalPath}${TEMP_SUFFIX}`;
    if (await exists(hiddenPath)) {
      await rename(hiddenPath, originalPath);
      enabled.push({ originalPath, hiddenPath });
    }
  }
  if (enabled.length) {
    console.log('[build-safe] Enabled contract pages for build');
  }
  return enabled;
}

/** Restore contract pages to .build-disabled after build */
async function restoreContractPagesDisabled(enabled) {
  for (let i = enabled.length - 1; i >= 0; i--) {
    const { originalPath, hiddenPath } = enabled[i];
    if (await exists(originalPath)) {
      await rename(originalPath, hiddenPath);
    }
  }
}

async function assertPrivateDistPathsAbsent(paths) {
  const present = [];
  for (const path of paths) {
    if (await exists(path)) present.push(path);
  }
  if (present.length > 0) {
    throw new Error(`Private paths were generated in dist: ${present.join(', ')}`);
  }
}

async function main() {
  const env = { ...process.env, NODE_OPTIONS: '--no-deprecation' };
  let moved = [];

  let enabled = [];
  try {
    moved = await hidePrivateBuildInputs();
    if (moved.length) {
      console.log('[build-safe] Hiding dev/private routes for this build');
    }
    if (CONTRACT_BUILD_ENABLED) {
      enabled = await ensureContractPagesEnabled();
      if (enabled.length) {
        console.log('[build-safe] CONTRACT_READER_BUILD=true, contract routes enabled');
      }
    }

    await run('npm', ['run', 'astro', '--', 'build'], env);

    if (!CONTRACT_BUILD_ENABLED) {
      await assertPrivateDistPathsAbsent(PRIVATE_DIST_PATHS);
      console.log('[build-safe] Verified private contract routes are absent from dist');
    } else {
      await assertPrivateDistPathsAbsent(DEV_DIST_PATHS);
      console.log('[build-safe] Verified dev routes are absent from dist');
    }

    if (CONTRACT_BUILD_ENABLED) {
      await run('node', ['scripts/split-contract-sections.js'], env);
    } else {
      console.log('[build-safe] Skipped split-contract-sections (private contract build disabled)');
    }
  } finally {
    await restoreHiddenInputs(moved);
    await restoreContractPagesDisabled(enabled);
  }
}

main().catch((error) => {
  console.error('[build-safe]', error);
  process.exit(1);
});
