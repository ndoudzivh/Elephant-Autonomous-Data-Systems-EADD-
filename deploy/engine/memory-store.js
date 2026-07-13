/**
 * EADD Memory & Context Store
 * 
 * The agent remembers:
 * - Previous pipelines generated
 * - Data sources used
 * - Errors encountered (learns from mistakes)
 * - User preferences
 * 
 * In production: DynamoDB. Here: in-memory with export.
 */

'use strict';

// In-memory store (Lambda: replaced by DynamoDB)
const memory = {
  pipelines: [],
  errors: [],
  sources: [],
  context: [],
};


function storeContext(entry) {
  memory.context.push({
    ...entry,
    timestamp: new Date().toISOString(),
    id: `ctx_${Date.now()}`,
  });
  // Keep last 100 entries
  if (memory.context.length > 100) memory.context.shift();
}

function storePipelineResult(pipeline, result) {
  memory.pipelines.push({
    pipeline_name: pipeline.pipeline_name,
    engine: pipeline.engine,
    inputs: pipeline.inputs,
    outputs: pipeline.outputs,
    success: result.success,
    timestamp: new Date().toISOString(),
  });
  if (memory.pipelines.length > 50) memory.pipelines.shift();
}

function storeError(pipeline_name, error) {
  memory.errors.push({
    pipeline_name,
    error: error.message || error,
    timestamp: new Date().toISOString(),
  });
  if (memory.errors.length > 50) memory.errors.shift();
}

function retrieveSimilarPipeline(request) {
  const keywords = (request.description || '').toLowerCase().split(/\s+/);
  return memory.pipelines
    .filter(p => {
      const pipeStr = JSON.stringify(p).toLowerCase();
      return keywords.some(k => pipeStr.includes(k));
    })
    .slice(-3);
}

function getMemoryStats() {
  return {
    total_pipelines: memory.pipelines.length,
    total_errors: memory.errors.length,
    total_sources: memory.sources.length,
    recent_pipelines: memory.pipelines.slice(-5).map(p => p.pipeline_name),
    success_rate: memory.pipelines.length > 0
      ? Math.round(memory.pipelines.filter(p => p.success).length / memory.pipelines.length * 100)
      : 0,
  };
}

module.exports = {
  storeContext,
  storePipelineResult,
  storeError,
  retrieveSimilarPipeline,
  getMemoryStats,
  memory,
};
