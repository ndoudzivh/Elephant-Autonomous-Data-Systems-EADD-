#!/bin/bash
# ============================================================
# EADD Backend Deploy Script - Run this on YOUR machine
# 
# Prerequisites:
#   - aws configure (done)
#   - Node.js 20+ installed
#   - npm installed
#
# Usage: bash deploy-backend.sh
# ============================================================

set -e

echo "============================================"
echo "  EADD - Deploying Backend to AWS Lambda"
echo "============================================"
echo ""

# Check AWS credentials
echo "[1/7] Checking AWS credentials..."
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
if [ -z "$AWS_ACCOUNT" ]; then
  echo "ERROR: AWS not configured. Run: aws configure"
  exit 1
fi
AWS_REGION=$(aws configure get region || echo "us-east-1")
echo "  Account: $AWS_ACCOUNT"
echo "  Region: $AWS_REGION"
echo ""

# Clone repo if not already
echo "[2/7] Getting code..."
if [ ! -d "Elephant-Autonomous-Data-Systems-EADD-" ]; then
  git clone https://github.com/ndoudzivh/Elephant-Autonomous-Data-Systems-EADD-.git
fi
cd Elephant-Autonomous-Data-Systems-EADD-
git checkout main 2>/dev/null || git checkout eadpa-phase0-foundation
echo ""

# Install backend
echo "[3/7] Installing backend dependencies..."
cd packages/backend
npm install --production
echo ""

# Create Lambda handler wrapper
echo "[4/7] Creating Lambda handler..."
cat > dist/lambda.js << 'EOF'
const { createApp } = require('./index');
const serverless = require('serverless-http');
const app = createApp();
module.exports.handler = serverless(app);
EOF
npm install serverless-http
echo ""

# Package for Lambda
echo "[5/7] Packaging for Lambda..."
cd ../..
mkdir -p dist
cd packages/backend
zip -r ../../dist/backend.zip node_modules/ dist/ package.json -x "node_modules/.cache/*"
cd ../..
echo "  Package size: $(du -sh dist/backend.zip | cut -f1)"
echo ""

# Create Lambda function
echo "[6/7] Deploying to AWS Lambda..."
FUNCTION_NAME="eadd-backend-api"
ROLE_NAME="eadd-lambda-role"

# Create IAM role (if not exists)
aws iam create-role \
  --role-name $ROLE_NAME \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' 2>/dev/null || echo "  Role already exists"

# Attach policies
aws iam attach-role-policy --role-name $ROLE_NAME \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null || true
aws iam attach-role-policy --role-name $ROLE_NAME \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess 2>/dev/null || true
aws iam attach-role-policy --role-name $ROLE_NAME \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess 2>/dev/null || true
aws iam attach-role-policy --role-name $ROLE_NAME \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess 2>/dev/null || true

echo "  Waiting for IAM role to propagate..."
sleep 10

ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT}:role/${ROLE_NAME}"

# Create or update Lambda function
if aws lambda get-function --function-name $FUNCTION_NAME 2>/dev/null; then
  echo "  Updating existing function..."
  aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://dist/backend.zip \
    --no-cli-pager
else
  echo "  Creating new function..."
  aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime nodejs20.x \
    --role $ROLE_ARN \
    --handler dist/lambda.handler \
    --zip-file fileb://dist/backend.zip \
    --timeout 300 \
    --memory-size 1024 \
    --environment Variables="{
      NODE_ENV=production,
      AWS_REGION_CUSTOM=$AWS_REGION,
      BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-20250514,
      BEDROCK_REGION=us-east-1
    }" \
    --no-cli-pager
fi

# Create Function URL (public endpoint)
echo ""
echo "[7/7] Creating public URL..."
aws lambda add-permission \
  --function-name $FUNCTION_NAME \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionURL \
  --principal "*" \
  --function-url-auth-type NONE 2>/dev/null || true

FUNCTION_URL=$(aws lambda create-function-url-config \
  --function-name $FUNCTION_NAME \
  --auth-type NONE \
  --cors '{
    "AllowOrigins": ["*"],
    "AllowMethods": ["*"],
    "AllowHeaders": ["*"],
    "MaxAge": 86400
  }' \
  --query FunctionUrl \
  --output text 2>/dev/null || \
  aws lambda get-function-url-config \
    --function-name $FUNCTION_NAME \
    --query FunctionUrl \
    --output text 2>/dev/null)

echo ""
echo "============================================"
echo "  DEPLOYMENT COMPLETE! "
echo "============================================"
echo ""
echo "  Backend URL: $FUNCTION_URL"
echo ""
echo "  Test it: curl ${FUNCTION_URL}api/health"
echo ""
echo "  Next: Update your Vercel site to point to this URL"
echo "  (Set NEXT_PUBLIC_API_URL environment variable in Vercel)"
echo ""
echo "  IMPORTANT: Enable Bedrock Claude access if not done:"
echo "  https://console.aws.amazon.com/bedrock/home#/modelaccess"
echo "============================================"
