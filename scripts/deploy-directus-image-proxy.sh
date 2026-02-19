#!/bin/bash
# Deploy Directus image proxy Cloud Function. Token stays server-side; never in HTML.
# Requires: DIRECTUS_URL, DIRECTUS_TOKEN in .env (or --set-env-vars)

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
REGION="${REGION:-us-central1}"

echo "Enabling Cloud Vision API (needed for face detection)..."
gcloud services enable vision.googleapis.com --project="$PROJECT_ID" 2>/dev/null || true

echo "Deploying proxyDirectusImage..."
gcloud functions deploy proxyDirectusImage \
  --gen2 \
  --runtime nodejs22 \
  --entry-point proxyDirectusImage \
  --source ./gcp-function \
  --region "$REGION" \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars "DIRECTUS_URL=$DIRECTUS_URL,DIRECTUS_TOKEN=$DIRECTUS_TOKEN"

URL=$(gcloud functions describe proxyDirectusImage --gen2 --region "$REGION" --format="value(serviceConfig.uri)")
echo ""
echo "Proxy URL: $URL"
echo "Add to .env: PUBLIC_DIRECTUS_IMAGE_PROXY_URL=$URL"
echo "Then rebuild the site."
echo ""
echo "Face detection: Images are auto-cropped to center on faces (Google Cloud Vision)."
echo "Add ?face=0 to the proxy URL to skip face detection for an image."
