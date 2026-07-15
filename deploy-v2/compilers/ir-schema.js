/**
 * Canonical Pipeline IR Schema (Requirement 1)
 * 
 * Platform-independent representation of WHAT the pipeline must do.
 * Every platform compiler takes this same IR and emits platform-specific code.
 * 
 * Switching target_platform on the same IR is the ONLY thing that changes.
 * This guarantees "same requirement, every platform."
 */

'use strict';

// ============================================================
// IR SCHEMA DEFINITION
// ============================================================

/**
 * @typedef {Object} PipelineIR
 * @property {string} name - Pipeline identifier (snake_case)
 * @property {string} description - Human-readable description
 * @property {SourceDef} source - Data source definition
 * @property {BronzeDef} bronze - Raw landing layer config
 * @property {SilverDef} silver - Cleaning/conforming layer config
 * @property {GoldDef} gold - Business aggregation layer config
 * @property {Properties} properties - Pipeline behavioral properties
 * @property {string} target_platform - aws|azure|gcp|snowflake|dbt|databricks|on_prem
 * @property {ScheduleDef} schedule - Execution schedule
 * @property {Object} [metadata] - Optional metadata
 */

const VALID_PLATFORMS = ['aws', 'azure', 'gcp', 'snowflake', 'dbt', 'databricks', 'on_prem'];

const IR_SCHEMA = {
  name: { type: 'string', required: true, pattern: /^[a-z][a-z0-9_]*$/ },
  description: { type: 'string', required: false },
  source: {
    type: { type: 'string', required: true, enum: ['postgres', 'mysql', 'sqlserver', 'oracle', 'mongodb', 'api', 's3', 'gcs', 'adls', 'kafka'] },
    table: { type: 'string', required: true },
    schema: { type: 'string', required: false, default: 'public' },
    watermark_column: { type: 'string', required: false },
    primary_key: { type: 'string', required: true },
    connection_ref: { type: 'string', required: true },
    columns: { type: 'array', required: false },
  },
  bronze: {
    format: { type: 'string', required: true, enum: ['parquet', 'delta', 'json', 'avro'], default: 'parquet' },
    partition_by: { type: 'string', required: false, default: 'ingestion_date' },
    mode: { type: 'string', required: true, enum: ['append'], default: 'append' },
  },
  silver: {
    dedup_keys: { type: 'array', required: true },
    dedup_strategy: { type: 'string', required: false, enum: ['latest', 'first', 'merge'], default: 'latest' },
    transformations: { type: 'array', required: false, default: [] },
    null_handling: { type: 'object', required: false },
    type_casts: { type: 'array', required: false },
  },
  gold: {
    group_by: { type: 'array', required: true },
    aggregations: { type: 'array', required: true },
    output_name: { type: 'string', required: false },
  },
  properties: {
    incremental: { type: 'boolean', required: true },
    idempotent: { type: 'boolean', required: true },
    partitioned: { type: 'boolean', required: false, default: true },
    tested: { type: 'boolean', required: false, default: false },
  },
  target_platform: { type: 'string', required: true, enum: VALID_PLATFORMS },
  schedule: {
    cron: { type: 'string', required: false, default: '0 6 * * *' },
    frequency: { type: 'string', required: false, enum: ['hourly', 'daily', 'weekly'], default: 'daily' },
  },
};

// ============================================================
// IR VALIDATOR — Ensures IR is complete before compilation
// ============================================================

/**
 * Validate a Pipeline IR object.
 * Returns errors for missing/invalid fields.
 * Returns warnings for fields that should be asked from user.
 * 
 * @param {Object} ir - Pipeline IR to validate
 * @returns {{ valid: boolean, errors: string[], warnings: string[], missing: string[] }}
 */
