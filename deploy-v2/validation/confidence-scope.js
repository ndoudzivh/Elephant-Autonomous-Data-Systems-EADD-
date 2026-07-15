/**
 * Confidence-Scoped Responses (Req 5)
 * 
 * Labels output as VERIFIED or UNVERIFIED based on:
 * 1. Whether a skill file was used (template assembly)
 * 2. Whether all validation gates passed
 * 
 * Verified output gets standard presentation.
 * Unverified output gets explicit "best-effort" labeling.
 */

'use strict';

/**
 * Determine confidence level of generated output.
 * @param {Object} context
 * @param {boolean} context.skillUsed - Was a verified SKILL.md used?
 * @param {string|null} context.stackId - Which skill stack (or null)
 * @param {boolean} context.validationPassed - Did all gates pass?
 * @param {number} context.validationAttempts - How many tries needed
 * @returns {Object} Confidence metadata to include in response
 */
function assessConfidence(context) {
  const { skillUsed, stackId, validationPassed, validationAttempts } = context;

  if (skillUsed && validationPassed) {
    return {
      level: 'verified',
      label: '✅ Verified',
      description: `Generated from verified skill file (${stackId}). All validation gates passed.`,
      canClaim: true,  // Can make claims like "idempotent", "incremental"
      showCostEstimate: true,
    };
  }

  if (skillUsed && !validationPassed) {
    return {
      level: 'partially_verified',
      label: '⚠️ Partially Verified',
      description: `Generated from verified skill (${stackId}) but validation found issues. Review before deploying.`,
      canClaim: false,
      showCostEstimate: true,
    };
  }

  if (!skillUsed && validationPassed) {
    return {
      level: 'unverified_passed',
      label: '⚠️ Unverified (passed checks)',
      description: 'Generated from general knowledge (no verified skill file). Passed static validation but not template-verified.',
      canClaim: false,
      showCostEstimate: false,
    };
  }

  // Neither skill nor validation
  return {
    level: 'unverified',
    label: '❌ Unverified / Best-Effort',
    description: 'No verified skill file for this platform. Output is best-effort and has NOT been validated. Review carefully before use.',
    canClaim: false,
    showCostEstimate: false,
  };
}

/**
 * Format response wrapper based on confidence level.
 * @param {Object} pipeline - Generated pipeline output
 * @param {Object} confidence - From assessConfidence()
 * @returns {Object} Wrapped response with confidence metadata
 */
function wrapWithConfidence(pipeline, confidence) {
  return {
    ...pipeline,
    confidence: {
      level: confidence.level,
      label: confidence.label,
      description: confidence.description,
    },
    _meta: {
      can_claim_properties: confidence.canClaim,
      show_cost_estimate: confidence.showCostEstimate,
      disclaimer: confidence.level !== 'verified'
        ? 'This output has not been fully verified against a tested skill file. Do not deploy without manual review.'
        : null,
    },
  };
}

module.exports = { assessConfidence, wrapWithConfidence };
