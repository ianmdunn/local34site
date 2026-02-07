#!/usr/bin/env node

/**
 * Upload optimized assets from dist/_astro/ to Google Cloud Storage
 * and rewrite URLs in HTML and JS files to point to GCS.
 * 
 * This script:
 * 1. Uploads optimized images from dist/_astro/ to GCS
 * 2. Rewrites URLs in HTML and JS files from /_astro/ to GCS URLs
 *    (HTML: src, srcset, inline styles; JS: image imports used by CatchTheCash, etc.)
 * 
 * Usage:
 *   node scripts/upload-optimized-to-gcs.js
 */

import { Storage } from '@google-cloud/storage';
import { readdir, stat, readFile, writeFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { join, relative, resolve, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const distDir = join(projectRoot, 'dist');
const astroDir = join(distDir, '_astro');

// Load .env
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
  Object.assign(process.env, envVars);
} catch (error) {
  // .env file doesn't exist
}

const bucketName = process.env.GCS_BUCKET_NAME;
const bucketUrl = process.env.GCS_BUCKET_URL;

if (!bucketName || !bucketUrl) {
  console.error('Error: GCS_BUCKET_NAME and GCS_BUCKET_URL environment variables are required');
  process.exit(1);
}

const storage = new Storage({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});
const bucket = storage.bucket(bucketName);

// Track uploaded files for URL rewriting
const uploadedFiles = new Map(); // local path -> GCS path

async function getAllFiles(dir, baseDir = dir) {
  const files = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(baseDir, fullPath);
      if (entry.isDirectory()) {
        const subFiles = await getAllFiles(fullPath, baseDir);
        files.push(...subFiles);
      } else {
        // Only upload image files
        const ext = extname(entry.name).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.ico', '.avif'].includes(ext)) {
          files.push({
            localPath: fullPath,
            relativePath: relativePath.replace(/\\/g, '/'),
          });
        }
      }
    }
  } catch (error) {
    // Directory doesn't exist
  }
  return files;
}

async function uploadFile(localPath, remotePath) {
  try {
    await bucket.upload(localPath, {
      destination: `_astro/${remotePath}`,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });
    console.log(`✓ Uploaded: _astro/${remotePath}`);
    return `_astro/${remotePath}`;
  } catch (error) {
    console.error(`✗ Error uploading ${remotePath}:`, error.message);
    return null;
  }
}

async function rewriteHtmlUrls() {
  const htmlFiles = [];
  
  async function findHtmlFiles(dir) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await findHtmlFiles(fullPath);
        } else if (entry.name.endsWith('.html')) {
          htmlFiles.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist
    }
  }
  
  await findHtmlFiles(distDir);
  
  const baseUrl = bucketUrl.replace(/\/$/, '');
  let rewrittenCount = 0;
  
  for (const htmlFile of htmlFiles) {
    try {
      let content = await readFile(htmlFile, 'utf-8');
      let modified = false;
      
      // Rewrite /_astro/ URLs to GCS URLs
      // 1. Match quoted URLs: src="/_astro/image.hash.jpg" or srcset="/_astro/image.hash.jpg 1920w"
      const astroUrlPattern = /(["'])\/_astro\/([^"']+)\1/g;
      content = content.replace(astroUrlPattern, (match, quote, path) => {
        const gcsPath = `_astro/${path}`;
        if (uploadedFiles.has(gcsPath)) {
          modified = true;
          return `${quote}${baseUrl}/${gcsPath}${quote}`;
        }
        return match;
      });

      // 2. Match url() in inline styles: style="--var: url(/_astro/image.hash.jpg)"
      const urlStylePattern = /url\(\/_astro\/([^)]+)\)/g;
      content = content.replace(urlStylePattern, (match, path) => {
        const gcsPath = `_astro/${path}`;
        if (uploadedFiles.has(gcsPath)) {
          modified = true;
          return `url(${baseUrl}/${gcsPath})`;
        }
        return match;
      });
      
      if (modified) {
        await writeFile(htmlFile, content, 'utf-8');
        rewrittenCount++;
        console.log(`✓ Rewrote URLs in: ${relative(distDir, htmlFile)}`);
      }
    } catch (error) {
      console.error(`✗ Error rewriting ${htmlFile}:`, error.message);
    }
  }
  
  return rewrittenCount;
}

async function rewriteJsUrls() {
  const jsFiles = [];
  try {
    const entries = await readdir(astroDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.js')) {
        jsFiles.push(join(astroDir, entry.name));
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const baseUrl = bucketUrl.replace(/\/$/, '');
  let rewrittenCount = 0;

  for (const jsFile of jsFiles) {
    try {
      let content = await readFile(jsFile, 'utf-8');
      let modified = false;

      // Match /_astro/... in JS (quoted strings, template literals, etc.)
      const astroUrlPattern = /(["'`])\/_astro\/([^"'`]+)\1/g;
      content = content.replace(astroUrlPattern, (match, quote, path) => {
        const gcsPath = `_astro/${path}`;
        if (uploadedFiles.has(gcsPath)) {
          modified = true;
          return `${quote}${baseUrl}/${gcsPath}${quote}`;
        }
        return match;
      });

      if (modified) {
        await writeFile(jsFile, content, 'utf-8');
        rewrittenCount++;
        console.log(`✓ Rewrote URLs in: _astro/${relative(astroDir, jsFile)}`);
      }
    } catch (error) {
      console.error(`✗ Error rewriting ${jsFile}:`, error.message);
    }
  }

  return rewrittenCount;
}

async function main() {
  console.log('\nUploading optimized assets from dist/_astro/ to GCS...\n');
  
  // Check if dist/_astro exists
  try {
    await stat(astroDir);
  } catch (error) {
    console.error('Error: dist/_astro/ directory not found. Run "npm run build" first.');
    process.exit(1);
  }
  
  const files = await getAllFiles(astroDir, astroDir);
  console.log(`Found ${files.length} optimized asset file(s)\n`);

  // Upload files
  for (const file of files) {
    const gcsPath = await uploadFile(file.localPath, file.relativePath);
    if (gcsPath) {
      uploadedFiles.set(gcsPath, true);
    }
  }
  
  console.log(`\n✓ Uploaded ${uploadedFiles.size} file(s) to GCS`);
  
  // Rewrite HTML URLs
  console.log('\nRewriting URLs in HTML files...\n');
  const htmlRewritten = await rewriteHtmlUrls();

  // Rewrite JS URLs (image imports in CatchTheCash, etc.)
  console.log('\nRewriting URLs in JS files...\n');
  const jsRewritten = await rewriteJsUrls();
  
  console.log(`\n✓ Summary:`);
  console.log(`  Uploaded: ${uploadedFiles.size} file(s)`);
  console.log(`  HTML files updated: ${htmlRewritten}`);
  console.log(`  JS files updated: ${jsRewritten}`);
  console.log('');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
