/**
 * EADD Code Generation Engine
 * 
 * Generates EXECUTABLE code — not explanations.
 * Output is ALWAYS structured JSON with:
 * { pipeline_name, code, inputs, outputs, engine, validated }
 * 
 * Supported engines: pyspark, sql, dbt, glue, python
 */

'use strict';

// ============================================================
// OUTPUT SCHEMA — Every generated pipeline MUST match this
// ============================================================

/**
 * @typedef {Object} PipelineOutput
 * @property {string} pipeline_name - snake_case pipeline identifier
 * @property {string} code - Complete executable code
 * @property {string[]} inputs - Input paths/tables
 * @property {string[]} outputs - Output paths/tables
 * @property {'pyspark'|'sql'|'dbt'|'glue'|'python'} engine
 * @property {boolean} validated - Whether code passed validation
 * @property {Object} metadata - Additional pipeline metadata
 */

// ============================================================
// CODE TEMPLATES — Production-ready, parameterized
// ============================================================

const TEMPLATES = {
  pyspark_batch: generatePySparkBatch,
  pyspark_streaming: generatePySparkStreaming,
  glue_etl: generateGlueETL,
  sql_transform: generateSQLTransform,
  dbt_model: generateDBTModel,
  python_extract: generatePythonExtract,
};

function generatePySparkBatch(params) {
  const {
    pipeline_name,
    source_path,
    target_path,
    source_format = 'parquet',
    target_format = 'delta',
    transformations = [],
    partition_by = [],
    schema_columns = [],
  } = params;

  const schemaBlock = schema_columns.length > 0
    ? `\nschema = StructType([\n${schema_columns.map(c => `    StructField("${c.name}", ${mapType(c.type)}, ${c.nullable !== false}),`).join('\n')}\n])\n`
    : '';

  const transformBlock = transformations.map(t => {
    switch (t.type) {
      case 'filter':
        return `    .filter(col("${t.column}") ${t.operator} ${JSON.stringify(t.value)})`;
      case 'rename':
        return `    .withColumnRenamed("${t.from}", "${t.to}")`;
      case 'cast':
        return `    .withColumn("${t.column}", col("${t.column}").cast("${t.target_type}"))`;
      case 'drop_nulls':
        return `    .dropna(subset=[${t.columns.map(c => `"${c}"`).join(', ')}])`;
      case 'dedup':
        return `    .dropDuplicates([${t.columns.map(c => `"${c}"`).join(', ')}])`;
      case 'add_column':
        return `    .withColumn("${t.name}", ${t.expression})`;
      default:
        return `    # Unknown transform: ${t.type}`;
    }
  }).join('\n');

  const partitionClause = partition_by.length > 0
    ? `.partitionBy(${partition_by.map(p => `"${p}"`).join(', ')})`
    : '';

  const code = `"""
Pipeline: ${pipeline_name}
Engine: PySpark (Batch)
Generated: ${new Date().toISOString()}
"""

import sys
import logging
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, current_timestamp, lit, when, coalesce
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, DoubleType, TimestampType, BooleanType, LongType, DecimalType

# ─── Logging Setup ───────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("${pipeline_name}")

# ─── Spark Session ───────────────────────────────────────────
spark = SparkSession.builder \\
    .appName("${pipeline_name}") \\
    .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension") \\
    .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog") \\
    .getOrCreate()

logger.info("Starting pipeline: ${pipeline_name}")
${schemaBlock}
try:
    # ─── READ ────────────────────────────────────────────────
    logger.info(f"Reading from: ${source_path}")
    df = spark.read \\
        .format("${source_format}") \\
        ${schemaBlock ? '.schema(schema) \\' : ''}
        .load("${source_path}")

    input_count = df.count()
    logger.info(f"Input rows: {input_count}")

    # ─── TRANSFORM ───────────────────────────────────────────
    df_transformed = (
        df
        .withColumn("_pipeline_name", lit("${pipeline_name}"))
        .withColumn("_processed_at", current_timestamp())
${transformBlock || '        # No additional transforms specified'}
    )

    # ─── WRITE ───────────────────────────────────────────────
    logger.info(f"Writing to: ${target_path}")
    (
        df_transformed.write
        .format("${target_format}")
        .mode("append")
        ${partitionClause}
        .save("${target_path}")
    )

    output_count = df_transformed.count()
    logger.info(f"Output rows: {output_count}")
    logger.info(f"Pipeline ${pipeline_name} completed successfully")

except Exception as e:
    logger.error(f"Pipeline ${pipeline_name} FAILED: {str(e)}")
    sys.exit(1)
finally:
    spark.stop()
`;

  return {
    pipeline_name,
    code,
    inputs: [source_path],
    outputs: [target_path],
    engine: 'pyspark',
    validated: false,
    metadata: {
      source_format,
      target_format,
      partition_by,
      transform_count: transformations.length,
      generated_at: new Date().toISOString(),
    },
  };
}

