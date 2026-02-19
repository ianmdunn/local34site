#!/bin/bash
set -e

# Bootstrap Directus: create schema + admin user when DB is empty
# Use this when "password reset failed" (admin doesn't exist yet)
# Requires: cloud-sql-proxy (brew install cloud-sql-proxy)
# Run: ./directus/bootstrap-admin.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

PROJECT_ID="${GCP_PROJECT_ID:-local34org-assets}"
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-${PROJECT_ID}:us-west1:local34org-directus-b}"
DB="${DB_DATABASE:-local34site-directus-db}"

echo "=== Directus Bootstrap (create schema + admin) ==="
echo "Email: $ADMIN_EMAIL"
echo "Instance: $CLOUD_SQL_INSTANCE"
echo ""

# Start Cloud SQL Proxy (or reuse if port already in use)
PROXY_PORT=5433
if lsof -i :$PROXY_PORT &>/dev/null; then
  echo "Port $PROXY_PORT already in use, assuming Cloud SQL Proxy is running."
  PROXY_PID=
else
  echo "Starting Cloud SQL Proxy..."
  if command -v cloud-sql-proxy &>/dev/null; then
    cloud-sql-proxy "$CLOUD_SQL_INSTANCE" --port=$PROXY_PORT &
    PROXY_PID=$!
  elif command -v cloud_sql_proxy &>/dev/null; then
    cloud_sql_proxy -instances="$CLOUD_SQL_INSTANCE"=tcp:$PROXY_PORT &
    PROXY_PID=$!
  else
    echo "Error: Install cloud-sql-proxy first: brew install cloud-sql-proxy"
    exit 1
  fi
  trap "kill $PROXY_PID 2>/dev/null" EXIT
  sleep 4
fi

# DB connection for CLI
export DB_CLIENT=pg
export DB_HOST=127.0.0.1
export DB_PORT=$PROXY_PORT
export DB_DATABASE="$DB"
export DB_USER="$DB_USER"
export DB_PASSWORD="$DB_PASSWORD"

# Run Directus bootstrap via npx (connects to Cloud SQL via proxy)
# Uses local storage so GCS isn't required for bootstrap
echo "Running Directus bootstrap (schema + admin)..."
echo "Ensure Cloud SQL Proxy is listening on 127.0.0.1:5433"
echo ""

if ! DB_CLIENT=pg \
   DB_HOST=127.0.0.1 \
   DB_PORT=$PROXY_PORT \
   DB_DATABASE="$DB" \
   DB_USER="$DB_USER" \
   DB_PASSWORD="$DB_PASSWORD" \
   KEY="$KEY" \
   SECRET="$SECRET" \
   ADMIN_EMAIL="$ADMIN_EMAIL" \
   ADMIN_PASSWORD="$ADMIN_PASSWORD" \
   STORAGE_LOCATIONS=local \
   npx --yes directus@11 bootstrap 2>&1; then
  echo ""
  echo "Bootstrap failed. If Directus is already running (setup completed), use reset-admin-password.sh instead."
  echo "  ./reset-admin-password.sh"
  exit 1
fi

echo ""
echo "Bootstrap complete. Log in at https://directus-mgdoanjcka-uw.a.run.app"
echo "  Email: $ADMIN_EMAIL"
echo "  Password: (from ADMIN_PASSWORD in .env)"
