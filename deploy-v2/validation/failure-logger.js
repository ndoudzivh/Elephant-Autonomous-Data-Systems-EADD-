/**
 * Validation Failure Logger
 * Logs failures for Req 4 (self-correction loop).
 * In production: DynamoDB. Here: in-memory + console.
 */

'use strict';

const failures = [];

function logValidationFailure(entry) {
  console.error('[VALIDATION FAILURE]', JSON.stringify({
    pipeline: entry.pipelineName,
    engine: entry.engine,
    failures: entry.failures.map(f => ({
      check: f.check,
      errors: f.errors.slice(0, 3),
    })),
    timestamp: entry.timestamp,
  }));
  failures.push(entry);
  if (failures.length > 100) failures.shift();
}

function getFailures(limit = 50) {
  return failures.slice(-limit);
}

module.exports = { logValidationFailure, getFailures };
