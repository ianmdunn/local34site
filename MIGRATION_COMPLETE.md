# Migration Complete: src/assets/images → public/images

## What Was Moved

✅ **Files moved from `src/assets/images/` to `public/images/`:**
- `backgrounds/` (12 hero background JPGs)
- `Artboard 1.svg` and `Artboard 2.svg` (game assets)
- `WeCantKeepUp.jpg` (Yale's Wealth page)

✅ **Files moved from `src/assets/bills/` to `public/bills/`:**
- All bill PNGs (1, 2, 5, 10, 20, 50, 100)

## Code Updates

✅ **Updated files:**
- `src/pages/index.astro` - Hero backgrounds now use `getAsset()`
- `src/components/islands/CatchTheCash.jsx` - Bill and dog images use `getAsset()`
- `src/pages/yales-wealth.astro` - Background image uses `getAsset()`
- `src/components/widgets/Hero.astro` - Fallback backgrounds use `getAsset()`

## Next Steps

1. **Upload to GCS:**
   ```bash
   npm run upload:assets
   ```
   This will upload all files from `public/` including the newly moved images.

2. **Test locally:**
   ```bash
   # Make sure GCS_ENABLED=true in .env
   npm run build
   npm run preview
   ```
   Verify images load from GCS URLs.

3. **Remove old files (optional):**
   ```bash
   # After confirming everything works, you can delete:
   rm -rf src/assets/images/
   rm -rf src/assets/bills/
   ```

## Notes

⚠️ **Trade-offs:**
- ✅ All images now served from GCS (faster, less server load)
- ✅ Consistent with `public/` folder approach
- ❌ Lost Astro's automatic image optimization (resizing, format conversion)
- ⚠️ You'll need to manually optimize large images before adding them

⚠️ **Utils still reference `src/assets/images`:**
- `src/utils/images.ts` - Uses `import.meta.glob()` for `~/assets/images/`
- `src/utils/blog.ts` - Uses `import.meta.glob()` for blog images
- These won't find images anymore, but they're likely not actively used (blog is disabled)
- If needed later, update these to use `getAsset()` or look in `public/images/`

## File Structure

**Before:**
```
src/assets/
├── images/
│   ├── backgrounds/ (12 JPGs)
│   ├── Artboard 1.svg
│   ├── Artboard 2.svg
│   └── WeCantKeepUp.jpg
└── bills/ (7 PNGs)
```

**After:**
```
public/
├── images/
│   ├── backgrounds/ (12 JPGs) → GCS
│   ├── Artboard 1.svg → GCS
│   ├── Artboard 2.svg → GCS
│   └── WeCantKeepUp.jpg → GCS
└── bills/ (7 PNGs) → GCS
```

## Verification

After uploading to GCS, verify URLs:
- Hero backgrounds: `https://storage.googleapis.com/local34org-assets/images/backgrounds/L34pick_-01.jpg`
- Game assets: `https://storage.googleapis.com/local34org-assets/images/Artboard 1.svg`
- Bills: `https://storage.googleapis.com/local34org-assets/bills/20.png`
