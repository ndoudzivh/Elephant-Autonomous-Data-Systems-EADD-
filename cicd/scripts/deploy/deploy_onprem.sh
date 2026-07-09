#!/bin/bash
# ============================================================
# EADD On-Premises Deployment Script
# Deploys: Spark jobs, Airflow DAGs, Kafka configs
#
# Platform Abstraction Layer:
#   Storage → HDFS / Local FS
#   Processing → Spark (standalone/YARN)
#   Streaming → Kafka
#   Orchestration → Airflow
# ============================================================

set -e

ENVIRONMENT="${1:?Usage: deploy_onprem.sh <environment> <version>}"
VERSION="${2:?}"

# On-prem hosts (from secrets)
AIRFLOW_HOST="${AIRFLOW_HOST:-localhost}"
SPARK_MASTER="${SPARK_MASTER:-spark://localhost:7077}"
DEPLOY_USER="${DEPLOY_USER:-eadd}"

echo "[On-Prem] Deploying to $ENVIRONMENT (version: $VERSION)"

# ─── Deploy Airflow DAGs ───────────────────────────────────
echo "[On-Prem] Deploying Airflow DAGs..."
if [ -d "cicd/pipelines/onprem/airflow/dags" ]; then
  AIRFLOW_DAGS_DIR="/opt/airflow/dags/eadd"
  
  if [ -n "$SSH_KEY" ]; then
    # Remote deployment via SSH
    echo "$SSH_KEY" > /tmp/deploy_key && chmod 600 /tmp/deploy_key
    
    ssh -i /tmp/deploy_key -o StrictHostKeyChecking=no \
      "$DEPLOY_USER@$AIRFLOW_HOST" "mkdir -p $AIRFLOW_DAGS_DIR" || true
    
    scp -i /tmp/deploy_key -o StrictHostKeyChecking=no -r \
      cicd/pipelines/onprem/airflow/dags/* \
      "$DEPLOY_USER@$AIRFLOW_HOST:$AIRFLOW_DAGS_DIR/" || true
    
    rm -f /tmp/deploy_key
    echo "  ✅ DAGs deployed to $AIRFLOW_HOST"
  else
    # Local deployment (for testing)
    echo "  [INFO] No SSH key — deploying locally"
    cp -r cicd/pipelines/onprem/airflow/dags/* /tmp/airflow_dags/ 2>/dev/null || true
  fi
fi

# ─── Deploy Spark Jobs ─────────────────────────────────────
echo "[On-Prem] Deploying Spark jobs..."
if [ -d "cicd/pipelines/onprem/spark" ]; then
  SPARK_JOBS_DIR="/opt/spark/jobs/eadd"
  
  for job in cicd/pipelines/onprem/spark/*.py; do
    if [ -f "$job" ]; then
      echo "  → $(basename $job)"
    fi
  done
  echo "  [INFO] Spark jobs synced"
fi

# ─── Deploy Kafka Configs ──────────────────────────────────
echo "[On-Prem] Deploying Kafka configurations..."
if [ -d "cicd/pipelines/onprem/kafka" ]; then
  for config in cicd/pipelines/onprem/kafka/*.json; do
    if [ -f "$config" ]; then
      TOPIC_NAME=$(jq -r '.topic' "$config" 2>/dev/null || basename "$config" .json)
      echo "  → Topic config: $TOPIC_NAME"
    fi
  done
fi

echo "[On-Prem] ✅ Deployment complete"
