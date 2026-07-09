#!/bin/bash
# ============================================================
# Blue/Green Deployment Strategy
# Deploys to inactive slot, validates, then switches traffic
# ============================================================

set -e

ENVIRONMENT="${1:?Usage: deploy_blue_green.sh <environment> <version>}"
VERSION="${2:?}"

echo "[Blue/Green] Starting deployment (env: $ENVIRONMENT, version: $VERSION)"

# Determine active slot
ACTIVE_SLOT=$(cat /tmp/eadd-${ENVIRONMENT}-active-slot.txt 2>/dev/null || echo "blue")
if [ "$ACTIVE_SLOT" == "blue" ]; then
  DEPLOY_SLOT="green"
else
  DEPLOY_SLOT="blue"
fi

echo "[Blue/Green] Active: $ACTIVE_SLOT → Deploying to: $DEPLOY_SLOT"

# Deploy to inactive slot
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SLOT_ENV="${ENVIRONMENT}-${DEPLOY_SLOT}"

"$SCRIPT_DIR/deploy_all.sh" "$ENVIRONMENT" "$VERSION"

# Validate the new deployment
echo "[Blue/Green] Validating $DEPLOY_SLOT slot..."
"$SCRIPT_DIR/../validate/smoke_test.sh" "$ENVIRONMENT" || {
  echo "[Blue/Green] ❌ Validation failed — NOT switching traffic"
  exit 1
}

# Switch traffic
echo "[Blue/Green] ✅ Switching traffic: $ACTIVE_SLOT → $DEPLOY_SLOT"
echo "$DEPLOY_SLOT" > /tmp/eadd-${ENVIRONMENT}-active-slot.txt

echo "[Blue/Green] ✅ Deployment complete (active slot: $DEPLOY_SLOT)"
