#!/bin/bash
# Rebuild Cloud SQL connection: create instance (if missing), database, user, and grants.
# Reads from directus/.env. Run from directus/ or project root.
#
# Usage:
#   ./directus/reconnect-cloudsql.sh                    # Use existing instance, create DB/user if missing
#   CREATE_INSTANCE=true ./directus/reconnect-cloudsql.sh   # Create instance if it doesn't exist (~5–10 min)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

[ -f .env ] && set -a && source .env && set +a

PROJECT_ID="${GCP_PROJECT_ID:-local34org-assets}"
REGION="${GCP_REGION:-us-west1}"
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-${PROJECT_ID}:${REGION}:local34org-directus-b}"
INSTANCE_NAME="${CLOUD_SQL_INSTANCE##*:}"
DB_DATABASE="${DB_DATABASE:-local34site-directus-db}"
DB_USER="${DB_USER:-directus}"

echo "=== Rebuild Cloud SQL Connection ==="
echo "Project:      $PROJECT_ID"
echo "Instance:     $INSTANCE_NAME ($CLOUD_SQL_INSTANCE)"
echo "Database:     $DB_DATABASE"
echo "User:         $DB_USER"
echo ""

# Check instance exists
SQL_EXISTS=false
if gcloud sql instances describe "$INSTANCE_NAME" --project "$PROJECT_ID" &>/dev/null; then
  SQL_EXISTS=true
fi

if [[ "$SQL_EXISTS" != true ]]; then
  if [[ "${CREATE_INSTANCE:-false}" == "true" ]]; then
    echo ">>> Creating Cloud SQL instance ($INSTANCE_NAME) - takes ~5–10 minutes"
    gcloud services enable sqladmin.googleapis.com --project "$PROJECT_ID" --quiet
    gcloud sql instances create "$INSTANCE_NAME" \
      --database-version=POSTGRES_15 \
      --tier=db-f1-micro \
      --region="$REGION" \
      --project="$PROJECT_ID"
    echo "Waiting for instance to be ready..."
    until gcloud sql instances describe "$INSTANCE_NAME" --project "$PROJECT_ID" --format='value(state)' 2>/dev/null | grep -q RUNNABLE; do
      sleep 15
      echo "  Still waiting..."
    done
    echo "Instance ready."
    SQL_EXISTS=true
  else
    echo "Error: Cloud SQL instance $INSTANCE_NAME not found."
    echo ""
    echo "Options:"
    echo "  1. Create manually: GCP Console → SQL → Create Instance"
    echo "     Name: $INSTANCE_NAME, Region: $REGION, PostgreSQL 15"
    echo ""
    echo "  2. Create via script: CREATE_INSTANCE=true ./directus/reconnect-cloudsql.sh"
    echo ""
    echo "  3. If using a different instance, set CLOUD_SQL_INSTANCE in directus/.env"
    echo "     Format: project:region:instance"
    exit 1
  fi
fi

echo ""
echo ">>> Setting up database and user"

gcloud services enable sqladmin.googleapis.com --project "$PROJECT_ID" --quiet

# Create database
DB_EXISTS=false
gcloud sql databases list --instance="$INSTANCE_NAME" --project "$PROJECT_ID" 2>/dev/null | grep -q "^${DB_DATABASE}" && DB_EXISTS=true

if [[ "$DB_EXISTS" != true ]]; then
  echo "Creating database: $DB_DATABASE"
  gcloud sql databases create "$DB_DATABASE" \
    --instance="$INSTANCE_NAME" \
    --project "$PROJECT_ID" \
    --charset=UTF8
else
  echo "Database $DB_DATABASE exists (skip)"
fi

# Create user
USER_EXISTS=false
gcloud sql users list --instance="$INSTANCE_NAME" --project "$PROJECT_ID" 2>/dev/null | grep -q "^${DB_USER}" && USER_EXISTS=true

if [[ "$USER_EXISTS" != true ]]; then
  echo "Creating user: $DB_USER"
  gcloud sql users create "$DB_USER" \
    --instance="$INSTANCE_NAME" \
    --password="${DB_PASSWORD}" \
    --project "$PROJECT_ID"
else
  echo "User $DB_USER exists (skip)"
fi

# Grant permissions
echo "Granting privileges..."
echo "GRANT ALL PRIVILEGES ON DATABASE \"${DB_DATABASE}\" TO \"${DB_USER}\";" | \
  gcloud sql connect "$INSTANCE_NAME" --user=postgres --database=postgres --project "$PROJECT_ID" --quiet 2>/dev/null || \
  echo "  (Grant skipped - run manually if needed: gcloud sql connect $INSTANCE_NAME --user=postgres)"

echo ""
echo "Done. Connection string in directus/.env:"
echo "  CLOUD_SQL_INSTANCE=$CLOUD_SQL_INSTANCE"
echo ""
echo "For local dev with Cloud SQL Proxy:"
echo "  cloud-sql-proxy $CLOUD_SQL_INSTANCE --port=5433"
