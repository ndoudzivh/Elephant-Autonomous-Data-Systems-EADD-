/**
 * EADD Code Accuracy Validator
 * 
 * Ensures generated code uses correct API calls, syntax, and patterns.
 * Catches common mistakes like:
 * - .with() instead of .withColumn() (PySpark)
 * - .select("col") instead of .select(col("col")) for expressions
 * - Wrong import paths
 * - Deprecated API usage
 * - Incorrect method signatures
 * 
 * This is a COMPILE-TIME check that runs before code is shown to the user.
 * Think of it as a linter specifically trained on data engineering frameworks.
 */

export interface ValidationRule {
  id: string;
  framework: CodeFramework;
  /** Pattern that indicates a mistake */
  errorPattern: RegExp;
  /** What the correct usage should be */
  correctPattern: string;
  /** Human-readable explanation */
  explanation: string;
  /** Severity */
  severity: 'error' | 'warning' | 'info';
  /** Auto-fix function */
  fix: (code: string) => string;
}

export type CodeFramework = 
  | 'pyspark'
  | 'pandas'
  | 'dbt_sql'
  | 'snowflake_sql'
  | 'airflow'
  | 'terraform'
  | 'great_expectations'
  | 'delta_lake'
  | 'kafka'
  | 'aws_glue'
  | 'azure_data_factory'
  | 'databricks';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  fixedCode: string;
  appliedFixes: string[];
}

export interface ValidationIssue {
  line: number;
  column: number;
  ruleId: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion: string;
  autoFixed: boolean;
}

// ============================================================
// VALIDATION RULES DATABASE
// ============================================================

