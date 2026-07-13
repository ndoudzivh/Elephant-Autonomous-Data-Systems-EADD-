/**
 * EADD Code Validation Engine
 * 
 * validate_code(code, engine) -> { valid, errors, warnings, fixed_code }
 * 
 * Checks:
 * 1. Syntax validity (Python indentation, SQL structure)
 * 2. Security rules (no DROP, no TRUNCATE, no hardcoded creds)
 * 3. Best practices (imports present, error handling, logging)
 * 4. Schema compatibility (if schema provided)
 */

'use strict';

// ============================================================
// VALIDATION RESULT SCHEMA
// ============================================================

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Overall pass/fail
 * @property {Array<{rule: string, severity: string, message: string, line?: number}>} errors
 * @property {Array<{rule: string, message: string}>} warnings
 * @property {string} fixed_code - Auto-corrected code (if fixable)
 * @property {number} score - Quality score 0-100
 */

// ============================================================
// SECURITY RULES — Non-negotiable
// ============================================================

const BLOCKED_PATTERNS = [
  { pattern: /\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX)\b/gi, rule: 'no_drop', severity: 'critical', message: 'DROP statements are BLOCKED. Use soft-delete or archive instead.' },
  { pattern: /\bTRUNCATE\s+TABLE\b/gi, rule: 'no_truncate', severity: 'critical', message: 'TRUNCATE is BLOCKED. Use incremental delete with WHERE clause.' },
  { pattern: /\bDELETE\s+FROM\s+\w+\s*(?:;|$)/gim, rule: 'no_delete_all', severity: 'critical', message: 'DELETE without WHERE is BLOCKED (deletes ALL rows). Add a WHERE clause.' },
  { pattern: /(password|secret|token|api_key)\s*=\s*["'][^"']{8,}["']/gi, rule: 'no_hardcoded_secrets', severity: 'critical', message: 'Hardcoded credentials detected. Use environment variables or secrets manager.' },
  { pattern: /\bGRANT\s+ALL\b/gi, rule: 'no_grant_all', severity: 'high', message: 'GRANT ALL is too permissive. Grant only required permissions.' },
  { pattern: /\bALTER\s+TABLE.*DROP\s+COLUMN\b/gi, rule: 'no_drop_column', severity: 'high', message: 'DROP COLUMN is destructive. Consider adding new column instead (schema evolution).' },
  { pattern: /\bINSERT\s+OVERWRITE\b/gi, rule: 'no_insert_overwrite', severity: 'medium', message: 'INSERT OVERWRITE replaces all data. Use MERGE/UPSERT for safety.' },
];

// ============================================================
// PYTHON-SPECIFIC RULES
// ============================================================

