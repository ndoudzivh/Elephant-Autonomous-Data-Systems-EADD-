/**
 * EADD Pre-Return Validation Gate (Requirement 2)
 * 
 * Every generated pipeline passes through this BEFORE reaching the user.
 * If validation fails, attempts one self-correction pass.
 * If it fails twice, tells the user what couldn't be verified.
 * 
 * Checks:
 * 1. Python syntax validity (py_compile equivalent)
 * 2. boto3/SDK method verification (real methods only)
 * 3. Airflow DAG structure validation
 * 4. CLI command verification
 * 5. Import existence check
 * 
 * Logs all failures for Req 4 (self-correction loop).
 */

'use strict';

const { validateSyntax } = require('./syntax-checker');
const { validateBoto3Methods } = require('./sdk-verifier');
const { validateAirflowDAG } = require('./airflow-validator');
const { validateImports } = require('./import-checker');
const { logValidationFailure } = require('./failure-logger');
const { checkRepetition } = require('./repetition-checker');
const { checkPlatformImports } = require('./platform-import-checker');

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} passed - Overall pass/fail
 * @property {Array<{check: string, passed: boolean, errors: string[]}>} checks
 * @property {string|null} correctedCode - Auto-fixed code (if fix attempted)
 * @property {number} attempts - How many validation passes ran
 */

/**
 * Main validation gate. Runs all checks on generated code.
 * If fails, attempts one self-correction pass.
 * 
 * @param {string} code - Generated pipeline code
 * @param {Object} options
 * @param {string} options.engine - 'airflow'|'pyspark'|'glue'|'dbt'|'python'
 * @param {string} options.targetCloud - 'aws'|'azure'|'gcp'|'snowflake'
 * @param {string} options.pipelineName - Name for logging
 * @returns {ValidationResult}
 */
function validatePipelineCode(code, options = {}) {
  const { engine = 'python', targetCloud = 'aws', pipelineName = 'unknown' } = options;
  let attempts = 0;
  let currentCode = code;

  // First pass
  attempts++;
  let result = runAllChecks(currentCode, engine, targetCloud);

  if (result.passed) {
    return { passed: true, checks: result.checks, correctedCode: null, attempts };
  }

  // Self-correction pass (one retry)
  attempts++;
  const corrections = attemptSelfCorrection(currentCode, result.checks);
  if (corrections.modified) {
    currentCode = corrections.code;
    result = runAllChecks(currentCode, engine, targetCloud);

    if (result.passed) {
      return { passed: true, checks: result.checks, correctedCode: currentCode, attempts };
    }
  }

  // Failed twice — log and return failure details
  logValidationFailure({
    pipelineName,
    engine,
    targetCloud,
    code: currentCode,
    failures: result.checks.filter(c => !c.passed),
    timestamp: new Date().toISOString(),
  });

  return {
    passed: false,
    checks: result.checks,
    correctedCode: corrections.modified ? currentCode : null,
    attempts,
    failureMessage: buildFailureMessage(result.checks),
  };
}

/**
 * Run all validation checks on the code.
 * Order: repetition (cheapest) → syntax → platform imports → SDK methods → Airflow
 */
function runAllChecks(code, engine, targetCloud) {
  const checks = [];

  // Gate 1: Repetition/degeneracy (CHEAPEST — run first)
  const repetition = checkRepetition(code);
  checks.push({ check: 'repetition', passed: repetition.valid, errors: repetition.errors });
  if (!repetition.valid) {
    // Don't bother with other checks if output is degenerate
    return { passed: false, checks };
  }

  // Gate 2: Syntax check
  const syntax = validateSyntax(code);
  checks.push({ check: 'syntax', passed: syntax.valid, errors: syntax.errors });

  // Gate 3: Platform-consistency import check
  const platformImports = checkPlatformImports(code, targetCloud);
  checks.push({ check: 'platform_imports', passed: platformImports.valid, errors: platformImports.errors });

  // Gate 4: Import verification (deprecated paths)
  const imports = validateImports(code, engine);
  checks.push({ check: 'imports', passed: imports.valid, errors: imports.errors });

  // Gate 5: boto3/SDK method verification (AWS only)
  if (targetCloud === 'aws') {
    const sdk = validateBoto3Methods(code);
    checks.push({ check: 'sdk_methods', passed: sdk.valid, errors: sdk.errors });
  }

  // Gate 6: Airflow DAG validation (if Airflow engine)
  if (engine === 'airflow') {
    const dag = validateAirflowDAG(code);
    checks.push({ check: 'airflow_dag', passed: dag.valid, errors: dag.errors });
  }

  const passed = checks.every(c => c.passed);
  return { passed, checks };
}

/**
 * Attempt to auto-correct based on validation errors.
 */
function attemptSelfCorrection(code, checks) {
  let modified = false;
  let fixedCode = code;

  for (const check of checks) {
    if (check.passed) continue;

    for (const error of check.errors) {
      const fix = applyFix(fixedCode, error, check.check);
      if (fix !== fixedCode) {
        fixedCode = fix;
        modified = true;
      }
    }
  }

  return { modified, code: fixedCode };
}

/**
 * Apply a specific fix based on error type.
 */
function applyFix(code, error, checkType) {
  // Fix wrong boto3 methods
  if (checkType === 'sdk_methods') {
    if (error.includes('upload_file_obj')) {
      return code.replace(/upload_file_obj/g, 'upload_fileobj');
    }
    if (error.includes('put_item_batch')) {
      return code.replace(/put_item_batch/g, 'batch_write_item');
    }
    if (error.includes('get_table_metadata')) {
      return code.replace(/get_table_metadata/g, 'get_table');
    }
  }

  // Fix wrong imports
  if (checkType === 'imports') {
    if (error.includes('from airflow.operators.python_operator')) {
      return code.replace(
        'from airflow.operators.python_operator import PythonOperator',
        'from airflow.operators.python import PythonOperator'
      );
    }
    if (error.includes('from airflow.operators.bash_operator')) {
      return code.replace(
        'from airflow.operators.bash_operator import BashOperator',
        'from airflow.operators.bash import BashOperator'
      );
    }
  }

  // Fix syntax issues
  if (checkType === 'syntax') {
    if (error.includes('missing colon')) {
      // Try to add missing colons after if/for/def/class
      return code.replace(/(if|for|while|def|class)\s+([^:]+)$/gm, '$1 $2:');
    }
  }

  return code;
}

/**
 * Build a user-friendly failure message.
 */
function buildFailureMessage(checks) {
  const failures = checks.filter(c => !c.passed);
  if (failures.length === 0) return null;

  const parts = failures.map(f => {
    const errorList = f.errors.slice(0, 3).join('; ');
    return `**${f.check}**: ${errorList}`;
  });

  return `The generated code could not be fully verified:\n${parts.join('\n')}\n\nPlease review these sections before deploying.`;
}

module.exports = { validatePipelineCode, runAllChecks };
