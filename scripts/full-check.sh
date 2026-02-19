#!/bin/bash
# Full verification: code quality, build, GCS, and cloud services
# Run from project root: ./scripts/full-check.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

 section() { echo ""; echo ">>> $1"; }

 section "1. Code quality (Astro, ESLint, Prettier)"
npm run check

section "2. Tests"
npm test

section "3. Build"
npm run build

section "4. GCS & cloud services"
bash scripts/check-gcs-setup.sh

section "5. GCS upload dry-run"
npm run upload:assets:dry

echo ""
echo "=========================================="
echo "All checks passed. Site is ready."
echo "=========================================="
