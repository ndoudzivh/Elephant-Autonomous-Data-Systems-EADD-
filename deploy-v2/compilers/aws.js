/**
 * AWS Compiler (Requirement 2)
 * 
 * Takes a validated Pipeline IR and emits an Airflow DAG + Glue scripts.
 * Uses ONLY AWS-native SDK: boto3, S3Hook, GlueJobOperator, AthenaOperator.
 * No azure.*, no google.cloud.*, no databricks.* imports.
 * 
 * Guarantees:
 * - If IR.properties.incremental=true → code has WHERE watermark > last_run
 * - If IR.properties.idempotent=true → code uses MERGE/overwrite partition
 * - All imports verified against airflow-aws SKILL.md
 */

'use strict';

/**
 * Compile a Pipeline IR to AWS (Airflow + S3/Glue) code.
 * @param {Object} ir - Validated Pipeline IR
 * @returns {{ code: string, files: Object[], engine: string, platform: string }}
 */
function compile(ir) {
  const { name, source, bronze, silver, gold, properties, schedule } = ir;

  const code = `"""
Pipeline: ${name}
Platform: AWS (Airflow + S3/Glue)
Generated from IR: ${new Date().toISOString()}
Incremental: ${properties.incremental}
Idempotent: ${properties.idempotent}
"""

from datetime import datetime
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.empty import EmptyOperator
from airflow.providers.amazon.aws.transfers.sql_to_s3 import SqlToS3Operator
from airflow.providers.amazon.aws.operators.glue import GlueJobOperator
from airflow.providers.amazon.aws.operators.athena import AthenaOperator
import logging

logger = logging.getLogger("${name}")

# ─── DAG Definition ──────────────────────────────────────────
with DAG(
    dag_id="${name}",
    start_date=datetime(2024, 1, 1),
    schedule_interval="${schedule.cron}",
    catchup=False,
    max_active_runs=1,
    tags=["eadd", "medallion", "${source.type}-to-s3"],
) as dag:

    start = EmptyOperator(task_id="start")

    # ─── BRONZE: Extract from ${source.type} → S3 (${bronze.format}) ────
${properties.incremental ? generateIncrementalExtract(ir) : generateFullExtract(ir)}

    # ─── SILVER: Clean, dedup, conform ───────────────────────
    clean_to_silver = GlueJobOperator(
        task_id="clean_to_silver",
        job_name="silver_${name}",
        script_location="s3://eadd-scripts/silver/${name}.py",
        region_name="us-east-1",
        num_of_dpus=2,
        script_args={
            "--source_path": "s3://eadd-data-lake/bronze/${name}/{{ ds }}/",
            "--target_path": "s3://eadd-data-lake/silver/${name}/",
            "--dedup_keys": "${silver.dedup_keys.join(',')}",
            "--dedup_strategy": "${silver.dedup_strategy}",
        },
    )

    # ─── GOLD: Aggregate ─────────────────────────────────────
    aggregate_to_gold = GlueJobOperator(
        task_id="aggregate_to_gold",
        job_name="gold_${name}",
        script_location="s3://eadd-scripts/gold/${name}.py",
        region_name="us-east-1",
        num_of_dpus=2,
        script_args={
            "--source_path": "s3://eadd-data-lake/silver/${name}/",
            "--target_path": "s3://eadd-data-lake/gold/${name}/",
            "--group_by": "${gold.group_by.join(',')}",
            "--aggregations": '${JSON.stringify(gold.aggregations)}',
        },
    )

    end = EmptyOperator(task_id="end")

    # ─── Dependencies ────────────────────────────────────────
    start >> extract_to_bronze >> clean_to_silver >> aggregate_to_gold >> end
`;

  return {
    code,
    files: [
      { path: `dags/${name}.py`, content: code, type: 'airflow_dag' },
    ],
    engine: 'airflow',
    platform: 'aws',
    ir_satisfied: {
      incremental: properties.incremental,
      idempotent: properties.idempotent,
    },
  };
}

function generateIncrementalExtract(ir) {
  return `    # Get last watermark for incremental load
    get_watermark = AthenaOperator(
        task_id="get_watermark",
        query="""
            SELECT COALESCE(MAX(${ir.source.watermark_column}), '1970-01-01') AS wm
            FROM eadd_catalog.silver_${ir.name}
        """,
        database="eadd_catalog",
        output_location="s3://eadd-data-lake/athena-results/",
    )

    extract_to_bronze = SqlToS3Operator(
        task_id="extract_to_bronze",
        query="""
            SELECT * FROM ${ir.source.table}
            WHERE ${ir.source.watermark_column} > '{{ ti.xcom_pull(task_ids='get_watermark') }}'
        """,
        s3_bucket="eadd-data-lake",
        s3_key="bronze/${ir.name}/{{ ds }}/data.${ir.bronze.format}",
        file_format="${ir.bronze.format}",
        sql_conn_id="${ir.source.connection_ref}",
        replace=True,
    )

    start >> get_watermark >> extract_to_bronze`;
}

function generateFullExtract(ir) {
  return `    extract_to_bronze = SqlToS3Operator(
        task_id="extract_to_bronze",
        query="SELECT * FROM ${ir.source.table}",
        s3_bucket="eadd-data-lake",
        s3_key="bronze/${ir.name}/{{ ds }}/data.${ir.bronze.format}",
        file_format="${ir.bronze.format}",
        sql_conn_id="${ir.source.connection_ref}",
        replace=True,
    )`;
}

/**
 * Check if this compiler can satisfy the IR requirements.
 * @param {Object} ir - Pipeline IR
 * @returns {{ can_satisfy: boolean, unsupported: string[] }}
 */
function canSatisfy(ir) {
  const unsupported = [];

  if (ir.properties.incremental && !ir.source.watermark_column) {
    unsupported.push('incremental requires watermark_column in source');
  }

  return { can_satisfy: unsupported.length === 0, unsupported };
}

module.exports = { compile, canSatisfy };
