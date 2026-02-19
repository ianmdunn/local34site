#!/bin/bash
set -e

# Reset Directus admin password via Cloud SQL
# Requires: cloud-sql-proxy (brew install cloud-sql-proxy)
# Run: ./directus/reset-admin-password.sh (from project root) or ./reset-admin-password.sh (from directus/)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

PROJECT_ID="${GCP_PROJECT_ID:-local34org-assets}"
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-${PROJECT_ID}:us-west1:local34org-directus-b}"
ADMIN_EMAIL="${ADMIN_EMAIL:-dunn@yaleunions.org}"

echo "Resetting password for $ADMIN_EMAIL"
echo "New password: $ADMIN_PASSWORD"
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
    echo "Or: gcloud components install cloud-sql-proxy"
    exit 1
  fi
  trap "kill $PROXY_PID 2>/dev/null" EXIT
  sleep 3
fi

# Run Directus password reset (--yes skips npx install prompt)
echo "Running password reset (first run may install directus)..."
if DB_CLIENT=pg \
   DB_HOST=127.0.0.1 \
   DB_PORT=$PROXY_PORT \
   DB_DATABASE="${DB_DATABASE:-local34site-directus-db}" \
   DB_USER="${DB_USER}" \
   DB_PASSWORD="${DB_PASSWORD}" \
   npx --yes directus@11 users passwd --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD"; then
  echo ""
  echo "Password reset complete. Log in at https://directus-mgdoanjcka-uw.a.run.app with $ADMIN_EMAIL"
else
  echo ""
  echo "Password reset failed. Check that the admin user exists (Directus must have started at least once)."
  exit 1
fi
