/**
 * EADD Code Accuracy Validator (Backend Integration)
 * 
 * Catches and auto-fixes common code typos in LLM output.
 * Runs BEFORE the response reaches the user — so they never see broken code.
 * 
 * WHY: LLMs occasionally hallucinate incorrect API methods.
 * Example: .with("col", expr) instead of .withColumn("col", expr)
 * This module catches those errors and silently corrects them.
 */

// ============================================================
// TYPO FIX MAP — Common LLM mistakes → correct versions
// ============================================================

const TYPO_FIXES: Array<[RegExp, string, string]> = [
  // PySpark — Critical method name fixes
  [/\.with\(\s*["']/g, '.withColumn("', 'PySpark: .with() does not exist → .withColumn()'],
  [/\.withColum\(/g, '.withColumn(', 'PySpark: typo withColum → withColumn'],
  [/\.groupby\(/g, '.groupBy(', 'PySpark: case-sensitive → .groupBy()'],
  [/\.orderby\(/g, '.orderBy(', 'PySpark: case-sensitive → .orderBy()'],
  [/\.dropDuplicate\(/g, '.dropDuplicates(', 'PySpark: plural → .dropDuplicates()'],
  [/\.isNotNull(?!\()/g, '.isNotNull()', 'PySpark: method call needs parens'],
  [/\.isNull(?!\()/g, '.isNull()', 'PySpark: method call needs parens'],

  [/format\(\s*["']delta_lake["']\s*\)/g, 'format("delta")', 'Spark: format is "delta" not "delta_lake"'],
  [/\.option\(\s*["']topic["']/g, '.option("subscribe"', 'Kafka: use "subscribe" not "topic"'],
  [/from pyspark\.sql\.function import/g, 'from pyspark.sql.functions import', 'PySpark: plural "functions"'],

  // Pandas — Deprecated/removed APIs
  [/\.append\(\s*\{/g, '# Use pd.concat() instead of .append() (removed in pandas 2.0)\npd.concat([', 'Pandas: .append() removed in 2.0'],
  [/\.drop_duplcates/g, '.drop_duplicates', 'Pandas: typo → .drop_duplicates()'],
  [/\.read_CSV\(/g, '.read_csv(', 'Pandas: lowercase → .read_csv()'],
  [/\.group_by\(/g, '.groupby(', 'Pandas: no underscore → .groupby()'],

  // SQL — Common typos
  [/CREAT TABLE/gi, 'CREATE TABLE', 'SQL: typo → CREATE TABLE'],
  [/INSER INTO/gi, 'INSERT INTO', 'SQL: typo → INSERT INTO'],
  [/SELCT /gi, 'SELECT ', 'SQL: typo → SELECT'],
  [/WEHRE/gi, 'WHERE', 'SQL: typo → WHERE'],
  [/FORM /gi, 'FROM ', 'SQL: typo → FROM'],

  // Airflow — Dangerous patterns
  [/start_date\s*=\s*datetime\.now\(\)/g,
    'start_date=datetime(2024, 1, 1)  # NEVER use datetime.now() — causes scheduler confusion',
    'Airflow: dynamic start_date is dangerous'],
  [/PythonOPerator/g, 'PythonOperator', 'Airflow: typo → PythonOperator'],
  [/BashOPerator/g, 'BashOperator', 'Airflow: typo → BashOperator'],

  // General Python typos
  [/retrun /g, 'return ', 'Python: typo → return'],
  [/pritn\(/g, 'print(', 'Python: typo → print()'],
  [/improt /g, 'import ', 'Python: typo → import'],

  // Terraform — Security critical
  [/(access_key|secret_key|password)\s*=\s*"[A-Za-z0-9+/=]{10,}"/g,
    '$1 = var.$1  # NEVER hardcode credentials — use variables or secrets manager',
    'Terraform: hardcoded credentials detected → use var references'],
];


// ============================================================
// FRAMEWORK DETECTION — Determine what frameworks are in the code
// ============================================================

type Framework = 'pyspark' | 'pandas' | 'airflow' | 'dbt' | 'terraform' | 'snowflake_sql' | 'generic';

function detectFrameworks(code: string): Framework[] {
  const detected: Framework[] = [];
  if (/pyspark|SparkSession|from pyspark/i.test(code)) detected.push('pyspark');
  if (/import pandas|pd\.|DataFrame\(\{/i.test(code)) detected.push('pandas');
  if (/from airflow|DAG\(|@dag|@task/i.test(code)) detected.push('airflow');
  if (/\{\{\s*(ref|source|config)\s*\(/i.test(code)) detected.push('dbt');
  if (/resource\s+"(aws|azurerm|google)_|terraform\s*\{/i.test(code)) detected.push('terraform');
  if (/WAREHOUSE|CREATE\s+(OR\s+REPLACE\s+)?STAGE|SNOWFLAKE/i.test(code)) detected.push('snowflake_sql');
  if (detected.length === 0) detected.push('generic');
  return detected;
}

// ============================================================
// MAIN EXPORT — Fix typos in the full response text
// ============================================================

/**
 * Scans the full LLM response for common code typos and fixes them.
 * Only modifies content inside code blocks (```...```) to avoid
 * breaking prose text.
 */
export function fixCommonTypos(content: string): string {
  // Extract code blocks, fix them, put them back
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

  return content.replace(codeBlockRegex, (match, lang, code) => {
    let fixed = code;

    for (const [pattern, replacement] of TYPO_FIXES) {
      fixed = fixed.replace(pattern, replacement);
    }

    return `\`\`\`${lang || ''}\n${fixed}\`\`\``;
  });
}
