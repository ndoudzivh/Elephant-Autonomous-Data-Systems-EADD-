# Skill: Airflow + AWS (S3/Glue)

## Stack ID: airflow-aws
## Version: 1.0.0
## Last Verified: 2026-07-14

## Overview
Orchestrate Bronze/Silver/Gold data pipelines using Apache Airflow 2.x
with AWS services (S3, Glue, Athena). Uses `apache-airflow-providers-amazon`.

---

## Bronze: Read from source → write raw to S3

```python
from airflow.providers.amazon.aws.transfers.sql_to_s3 import SqlToS3Operator

extract_to_bronze = SqlToS3Operator(
    task_id="extract_to_bronze",
    query="SELECT * FROM {{ params.source_table }} WHERE updated_at > '{{ ds }}'",
    s3_bucket="{{ var.value.bronze_bucket }}",
    s3_key="bronze/{{ params.source_table }}/{{ ds }}/data.parquet",
    file_format="parquet",
    sql_conn_id="source_postgres",
    replace=True,
)
```

## Silver: Read Bronze → clean → write Silver

```python
from airflow.providers.amazon.aws.operators.glue import GlueJobOperator

clean_to_silver = GlueJobOperator(
    task_id="clean_to_silver",
    job_name="silver_{{ params.source_table }}",
    script_location="s3://{{ var.value.scripts_bucket }}/silver/clean.py",
    s3_bucket="{{ var.value.scripts_bucket }}",
    region_name="us-east-1",
    num_of_dpus=2,
    script_args={
        "--source_path": "s3://{{ var.value.bronze_bucket }}/bronze/{{ params.source_table }}/{{ ds }}/",
        "--target_path": "s3://{{ var.value.silver_bucket }}/silver/{{ params.source_table }}/",
        "--partition_date": "{{ ds }}",
    },
)
```

## Gold: Read Silver → aggregate → write Gold

```python
from airflow.providers.amazon.aws.operators.glue import GlueJobOperator

aggregate_to_gold = GlueJobOperator(
    task_id="aggregate_to_gold",
    job_name="gold_{{ params.source_table }}",
    script_location="s3://{{ var.value.scripts_bucket }}/gold/aggregate.py",
    s3_bucket="{{ var.value.scripts_bucket }}",
    region_name="us-east-1",
    num_of_dpus=2,
    script_args={
        "--source_path": "s3://{{ var.value.silver_bucket }}/silver/{{ params.source_table }}/",
        "--target_path": "s3://{{ var.value.gold_bucket }}/gold/{{ params.source_table }}/",
    },
)
```

## Incremental Load Pattern

```python
from airflow.providers.amazon.aws.operators.athena import AthenaOperator

get_watermark = AthenaOperator(
    task_id="get_watermark",
    query="""
        SELECT COALESCE(MAX(updated_at), '1970-01-01')
        FROM {{ params.target_db }}.{{ params.target_table }}
    """,
    database="{{ params.target_db }}",
    output_location="s3://{{ var.value.athena_results }}/watermark/",
)
```

Incremental extraction uses the watermark:
```python
extract_incremental = SqlToS3Operator(
    task_id="extract_incremental",
    query="""
        SELECT * FROM {{ params.source_table }}
        WHERE updated_at > '{{ ti.xcom_pull(task_ids='get_watermark') }}'
    """,
    s3_bucket="{{ var.value.bronze_bucket }}",
    s3_key="bronze/{{ params.source_table }}/{{ ds }}/incremental.parquet",
    file_format="parquet",
    sql_conn_id="source_postgres",
    replace=True,
)
```

## DAG Template

```python
from datetime import datetime
from airflow import DAG
from airflow.operators.empty import EmptyOperator

with DAG(
    dag_id="{{ pipeline_name }}",
    start_date=datetime(2024, 1, 1),
    schedule_interval="@daily",
    catchup=False,
    max_active_runs=1,
    tags=["eadd", "medallion"],
) as dag:
    start = EmptyOperator(task_id="start")
    end = EmptyOperator(task_id="end")

    start >> extract_to_bronze >> clean_to_silver >> aggregate_to_gold >> end
```

## Required Connections
- `source_postgres` — Airflow Connection to source database
- AWS credentials via IAM role (no hardcoded keys)

## Required Variables
- `bronze_bucket` — S3 bucket for raw data
- `silver_bucket` — S3 bucket for cleaned data
- `gold_bucket` — S3 bucket for business data
- `scripts_bucket` — S3 bucket for Glue scripts
- `athena_results` — S3 path for Athena query results

## Verified Operators (use ONLY these)
- `SqlToS3Operator` (airflow.providers.amazon.aws.transfers.sql_to_s3)
- `GlueJobOperator` (airflow.providers.amazon.aws.operators.glue)
- `GlueCrawlerOperator` (airflow.providers.amazon.aws.operators.glue_crawler)
- `AthenaOperator` (airflow.providers.amazon.aws.operators.athena)
- `S3CreateObjectOperator` (airflow.providers.amazon.aws.operators.s3)
- `EmptyOperator` (airflow.operators.empty)
- `PythonOperator` (airflow.operators.python)
- `BashOperator` (airflow.operators.bash)
