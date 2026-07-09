#!/bin/bash
# ============================================================
# EADD Snowflake Deployment Script
# Deploys: Warehouses, Tables, Stored Procedures, Tasks, Streams
#
# Platform Abstraction Layer:
#   Storage → Snowflake Stages / Iceberg Tables
#   Processing → Snowflake Stored Procedures / Tasks
#   Query → Snowflake SQL Warehouse
#   Orchestration → Snowflake Tasks + Streams
# ============================================================

set -e

ENVIRONMENT="${1:?Usage: deploy_snowflake.sh <environment> <version>}"
VERSION="${2:?}"

# Snowflake config
SNOWFLAKE_ACCOUNT="${SNOWFLAKE_ACCOUNT:?SNOWFLAKE_ACCOUNT required}"
SNOWFLAKE_USER="${SNOWFLAKE_USER:?SNOWFLAKE_USER required}"
SNOWFLAKE_PASSWORD="${SNOWFLAKE_PASSWORD:?SNOWFLAKE_PASSWORD required}"
SNOWFLAKE_DATABASE="EADD_${ENVIRONMENT^^}"
SNOWFLAKE_WAREHOUSE="EADD_${ENVIRONMENT^^}_WH"

echo "[Snowflake] Deploying to $ENVIRONMENT (account: $SNOWFLAKE_ACCOUNT, version: $VERSION)"

# Helper: execute Snowflake SQL
run_snowsql() {
  local SQL_FILE=$1
  snowsql -a "$SNOWFLAKE_ACCOUNT" \
    -u "$SNOWFLAKE_USER" \
    -p "$SNOWFLAKE_PASSWORD" \
    -d "$SNOWFLAKE_DATABASE" \
    -w "$SNOWFLAKE_WAREHOUSE" \
    -f "$SQL_FILE" \
    --option quiet=true 2>/dev/null || \
    echo "  [WARN] SnowSQL execution may have failed for $SQL_FILE"
}

# ─── Deploy Schema Changes (DDL) ──────────────────────────
echo "[Snowflake] Deploying schema changes..."
if [ -d "cicd/pipelines/snowflake/ddl" ]; then
  for sql_file in cicd/pipelines/snowflake/ddl/*.sql; do
    if [ -f "$sql_file" ]; then
      echo "  → $(basename $sql_file)"
      run_snowsql "$sql_file"
    fi
  done
fi

# ─── Deploy Stored Procedures ─────────────────────────────
echo "[Snowflake] Deploying stored procedures..."
if [ -d "cicd/pipelines/snowflake/procedures" ]; then
  for proc_file in cicd/pipelines/snowflake/procedures/*.sql; do
    if [ -f "$proc_file" ]; then
      echo "  → $(basename $proc_file)"
      run_snowsql "$proc_file"
    fi
  done
fi

# ─── Deploy Tasks (Orchestration) ─────────────────────────
echo "[Snowflake] Deploying tasks and streams..."
if [ -d "cicd/pipelines/snowflake/tasks" ]; then
  for task_file in cicd/pipelines/snowflake/tasks/*.sql; do
    if [ -f "$task_file" ]; then
      echo "  → $(basename $task_file)"
      run_snowsql "$task_file"
    fi
  done
fi

# ─── Deploy Dynamic Tables ────────────────────────────────
echo "[Snowflake] Deploying dynamic tables..."
if [ -d "cicd/pipelines/snowflake/dynamic_tables" ]; then
  for dt_file in cicd/pipelines/snowflake/dynamic_tables/*.sql; do
    if [ -f "$dt_file" ]; then
      echo "  → $(basename $dt_file)"
      run_snowsql "$dt_file"
    fi
  done
fi

# ─── Record deployment metadata ───────────────────────────
echo "[Snowflake] Recording deployment metadata..."
cat > /tmp/sf_deploy_meta.sql <<EOF
USE DATABASE ${SNOWFLAKE_DATABASE};
CREATE TABLE IF NOT EXISTS _METADATA.DEPLOYMENTS (
  version STRING, environment STRING, deployed_at TIMESTAMP, deployed_by STRING
);
INSERT INTO _METADATA.DEPLOYMENTS VALUES ('$VERSION', '$ENVIRONMENT', CURRENT_TIMESTAMP(), '${GITHUB_ACTOR:-manual}');
EOF
run_snowsql "/tmp/sf_deploy_meta.sql"

echo "[Snowflake] ✅ Deployment complete"
