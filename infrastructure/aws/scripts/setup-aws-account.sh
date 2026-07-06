#!/bin/bash
# ============================================================
# EADPA - AWS Account Setup Guide
#
# Run this AFTER creating your AWS account to configure
# everything needed for EADPA deployment.
#
# Usage:
#   chmod +x setup-aws-account.sh
#   ./setup-aws-account.sh
# ============================================================

set -e

echo "============================================"
echo "  EADPA - AWS Account Setup"
echo "============================================"
echo ""
echo "This script will guide you through setting up"
echo "your AWS account for EADPA deployment."
echo ""

# Step 1: Check AWS CLI
echo "Step 1: Checking AWS CLI..."
if ! command -v aws &> /dev/null; then
    echo ""
    echo "AWS CLI is not installed. Please install it first:"
    echo ""
    echo "  macOS:   brew install awscli"
    echo "  Linux:   curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip' && unzip awscliv2.zip && sudo ./aws/install"
    echo "  Windows: Download from https://aws.amazon.com/cli/"
    echo ""
    exit 1
fi
echo "  ✓ AWS CLI installed: $(aws --version | head -1)"
echo ""

# Step 2: Configure credentials
echo "Step 2: Configuring AWS credentials..."
echo ""
echo "You need an IAM user with programmatic access."
echo ""
echo "If you haven't created one yet:"
echo "  1. Go to AWS Console → IAM → Users → Create User"
echo "  2. Name: 'eadpa-deployer'"
echo "  3. Attach policy: 'AdministratorAccess' (for dev; restrict later)"
echo "  4. Create access key → Download credentials"
echo ""

if ! aws sts get-caller-identity &> /dev/null; then
    echo "Running 'aws configure'..."
    echo "Enter your Access Key ID, Secret Access Key, and region (us-east-1 recommended)."
    echo ""
    aws configure
else
    echo "  ✓ AWS credentials already configured"
    echo "  Account: $(aws sts get-caller-identity --query Account --output text)"
    echo "  Region:  $(aws configure get region)"
fi
echo ""

# Step 3: Enable Bedrock Claude access
echo "Step 3: Enable AWS Bedrock (Claude) access..."
echo ""
echo "  ⚠️  MANUAL STEP REQUIRED:"
echo ""
echo "  1. Go to: https://console.aws.amazon.com/bedrock/home#/modelaccess"
echo "  2. Click 'Manage model access'"
echo "  3. Check 'Anthropic' → 'Claude 3.5 Sonnet' (or Claude 4 Sonnet)"
echo "  4. Click 'Save changes'"
echo "  5. Wait for status to show 'Access granted' (usually instant)"
echo ""
echo "  This is required for the AI agent to work."
echo ""
read -p "  Press Enter once you've enabled Bedrock access..."

# Step 4: Install Terraform
echo ""
echo "Step 4: Checking Terraform..."
if ! command -v terraform &> /dev/null; then
    echo ""
    echo "Terraform is not installed. Please install it:"
    echo ""
    echo "  macOS:   brew install terraform"
    echo "  Linux:   sudo apt-get install terraform"
    echo "  Windows: Download from https://terraform.io/downloads"
    echo ""
    echo "  Or use tfenv: https://github.com/tfutils/tfenv"
    exit 1
fi
echo "  ✓ Terraform installed: $(terraform version | head -1)"
echo ""

# Step 5: Install Node.js & pnpm
echo "Step 5: Checking Node.js & pnpm..."
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Install from https://nodejs.org (v20+)"
    exit 1
fi
echo "  ✓ Node.js: $(node --version)"

if ! command -v pnpm &> /dev/null; then
    echo "  Installing pnpm..."
    npm install -g pnpm
fi
echo "  ✓ pnpm: $(pnpm --version)"
echo ""

# Step 6: Create S3 bucket for Terraform state
echo "Step 6: Creating Terraform state bucket..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)
STATE_BUCKET="eadpa-terraform-state-${ACCOUNT_ID}"

if aws s3api head-bucket --bucket "$STATE_BUCKET" 2>/dev/null; then
    echo "  ✓ State bucket already exists: $STATE_BUCKET"
else
    aws s3api create-bucket --bucket "$STATE_BUCKET" --region "$REGION" \
        $([ "$REGION" != "us-east-1" ] && echo "--create-bucket-configuration LocationConstraint=$REGION") \
        2>/dev/null
    aws s3api put-bucket-versioning --bucket "$STATE_BUCKET" \
        --versioning-configuration Status=Enabled
    echo "  ✓ Created state bucket: $STATE_BUCKET"
fi
echo ""

# Done!
echo "============================================"
echo "  SETUP COMPLETE! ✓"
echo "============================================"
echo ""
echo "  Your AWS account is ready for EADPA deployment."
echo ""
echo "  Next steps:"
echo "    1. cd infrastructure/aws/scripts"
echo "    2. ./deploy.sh dev"
echo ""
echo "  This will deploy:"
echo "    • Frontend (Next.js) → S3 + CloudFront"
echo "    • Backend (Express) → Lambda"
echo "    • Database → DynamoDB"
echo "    • AI → Bedrock (Claude)"
echo ""
echo "  Estimated cost: ~\$15-30/month for dev usage"
echo "  (mostly Bedrock token costs)"
echo "============================================"
