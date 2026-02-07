npm # Deployment Guide with Google Cloud Storage

This guide covers the complete build and deployment process now that assets are hosted on Google Cloud Storage.

## Overview

**Three-step deployment process:**
1. **Upload assets to GCS** (when `public/` folder changes)
2. **Build the site locally** (`npm run build`)
3. **Upload built site to Kattare via FTP**

The site references GCS URLs when `GCS_ENABLED=true`, so assets must be uploaded **before** building and deploying.

---

## Manual Deployment Process

### Step 1: Upload Assets to GCS

**When to run:** Whenever files in `public/` folder change (new images, PDFs, SVGs, etc.)

```bash
# Preview what would be uploaded
npm run upload:assets:dry

# Upload all assets
npm run upload:assets

# Upload specific directory only
npm run upload:assets -- --path=how-we-win
```

**Note:** The upload script skips unchanged files, so it's safe to run multiple times.

### Step 2: Build the Site Locally

**Important:** Make sure `GCS_ENABLED=true` in your `.env` file before building.

```bash
# Build the site
npm run build

# Preview locally (optional - to test before uploading)
npm run preview
```

Verify assets load from GCS URLs in the Network tab. The built site will be in the `dist/` folder.

### Step 3: Upload to Kattare via FTP

**Option A: Using FTP Client (FileZilla, Cyberduck, etc.)**

1. Connect to your Kattare FTP server
2. Navigate to your website's root directory (usually `public_html/` or `www/`)
3. Upload **all contents** of the `dist/` folder to the root directory
   - Upload files, not the `dist` folder itself
   - Maintain folder structure (e.g., `dist/_astro/` → `_astro/`)

**Option B: Using Command Line (lftp, sftp, etc.)**

```bash
# Example using lftp
lftp -u username,password ftp.kattare.com
cd public_html
mirror -R dist/ .
quit
```

**Option C: Using rsync over SSH (if available)**

```bash
rsync -avz --delete dist/ username@kattare.com:/path/to/public_html/
```

**Important:** 
- Upload the **contents** of `dist/`, not the `dist` folder itself
- Delete old files if needed (or use `--delete` flag with rsync)
- Ensure `.htaccess` or server config handles clean URLs if needed

---

## Automated Deployment (Optional)

Set up GitHub Actions to automatically upload assets when `public/` changes, then build and upload to Kattare.

### GitHub Actions + FTP Deployment

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Kattare

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCS_SERVICE_ACCOUNT_KEY }}
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Upload assets to GCS
        run: npm run upload:assets
        if: |
          contains(github.event.head_commit.modified, 'public/') ||
          contains(github.event.head_commit.added, 'public/') ||
          github.event.head_commit.modified == ''
      
      - name: Build site
        env:
          GCS_BUCKET_NAME: ${{ secrets.GCS_BUCKET_NAME }}
          GCS_BUCKET_URL: ${{ secrets.GCS_BUCKET_URL }}
          GCS_ENABLED: 'true'
        run: npm run build
      
      - name: Deploy to Kattare via FTP
        uses: SamKirkland/FTP-Deploy-Action@v4.3.4
        with:
          server: ${{ secrets.FTP_SERVER }}
          username: ${{ secrets.FTP_USERNAME }}
          password: ${{ secrets.FTP_PASSWORD }}
          local-dir: ./dist/
          server-dir: /public_html/
```

**Required Secrets:**
- `GCS_SERVICE_ACCOUNT_KEY` - JSON key for GCS uploads
- `GCS_BUCKET_NAME` - Your bucket name (e.g., `local34org-assets`)
- `GCS_BUCKET_URL` - Your bucket URL (e.g., `https://storage.googleapis.com/local34org-assets`)
- `FTP_SERVER` - Your Kattare FTP server (e.g., `ftp.kattare.com`)
- `FTP_USERNAME` - Your FTP username
- `FTP_PASSWORD` - Your FTP password

---

## Local Configuration

### Environment Variables

Set these in your `.env` file **before building**:

**Required:**
```env
GCS_BUCKET_NAME=local34org-assets
GCS_BUCKET_URL=https://storage.googleapis.com/local34org-assets
GCS_ENABLED=true
```

