#!/bin/bash
# ============================================================
# Smoke Test - Post-deployment health check
# Verifies all deployed components are responsive
# ============================================================

ENVIRONMENT="${1:?Usage: smoke_test.sh <environment>}"

echo "[Smoke Test] Running health checks for $ENVIRONMENT..."

PASSED=0
FAILED=0

check() {
  local NAME=$1 COMMAND=$2
  if eval "$COMMAND" > /dev/null 2>&1; then
    echo "  ✅ $NAME"
    PASSED=$((PASSED + 1))
  else
    echo "  ❌ $NAME"
    FAILED=$((FAILED + 1))
  fi
}

# AWS checks
check "AWS Lambda (health)" "curl -sf https://uaj2bmeq1c.execute-api.us-east-1.amazonaws.com/api/health"
check "AWS S3 (accessible)" "aws s3 ls s3://eadd-${ENVIRONMENT}-config/ 2>/dev/null"

# Generic checks
check "API responds" "curl -sf https://uaj2bmeq1c.execute-api.us-east-1.amazonaws.com/api/health | grep -q healthy"

echo ""
echo "[Smoke Test] Results: $PASSED passed, $FAILED failed"

if [ $FAILED -gt 0 ]; then
  echo "[Smoke Test] ❌ HEALTH CHECK FAILED"
  exit 1
fi

echo "[Smoke Test] ✅ All checks passed"
