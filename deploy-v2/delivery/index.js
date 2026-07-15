/**
 * Delivery Module (v4) — Barrel Export
 * 
 * Repo scaffolding, CI/CD generation, production checklist.
 * IaC and push/PR handled via separate endpoints.
 */

'use strict';

const { generateScaffold, LAYOUTS } = require('./repo-scaffold');
const { generateGitHubActionsCI } = require('./cicd-generator');
const { assessProductionReadiness } = require('./prod-checklist');

module.exports = {
  generateScaffold,
  generateGitHubActionsCI,
  assessProductionReadiness,
  LAYOUTS,
};