function validateIR(ir) {
  const errors = [];
  const warnings = [];
  const missing = [];

  if (!ir) {
    return { valid: false, errors: ['IR is null/undefined'], warnings: [], missing: ['entire IR'] };
  }

  // Required top-level fields
  if (!ir.name) errors.push('name is required (snake_case identifier)');
  if (!ir.target_platform) errors.push('target_platform is required');
  if (ir.target_platform && !VALID_PLATFORMS.includes(ir.target_platform)) {
    errors.push(`Invalid target_platform "${ir.target_platform}". Must be one of: ${VALID_PLATFORMS.join(', ')}`);
  }

  // Source validation
  if (!ir.source) {
    errors.push('source is required');
  } else {
    if (!ir.source.type) errors.push('source.type is required');
    if (!ir.source.table) errors.push('source.table is required');
    if (!ir.source.primary_key) {
      missing.push('source.primary_key — needed for deduplication. What is the primary key column?');
    }
    if (!ir.source.connection_ref) {
      missing.push('source.connection_ref — needed for authentication. What connection name/secret to use?');
    }
    // Incremental requires watermark
    if (ir.properties?.incremental && !ir.source.watermark_column) {
      missing.push('source.watermark_column — required for incremental loading. Which timestamp/ID column tracks changes?');
    }
  }

  // Silver validation
  if (!ir.silver) {
    warnings.push('silver layer not defined — will use defaults (dedup on primary_key)');
  } else {
    if (!ir.silver.dedup_keys || ir.silver.dedup_keys.length === 0) {
      if (ir.source?.primary_key) {
        // Auto-fill from source PK
        ir.silver = ir.silver || {};
        ir.silver.dedup_keys = [ir.source.primary_key];
      } else {
        missing.push('silver.dedup_keys — which columns define uniqueness?');
      }
    }
  }

  // Gold validation
  if (!ir.gold) {
    warnings.push('gold layer not defined — will skip Gold aggregation');
  } else {
    if (!ir.gold.group_by || ir.gold.group_by.length === 0) {
      missing.push('gold.group_by — what dimensions to aggregate by?');
    }
    if (!ir.gold.aggregations || ir.gold.aggregations.length === 0) {
      missing.push('gold.aggregations — what metrics to calculate? (e.g., {column: "amount", fn: "sum"})');
    }
  }

  // Properties validation
  if (!ir.properties) {
    ir.properties = { incremental: true, idempotent: true };
    warnings.push('properties not set — defaulting to incremental=true, idempotent=true');
  }

  return {
    valid: errors.length === 0 && missing.length === 0,
    errors,
    warnings,
    missing,
  };
}

// ============================================================
// IR PARSER — Natural language → IR
// ============================================================

/**
 * Parse a natural language pipeline description into an IR.
 * Uses keyword extraction and pattern matching.
 * Returns partial IR with missing fields flagged.
 * 
 * @param {string} description - Natural language requirement
 * @param {Object} [hints] - Additional hints (engine, source_type, etc.)
 * @returns {Object} Partial IR + what's missing
 */
