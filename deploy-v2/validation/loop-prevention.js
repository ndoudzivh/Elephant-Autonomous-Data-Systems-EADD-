/**
 * Generation-Time Loop Prevention (Req 3)
 * 
 * Hard 300-line ceiling per code block. If exceeded without
 * reaching a complete structure, aborts and retries with
 * template assembly. Logs aborted generations.
 */

'use strict';

const MAX_LINES = 300;
const abortLog = [];

/**
 * Check if generated code exceeds line limit or shows
 * signs of degenerate generation.
 * @param {string} code - Generated code
 * @param {Object} options
 * @param {string} options.platform - Target platform
 * @param {string} options.prompt - Original prompt
 * @returns {{ abort: boolean, reason: string|null }}
 */
function checkForLooping(code, options = {}) {
  const lines = code.split('\n');

  // Check 1: Line count ceiling
  if (lines.length > MAX_LINES) {
    const reason = `Code exceeds ${MAX_LINES}-line ceiling (${lines.length} lines). Likely degenerate generation.`;
    logAbort(options.platform, options.prompt, reason);
    return { abort: true, reason };
  }

  // Check 2: Ratio of unique lines to total lines
  const nonEmptyLines = lines.filter(l => l.trim().length > 0);
  const uniqueLines = new Set(nonEmptyLines.map(l => l.trim()));
  const uniqueRatio = uniqueLines.size / Math.max(nonEmptyLines.length, 1);

  if (nonEmptyLines.length > 50 && uniqueRatio < 0.3) {
    const reason = `Low uniqueness ratio: ${(uniqueRatio * 100).toFixed(0)}% unique lines (${uniqueLines.size}/${nonEmptyLines.length}). Likely repeating.`;
    logAbort(options.platform, options.prompt, reason);
    return { abort: true, reason };
  }

  // Check 3: No function/class body reached after 100+ lines of imports
  const importLines = lines.filter(l => /^\s*(from|import)\s/.test(l));
  if (importLines.length > 50) {
    const reason = `${importLines.length} import lines detected. Model stuck in import loop.`;
    logAbort(options.platform, options.prompt, reason);
    return { abort: true, reason };
  }

  return { abort: false, reason: null };
}

function logAbort(platform, prompt, reason) {
  const entry = {
    timestamp: new Date().toISOString(),
    platform: platform || 'unknown',
    prompt: (prompt || '').slice(0, 200),
    reason,
  };
  console.error('[LOOP PREVENTION]', JSON.stringify(entry));
  abortLog.push(entry);
  if (abortLog.length > 100) abortLog.shift();
}

function getAbortLog(limit = 50) {
  return abortLog.slice(-limit);
}

module.exports = { checkForLooping, getAbortLog, MAX_LINES };
