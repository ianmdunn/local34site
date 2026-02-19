#!/bin/bash
# Fix VALUE_TOO_LONG: alter updates.content from VARCHAR to TEXT
# The Directus PATCH only updates metadata; the DB column stays VARCHAR.
# Run: ./directus/fix-content-column.sh
# Requires: cloud-sql-proxy (brew install cloud-sql-proxy). Uses psql or Docker.

set -e
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
PROXY_PORT=5433

echo "=== Fix updates.content column (VARCHAR → TEXT) ==="
echo "Instance: $CLOUD_SQL_INSTANCE"
echo ""

# Start Cloud SQL Proxy if needed
if ! lsof -i :$PROXY_PORT &>/dev/null; then
  echo "Starting Cloud SQL Proxy..."
  if command -v cloud-sql-proxy &>/dev/null; then
    cloud-sql-proxy "$CLOUD_SQL_INSTANCE" --port=$PROXY_PORT &
    PROXY_PID=$!
  elif command -v cloud_sql_proxy &>/dev/null; then
    cloud_sql_proxy -instances="$CLOUD_SQL_INSTANCE"=tcp:$PROXY_PORT &
    PROXY_PID=$!
  else
    echo "Error: Install cloud-sql-proxy: brew install cloud-sql-proxy"
    exit 1
  fi
  trap "kill $PROXY_PID 2>/dev/null" EXIT
  sleep 4
fi

echo "Running: ALTER TABLE updates ALTER COLUMN content TYPE text;"
SQL="ALTER TABLE updates ALTER COLUMN content TYPE text;"

# Docker (local dev) or Cloud SQL proxy
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q directus-postgres; then
  docker exec -i directus-postgres psql -U "${DB_USER:-directus}" -d "$DB" -c "$SQL"
  elif lsof -i :$PROXY_PORT &>/dev/null; then
  if command -v psql &>/dev/null; then
    PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -p $PROXY_PORT -U "$DB_USER" -d "$DB" -c "$SQL"
  else
    echo "Using Node.js (psql not installed)..."
    (cd "$SCRIPT_DIR/.." && npm run fix:content-column)
  fi
else
  echo "Error: Start Cloud SQL Proxy or Docker first."
  echo "  Cloud SQL: cloud-sql-proxy $CLOUD_SQL_INSTANCE --port=$PROXY_PORT"
  echo "  Docker:    cd directus && docker compose up -d"
  exit 1
fi

echo ""
echo "Done. Run 'npm run migrate:wp' again."