function generatePySparkStreaming(params) {
  const {
    pipeline_name,
    source_topic,
    target_path,
    checkpoint_path,
    watermark_column = 'event_time',
    watermark_delay = '10 minutes',
    trigger_interval = '1 minute',
  } = params;

  const code = `"""
Pipeline: ${pipeline_name}
Engine: PySpark Structured Streaming
Generated: ${new Date().toISOString()}
"""

import sys
import logging
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, from_json, current_timestamp, window
from pyspark.sql.types import StructType, StructField, StringType, TimestampType

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("${pipeline_name}")

spark = SparkSession.builder \\
    .appName("${pipeline_name}_streaming") \\
    .getOrCreate()

logger.info("Starting streaming pipeline: ${pipeline_name}")

try:
    # ─── READ STREAM (Kafka) ─────────────────────────────────
    raw_stream = (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", "KAFKA_BROKER_PLACEHOLDER")
        .option("subscribe", "${source_topic}")
        .option("startingOffsets", "latest")
        .option("failOnDataLoss", "false")
        .load()
    )

    # ─── PARSE ───────────────────────────────────────────────
    parsed = (
        raw_stream
        .selectExpr("CAST(key AS STRING)", "CAST(value AS STRING)", "timestamp")
        .withColumn("_ingested_at", current_timestamp())
    )

    # ─── WATERMARK (state cleanup) ──────────────────────────
    watermarked = parsed.withWatermark("${watermark_column}", "${watermark_delay}")

    # ─── WRITE STREAM ────────────────────────────────────────
    query = (
        watermarked.writeStream
        .format("delta")
        .outputMode("append")
        .option("checkpointLocation", "${checkpoint_path}")
        .trigger(processingTime="${trigger_interval}")
        .start("${target_path}")
    )

    logger.info("Streaming query started. Awaiting termination...")
    query.awaitTermination()

except Exception as e:
    logger.error(f"Streaming pipeline FAILED: {str(e)}")
    sys.exit(1)
`;

  return {
    pipeline_name,
    code,
    inputs: [`kafka://${source_topic}`],
    outputs: [target_path],
    engine: 'pyspark',
    validated: false,
    metadata: {
      type: 'streaming',
      watermark_delay,
      trigger_interval,
      checkpoint_path,
      generated_at: new Date().toISOString(),
    },
  };
}

