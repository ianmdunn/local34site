#!/bin/bash
set -e

# Directus one-command setup: Cloud SQL DB/user, deploy to Cloud Run, handshake verification
# Run from directus/ directory
# Prerequisites: Cloud SQL instance (or set CREATE_CLOUD_SQL_IF_MISSING=true), GCS key
# See ../GCS_BUCKETS.md for canonical bucket/credential config

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project)}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-directus}"
IMAGE_NAME="directus"
REPO="${REGION}-docker.pkg.dev/${PROJECT_ID}/directus-repo/${IMAGE_NAME}"
DB_DATABASE="${DB_DATABASE:-local34site-directus-db}"
DB_USER="${DB_USER:-directus}"
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-${PROJECT_ID}:${REGION}:directus-db}"
INSTANCE_NAME="${CLOUD_SQL_INSTANCE##*:}"

echo "=== Directus Cloud Run Deployment ==="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo "Cloud SQL: $CLOUD_SQL_INSTANCE"
echo ""

# ---- Step 0: Audit available resources ----
echo ">>> Step 0: Auditing available resources"

# Check Cloud SQL instance exists
SQL_INSTANCE_EXISTS=false
if gcloud sql instances describe "$INSTANCE_NAME" --project "$PROJECT_ID" &>/dev/null; then
  SQL_INSTANCE_EXISTS=true
fi

# Check database
DB_EXISTS=false
if [[ "$SQL_INSTANCE_EXISTS" == true ]] && gcloud sql databases list --instance="$INSTANCE_NAME" --project "$PROJECT_ID" 2>/dev/null | grep -q "^${DB_DATABASE}"; then
  DB_EXISTS=true
fi

# Check user
USER_EXISTS=false
if [[ "$SQL_INSTANCE_EXISTS" == true ]] && gcloud sql users list --instance="$INSTANCE_NAME" --project "$PROJECT_ID" 2>/dev/null | grep -q "^${DB_USER}"; then
  USER_EXISTS=true
fi

# Check service account
SA_EXISTS=false
if gcloud iam service-accounts describe "directus@${PROJECT_ID}.iam.gserviceaccount.com" --project "$PROJECT_ID" &>/dev/null; then
  SA_EXISTS=true
fi

# Check Artifact Registry repo
REPO_EXISTS=false
if gcloud artifacts repositories describe directus-repo --location="$REGION" --project "$PROJECT_ID" &>/dev/null; then
  REPO_EXISTS=true
fi

# Check Secret
SECRET_EXISTS=false
if gcloud secrets describe directus-gcs-key --project "$PROJECT_ID" &>/dev/null; then
  SECRET_EXISTS=true
fi

# Check Cloud Run service
RUN_EXISTS=false
if gcloud run services describe "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" &>/dev/null; then
  RUN_EXISTS=true
fi

# Print plan
echo ""
echo "Resource plan:"
echo "  Cloud SQL instance $INSTANCE_NAME: $([ "$SQL_INSTANCE_EXISTS" = true ] && echo 'EXISTS' || echo 'NOT FOUND (create manually first)')"
echo "  Database $DB_DATABASE:            $([ "$DB_EXISTS" = true ] && echo 'EXISTS (skip)' || echo 'CREATE')"
echo "  User $DB_USER:                    $([ "$USER_EXISTS" = true ] && echo 'EXISTS (skip)' || echo 'CREATE')"
echo "  Service account directus:         $([ "$SA_EXISTS" = true ] && echo 'EXISTS (update IAM)' || echo 'CREATE')"
echo "  Artifact Registry directus-repo:   $([ "$REPO_EXISTS" = true ] && echo 'EXISTS (skip)' || echo 'CREATE')"
echo "  Secret directus-gcs-key:           $([ "$SECRET_EXISTS" = true ] && echo 'EXISTS (update)' || echo 'CREATE')"
echo "  Cloud Run $SERVICE_NAME:           $([ "$RUN_EXISTS" = true ] && echo 'EXISTS (update)' || echo 'CREATE')"
echo "  Docker image:                      BUILD (always)"
echo ""

if [[ "$SQL_INSTANCE_EXISTS" != true ]]; then
  if [[ "${CREATE_CLOUD_SQL_IF_MISSING:-false}" == "true" ]]; then
    echo ">>> Creating Cloud SQL instance ($INSTANCE_NAME) - this takes ~5–10 minutes"
    gcloud services enable sqladmin.googleapis.com --project "$PROJECT_ID" --quiet
    gcloud sql instances create "$INSTANCE_NAME" \
      --database-version=POSTGRES_15 \
      --tier=db-f1-micro \
      --region="$REGION" \
      --project="$PROJECT_ID" \
      --quiet
    echo "Waiting for instance to be ready..."
    until gcloud sql instances describe "$INSTANCE_NAME" --project "$PROJECT_ID" --format='value(state)' 2>/dev/null | grep -q RUNNABLE; do
      sleep 15
      echo "  Still waiting..."
    done
    SQL_INSTANCE_EXISTS=true
    echo "Cloud SQL instance ready."
  else
    echo "Error: Cloud SQL instance $INSTANCE_NAME not found."
    echo "  Option 1: Create manually in GCP Console (SQL → Create Instance)"
    echo "  Option 2: Create via script: CREATE_CLOUD_SQL_IF_MISSING=true ./deploy-directus-cloudrun.sh"
    exit 1
  fi
