#!/bin/bash
# ============================================================
# EADD Backend Deploy - Simple, No Monorepo Issues
# Run in AWS CloudShell (us-east-1)
# ============================================================

set -e

echo "============================================"
echo "  EADD - Deploying Backend to AWS Lambda"
echo "============================================"
echo ""

# Check AWS
echo "[1/5] Checking AWS credentials..."
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "us-east-1")
echo "  Account: $AWS_ACCOUNT"
echo "  Region: $AWS_REGION"
echo ""

# Install dependencies
echo "[2/5] Installing dependencies..."
cd deploy
npm install
cd ..
echo ""

# Package
echo "[3/5] Packaging for Lambda..."
cd deploy
zip -r ../lambda-package.zip . -x "node_modules/.cache/*"
cd ..
echo "  Size: $(du -sh lambda-package.zip | cut -f1)"
echo ""

# Create IAM role
echo "[4/5] Setting up IAM role..."
ROLE_NAME="eadd-lambda-role"

aws iam create-role \
  --role-name $ROLE_NAME \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' 2>/dev/null && echo "  Created role" || echo "  Role exists"

aws iam attach-role-policy --role-name $ROLE_NAME \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null || true
aws iam attach-role-policy --role-name $ROLE_NAME \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess 2>/dev/null || true

echo "  Waiting 10 seconds for IAM propagation..."
sleep 10

ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT}:role/${ROLE_NAME}"
echo ""

# Deploy Lambda
echo "[5/5] Deploying Lambda function..."
FUNCTION_NAME="eadd-backend-api"

if aws lambda get-function --function-name $FUNCTION_NAME 2>/dev/null; then
  echo "  Updating existing function..."
  aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://lambda-package.zip \
    --no-cli-pager
else
  echo "  Creating new function..."
  aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime nodejs20.x \
    --role $ROLE_ARN \
    --handler index.handler \
    --zip-file fileb://lambda-package.zip \
    --timeout 300 \
    --memory-size 512 \
    --environment Variables="{NODE_ENV=production,AWS_REGION_CUSTOM=$AWS_REGION}" \
    --no-cli-pager
fi

# Wait for function to be active
echo "  Waiting for function to be ready..."
aws lambda wait function-active --function-name $FUNCTION_NAME 2>/dev/null || sleep 5

# Create public URL
echo "  Creating public URL..."
aws lambda add-permission \
  --function-name $FUNCTION_NAME \
  --statement-id FunctionURLPublic \
  --action lambda:InvokeFunctionURL \
  --principal "*" \
  --function-url-auth-type NONE 2>/dev/null || true

aws lambda create-function-url-config \
  --function-name $FUNCTION_NAME \
  --auth-type NONE \
  --cors '{"AllowOrigins":["*"],"AllowMethods":["*"],"AllowHeaders":["*"]}' 2>/dev/null || true

FUNCTION_URL=$(aws lambda get-function-url-config \
  --function-name $FUNCTION_NAME \
  --query FunctionUrl \
  --output text)

echo ""
echo "============================================"
echo "  DONE! YOUR BACKEND IS LIVE!"
echo "============================================"
echo ""
echo "  URL: $FUNCTION_URL"
echo ""
echo "  Test: curl ${FUNCTION_URL}api/health"
echo ""
echo "  Chat: curl -X POST ${FUNCTION_URL}api/agent/chat \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"message\":\"hello\",\"conversation_id\":\"test\"}'"
echo ""
echo "============================================"