function generateGlueETL(params) {
  const {
    pipeline_name,
    source_database,
    source_table,
    target_path,
    target_format = 'parquet',
    job_bookmark = true,
  } = params;

  const code = `"""
Pipeline: ${pipeline_name}
Engine: AWS Glue ETL
Generated: ${new Date().toISOString()}
"""

import sys
import logging
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from awsglue.context import GlueContext
from awsglue.job import Job
from pyspark.context import SparkContext
from pyspark.sql.functions import current_timestamp, lit

# ─── Setup ───────────────────────────────────────────────────
args = getResolvedOptions(sys.argv, ['JOB_NAME'])
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)

logger = logging.getLogger(args['JOB_NAME'])
logger.setLevel(logging.INFO)
logger.info(f"Starting Glue job: {args['JOB_NAME']}")

try:
    # ─── READ (from Glue Catalog) ────────────────────────────
    datasource = glueContext.create_dynamic_frame.from_catalog(
        database="${source_database}",
        table_name="${source_table}",
        transformation_ctx="datasource"
    )
    logger.info(f"Read {datasource.count()} records from ${source_database}.${source_table}")

    # ─── TRANSFORM ───────────────────────────────────────────
    df = datasource.toDF()
    df_transformed = (
        df
        .withColumn("_pipeline", lit("${pipeline_name}"))
        .withColumn("_processed_at", current_timestamp())
    )

    # ─── WRITE ───────────────────────────────────────────────
    from awsglue.dynamicframe import DynamicFrame
    output_frame = DynamicFrame.fromDF(df_transformed, glueContext, "output")

    glueContext.write_dynamic_frame.from_options(
        frame=output_frame,
        connection_type="s3",
        connection_options={"path": "${target_path}"},
        format="${target_format}",
        transformation_ctx="output"
    )
    logger.info(f"Wrote {df_transformed.count()} records to ${target_path}")

except Exception as e:
    logger.error(f"Glue job FAILED: {str(e)}")
    raise
finally:
    job.commit()
    logger.info("Job committed successfully")
`;

  return {
    pipeline_name,
    code,
    inputs: [`glue://${source_database}/${source_table}`],
    outputs: [target_path],
    engine: 'glue',
    validated: false,
    metadata: {
      source_database,
      source_table,
      target_format,
      job_bookmark,
      generated_at: new Date().toISOString(),
    },
  };
}

function generateSQLTransform(params) {
  const {
    pipeline_name,
    source_table,
    target_table,
    columns = [],
    where_clause = '',
    group_by = [],
    aggregations = [],
  } = params;

  const selectCols = columns.length > 0
    ? columns.map(c => c.expression ? `${c.expression} AS ${c.alias || c.name}` : c.name).join(',\n    ')
    : '*';

  const whereBlock = where_clause ? `WHERE ${where_clause}` : '';
  const groupBlock = group_by.length > 0 ? `GROUP BY ${group_by.join(', ')}` : '';

  const code = `-- Pipeline: ${pipeline_name}
-- Engine: SQL Transform
-- Generated: ${new Date().toISOString()}

-- Target: ${target_table}
CREATE TABLE IF NOT EXISTS ${target_table} AS
SELECT
    ${selectCols},
    CURRENT_TIMESTAMP AS _processed_at
FROM ${source_table}
${whereBlock}
${groupBlock};

-- Row count verification
SELECT COUNT(*) AS row_count FROM ${target_table};
`;

  return {
    pipeline_name,
    code,
    inputs: [source_table],
    outputs: [target_table],
    engine: 'sql',
    validated: false,
    metadata: {
      has_where: !!where_clause,
      has_groupby: group_by.length > 0,
      column_count: columns.length,
      generated_at: new Date().toISOString(),
    },
  };
}

function generateDBTModel(params) {
  const {
    pipeline_name,
    source_ref,
    materialization = 'table',
    columns = [],
    tests = [],
  } = params;

  const selectCols = columns.length > 0
    ? columns.map(c => c.expression ? `${c.expression} AS ${c.alias || c.name}` : c.name).join(',\n    ')
    : '*';

  const code = `-- Pipeline: ${pipeline_name}
-- Engine: dbt model
-- Generated: ${new Date().toISOString()}

{{ config(
    materialized='${materialization}',
    tags=['generated', 'eadd']
) }}

WITH source AS (
    SELECT * FROM {{ ref('${source_ref}') }}
),

transformed AS (
    SELECT
        ${selectCols},
        CURRENT_TIMESTAMP() AS _processed_at
    FROM source
)

SELECT * FROM transformed
`;

  const schemaYml = `version: 2

models:
  - name: ${pipeline_name}
    description: "Auto-generated by EADD"
    columns:
${columns.map(c => `      - name: ${c.alias || c.name}
        tests:
          - not_null`).join('\n')}
`;

  return {
    pipeline_name,
    code,
    inputs: [source_ref],
    outputs: [pipeline_name],
    engine: 'dbt',
    validated: false,
    metadata: {
      materialization,
      schema_yml: schemaYml,
      test_count: tests.length,
      generated_at: new Date().toISOString(),
    },
  };
}

