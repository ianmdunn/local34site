# Hybrid Approach: Astro Optimization + GCS

This setup gives you **both** Astro's automatic image optimization **and** GCS hosting!

## How It Works

1. **Images stay in `src/assets/`** - Astro optimizes them during build
2. **Build creates optimized versions** in `dist/_astro/` (hashed, resized, optimized)
3. **Post-build script uploads** optimized images to GCS
4. **URLs are rewritten** in HTML files to point to GCS instead of `/_astro/`

## Benefits

✅ **Astro optimization** - Automatic resizing, format conversion, hashing
✅ **GCS hosting** - Fast CDN-like delivery, less server load
✅ **Best of both worlds** - Optimized images served from GCS

## Workflow

### Development
```bash
npm run dev
# Images load from src/assets/ (normal development)
```

### Build & Deploy
```bash
# 1. Upload public/ assets (PDFs, SVGs, etc.)
npm run upload:assets

# 2. Build site (optimizes src/assets/ images)
npm run build

# 3. Upload optimized images and rewrite URLs
npm run upload:optimized

# 4. Upload dist/ to your server via FTP
```

### Or use the combined command:
```bash
npm run build:gcs
# This runs: npm run build && npm run upload:optimized
```

## What Gets Uploaded Where

### `public/` folder → GCS (via `upload:assets`)
- `how-we-win/*` - SVGs, PNGs
- `our-contract/*` - PDFs, images
- `zoom-backgrounds/*` - JPGs
- Referenced via `getAsset()` in code

### `dist/_astro/` → GCS (via `upload:optimized`)
- Optimized images from `src/assets/`
- Hashed filenames (e.g., `L34pick_-01.abc123.jpg`)
- Automatically rewritten in HTML to GCS URLs

## File Structure

```
src/assets/
├── images/
│   └── backgrounds/ (12 JPGs) → Optimized → dist/_astro/ → GCS
└── bills/ (7 PNGs) → Optimized → dist/_astro/ → GCS

public/
├── how-we-win/ → GCS (via upload:assets)
├── our-contract/ → GCS (via upload:assets)
└── zoom-backgrounds/ → GCS (via upload:assets)
```

## URL Rewriting

The `upload:optimized` script:
1. Uploads all images from `dist/_astro/` to `gs://bucket/_astro/`
2. Finds all HTML files in `dist/`
3. Rewrites URLs:
   - **Before:** `src="/_astro/image.abc123.jpg"`
   - **After:** `src="https://storage.googleapis.com/bucket/_astro/image.abc123.jpg"`

## Example URLs

**After build + upload:optimized:**
- Hero backgrounds: `https://storage.googleapis.com/local34org-assets/_astro/L34pick_-01.abc123.jpg`
- Game bills: `https://storage.googleapis.com/local34org-assets/_astro/20.def456.png`
- Public assets: `https://storage.googleapis.com/local34org-assets/how-we-win/local-34.svg`

## Troubleshooting

### Images not loading from GCS
- Check `upload:optimized` ran successfully
- Verify HTML files have GCS URLs (not `/_astro/`)
- Check bucket permissions

### Build fails
- Make sure images exist in `src/assets/`
- Check for import errors in components

### URLs not rewritten
- Check `dist/_astro/` has image files
- Verify `GCS_BUCKET_URL` is set correctly
- Check script output for errors

## Notes

- **Optimized images are hashed** - Each build creates new filenames
- **Old images stay in GCS** - Consider cleanup script if storage is a concern
- **Both scripts needed** - `upload:assets` for public/, `upload:optimized` for _astro/
