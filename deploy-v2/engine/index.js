/**
 * EADD Engine — Barrel Export
 * 
 * The complete capability stack:
 * 1. Code Generation (structured JSON output)
 * 2. Code Validation (syntax + security + best practices)
 * 3. Auto-Fix Loop (self-healing)
 * 4. Schema Intelligence (type alignment)
 * 5. Tool Calling (S3, Glue, dbt, Secrets)
 * 6. Pipeline Testing (pre-execution validation)
 * 7. Security Gate (block destructive ops)
 * 8. Memory Store (learn from past)
 * 9. Orchestrator (multi-agent pipeline)
 */

'use strict';

const { generatePipeline } = require('./code-generator');
const { validateCode } = require('./code-validator');
const { autoFixLoop } = require('./auto-fix');
const { validateSchemaCompatibility, detectSchemaDrift, inferTransformations } = require('./schema-intelligence');
const { executeTool } = require('./tool-calling');
const { testPipeline } = require('./pipeline-tester');
const { securityGate, getAuditLog } = require('./security-gate');
const { storeContext, storePipelineResult, storeError, retrieveSimilarPipeline, getMemoryStats } = require('./memory-store');
const { orchestrate } = require('./orchestrator');

module.exports = {
  // Core pipeline
  orchestrate,
  generatePipeline,
  validateCode,
  autoFixLoop,
  testPipeline,
  securityGate,

  // Schema
  validateSchemaCompatibility,
  detectSchemaDrift,
  inferTransformations,

  // Tools
  executeTool,

  // Memory
  storeContext,
  storePipelineResult,
  storeError,
  retrieveSimilarPipeline,
  getMemoryStats,
  getAuditLog,
};
