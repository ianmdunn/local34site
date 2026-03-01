#!/usr/bin/env bash
#
# init.sh – Get a clean computer ready to run the Local 34 site
#
# Run from project root:  bash scripts/init.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[init]${NC} $*"; }
ok()    { echo -e "${GREEN}[init]${NC} $*"; }
warn()  { echo -e "${YELLOW}[init]${NC} $*"; }
fail()  { echo -e "${RED}[init]${NC} $*"; exit 1; }

# -----------------------------------------------------------------------------
# 1. Node.js
# -----------------------------------------------------------------------------
info "Checking Node.js..."
if ! command -v node &>/dev/null; then
  fail "Node.js is not installed. Install Node >= 24 (e.g. from nodejs.org or via nvm)"
fi

REQUIRED_MAJOR=18
CURRENT_VERSION=$(node -v 2>/dev/null || true)
CURRENT_MAJOR=$(echo "$CURRENT_VERSION" | sed -n 's/^v\([0-9]*\).*/\1/p')

# package.json engines: ^18.17.1 || ^20.3.0 || >= 21.0.0
case "$CURRENT_MAJOR" in
  18|20) ;;           # 18.x, 20.x
  [2-9][0-9]*) ;;     # 21+
  *) warn "Node $CURRENT_VERSION may not match required engines (^18.17.1 || ^20.3.0 || >= 21.0.0). Continuing anyway." ;;
esac

ok "Node $CURRENT_VERSION"

# -----------------------------------------------------------------------------
# 2. npm
# -----------------------------------------------------------------------------
info "Checking npm..."
if ! command -v npm &>/dev/null; then
  fail "npm is not installed. It usually comes with Node.js."
fi
ok "npm $(npm -v)"

# -----------------------------------------------------------------------------
# 3. Install dependencies
# -----------------------------------------------------------------------------
info "Installing npm dependencies..."
npm install
ok "Dependencies installed"

# -----------------------------------------------------------------------------
# 4. Environment file
# -----------------------------------------------------------------------------
if [[ ! -f .env ]]; then
  info "Creating .env from .env.example..."
  cp .env.example .env
  ok ".env created – edit it to add Directus, GCS, and deployment credentials for full features"
  warn "You can run 'npm run dev' without credentials; CMS and deploy features will be limited."
else
  ok ".env already exists"
fi

# -----------------------------------------------------------------------------
# 5. Ensure contract page is enabled for dev
# -----------------------------------------------------------------------------
info "Ensuring contract page is enabled for development..."
node scripts/ensure-contract-dev.js 2>/dev/null || true
ok "Contract page ready"

# -----------------------------------------------------------------------------
# 6. Smoke test (build)
# -----------------------------------------------------------------------------
info "Running a quick build to verify setup..."
if npm run build:fast 2>/dev/null; then
  ok "Build succeeded"
else
  warn "Build had issues – you may need to configure .env. Try 'npm run dev' to start the dev server."
fi

# -----------------------------------------------------------------------------
# 7. Python (optional – for campaign-posters)
# -----------------------------------------------------------------------------
if [[ -f scripts/requirements-wecantkeepup.txt ]]; then
  if command -v python3 &>/dev/null && [[ ! -d .venv ]]; then
    warn "Python venv not found. To enable campaign-posters: python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements-wecantkeepup.txt"
  elif [[ -d .venv ]]; then
    ok "Python venv exists (.venv)"
  fi
fi

# -----------------------------------------------------------------------------
# Done
# -----------------------------------------------------------------------------
echo ""
ok "Setup complete. Next steps:"
echo "   npm run dev      # Start dev server at http://localhost:4321"
echo "   npm run build    # Production build"
echo "   npm test         # Run tests"
echo ""
echo "For GCS uploads, Directus CMS, and deployment, configure .env (see README.md)."
