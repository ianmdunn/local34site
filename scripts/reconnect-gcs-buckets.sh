#!/bin/bash
# Reconnect all GCS buckets: grant the service account from .env access to every bucket.
# Use after migration to a new project, or when IAM permissions were reset.
#
# Run from project root: ./scripts/reconnect-gcs-buckets.sh [--dry-run]
#
# Reads from .env and directus/.env. Requires: gsutil, jq (or grep for fallback).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# Load env
[ -f .env ] && set -a && source .env && set +a
[ -f directus/.env ] && set -a && source directus/.env && set +a

# Resolve key path
KEY_PATH="${GOOGLE_APPLICATION_CREDENTIALS:-.gcp/local34org-assets-c2d6db5f8970.json}"
[[ "$KEY_PATH" != /* ]] && KEY_PATH="$ROOT_DIR/$KEY_PATH"

# Directus bucket (prefer GCS_KEY_PATH from directus/.env for key, but GCS_BUCKET for bucket name)
DIRECTUS_BUCKET="${GCS_BUCKET:-local34org-directus-files}"
SITE_BUCKET="${GCS_BUCKET_NAME:-local34site-assetfiles}"
LEADERBOARD_BUCKET="${LEADERBOARD_BUCKET_NAME:-local34-game-leaderboard}"

# Get service account email from key file
if [[ ! -f "$KEY_PATH" ]]; then
  echo "Error: Key file not found: $KEY_PATH"
  echo "Set GOOGLE_APPLICATION_CREDENTIALS in .env"
  exit 1
fi

if command -v jq &>/dev/null; then
  SA_EMAIL=$(jq -r '.client_email' "$KEY_PATH")
else
  SA_EMAIL=$(grep -o '"client_email"[^,]*' "$KEY_PATH" | sed 's/.*: *"\([^"]*\)".*/\1/')
fi

if [[ -z "$SA_EMAIL" || "$SA_EMAIL" == "null" ]]; then
  echo "Error: Could not read client_email from $KEY_PATH"
  exit 1
fi

echo "=== Reconnect GCS Buckets ==="
echo "Service account: $SA_EMAIL"
echo "Key file: $KEY_PATH"
echo ""
echo "Buckets:"
echo "  1. $SITE_BUCKET (site assets)"
echo "  2. $DIRECTUS_BUCKET (Directus)"
echo "  3. $LEADERBOARD_BUCKET (leaderboard)"
echo ""

if [[ "$DRY_RUN" == true ]]; then
  echo "[DRY RUN] Would run (using your gcloud auth, not the service account key):"
  echo "  gsutil iam ch \"serviceAccount:${SA_EMAIL}:objectAdmin\" gs://$SITE_BUCKET"
  echo "  gsutil iam ch \"serviceAccount:${SA_EMAIL}:objectAdmin\" gs://$DIRECTUS_BUCKET"
  echo "  gsutil iam ch \"serviceAccount:${SA_EMAIL}:objectAdmin\" gs://$LEADERBOARD_BUCKET"
  echo ""
  echo "Site assets bucket may also need: gsutil iam ch allUsers:objectViewer gs://$SITE_BUCKET"
  exit 0
fi

# IAM changes require your user account (Owner/Storage Admin), not the service account key.
# Unset so gsutil uses gcloud auth application-default login.
unset GOOGLE_APPLICATION_CREDENTIALS

grant() {
  local bucket=$1
  local purpose=$2
  echo -n "Granting objectAdmin on gs://$bucket ($purpose)... "
  local err
  if ! err=$(gsutil iam ch "serviceAccount:${SA_EMAIL}:objectAdmin" "gs://${bucket}" 2>&1); then
    echo "✗"
    echo "    Error: $err"
    echo "    Run: gcloud auth application-default login"
    echo "    Ensure your account has Storage Admin or Owner on the bucket's project."
    return 1
  else
    echo "✓"
  fi
}

grant "$SITE_BUCKET" "site assets"
grant "$DIRECTUS_BUCKET" "Directus"
grant "$LEADERBOARD_BUCKET" "leaderboard"

echo ""
echo "Verifying access (using service account key)..."
export GOOGLE_APPLICATION_CREDENTIALS="$KEY_PATH"

verify() {
  local bucket=$1
  if gsutil ls "gs://${bucket}/" &>/dev/null; then
    echo "  ✓ gs://$bucket accessible"
  else
    echo "  ✗ gs://$bucket not accessible"
    return 1
  fi
}

verify "$SITE_BUCKET"
verify "$DIRECTUS_BUCKET"
verify "$LEADERBOARD_BUCKET"

echo ""
echo "Done. Run 'npm run check:gcs' to verify full setup."
