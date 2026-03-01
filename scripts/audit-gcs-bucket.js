#!/usr/bin/env node

/**
 * Audit GCS bucket for objects that should not be there (draft/private contract content).
 *
 * Usage:
 *   node scripts/audit-gcs-bucket.js [--bucket=name] [--delete]
 *
 * Options:
 *   --delete   Delete found forbidden objects (requires confirmation)
 *
 * Environment: Load .env (GCS_BUCKET_NAME, GOOGLE_APPLICATION_CREDENTIALS)
 */

import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getBucket } from './gcs-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Paths that must NEVER be in the public bucket (draft contract, private content)
const FORBIDDEN_PREFIXES = [
  '2021-2026-contract/',
  '2021-2026-contract', // root object
  'contract-sections/',
  'contract-extract/',
  'contract-extract',  // root object
];

// Load .env
const envPath = join(projectRoot, '.env');
try {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
} catch {
  // .env optional
}

const bucketArg = process.argv.find((arg) => arg.startsWith('--bucket='));
const doDelete = process.argv.includes('--delete');
const bucketName = bucketArg?.split('=')[1] || process.env.GCS_BUCKET_NAME || 'local34site-assetfiles';

function isForbidden(name) {
  return FORBIDDEN_PREFIXES.some((prefix) => name === prefix || name.startsWith(prefix));
}

async function main() {
  console.log(`\nAuditing gs://${bucketName} for forbidden objects...\n`);

  const { bucket } = await getBucket(bucketName);
  const [exists] = await bucket.exists();
  if (!exists) {
    console.error(`Bucket gs://${bucketName} does not exist or is not accessible`);
    process.exit(1);
  }

  const forbidden = [];
  let total = 0;
  let pageToken;

  do {
    const [files, , response] = await bucket.getFiles({ autoPaginate: false, pageToken });
    pageToken = response?.nextPageToken;

    for (const file of files) {
      total++;
      if (isForbidden(file.name)) {
        forbidden.push(file.name);
      }
    }
  } while (pageToken);

  if (forbidden.length === 0) {
    console.log(`✓ No forbidden objects found (scanned ${total} objects)`);
    console.log('');
    return;
  }

  console.error('✗ FORBIDDEN OBJECTS FOUND (draft contract / private content):\n');
  for (const name of forbidden) {
    console.error(`  gs://${bucketName}/${name}`);
  }
  console.error(`\nTotal forbidden: ${forbidden.length}`);

  if (doDelete) {
    console.error('\nDeleting forbidden objects...');
    let deleted = 0;
    for (const name of forbidden) {
      try {
        await bucket.file(name).delete();
        console.error(`  Deleted: ${name}`);
        deleted++;
      } catch (err) {
        console.error(`  Failed to delete ${name}: ${err.message}`);
      }
    }
    console.error(`\nDeleted ${deleted} of ${forbidden.length} forbidden objects.`);
    process.exit(deleted < forbidden.length ? 1 : 0);
  }

  console.error('\nTo delete these, run:');
  console.error(`  node scripts/audit-gcs-bucket.js --delete`);
  console.error('\nOr manually:');
  console.error(`  gsutil -m rm -r gs://${bucketName}/contract-sections/`);
  console.error(`  gsutil -m rm -r gs://${bucketName}/2021-2026-contract/`);
  console.error('');
  process.exit(1);
}

main().catch((err) => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});