export const PYSPARK_RULES: ValidationRule[] = [
  {
    id: 'pyspark-with-vs-withColumn',
    framework: 'pyspark',
    errorPattern: /\.with\(\s*["']/g,
    correctPattern: '.withColumn("col_name", expression)',
    explanation: 'PySpark DataFrames use .withColumn() to add/replace columns, not .with(). The .with() method does not exist on DataFrame.',
    severity: 'error',
    fix: (code: string) => code.replace(/\.with\(\s*["'](\w+)["']\s*,/g, '.withColumn("$1",'),
  },
  {
    id: 'pyspark-col-string-in-expression',
    framework: 'pyspark',
    errorPattern: /\.(filter|where)\(\s*["'][^"']*["']\s*[><=!]/g,
    correctPattern: '.filter(col("column_name") > value)',
    explanation: 'PySpark filter/where requires Column expressions, not raw strings with operators. Use col("name") > value or F.col("name") > value.',
    severity: 'error',
    fix: (code: string) => code.replace(
      /\.(filter|where)\(\s*["'](\w+)["']\s*([><=!]+)\s*(\w+)\s*\)/g,
      '.$1(col("$2") $3 $4)'
    ),
  },
  {
    id: 'pyspark-select-string-expression',
    framework: 'pyspark',
    errorPattern: /\.select\(\s*["'][^"']*["']\s*\+/g,
    correctPattern: '.select(col("a"), col("b")) or .selectExpr("a + b as c")',
    explanation: 'For expressions in select(), use .selectExpr() for SQL-style expressions or col() + operations for programmatic style.',
    severity: 'warning',
    fix: (code: string) => code,
  },
  {
    id: 'pyspark-groupby-agg-syntax',
    framework: 'pyspark',
    errorPattern: /\.groupBy\([^)]+\)\.(\w+)\(\s*["']/g,
    correctPattern: '.groupBy("col").agg(count("*"), sum("amount"))',
    explanation: 'After groupBy(), use .agg() with aggregate functions for multiple aggregations. Single aggregations like .count() are fine but .sum("col") should be .agg(sum("col")).',
    severity: 'warning',
    fix: (code: string) => code,
  },
  {
    id: 'pyspark-writeStream-format',
    framework: 'pyspark',
    errorPattern: /\.writeStream\s*\.\s*format\(\s*["']delta_lake["']\s*\)/g,
    correctPattern: '.writeStream.format("delta")',
    explanation: 'The Delta Lake format in Spark is "delta", not "delta_lake". The format name must match the registered DataSource.',
    severity: 'error',
    fix: (code: string) => code.replace(/format\(\s*["']delta_lake["']\s*\)/g, 'format("delta")'),
  },
  {
    id: 'pyspark-readStream-kafka-subscribe',
    framework: 'pyspark',
    errorPattern: /\.readStream[^]*?\.option\(\s*["']topic["']/g,
    correctPattern: '.option("subscribe", "topic_name")',
    explanation: 'Kafka source uses "subscribe" option (not "topic") to specify which topics to read from.',
    severity: 'error',
    fix: (code: string) => code.replace(/\.option\(\s*["']topic["']/g, '.option("subscribe"'),
  },
  {
    id: 'pyspark-window-import',
    framework: 'pyspark',
    errorPattern: /from pyspark\.sql\.functions import.*window/,
    correctPattern: 'from pyspark.sql.functions import window (correct! but ensure lowercase)',
    explanation: 'The window function is correctly imported from pyspark.sql.functions. Ensure you use lowercase "window" not "Window" (Window is for window specs, not time windows).',
    severity: 'info',
    fix: (code: string) => code,
  },
  {
    id: 'pyspark-missing-spark-import',
    framework: 'pyspark',
    errorPattern: /^(?!.*from pyspark).*SparkSession/m,
    correctPattern: 'from pyspark.sql import SparkSession',
    explanation: 'SparkSession must be imported before use. Always include: from pyspark.sql import SparkSession',
    severity: 'error',
    fix: (code: string) => {
      if (!code.includes('from pyspark.sql import SparkSession')) {
        return 'from pyspark.sql import SparkSession\n' + code;
      }
      return code;
    },
  },
  {
    id: 'pyspark-deprecated-toPandas',
    framework: 'pyspark',
    errorPattern: /\.toPandas\(\)/g,
    correctPattern: '.toPandas() — WARNING: collects all data to driver. Use only for small datasets.',
    explanation: '.toPandas() pulls ALL data to the driver node. For large datasets this will cause OOM errors. Consider using .limit() first or processing in Spark.',
    severity: 'warning',
    fix: (code: string) => code,
  },
  {
    id: 'pyspark-repartition-before-write',
    framework: 'pyspark',
    errorPattern: /\.write\.(parquet|delta|csv)\([^)]*\)(?![\s\S]*\.repartition)/g,
    correctPattern: '.repartition(n).write.parquet("path") — consider partition count for file sizing',
    explanation: 'Writing without repartitioning may produce too many small files (bad for reads) or too few large files (bad for parallelism). Consider the target file size (~128MB for Parquet).',
    severity: 'info',
    fix: (code: string) => code,
  },
];

export const PANDAS_RULES: ValidationRule[] = [
  {
    id: 'pandas-append-deprecated',
    framework: 'pandas',
    errorPattern: /\.append\(/g,
    correctPattern: 'pd.concat([df1, df2]) — .append() was removed in pandas 2.0',
    explanation: 'DataFrame.append() was deprecated in pandas 1.4 and removed in 2.0. Use pd.concat([df1, df2]) instead.',
    severity: 'error',
    fix: (code: string) => code,
  },
  {
    id: 'pandas-inplace-anti-pattern',
    framework: 'pandas',
    errorPattern: /\.\w+\([^)]*inplace\s*=\s*True[^)]*\)/g,
    correctPattern: 'df = df.operation() — inplace=True is an anti-pattern and may be deprecated',
    explanation: 'inplace=True is considered an anti-pattern in modern pandas. It breaks method chaining, makes code harder to debug, and may not actually save memory. Assign back instead.',
    severity: 'warning',
    fix: (code: string) => code,
  },
  {
    id: 'pandas-iterrows-performance',
    framework: 'pandas',
    errorPattern: /\.iterrows\(\)/g,
    correctPattern: '.apply(func, axis=1) or vectorized operations — iterrows is extremely slow',
    explanation: 'iterrows() is 100-1000x slower than vectorized operations. Use .apply(), .map(), or numpy vectorization for row-wise operations.',
    severity: 'warning',
    fix: (code: string) => code,
  },
];

export const AIRFLOW_RULES: ValidationRule[] = [
  {
    id: 'airflow-dag-no-start-date',
    framework: 'airflow',
    errorPattern: /DAG\([^)]*\)(?![^)]*start_date)/s,
    correctPattern: 'DAG("id", start_date=datetime(2024, 1, 1), ...)',
    explanation: 'Every DAG must have a start_date. Without it, the scheduler cannot determine when to start running the DAG.',
    severity: 'error',
    fix: (code: string) => code,
  },
  {
    id: 'airflow-dag-dynamic-start-date',
    framework: 'airflow',
    errorPattern: /start_date\s*=\s*datetime\.now\(\)/g,
    correctPattern: 'start_date=datetime(2024, 1, 1) — never use dynamic dates',
    explanation: 'Never use datetime.now() as start_date. It creates a moving target that confuses the scheduler and prevents backfills. Use a fixed past date.',
    severity: 'error',
    fix: (code: string) => code.replace(/start_date\s*=\s*datetime\.now\(\)/g, 'start_date=datetime(2024, 1, 1)'),
  },
  {
    id: 'airflow-import-days-ago',
    framework: 'airflow',
    errorPattern: /from airflow\.utils\.dates import days_ago/g,
    correctPattern: 'from datetime import datetime, timedelta — days_ago is deprecated',
    explanation: 'airflow.utils.dates.days_ago is deprecated. Use datetime directly: start_date=datetime(2024, 1, 1) for a fixed date.',
    severity: 'warning',
    fix: (code: string) => code,
  },
];

export const SNOWFLAKE_SQL_RULES: ValidationRule[] = [
  {
    id: 'snowflake-no-cluster-key-on-large-table',
    framework: 'snowflake_sql',
    errorPattern: /CREATE\s+(OR\s+REPLACE\s+)?TABLE\s+\w+[^;]*(?!CLUSTER\s+BY)/is,
    correctPattern: 'CREATE TABLE ... CLUSTER BY (date_col) — for tables > 1TB',
    explanation: 'For large tables (>1TB), consider adding CLUSTER BY on commonly filtered columns to improve query performance through micro-partition pruning.',
    severity: 'info',
    fix: (code: string) => code,
  },
  {
    id: 'snowflake-select-star',
    framework: 'snowflake_sql',
    errorPattern: /SELECT\s+\*\s+FROM/gi,
    correctPattern: 'SELECT col1, col2 FROM — explicit columns for production queries',
    explanation: 'SELECT * in production queries is an anti-pattern. It fetches unnecessary data, breaks when schema changes, and makes lineage tracking harder.',
    severity: 'warning',
    fix: (code: string) => code,
  },
];

export const DBT_RULES: ValidationRule[] = [
  {
    id: 'dbt-missing-unique-test',
    framework: 'dbt_sql',
    errorPattern: /primary_key|unique_key/i,
    correctPattern: 'Add unique + not_null tests on primary/unique key columns',
    explanation: 'Any column declared as a primary or unique key should have corresponding dbt tests (unique, not_null) in schema.yml to enforce the constraint.',
    severity: 'warning',
    fix: (code: string) => code,
  },
  {
    id: 'dbt-hardcoded-schema',
    framework: 'dbt_sql',
    errorPattern: /FROM\s+['"]?\w+['"]?\.['"]?\w+['"]?\.\w+/gi,
    correctPattern: "FROM {{ source('source_name', 'table') }} or {{ ref('model') }}",
    explanation: 'Never hardcode database/schema names in dbt models. Use {{ ref() }} for models and {{ source() }} for raw tables. This enables environment portability.',
    severity: 'error',
    fix: (code: string) => code,
  },
];

export const TERRAFORM_RULES: ValidationRule[] = [
  {
    id: 'terraform-hardcoded-credentials',
    framework: 'terraform',
    errorPattern: /(access_key|secret_key|password|token)\s*=\s*"[^"]+"/gi,
    correctPattern: 'Use variable references or secrets manager: var.access_key',
    explanation: 'NEVER hardcode credentials in Terraform. Use variables, environment variables, or a secrets manager (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault).',
    severity: 'error',
    fix: (code: string) => code.replace(
      /(access_key|secret_key|password|token)\s*=\s*"[^"]+"/gi,
      '$1 = var.$1  # TODO: Move to secrets manager'
    ),
  },
  {
    id: 'terraform-no-state-backend',
    framework: 'terraform',
    errorPattern: /^(?![\s\S]*backend\s+)/m,
    correctPattern: 'terraform { backend "s3" { ... } } — always use remote state',
    explanation: 'Production Terraform MUST use remote state (S3, GCS, Azure Blob). Local state is lost if the machine is wiped and causes conflicts in teams.',
    severity: 'warning',
    fix: (code: string) => code,
  },
];

// ============================================================
// THE VALIDATOR ENGINE
// ============================================================

export class CodeAccuracyValidator {
  private rules: Map<CodeFramework, ValidationRule[]> = new Map();

  constructor() {
    this.rules.set('pyspark', PYSPARK_RULES);
    this.rules.set('pandas', PANDAS_RULES);
    this.rules.set('airflow', AIRFLOW_RULES);
    this.rules.set('snowflake_sql', SNOWFLAKE_SQL_RULES);
    this.rules.set('dbt_sql', DBT_RULES);
    this.rules.set('terraform', TERRAFORM_RULES);
  }

  /**
   * Detect which framework(s) a code snippet uses
   */
  detectFrameworks(code: string): CodeFramework[] {
    const frameworks: CodeFramework[] = [];

    if (/pyspark|SparkSession|from pyspark/i.test(code)) frameworks.push('pyspark');
    if (/import pandas|pd\.|DataFrame\(\{/i.test(code)) frameworks.push('pandas');
    if (/from airflow|DAG\(|@dag|@task/i.test(code)) frameworks.push('airflow');
    if (/SNOWFLAKE|WAREHOUSE|CREATE\s+(OR\s+REPLACE\s+)?STAGE/i.test(code)) frameworks.push('snowflake_sql');
    if (/\{\{\s*(ref|source|config)\s*\(/i.test(code)) frameworks.push('dbt_sql');
    if (/resource\s+"(aws|azurerm|google)_|terraform\s*\{/i.test(code)) frameworks.push('terraform');
    if (/DeltaTable|delta\.tables/i.test(code)) frameworks.push('delta_lake');
    if (/KafkaProducer|KafkaConsumer|confluent_kafka/i.test(code)) frameworks.push('kafka');
    if (/from awsglue|GlueContext/i.test(code)) frameworks.push('aws_glue');

    return frameworks.length > 0 ? frameworks : ['pyspark']; // default
  }

  /**
   * Validate a code snippet and auto-fix issues
   */
  validate(code: string, framework?: CodeFramework): ValidationResult {
    const frameworks = framework ? [framework] : this.detectFrameworks(code);
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const appliedFixes: string[] = [];
    let fixedCode = code;

    for (const fw of frameworks) {
      const fwRules = this.rules.get(fw) || [];

      for (const rule of fwRules) {
        const matches = code.match(rule.errorPattern);
        if (matches) {
          const issue: ValidationIssue = {
            line: this.findLineNumber(code, matches[0]),
            column: 0,
            ruleId: rule.id,
            message: rule.explanation,
            severity: rule.severity,
            suggestion: rule.correctPattern,
            autoFixed: false,
          };

          if (rule.severity === 'error') {
            // Auto-fix errors
            const beforeFix = fixedCode;
            fixedCode = rule.fix(fixedCode);
            if (fixedCode !== beforeFix) {
              issue.autoFixed = true;
              appliedFixes.push(`[${rule.id}] ${rule.explanation}`);
            }
            errors.push(issue);
          } else {
            warnings.push(issue);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fixedCode,
      appliedFixes,
    };
  }

  /**
   * Validate and fix code, returning the corrected version with inline comments
   */
  validateAndAnnotate(code: string, framework?: CodeFramework): string {
    const result = this.validate(code, framework);

    if (result.isValid && result.warnings.length === 0) {
      return result.fixedCode;
    }

    // Add warning comments to the code
    let annotated = result.fixedCode;
    for (const warning of result.warnings) {
      // Add a comment near the issue
      const lines = annotated.split('\n');
      if (warning.line > 0 && warning.line <= lines.length) {
        lines[warning.line - 1] += `  # ⚠️ ${warning.suggestion}`;
      }
      annotated = lines.join('\n');
    }

    return annotated;
  }

  private findLineNumber(code: string, match: string): number {
    const index = code.indexOf(match);
    if (index === -1) return 0;
    return code.substring(0, index).split('\n').length;
  }
}

/**
 * Syntax correction maps for common typos in generated code
 */
export const COMMON_TYPO_FIXES: Record<string, string> = {
  // PySpark
  '.with(': '.withColumn(',
  '.withColum(': '.withColumn(',
  '.withColumnRenamed(': '.withColumnRenamed(',
  '.groupby(': '.groupBy(',
  '.orderby(': '.orderBy(',
  '.dropDuplicate(': '.dropDuplicates(',
  '.isNotNull': '.isNotNull()',
  '.isNull': '.isNull()',
  'from pyspark.sql.function import': 'from pyspark.sql.functions import',
  
  // Pandas
  '.to_csv': '.to_csv(',
  '.read_CSV': '.read_csv(',
  '.drop_duplcates': '.drop_duplicates',
  '.group_by(': '.groupby(',
  
  // SQL
  'CREAT TABLE': 'CREATE TABLE',
  'INSER INTO': 'INSERT INTO',
  'SELCT ': 'SELECT ',
  'FORM ': 'FROM ',
  'WEHRE': 'WHERE',
  
  // Airflow
  'PythonOPerator': 'PythonOperator',
  'BashOPerator': 'BashOperator',
  
  // General
  'retrun': 'return',
  'pritn(': 'print(',
  'improt': 'import',
};

/**
 * Apply common typo fixes to generated code
 */
export function fixCommonTypos(code: string): string {
  let fixed = code;
  for (const [typo, correction] of Object.entries(COMMON_TYPO_FIXES)) {
    fixed = fixed.split(typo).join(correction);
  }
  return fixed;
}
