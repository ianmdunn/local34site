#!/bin/bash
set -e

# Leaderboard bucket: see GCS_BUCKETS.md for full bucket layout
# Load .env if present (for LEADERBOARD_BUCKET_NAME)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

BUCKET_NAME="${LEADERBOARD_BUCKET_NAME:-local34-game-leaderboard}"
ALLOWED_ORIGINS="${LEADERBOARD_ALLOWED_ORIGINS:-https://local34.org,https://dev.local34.org,http://localhost:4321}"

# Get project ID
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
SA_EMAIL="leaderboard-writer@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Using project: $PROJECT_ID"
echo "Leaderboard bucket: $BUCKET_NAME"
echo "Service Account: $SA_EMAIL"

# Enable required APIs
echo "Enabling Cloud Functions and Cloud Build APIs..."
gcloud services enable cloudfunctions.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com iam.googleapis.com

# Create service account if it doesn't exist
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" &>/dev/null; then
  echo "Creating service account: $SA_EMAIL"
  gcloud iam service-accounts create leaderboard-writer \
    --display-name "Leaderboard Function Writer" \
    --project "$PROJECT_ID"
  echo "Waiting for IAM propagation..."
  sleep 15
fi

# Grant service account write access to the bucket
echo "Granting bucket access to service account..."
gsutil iam ch "serviceAccount:${SA_EMAIL}:objectAdmin" "gs://${BUCKET_NAME}"

# Use env-vars-file (LEADERBOARD_ALLOWED_ORIGINS contains commas; --set-env-vars misparses them)
ENV_FILE=$(mktemp)
trap "rm -f $ENV_FILE" EXIT
escape_yaml() { printf '%s' "$1" | sed 's/"/\\"/g'; }
cat > "$ENV_FILE" << ENVYAML
BUCKET_NAME: "$(escape_yaml "$BUCKET_NAME")"
LEADERBOARD_ALLOWED_ORIGINS: "$(escape_yaml "$ALLOWED_ORIGINS")"
ENVYAML

# Deploy function
echo "Deploying Cloud Function 'leaderboard'..."
gcloud functions deploy leaderboard \
  --gen2 \
  --runtime nodejs22 \
  --entry-point leaderboard \
  --source ./gcp-function \
  --region $REGION \
  --trigger-http \
  --allow-unauthenticated \
  --service-account $SA_EMAIL \
  --env-vars-file "$ENV_FILE"

# Get URL
echo "Getting function URL..."
URL=$(gcloud functions describe leaderboard --gen2 --region $REGION --format="value(serviceConfig.uri)")

echo "----------------------------------------"
echo "Deployment successful!"
echo "Function URL: $URL"
echo "----------------------------------------"

# Update .env or config if possible (but user might need to verify)
echo "Please update your frontend configuration with this URL."