function parseToIR(description, hints = {}) {
  const lower = description.toLowerCase();
  const ir = {
    name: extractPipelineName(description),
    description,
    source: {
      type: detectSourceType(lower, hints),
      table: extractTableName(lower) || null,
      schema: 'public',
      watermark_column: detectWatermarkColumn(lower),
      primary_key: detectPrimaryKey(lower),
      connection_ref: `secrets/${extractPipelineName(description)}_source`,
    },
    bronze: {
      format: detectFormat(lower, hints),
      partition_by: 'ingestion_date',
      mode: 'append',
    },
    silver: {
      dedup_keys: detectPrimaryKey(lower) ? [detectPrimaryKey(lower)] : [],
      dedup_strategy: 'latest',
      transformations: [],
    },
    gold: extractGoldConfig(lower),
    properties: {
      incremental: lower.includes('incremental') || lower.includes('watermark') || !lower.includes('full refresh'),
      idempotent: lower.includes('idempotent') || lower.includes('merge') || lower.includes('upsert') || true,
      partitioned: true,
    },
    target_platform: detectPlatform(lower, hints),
    schedule: {
      cron: '0 6 * * *',
      frequency: lower.includes('hourly') ? 'hourly' : lower.includes('weekly') ? 'weekly' : 'daily',
    },
  };

  // Validate and return with missing fields
  const validation = validateIR(ir);

  return {
    ir,
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings,
    missing: validation.missing,
    needs_user_input: validation.missing.length > 0,
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function extractPipelineName(desc) {
  return desc
    .replace(/[^a-z0-9\s]/gi, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join('_')
    .toLowerCase() || 'pipeline';
}

function detectSourceType(lower, hints) {
  if (hints.source_type) return hints.source_type;
  if (lower.includes('postgres')) return 'postgres';
  if (lower.includes('mysql')) return 'mysql';
  if (lower.includes('sql server') || lower.includes('mssql')) return 'sqlserver';
  if (lower.includes('oracle')) return 'oracle';
  if (lower.includes('mongo')) return 'mongodb';
  if (lower.includes('api') || lower.includes('http')) return 'api';
  if (lower.includes('kafka')) return 'kafka';
  return 'postgres'; // default
}

function detectPlatform(lower, hints) {
  if (hints.target_platform) return hints.target_platform;
  if (hints.engine === 'airflow' || lower.includes('airflow') || lower.includes('aws') || lower.includes('s3') || lower.includes('glue')) return 'aws';
  if (hints.engine === 'databricks' || lower.includes('databricks')) return 'databricks';
  if (lower.includes('azure') || lower.includes('adf') || lower.includes('adls')) return 'azure';
  if (lower.includes('gcp') || lower.includes('bigquery') || lower.includes('beam') || lower.includes('dataflow')) return 'gcp';
  if (lower.includes('snowflake')) return 'snowflake';
  if (lower.includes('dbt')) return 'dbt';
  if (lower.includes('on-prem') || lower.includes('docker') || lower.includes('local')) return 'on_prem';
  return 'aws'; // default
}

function detectFormat(lower, hints) {
  if (lower.includes('delta')) return 'delta';
  if (lower.includes('avro')) return 'avro';
  if (lower.includes('json')) return 'json';
  if (hints.target_platform === 'databricks') return 'delta';
  return 'parquet';
}

function extractTableName(lower) {
  // Look for "from <table>" or "<table> table"
  const fromMatch = lower.match(/from\s+(\w+)/);
  if (fromMatch) return fromMatch[1];
  const tableMatch = lower.match(/(\w+)\s+table/);
  if (tableMatch && !['source', 'target', 'the', 'a'].includes(tableMatch[1])) return tableMatch[1];
  return null;
}

function detectWatermarkColumn(lower) {
  if (lower.includes('updated_at')) return 'updated_at';
  if (lower.includes('modified_at')) return 'modified_at';
  if (lower.includes('last_modified')) return 'last_modified';
  if (lower.includes('created_at')) return 'created_at';
  return null;
}

function detectPrimaryKey(lower) {
  const pkMatch = lower.match(/(?:primary key|unique key|dedup by|deduplicate on)\s+(\w+)/);
  if (pkMatch) return pkMatch[1];
  if (lower.includes('order_id')) return 'order_id';
  if (lower.includes('customer_id')) return 'customer_id';
  if (lower.includes('user_id')) return 'user_id';
  return 'id'; // default assumption
}

function extractGoldConfig(lower) {
  const groupBy = [];
  const aggregations = [];

  // Detect group by columns
  const groupMatch = lower.match(/(?:by|group by|per)\s+([\w,\s]+?)(?:\s+and|\s+with|\s*$)/);
  if (groupMatch) {
    groupBy.push(...groupMatch[1].split(/[,\s]+/).filter(w => w.length > 2 && !['and', 'the', 'for'].includes(w)));
  }
  if (lower.includes('region')) groupBy.push('region');
  if (lower.includes('daily') || lower.includes('date')) groupBy.push('business_date');

  // Detect aggregations
  if (lower.includes('sum') || lower.includes('total') || lower.includes('revenue')) {
    aggregations.push({ column: 'amount', fn: 'sum', alias: 'total_amount' });
  }
  if (lower.includes('count') || lower.includes('total records')) {
    aggregations.push({ column: '*', fn: 'count', alias: 'total_records' });
  }
  if (lower.includes('average') || lower.includes('avg')) {
    aggregations.push({ column: 'amount', fn: 'avg', alias: 'avg_amount' });
  }

  // Default if nothing detected
  if (groupBy.length === 0) groupBy.push('business_date');
  if (aggregations.length === 0) {
    aggregations.push({ column: '*', fn: 'count', alias: 'total_records' });
    aggregations.push({ column: 'amount', fn: 'sum', alias: 'total_amount' });
  }

  return { group_by: groupBy, aggregations, output_name: null };
}

module.exports = {
  validateIR,
  parseToIR,
  VALID_PLATFORMS,
  IR_SCHEMA,
};
