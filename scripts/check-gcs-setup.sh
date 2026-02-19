#!/bin/bash
# Quick setup check: GCS buckets, credentials, and related services
# Run from project root: ./scripts/check-gcs-setup.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠ $1 (optional)"; PASS=$((PASS+1)); }
section() { echo ""; echo ">>> $1"; }

# Load root .env only (avoid overriding with directus vars)
[ -f .env ] && set -a && source .env && set +a

section "1. Environment variables (root .env)"

[ -n "$GCS_BUCKET_NAME" ] && [ "$GCS_BUCKET_NAME" = "local34site-assetfiles" ] && pass "GCS_BUCKET_NAME=$GCS_BUCKET_NAME" || fail "GCS_BUCKET_NAME (expected local34site-assetfiles, got ${GCS_BUCKET_NAME:-<empty>})"
[ -n "$GCS_BUCKET_URL" ] && [[ "$GCS_BUCKET_URL" == *"local34site-assetfiles"* ]] && pass "GCS_BUCKET_URL set" || fail "GCS_BUCKET_URL (expected *local34site-assetfiles*)"
[ -n "$GOOGLE_APPLICATION_CREDENTIALS" ] && pass "GOOGLE_APPLICATION_CREDENTIALS set" || fail "GOOGLE_APPLICATION_CREDENTIALS not set"
[ -n "$GCS_ENABLED" ] && pass "GCS_ENABLED=$GCS_ENABLED" || fail "GCS_ENABLED not set"
[ -n "$LEADERBOARD_BUCKET_NAME" ] && pass "LEADERBOARD_BUCKET_NAME=$LEADERBOARD_BUCKET_NAME" || fail "LEADERBOARD_BUCKET_NAME not set"
[ -n "$PUBLIC_LEADERBOARD_API" ] && pass "PUBLIC_LEADERBOARD_API set" || fail "PUBLIC_LEADERBOARD_API not set"
[ -n "$PUBLIC_DIRECTUS_URL" ] && pass "PUBLIC_DIRECTUS_URL set (updates page)" || warn "PUBLIC_DIRECTUS_URL not set (/updates will be empty)"

section "2. Credential files"

KEY_ROOT="${GOOGLE_APPLICATION_CREDENTIALS:-.gcp/local34org-assets-c2d6db5f8970.json}"
[[ "$KEY_ROOT" != /* ]] && KEY_ROOT="$ROOT_DIR/$KEY_ROOT"
if [ -f "$KEY_ROOT" ]; then
  if command -v jq &>/dev/null; then
    jq -e .project_id "$KEY_ROOT" >/dev/null 2>&1 && pass "Site assets key valid JSON" || fail "Site assets key invalid JSON"
  else
    grep -q '"project_id"' "$KEY_ROOT" && pass "Site assets key exists" || fail "Site assets key invalid"
  fi
else
  fail "Site assets key missing: $KEY_ROOT"
fi

# Directus key (from directus/.env)
DIRECTUS_KEY=$(grep -E "^GCS_KEY_PATH=" directus/.env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || echo "../.gcp/local34org-assets-c2d6db5f8970.json")
[[ "$DIRECTUS_KEY" == ../* ]] && DIRECTUS_KEY="$ROOT_DIR/${DIRECTUS_KEY#../}"
[ -f "$DIRECTUS_KEY" ] && pass "Directus GCS key exists" || fail "Directus GCS key missing: $DIRECTUS_KEY"

section "3. GCS bucket access"

# Use ADC file only — do not run gsutil (it triggers macOS keychain "Please enter your password")
ADC_FILE="${HOME}/.config/gcloud/application_default_credentials.json"

if [ -f "$ADC_FILE" ]; then
  pass "gs://${GCS_BUCKET_NAME:-local34site-assetfiles} (ADC present)"
  pass "gs://local34org-directus-files (ADC present)"
  pass "gs://${LEADERBOARD_BUCKET_NAME:-local34-game-leaderboard} (ADC present)"
elif command -v gcloud &>/dev/null; then
  echo ""
  echo "  Authenticate with Google (browser will open): gcloud auth application-default login"
  echo ""
  read -r -p "  Run it now? [y/N] " reply
  if [[ "$reply" =~ ^[yY] ]]; then
    gcloud auth application-default login
    echo ""
    if [ -f "$ADC_FILE" ]; then
      pass "gs://${GCS_BUCKET_NAME:-local34site-assetfiles} (ADC present)"
      pass "gs://local34org-directus-files (ADC present)"
      pass "gs://${LEADERBOARD_BUCKET_NAME:-local34-game-leaderboard} (ADC present)"
    else
      fail "ADC not created — run gcloud auth application-default login and re-run"
      fail "Bucket check skipped"
      fail "Bucket check skipped"
    fi
  else
    fail "Authenticate first: gcloud auth application-default login (then re-run)"
    fail "Bucket check skipped"
    fail "Bucket check skipped"
  fi
else
  fail "Install gcloud SDK and run: gcloud auth application-default login"
  fail "Bucket check skipped"
  fail "Bucket check skipped"
fi

section "4. Services (optional)"

if [ -n "$PUBLIC_LEADERBOARD_API" ] && command -v curl &>/dev/null; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "$PUBLIC_LEADERBOARD_API" 2>/dev/null || echo "000")
  [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "405" ] && pass "Leaderboard API reachable" || warn "Leaderboard API unreachable (HTTP $HTTP_CODE)"
fi

DIRECTUS_URL=$(grep -E "^PUBLIC_URL=" directus/.env 2>/dev/null | cut -d= -f2- | tr -d ' \r' || echo "https://directus-mgdoanjcka-uw.a.run.app")
# If PUBLIC_URL is localhost, also try Cloud Run URL (local may not be running)
if [[ "$DIRECTUS_URL" == *"localhost"* ]]; then
  DIRECTUS_URL="https://directus-mgdoanjcka-uw.a.run.app"
fi
if [[ "$DIRECTUS_URL" == http* ]] && command -v curl &>/dev/null; then
  HEALTH_URL="${DIRECTUS_URL%/}/server/health"
  DIRECTUS_HTTP=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$HEALTH_URL" 2>/dev/null || echo "000")
  [ "$DIRECTUS_HTTP" = "200" ] && pass "Directus health OK" || warn "Directus health failed (HTTP $DIRECTUS_HTTP) - $HEALTH_URL"
fi

section "5. Config consistency (GCS_BUCKETS.md)"

grep -q "GCS_BUCKET_NAME=local34site-assetfiles" .env 2>/dev/null && pass "Root .env matches GCS_BUCKETS.md" || fail "Root .env GCS_BUCKET_NAME should be local34site-assetfiles"
grep -q "GCS_BUCKET=local34org-directus-files" directus/.env 2>/dev/null && pass "Directus .env matches GCS_BUCKETS.md" || fail "Directus GCS_BUCKET should be local34org-directus-files"

echo ""
echo "=========================================="
echo "Result: $PASS passed, $FAIL failed"
echo "=========================================="
if [ "$FAIL" -eq 0 ]; then
  echo "All checks passed."
else
  echo "Fix the failures above. See GCS_BUCKETS.md for config."
  exit 1
fi
