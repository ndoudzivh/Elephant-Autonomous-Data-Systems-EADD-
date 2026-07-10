#!/bin/bash
# ============================================================
# 🐘 EADD — Quick Lambda Code Update
# ============================================================
#
# Use this for FAST code-only deployments (no infra changes).
# Pulls latest code from GitHub and updates the Lambda function.
#
# USAGE:
#   chmod +x update-lambda.sh
#   ./update-lambda.sh
#
# ============================================================

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
LAMBDA_NAME="eadd-backend-api"
BRANCH="eadpa-phase0-foundation"
REPO_URL="https://github.com/ndoudzivh/Elephant-Autonomous-Data-Systems-EADD-.git"

echo "🐘 EADD — Quick Lambda Update"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Clone latest
WORK_DIR="/tmp/eadd-update-$(date +%s)"
mkdir -p "$WORK_DIR" && cd "$WORK_DIR"

echo "  Pulling latest code from $BRANCH..."
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" 2>/dev/null
cd Elephant-Autonomous-Data-Systems-EADD-/packages/backend

# Install and package
echo "  Installing dependencies..."
npm install --production 2>/dev/null || npm install --legacy-peer-deps 2>/dev/null || true

echo "  Packaging..."
LAMBDA_ZIP="/tmp/${LAMBDA_NAME}-update.zip"
rm -f "$LAMBDA_ZIP"
zip -r "$LAMBDA_ZIP" . \
  -x "*.git*" "node_modules/aws-sdk/*" "*.ts" "tsconfig.json" \
  -x "node_modules/.cache/*" "tests/*" "*.test.*" 2>/dev/null

# Deploy
echo "  Deploying to Lambda: $LAMBDA_NAME..."
aws lambda update-function-code \
  --function-name "$LAMBDA_NAME" \
  --zip-file "fileb://$LAMBDA_ZIP" \
  --region "$REGION" \
  --no-cli-pager >/dev/null

# Wait
aws lambda wait function-updated --function-name "$LAMBDA_NAME" --region "$REGION" 2>/dev/null || sleep 5

# Cleanup
rm -rf "$WORK_DIR"

echo ""
echo "  ✓ Lambda updated successfully!"
echo "  ✓ Function: $LAMBDA_NAME"
echo "  ✓ Region: $REGION"
echo "  ✓ Deployed at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "  Test: aws lambda invoke --function-name $LAMBDA_NAME --payload '{\"path\":\"/health\"}' /tmp/response.json --region $REGION"
