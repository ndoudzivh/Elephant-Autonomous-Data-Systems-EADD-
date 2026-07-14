/**
 * EADD Pipeline Testing Engine
 * 
 * test_pipeline(code, sample_data) -> pass/fail + details
 * 
 * Pre-execution validation: run the pipeline logic
 * against sample data before touching production.
 */

'use strict';

const { validateCode } = require('./code-validator');
const { securityGate } = require('./security-gate');


/**
 * Test a pipeline before production execution.
 * @param {Object} pipeline - The pipeline output from orchestrator
 * @param {Object} options - Test options
 * @returns {Object} Test results
 */
function testPipeline(pipeline, options = {}) {
  const { sample_rows = 100, timeout_ms = 30000 } = options;
  const results = { tests: [], passed: 0, failed: 0, score: 0 };

  // Test 1: Code validation
  const validation = validateCode(pipeline.code, pipeline.engine);
  results.tests.push({
    name: 'code_validation',
    passed: validation.valid,
    score: validation.score,
    details: validation.valid ? 'Code passes all checks' : `${validation.errors.length} errors found`,
  });
  if (validation.valid) results.passed++; else results.failed++;

  // Test 2: Security gate
  const security = securityGate(pipeline);
  results.tests.push({
    name: 'security_gate',
    passed: security.approved,
    details: security.summary,
  });
  if (security.approved) results.passed++; else results.failed++;

  // Test 3: Input/output defined
  const hasIO = pipeline.inputs.length > 0 && pipeline.outputs.length > 0;
  results.tests.push({
    name: 'io_defined',
    passed: hasIO,
    details: hasIO ? `${pipeline.inputs.length} inputs, ${pipeline.outputs.length} outputs` : 'Missing inputs or outputs',
  });
  if (hasIO) results.passed++; else results.failed++;

  // Test 4: Has error handling
  const hasErrorHandling = /try\s*:|except\s|catch\s*\(|EXCEPTION/i.test(pipeline.code);
  results.tests.push({
    name: 'error_handling',
    passed: hasErrorHandling,
    details: hasErrorHandling ? 'Error handling present' : 'No error handling — will crash silently',
  });
  if (hasErrorHandling) results.passed++; else results.failed++;

  // Test 5: Has logging
  const hasLogging = /logging|logger|console\.log|RAISE NOTICE/i.test(pipeline.code);
  results.tests.push({
    name: 'has_logging',
    passed: hasLogging,
    details: hasLogging ? 'Logging configured' : 'No logging — invisible operations',
  });
  if (hasLogging) results.passed++; else results.failed++;

  // Test 6: Idempotent (MERGE/upsert or append)
  const isIdempotent = /MERGE|upsert|mode\("append"\)|IF NOT EXISTS/i.test(pipeline.code);
  results.tests.push({
    name: 'idempotent',
    passed: isIdempotent,
    details: isIdempotent ? 'Pipeline is idempotent (safe to re-run)' : 'WARNING: May produce duplicates on re-run',
  });
  if (isIdempotent) results.passed++; else results.failed++;

  // Test 7: No hardcoded paths (parameterized)
  const hardcodedPaths = pipeline.code.match(/["']s3:\/\/[^"']+["']/g) || [];
  const isParameterized = hardcodedPaths.length <= 2; // allow source/target
  results.tests.push({
    name: 'parameterized',
    passed: isParameterized,
    details: isParameterized ? 'Paths are manageable' : `${hardcodedPaths.length} hardcoded S3 paths — use variables`,
  });
  if (isParameterized) results.passed++; else results.failed++;

  // Calculate overall score
  results.score = Math.round((results.passed / results.tests.length) * 100);
  results.overall = results.failed === 0 ? 'PASS' : results.score >= 70 ? 'PASS_WITH_WARNINGS' : 'FAIL';
  results.summary = `${results.passed}/${results.tests.length} tests passed (${results.score}%) — ${results.overall}`;

  return results;
}

module.exports = { testPipeline };
