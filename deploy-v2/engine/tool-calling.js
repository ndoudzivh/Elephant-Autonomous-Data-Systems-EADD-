/**
 * EADD Tool Calling Interface
 * 
 * Abstractions for external service calls.
 * The agent doesn't do everything itself — it calls tools.
 * 
 * Tools: S3, Glue, dbt, Catalog, Secrets Manager
 */

'use strict';

// AWS SDK clients (loaded lazily when needed)
// const { S3Client } = require('@aws-sdk/client-s3'); // Enable when real S3 ops needed


// Tool registry — what the agent can call
const TOOLS = {
  get_schema: {
    description: 'Get schema for a table/source',
    params: ['source_name'],
    execute: getSchema,
  },
  run_glue_job: {
    description: 'Submit and run an AWS Glue job',
    params: ['job_name', 'script_location', 'arguments'],
    execute: runGlueJob,
  },
  store_pipeline: {
    description: 'Store pipeline metadata to DynamoDB',
    params: ['pipeline_name', 'metadata'],
    execute: storePipeline,
  },
  read_s3: {
    description: 'Read file content from S3',
    params: ['bucket', 'key'],
    execute: readS3,
  },
  write_s3: {
    description: 'Write content to S3',
    params: ['bucket', 'key', 'content'],
    execute: writeS3,
  },
  list_tables: {
    description: 'List tables in Glue Catalog database',
    params: ['database_name'],
    execute: listTables,
  },
  get_secret: {
    description: 'Get secret from Secrets Manager',
    params: ['secret_name'],
    execute: getSecret,
  },
};


// ============================================================
// TOOL IMPLEMENTATIONS
// ============================================================

async function getSchema(params) {
  // In production: call Glue GetTable API
  // For now: return mock schema structure
  return {
    tool: 'get_schema',
    status: 'success',
    result: {
      table_name: params.source_name,
      columns: [
        { name: 'id', type: 'string', nullable: false },
        { name: 'created_at', type: 'timestamp', nullable: true },
        { name: 'amount', type: 'decimal', nullable: true },
      ],
      location: `s3://data-lake/bronze/${params.source_name}/`,
      format: 'parquet',
    },
  };
}

async function runGlueJob(params) {
  // In production: call Glue StartJobRun API
  return {
    tool: 'run_glue_job',
    status: 'submitted',
    result: {
      job_name: params.job_name,
      run_id: `jr_${Date.now()}`,
      state: 'RUNNING',
    },
  };
}

async function storePipeline(params) {
  // In production: DynamoDB PutItem
  return {
    tool: 'store_pipeline',
    status: 'success',
    result: {
      pipeline_name: params.pipeline_name,
      stored_at: new Date().toISOString(),
    },
  };
}


async function readS3(params) {
  return {
    tool: 'read_s3',
    status: 'success',
    result: { bucket: params.bucket, key: params.key, size: 0 },
  };
}

async function writeS3(params) {
  return {
    tool: 'write_s3',
    status: 'success',
    result: {
      bucket: params.bucket,
      key: params.key,
      written_at: new Date().toISOString(),
    },
  };
}

async function listTables(params) {
  return {
    tool: 'list_tables',
    status: 'success',
    result: {
      database: params.database_name,
      tables: ['customers', 'orders', 'products'],
    },
  };
}

async function getSecret(params) {
  return {
    tool: 'get_secret',
    status: 'success',
    result: { secret_name: params.secret_name, retrieved: true },
  };
}

/**
 * Execute a tool by name with given params.
 */
async function executeTool(toolName, params) {
  const tool = TOOLS[toolName];
  if (!tool) {
    return { tool: toolName, status: 'error', error: `Unknown tool: ${toolName}` };
  }
  try {
    return await tool.execute(params);
  } catch (err) {
    return { tool: toolName, status: 'error', error: err.message };
  }
}

module.exports = { executeTool, TOOLS };
