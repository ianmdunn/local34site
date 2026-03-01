#!/usr/bin/env node
/**
 * Ensures the contract page is available for dev (not .build-disabled).
 * Run before `astro dev` so the contract route works at /2021-2026-contract.
 */
import { rename } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const contractPage = join(projectRoot, 'src/pages/2021-2026-contract.astro');
const disabledPage = `${contractPage}.build-disabled`;
const contractSectionsDir = join(projectRoot, 'public/contract-sections');
const disabledSectionsDir = `${contractSectionsDir}.build-disabled`;

async function ensureContractEnabled() {
  try {
    await rename(disabledPage, contractPage);
    console.log('[ensure-contract-dev] Enabled 2021-2026-contract page for dev');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    // .astro exists or neither exists — nothing to do
  }

  try {
    await rename(disabledSectionsDir, contractSectionsDir);
    console.log('[ensure-contract-dev] Restored contract sections for dev');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    // sections dir exists or neither exists — nothing to do
  }
}

ensureContractEnabled().catch((err) => {
  console.error('[ensure-contract-dev]', err.message);
  process.exit(1);
});
