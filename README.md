# Local 34-UNITE HERE!

The Union of Clerical & Technical Workers at Yale. Astro-based static site with Directus CMS, Google Cloud Storage, and Cloud Run.

## Tech Stack

- **Framework:** Astro 5, React islands
- **Styling:** Tailwind CSS
- **CMS:** Directus (headless)
- **Hosting:** Static HTML to GCS; Cloud Functions for leaderboard & image proxy

## Quick Start

On a clean machine, run the init script first:

```bash
npm run init         # Checks Node, installs deps, creates .env from example
npm run dev          # http://localhost:4321
npm run build        # Static build to dist/
npm test             # Run unit tests
npm run deploy       # Full GCS build pipeline
```

## Script Map

All scripts used to build, deploy, and maintain the site.

### Build & Develop

| npm script          | What it runs                    | Purpose                                                                        |
| ------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| `dev` / `start`     | `astro dev`                     | Local dev server                                                               |
| `build`             | `npm update && astro build`     | Full production build                                                          |
| `build:fast`        | `astro build`                   | Build without npm update                                                       |
| `preview`           | `astro preview`                 | Preview built site locally                                                     |
| `generate:favicons` | `scripts/generate-favicons.cjs` | Generate favicon.ico & apple-touch-icon from `src/assets/favicons/favicon.svg` |

### Code Quality

| npm script       | What it runs                                      | Purpose                      |
| ---------------- | ------------------------------------------------- | ---------------------------- |
| `test`           | `vitest run`                                      | Run unit tests               |
| `test:watch`     | `vitest`                                          | Run tests in watch mode      |
| `check`          | `check:astro` + `check:eslint` + `check:prettier` | Run all checks               |
| `check:astro`    | `astro check`                                     | Astro type/schema validation |
| `check:eslint`   | `eslint .`                                        | Linting                      |
| `check:prettier` | `prettier --check .`                              | Format check                 |
| `fix`            | `fix:eslint` + `fix:prettier`                     | Auto-fix lint & format       |

### GCS & Deployment

| npm script          | What it runs                                                                  | Purpose                                           |
| ------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------- |
| `upload:assets`     | `scripts/upload-to-gcs.js`                                                    | Upload `public/` assets to GCS bucket             |
| `upload:assets:dry` | `scripts/upload-to-gcs.js --dry-run`                                          | Preview uploads only                              |
| `upload:optimized`  | `scripts/upload-optimized-to-gcs.js`                                          | Upload `dist/_astro/` images to GCS, rewrite URLs |
| `cleanup:dist`      | `scripts/cleanup-dist-public.js`                                              | Remove GCS-served assets from `dist/`             |
| `push:ssh`          | `scripts/deploy-ssh-push.sh`                                                 | Push `dist/` to live site via rsync over SSH       |
| `push:ssh:dry`      | Same + `--dry-run`                                                           | Preview SSH push only                             |
| `push:ftp`          | `scripts/deploy-ftp-push.sh`                                                 | Push `dist/` to live site via FTP (lftp)          |
| `push:ftp:dry`      | Same + `--dry-run`                                                           | Preview FTP push only                             |
| `build:gcs`         | `check:gcs` → `upload:assets` → `build` → `upload:optimized` → `cleanup:dist` → `push:ftp` | Full deploy pipeline                              |
| `deploy`            | Same as `build:gcs`                                                          | Deploy site                                       |

**GCS scripts:**

| Script                               | Purpose                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `scripts/upload-to-gcs.js`           | Upload `public/` to `GCS_BUCKET_NAME`. Options: `--dry-run`, `--path`, `--delete` |
| `scripts/upload-optimized-to-gcs.js` | Upload `dist/_astro/` images to GCS, rewrite HTML/JS URLs to GCS                  |
| `scripts/cleanup-dist-public.js`     | Remove from `dist/` assets that are served from GCS                               |
| `scripts/gcs-client.js`              | Shared GCS client (uses `getBucket`); fallback to gcloud ADC if key invalid       |

**GCS shell scripts:**

| Script                                       | Purpose                                                          |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `scripts/check-gcs-setup.sh`                 | Verify .env, credentials, buckets, Directus, leaderboard         |
| `scripts/full-check.sh`                      | Run `check` → `build` → `check-gcs-setup` → `upload:assets:dry`  |
| `scripts/reconnect-gcs-buckets.sh`           | Grant service account access to all GCS buckets (post-migration) |
| `scripts/reconnect-gcs-buckets.sh --dry-run` | Preview IAM changes                                              |
| `scripts/deploy-ssh-push.sh`                 | Rsync `dist/` to live site via SSH (after cleanup:dist)           |
| `scripts/deploy-ftp-push.sh`                 | Mirror `dist/` to live site via FTP/lftp (after cleanup:dist)     |

**Cloud Functions:**

| Script                      | Purpose                                           |
| --------------------------- | ------------------------------------------------- |
| `deploy-gcp-leaderboard.sh` | Deploy `gcp-function/` leaderboard Cloud Function |

