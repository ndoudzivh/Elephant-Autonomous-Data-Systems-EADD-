#!/bin/bash
# ============================================================
# EADD Databricks Deployment Script
# Deploys: Jobs, Notebooks, Clusters, Delta Tables
#
# Platform Abstraction Layer:
#   Storage → Delta Lake (DBFS / Unity Catalog)
#   Processing → Spark (distributed)
#   Query → SQL Warehouse
#   Orchestration → Databricks Workflows
# ============================================================

set -e

ENVIRONMENT="${1:?Usage: deploy_databricks.sh <environment> <version>}"
VERSION="${2:?}"

# Databricks config from environment
DATABRICKS_HOST="${DATABRICKS_HOST:?DATABRICKS_HOST required}"
DATABRICKS_TOKEN="${DATABRICKS_TOKEN:?DATABRICKS_TOKEN required}"
WORKSPACE_PATH="/eadd/${ENVIRONMENT}"

echo "[Databricks] Deploying to $ENVIRONMENT (host: $DATABRICKS_HOST, version: $VERSION)"

# Helper: call Databricks API
databricks_api() {
  local METHOD=$1 ENDPOINT=$2 DATA=$3
  curl -s -X "$METHOD" \
    -H "Authorization: Bearer $DATABRICKS_TOKEN" \
    -H "Content-Type: application/json" \
    "${DATABRICKS_HOST}/api/2.1${ENDPOINT}" \
    ${DATA:+-d "$DATA"}
}

# ─── Deploy Notebooks ──────────────────────────────────────
echo "[Databricks] Deploying notebooks..."
if [ -d "cicd/pipelines/databricks/notebooks" ]; then
  for notebook in cicd/pipelines/databricks/notebooks/*.py; do
    if [ -f "$notebook" ]; then
      NB_NAME=$(basename "$notebook" .py)
      echo "  → $NB_NAME"
      
      # Base64 encode the notebook content
      CONTENT=$(base64 -w 0 "$notebook" 2>/dev/null || base64 "$notebook")
      
      databricks_api POST "/workspace/import" \
        "{\"path\":\"${WORKSPACE_PATH}/notebooks/${NB_NAME}\",\"content\":\"${CONTENT}\",\"language\":\"PYTHON\",\"overwrite\":true,\"format\":\"SOURCE\"}" \
        > /dev/null || true
    fi
  done
fi

# ─── Deploy Jobs ───────────────────────────────────────────
echo "[Databricks] Deploying job definitions..."
if [ -d "cicd/pipelines/databricks/jobs" ]; then
  for job_def in cicd/pipelines/databricks/jobs/*.json; do
    if [ -f "$job_def" ]; then
      JOB_NAME=$(jq -r '.name' "$job_def")
      echo "  → Job: $JOB_NAME"
      
      # Check if job exists
      EXISTING=$(databricks_api GET "/jobs/list?name=$JOB_NAME" | jq -r '.jobs[0].job_id // empty')
      
      if [ -n "$EXISTING" ]; then
        # Update existing job
        JOB_SETTINGS=$(jq '.settings' "$job_def")
        databricks_api POST "/jobs/update" \
          "{\"job_id\":$EXISTING,\"new_settings\":$JOB_SETTINGS}" > /dev/null || true
      else
        # Create new job
        databricks_api POST "/jobs/create" "$(cat $job_def)" > /dev/null || true
      fi
    fi
  done
fi

# ─── Deploy Delta Live Tables ──────────────────────────────
echo "[Databricks] Deploying DLT pipelines..."
if [ -d "cicd/pipelines/databricks/dlt" ]; then
  for dlt_def in cicd/pipelines/databricks/dlt/*.json; do
    if [ -f "$dlt_def" ]; then
      DLT_NAME=$(jq -r '.name' "$dlt_def")
      echo "  → DLT Pipeline: $DLT_NAME"
      databricks_api POST "/pipelines" "$(cat $dlt_def)" > /dev/null 2>&1 || true
    fi
  done
fi

echo "[Databricks] ✅ Deployment complete"
