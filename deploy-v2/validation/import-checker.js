/**
 * Python Import Validator
 * Verifies that imported modules actually exist.
 */

'use strict';

const KNOWN_MODULES = {
  python: ['sys', 'os', 'json', 'logging', 'datetime', 'typing', 'pathlib', 'uuid', 'time', 're', 'collections', 'functools', 'io', 'csv', 'hashlib'],
  aws: ['boto3', 'botocore'],
  pyspark: ['pyspark', 'pyspark.sql', 'pyspark.sql.functions', 'pyspark.sql.types', 'pyspark.sql.window', 'pyspark.context'],
  glue: ['awsglue', 'awsglue.transforms', 'awsglue.utils', 'awsglue.context', 'awsglue.job', 'awsglue.dynamicframe'],
  airflow: ['airflow', 'airflow.operators.python', 'airflow.operators.bash', 'airflow.operators.empty', 'airflow.providers.amazon.aws', 'airflow.utils.dates', 'airflow.models'],
  data: ['pandas', 'numpy', 'requests', 'sqlalchemy'],
  delta: ['delta', 'delta.tables'],
};

function validateImports(code, engine) {
  const errors = [];
  const importLines = code.match(/^(?:from|import)\s+.+$/gm) || [];

  for (const line of importLines) {
    // Check deprecated Airflow imports
    if (line.includes('airflow.operators.python_operator')) {
      errors.push(`Deprecated: '${line.trim()}' → use 'from airflow.operators.python'`);
    }
    if (line.includes('airflow.operators.bash_operator')) {
      errors.push(`Deprecated: '${line.trim()}' → use 'from airflow.operators.bash'`);
    }
    if (line.includes('airflow.contrib')) {
      errors.push(`Deprecated: '${line.trim()}' → use airflow.providers.*`);
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateImports };
