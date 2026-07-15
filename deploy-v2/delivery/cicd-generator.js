/**
 * CI/CD Pipeline Generation (v4 Requirement 2)
 * 
 * Generates GitHub Actions workflow that re-runs the validation gate
 * on every commit. Uses the SAME checks as pre-return validation —
 * one source of truth.
 * 
 * Stages: lint → syntax → platform-import → mocked-execution → IaC plan
 */

'use strict';

/**
 * Generate GitHub Actions CI workflow.
 * @param {Object} ir - Pipeline IR
 * @param {string} platform - Target platform
 * @returns {string} YAML workflow content
 */
function generateGitHubActionsCI(ir, platform) {
  return `name: Pipeline Validation CI

on:
  push:
    branches: [main, develop, 'feature/**']
  pull_request:
    branches: [main, develop]

env:
  PYTHON_VERSION: '3.11'
  PIPELINE_NAME: '${ir.name}'
  TARGET_PLATFORM: '${platform}'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: \${{ env.PYTHON_VERSION }}
          cache: 'pip'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install ruff pytest moto

      # ─── Stage 1: Lint ────────────────────────────────────
      - name: Lint (ruff)
        run: ruff check . --output-format=github

      # ─── Stage 2: Syntax Validation ───────────────────────
      - name: Syntax Check
        run: |
          python -m py_compile ${getMainFile(ir, platform)}
          echo "✅ Syntax valid"

      # ─── Stage 3: Platform Import Check ───────────────────
      - name: Platform Import Consistency
        run: |
          python -c "
          import ast, sys
          BLOCKED = ${getBlockedImports(platform)}
          with open('${getMainFile(ir, platform)}') as f:
              tree = ast.parse(f.read())
          for node in ast.walk(tree):
              if isinstance(node, ast.Import):
                  for alias in node.names:
                      for prefix in BLOCKED:
                          if alias.name.startswith(prefix):
                              print(f'❌ Blocked import: {alias.name}')
                              sys.exit(1)
              elif isinstance(node, ast.ImportFrom) and node.module:
                  for prefix in BLOCKED:
                      if node.module.startswith(prefix):
                          print(f'❌ Blocked import: {node.module}')
                          sys.exit(1)
          print('✅ Platform imports consistent')
          "

      # ─── Stage 4: Mocked Execution Tests ─────────────────
      - name: Run Validation Tests
        run: pytest tests/ -v --tb=short
        env:
          AWS_DEFAULT_REGION: us-east-1
          AWS_ACCESS_KEY_ID: testing
          AWS_SECRET_ACCESS_KEY: testing

${platform === 'aws' || platform === 'gcp' || platform === 'azure' || platform === 'databricks' ? `
  # ─── Stage 5: Infrastructure Plan (protected branches) ──
  infra-plan:
    runs-on: ubuntu-latest
    needs: validate
    if: github.ref == 'refs/heads/main' || github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.7.0

      - name: Terraform Init
        run: cd infra && terraform init
        env:
          # Secrets from GitHub Actions secret store (never hardcoded)
          AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}

      - name: Terraform Plan
        run: cd infra && terraform plan -no-color
        env:
          AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
` : ''}`;
}

function getMainFile(ir, platform) {
  switch (platform) {
    case 'aws': return `dags/${ir.name}.py`;
    case 'databricks': return `notebooks/${ir.name}_bronze.py`;
    case 'gcp': return `pipelines/${ir.name}_beam.py`;
    case 'dbt': return `models/silver/stg_${ir.name}.sql`;
    default: return `dags/${ir.name}.py`;
  }
}

function getBlockedImports(platform) {
  const blocked = {
    aws: "['azure', 'google.cloud', 'databricks']",
    azure: "['boto3', 'botocore', 'awsglue', 'google.cloud']",
    gcp: "['boto3', 'botocore', 'azure', 'awsglue']",
    databricks: "['awsglue', 'apache_beam']",
    snowflake: "['boto3', 'azure', 'google.cloud', 'pyspark']",
  };
  return blocked[platform] || "[]";
}

module.exports = { generateGitHubActionsCI };
