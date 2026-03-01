# Architecture Overview

How the Local 34 site is structured and how the pieces fit together.

## High-Level Flow

```
config.yaml ──► vendor integration ──► astrowind:config (virtual module)
                                              │
     src/pages/*.astro ──────────────────────┼──► Static HTML
     src/layouts/*.astro ─────────────────────┤
     src/components/** ────────────────────────┤
     React islands (client:load) ──────────────┘
                                              │
     build ──► dist/ ──► upload-optimized ────► GCS bucket
              public/ ──► upload-to-gcs ───────► GCS bucket
                                              │
     Directus ◄── REST API ◄── Updates pages
     Cloud Functions ──► Leaderboard, Image Proxy
```

## Config & Routing

- **Config:** `src/config.yaml` defines site metadata, blog settings, analytics, theme. The Astrowind vendor integration (`vendor/integration/`) loads it and exposes a virtual module `astrowind:config` with `SITE`, `METADATA`, `APP_BLOG`, `UI`, `ANALYTICS`.
- **Routing:** File-based. `src/pages/*.astro` map to routes. `[slug].astro` serves dynamic pages from `content/sitePages/` or reserved slugs with dedicated pages.
- **Base URL:** `SITE.site` and `SITE.base` from config; dev can override with `SITE_URL` env var.

## Build Pipeline

1. **upload:assets** – Uploads `public/` to GCS (fonts, images, static files).
2. **astro build** – Prerenders all pages to `dist/`.
3. **upload:optimized** – Uploads `dist/_astro/` images to GCS, rewrites URLs in HTML/JS.
4. **cleanup:dist** – Removes GCS-served assets from `dist/` so the deploy artifact only has HTML + critical JS/CSS.

The server serves HTML from `dist/`; images and heavy assets are loaded from GCS URLs.

## Content

- **Directus:** Headless CMS. Updates/news live in the "updates" collection. Images stored in GCS.
- **Image proxy:** Cloud Function `proxyDirectusImage` fetches Directus assets with a server-side token (never in HTML), returns the image.
- **Blog:** Disabled in config; legacy blog structure exists in vendor for possible future use.

## Client-Side

- **React islands:** Components with `client:load` (or similar) hydrate on the client. Used for CatchTheCash game, YaleWealth calculator, ActionCenter forms, etc.
- **View Transitions:** Astro ClientRouter with `fallback="none"`. Nav links use `data-nav-link` and do full page loads to avoid transition quirks.
- **Prefetch:** All links prefetched on hover for faster navigation.

## GCP Layout

| Bucket / Service                    | Purpose                                      |
| ----------------------------------- | -------------------------------------------- |
| `local34site-assetfiles`            | Site static assets (public/, \_astro images) |
| `local34org-directus-files`         | Directus uploads (CMS media)                 |
| `local34-game-leaderboard`          | CatchTheCash high scores JSON                |
| Cloud Function `leaderboard`        | Read/write leaderboard, CORS                 |
| Cloud Function `proxyDirectusImage` | Proxy Directus assets                        |

## Key Directories

- `src/` – Astro pages, layouts, components
- `src/utils/` – Shared logic (permalinks, gcs, directus, sanitize)
- `vendor/integration/` – Astrowind theme integration
- `content/` – Markdown/MDX content (sitePages, blog)
- `scripts/` – Build, deploy, migration, GCS scripts
- `directus/` – Directus Docker setup and Cloud Run deploy
- `gcp-function/` – Leaderboard + image proxy Cloud Functions
