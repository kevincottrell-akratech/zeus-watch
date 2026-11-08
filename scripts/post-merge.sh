#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Reconcile locked dependencies without changing lockfiles or touching app data.
# Include build tools even when the workspace runs with NODE_ENV=production.
npm ci --include=dev --no-audit --no-fund
npm --prefix client ci --include=dev --no-audit --no-fund

# Workflow reconciliation restarts Zeus Watch, which builds before serving.
# Do not seed/reset databases, import fixtures, configure credentials or deploy.
