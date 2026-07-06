#!/bin/bash
# ============================================================
# EADPA AWS Deployment Script
# 
# Prerequisites:
#   1. AWS CLI installed and configured (aws configure)
#   2. Node.js >= 20 and pnpm installed
#   3. Terraform >= 1.5 installed
#   4. Bedrock Claude access enabled in AWS Console
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh [dev|staging|production]
# ============================================================

set -e

ENVIRONMENT="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
INFRA_DIR="$SCRIPT_DIR/../terraform"

echo "============================================"
echo "  EADPA AWS Deployment"
echo "  Environment: $ENVIRONMENT"
echo "============================================"
echo ""

# Check prerequisites
echo "[1/6] Checking prerequisites..."
command -v aws >/dev/null 2>&1 || { echo "ERROR: aws CLI not found. Install: https://aws.amazon.com/cli/"; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo "ERROR: terraform not found. Install: https://terraform.io/downloads"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "ERROR: node not found. Install: https://nodejs.org"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "ERROR: pnpm not found. Install: npm install -g pnpm"; exit 1; }

# Verify AWS credentials
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
if [ -z "$AWS_ACCOUNT" ]; then
  echo "ERROR: AWS credentials not configured. Run: aws configure"
  exit 1
fi
echo "  AWS Account: $AWS_ACCOUNT"
echo "  Region: $(aws configure get region)"
echo ""

# Build the backend
echo "[2/6] Building backend..."
cd "$PROJECT_ROOT"
pnpm install
cd packages/backend
pnpm build

# Package for Lambda
echo "[3/6] Packaging backend for Lambda..."
mkdir -p "$SCRIPT_DIR/../dist"
cd "$PROJECT_ROOT/packages/backend"
zip -r "$SCRIPT_DIR/../dist/backend.zip" dist/ node_modules/ package.json

# Build the frontend
echo "[4/6] Building frontend..."
cd "$PROJECT_ROOT/packages/frontend"

# Set the API URL for the build (will be updated after terraform apply)
export NEXT_PUBLIC_API_URL="placeholder"
pnpm build
# Export as static site
npx next export 2>/dev/null || true

echo ""

# Deploy infrastructure with Terraform
echo "[5/6] Deploying AWS infrastructure..."
cd "$INFRA_DIR"
terraform init -input=false
terraform plan -var="environment=$ENVIRONMENT" -out=tfplan
terraform apply -auto-approve tfplan

# Get outputs
FRONTEND_URL=$(terraform output -raw frontend_url)
BACKEND_URL=$(terraform output -raw backend_url)
S3_FRONTEND=$(terraform output -raw s3_frontend_bucket)
LAMBDA_NAME=$(terraform output -raw lambda_function_name)

echo ""

# Rebuild frontend with correct API URL
echo "[6/6] Deploying frontend to S3..."
cd "$PROJECT_ROOT/packages/frontend"
export NEXT_PUBLIC_API_URL="$BACKEND_URL"
pnpm build
npx next export 2>/dev/null || true

# Upload to S3
aws s3 sync out/ "s3://$S3_FRONTEND/" --delete

echo ""
echo "============================================"
echo "  DEPLOYMENT COMPLETE!"
echo "============================================"
echo ""
echo "  Frontend: $FRONTEND_URL"
echo "  Backend:  $BACKEND_URL"
echo ""
echo "  NOTE: CloudFront may take 5-10 minutes to"
echo "  propagate. The frontend URL will work after."
echo ""
echo "  IMPORTANT: If you haven't already, enable"
echo "  Claude model access in the AWS Bedrock console:"
echo "  https://console.aws.amazon.com/bedrock/home#/modelaccess"
echo "============================================"
