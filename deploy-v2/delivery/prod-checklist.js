/**
 * Production-Readiness Checklist (v4 Requirement 5)
 * 
 * Honest assessment of whether a pipeline is production-ready.
 * Never claims "ready" based solely on validation gate passing.
 * Mocked success is necessary but NOT sufficient.
 */

'use strict';

/**
 * Assess production readiness against concrete checklist.
 * @param {Object} context
 * @param {boolean} context.validationPassed - All validation gates passed
 * @param {boolean} context.ciConfigured - CI/CD workflow generated and passing
 * @param {boolean} context.iacApplied - Infrastructure applied by human
 * @param {boolean} context.secretsConfigured - Secrets in CI secret store
 * @param {boolean} context.realRunSuccess - At least one real (non-mock) run
 * @param {boolean} context.monitoringConfigured - Alerting on failure
 * @returns {Object} Checklist assessment
 */
function assessProductionReadiness(context = {}) {
  const checklist = [
    {
      id: 'validation_gate',
      label: 'Passes full validation gate (syntax, API-existence, platform-import, mocked execution)',
      passed: !!context.validationPassed,
      automated: true,
    },
    {
      id: 'ci_cd',
      label: 'CI/CD pipeline configured and passing on target repo',
      passed: !!context.ciConfigured,
      automated: true,
    },
    {
      id: 'iac_applied',
      label: 'Infrastructure reviewed and applied by a human with real credentials',
      passed: !!context.iacApplied,
      automated: false,
      note: 'Requires human: run terraform apply after reviewing the plan',
    },
    {
      id: 'secrets',
      label: 'Secrets configured in CI platform secret store',
      passed: !!context.secretsConfigured,
      automated: false,
      note: 'Agent cannot verify this — never sees real credentials',
    },
    {
      id: 'real_run',
      label: 'At least one successful run against real (non-mocked) infrastructure',
      passed: !!context.realRunSuccess,
      automated: false,
      note: 'Mocked execution proves correctness; real run proves connectivity and permissions',
    },
    {
      id: 'monitoring',
      label: 'Monitoring/alerting on pipeline failure configured',
      passed: !!context.monitoringConfigured,
      automated: false,
      note: 'Not a hard blocker, but strongly recommended before production traffic',
    },
  ];

  const passedCount = checklist.filter(c => c.passed).length;
  const totalCount = checklist.length;
  const humanRequired = checklist.filter(c => !c.automated && !c.passed);

  // Determine overall status
  let status;
  let message;

  if (passedCount === totalCount) {
    status = 'production_ready';
    message = 'All checks passed. This pipeline meets production-readiness criteria.';
  } else if (passedCount >= 2 && humanRequired.length > 0) {
    status = 'needs_human_action';
    message = `Automated checks passed (${passedCount - humanRequired.length}/${checklist.filter(c => c.automated).length}). ` +
      `${humanRequired.length} items require human action before production.`;
  } else {
    status = 'not_ready';
    message = `Not production-ready. ${totalCount - passedCount} items outstanding.`;
  }

  return {
    status,
    message,
    checklist,
    score: `${passedCount}/${totalCount}`,
    disclaimer: status !== 'production_ready'
      ? 'Mocked-execution success is necessary but NOT sufficient for production. ' +
        'A real run against live infrastructure, performed and confirmed by a human, is required.'
      : null,
    human_actions_required: humanRequired.map(c => ({
      id: c.id,
      action: c.label,
      note: c.note,
    })),
  };
}

module.exports = { assessProductionReadiness };
