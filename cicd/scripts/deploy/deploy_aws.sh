#!/bin/bash
# ============================================================
# EADD AWS Deployment Script
# Deploys: Lambda, Glue Jobs, Step Functions, S3 configs
#
# Platform Abstraction Layer:
#   Storage → S3
#   Processing → Glue / Lambda
#   Query → Athena
#   Orchestration → Step Functions
# ============================================================

set -e

ENVIRONMENT="${1:?Usage: deploy_aws.sh <environment> <version>}"
VERSION="${2:?}"
REGION="${AWS_REGION:-us-east-1}"
PREFIX="eadd-${ENVIRONMENT}"

echo "[AWS] Deploying to $ENVIRONMENT (region: $REGION, version: $VERSION)"

# ─── Deploy Lambda Functions ───────────────────────────────
echo "[AWS] Deploying Lambda functions..."
for lambda_dir in cicd/pipelines/aws/lambda/*/; do
  if [ -d "$lambda_dir" ]; then
    FUNC_NAME="${PREFIX}-$(basename $lambda_dir)"
    echo "  → $FUNC_NAME"
    
    # Package
    cd "$lambda_dir"
    zip -r /tmp/${FUNC_NAME}.zip . -x "*.pyc" "__pycache__/*"
    cd -
    
    # Deploy (create or update)
    if aws lambda get-function --function-name "$FUNC_NAME" --region "$REGION" 2>/dev/null; then
      aws lambda update-function-code \
        --function-name "$FUNC_NAME" \
        --zip-file "fileb:///tmp/${FUNC_NAME}.zip" \
        --region "$REGION" \
        --no-cli-pager || true
    else
      echo "  [WARN] Lambda $FUNC_NAME does not exist - skipping (create via Terraform)"
    fi
  fi
done

# ─── Deploy Glue Jobs ──────────────────────────────────────
echo "[AWS] Deploying Glue ETL scripts..."
if [ -d "cicd/pipelines/aws/glue" ]; then
  aws s3 sync cicd/pipelines/aws/glue/ \
    "s3://${PREFIX}-scripts/glue/" \
    --region "$REGION" \
    --delete || true
fi

# ─── Deploy Step Functions ─────────────────────────────────
echo "[AWS] Deploying Step Functions state machines..."
for sfn_def in cicd/pipelines/aws/step_functions/*.json; do
  if [ -f "$sfn_def" ]; then
    SFN_NAME="${PREFIX}-$(basename $sfn_def .json)"
    echo "  → $SFN_NAME"
    
    SFN_ARN=$(aws stepfunctions list-state-machines --region "$REGION" \
      --query "stateMachines[?name=='$SFN_NAME'].stateMachineArn" --output text 2>/dev/null)
    
    if [ -n "$SFN_ARN" ] && [ "$SFN_ARN" != "None" ]; then
      aws stepfunctions update-state-machine \
        --state-machine-arn "$SFN_ARN" \
        --definition "file://$sfn_def" \
        --region "$REGION" \
        --no-cli-pager || true
    fi
  fi
done

# ─── Deploy S3 Configurations ─────────────────────────────
echo "[AWS] Syncing pipeline configurations to S3..."
if [ -d "cicd/configs/$ENVIRONMENT" ]; then
  aws s3 sync "cicd/configs/$ENVIRONMENT/" \
    "s3://${PREFIX}-config/" \
    --region "$REGION" || true
fi

# ─── Tag deployment ────────────────────────────────────────
echo "[AWS] Recording deployment metadata..."
aws s3 cp - "s3://${PREFIX}-config/_deployment.json" --region "$REGION" <<EOF || true
{
  "version": "$VERSION",
  "environment": "$ENVIRONMENT",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployed_by": "${GITHUB_ACTOR:-manual}"
}
EOF

echo "[AWS] ✅ Deployment complete"
