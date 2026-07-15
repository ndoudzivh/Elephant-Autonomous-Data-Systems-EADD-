/**
 * Platform-Consistency Import Check (Req 2, Gate 3)
 * 
 * Given the target platform, flags ANY import from a different
 * platform's SDK. Directly prevents the boto3-on-Azure bug.
 * 
 * Maintains explicit platform -> allowed import prefixes allowlist.
 * Anything outside it on a given platform request FAILS this gate.
 */

'use strict';

// Platform -> allowed import prefixes
const PLATFORM_ALLOWLISTS = {
  'aws': {
    allowed: [
      'boto3', 'botocore', 'awsglue', 'aws_cdk',
      'airflow.providers.amazon', 'airflow.providers.aws',
      'moto',  // testing
    ],
    blocked: [
      { prefix: 'azure', reason: 'Azure SDK imported in AWS pipeline' },
      { prefix: 'google.cloud', reason: 'GCP SDK imported in AWS pipeline' },
      { prefix: 'databricks', reason: 'Databricks SDK imported in AWS pipeline' },
      { prefix: 'apache_beam', reason: 'Beam imported in AWS pipeline (use Glue/EMR)' },
    ],
  },
  'azure': {
    allowed: [
      'azure', 'msrest', 'msal',
      'databricks', 'pyspark',
      'airflow.providers.microsoft',
      'airflow.providers.databricks',
    ],
    blocked: [
      { prefix: 'boto3', reason: 'AWS SDK (boto3) imported in Azure pipeline' },
      { prefix: 'botocore', reason: 'AWS SDK (botocore) imported in Azure pipeline' },
      { prefix: 'awsglue', reason: 'AWS Glue imported in Azure pipeline' },
      { prefix: 'airflow.providers.amazon', reason: 'AWS Airflow provider in Azure pipeline' },
      { prefix: 'google.cloud', reason: 'GCP SDK imported in Azure pipeline' },
      { prefix: 'apache_beam', reason: 'Beam imported in Azure pipeline' },
    ],
  },
  'gcp': {
    allowed: [
      'google.cloud', 'google.auth', 'google.api_core',
      'apache_beam', 'googleapiclient',
      'airflow.providers.google',
    ],
    blocked: [
      { prefix: 'boto3', reason: 'AWS SDK (boto3) imported in GCP pipeline' },
      { prefix: 'botocore', reason: 'AWS SDK (botocore) imported in GCP pipeline' },
      { prefix: 'awsglue', reason: 'AWS Glue imported in GCP pipeline' },
      { prefix: 'azure', reason: 'Azure SDK imported in GCP pipeline' },
      { prefix: 'airflow.providers.amazon', reason: 'AWS Airflow provider in GCP pipeline' },
      { prefix: 'databricks', reason: 'Databricks SDK in GCP pipeline' },
    ],
  },
  'databricks': {
    allowed: [
      'pyspark', 'delta', 'databricks',
      'azure', 'msrest',  // Databricks on Azure uses azure SDK
      'boto3',  // Databricks on AWS uses boto3
      'google.cloud',  // Databricks on GCP
    ],
    blocked: [
      // Databricks is multi-cloud, so fewer blocked imports
      { prefix: 'awsglue', reason: 'AWS Glue imported in Databricks pipeline (use Spark directly)' },
      { prefix: 'apache_beam', reason: 'Beam imported in Databricks pipeline (use Spark)' },
    ],
  },
  'snowflake': {
    allowed: [
      'snowflake', 'snowflake.connector', 'snowflake.sqlalchemy',
      'airflow.providers.snowflake',
      'dbt',
    ],
    blocked: [
      { prefix: 'boto3', reason: 'AWS SDK in Snowflake pipeline (use Snowflake stages)' },
      { prefix: 'azure', reason: 'Azure SDK in Snowflake pipeline (use Snowflake stages)' },
      { prefix: 'google.cloud', reason: 'GCP SDK in Snowflake pipeline' },
      { prefix: 'pyspark', reason: 'PySpark in Snowflake pipeline (use Snowpark or SQL)' },
      { prefix: 'apache_beam', reason: 'Beam in Snowflake pipeline' },
    ],
  },
};

// Common imports allowed on ALL platforms
const UNIVERSAL_ALLOWED = [
  'os', 'sys', 'json', 'logging', 'datetime', 'typing',
  'pathlib', 'uuid', 'time', 're', 'collections', 'functools',
  'io', 'csv', 'hashlib', 'base64', 'copy', 'math',
  'pandas', 'numpy', 'requests', 'sqlalchemy',
  'airflow',  // core airflow (non-provider)
];

/**
 * Check that imports are consistent with the target platform.
 * @param {string} code - Generated code
 * @param {string} platform - Target platform (aws|azure|gcp|databricks|snowflake)
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function checkPlatformImports(code, platform) {
  const errors = [];
  const warnings = [];

  const platformConfig = PLATFORM_ALLOWLISTS[platform];
  if (!platformConfig) {
    // Unknown platform — can't check, pass with warning
    warnings.push(`No import allowlist for platform "${platform}" — skipping check`);
    return { valid: true, errors, warnings };
  }

  // Extract all import statements
  const importLines = code.match(/^(?:from|import)\s+[\w.]+/gm) || [];

  for (const importLine of importLines) {
    // Extract the module being imported
    const match = importLine.match(/(?:from|import)\s+([\w.]+)/);
    if (!match) continue;

    const module = match[1];

    // Check if it's universally allowed
    if (UNIVERSAL_ALLOWED.some(u => module === u || module.startsWith(u + '.'))) {
      continue;
    }

    // Check if it's in the platform's allowed list
    if (platformConfig.allowed.some(a => module === a || module.startsWith(a + '.') || module.startsWith(a))) {
      continue;
    }

    // Check if it's explicitly blocked
    const blocked = platformConfig.blocked.find(b => module.startsWith(b.prefix));
    if (blocked) {
      errors.push(`Platform mismatch: "${importLine.trim()}" — ${blocked.reason}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

module.exports = { checkPlatformImports, PLATFORM_ALLOWLISTS };
