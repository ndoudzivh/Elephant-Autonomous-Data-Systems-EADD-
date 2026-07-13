/**
 * EADD Multi-Agent Orchestrator
 * 
 * Routes through the agent chain:
 * Planner → Builder → Validator → Fixer → Executor
 * 
 * Every pipeline request passes through ALL stages.
 * This is what makes EADD production-grade.
 */

'use strict';

const { generatePipeline } = require('./code-generator');
const { validateCode } = require('./code-validator');
const { autoFixLoop } = require('./auto-fix');


const { securityGate } = require('./security-gate');
const { validateSchemaCompatibility, inferTransformations } = require('./schema-intelligence');
const { storeContext, storePipelineResult, storeError, retrieveSimilarPipeline } = require('./memory-store');

// ============================================================
// ORCHESTRATION PIPELINE
// ============================================================

/**
 * Full pipeline execution: plan → build → validate → fix → secure → output
 * 
 * @param {Object} request - User's pipeline request
 * @returns {Object} - Complete orchestration result
 */
async function orchestrate(request) {
  const startTime = Date.now();
  const stages = [];

  try {
    // ─── STAGE 1: PLANNER ─────────────────────────────────
    const plan = planPipeline(request);
    stages.push({ agent: 'planner', status: 'done', result: plan });

    // ─── STAGE 2: BUILDER ─────────────────────────────────
    const pipeline = generatePipeline(plan.build_params);
    stages.push({ agent: 'builder', status: 'done', result: { pipeline_name: pipeline.pipeline_name, engine: pipeline.engine } });

    // ─── STAGE 3: VALIDATOR ───────────────────────────────
    const validation = validateCode(pipeline.code, pipeline.engine);
    stages.push({ agent: 'validator', status: 'done', result: { valid: validation.valid, score: validation.score, errors: validation.errors.length } });

    // ─── STAGE 4: FIXER (if needed) ──────────────────────
    let finalCode = pipeline.code;
    let fixResult = null;

    if (!validation.valid) {
      fixResult = autoFixLoop(pipeline.code, pipeline.engine);
      finalCode = fixResult.code;
      stages.push({ agent: 'fixer', status: 'done', result: { fixed: fixResult.valid, attempts: fixResult.attempts, fixes: fixResult.fixes_applied.length } });
    } else {
      stages.push({ agent: 'fixer', status: 'skipped', result: { reason: 'Code passed validation' } });
    }

    // ─── STAGE 5: SECURITY GATE ──────────────────────────
    const secResult = securityGate({ ...pipeline, code: finalCode }, request.user_id);
    stages.push({ agent: 'security', status: 'done', result: { approved: secResult.approved, violations: secResult.violations.length } });

    if (!secResult.approved) {
      storeError(pipeline.pipeline_name, { message: `Security gate blocked: ${secResult.violations.map(v => v.rule).join(', ')}` });
      return {
        success: false,
        pipeline: { ...pipeline, code: finalCode, validated: false },
        stages,
        error: `Security gate BLOCKED: ${secResult.summary}`,
        duration_ms: Date.now() - startTime,
      };
    }

    // ─── STAGE 6: OUTPUT ─────────────────────────────────
    const finalPipeline = {
      ...pipeline,
      code: finalCode,
      validated: fixResult ? fixResult.valid : validation.valid,
    };

    // Store in memory
    storeContext({ request: request.description, pipeline_name: pipeline.pipeline_name });
    storePipelineResult(finalPipeline, { success: true });

    stages.push({ agent: 'executor', status: 'ready', result: { pipeline_name: finalPipeline.pipeline_name, validated: finalPipeline.validated } });

    return {
      success: true,
      pipeline: finalPipeline,
      stages,
      security: secResult,
      validation_score: validation.score,
      duration_ms: Date.now() - startTime,
    };

  } catch (err) {
    storeError(request.pipeline_name || 'unknown', err);
    return {
      success: false,
      pipeline: null,
      stages,
      error: err.message,
      duration_ms: Date.now() - startTime,
    };
  }
}


// ============================================================
// PLANNER — Interprets request into build parameters
// ============================================================

function planPipeline(request) {
  const {
    description = '',
    source_type,
    source_path,
    target_path,
    target_cloud = 'aws',
    engine,
    schema,
    frequency = 'daily',
  } = request;

  const lower = description.toLowerCase();

  // Auto-detect engine from context
  let detectedEngine = engine;
  if (!detectedEngine) {
    if (lower.includes('stream') || lower.includes('kafka') || lower.includes('real-time')) {
      detectedEngine = 'pyspark';
    } else if (lower.includes('dbt') || lower.includes('model')) {
      detectedEngine = 'dbt';
    } else if (lower.includes('sql') || lower.includes('query')) {
      detectedEngine = 'sql';
    } else if (lower.includes('api') || lower.includes('extract') || lower.includes('http')) {
      detectedEngine = 'python';
    } else if (lower.includes('glue')) {
      detectedEngine = 'glue';
    } else {
      detectedEngine = 'pyspark';
    }
  }

  // Auto-detect type
  let type = 'batch';
  if (lower.includes('stream') || lower.includes('real-time') || lower.includes('kafka')) {
    type = 'streaming';
  }

  // Build pipeline name from description
  const pipeline_name = request.pipeline_name || description
    .replace(/[^a-z0-9\s]/gi, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join('_')
    .toLowerCase() || 'auto_pipeline';

  // Check for similar past pipelines
  const similar = retrieveSimilarPipeline(request);

  return {
    pipeline_name,
    engine: detectedEngine,
    type,
    build_params: {
      pipeline_name,
      engine: detectedEngine,
      type,
      source_path: source_path || `s3://data-lake/bronze/${pipeline_name}/`,
      target_path: target_path || `s3://data-lake/silver/${pipeline_name}/`,
      source_format: source_type === 'csv' ? 'csv' : 'parquet',
      target_format: 'delta',
      transformations: schema ? inferTransformations(schema.source, schema.target) : [],
      schema_columns: schema?.source?.columns || [],
      partition_by: frequency === 'daily' ? ['_ingestion_date'] : [],
      // Streaming params
      source_topic: request.source_topic,
      checkpoint_path: `s3://data-lake/checkpoints/${pipeline_name}/`,
      watermark_column: request.watermark_column || 'event_time',
      // dbt params
      source_ref: request.source_ref || 'stg_source',
      materialization: request.materialization || 'table',
      columns: schema?.target?.columns || [],
      // Glue params
      source_database: request.source_database || 'default_db',
      source_table: request.source_table || pipeline_name,
      // Python extract params
      source_url: request.source_url || '',
      auth_type: request.auth_type || 'bearer',
    },
    similar_pipelines: similar,
    reasoning: `Detected engine=${detectedEngine}, type=${type} from request. ${similar.length > 0 ? `Found ${similar.length} similar past pipelines.` : 'No similar pipelines in memory.'}`,
  };
}

module.exports = { orchestrate, planPipeline };
