/**
 * Environment Introspection Module (Requirement 3)
 * 
 * Queries real database schemas instead of using placeholders.
 * Detects watermark columns for incremental loading.
 * Asks user for missing info rather than guessing.
 * 
 * Supports: PostgreSQL, MySQL, Snowflake, SQL Server
 */

'use strict';

// Watermark column name patterns (likely incremental markers)
const WATERMARK_PATTERNS = [
  'updated_at', 'modified_at', 'last_modified', 'update_date',
  'modified_date', 'last_updated', 'changed_at', 'sync_date',
  '_updated_at', 'updatedat', 'modifiedat', 'etl_updated_at',
];

// Auto-incrementing ID patterns (alternative watermark)
const ID_WATERMARK_PATTERNS = [
  'id', 'row_id', 'sequence_id', 'event_id', 'log_id',
];

/**
 * Introspect a source database schema.
 * In production: executes real SQL against the source.
 * Currently: accepts schema JSON or returns prompts for missing info.
 * 
 * @param {Object} params
 * @param {Object} [params.schema] - Pre-provided schema JSON
 * @param {string} [params.connection_string] - DB connection (read-only)
 * @param {string} [params.table_name] - Specific table to introspect
 * @param {string} [params.engine] - postgres|mysql|snowflake|sqlserver
 * @returns {Object} Introspection result
 */
function introspectSource(params) {
  const { schema, table_name, engine } = params;

  // If schema provided directly (from file upload or API)
  if (schema && schema.columns) {
    return analyzeSchema(schema, table_name);
  }

  // If no schema and no connection — ask user
  if (!schema && !params.connection_string) {
    return {
      success: false,
      needs_input: true,
      message: 'I need your source schema to generate accurate code. Please provide one of:\n' +
        '1. Upload a CSV/JSON sample file (I will detect the schema)\n' +
        '2. Provide the table name and column definitions\n' +
        '3. Provide read-only database credentials for auto-discovery\n\n' +
        'Without this, I cannot generate a pipeline with real column names — only placeholders.',
      required_fields: ['table_name', 'columns (name + type)', 'primary_key', 'watermark_column (optional)'],
    };
  }

  // If connection string provided — generate introspection SQL
  if (params.connection_string) {
    const sql = generateIntrospectionSQL(table_name, engine);
    return {
      success: true,
      needs_execution: true,
      sql,
      message: 'Run this SQL against your source database (read-only) and provide the results.',
    };
  }

  return { success: false, message: 'Unable to introspect source.' };
}

/**
 * Analyze a provided schema and detect watermark columns,
 * primary keys, and recommend incremental strategy.
 */
function analyzeSchema(schema, tableName) {
  const columns = schema.columns || [];
  const result = {
    success: true,
    table_name: tableName || schema.table_name || 'unknown_table',
    columns: columns,
    column_count: columns.length,
    primary_key: null,
    watermark_column: null,
    incremental_strategy: null,
    recommendations: [],
  };

  // Detect primary key
  const pkCol = columns.find(c => c.is_primary_key) ||
    columns.find(c => c.name === 'id') ||
    columns.find(c => c.name.endsWith('_id') && c.type === 'integer');

  if (pkCol) {
    result.primary_key = pkCol.name;
  } else {
    result.recommendations.push('No primary key detected. Add unique_key for deduplication.');
  }

  // Detect watermark column (timestamp-based)
  const watermarkCol = columns.find(c =>
    WATERMARK_PATTERNS.includes(c.name.toLowerCase()) &&
    (c.type === 'timestamp' || c.type === 'datetime' || c.type === 'date')
  );

  if (watermarkCol) {
    result.watermark_column = watermarkCol.name;
    result.incremental_strategy = 'timestamp_watermark';
    result.recommendations.push(
      `Incremental loading will use "${watermarkCol.name}" as watermark (WHERE ${watermarkCol.name} > last_run_value).`
    );
  } else {
    // Try ID-based watermark
    const idCol = columns.find(c =>
      ID_WATERMARK_PATTERNS.includes(c.name.toLowerCase()) &&
      (c.type === 'integer' || c.type === 'bigint' || c.type === 'long')
    );

    if (idCol) {
      result.watermark_column = idCol.name;
      result.incremental_strategy = 'id_watermark';
      result.recommendations.push(
        `No timestamp column found. Using "${idCol.name}" as incremental marker (WHERE ${idCol.name} > last_max_id).`
      );
    } else {
      result.incremental_strategy = 'full_refresh';
      result.recommendations.push(
        'No watermark column detected. Pipeline will use FULL REFRESH (not incremental). ' +
        'Add an updated_at timestamp column to enable incremental loading.'
      );
    }
  }

  // Detect PII columns
  const piiPatterns = ['email', 'phone', 'ssn', 'password', 'credit_card', 'address', 'dob', 'date_of_birth'];
  const piiColumns = columns.filter(c => piiPatterns.some(p => c.name.toLowerCase().includes(p)));
  if (piiColumns.length > 0) {
    result.pii_columns = piiColumns.map(c => c.name);
    result.recommendations.push(
      `PII detected in columns: ${piiColumns.map(c => c.name).join(', ')}. Apply masking in Silver layer.`
    );
  }

  // Detect nullable columns (quality concern)
  const nullableCols = columns.filter(c => c.nullable === true);
  if (nullableCols.length > columns.length * 0.5) {
    result.recommendations.push(
      `${nullableCols.length}/${columns.length} columns are nullable. Add NOT NULL checks in data quality layer.`
    );
  }

  return result;
}

/**
 * Generate SQL to introspect a database table.
 */
function generateIntrospectionSQL(tableName, engine) {
  const sqls = {
    postgres: `
SELECT
  column_name AS name,
  data_type AS type,
  is_nullable = 'YES' AS nullable,
  column_default IS NOT NULL AS has_default,
  CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key
FROM information_schema.columns c
LEFT JOIN (
  SELECT kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = '${tableName}' AND tc.constraint_type = 'PRIMARY KEY'
) pk ON c.column_name = pk.column_name
WHERE c.table_name = '${tableName}'
ORDER BY c.ordinal_position;`,

    mysql: `
SELECT
  COLUMN_NAME AS name,
  DATA_TYPE AS type,
  IS_NULLABLE = 'YES' AS nullable,
  COLUMN_KEY = 'PRI' AS is_primary_key
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = '${tableName}'
ORDER BY ORDINAL_POSITION;`,

    snowflake: `
SELECT
  COLUMN_NAME AS name,
  DATA_TYPE AS type,
  IS_NULLABLE = 'YES' AS nullable
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = UPPER('${tableName}')
ORDER BY ORDINAL_POSITION;`,

    sqlserver: `
SELECT
  c.COLUMN_NAME AS name,
  c.DATA_TYPE AS type,
  CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS nullable,
  CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS is_primary_key
FROM INFORMATION_SCHEMA.COLUMNS c
LEFT JOIN (
  SELECT ku.COLUMN_NAME
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
  JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
  WHERE tc.TABLE_NAME = '${tableName}' AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
WHERE c.TABLE_NAME = '${tableName}'
ORDER BY c.ORDINAL_POSITION;`,
  };

  return sqls[engine] || sqls.postgres;
}

module.exports = { introspectSource, analyzeSchema, generateIntrospectionSQL };
