/**
 * Repo Scaffolding (v4 Requirement 1)
 * 
 * Generates a full repo layout appropriate to the target platform.
 * Not ad-hoc — each platform has a defined structure.
 * 
 * Files are generated in-memory (not pushed until user confirms).
 */

'use strict';

// ============================================================
// PLATFORM REPO LAYOUTS
// ============================================================

const LAYOUTS = {
  aws: {
    description: 'Airflow + AWS (S3/Glue)',
    structure: (name) => [
      { path: `dags/${name}.py`, type: 'dag', description: 'Airflow DAG definition' },
      { path: `scripts/silver/${name}.py`, type: 'glue_script', description: 'Glue Silver transformation' },
      { path: `scripts/gold/${name}.py`, type: 'glue_script', description: 'Glue Gold aggregation' },
      { path: `infra/main.tf`, type: 'terraform', description: 'AWS resources (S3, Glue, IAM)' },
      { path: `infra/variables.tf`, type: 'terraform', description: 'Terraform variables' },
      { path: `tests/test_validation.py`, type: 'test', description: 'Validation gate tests' },
      { path: `tests/test_dag.py`, type: 'test', description: 'DAG import + structure tests' },
      { path: `.github/workflows/ci.yml`, type: 'ci', description: 'GitHub Actions CI pipeline' },
      { path: `README.md`, type: 'docs', description: 'Setup, secrets, how to run' },
      { path: `requirements.txt`, type: 'config', description: 'Python dependencies' },
      { path: `.env.example`, type: 'config', description: 'Required environment variables' },
    ],
  },
  databricks: {
    description: 'Databricks + Azure Data Lake (Delta)',
    structure: (name) => [
      { path: `notebooks/${name}_bronze.py`, type: 'notebook', description: 'Bronze extraction notebook' },
      { path: `notebooks/${name}_silver.py`, type: 'notebook', description: 'Silver dedup + merge notebook' },
      { path: `notebooks/${name}_gold.py`, type: 'notebook', description: 'Gold aggregation notebook' },
      { path: `jobs/${name}.json`, type: 'job_config', description: 'Databricks job definition' },
      { path: `infra/main.tf`, type: 'terraform', description: 'Azure resources (ADLS, Databricks)' },
      { path: `tests/test_validation.py`, type: 'test', description: 'Validation gate tests' },
      { path: `.github/workflows/ci.yml`, type: 'ci', description: 'GitHub Actions CI pipeline' },
      { path: `README.md`, type: 'docs', description: 'Setup, secrets, how to deploy' },
    ],
  },
  gcp: {
    description: 'Apache Beam + GCP (Dataflow/BigQuery)',
    structure: (name) => [
      { path: `pipelines/${name}_beam.py`, type: 'pipeline', description: 'Beam pipeline (Bronze/Silver/Gold)' },
      { path: `infra/main.tf`, type: 'terraform', description: 'GCP resources (GCS, BigQuery, Dataflow)' },
      { path: `tests/test_validation.py`, type: 'test', description: 'Validation gate tests' },
      { path: `.github/workflows/ci.yml`, type: 'ci', description: 'GitHub Actions CI pipeline' },
      { path: `Dockerfile`, type: 'config', description: 'Beam worker container' },
      { path: `requirements.txt`, type: 'config', description: 'Python dependencies' },
      { path: `README.md`, type: 'docs', description: 'Setup, GCP project config, how to run' },
    ],
  },
  dbt: {
    description: 'dbt + Snowflake/BigQuery',
    structure: (name) => [
      { path: `models/bronze/src_${name}.yml`, type: 'dbt_source', description: 'Source definition' },
      { path: `models/silver/stg_${name}.sql`, type: 'dbt_model', description: 'Staging (Silver) model' },
      { path: `models/gold/fct_${name}.sql`, type: 'dbt_model', description: 'Fact (Gold) model' },
      { path: `models/silver/stg_${name}.yml`, type: 'dbt_schema', description: 'Silver schema tests' },
      { path: `dbt_project.yml`, type: 'config', description: 'dbt project configuration' },
      { path: `profiles.yml`, type: 'config', description: 'Connection profiles (templated)' },
      { path: `.github/workflows/ci.yml`, type: 'ci', description: 'GitHub Actions: dbt test + run' },
      { path: `README.md`, type: 'docs', description: 'Setup, profile config, how to run' },
    ],
  },
  snowflake: {
    description: 'Snowflake (Streams + Tasks)',
    structure: (name) => [
      { path: `sql/01_create_objects.sql`, type: 'sql', description: 'Tables, streams, stages' },
      { path: `sql/02_create_tasks.sql`, type: 'sql', description: 'Scheduled tasks' },
      { path: `sql/03_create_pipe.sql`, type: 'sql', description: 'Snowpipe (if streaming)' },
      { path: `infra/main.tf`, type: 'terraform', description: 'Snowflake resources' },
      { path: `tests/test_validation.py`, type: 'test', description: 'Validation gate tests' },
      { path: `.github/workflows/ci.yml`, type: 'ci', description: 'GitHub Actions CI' },
      { path: `README.md`, type: 'docs', description: 'Setup, SnowSQL, how to deploy' },
    ],
  },
  on_prem: {
    description: 'On-Premises (Docker Compose + MinIO)',
    structure: (name) => [
      { path: `dags/${name}.py`, type: 'dag', description: 'Airflow DAG' },
      { path: `scripts/${name}.py`, type: 'script', description: 'Pipeline script' },
      { path: `docker-compose.yml`, type: 'config', description: 'Airflow + MinIO + Postgres' },
      { path: `tests/test_validation.py`, type: 'test', description: 'Validation gate tests' },
      { path: `README.md`, type: 'docs', description: 'Setup, docker-compose up, how to run' },
    ],
  },
};

