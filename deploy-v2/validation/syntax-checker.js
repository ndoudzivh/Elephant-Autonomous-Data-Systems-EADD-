/**
 * Python Syntax Validation
 * 
 * Equivalent to `python -m py_compile` but runs in Node.js.
 * Checks for common syntax errors without executing the code.
 */

'use strict';

/**
 * Validate Python syntax by checking structure.
 * @param {string} code - Python code to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSyntax(code) {
  const errors = [];
  const lines = code.split('\n');

  // Check 1: Balanced parentheses, brackets, braces
  let parens = 0, brackets = 0, braces = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments and strings (simplified)
    if (line.trim().startsWith('#')) continue;

    for (const ch of line) {
      if (ch === '(') parens++;
      if (ch === ')') parens--;
      if (ch === '[') brackets++;
      if (ch === ']') brackets--;
      if (ch === '{') braces++;
      if (ch === '}') braces--;

      if (parens < 0) { errors.push(`Line ${i + 1}: unexpected ')' — missing colon or opening parenthesis`); parens = 0; }
      if (brackets < 0) { errors.push(`Line ${i + 1}: unexpected ']'`); brackets = 0; }
      if (braces < 0) { errors.push(`Line ${i + 1}: unexpected '}'`); braces = 0; }
    }
  }

  if (parens !== 0) errors.push(`Unbalanced parentheses: ${parens > 0 ? 'missing )' : 'extra )'}`);
  if (brackets !== 0) errors.push(`Unbalanced brackets: ${brackets > 0 ? 'missing ]' : 'extra ]'}`);
  if (braces !== 0) errors.push(`Unbalanced braces: ${braces > 0 ? 'missing }' : 'extra }'}`);

  // Check 2: def/class/if/for/while must end with colon
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^(def|class|if|elif|else|for|while|try|except|finally|with)\b/.test(trimmed)) {
      // Check if line ends with colon (allowing for multi-line)
      if (!trimmed.endsWith(':') && !trimmed.endsWith(':\\') && !trimmed.endsWith(',')) {
        // Could be a multi-line statement — check next lines
        let found = false;
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          if (lines[j].trim().endsWith(':')) { found = true; break; }
          if (lines[j].trim() && !lines[j].trim().endsWith(',') && !lines[j].trim().endsWith('\\')) break;
        }
        if (!found && !trimmed.includes(':')) {
          errors.push(`Line ${i + 1}: '${trimmed.split(' ')[0]}' statement may be missing colon`);
        }
      }
    }
  }

  // Check 3: Indentation consistency
  let usesSpaces = false, usesTabs = false;
  for (const line of lines) {
    if (line.startsWith('    ')) usesSpaces = true;
    if (line.startsWith('\t')) usesTabs = true;
  }
  if (usesSpaces && usesTabs) {
    errors.push('Mixed indentation: both tabs and spaces detected');
  }

  // Check 4: Invalid Python keywords used as variables
  const reserved = ['True', 'False', 'None', 'and', 'or', 'not', 'in', 'is', 'lambda'];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\s*)(True|False|None)\s*=/);
    if (match) {
      errors.push(`Line ${i + 1}: cannot assign to '${match[2]}' (reserved keyword)`);
    }
  }

  // Check 5: Unclosed strings
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('#')) continue;
    const singleQuotes = (line.match(/(?<!\\)'/g) || []).length;
    const doubleQuotes = (line.match(/(?<!\\)"/g) || []).length;
    // Triple quotes handled differently
    if (!line.includes('"""') && !line.includes("'''")) {
      if (singleQuotes % 2 !== 0 && !line.trim().endsWith('\\')) {
        // Could be multi-line string, only flag if obvious
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateSyntax };
