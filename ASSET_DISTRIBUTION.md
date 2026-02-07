# Asset Distribution: GCS vs Your Server

This document explains which files are uploaded to Google Cloud Storage (GCS) and which files are served from your Kattare server.

---

## 📤 Files Uploaded to GCS

**Location:** Everything in the `public/` folder

**What gets uploaded:**
- All files and folders in `public/` are uploaded to `gs://local34org-assets/`

**Examples from your project:**
```
public/
├── fonts/
│   └── geometr415-blk-bt-black.ttf          → GCS
├── how-we-win/
│   ├── local-34.svg                         → GCS
│   ├── local-35.svg                          → GCS
│   ├── organizational-structure.svg          → GCS
│   └── ... (all SVGs, PNGs)                 → GCS
├── our-contract/
│   ├── local-34-contract.pdf                → GCS
│   ├── local-34-contract.png                → GCS
│   └── ... (all PDFs, PNGs)                 → GCS
├── zoom-backgrounds/
│   └── ... (all JPGs)                        → GCS
├── _headers                                  → GCS (but not used)
└── robots.txt                                → GCS (but not used)
```

**How they're referenced:**
- Accessed via `getAsset()` function
- When `GCS_ENABLED=true`, URLs become: `https://storage.googleapis.com/local34org-assets/how-we-win/local-34.svg`
- When `GCS_ENABLED=false`, URLs are: `/how-we-win/local-34.svg` (served from your server)

---

## 🖥️ Files Served from Your Server (Kattare)

**Location:** Everything in the `dist/` folder (after `npm run build`)

**What gets built and served:**

### 1. HTML Pages
```
dist/
├── index.html                                → Your server
├── how-we-win.html                           → Your server
├── our-contract.html                         → Your server
├── actions.html                              → Your server
└── ... (all .html files)                      → Your server
```

### 2. JavaScript & CSS Bundles
```
dist/
├── _astro/
│   ├── index.abc123.js                       → Your server
│   ├── index.xyz789.css                      → Your server
│   └── ... (all hashed JS/CSS files)         → Your server
```

### 3. Optimized Images from `src/assets/`
```
dist/
└── _astro/
    ├── L34pick_-01.def456.jpg               → Your server
    ├── L34pick_-02.ghi789.jpg               → Your server
    └── ... (all hero background images)      → Your server
```

**Note:** Images from `src/assets/images/backgrounds/` are:
- Processed by Astro during build
- Optimized and hashed (e.g., `L34pick_-01.def456.jpg`)
- Placed in `dist/_astro/`
- Served from your server (not GCS)

### 4. Other Assets from `src/assets/`
```
dist/
└── _astro/
    ├── favicon.ico                           → Your server
    ├── favicon.svg                           → Your server
    └── ... (favicons, logos from src/assets) → Your server
```

---

## 🔄 How It Works

### During Build (`npm run build`)

1. **Astro processes `src/assets/`**:
   - Images are optimized, hashed, and placed in `dist/_astro/`
   - CSS/JS are bundled and hashed
   - These files are **always** served from your server

2. **Astro copies `public/` to `dist/`**:
   - Files are copied as-is to `dist/`
   - BUT: When `GCS_ENABLED=true`, the HTML references GCS URLs instead
   - The files in `dist/public/` are still there but not used

3. **HTML is generated**:
   - References to `getAsset()` become GCS URLs (if enabled)
   - References to `src/assets/` images become local `/_astro/` URLs

### During Deployment

1. **Upload to GCS**: `npm run upload:assets`
   - Uploads `public/` folder contents to GCS
   - These are the "source of truth" for public assets

2. **Build**: `npm run build`
   - Creates `dist/` folder with HTML, JS, CSS
   - HTML references GCS URLs (if `GCS_ENABLED=true`)

3. **Upload to Kattare**: Upload `dist/` contents via FTP
   - Only the `dist/` folder goes to your server
   - The `public/` folder is NOT uploaded (assets are in GCS)

---

## 📊 Summary Table

| File Location | Where It Goes | How It's Served |
|--------------|---------------|-----------------|
| `public/how-we-win/*.svg` | GCS | `getAsset()` → GCS URL (if enabled) |
| `public/zoom-backgrounds/*.jpg` | GCS | `getAsset()` → GCS URL (if enabled) |
| `public/our-contract/*.pdf` | GCS | `getAsset()` → GCS URL (if enabled) |
| `src/assets/images/backgrounds/*.jpg` | Your server (`dist/_astro/`) | Direct import → Local URL |
| `src/assets/favicons/*` | Your server (`dist/_astro/`) | Direct import → Local URL |
| `src/components/*.astro` | Your server (`dist/*.html`) | Built into HTML |
| `src/pages/*.astro` | Your server (`dist/*.html`) | Built into HTML |
| CSS/JS bundles | Your server (`dist/_astro/`) | Bundled by Astro |

---

## 🎯 Key Points

1. **`public/` folder** = Static assets → GCS
   - Uploaded separately via `npm run upload:assets`
   - Referenced via `getAsset()` function
   - Can be switched between GCS and server via `GCS_ENABLED`

2. **`src/assets/` folder** = Processed assets → Your server
   - Processed during build
   - Always served from your server
   - Optimized, hashed, and bundled by Astro

3. **`dist/` folder** = Built site → Your server
   - Contains HTML, JS, CSS bundles
   - Uploaded to Kattare via FTP
   - This is what visitors actually see

---

## 🔍 How to Check What's Where

### Check GCS bucket:
```bash
gsutil ls gs://local34org-assets/
```

### Check what's in dist/:
```bash
ls -la dist/
ls -la dist/_astro/
```

### Check HTML references:
```bash
# After building, check the HTML files
grep -r "storage.googleapis.com" dist/
grep -r "getAsset" dist/  # Should show GCS URLs if enabled
```

---

## 💡 Why This Split?

- **GCS for `public/`**: Large files (PDFs, images) benefit from CDN-like delivery
- **Server for `src/assets/`**: These are processed/optimized during build and benefit from Astro's optimization
- **Server for HTML/JS/CSS**: These need to be served from your domain for SEO and functionality
