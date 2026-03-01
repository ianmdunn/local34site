#!/bin/bash
# Set up SSH key and known_hosts for deploy. Idempotent – safe to run repeatedly.
# Creates ~/.ssh/local34_deploy (or DEPLOY_SSH_KEY) if missing; adds host to known_hosts.
# When DEPLOY_SSH_PASSWORD is set, uses ssh-copy-id to install the key on the server.
#
# All settings from .env: DEPLOY_SSH_HOST, DEPLOY_SSH_USER, DEPLOY_SSH_PORT, DEPLOY_SSH_PASSWORD, DEPLOY_SSH_KEY

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

[ -f .env ] && set -a && source .env && set +a

# Trim whitespace from env vars
DEPLOY_SSH_HOST="${DEPLOY_SSH_HOST// /}"
DEPLOY_SSH_USER="${DEPLOY_SSH_USER// /}"
DEPLOY_SSH_CONNECT_HOST="${DEPLOY_SSH_CONNECT_HOST// /}"
CONNECT_HOST="${DEPLOY_SSH_CONNECT_HOST:-$DEPLOY_SSH_HOST}"

if [ -z "$DEPLOY_SSH_HOST" ]; then
  echo ">>> Skipping SSH setup: DEPLOY_SSH_HOST not set in .env" >&2
  exit 0
fi

SSH_DIR="$HOME/.ssh"
KEY_PATH="${DEPLOY_SSH_KEY:-$SSH_DIR/local34_deploy}"
PORT="${DEPLOY_SSH_PORT:-22}"
SSH_USER="${DEPLOY_SSH_USER:-$USER}"
KNOWN_HOSTS="$SSH_DIR/known_hosts"

# Ensure .ssh exists
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

# Generate key if missing
if [ ! -f "$KEY_PATH" ]; then
  echo ">>> Generating SSH key for deploy: $KEY_PATH"
  ssh-keygen -t ed25519 -f "$KEY_PATH" -N "" -C "local34-deploy"
  chmod 600 "$KEY_PATH"
  chmod 644 "${KEY_PATH}.pub"
  echo "✓ Key created"
  echo ""
fi

# Add host to known_hosts if missing
if [ -f "$KNOWN_HOSTS" ]; then
  if ! grep -qF "$CONNECT_HOST" "$KNOWN_HOSTS" 2>/dev/null; then
    echo ">>> Adding $CONNECT_HOST to known_hosts"
    ssh-keyscan -p "$PORT" "$CONNECT_HOST" 2>/dev/null >> "$KNOWN_HOSTS"
  fi
else
  ssh-keyscan -p "$PORT" "$CONNECT_HOST" 2>/dev/null >> "$KNOWN_HOSTS"
  chmod 600 "$KNOWN_HOSTS"
fi

# If password set, install key on server via ssh-copy-id (one-time)
if [ -n "$DEPLOY_SSH_PASSWORD" ] && [ -f "${KEY_PATH}.pub" ]; then
  if command -v sshpass &>/dev/null; then
    echo ">>> Installing deploy key on server (using DEPLOY_SSH_PASSWORD)..."
    if sshpass -p "$DEPLOY_SSH_PASSWORD" ssh-copy-id \
      -i "${KEY_PATH}.pub" \
      -o StrictHostKeyChecking=accept-new \
      -p "$PORT" \
      "${SSH_USER}@${CONNECT_HOST}" 2>/dev/null; then
      echo "✓ Deploy key installed on server. You can remove DEPLOY_SSH_PASSWORD from .env now."
    else
      echo ">>> Key install failed. Ensure DEPLOY_SSH_USER and DEPLOY_SSH_PASSWORD are correct in .env"
      echo "    Manual: Add the public key below to ~/.ssh/authorized_keys on the server"
      echo ""
      cat "${KEY_PATH}.pub"
    fi
  else
    echo ">>> DEPLOY_SSH_PASSWORD set but sshpass not found. Install: brew install sshpass"
    echo "    Or add this key manually to ${SSH_USER}@${CONNECT_HOST}:~/.ssh/authorized_keys"
    echo ""
    cat "${KEY_PATH}.pub"
  fi
elif [ -f "${KEY_PATH}.pub" ]; then
  echo ">>> Deploy key ready: $KEY_PATH"
  echo "    To auto-install: set DEPLOY_SSH_PASSWORD in .env and run again"
fi

echo "$KEY_PATH"
