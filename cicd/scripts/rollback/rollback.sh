#!/bin/bash
# ============================================================
# EADD Rollback Script
# Rolls back to previous deployed version
# ============================================================

set -e

ENVIRONMENT="${1:?Usage: rollback.sh <environment> [version]}"
ROLLBACK_VERSION="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "============================================================"
echo "  EADD ROLLBACK"
echo "  Environment: $ENVIRONMENT"
echo "  Rollback to: ${ROLLBACK_VERSION:-previous version}"
echo "============================================================"

if [ -z "$ROLLBACK_VERSION" ]; then
  # Get previous version from deployment log
  ROLLBACK_VERSION=$(cat /tmp/eadd-${ENVIRONMENT}-prev-version.txt 2>/dev/null || echo "unknown")
  echo "[Rollback] Rolling back to previous version: $ROLLBACK_VERSION"
fi

if [ "$ROLLBACK_VERSION" == "unknown" ]; then
  echo "[Rollback] ❌ No previous version found. Cannot rollback."
  exit 1
fi

# Execute rollback (redeploy previous version)
"$SCRIPT_DIR/../deploy/deploy_all.sh" "$ENVIRONMENT" "$ROLLBACK_VERSION"

echo ""
echo "✅ Rollback complete. Environment: $ENVIRONMENT → Version: $ROLLBACK_VERSION"