### Directus CMS

| npm script             | What it runs                                                      | Purpose                                                         |
| ---------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| `directus:schema`      | `scripts/directus-schema-updates.js`                              | Create/update "updates" collection schema via REST              |
| `directus:schema:dry`  | `scripts/directus-schema-updates.js --dry-run`                    | Preview schema changes                                          |
| `fix:content-column`   | `scripts/fix-directus-content-column.js`                          | Alter `updates.content` to TEXT (needs Cloud SQL Proxy on 5433) |
| `debug:content-field`  | `scripts/debug-directus-content-field.js`                         | Inspect content field validation source                         |
| `warm:image-proxy`     | `scripts/warm-directus-image-proxy.js`                            | Pre-process images through proxy (warm cache)                   |
| `warm:image-proxy:dry` | Same + `--dry-run`                                                | List images that would be processed                             |
| `reconnect:cloudsql`   | `directus/reconnect-cloudsql.sh`                                  | Reconnect Directus to Cloud SQL                                 |
| `campaign-posters`     | `.venv/bin/python scripts/upload-campaign-posters-to-directus.py` | Upload campaign PDFs to Directus (wecantkeepup)                 |
| `campaign-posters:dry` | Same + `--dry-run`                                                | Dry run                                                         |

**Directus shell scripts (in `directus/`):**

| Script                                    | Purpose                                       |
| ----------------------------------------- | --------------------------------------------- |
| `directus/deploy-directus-cloudrun.sh`    | Deploy Directus to Cloud Run                  |
| `directus/deploy-directus-image-proxy.sh` | Deploy `proxyDirectusImage` Cloud Function    |
| `directus/reconnect-cloudsql.sh`          | Reconnect Cloud SQL for Directus              |
| `directus/bootstrap-admin.sh`             | Create initial admin user                     |
| `directus/reset-admin-password.sh`        | Reset admin password                          |
| `directus/reset-password-cloudrun.sh`     | Reset password in Cloud Run deployment        |
| `directus/fix-content-column.sh`          | Shell wrapper for fix-directus-content-column |

**Directus JS scripts:**

| Script                                    | Purpose                                          |
| ----------------------------------------- | ------------------------------------------------ |
| `scripts/directus-schema-updates.js`      | Ensure updates collection exists, add fields     |
| `scripts/fix-directus-content-column.js`  | Fix VALUE_TOO_LONG by changing DB column to TEXT |
| `scripts/debug-directus-content-field.js` | Debug content field max_length validation        |
| `scripts/warm-directus-image-proxy.js`    | Warm image proxy cache                            |

### Migration & Content

| npm script            | What it runs                          | Purpose                                    |
| --------------------- | ------------------------------------- | ------------------------------------------ |
| `migrate:wp`          | `scripts/migrate-wp-to-directus.js`   | Migrate WordPress posts → Directus updates |
| `migrate:wp:dry`      | Same + `--dry-run`                    | Preview migration                          |
| `migrate:wp:db`       | Same + `--db-fallback`                | Fallback to direct DB on VALUE_TOO_LONG    |
| `backfill:images`     | `scripts/backfill-directus-images.js` | Link image_url to Directus file IDs        |
| `backfill:images:dry` | Same + `--dry-run`                    | Preview backfill                           |

**Migration scripts:**

| Script                                | Purpose                                                                |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `scripts/migrate-wp-to-directus.js`   | Pull from WP REST API, create Directus updates; needs `DIRECTUS_TOKEN` |
| `scripts/backfill-directus-images.js` | Import images for updates with `image_url` but no file ID              |

### Python (Campaign Posters)

| Script                                           | Purpose                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `scripts/upload-campaign-posters-to-directus.py` | Extract images from PDFs, use Gemini for metadata, create wecantkeepup items |
| `scripts/requirements-wecantkeepup.txt`          | Python deps for campaign-posters script                                      |

---

## Environment

Key variables (see `.env`):

- `GCS_BUCKET_NAME`, `GCS_BUCKET_URL` – Site assets bucket
- `DEPLOY_FTP_HOST`, `DEPLOY_FTP_USER`, `DEPLOY_FTP_PASSWORD`, `DEPLOY_PATH` – For FTP push (optional; deploy skips if unset)
- `GOOGLE_APPLICATION_CREDENTIALS` – Path to GCP service account JSON
- `LEADERBOARD_BUCKET_NAME`, `PUBLIC_LEADERBOARD_API` – Game leaderboard
- `PUBLIC_DIRECTUS_URL`, `DIRECTUS_TOKEN` – Directus CMS
- `PUBLIC_DIRECTUS_IMAGE_PROXY_URL` – Image proxy Cloud Function URL
- `PUBLIC_RSVP_ERROR_WEBHOOK_URL` – Optional: POST when RSVP submit fails (e.g. Zapier, Make)

Directus runs in `directus/` with its own `.env`; see `directus/README.md` for setup.