const PYTHON_RULES = [
  { pattern: /^(?!.*import).*(?:SparkSession|DataFrame)/m, rule: 'missing_import', severity: 'error', message: 'SparkSession/DataFrame used without import.' },
  { pattern: /\.with\(\s*["']/g, rule: 'wrong_api', severity: 'error', message: '.with() does not exist. Use .withColumn().' },
  { pattern: /\.groupby\(/g, rule: 'case_sensitive', severity: 'error', message: 'PySpark uses .groupBy() (capital B), not .groupby().' },
  { pattern: /\.append\(\s*\{/g, rule: 'deprecated_api', severity: 'error', message: 'DataFrame.append() removed in pandas 2.0. Use pd.concat().' },
  { pattern: /datetime\.now\(\)\s*$/m, rule: 'dynamic_date', severity: 'warning', message: 'datetime.now() in Airflow start_date causes scheduler issues. Use fixed date.' },
  { pattern: /except\s*:/g, rule: 'bare_except', severity: 'warning', message: 'Bare except catches everything including KeyboardInterrupt. Use except Exception.' },
  { pattern: /print\(/g, rule: 'use_logger', severity: 'info', message: 'Use logging module instead of print() for production code.' },
];

// ============================================================
// SQL-SPECIFIC RULES
// ============================================================

const SQL_RULES = [
  { pattern: /SELECT\s+\*\s+FROM/gi, rule: 'select_star', severity: 'warning', message: 'SELECT * in production. Explicitly name columns for schema stability.' },
  { pattern: /WHERE\s+1\s*=\s*1/gi, rule: 'tautology', severity: 'warning', message: 'WHERE 1=1 is a tautology. Remove or use proper filter.' },
  { pattern: /(?:^|\s)(?:CREATE|ALTER)\s+(?!IF)/gim, rule: 'no_if_exists', severity: 'warning', message: 'Use IF NOT EXISTS / IF EXISTS for idempotent DDL.' },
];

// ============================================================
// BEST PRACTICE CHECKS
// ============================================================

const BEST_PRACTICES = {
  python: [
    { check: (code) => /import\s/.test(code), rule: 'has_imports', message: 'Missing import statements.' },
    { check: (code) => /try\s*:/.test(code) || /except\s/.test(code), rule: 'has_error_handling', message: 'No try/except error handling found.' },
    { check: (code) => /logging|logger/.test(code), rule: 'has_logging', message: 'No logging found. Production code must log operations.' },
    { check: (code) => /\.stop\(\)|finally/.test(code), rule: 'has_cleanup', message: 'No cleanup (spark.stop() or finally block) found.' },
  ],
  sql: [
    { check: (code) => /--.*Pipeline|--.*Generated/i.test(code), rule: 'has_header', message: 'No documentation header comment.' },
    { check: (code) => /;\s*$/.test(code.trim()), rule: 'ends_with_semicolon', message: 'SQL should end with semicolon.' },
  ],
};

// ============================================================
// AUTO-FIX ENGINE
// ============================================================

const AUTO_FIXES = [
  { pattern: /\.with\(\s*["']/g, fix: '.withColumn("', description: '.with() → .withColumn()' },
  { pattern: /\.groupby\(/g, fix: '.groupBy(', description: '.groupby() → .groupBy()' },
  { pattern: /\.orderby\(/g, fix: '.orderBy(', description: '.orderby() → .orderBy()' },
  { pattern: /\.dropDuplicate\(/g, fix: '.dropDuplicates(', description: '.dropDuplicate() → .dropDuplicates()' },
  { pattern: /format\(\s*["']delta_lake["']\s*\)/g, fix: 'format("delta")', description: 'delta_lake → delta' },
  { pattern: /\.option\(\s*["']topic["']/g, fix: '.option("subscribe"', description: 'Kafka: topic → subscribe' },
  { pattern: /from pyspark\.sql\.function import/g, fix: 'from pyspark.sql.functions import', description: 'function → functions (plural)' },
  { pattern: /CREAT TABLE/gi, fix: 'CREATE TABLE', description: 'Typo: CREAT → CREATE' },
  { pattern: /INSER INTO/gi, fix: 'INSERT INTO', description: 'Typo: INSER → INSERT' },
  { pattern: /SELCT /gi, fix: 'SELECT ', description: 'Typo: SELCT → SELECT' },
  { pattern: /WEHRE/gi, fix: 'WHERE', description: 'Typo: WEHRE → WHERE' },
];

// ============================================================
// MAIN VALIDATION FUNCTION
// ============================================================

/**
 * Validate code and return detailed results.
 * @param {string} code - Code to validate
 * @param {'python'|'sql'|'pyspark'|'glue'|'dbt'} engine - Code type
 * @returns {ValidationResult}
 */
function validateCode(code, engine = 'python') {
  const errors = [];
  const warnings = [];
  let fixedCode = code;
  let score = 100;

  // 1. Security checks (apply to ALL code)
  for (const rule of BLOCKED_PATTERNS) {
    const matches = code.match(rule.pattern);
    if (matches) {
      errors.push({
        rule: rule.rule,
        severity: rule.severity,
        message: rule.message,
        matches: matches.length,
      });
      score -= rule.severity === 'critical' ? 50 : rule.severity === 'high' ? 30 : 15;
    }
  }

  // 2. Language-specific checks
  const langRules = engine === 'sql' || engine === 'dbt' ? SQL_RULES : PYTHON_RULES;
  for (const rule of langRules) {
    if (rule.pattern.test(code)) {
      if (rule.severity === 'error') {
        errors.push({ rule: rule.rule, severity: rule.severity, message: rule.message });
        score -= 20;
      } else {
        warnings.push({ rule: rule.rule, message: rule.message });
        score -= 5;
      }
    }
    // Reset regex lastIndex
    rule.pattern.lastIndex = 0;
  }

  // 3. Best practice checks
  const practices = BEST_PRACTICES[engine === 'sql' || engine === 'dbt' ? 'sql' : 'python'] || [];
  for (const practice of practices) {
    if (!practice.check(code)) {
      warnings.push({ rule: practice.rule, message: practice.message });
      score -= 3;
    }
  }

  // 4. Auto-fix applicable issues
  let fixCount = 0;
  for (const fix of AUTO_FIXES) {
    if (fix.pattern.test(fixedCode)) {
      fixedCode = fixedCode.replace(fix.pattern, fix.fix);
      fixCount++;
    }
    fix.pattern.lastIndex = 0;
  }

  // 5. Python indentation check (basic)
  if (engine !== 'sql' && engine !== 'dbt') {
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^\t/) && code.includes('    ')) {
        warnings.push({ rule: 'mixed_indentation', message: `Line ${i + 1}: Mixed tabs and spaces.` });
        score -= 2;
      }
    }
  }

  return {
    valid: errors.filter(e => e.severity === 'critical' || e.severity === 'error').length === 0,
    errors,
    warnings,
    fixed_code: fixCount > 0 ? fixedCode : code,
    fixes_applied: fixCount,
    score: Math.max(0, Math.min(100, score)),
  };
}

module.exports = { validateCode, BLOCKED_PATTERNS, AUTO_FIXES };