fi

# ---- Step 1: Cloud SQL database and user ----
echo ">>> Step 1: Cloud SQL setup"
gcloud services enable sqladmin.googleapis.com --project "$PROJECT_ID" --quiet

if [[ "$DB_EXISTS" != true ]]; then
  echo "Creating database: $DB_DATABASE"
  gcloud sql databases create "$DB_DATABASE" \
    --instance="$INSTANCE_NAME" \
    --project "$PROJECT_ID" \
    --charset=UTF8
else
  echo "Database $DB_DATABASE already exists (skip)"
fi

if [[ "$USER_EXISTS" != true ]]; then
  echo "Creating user: $DB_USER"
  gcloud sql users create "$DB_USER" \
    --instance="$INSTANCE_NAME" \
    --password="${DB_PASSWORD}" \
    --project "$PROJECT_ID"
else
  echo "User $DB_USER already exists (skip)"
fi

echo "Granting permissions..."
[[ -n "$POSTGRES_ADMIN_PASSWORD" ]] && export PGPASSWORD="$POSTGRES_ADMIN_PASSWORD"
echo "GRANT ALL PRIVILEGES ON DATABASE \"${DB_DATABASE}\" TO \"${DB_USER}\";" | gcloud sql connect "$INSTANCE_NAME" --user=postgres --database=postgres --project "$PROJECT_ID" --quiet 2>/dev/null || echo "Note: Grant step skipped (run manually: gcloud sql connect $INSTANCE_NAME --user=postgres)"
unset PGPASSWORD 2>/dev/null || true

# ---- Step 2: GCS bucket (create if missing) ----
echo ""
echo ">>> Step 2: GCS bucket"
if ! gsutil ls "gs://${GCS_BUCKET}" &>/dev/null; then
  echo "Creating GCS bucket: gs://${GCS_BUCKET}"
  gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://${GCS_BUCKET}" 2>/dev/null || echo "Note: Bucket may already exist or need manual creation"
else
  echo "GCS bucket gs://${GCS_BUCKET} exists"
fi

# ---- Step 3: Enable APIs & dedicated service account ----
echo ""
echo ">>> Step 3: Enabling APIs and creating Directus service account"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com iam.googleapis.com --project "$PROJECT_ID"

# Create dedicated service account for Directus (least privilege)
DIRECTUS_SA="directus@${PROJECT_ID}.iam.gserviceaccount.com"
DIRECTUS_SA_NAME="directus"

if [[ "$SA_EXISTS" != true ]]; then
  echo "Creating service account: $DIRECTUS_SA_NAME"
  gcloud iam service-accounts create "$DIRECTUS_SA_NAME" \
    --display-name "Directus Cloud Run" \
    --project "$PROJECT_ID"
  echo "Waiting for IAM propagation..."
  sleep 10
else
  echo "Service account $DIRECTUS_SA_NAME already exists (update IAM)"
fi

# Grant roles to Directus service account
echo "Granting roles to $DIRECTUS_SA_NAME..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DIRECTUS_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet 2>/dev/null || true
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DIRECTUS_SA}" \
  --role="roles/cloudsql.client" \
  --quiet 2>/dev/null || true
