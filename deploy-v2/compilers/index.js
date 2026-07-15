/**
 * Compiler Registry (Requirement 2)
 * 
 * Routes a validated Pipeline IR to the correct platform compiler.
 * Each compiler emits code using ONLY that platform's real SDK.
 * 
 * compile(ir) → { code, files, engine, platform, ir_satisfied }
 */

'use strict';

const { parseToIR, validateIR, VALID_PLATFORMS } = require('./ir-schema');

// Platform compilers
const COMPILERS = {
  aws: require('./aws'),
  databricks: require('./databricks'),
  gcp: require('./gcp'),
  // TODO: Add remaining compilers
  // azure: require('./azure'),
  // snowflake: require('./snowflake'),
  // dbt: require('./dbt'),
  // on_prem: require('./on_prem'),
};

/**
 * Main entry point: compile a pipeline from description or IR.
 * 
 * @param {Object} request
 * @param {string} [request.description] - Natural language (parsed to IR)
 * @param {Object} [request.ir] - Pre-built IR (skips parsing)
 * @param {string} [request.target_platform] - Override platform
 * @returns {Object} Compilation result
 */
function compilePipeline(request) {
  let ir;

  // Parse from description or use provided IR
  if (request.ir) {
    ir = request.ir;
  } else if (request.description) {
    const parsed = parseToIR(request.description, {
      target_platform: request.target_platform,
      engine: request.engine,
      source_type: request.source_type,
    });

    if (parsed.needs_user_input) {
      return {
        success: false,
        phase: 'ir_parsing',
        ir: parsed.ir,
        needs_input: true,
        missing: parsed.missing,
        message: 'Cannot generate pipeline — need additional information:\n' +
          parsed.missing.map(m => `• ${m}`).join('\n'),
      };
    }

    ir = parsed.ir;
  } else {
    return { success: false, error: 'Provide either description or ir' };
  }

  // Override platform if specified
  if (request.target_platform) {
    ir.target_platform = request.target_platform;
  }

  // Validate IR
  const validation = validateIR(ir);
  if (!validation.valid) {
    return {
      success: false,
      phase: 'ir_validation',
      ir,
      errors: validation.errors,
      missing: validation.missing,
      message: 'IR validation failed:\n' + [...validation.errors, ...validation.missing].join('\n'),
    };
  }

  // Get compiler
  const compiler = COMPILERS[ir.target_platform];
  if (!compiler) {
    return {
      success: false,
      phase: 'compiler_lookup',
      ir,
      error: `No compiler available for platform "${ir.target_platform}". Available: ${Object.keys(COMPILERS).join(', ')}`,
      confidence: 'unverified',
    };
  }

  // Check if compiler can satisfy the IR requirements
  const canDo = compiler.canSatisfy(ir);
  if (!canDo.can_satisfy) {
    return {
      success: false,
      phase: 'capability_check',
      ir,
      unsupported: canDo.unsupported,
      error: `Platform "${ir.target_platform}" cannot satisfy: ${canDo.unsupported.join(', ')}`,
    };
  }

  // Compile
  const result = compiler.compile(ir);

  return {
    success: true,
    phase: 'compiled',
    ir,
    output: result,
    confidence: 'verified',
  };
}

/**
 * Compile the SAME IR for multiple platforms (consistency test).
 * @param {Object} ir - Validated IR
 * @param {string[]} platforms - Platforms to compile for
 * @returns {Object} Results per platform
 */
function compileMultiPlatform(ir, platforms = Object.keys(COMPILERS)) {
  const results = {};

  for (const platform of platforms) {
    const platformIR = { ...ir, target_platform: platform };
    results[platform] = compilePipeline({ ir: platformIR });
  }

  return results;
}

module.exports = {
  compilePipeline,
  compileMultiPlatform,
  parseToIR,
  validateIR,
  VALID_PLATFORMS,
  COMPILERS,
};