function generatePythonExtract(params) {
  const {
    pipeline_name,
    source_type = 'api',
    source_url = '',
    target_path,
    auth_type = 'bearer',
  } = params;

  const code = `"""
Pipeline: ${pipeline_name}
Engine: Python (Extract)
Generated: ${new Date().toISOString()}
"""

import json
import logging
import sys
from datetime import datetime

import boto3
import requests

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("${pipeline_name}")

# ─── Configuration ───────────────────────────────────────────
SOURCE_URL = "${source_url}"
TARGET_PATH = "${target_path}"
AUTH_TYPE = "${auth_type}"

def get_secret(secret_name):
    """Retrieve API credentials from AWS Secrets Manager."""
    client = boto3.client('secretsmanager', region_name='us-east-1')
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response['SecretString'])

def extract():
    """Extract data from source API."""
    logger.info(f"Extracting from: {SOURCE_URL}")

    headers = {}
    if AUTH_TYPE == 'bearer':
        creds = get_secret("${pipeline_name}/api-credentials")
        headers['Authorization'] = f"Bearer {creds['token']}"

    response = requests.get(SOURCE_URL, headers=headers, timeout=30)
    response.raise_for_status()

    data = response.json()
    logger.info(f"Extracted {len(data) if isinstance(data, list) else 1} records")
    return data

def load(data):
    """Load extracted data to S3."""
    s3 = boto3.client('s3')
    bucket = TARGET_PATH.split('/')[2]
    key = '/'.join(TARGET_PATH.split('/')[3:])

    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    full_key = f"{key}/{timestamp}.json"

    s3.put_object(
        Bucket=bucket,
        Key=full_key,
        Body=json.dumps(data, default=str),
        ContentType='application/json'
    )
    logger.info(f"Loaded to s3://{bucket}/{full_key}")

def main():
    try:
        data = extract()
        load(data)
        logger.info(f"Pipeline ${pipeline_name} completed successfully")
    except Exception as e:
        logger.error(f"Pipeline FAILED: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
`;

  return {
    pipeline_name,
    code,
    inputs: [source_url || `api://${source_type}`],
    outputs: [target_path],
    engine: 'python',
    validated: false,
    metadata: {
      source_type,
      auth_type,
      generated_at: new Date().toISOString(),
    },
  };
}

// ============================================================
// TYPE MAPPING
// ============================================================

function mapType(type) {
  const typeMap = {
    string: 'StringType()',
    int: 'IntegerType()',
    integer: 'IntegerType()',
    long: 'LongType()',
    double: 'DoubleType()',
    float: 'DoubleType()',
    decimal: 'DecimalType(18, 2)',
    boolean: 'BooleanType()',
    timestamp: 'TimestampType()',
    date: 'StringType()',  // Cast in transform
  };
  return typeMap[(type || 'string').toLowerCase()] || 'StringType()';
}

// ============================================================
// MAIN EXPORT — Generate pipeline code from request
// ============================================================

/**
 * Generate a pipeline from a structured request.
 * @param {Object} request - Pipeline generation request
 * @returns {PipelineOutput} - Structured pipeline output
 */
function generatePipeline(request) {
  const { engine, type, ...params } = request;

  // Determine which template to use
  const templateKey = resolveTemplate(engine, type);
  const generator = TEMPLATES[templateKey];

  if (!generator) {
    return {
      pipeline_name: params.pipeline_name || 'unknown',
      code: `# ERROR: Unsupported engine/type combination: ${engine}/${type}`,
      inputs: [],
      outputs: [],
      engine: engine || 'unknown',
      validated: false,
      metadata: { error: `No template for ${engine}/${type}` },
    };
  }

  return generator(params);
}

function resolveTemplate(engine, type) {
  if (engine === 'pyspark' && type === 'streaming') return 'pyspark_streaming';
  if (engine === 'pyspark') return 'pyspark_batch';
  if (engine === 'glue') return 'glue_etl';
  if (engine === 'sql') return 'sql_transform';
  if (engine === 'dbt') return 'dbt_model';
  if (engine === 'python') return 'python_extract';
  return 'pyspark_batch'; // default
}

module.exports = { generatePipeline, TEMPLATES };
