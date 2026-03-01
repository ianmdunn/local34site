#!/bin/bash
# Deploy Directus image proxy Cloud Function. Token stays server-side; never in HTML.
# Requires: DIRECTUS_URL, DIRECTUS_TOKEN in .env
# Uses Secret Manager for the token (avoids shell history / process exposure).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
cd "$ROOT"

if [ -f "$ROOT/.env" ]; then
  set -a
  source "$ROOT/.env"
  set +a
fi

DIRECTUS_URL="${DIRECTUS_URL:-$PUBLIC_DIRECTUS_URL}"
if [ -z "$DIRECTUS_URL" ] || [ -z "$DIRECTUS_TOKEN" ]; then
  echo "Set DIRECTUS_URL (or PUBLIC_DIRECTUS_URL) and DIRECTUS_TOKEN in .env"
  exit 1
fi

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")
if [ -z "$PROJECT_ID" ]; then
  echo "Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

REGION="${REGION:-us-central1}"
SECRET_NAME="directus-image-proxy-token"

# Ensure Secret Manager API is enabled
gcloud services enable secretmanager.googleapis.com --project "$PROJECT_ID" --quiet 2>/dev/null || true

# Create or update secret (token never appears in deploy command)
if gcloud secrets describe "$SECRET_NAME" --project "$PROJECT_ID" &>/dev/null; then
  echo "Updating secret $SECRET_NAME..."
  echo -n "$DIRECTUS_TOKEN" | gcloud secrets versions add "$SECRET_NAME" --data-file=- --project "$PROJECT_ID"
else
  echo "Creating secret $SECRET_NAME..."
  echo -n "$DIRECTUS_TOKEN" | gcloud secrets create "$SECRET_NAME" --data-file=- --project "$PROJECT_ID"
fi

# Grant the default Cloud Functions runtime SA access to the secret
# (Gen2 uses the default compute SA; deploy may auto-grant, but we do it explicitly)
PROJECT_NUM=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)' 2>/dev/null || true)
if [ -n "$PROJECT_NUM" ]; then
  CF_SA="${PROJECT_NUM}-compute@developer.gserviceaccount.com"
  gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
    --project "$PROJECT_ID" \
    --member="serviceAccount:${CF_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet 2>/dev/null || true
fi

echo "Deploying proxyDirectusImage..."
gcloud functions deploy proxyDirectusImage \
  --gen2 \
  --runtime nodejs24 \
  --entry-point proxyDirectusImage \
  --source ./gcp-function \
  --region "$REGION" \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars "DIRECTUS_URL=$DIRECTUS_URL" \
  --set-secrets "DIRECTUS_TOKEN=${SECRET_NAME}:latest"

URL=$(gcloud functions describe proxyDirectusImage --gen2 --region "$REGION" --format="value(serviceConfig.uri)")
echo ""
echo "Proxy URL: $URL"
echo "Add to .env: PUBLIC_DIRECTUS_IMAGE_PROXY_URL=$URL"
echo "Then rebuild the site."
