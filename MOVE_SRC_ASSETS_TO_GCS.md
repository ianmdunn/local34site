# Moving src/assets/ to GCS

This guide explains how to move files from `src/assets/` to GCS. There are trade-offs to consider.

## Current Situation

**`src/assets/` files are:**
- Processed by Astro during build (optimized, hashed)
- Imported directly in components (`import bill20 from '~/assets/bills/20.png'`)
- Used with `getImage()` for optimization
- Always served from your server (`dist/_astro/`)

**Moving to GCS means:**
- ✅ Files served from GCS (faster, less server load)
- ❌ Lose Astro's automatic image optimization
- ❌ Need to change how files are imported/referenced
- ❌ React components need different approach

---

## Option 1: Move to `public/assets/` (Simplest)

**Best for:** Files that don't need optimization (SVGs, already-optimized images)

### Steps:

1. **Move files to `public/assets/`**:
   ```bash
   # Create public/assets structure
   mkdir -p public/assets/{bills,images,logos,favicons,fonts}
   
   # Move files (example)
   cp -r src/assets/bills/* public/assets/bills/
   cp -r src/assets/images/* public/assets/images/
   cp -r src/assets/logos/* public/assets/logos/
   cp -r src/assets/favicons/* public/assets/favicons/
   cp -r src/assets/fonts/* public/assets/fonts/
   ```

2. **Upload to GCS**:
   ```bash
   npm run upload:assets
   ```

3. **Update code to use `getAsset()`**:

   **For Astro components:**
   ```astro
   <!-- Before -->
   import bgImage from '~/assets/images/backgrounds/L34pick_-01.jpg';
   
   <!-- After -->
   import { getAsset } from '~/utils/permalinks';
   const bgImage = getAsset('assets/images/backgrounds/L34pick_-01.jpg');
   ```

   **For React components:**
   ```jsx
   // Before
   import bill20 from '~/assets/bills/20.png';
   
   // After - Option A: Use getAsset helper
   import { getAsset } from '~/utils/permalinks';
   const bill20 = getAsset('assets/bills/20.png');
   
   // After - Option B: Direct GCS URL (if GCS_ENABLED is always true)
   const bill20 = 'https://storage.googleapis.com/local34org-assets/assets/bills/20.png';
   ```

4. **Update `getAsset()` to handle `assets/` prefix** (already works if files are in `public/assets/`)

---

## Option 2: Post-Build Upload (Keeps Optimization)

**Best for:** Files that benefit from Astro's optimization (large images)

This approach keeps files in `src/assets/` for build-time optimization, then uploads the optimized versions to GCS.

### Steps:

1. **Create a post-build script** (`scripts/upload-optimized-assets.js`):

```javascript
#!/usr/bin/env node
import { Storage } from '@google-cloud/storage';
import { readdir, stat, readFileSync } from 'fs/promises';
import { join, relative, resolve } from 'path';
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
if (!bucketName) {
  console.error('Error: GCS_BUCKET_NAME environment variable is required');
  process.exit(1);
}

const storage = new Storage({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});
const bucket = storage.bucket(bucketName);

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
        // Only upload image files from _astro
        if (/\.(jpg|jpeg|png|webp|svg|gif|ico)$/i.test(entry.name)) {
          files.push({
            localPath: fullPath,
            remotePath: `_astro/${relativePath.replace(/\\/g, '/')}`,
          });
        }
      }
    }
  } catch (error) {
    // Directory doesn't exist
  }
  return files;
}

async function main() {
  console.log('Uploading optimized assets from dist/_astro/ to GCS...\n');
  
  const files = await getAllFiles(astroDir, astroDir);
  console.log(`Found ${files.length} optimized asset file(s)\n`);

  for (const file of files) {
    try {
      await bucket.upload(file.localPath, {
        destination: file.remotePath,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });
      console.log(`✓ Uploaded: ${file.remotePath}`);
    } catch (error) {
      console.error(`✗ Error uploading ${file.remotePath}:`, error.message);
    }
  }
  
  console.log(`\n✓ Upload complete!`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

2. **Add to `package.json`**:
   ```json
   {
     "scripts": {
       "upload:optimized": "node scripts/upload-optimized-assets.js",
       "build:gcs": "npm run build && npm run upload:optimized"
     }
   }
   ```

3. **Update HTML rewriting** - Need to modify build output to use GCS URLs for `/_astro/` assets. This requires an Astro integration or post-build script.

**Complexity:** High - requires custom build integration

---

## Option 3: Hybrid Approach (Recommended)

**Best for:** Balance between simplicity and optimization

- **Move large/unoptimized files** → `public/assets/` → GCS
- **Keep optimized images** → `src/assets/` → Server (for Astro optimization)

### Strategy:

1. **Move to `public/assets/`:**
   - `bills/` (small PNGs, don't need optimization)
   - `logos/` (SVGs)
   - `favicons/` (small files)

2. **Keep in `src/assets/`:**
   - `images/backgrounds/` (large JPGs benefit from Astro optimization)
   - `images/WeCantKeepUp.jpg` (large image)

3. **Update code accordingly**

---

## Recommended: Option 1 (Simplest)

For your use case, I recommend **Option 1** - move everything to `public/assets/`:

### Why?
- ✅ Simplest to implement
- ✅ All assets in one place (GCS)
- ✅ Consistent with `public/` folder approach
- ✅ Easy to manage and upload
- ⚠️ You'll need to manually optimize large images before adding them

### Implementation Steps:

1. Move files to `public/assets/`
2. Update imports to use `getAsset()`
3. Upload to GCS
4. Update build process

Would you like me to implement Option 1? I can:
- Create a script to move the files
- Update all the imports
- Update the upload script to handle both `public/` and `public/assets/`
