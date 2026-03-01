#!/bin/bash
# Push final dist/ contents to live site via FTP (using lftp).
# Run after cleanup:dist so only HTML + JS + CSS are deployed (assets served from GCS).
#
# Required env vars (in .env):
#   DEPLOY_FTP_HOST   – e.g. local34.org or ftp.local34.org
#   DEPLOY_FTP_USER   – FTP username
#   DEPLOY_FTP_PASSWORD – FTP password
#   DEPLOY_PATH       – remote directory, e.g. /local34_org or /public_html
#
# Optional:
#   DEPLOY_FTP_PORT   – FTP port (default: 21)
#
# Requires: lftp (brew install lftp)
#
# Usage:
#   ./scripts/deploy-ftp-push.sh
#   ./scripts/deploy-ftp-push.sh --dry-run
#
# Run from project root.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v lftp &>/dev/null; then
  echo "Fatal: lftp not found. Install with: brew install lftp" >&2
  exit 1
fi

# Load .env
[ -f .env ] && set -a && source .env && set +a

# Trim whitespace
DEPLOY_FTP_HOST="${DEPLOY_FTP_HOST// /}"
DEPLOY_FTP_USER="${DEPLOY_FTP_USER// /}"
DEPLOY_PATH="${DEPLOY_PATH// /}"

DIST_DIR="$ROOT_DIR/dist"
DRY_RUN=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="--dry-run" ;;
  esac
done

if [ -z "$DEPLOY_FTP_HOST" ] || [ -z "$DEPLOY_FTP_USER" ] || [ -z "$DEPLOY_FTP_PASSWORD" ] || [ -z "$DEPLOY_PATH" ]; then
  echo ">>> Skipping FTP push: DEPLOY_FTP_HOST, DEPLOY_FTP_USER, DEPLOY_FTP_PASSWORD, DEPLOY_PATH must be set in .env"
  exit 0
fi

if [ ! -d "$DIST_DIR" ]; then
  echo "Fatal: dist/ not found. Run build first." >&2
  exit 1
fi

PORT="${DEPLOY_FTP_PORT:-21}"

echo ""
echo ">>> Pushing dist/ to ftp://${DEPLOY_FTP_HOST}:${PORT}${DEPLOY_PATH}"
[ -n "$DRY_RUN" ] && echo "    (dry run)"
echo ""

# Use LFTP_PASSWORD env to avoid special-char issues in -u user,pass
export LFTP_PASSWORD="$DEPLOY_FTP_PASSWORD"

LFTP_CMD="set ftp:passive-mode on
set ftp:ssl-allow no
open -p $PORT -u ${DEPLOY_FTP_USER} ftp://${DEPLOY_FTP_HOST}
mirror -R -v --delete --exclude .DS_Store $DRY_RUN $DIST_DIR $DEPLOY_PATH
bye"

echo "$LFTP_CMD" | lftp

code=$?
if [ $code -eq 0 ]; then
  echo ""
  echo "✓ FTP push complete"
else
  echo "Fatal: lftp failed (exit $code)" >&2
  exit $code
fi
