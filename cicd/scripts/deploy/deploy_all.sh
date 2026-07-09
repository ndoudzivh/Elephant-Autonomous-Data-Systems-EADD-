#!/bin/bash
# ============================================================
# EADD Universal Deployment Orchestrator
# Platform-Agnostic - Deploys to detected/configured targets
#
# Usage: ./deploy_all.sh <environment> <version>
# Example: ./deploy_all.sh production abc123
# ============================================================

set -e

ENVIRONMENT="${1:?Usage: deploy_all.sh <environment> <version>}"
VERSION="${2:?Usage: deploy_all.sh <environment> <version>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$(cd "$SCRIPT_DIR/../../configs/$ENVIRONMENT" && pwd)"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "============================================================"
echo "  EADD Universal Deployment"
echo "  Environment: $ENVIRONMENT"
echo "  Version:     $VERSION"
echo "  Time:        $TIMESTAMP"
echo "============================================================"

# Load environment config
if [ -f "$CONFIG_DIR/platform_config.yml" ]; then
  echo "[INFO] Loading platform config from $CONFIG_DIR/platform_config.yml"
fi

# Track deployment status
DEPLOY_STATUS=()
DEPLOY_FAILED=0

deploy_component() {
  local COMPONENT=$1
  local SCRIPT=$2
  
  echo ""
  echo "──────────────────────────────────────────"
  echo "  Deploying: $COMPONENT"
  echo "──────────────────────────────────────────"
  
  if [ -x "$SCRIPT_DIR/$SCRIPT" ]; then
    if "$SCRIPT_DIR/$SCRIPT" "$ENVIRONMENT" "$VERSION"; then
      DEPLOY_STATUS+=("✅ $COMPONENT")
      echo "[OK] $COMPONENT deployed successfully"
    else
      DEPLOY_STATUS+=("❌ $COMPONENT")
      DEPLOY_FAILED=$((DEPLOY_FAILED + 1))
      echo "[FAIL] $COMPONENT deployment failed"
    fi
  else
    DEPLOY_STATUS+=("⏭️ $COMPONENT (skipped - no script)")
    echo "[SKIP] $COMPONENT - deployment script not found"
  fi
}

# Deploy in dependency order
# 1. Infrastructure first
deploy_component "Infrastructure (Terraform)" "deploy_infrastructure.sh"

# 2. Data platforms
deploy_component "AWS (Glue, Lambda, S3, Step Functions)" "deploy_aws.sh"
deploy_component "Azure (Data Factory, Synapse, Functions)" "deploy_azure.sh"
deploy_component "Databricks (Jobs, Notebooks)" "deploy_databricks.sh"
deploy_component "Snowflake (Warehouses, Tables, Procedures)" "deploy_snowflake.sh"

# 3. Transformation layer
deploy_component "dbt (Models, Tests, Documentation)" "deploy_dbt.sh"

# 4. On-premises
deploy_component "On-Premises (Spark, Airflow)" "deploy_onprem.sh"

# Summary
echo ""
echo "============================================================"
echo "  Deployment Summary"
echo "============================================================"
for status in "${DEPLOY_STATUS[@]}"; do
  echo "  $status"
done
echo ""

if [ $DEPLOY_FAILED -gt 0 ]; then
  echo "⚠️  $DEPLOY_FAILED component(s) failed!"
  echo "Consider running rollback: ./scripts/rollback/rollback.sh $ENVIRONMENT"
  exit 1
else
  echo "✅ All components deployed successfully!"
  # Record successful deployment version
  echo "$VERSION" > "/tmp/eadd-$ENVIRONMENT-version.txt"
fi
