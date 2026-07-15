/**
 * Skill Self-Correction Loop (Requirement 4)
 * 
 * When validation fails or user reports a bug:
 * 1. Log the failure with context
 * 2. Surface for human review
 * 3. If confirmed: update SKILL.md with correction
 * 4. Track all changes in a changelog
 * 
 * Currently: human-in-the-loop (manual approval).
 * Future: auto-approve for certain error classes.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CORRECTIONS_LOG = [];

/**
 * Record a defect found in a skill file.
 * @param {Object} defect
 * @param {string} defect.stackId - Which skill (airflow-aws, etc.)
 * @param {string} defect.section - Which section of SKILL.md
 * @param {string} defect.errorType - validation_failure | user_report
 * @param {string} defect.description - What went wrong
 * @param {string} defect.currentPattern - The broken pattern
 * @param {string} [defect.suggestedFix] - Proposed correction
 * @returns {Object} Correction record
 */
function reportDefect(defect) {
  const record = {
    id: `defect_${Date.now()}`,
    ...defect,
    status: 'pending_review',
    reportedAt: new Date().toISOString(),
    reviewedAt: null,
    appliedAt: null,
  };

  CORRECTIONS_LOG.push(record);
  console.log('[SKILL DEFECT]', JSON.stringify(record));

  return record;
}

/**
 * Approve a defect correction and apply it to the SKILL.md.
 * @param {string} defectId - ID of the defect to approve
 * @param {string} correctedPattern - The fixed code pattern
 * @returns {Object} Result
 */
function approveCorrection(defectId, correctedPattern) {
  const defect = CORRECTIONS_LOG.find(d => d.id === defectId);
  if (!defect) {
    return { success: false, error: 'Defect not found' };
  }

  if (!correctedPattern) {
    return { success: false, error: 'correctedPattern is required' };
  }

  // Read the SKILL.md
  const skillPath = path.join(__dirname, defect.stackId, 'SKILL.md');
  let skillContent;
  try {
    skillContent = fs.readFileSync(skillPath, 'utf-8');
  } catch {
    return { success: false, error: `Cannot read skill file: ${skillPath}` };
  }

  // Apply the correction
  if (defect.currentPattern && skillContent.includes(defect.currentPattern)) {
    const updatedContent = skillContent.replace(defect.currentPattern, correctedPattern);
    fs.writeFileSync(skillPath, updatedContent, 'utf-8');

    // Update the record
    defect.status = 'applied';
    defect.appliedAt = new Date().toISOString();
    defect.correctedPattern = correctedPattern;

    // Write changelog entry
    const changelogPath = path.join(__dirname, defect.stackId, 'CHANGELOG.md');
    const entry = `\n## ${defect.appliedAt}\n- **Fix**: ${defect.description}\n- **Error type**: ${defect.errorType}\n- **Section**: ${defect.section}\n`;
    try {
      fs.appendFileSync(changelogPath, entry, 'utf-8');
    } catch {
      fs.writeFileSync(changelogPath, `# Changelog\n${entry}`, 'utf-8');
    }

    return { success: true, message: `Correction applied to ${skillPath}`, defect };
  }

  return { success: false, error: 'Could not find the pattern to replace in SKILL.md' };
}

/**
 * Get all pending defects awaiting review.
 */
function getPendingDefects() {
  return CORRECTIONS_LOG.filter(d => d.status === 'pending_review');
}

/**
 * Get full correction history.
 */
function getCorrectionHistory(limit = 50) {
  return CORRECTIONS_LOG.slice(-limit);
}

/**
 * Auto-detect defects from validation failures.
 * Called by the validation gate when code fails checks.
 */
function autoReportFromValidation(validationResult, stackId) {
  if (!validationResult || !validationResult.checks) return;

  for (const check of validationResult.checks) {
    if (check.passed) continue;

    for (const error of check.errors.slice(0, 2)) {
      reportDefect({
        stackId: stackId || 'unknown',
        section: check.check,
        errorType: 'validation_failure',
        description: error,
        currentPattern: null,
        suggestedFix: null,
      });
    }
  }
}

module.exports = {
  reportDefect,
  approveCorrection,
  getPendingDefects,
  getCorrectionHistory,
  autoReportFromValidation,
};
