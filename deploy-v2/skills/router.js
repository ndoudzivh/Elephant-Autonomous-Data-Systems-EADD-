/**
 * Skill Router (Requirement 1)
 * 
 * Before generating code, checks if a verified SKILL.md exists
 * for the requested stack. If not, refuses to generate rather
 * than hallucinating APIs.
 * 
 * Supported stacks:
 * - airflow-aws (Airflow + AWS S3/Glue)
 * - dbt-snowflake (dbt + Snowflake)
 * - adf-azure (Azure Data Factory + ADLS)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname);

// Stack detection keywords
const STACK_PATTERNS = {
  'airflow-aws': ['airflow', 'aws', 's3', 'glue', 'athena', 'mwaa'],
  'dbt-snowflake': ['dbt', 'snowflake'],
  'adf-azure': ['azure', 'adf', 'data factory', 'adls', 'synapse'],
  'beam-gcp': ['beam', 'gcp', 'bigquery', 'dataflow', 'google cloud'],
  'databricks-adls': ['databricks', 'azure data lake', 'adls', 'delta lake'],
};

/**
 * Detect which stack the user is requesting.
 * @param {string} description - User's request
 * @param {string} [engine] - Explicit engine if provided
 * @returns {string|null} Stack ID or null
 */
function detectStack(description, engine) {
  const lower = (description || '').toLowerCase();

  // Explicit engine mapping
  if (engine === 'airflow' || engine === 'glue') return 'airflow-aws';
  if (engine === 'dbt') return 'dbt-snowflake';
  if (engine === 'adf') return 'adf-azure';
  if (engine === 'beam' || engine === 'dataflow') return 'beam-gcp';
  if (engine === 'databricks') return 'databricks-adls';

  // Keyword detection
  for (const [stackId, keywords] of Object.entries(STACK_PATTERNS)) {
    const matches = keywords.filter(k => lower.includes(k));
    if (matches.length >= 2) return stackId;
  }

  // Single strong keyword
  if (lower.includes('airflow')) return 'airflow-aws';
  if (lower.includes('dbt')) return 'dbt-snowflake';
  if (lower.includes('data factory') || lower.includes('adf')) return 'adf-azure';
  if (lower.includes('beam') || lower.includes('dataflow')) return 'beam-gcp';
  if (lower.includes('databricks')) return 'databricks-adls';

  return null;
}

/**
 * Load a skill file for the given stack.
 * @param {string} stackId - Stack identifier
 * @returns {{ found: boolean, content: string|null, path: string|null }}
 */
function loadSkill(stackId) {
  const skillPath = path.join(SKILLS_DIR, stackId, 'SKILL.md');

  try {
    if (fs.existsSync(skillPath)) {
      const content = fs.readFileSync(skillPath, 'utf-8');
      return { found: true, content, path: skillPath };
    }
  } catch (err) {
    console.error(`[Skill Router] Error loading ${skillPath}:`, err.message);
  }

  return { found: false, content: null, path: null };
}

/**
 * Main router: check if we have a verified skill for this request.
 * @param {string} description - User's pipeline request
 * @param {string} [engine] - Explicit engine
 * @returns {{ allowed: boolean, stackId: string|null, skill: string|null, message: string }}
 */
function routeToSkill(description, engine) {
  const stackId = detectStack(description, engine);

  if (!stackId) {
    // No stack detected — use generic generation (PySpark default)
    return {
      allowed: true,
      stackId: null,
      skill: null,
      message: 'No specific stack detected. Using generic PySpark generation.',
    };
  }

  const skill = loadSkill(stackId);

  if (!skill.found) {
    return {
      allowed: false,
      stackId,
      skill: null,
      message: `No verified skill file exists for stack "${stackId}". I cannot generate code for this stack without verified patterns. Available stacks: airflow-aws, dbt-snowflake, adf-azure.`,
    };
  }

  return {
    allowed: true,
    stackId,
    skill: skill.content,
    message: `Using verified skill: ${stackId} (${skill.path})`,
  };
}

/**
 * List all available skills.
 * @returns {string[]}
 */
function listAvailableSkills() {
  try {
    return fs.readdirSync(SKILLS_DIR)
      .filter(f => {
        const skillPath = path.join(SKILLS_DIR, f, 'SKILL.md');
        return fs.existsSync(skillPath);
      });
  } catch {
    return [];
  }
}

module.exports = { routeToSkill, detectStack, loadSkill, listAvailableSkills };
