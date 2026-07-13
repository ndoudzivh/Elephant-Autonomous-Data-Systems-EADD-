/**
 * EADD Schema Intelligence Layer
 * 
 * Understands input/output schemas, validates compatibility,
 * and aligns transformations to target schema.
 * 
 * Capabilities:
 * - get_schema(source) → column definitions
 * - validate_schema_compatibility(source, target) → pass/fail + issues
 * - infer_transformations(source, target) → auto-generated transform map
 * - detect_schema_drift(current, expected) → drift report
 */

'use strict';

// ============================================================
// SCHEMA TYPES
// ============================================================

/**
 * @typedef {Object} SchemaColumn
 * @property {string} name
 * @property {string} type - (string|int|long|double|decimal|boolean|timestamp|date|array|map|struct)
 * @property {boolean} nullable
 * @property {string} [description]
 * @property {boolean} [is_primary_key]
 * @property {boolean} [is_partition_key]
 */

/**
 * @typedef {Object} Schema
 * @property {string} table_name
 * @property {SchemaColumn[]} columns
 * @property {string[]} primary_keys
 * @property {string[]} partition_keys
 */

// ============================================================
// TYPE COMPATIBILITY MAP
// ============================================================

const TYPE_HIERARCHY = {
  // Narrower → Wider (safe implicit casts)
  boolean: ['int', 'long', 'string'],
  int: ['long', 'double', 'decimal', 'string'],
  long: ['double', 'decimal', 'string'],
  float: ['double', 'decimal', 'string'],
  double: ['decimal', 'string'],
  decimal: ['string'],
  date: ['timestamp', 'string'],
  timestamp: ['string'],
  string: [], // string is the widest — nothing widens to
};

function canImplicitCast(fromType, toType) {
  if (fromType === toType) return true;
  const from = fromType.toLowerCase();
  const to = toType.toLowerCase();
  return (TYPE_HIERARCHY[from] || []).includes(to);
}

// ============================================================
// SCHEMA VALIDATION
// ============================================================

/**
 * Validate compatibility between source and target schemas.
 * Returns detailed report of mismatches.
 */
function validateSchemaCompatibility(sourceSchema, targetSchema) {
  const issues = [];
  const mappings = [];

  // Check every target column has a source
  for (const targetCol of targetSchema.columns) {
    const sourceCol = sourceSchema.columns.find(
      s => s.name.toLowerCase() === targetCol.name.toLowerCase()
    );

    if (!sourceCol) {
      // Target column not in source — check if it's a generated column
      if (targetCol.name.startsWith('_')) {
        mappings.push({
          source: null,
          target: targetCol.name,
          action: 'generate',
          note: 'System column — will be auto-generated',
        });
      } else {
        issues.push({
          severity: targetCol.nullable ? 'warning' : 'error',
          column: targetCol.name,
          issue: 'missing_in_source',
          message: `Target column "${targetCol.name}" not found in source. ${targetCol.nullable ? 'Will be NULL.' : 'REQUIRED — pipeline will fail.'}`,
        });
      }
      continue;
    }

    // Check type compatibility
    if (!canImplicitCast(sourceCol.type, targetCol.type)) {
      if (canImplicitCast(targetCol.type, sourceCol.type)) {
        // Narrowing cast — might lose data
        issues.push({
          severity: 'warning',
          column: targetCol.name,
          issue: 'narrowing_cast',
          message: `Casting ${sourceCol.type} → ${targetCol.type} may lose data (narrowing).`,
          fix: `Add explicit .cast("${targetCol.type}") with null handling`,
        });
      } else {
        issues.push({
          severity: 'error',
          column: targetCol.name,
          issue: 'incompatible_types',
          message: `Cannot cast ${sourceCol.type} → ${targetCol.type}. Incompatible types.`,
        });
      }
    }

    mappings.push({
      source: sourceCol.name,
      target: targetCol.name,
      action: sourceCol.type === targetCol.type ? 'direct' : 'cast',
      source_type: sourceCol.type,
      target_type: targetCol.type,
    });
  }

  // Check for source columns not in target (data loss warning)
  for (const sourceCol of sourceSchema.columns) {
    const inTarget = targetSchema.columns.find(
      t => t.name.toLowerCase() === sourceCol.name.toLowerCase()
    );
    if (!inTarget) {
      issues.push({
        severity: 'info',
        column: sourceCol.name,
        issue: 'not_in_target',
        message: `Source column "${sourceCol.name}" will be dropped (not in target schema).`,
      });
    }
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;

  return {
    compatible: errorCount === 0,
    issues,
    mappings,
    score: Math.max(0, 100 - errorCount * 30 - issues.filter(i => i.severity === 'warning').length * 10),
    summary: errorCount === 0
      ? `✅ Schemas compatible. ${issues.length} warnings.`
      : `❌ ${errorCount} blocking issues. Fix before proceeding.`,
  };
}

// ============================================================
// SCHEMA DRIFT DETECTION
// ============================================================

/**
 * Detect differences between current and expected schema.
 */
function detectSchemaDrift(currentSchema, expectedSchema) {
  const drift = {
    added_columns: [],
    removed_columns: [],
    type_changes: [],
    nullable_changes: [],
    has_drift: false,
  };

  const currentNames = new Set(currentSchema.columns.map(c => c.name.toLowerCase()));
  const expectedNames = new Set(expectedSchema.columns.map(c => c.name.toLowerCase()));

  // Added columns (in current but not expected)
  for (const col of currentSchema.columns) {
    if (!expectedNames.has(col.name.toLowerCase())) {
      drift.added_columns.push(col);
      drift.has_drift = true;
    }
  }

  // Removed columns (in expected but not current)
  for (const col of expectedSchema.columns) {
    if (!currentNames.has(col.name.toLowerCase())) {
      drift.removed_columns.push(col);
      drift.has_drift = true;
    }
  }

  // Type/nullable changes
  for (const expected of expectedSchema.columns) {
    const current = currentSchema.columns.find(
      c => c.name.toLowerCase() === expected.name.toLowerCase()
    );
    if (!current) continue;

    if (current.type !== expected.type) {
      drift.type_changes.push({
        column: expected.name,
        was: expected.type,
        now: current.type,
      });
      drift.has_drift = true;
    }

    if (current.nullable !== expected.nullable) {
      drift.nullable_changes.push({
        column: expected.name,
        was_nullable: expected.nullable,
        now_nullable: current.nullable,
      });
      drift.has_drift = true;
    }
  }

  return drift;
}

// ============================================================
// TRANSFORMATION INFERENCE
// ============================================================

/**
 * Auto-generate transformation code to align source → target.
 */
function inferTransformations(sourceSchema, targetSchema) {
  const transforms = [];

  for (const targetCol of targetSchema.columns) {
    const sourceCol = sourceSchema.columns.find(
      s => s.name.toLowerCase() === targetCol.name.toLowerCase()
    );

    if (!sourceCol) {
      // Generate column with default
      if (targetCol.name === '_processed_at' || targetCol.name === '_pipeline_timestamp') {
        transforms.push({ type: 'add_column', name: targetCol.name, expression: 'current_timestamp()' });
      } else if (targetCol.nullable) {
        transforms.push({ type: 'add_column', name: targetCol.name, expression: `lit(None).cast("${targetCol.type}")` });
      }
      continue;
    }

    // Type cast needed
    if (sourceCol.type !== targetCol.type) {
      transforms.push({ type: 'cast', column: sourceCol.name, target_type: targetCol.type });
    }

    // Rename needed
    if (sourceCol.name !== targetCol.name) {
      transforms.push({ type: 'rename', from: sourceCol.name, to: targetCol.name });
    }
  }

  // Drop columns not in target
  for (const sourceCol of sourceSchema.columns) {
    const inTarget = targetSchema.columns.find(
      t => t.name.toLowerCase() === sourceCol.name.toLowerCase()
    );
    if (!inTarget) {
      transforms.push({ type: 'drop', column: sourceCol.name });
    }
  }

  return transforms;
}

module.exports = {
  validateSchemaCompatibility,
  detectSchemaDrift,
  inferTransformations,
  canImplicitCast,
};
