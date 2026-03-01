#!/bin/bash
set -e

# Reset Directus admin password via Cloud Run Job (no local cloud-sql-proxy needed)
# Runs in GCP with same DB access as Directus service
# Run: ./directus/reset-password-cloudrun.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

PROJECT_ID="${GCP_PROJECT_ID:-local34org-assets}"
REGION="${GCP_REGION:-us-west1}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-directus}"
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-${PROJECT_ID}:${REGION}:local34org-directus-b}"
REPO="${REGION}-docker.pkg.dev/${PROJECT_ID}/directus-repo/directus"
JOB_NAME="directus-reset-password"
DIRECTUS_SA="directus@${PROJECT_ID}.iam.gserviceaccount.com"
SECRET_NAME="directus-gcs-key"

echo "=== Directus Password Reset (Cloud Run Job) ==="
echo "Email: $ADMIN_EMAIL"
echo "Project: $PROJECT_ID"
echo ""

# Create env file for job (same as service, but STORAGE_LOCATIONS=local to avoid GCS for passwd)
# Include ADMIN_PASSWORD so we can pass via env (avoids escaping in --args)
ENV_FILE=$(mktemp)
trap "rm -f $ENV_FILE" EXIT
escape_yaml() { printf '%s' "$1" | sed 's/"/\\"/g'; }
cat > "$ENV_FILE" << ENVYAML
DB_CLIENT: "pg"
DB_HOST: "/cloudsql/${CLOUD_SQL_INSTANCE}"
DB_PORT: "5432"
DB_DATABASE: "$(escape_yaml "$DB_DATABASE")"
DB_USER: "$(escape_yaml "$DB_USER")"
DB_PASSWORD: "$(escape_yaml "$DB_PASSWORD")"
KEY: "$(escape_yaml "$KEY")"
SECRET: "$(escape_yaml "$SECRET")"
ADMIN_EMAIL: "$(escape_yaml "$ADMIN_EMAIL")"
ADMIN_PASSWORD: "$(escape_yaml "$ADMIN_PASSWORD")"
STORAGE_LOCATIONS: "local"
ENVYAML

echo "Creating/updating Cloud Run Job..."
# Use env vars for email/password to avoid shell escaping issues with special chars
if gcloud run jobs describe "$JOB_NAME" --region "$REGION" --project "$PROJECT_ID" &>/dev/null; then
  gcloud run jobs update "$JOB_NAME" \
    --image "$REPO:latest" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --set-cloudsql-instances "$CLOUD_SQL_INSTANCE" \
    --service-account "$DIRECTUS_SA" \
    --env-vars-file "$ENV_FILE" \
    --set-secrets "/secrets/gcs-key.json=${SECRET_NAME}:latest" \
    --memory 512Mi \
    --task-timeout 60 \
    --args "directus,users,passwd,--email,$ADMIN_EMAIL,--password,$ADMIN_PASSWORD" \
    --quiet
else
  gcloud run jobs create "$JOB_NAME" \
    --image "$REPO:latest" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --set-cloudsql-instances "$CLOUD_SQL_INSTANCE" \
    --service-account "$DIRECTUS_SA" \
    --env-vars-file "$ENV_FILE" \
    --set-secrets "/secrets/gcs-key.json=${SECRET_NAME}:latest" \
    --memory 512Mi \
    --task-timeout 60 \
    --args "directus,users,passwd,--email,$ADMIN_EMAIL,--password,$ADMIN_PASSWORD" \
    --quiet
fi

echo ""
echo "Executing job to reset password..."
gcloud run jobs execute "$JOB_NAME" --region "$REGION" --project "$PROJECT_ID" --wait

echo ""
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format="value(status.url)" --project "$PROJECT_ID" 2>/dev/null || echo "")
if [ -n "$SERVICE_URL" ]; then
  echo "Done. Log in at $SERVICE_URL"
else
  echo "Done. Log in at your Directus URL (from Cloud Run console)"
fi
echo "  Email: $ADMIN_EMAIL"
echo "  Password: (from ADMIN_PASSWORD in .env)"
