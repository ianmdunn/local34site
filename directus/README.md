# Directus + GCS Setup

Directus headless CMS with Google Cloud Storage for file uploads. All files uploaded through Directus are stored in GCS instead of local disk.

## Prerequisites

- Docker and Docker Compose
- GCP project with a GCS bucket
- Service account key with Storage Object Admin (or equivalent) permissions

## Quick Start

### 1. Create GCS bucket and service account

1. In [GCP Console](https://console.cloud.google.com), create a bucket (e.g. `your-project-directus-files`).
2. Go to **IAM & Admin → Service Accounts** and create a service account.
3. Grant it **Storage Object Admin** (or **Storage Admin**) on the bucket.
4. Create a JSON key and save to `.gcp/local34org-assets-c2d6db5f8970.json` (see `../GCS_BUCKETS.md` for canonical config).

### 2. Configure environment

```bash
cd directus
cp .env.example .env
```

Edit `.env` and set:

- `DB_PASSWORD` – strong password for PostgreSQL
- `KEY` and `SECRET` – generate with `openssl rand -hex 32`
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` – first admin user
- `GCS_BUCKET` – your GCS bucket name
- `GCS_KEY_PATH` – path to the JSON key (default: `../.gcp/local34org-assets-c2d6db5f8970.json`)

### 3. Start services

```bash
docker compose up -d
```

Directus will be at `http://localhost:8055` (or your `DIRECTUS_PORT`).

### 4. First login

1. Open `http://localhost:8055` in a browser.
2. Log in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.
3. Uploads will go to GCS automatically.

## GCS configuration

**Directus uses a separate bucket** from the site’s static assets. See `../GCS_BUCKETS.md` for the full bucket layout.

Storage is configured via environment variables:

| Variable                   | Description                                |
| -------------------------- | ------------------------------------------ |
| `STORAGE_LOCATIONS`        | Comma-separated storage names (e.g. `gcs`) |
| `STORAGE_GCS_DRIVER`       | Must be `gcs`                              |
| `STORAGE_GCS_BUCKET`       | GCS bucket name                            |
| `STORAGE_GCS_KEY_FILENAME` | Path inside container to the JSON key      |

The key file is mounted from the host at `/directus/gcs-credentials/key.json` in the container.

## Bucket permissions

Ensure the service account can:

- Create objects: `storage.objects.create`
- Read objects: `storage.objects.get`
- Delete objects: `storage.objects.delete`
- List objects: `storage.objects.list`

**Storage Object Admin** on the bucket covers these.

## Cloud Run deployment

One script handles setup, deploy, and verification:

```bash
cd directus
./deploy-directus-cloudrun.sh
```

The script will:

1. Create Cloud SQL database and user (if they don't exist)
2. Grant permissions
3. Deploy to Cloud Run
4. Verify with a handshake (polls `/server/health` until ready)

### Prerequisites

1. **Cloud SQL** – Create a PostgreSQL instance in GCP Console (SQL → Create Instance).
2. **CLOUD_SQL_INSTANCE** – Set in `.env` (format: `project:region:instance`).
3. **GCS bucket** – Already configured. Grant the GCS key’s service account `Storage Object Admin` on the bucket.

**Rebuild Cloud SQL connection:** `npm run reconnect:cloudsql` (or `CREATE_INSTANCE=true npm run reconnect:cloudsql` if the instance doesn't exist yet).

### Environment variables for Cloud Run

| Variable             | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `GCP_PROJECT_ID`     | GCP project (default: `gcloud config get-value project`) |
| `GCP_REGION`         | Region (default: `us-central1`)                          |
| `CLOUD_RUN_SERVICE`  | Service name (default: `directus`)                       |
| `CLOUD_SQL_INSTANCE` | Cloud SQL connection name (`project:region:instance`)    |

## Troubleshooting

### Page loads but password doesn't work

**If "Password reset failed" (admin doesn't exist yet):** Run bootstrap first:

```bash
cd directus
./bootstrap-admin.sh   # Creates schema + admin via Cloud SQL Proxy
```

**If admin exists but wrong password:** Reset it:

```bash
./reset-admin-password.sh
```

Both use `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`. Requires `cloud-sql-proxy` (brew install cloud-sql-proxy).

### Health returns 503

503 usually means GCS storage is failing. Check:

1. **Bucket exists and IAM is set:**

   ```bash
   gsutil ls gs://local34org-directus-files/
   gsutil iam ch "serviceAccount:gcs-uploader@local34org-assets.iam.gserviceaccount.com:objectAdmin" gs://local34org-directus-files
   ```

2. **Redeploy** so Cloud Run gets the correct GCS config:

   ```bash
   ./deploy-directus-cloudrun.sh
   ```

3. **Check logs:**
   ```bash
   gcloud run services logs read directus --region=us-west1 --project=local34org-assets --limit=30
   ```

### DB_PASSWORD / ADMIN_PASSWORD with special characters

Passwords with `{`, `}`, `)`, `$`, or `"` can break `gcloud --set-env-vars`. The deploy script now uses `--env-vars-file` (YAML) so these work correctly. In `.env`, wrap values in single quotes: `DB_PASSWORD='qUNIE4{U).GEx{c'`

---

## Production notes

1. Use a pinned image tag: `directus/directus:11.4.1` instead of `11`.
2. Set `PUBLIC_URL` to your real domain (e.g. `https://cms.example.com`).
3. Use managed PostgreSQL (e.g. Cloud SQL) instead of the Compose Postgres.
4. Keep `.env` and `.gcp/` out of version control.
5. Consider Redis for caching if you scale.

## Updates collection (Astro news feed)

The Astro site’s `/updates` page pulls content from a Directus collection named **`updates`**.

### Create the collection

1. In Directus Admin → **Settings** → **Data Model** → **Create Collection**.
2. Name it `updates` (system collection).
3. Add these fields:

| Field name  | Type       | Interface         | Config                                          |
| ----------- | ---------- | ----------------- | ----------------------------------------------- |
| `title`     | String     | Input             | Required                                        |
| `date`      | DateTime   | Date & Time       | Default: "now" for new items                    |
| `content`   | WYSIWYG    | WYSIWYG           | Main body content                               |
| `excerpt`   | String     | Input (multiline) | Optional; used for list preview                 |
| `image`     | Image/File | Image             | Optional; storage in GCS                        |
| `image_url` | String     | Input             | Optional; fallback for migrated WP posts        |
| `status`    | Dropdown   | Dropdown          | Values: `draft`, `published`. Default: `draft`  |
| `slug`      | String     | Input             | Optional; for URLs if you add single-post pages |
| `author`    | String     | Input             | Optional; byline shown on card                  |
| `featured`  | Boolean    | Toggle            | Optional; flag for pinned updates               |

### Public read access

1. **Settings** → **Access Control** → **Public**.
2. Under **updates**, enable **Read**.
3. (Optional) Add a filter so only published items are visible: `status` equals `published`.

### Astro configuration

In the project root `.env`:

```
PUBLIC_DIRECTUS_URL=https://your-directus-instance.run.app
```

When using Cloud Run, replace with your deployed Directus URL.

### Schema setup (optional)

To create or update the `updates` collection fields via API:

```bash
npm run directus:schema:dry   # Preview changes
npm run directus:schema       # Apply (creates collection + adds missing fields)
```

Requires `DIRECTUS_TOKEN` in root `.env`. Creates the collection if missing, or adds recommended fields (slug, author, featured, etc.) to an existing collection.

### Migrating from WordPress

To import existing posts from local34.org (WordPress):

1. Create a static token in Directus: **Settings** → **Users** → your user → **Token**.
2. Add the `image` (Image/File) field to the `updates` collection for featured images.
3. Run:

   ```bash
   DIRECTUS_TOKEN=your_token npm run migrate:wp
   ```

   Or dry-run first: `npm run migrate:wp:dry`

   This fetches all published posts from the WordPress REST API and creates them in Directus. Featured images are imported via Directus `POST /files/import` (stored in your GCS bucket). If import fails, images fall back to `image_url` (add that String field for fallback).

   If posts fail with `VALUE_TOO_LONG` on `content`, the Directus PATCH only updates metadata — the DB column stays VARCHAR.

   ```bash
   npm install
   npm run fix:content-column
   ```

   (Requires Cloud SQL Proxy on port 5433. Or `./directus/fix-content-column.sh` to use psql if installed.)

### Status filter

The site filters by `status = published` and sorts by `date` (newest first). Ensure the `status` field exists and the Public role can read filtered items.

### 403 Forbidden on /updates

If the Directus fetch returns 403, either:

1. **Grant Public read access**: In Directus Admin → Settings → Access Control → Public role → enable read on the `updates` collection.
2. **Use a token**: Set `DIRECTUS_TOKEN` in root `.env`. The site uses it at build time (server-side only, never exposed to the client).

### 403 Forbidden on images (assets)

If images return 403, Directus storage is private. Two options:

1. **Make storage public**: In Directus Admin → Settings → Storage → your disk → enable public access.
2. **Use the image proxy** (keeps token server-side; never in HTML):

   ```bash
   ./scripts/deploy-directus-image-proxy.sh
   ```

   Then add the printed URL to `.env`:

   ```
   PUBLIC_DIRECTUS_IMAGE_PROXY_URL=https://proxyDirectusImage-xxx.run.app
   ```

   Rebuild the site. Images will load via the proxy; the token stays in the Cloud Function.

3. **Pre-process existing images** (optional): Warm the proxy cache or verify the pipeline:
   ```bash
   npm run warm:image-proxy:dry   # Preview what would be processed
   npm run warm:image-proxy       # Fetch each image to warm the cache
   npm run warm:image-proxy -- --save=./processed-images  # Save images to a folder
   ```

---

## Separate from Astro

This Directus stack is independent of the main Astro site. Use it as a headless CMS and fetch content via the [Directus REST API](https://docs.directus.io/reference/introduction/) or GraphQL from your Astro app.
