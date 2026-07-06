#!/bin/bash
# ============================================================
# EADPA AWS Teardown Script
# 
# Destroys all AWS resources to stop billing.
#
# Usage:
#   ./teardown.sh [dev|staging|production]
# ============================================================

set -e

ENVIRONMENT="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../terraform"

echo "============================================"
echo "  EADPA AWS TEARDOWN"
echo "  Environment: $ENVIRONMENT"
echo "============================================"
echo ""
echo "⚠️  WARNING: This will DESTROY all EADPA resources!"
echo "  All data in DynamoDB and S3 will be DELETED."
echo ""
read -p "  Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Destroying infrastructure..."
cd "$INFRA_DIR"
terraform destroy -var="environment=$ENVIRONMENT" -auto-approve

echo ""
echo "============================================"
echo "  TEARDOWN COMPLETE"
echo "  All resources destroyed. No more charges."
echo "============================================"
