/**
 * Databricks Compiler (Requirement 2)
 * 
 * Takes a validated Pipeline IR and emits PySpark + Delta Lake code.
 * Uses ONLY Databricks/Azure-native SDK: pyspark, delta, dbutils.
 * 
 * NO boto3. NO awsglue. NO google.cloud.
 * Uses abfss:// paths (not s3://).
 * Auth via dbutils.secrets (not env vars or hardcoded).
 */

'use strict';

function compile(ir) {
  const { name, source, bronze, silver, gold, properties, schedule } = ir;
  const storageAccount = '{{ storage_account }}';

  const code = `"""
Pipeline: ${name}
Platform: Databricks + Azure Data Lake (Delta Lake)
Generated from IR: ${new Date().toISOString()}
Incremental: ${properties.incremental}
Idempotent: ${properties.idempotent}
"""

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, current_timestamp, lit, row_number
from pyspark.sql.functions import sum as _sum, count, avg, max as _max
from pyspark.sql.window import Window
from delta.tables import DeltaTable
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("${name}")

spark = SparkSession.builder.appName("${name}").getOrCreate()

# ─── Configuration ───────────────────────────────────────────
STORAGE_ACCOUNT = "${storageAccount}"
BRONZE_PATH = f"abfss://bronze@{STORAGE_ACCOUNT}.dfs.core.windows.net/${name}/"
SILVER_PATH = f"abfss://silver@{STORAGE_ACCOUNT}.dfs.core.windows.net/${name}/"
GOLD_PATH = f"abfss://gold@{STORAGE_ACCOUNT}.dfs.core.windows.net/${gold.output_name || name + '_daily'}/"

# Auth via Databricks secrets (NO hardcoded credentials)
DB_USER = dbutils.secrets.get(scope="pipeline-secrets", key="${name}_db_user")
DB_PASSWORD = dbutils.secrets.get(scope="pipeline-secrets", key="${name}_db_password")
JDBC_URL = "jdbc:${source.type === 'postgres' ? 'postgresql' : source.type}://{{ host }}:5432/{{ database }}"

# ─── BRONZE: Extract from ${source.type} → Delta ────────────
logger.info("Starting Bronze layer extraction")

${properties.incremental ? generateDatabricksIncremental(ir) : generateDatabricksFull(ir)}

bronze_df = (
    raw_df
    .withColumn("_ingested_at", current_timestamp())
    .withColumn("_source", lit("${source.table}"))
)

bronze_df.write.format("delta").mode("append").save(BRONZE_PATH)
logger.info(f"Bronze: {bronze_df.count()} rows written")

# ─── SILVER: Dedup + Clean → Delta MERGE ────────────────────
logger.info("Starting Silver layer")

bronze_df = spark.read.format("delta").load(BRONZE_PATH)

# Deduplicate: keep latest per ${silver.dedup_keys.join(', ')}
window = Window.partitionBy(${silver.dedup_keys.map(k => `"${k}"`).join(', ')}).orderBy(col("_ingested_at").desc())
silver_df = (
    bronze_df
    .withColumn("_rn", row_number().over(window))
    .filter(col("_rn") == 1)
    .drop("_rn")
    .filter(${silver.dedup_keys.map(k => `col("${k}").isNotNull()`).join(' & ')})
)

# MERGE for idempotent upsert
if DeltaTable.isDeltaTable(spark, SILVER_PATH):
    silver_table = DeltaTable.forPath(spark, SILVER_PATH)
    (
        silver_table.alias("target")
        .merge(
            silver_df.alias("source"),
            ${silver.dedup_keys.map(k => `"target.${k} = source.${k}"`).join(' AND ')}
        )
        .whenMatchedUpdateAll()
        .whenNotMatchedInsertAll()
        .execute()
    )
else:
    silver_df.write.format("delta").mode("overwrite").save(SILVER_PATH)

logger.info(f"Silver: {silver_df.count()} rows merged")

# ─── GOLD: Aggregate ────────────────────────────────────────
logger.info("Starting Gold layer")

silver_df = spark.read.format("delta").load(SILVER_PATH)

gold_df = (
    silver_df
    .groupBy(${gold.group_by.map(g => `"${g}"`).join(', ')})
    .agg(
${gold.aggregations.map(a => `        ${a.fn === 'count' ? 'count("*")' : a.fn === 'sum' ? `_sum("${a.column}")` : a.fn === 'avg' ? `avg("${a.column}")` : `_max("${a.column}")`}.alias("${a.alias}")`).join(',\n')}
    )
)

gold_df.write.format("delta").mode("overwrite").save(GOLD_PATH)
logger.info(f"Gold: {gold_df.count()} rows written")
logger.info("Pipeline ${name} complete")
`;

  return {
    code,
    files: [
      { path: `notebooks/${name}_bronze.py`, content: code.split('# ─── SILVER')[0], type: 'notebook' },
      { path: `notebooks/${name}_full.py`, content: code, type: 'notebook' },
    ],
    engine: 'databricks',
    platform: 'databricks',
    ir_satisfied: {
      incremental: properties.incremental,
      idempotent: properties.idempotent,
    },
  };
}

function generateDatabricksIncremental(ir) {
  return `# Incremental: only rows after last watermark
if DeltaTable.isDeltaTable(spark, SILVER_PATH):
    last_watermark = spark.read.format("delta").load(SILVER_PATH) \\
        .agg({"${ir.source.watermark_column}": "max"}).collect()[0][0] or "1970-01-01"
else:
    last_watermark = "1970-01-01"

raw_df = (
    spark.read.format("jdbc")
    .option("url", JDBC_URL)
    .option("user", DB_USER)
    .option("password", DB_PASSWORD)
    .option("dbtable", f"(SELECT * FROM ${ir.source.table} WHERE ${ir.source.watermark_column} > '{last_watermark}') AS inc")
    .load()
)
logger.info(f"Incremental extract: watermark={last_watermark}")`;
}

function generateDatabricksFull(ir) {
  return `raw_df = (
    spark.read.format("jdbc")
    .option("url", JDBC_URL)
    .option("user", DB_USER)
    .option("password", DB_PASSWORD)
    .option("dbtable", "${ir.source.table}")
    .load()
)
logger.info("Full extract from ${ir.source.table}")`;
}

function canSatisfy(ir) {
  const unsupported = [];
  if (ir.properties.incremental && !ir.source.watermark_column) {
    unsupported.push('incremental requires watermark_column');
  }
  return { can_satisfy: unsupported.length === 0, unsupported };
}

module.exports = { compile, canSatisfy };