**Optional (for upload script):**
```env
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

**Important:** 
- Set `GCS_ENABLED=true` in `.env` before running `npm run build`
- The build process reads these values and generates GCS URLs in the HTML
- Don't commit `.env` to git (it's in `.gitignore`)

---

## Deployment Checklist

### Before Each Deployment

- [ ] **Assets changed?** → Run `npm run upload:assets`
- [ ] **Environment variables set?** → Verify `GCS_ENABLED=true` in `.env`
- [ ] **Build locally** → `npm run build` (creates `dist/` folder)
- [ ] **Test locally?** → `npm run preview` to verify assets load from GCS
- [ ] **Upload to Kattare** → Upload `dist/` contents via FTP

### After Deployment

- [ ] **Verify assets load** → Check Network tab, assets should be from `storage.googleapis.com`
- [ ] **Check console** → No 404s for assets
- [ ] **Test random hero images** → Refresh homepage multiple times, should see different images

---

## Common Scenarios

### Scenario 1: Only Code Changes (No Asset Changes)

```bash
# Build the site
npm run build

# Upload dist/ contents to Kattare via FTP
# (No need to upload assets - they're already in GCS)
```

### Scenario 2: Only Asset Changes (No Code Changes)

```bash
# Upload assets to GCS
npm run upload:assets

# Build the site (to update any references)
npm run build

# Upload dist/ contents to Kattare via FTP
```

**Note:** Even if only assets changed, you should rebuild and redeploy so the site references the updated assets.

### Scenario 3: Both Code and Assets Changed

```bash
# Upload assets to GCS
npm run upload:assets

# Build the site
npm run build

# Upload dist/ contents to Kattare via FTP
```

### Scenario 4: First Time Deployment

1. **Create GCS bucket** (if not done):
   ```bash
   gsutil mb -p gen-lang-client-0407965119 -c STANDARD -l US gs://local34org-assets
   gsutil iam ch allUsers:objectViewer gs://local34org-assets
   ```

2. **Upload all assets**:
   ```bash
   npm run upload:assets
   ```

3. **Set environment variables in `.env`**:
   ```env
   GCS_BUCKET_NAME=local34org-assets
   GCS_BUCKET_URL=https://storage.googleapis.com/local34org-assets
   GCS_ENABLED=true
   ```

4. **Build and deploy**:
   ```bash
   npm run build
   # Then upload dist/ contents to Kattare via FTP
   ```

---

## Troubleshooting

### Assets Not Loading in Production

1. **Check environment variables** in `.env` file
2. **Verify `GCS_ENABLED=true`** is set before building
3. **Rebuild** - Make sure you ran `npm run build` with `GCS_ENABLED=true`
4. **Check bucket permissions**: `gsutil iam get gs://local34org-assets`
5. **Test asset URL directly**: `https://storage.googleapis.com/local34org-assets/how-we-win/local-34.svg`

### Build Fails with "GCS_BUCKET_NAME not found"

- Set environment variables in `.env` file before building
- Make sure `.env` file exists and has the correct values
- Run `npm run build` (not `npm run build:fast`) to ensure env vars are loaded

### Assets Upload Fails in CI/CD

- Verify `GCS_SERVICE_ACCOUNT_KEY` secret is set correctly
- Check service account has `Storage Object Admin` role
- Ensure bucket name matches exactly

### Old Assets Still Showing

- Clear browser cache
- Check CDN cache (if using Cloud CDN)
- Verify new assets were uploaded: `gsutil ls gs://local34org-assets/how-we-win/`

---

## Quick Reference

```bash
# Upload assets
npm run upload:assets

# Build locally
npm run build

# Preview build
npm run preview

# Upload to Kattare (using FTP client or command line)
# Example with lftp:
# lftp -u username,password ftp.kattare.com -e "cd public_html; mirror -R dist/ .; quit"

# Check GCS bucket
gsutil ls gs://local34org-assets

# Make bucket public (if needed)
gsutil iam ch allUsers:objectViewer gs://local34org-assets
```

---

## Rollback Plan

If something goes wrong:

1. **Disable GCS** in `.env`:
   ```env
   GCS_ENABLED=false
   ```

2. **Rebuild**:
   ```bash
   npm run build
   ```

3. **Redeploy** - Upload `dist/` contents to Kattare. Assets will load from the server's `/public` folder.

4. **Fix issues** and re-enable GCS when ready

---

## Best Practices

1. **Upload assets before building** when `public/` changes
2. **Use dry-run first** to preview changes: `npm run upload:assets:dry`
3. **Always build locally** before uploading to Kattare - don't build on the server
4. **Keep assets in sync** - commit `public/` folder to git even though assets are in GCS
5. **Test locally first** - Run `npm run preview` to verify before uploading
6. **Monitor GCS costs** - first 1GB storage/month is free, then ~$0.020/GB
7. **Set up automated deployment** via GitHub Actions for consistency (optional)
