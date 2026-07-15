/**
 * Regression Test Suite (Req 4)
 * 
 * Every confirmed bug becomes a permanent test case.
 * Seeded with 4 known bugs from this conversation.
 * 
 * Run: require('./regression-suite').runAll()
 */

'use strict';

const { checkRepetition } = require('./repetition-checker');
const { checkPlatformImports } = require('./platform-import-checker');
const { validatePipelineCode } = require('./index');

// ============================================================
// TEST FIXTURES — One per confirmed bug
// ============================================================

const FIXTURES = [
  {
    id: 'airflow-no-generate-url',
    prompt: 'Postgres to S3 Bronze/Silver/Gold, Airflow',
    platform: 'aws',
    assertions: [
      { type: 'not_contains', value: 'generate_url(', reason: 'S3Hook.generate_url() does not exist — use generate_presigned_url()' },
      { type: 'not_contains', value: '.list_keys(', reason: 'Broken prefix logic with list_keys — use list_objects_v2 or check_for_key' },
    ],
  },
  {
    id: 'databricks-no-boto3',
    prompt: 'Build pipeline on Databricks with Azure Data Lake',
    platform: 'azure',
    assertions: [
      { type: 'not_contains', value: 'import boto3', reason: 'Databricks+Azure must NOT use boto3 — use azure.storage or dbutils' },
      { type: 'not_contains', value: 'from boto3', reason: 'Databricks+Azure must NOT use boto3' },
      { type: 'platform_check', platform: 'azure', reason: 'Must pass platform import consistency for Azure' },
    ],
  },
  {
    id: 'azure-no-boto3',
    prompt: 'Build ADF pipeline from SQL Server to Azure Data Lake',
    platform: 'azure',
    assertions: [
      { type: 'not_contains', value: 'import boto3', reason: 'Azure pipeline must NOT use AWS SDK' },
      { type: 'not_contains', value: 'from botocore', reason: 'Azure pipeline must NOT use AWS SDK' },
      { type: 'platform_check', platform: 'azure', reason: 'Must pass platform import consistency for Azure' },
    ],
  },
  {
    id: 'gcp-no-fake-beam-apis',
    prompt: 'Build pipeline on GCP with Beam from Postgres to BigQuery',
    platform: 'gcp',
    assertions: [
      { type: 'not_contains', value: 'ReadFromPostgres', reason: 'apache_beam.io.ReadFromPostgres does not exist' },
      { type: 'not_contains', value: 'MessageCallback', reason: 'MessageCallback does not exist in apache_beam.io.gcp.pubsub' },
      { type: 'no_repetition', reason: 'Must not contain repeating line/cycle degeneracy' },
      { type: 'max_lines', value: 300, reason: 'Must not exceed 300-line ceiling' },
    ],
  },
];

// ============================================================
// TEST RUNNER
// ============================================================

/**
 * Run a single test fixture against generated code.
 * @param {Object} fixture - Test fixture
 * @param {string} code - Generated code to test
 * @returns {{ passed: boolean, fixture_id: string, failures: string[] }}
 */
function runFixture(fixture, code) {
  const failures = [];

  for (const assertion of fixture.assertions) {
    switch (assertion.type) {
      case 'not_contains':
        if (code.includes(assertion.value)) {
          failures.push(`[${fixture.id}] FAIL: Code contains "${assertion.value}" — ${assertion.reason}`);
        }
        break;

      case 'platform_check': {
        const result = checkPlatformImports(code, assertion.platform);
        if (!result.valid) {
          failures.push(`[${fixture.id}] FAIL: Platform import check failed — ${result.errors.join('; ')}`);
        }
        break;
      }

      case 'no_repetition': {
        const result = checkRepetition(code);
        if (!result.valid) {
          failures.push(`[${fixture.id}] FAIL: Repetition detected — ${result.errors[0]}`);
        }
        break;
      }

      case 'max_lines': {
        const lineCount = code.split('\n').length;
        if (lineCount > assertion.value) {
          failures.push(`[${fixture.id}] FAIL: ${lineCount} lines exceeds ${assertion.value} ceiling — ${assertion.reason}`);
        }
        break;
      }

      default:
        failures.push(`[${fixture.id}] Unknown assertion type: ${assertion.type}`);
    }
  }

  return {
    passed: failures.length === 0,
    fixture_id: fixture.id,
    failures,
  };
}

/**
 * Run ALL fixtures against a code output for a given platform.
 * Only runs fixtures matching the platform.
 * @param {string} code - Generated code
 * @param {string} platform - Target platform
 * @returns {{ passed: boolean, total: number, failures: string[] }}
 */
function runRegressionSuite(code, platform) {
  const relevant = FIXTURES.filter(f => f.platform === platform);
  const allFailures = [];

  for (const fixture of relevant) {
    const result = runFixture(fixture, code);
    if (!result.passed) {
      allFailures.push(...result.failures);
    }
  }

  return {
    passed: allFailures.length === 0,
    total: relevant.length,
    failures: allFailures,
  };
}

/**
 * Run ALL fixtures (all platforms) — for CI/CD.
 */
function runAll(codeByPlatform) {
  const results = [];
  for (const [platform, code] of Object.entries(codeByPlatform || {})) {
    results.push({ platform, ...runRegressionSuite(code, platform) });
  }
  return results;
}

module.exports = { runFixture, runRegressionSuite, runAll, FIXTURES };
