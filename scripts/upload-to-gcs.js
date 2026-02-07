#!/usr/bin/env node

/**
 * Upload public assets to Google Cloud Storage
 * 
 * Usage:
 *   node scripts/upload-to-gcs.js [options]
 * 
 * Options:
 *   --dry-run    Show what would be uploaded without actually uploading
 *   --bucket     Override bucket name from env var
 *   --path       Upload only a specific path (e.g., "how-we-win")
 *   --delete     Delete files in GCS that don't exist locally
 * 
 * Environment variables:
 *   GCS_BUCKET_NAME    - GCS bucket name (required)
 *   GOOGLE_APPLICATION_CREDENTIALS - Path to service account JSON (optional, uses default credentials if not set)
 */

import { Storage } from '@google-cloud/storage';
import { readdir, stat } from 'fs/promises';
import { readFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const publicDir = join(projectRoot, 'public');

// Load .env file
const envPath = join(projectRoot, '.env');
try {
  const envFile = readFileSync(envPath, 'utf-8');
  const envVars = {};
  envFile.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  // Set environment variables
  Object.assign(process.env, envVars);
} catch (error) {
  // .env file doesn't exist or can't be read, that's okay
}

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const deleteFlag = args.includes('--delete');
const bucketArg = args.find(arg => arg.startsWith('--bucket='))?.split('=')[1];
const pathArg = args.find(arg => arg.startsWith('--path='))?.split('=')[1];

const bucketName = bucketArg || process.env.GCS_BUCKET_NAME;

if (!bucketName) {
  console.error('Error: GCS_BUCKET_NAME environment variable or --bucket argument is required');
  console.error('\nExample:');
  console.error('  GCS_BUCKET_NAME=my-bucket node scripts/upload-to-gcs.js');
  console.error('  node scripts/upload-to-gcs.js --bucket=my-bucket');
  process.exit(1);
}

// Initialize GCS client
let storage;
try {
  storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
} catch (error) {
  console.error('Error initializing Google Cloud Storage:', error.message);
  console.error('\nMake sure you have:');
  console.error('  1. Installed @google-cloud/storage: npm install --save-dev @google-cloud/storage');
  console.error('  2. Set up authentication (see GCS_SETUP.md)');
  process.exit(1);
}

const bucket = storage.bucket(bucketName);

/**
 * Recursively get all files in a directory
 */
async function getAllFiles(dir, baseDir = dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath, baseDir);
      files.push(...subFiles);
    } else {
      files.push({
        localPath: fullPath,
        remotePath: relativePath.replace(/\\/g, '/'), // Normalize to forward slashes
      });
    }
  }

  return files;
}

/**
 * Get all files currently in GCS bucket
 */
async function getRemoteFiles() {
  const [files] = await bucket.getFiles();
  return files.map(file => file.name);
}

/**
 * Upload a file to GCS
 */
async function uploadFile(localPath, remotePath) {
  if (isDryRun) {
    console.log(`[DRY RUN] Would upload: ${remotePath}`);
    return;
  }

  await bucket.upload(localPath, {
    destination: remotePath,
    metadata: {
      cacheControl: 'public, max-age=31536000', // 1 year cache
    },
  });
  console.log(`✓ Uploaded: ${remotePath}`);
}

/**
 * Delete a file from GCS
 */
async function deleteFile(remotePath) {
  if (isDryRun) {
    console.log(`[DRY RUN] Would delete: ${remotePath}`);
    return;
  }

  await bucket.file(remotePath).delete();
  console.log(`✗ Deleted: ${remotePath}`);
}

/**
 * Main upload function
 */
async function main() {
  console.log(`\n${isDryRun ? '[DRY RUN] ' : ''}Uploading assets to GCS bucket: ${bucketName}\n`);

  // Check if bucket exists
  const [exists] = await bucket.exists();
  if (!exists) {
    console.error(`Error: Bucket "${bucketName}" does not exist`);
    console.error('\nCreate it with:');
    console.error(`  gsutil mb gs://${bucketName}`);
    console.error(`  gsutil iam ch allUsers:objectViewer gs://${bucketName}`);
    process.exit(1);
  }

  // Get all local files
  let localFiles;
  if (pathArg) {
    const targetDir = join(publicDir, pathArg);
    try {
      await stat(targetDir);
      localFiles = await getAllFiles(targetDir, publicDir);
      // Filter to only files in the specified path
      localFiles = localFiles.filter(f => f.remotePath.startsWith(pathArg));
    } catch (error) {
      console.error(`Error: Path "${pathArg}" does not exist in public directory`);
      process.exit(1);
    }
  } else {
    localFiles = await getAllFiles(publicDir);
  }

  console.log(`Found ${localFiles.length} local file(s) to upload\n`);

  // Upload files
  let uploaded = 0;
  let skipped = 0;

  for (const file of localFiles) {
    try {
      // Check if file exists in bucket
      const [exists] = await bucket.file(file.remotePath).exists();
      
      if (exists) {
        // Compare file sizes to determine if upload is needed
        const [localStats] = await stat(file.localPath);
        const [remoteFile] = await bucket.file(file.remotePath).getMetadata();
        
        if (localStats.size === parseInt(remoteFile.size)) {
          skipped++;
          if (!isDryRun) {
            console.log(`⊘ Skipped (unchanged): ${file.remotePath}`);
          }
          continue;
        }
      }

      await uploadFile(file.localPath, file.remotePath);
      uploaded++;
    } catch (error) {
      console.error(`✗ Error uploading ${file.remotePath}:`, error.message);
    }
  }

  // Delete remote files that don't exist locally (if --delete flag is set)
  if (deleteFlag) {
    const remoteFiles = await getRemoteFiles();
    const localPaths = new Set(localFiles.map(f => f.remotePath));
    const toDelete = remoteFiles.filter(remote => !localPaths.has(remote));

    if (toDelete.length > 0) {
      console.log(`\nFound ${toDelete.length} remote file(s) to delete\n`);
      for (const remotePath of toDelete) {
        await deleteFile(remotePath);
      }
    }
  }

  console.log(`\n${isDryRun ? '[DRY RUN] ' : ''}Summary:`);
  console.log(`  Uploaded: ${uploaded}`);
  console.log(`  Skipped: ${skipped}`);
  if (deleteFlag) {
    const remoteFiles = await getRemoteFiles();
    const localPaths = new Set(localFiles.map(f => f.remotePath));
    const deleted = remoteFiles.filter(remote => !localPaths.has(remote)).length;
    console.log(`  Deleted: ${deleted}`);
  }
  console.log('');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
