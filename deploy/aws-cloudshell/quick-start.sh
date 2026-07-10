#!/bin/bash
# ============================================================
# 🐘 EADD Quick Start — One-Command Deployment
# ============================================================
#
# Paste this SINGLE LINE into AWS CloudShell to deploy EADD:
#
#   curl -sL https://raw.githubusercontent.com/ndoudzivh/Elephant-Autonomous-Data-Systems-EADD-/eadpa-phase0-foundation/deploy/aws-cloudshell/quick-start.sh | bash
#
# Or clone and run:
#   git clone --depth 1 -b eadpa-phase0-foundation https://github.com/ndoudzivh/Elephant-Autonomous-Data-Systems-EADD-.git
#   cd Elephant-Autonomous-Data-Systems-EADD-/deploy/aws-cloudshell
#   chmod +x deploy-eadd.sh && ./deploy-eadd.sh
#
# ============================================================

set -euo pipefail

echo "🐘 EADD Quick Start — Downloading deployment script..."

# Create temp directory
DEPLOY_DIR="/tmp/eadd-quickstart-$(date +%s)"
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# Clone repository (shallow)
git clone --depth 1 --branch eadpa-phase0-foundation \
  https://github.com/ndoudzivh/Elephant-Autonomous-Data-Systems-EADD-.git 2>/dev/null

cd Elephant-Autonomous-Data-Systems-EADD-/deploy/aws-cloudshell

# Make executable and run
chmod +x deploy-eadd.sh
exec ./deploy-eadd.sh
