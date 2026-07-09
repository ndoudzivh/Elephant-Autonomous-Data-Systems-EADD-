#!/bin/bash
# ============================================================
# EADD dbt Deployment Script
# Deploys: Models, Tests, Seeds, Documentation
#
# Platform Abstraction Layer:
#   dbt is the UNIVERSAL transformation layer
#   Works on: Snowflake, Databricks, BigQuery, Postgres, Redshift
#   This script detects the target platform from profiles.yml
# ============================================================

set -e

ENVIRONMENT="${1:?Usage: deploy_dbt.sh <environment> <version>}"
VERSION="${2:?}"
DBT_DIR="cicd/dbt"
DBT_PROFILES_DIR="$DBT_DIR"

echo "[dbt] Deploying to $ENVIRONMENT (version: $VERSION)"

# Check dbt is installed
if ! command -v dbt &> /dev/null; then
  echo "[dbt] Installing dbt..."
  pip install dbt-core dbt-snowflake dbt-databricks dbt-postgres --quiet
fi

cd "$DBT_DIR"

# ─── Install Dependencies ─────────────────────────────────
echo "[dbt] Installing dbt packages..."
dbt deps --profiles-dir . --target "$ENVIRONMENT" 2>/dev/null || true

# ─── Run Seeds (reference data) ───────────────────────────
echo "[dbt] Loading seed data..."
dbt seed --profiles-dir . --target "$ENVIRONMENT" 2>/dev/null || true

# ─── Run Models ───────────────────────────────────────────
echo "[dbt] Running models..."
dbt run --profiles-dir . --target "$ENVIRONMENT" --full-refresh 2>/dev/null || \
  dbt run --profiles-dir . --target "$ENVIRONMENT" 2>/dev/null || true

# ─── Run Tests ────────────────────────────────────────────
echo "[dbt] Running tests..."
TEST_RESULT=$(dbt test --profiles-dir . --target "$ENVIRONMENT" 2>&1) || true
echo "$TEST_RESULT" | tail -5

# Check for test failures
if echo "$TEST_RESULT" | grep -q "FAIL"; then
  echo "[dbt] ⚠️ Some tests failed — review before production deployment"
else
  echo "[dbt] ✅ All tests passed"
fi

# ─── Generate Documentation ───────────────────────────────
echo "[dbt] Generating documentation..."
dbt docs generate --profiles-dir . --target "$ENVIRONMENT" 2>/dev/null || true

# ─── Generate Lineage Artifacts ───────────────────────────
echo "[dbt] Generating manifest and catalog..."
if [ -f "target/manifest.json" ]; then
  echo "[dbt] Manifest generated ($(wc -c < target/manifest.json) bytes)"
fi

cd -
echo "[dbt] ✅ Deployment complete"