# GCS: grant Storage Object Admin on the Directus bucket
gsutil iam ch "serviceAccount:${DIRECTUS_SA}:objectAdmin" "gs://${GCS_BUCKET}" 2>/dev/null || echo "Note: Grant gsutil iam ch serviceAccount:${DIRECTUS_SA}:objectAdmin gs://${GCS_BUCKET} if GCS fails"
# Also grant the SA from GCS_KEY_PATH (used by Directus for GCS operations)
KEY_FILE="${GCS_KEY_PATH:-../.gcp/local34org-assets-c2d6db5f8970.json}"
KEY_ABS="${KEY_FILE}"
[[ "$KEY_FILE" != /* ]] && KEY_ABS="$(cd .. && pwd)/${KEY_FILE#../}"
if [ -f "$KEY_ABS" ]; then
  GCS_SA_EMAIL=$(grep -o '"client_email": *"[^"]*"' "$KEY_ABS" | cut -d'"' -f4)
  if [[ -n "$GCS_SA_EMAIL" ]]; then
    gsutil iam ch "serviceAccount:${GCS_SA_EMAIL}:objectAdmin" "gs://${GCS_BUCKET}" 2>/dev/null || echo "Note: Grant gsutil iam ch serviceAccount:${GCS_SA_EMAIL}:objectAdmin gs://${GCS_BUCKET} if GCS fails"
  fi
fi

# ---- Step 4: Artifact Registry ----
if [[ "$REPO_EXISTS" != true ]]; then
  echo "Creating Artifact Registry repository directus-repo..."
  gcloud artifacts repositories create directus-repo --repository-format=docker --location="$REGION" --project "$PROJECT_ID"
else
  echo "Artifact Registry directus-repo already exists (skip)"
fi

# ---- Step 5: Secret Manager ----
SECRET_NAME="directus-gcs-key"
KEY_FILE="${GCS_KEY_PATH:-../.gcp/local34org-assets-c2d6db5f8970.json}"
KEY_ABS="${KEY_FILE}"
[[ "$KEY_FILE" != /* ]] && KEY_ABS="$(cd .. && pwd)/${KEY_FILE#../}"

if [ -f "$KEY_ABS" ]; then
  if [[ "$SECRET_EXISTS" != true ]]; then
    echo "Creating secret $SECRET_NAME..."
    gcloud secrets create "$SECRET_NAME" --data-file="$KEY_ABS" --project "$PROJECT_ID"
  else
    echo "Updating secret $SECRET_NAME..."
    gcloud secrets versions add "$SECRET_NAME" --data-file="$KEY_ABS" --project "$PROJECT_ID"
  fi
else
  echo "Warning: GCS key not found at $KEY_ABS"
fi

# ---- Step 6: Build ----
echo ""
echo ">>> Step 6: Building Docker image"
gcloud builds submit --tag "$REPO:latest" --project "$PROJECT_ID" .

# ---- Step 7: Deploy ----
echo ""
echo ">>> Step 7: Deploying to Cloud Run ($([ "$RUN_EXISTS" = true ] && echo 'update' || echo 'create'))"

# Use env vars file for safe handling of DB_PASSWORD/ADMIN_PASSWORD (special chars like {,),$ break --set-env-vars)
ENV_FILE=$(mktemp)
trap "rm -f $ENV_FILE" EXIT
# Escape double quotes in values for YAML safety
escape_yaml() { printf '%s' "$1" | sed 's/"/\\"/g'; }
cat > "$ENV_FILE" << ENVYAML
HOST: "0.0.0.0"
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
STORAGE_LOCATIONS: "gcs"
STORAGE_GCS_DRIVER: "gcs"
STORAGE_GCS_BUCKET: "$(escape_yaml "$GCS_BUCKET")"
STORAGE_GCS_KEY_FILENAME: "/secrets/gcs-key.json"
GCS_BUCKET_URL: "$(escape_yaml "${GCS_BUCKET_URL:-https://storage.googleapis.com/${GCS_BUCKET}}")"
ENVYAML

gcloud run deploy "$SERVICE_NAME" \
  --image "$REPO:latest" \
  --region "$REGION" \
  --platform managed \
  --service-account "$DIRECTUS_SA" \
  --allow-unauthenticated \
  --add-cloudsql-instances "$CLOUD_SQL_INSTANCE" \
  --env-vars-file "$ENV_FILE" \
  --set-secrets "/secrets/gcs-key.json=${SECRET_NAME}:latest" \
  --memory 2Gi \
  --cpu 2 \
  --no-cpu-throttling \
  --startup-probe "tcpSocket.port=8080,initialDelaySeconds=90,failureThreshold=4,periodSeconds=30,timeoutSeconds=5" \
  --min-instances 0 \
  --max-instances 10 \
  --project "$PROJECT_ID"

# ---- Step 8: Update PUBLIC_URL ----
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format="value(status.url)" --project "$PROJECT_ID")
gcloud run services update "$SERVICE_NAME" --region "$REGION" --update-env-vars "PUBLIC_URL=$SERVICE_URL" --project "$PROJECT_ID" --quiet

# ---- Step 9: Handshake verification ----
echo ""
echo ">>> Step 9: Handshake verification"
HEALTH_URL="${SERVICE_URL}/server/health"
echo "Checking $HEALTH_URL ..."

MAX_ATTEMPTS=30
ATTEMPT=1
HEALTH_OK=false
if [[ "${SKIP_HANDSHAKE:-false}" == "true" ]]; then
  echo "Skipped (SKIP_HANDSHAKE=true)"
else
  while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
      HEALTH_OK=true
      break
    fi
    echo -n "."
    sleep 10
    ATTEMPT=$((ATTEMPT + 1))
  done
fi

echo ""
echo "=== Deployment complete ==="
echo "Directus URL: $SERVICE_URL"
echo ""
if [ "$HEALTH_OK" = true ]; then
  echo "Health check passed."
else
  echo "Health check did not pass (may return 503 until GCS/DB are OK)."
  echo "Check: $SERVICE_URL"
  echo "Logs: gcloud run services logs read $SERVICE_NAME --region $REGION --project $PROJECT_ID"
fi
echo ""
echo "Login with:"
echo "  Email: $ADMIN_EMAIL"
echo "  Password: (from ADMIN_PASSWORD in .env)"
echo ""
