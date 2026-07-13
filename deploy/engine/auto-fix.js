/**
 * EADD Auto-Fix Loop
 * 
 * Self-healing: detect failure → fix code → retry until valid.
 * Maximum 3 retries before giving up.
 * 
 * This is what makes EADD AGENTIC — it doesn't just fail,
 * it fixes itself and tries again.
 */

'use strict';

const { validateCode } = require('./code-validator');

const MAX_RETRIES = 3;

// ============================================================
// FIX STRATEGIES — Applied in order of severity
// ============================================================

const FIX_STRATEGIES = {
  // Critical: Remove dangerous operations entirely
  no_drop: (code) => code.replace(/DROP\s+(TABLE|DATABASE|SCHEMA|INDEX)\s+\w+\s*;?/gi, '-- BLOCKED: DROP statement removed by EADD safety gate'),
  no_truncate: (code) => code.replace(/TRUNCATE\s+TABLE\s+\w+\s*;?/gi, '-- BLOCKED: TRUNCATE removed. Use DELETE with WHERE instead.'),
  no_delete_all: (code) => code.replace(/DELETE\s+FROM\s+(\w+)\s*;/gi, 'DELETE FROM $1 WHERE 1=0; -- BLOCKED: Add proper WHERE clause'),
  no_hardcoded_secrets: (code) => code.replace(
    /(password|secret|token|api_key)\s*=\s*["'][^"']+["']/gi,
    '$1 = os.environ.get("$1".upper())  # Fixed: use env var'
  ),

  // Error: Fix wrong API usage
  wrong_api: (code) => code.replace(/\.with\(\s*["']/g, '.withColumn("'),
  case_sensitive: (code) => code.replace(/\.groupby\(/g, '.groupBy(').replace(/\.orderby\(/g, '.orderBy('),
  deprecated_api: (code) => code.replace(/(\w+)\.append\(\s*\{/g, 'pd.concat([$1, {'),

  // Warning: Add missing elements
  missing_import: (code) => {
    if (!code.includes('from pyspark.sql import SparkSession')) {
      return 'from pyspark.sql import SparkSession\nfrom pyspark.sql.functions import col, lit, current_timestamp\n' + code;
    }
    return code;
  },
  has_error_handling: (code) => {
    if (!code.includes('try:') && !code.includes('except')) {
      // Wrap main logic in try/except
      const lines = code.split('\n');
      const importLines = [];
      const codeLines = [];
      let pastImports = false;

      for (const line of lines) {
        if (!pastImports && (line.startsWith('import') || line.startsWith('from') || line.startsWith('#') || line.trim() === '')) {
          importLines.push(line);
        } else {
          pastImports = true;
          codeLines.push('    ' + line);
        }
      }

      return importLines.join('\n') + '\n\ntry:\n' + codeLines.join('\n') + '\nexcept Exception as e:\n    import logging\n    logging.error(f"Pipeline FAILED: {str(e)}")\n    raise\n';
    }
    return code;
  },
  has_logging: (code) => {
    if (!code.includes('logging') && !code.includes('logger')) {
      return 'import logging\nlogging.basicConfig(level=logging.INFO)\nlogger = logging.getLogger(__name__)\n\n' + code;
    }
    return code;
  },
};

// ============================================================
// AUTO-FIX LOOP — The core agentic behavior
// ============================================================

/**
 * Attempt to fix code until it passes validation.
 * 
 * @param {string} code - Original code
 * @param {'python'|'sql'|'pyspark'} engine - Code type
 * @returns {{ code: string, valid: boolean, attempts: number, fixes_applied: string[], final_result: Object }}
 */
function autoFixLoop(code, engine = 'python') {
  let currentCode = code;
  let attempts = 0;
  const allFixes = [];

  while (attempts < MAX_RETRIES) {
    attempts++;

    // Validate current state
    const result = validateCode(currentCode, engine);

    // If valid (no critical/error issues), return
    if (result.valid) {
      return {
        code: result.fixed_code || currentCode,
        valid: true,
        attempts,
        fixes_applied: allFixes,
        final_result: result,
      };
    }

    // Apply fixes for each error found
    let fixedThisRound = false;
    for (const error of result.errors) {
      const fixer = FIX_STRATEGIES[error.rule];
      if (fixer) {
        const before = currentCode;
        currentCode = fixer(currentCode);
        if (currentCode !== before) {
          fixedThisRound = true;
          allFixes.push(`[Attempt ${attempts}] Fixed: ${error.rule} — ${error.message}`);
        }
      }
    }

    // Also apply the auto-fixes from validator
    if (result.fixed_code && result.fixed_code !== currentCode) {
      currentCode = result.fixed_code;
      fixedThisRound = true;
      allFixes.push(`[Attempt ${attempts}] Applied ${result.fixes_applied} syntax fixes`);
    }

    // If nothing was fixed this round, we can't improve further
    if (!fixedThisRound) {
      break;
    }
  }

  // Final validation after all attempts
  const finalResult = validateCode(currentCode, engine);

  return {
    code: finalResult.fixed_code || currentCode,
    valid: finalResult.valid,
    attempts,
    fixes_applied: allFixes,
    final_result: finalResult,
  };
}

module.exports = { autoFixLoop, FIX_STRATEGIES, MAX_RETRIES };