/**
 * Generate repo scaffold for a compiled pipeline.
 * @param {Object} compilationResult - From compilers/index.js
 * @param {Object} ir - Pipeline IR
 * @returns {Object} Scaffold with file list + content
 */
function generateScaffold(compilationResult, ir) {
  const platform = ir.target_platform;
  const layout = LAYOUTS[platform] || LAYOUTS['aws'];
  const name = ir.name;

  const files = layout.structure(name).map(file => ({
    ...file,
    content: null, // To be filled by content generators
  }));

  // Fill main pipeline file with compiled code
  if (compilationResult.output && compilationResult.output.code) {
    const mainFile = files.find(f =>
      f.type === 'dag' || f.type === 'notebook' || f.type === 'pipeline' || f.type === 'dbt_model'
    );
    if (mainFile) {
      mainFile.content = compilationResult.output.code;
    }
  }

  // Generate README
  const readmeFile = files.find(f => f.path === 'README.md');
  if (readmeFile) {
    readmeFile.content = generateREADME(ir, platform, files);
  }

  return {
    platform,
    platform_description: layout.description,
    pipeline_name: name,
    files,
    total_files: files.length,
    ready_to_push: false, // Needs user confirmation
  };
}

function generateREADME(ir, platform, files) {
  return `# ${ir.name}

> Generated by EADD — Elephant Autonomous Data Systems

## Pipeline

- **Source**: ${ir.source.type} → \`${ir.source.table}\`
- **Platform**: ${platform}
- **Schedule**: ${ir.schedule?.frequency || 'daily'}
- **Incremental**: ${ir.properties.incremental ? 'Yes' : 'No'}
- **Idempotent**: ${ir.properties.idempotent ? 'Yes' : 'No'}

## Files

${files.map(f => `- \`${f.path}\` — ${f.description}`).join('\n')}

## Setup

### Prerequisites
- Python 3.9+
- Terraform 1.5+ (for infrastructure)
- Platform-specific CLI configured

### Required Secrets
Configure these in your CI/CD platform's secret store:
- \`SOURCE_DB_HOST\` — Source database host
- \`SOURCE_DB_USER\` — Source database user
- \`SOURCE_DB_PASSWORD\` — Source database password
- Platform-specific credentials (see infra/variables.tf)

### Run Tests Locally
\`\`\`bash
pip install -r requirements.txt
pytest tests/ -v
\`\`\`

### Deploy Infrastructure
\`\`\`bash
cd infra/
terraform init
terraform plan  # Review before applying!
# terraform apply  # Only after human review
\`\`\`

## CI/CD

On every push/PR:
1. Lint (ruff/flake8)
2. Syntax validation
3. Platform-import check
4. Mocked execution tests
5. (Protected branches) Terraform plan

## Generated By
- EADD v2.0
- IR checksum: ${Date.now().toString(36)}
- Generated: ${new Date().toISOString()}
`;
}

module.exports = { generateScaffold, LAYOUTS };
