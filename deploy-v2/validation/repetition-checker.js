/**
 * Repetition/Degeneracy Detector (Req 2, Gate 1)
 * 
 * Catches the GCP-style failure where the model gets stuck
 * repeating the same import line or a 6-line cycle 100+ times.
 * 
 * Runs FIRST (cheapest check). If this fails, don't bother
 * with syntax/import checks — the output is garbage.
 * 
 * Checks:
 * 1. Any single line repeated 3+ times consecutively
 * 2. Any short cycle (2-8 lines) repeating 5+ times
 */

'use strict';

/**
 * Check for repetition/degeneracy in generated code.
 * @param {string} code - Generated code to check
 * @returns {{ valid: boolean, errors: string[] }}
 */
function checkRepetition(code) {
  const errors = [];
  const lines = code.split('\n');

  // Check 1: Single line repeated 3+ times consecutively
  let consecutiveCount = 1;
  for (let i = 1; i < lines.length; i++) {
    const current = lines[i].trim();
    const prev = lines[i - 1].trim();

    if (current === prev && current.length > 0) {
      consecutiveCount++;
      if (consecutiveCount >= 3) {
        errors.push(
          `Degeneracy detected: line "${current.slice(0, 60)}..." ` +
          `repeated ${consecutiveCount}+ times consecutively (starting line ${i - consecutiveCount + 2})`
        );
        break;
      }
    } else {
      consecutiveCount = 1;
    }
  }

  // Check 2: Short cycle (2-8 lines) repeating 5+ times
  for (let cycleLen = 2; cycleLen <= 8; cycleLen++) {
    for (let start = 0; start <= lines.length - cycleLen * 5; start++) {
      const cycle = lines.slice(start, start + cycleLen).map(l => l.trim()).join('\n');

      // Skip if cycle is all empty/whitespace
      if (!cycle.replace(/\s/g, '')) continue;

      let repeats = 0;
      for (let pos = start; pos <= lines.length - cycleLen; pos += cycleLen) {
        const block = lines.slice(pos, pos + cycleLen).map(l => l.trim()).join('\n');
        if (block === cycle) {
          repeats++;
        } else {
          break;
        }
      }

      if (repeats >= 5) {
        errors.push(
          `Cycle degeneracy: ${cycleLen}-line block repeated ${repeats} times ` +
          `starting at line ${start + 1}. First line: "${lines[start].trim().slice(0, 50)}..."`
        );
        return { valid: false, errors };
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { checkRepetition };
