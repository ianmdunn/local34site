#!/bin/bash
# Push final dist/ contents to live site via rsync over SSH.
# Run after cleanup:dist so only HTML + JS + CSS are deployed (assets served from GCS).
#
# Required env vars (in .env):
#   DEPLOY_SSH_HOST   – e.g. local34.org or server.example.com
#   DEPLOY_PATH      – remote directory, e.g. /var/www/local34.org/html
#
# Optional:
#   DEPLOY_SSH_USER     – SSH user (default: current $USER)
#   DEPLOY_SSH_PORT     – SSH port (default: 22)
#   DEPLOY_SSH_KEY      – Path to SSH key (default: ~/.ssh/local34_deploy). Setup creates it if missing.
#   DEPLOY_SSH_PASSWORD – Fallback: use sshpass for password auth if key auth fails (install: brew install sshpass)
#
# Usage:
#   ./scripts/deploy-ssh-push.sh
#   ./scripts/deploy-ssh-push.sh --dry-run
#
# Run from project root.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# Load .env
[ -f .env ] && set -a && source .env && set +a

# Trim whitespace
DEPLOY_SSH_HOST="${DEPLOY_SSH_HOST// /}"
DEPLOY_SSH_USER="${DEPLOY_SSH_USER// /}"
DEPLOY_SSH_CONNECT_HOST="${DEPLOY_SSH_CONNECT_HOST// /}"
CONNECT_HOST="${DEPLOY_SSH_CONNECT_HOST:-$DEPLOY_SSH_HOST}"

# Ensure SSH key and known_hosts exist (idempotent)
bash "$SCRIPT_DIR/deploy-ssh-setup.sh" || true
KEY_PATH="${DEPLOY_SSH_KEY:-$HOME/.ssh/local34_deploy}"

DIST_DIR="$ROOT_DIR/dist"
DRY_RUN=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="--dry-run -v" ;;
  esac
done

if [ -z "$DEPLOY_SSH_HOST" ] || [ -z "$DEPLOY_PATH" ]; then
  echo ">>> Skipping SSH push: DEPLOY_SSH_HOST and DEPLOY_PATH not set in .env"
  echo "    Add DEPLOY_SSH_HOST and DEPLOY_PATH to enable live-site deploy."
  exit 0
fi

if [ ! -d "$DIST_DIR" ]; then
  echo "Fatal: dist/ not found. Run build first." >&2
  exit 1
fi

SSH_USER="${DEPLOY_SSH_USER:-$USER}"
PORT="${DEPLOY_SSH_PORT:-22}"
DEST="${SSH_USER}@${CONNECT_HOST}:${DEPLOY_PATH}"
SSH_OPTS="-p ${PORT} -o StrictHostKeyChecking=accept-new"
[ -f "$KEY_PATH" ] && SSH_OPTS="$SSH_OPTS -i $KEY_PATH"

echo ""
echo ">>> Pushing dist/ to ${CONNECT_HOST}:${DEPLOY_PATH}"
[ -n "$DRY_RUN" ] && echo "    (dry run)"
echo ""

if [ -n "$DEPLOY_SSH_PASSWORD" ]; then
  if ! command -v sshpass &>/dev/null; then
    echo "Fatal: DEPLOY_SSH_PASSWORD is set but sshpass not found. Install with: brew install sshpass" >&2
    exit 1
  fi
  sshpass -p "$DEPLOY_SSH_PASSWORD" rsync $DRY_RUN -a --delete \
    -e "ssh $SSH_OPTS" \
    --exclude '.DS_Store' \
    "$DIST_DIR/" \
    "$DEST/"
else
  rsync $DRY_RUN -a --delete \
    -e "ssh $SSH_OPTS" \
    --exclude '.DS_Store' \
    "$DIST_DIR/" \
    "$DEST/"
fi

code=$?
if [ $code -eq 0 ]; then
  echo ""
  echo "✓ SSH push complete"
else
  echo "Fatal: rsync failed (exit $code)" >&2
  exit $code
fi
