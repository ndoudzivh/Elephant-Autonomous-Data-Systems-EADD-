/**
 * Airflow DAG Structure Validator
 * 
 * Validates that generated Airflow code has correct DAG structure:
 * - Has a DAG definition
 * - Uses correct operator imports (not deprecated paths)
 * - Has proper task dependencies
 * - Doesn't use deprecated patterns
 */

'use strict';

/**
 * Validate Airflow DAG structure.
 * @param {string} code - Airflow Python code
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateAirflowDAG(code) {
  const errors = [];

  // Check 1: Has a DAG definition
  if (!code.includes('DAG(') && !code.includes('@dag')) {
    errors.push('No DAG definition found — Airflow files must define a DAG object');
  }

  // Check 2: Deprecated imports (Airflow 2.x removed these)
  const deprecatedImports = [
    { old: 'from airflow.operators.python_operator', new: 'from airflow.operators.python' },
    { old: 'from airflow.operators.bash_operator', new: 'from airflow.operators.bash' },
    { old: 'from airflow.operators.dummy_operator', new: 'from airflow.operators.empty' },
    { old: 'from airflow.operators.http_operator', new: 'from airflow.providers.http.operators.http' },
    { old: 'from airflow.sensors.http_sensor', new: 'from airflow.providers.http.sensors.http' },
    { old: 'from airflow.hooks.S3_hook', new: 'from airflow.providers.amazon.aws.hooks.s3' },
    { old: 'from airflow.contrib', new: 'Use airflow.providers.* instead' },
  ];

  for (const dep of deprecatedImports) {
    if (code.includes(dep.old)) {
      errors.push(`Deprecated import: '${dep.old}' → use '${dep.new}' (Airflow 2.x)`);
    }
  }

  // Check 3: start_date must be static (not datetime.now())
  if (/start_date\s*=\s*datetime\.now\(\)/.test(code)) {
    errors.push('start_date=datetime.now() is dangerous — use a fixed date like datetime(2024, 1, 1)');
  }

  // Check 4: Has at least one task/operator
  const operatorPatterns = [
    'PythonOperator', 'BashOperator', 'EmptyOperator', 'DummyOperator',
    'S3ToRedshiftOperator', 'GlueCrawlerOperator', 'GlueJobOperator',
    '@task', 'PostgresOperator', 'SnowflakeOperator',
  ];
  const hasTask = operatorPatterns.some(op => code.includes(op));
  if (!hasTask && !code.includes('@task')) {
    errors.push('No tasks/operators found — DAG has no executable work');
  }

  // Check 5: Task dependencies defined (>> or .set_downstream)
  if (!code.includes('>>') && !code.includes('set_downstream') && !code.includes('set_upstream') && !code.includes('@dag')) {
    errors.push('No task dependencies defined — tasks will run in random order');
  }

  // Check 6: catchup should be explicitly set
  if (code.includes('DAG(') && !code.includes('catchup')) {
    errors.push('catchup not set — defaults to True which will backfill all missed runs on first deploy');
  }

  // Check 7: Proper schedule_interval format
  const scheduleMatch = code.match(/schedule_interval\s*=\s*['"]([^'"]+)['"]/);
  if (scheduleMatch) {
    const cron = scheduleMatch[1];
    // Basic cron validation (5 fields)
    if (cron !== '@daily' && cron !== '@hourly' && cron !== '@weekly' && cron !== '@monthly') {
      const parts = cron.split(' ');
      if (parts.length !== 5) {
        errors.push(`Invalid cron expression: '${cron}' — must have 5 fields (min hour dom mon dow)`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateAirflowDAG };
