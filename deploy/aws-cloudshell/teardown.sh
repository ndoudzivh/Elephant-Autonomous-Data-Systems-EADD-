#!/bin/bash
# ============================================================
# 🐘 EADD — Teardown / Destroy All Resources
# ============================================================
#
# ⚠️  WARNING: This PERMANENTLY DELETES all EADD resources.
#     Data in S3 and DynamoDB will be LOST.
#
# USAGE:
#   chmod +x teardown.sh
#   ./teardown.sh        # Interactive (asks for confirmation)
#   ./teardown.sh --yes  # Skip confirmation (DANGEROUS)
#
# ============================================================

set -uo pipefail

REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${EADD_ENV:-dev}"
PREFIX="eadd-${ENVIRONMENT}"
LAMBDA_NAME="eadd-backend-api"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ⚠️  EADD TEARDOWN — This will DELETE everything!           ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Environment: $ENVIRONMENT                                  "
echo "║  Region:      $REGION                                       "
echo "║  Resources to delete:                                        ║"
echo "║    • Lambda: $LAMBDA_NAME                                   "
echo "║    • S3: ${PREFIX}-data-lake, -artifacts, -config, -scripts "
echo "║    • DynamoDB: ${PREFIX}-sessions, -pipelines, -executions  "
echo "║    • API Gateway: ${PREFIX}-api                             "
echo "║    • IAM Role: ${PREFIX}-lambda-role                        "
echo "║    • CloudWatch: ${PREFIX}-dashboard + alarms               "
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Confirmation
if [ "${1:-}" != "--yes" ]; then
  echo -e "${YELLOW}Type 'DELETE EADD' to confirm teardown:${NC}"
  read -r CONFIRM
  if [ "$CONFIRM" != "DELETE EADD" ]; then
    echo "Cancelled."
    exit 0
  fi
fi

echo -e "\n${RED}Proceeding with teardown...${NC}\n"

# ─── Delete API Gateway ────────────────────────────────────
echo "  Deleting API Gateway..."
API_ID=$(aws apigatewayv2 get-apis --region "$REGION" \
  --query "Items[?Name=='${PREFIX}-api'].ApiId" --output text 2>/dev/null || echo "")
if [ -n "$API_ID" ] && [ "$API_ID" != "None" ]; then
  aws apigatewayv2 delete-api --api-id "$API_ID" --region "$REGION" 2>/dev/null || true
  echo -e "  ${GREEN}✓${NC} API Gateway deleted"
fi

# ─── Delete Lambda Function ────────────────────────────────
echo "  Deleting Lambda function..."
aws lambda delete-function --function-name "$LAMBDA_NAME" --region "$REGION" 2>/dev/null || true
echo -e "  ${GREEN}✓${NC} Lambda deleted"

# ─── Delete S3 Buckets (must empty first) ──────────────────
echo "  Deleting S3 buckets..."
for BUCKET in "${PREFIX}-data-lake" "${PREFIX}-artifacts" "${PREFIX}-config" "${PREFIX}-scripts"; do
  if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
    aws s3 rm "s3://$BUCKET" --recursive --region "$REGION" 2>/dev/null || true
    aws s3api delete-bucket --bucket "$BUCKET" --region "$REGION" 2>/dev/null || true
    echo -e "  ${GREEN}✓${NC} Deleted bucket: $BUCKET"
  fi
done

# ─── Delete DynamoDB Tables ────────────────────────────────
echo "  Deleting DynamoDB tables..."
for TABLE in "${PREFIX}-sessions" "${PREFIX}-pipelines" "${PREFIX}-executions" "${PREFIX}-conversations" "${PREFIX}-feedback"; do
  aws dynamodb delete-table --table-name "$TABLE" --region "$REGION" 2>/dev/null || true
  echo -e "  ${GREEN}✓${NC} Deleted table: $TABLE"
done

# ─── Delete IAM Role ───────────────────────────────────────
echo "  Deleting IAM role..."
ROLE_NAME="${PREFIX}-lambda-role"
# Detach policies first
for POLICY_ARN in $(aws iam list-attached-role-policies --role-name "$ROLE_NAME" \
  --query "AttachedPolicies[].PolicyArn" --output text 2>/dev/null); do
  aws iam detach-role-policy --role-name "$ROLE_NAME" --policy-arn "$POLICY_ARN" 2>/dev/null || true
done
aws iam delete-role --role-name "$ROLE_NAME" 2>/dev/null || true
echo -e "  ${GREEN}✓${NC} IAM role deleted"

# ─── Delete CloudWatch Resources ──────────────────────────
echo "  Deleting CloudWatch resources..."
aws cloudwatch delete-dashboards --dashboard-names "${PREFIX}-dashboard" --region "$REGION" 2>/dev/null || true
aws cloudwatch delete-alarms --alarm-names "${PREFIX}-lambda-errors" --region "$REGION" 2>/dev/null || true
echo -e "  ${GREEN}✓${NC} CloudWatch resources deleted"

# ─── Delete Log Groups ─────────────────────────────────────
echo "  Deleting log groups..."
aws logs delete-log-group --log-group-name "/aws/lambda/$LAMBDA_NAME" --region "$REGION" 2>/dev/null || true
echo -e "  ${GREEN}✓${NC} Log groups deleted"

echo -e "\n${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  🐘 EADD TEARDOWN COMPLETE                                  ║"
echo "║  All resources have been deleted.                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
