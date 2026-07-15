# Skill: Apache Beam + GCP (BigQuery/GCS)

## Stack ID: beam-gcp
## Version: 1.0.0
## Last Verified: 2026-07-15

## Overview
Build Bronze/Silver/Gold pipelines using Apache Beam on Google Cloud
Dataflow with BigQuery as target and GCS for intermediate storage.

---

## Bronze: Read from source → write raw to GCS

```python
import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions
from apache_beam.io.gcp.bigquery import WriteToBigQuery
from apache_beam.io.jdbc import ReadFromJdbc

def run_bronze(pipeline_options):
    with beam.Pipeline(options=pipeline_options) as p:
        rows = (
            p
            | "ReadFromPostgres" >> ReadFromJdbc(
                driver_class_name="org.postgresql.Driver",
                jdbc_url="jdbc:postgresql://{{ host }}:5432/{{ database }}",
                username="{{ username }}",
                password="{{ password }}",
                query="SELECT * FROM {{ source_table }} WHERE updated_at > @watermark",
            )
            | "AddMetadata" >> beam.Map(lambda row: {
                **row,
                "_ingested_at": datetime.utcnow().isoformat(),
                "_source": "postgres",
            })
            | "WriteBronzeGCS" >> beam.io.WriteToParquet(
                file_path_prefix="gs://{{ bronze_bucket }}/{{ source_table }}/",
                schema=BRONZE_SCHEMA,
            )
        )
```

## Silver: Read Bronze → clean → write Silver

```python
def run_silver(pipeline_options):
    with beam.Pipeline(options=pipeline_options) as p:
        (
            p
            | "ReadBronze" >> beam.io.ReadFromParquet(
                "gs://{{ bronze_bucket }}/{{ source_table }}/*.parquet"
            )
            | "FilterNulls" >> beam.Filter(lambda row: row.get("id") is not None)
            | "Deduplicate" >> beam.Distinct()
            | "CastTypes" >> beam.Map(cast_types)
            | "WriteSilverBQ" >> WriteToBigQuery(
                table="{{ project }}.silver.{{ source_table }}",
                write_disposition=beam.io.BigQueryDisposition.WRITE_TRUNCATE,
                create_disposition=beam.io.BigQueryDisposition.CREATE_IF_NEEDED,
            )
        )
```

## Gold: Read Silver → aggregate → write Gold

```python
def run_gold(pipeline_options):
    with beam.Pipeline(options=pipeline_options) as p:
        (
            p
            | "ReadSilver" >> beam.io.ReadFromBigQuery(
                query="""
                    SELECT
                        DATE(created_at) AS business_date,
                        COUNT(*) AS total_records,
                        SUM(amount) AS total_amount
                    FROM `{{ project }}.silver.{{ source_table }}`
                    GROUP BY 1
                """,
                use_standard_sql=True,
            )
            | "WriteGoldBQ" >> WriteToBigQuery(
                table="{{ project }}.gold.{{ source_table }}_daily",
                write_disposition=beam.io.BigQueryDisposition.WRITE_TRUNCATE,
                create_disposition=beam.io.BigQueryDisposition.CREATE_IF_NEEDED,
            )
        )
```

## Incremental Load Pattern

```python
# Use BigQuery to get last watermark
from google.cloud import bigquery

def get_watermark(project, table):
    client = bigquery.Client(project=project)
    query = f"SELECT MAX(updated_at) AS wm FROM `{project}.silver.{table}`"
    result = client.query(query).result()
    for row in result:
        return row.wm or "1970-01-01"
```

## Pipeline Options Template

```python
from apache_beam.options.pipeline_options import PipelineOptions, GoogleCloudOptions

options = PipelineOptions()
gcp_options = options.view_as(GoogleCloudOptions)
gcp_options.project = "{{ project_id }}"
gcp_options.region = "{{ region }}"
gcp_options.staging_location = "gs://{{ staging_bucket }}/staging"
gcp_options.temp_location = "gs://{{ staging_bucket }}/temp"
gcp_options.job_name = "{{ pipeline_name }}"
```

## Verified Beam I/O Transforms (use ONLY these)
- `beam.io.ReadFromParquet` — read Parquet from GCS
- `beam.io.WriteToParquet` — write Parquet to GCS
- `beam.io.ReadFromBigQuery` — read from BigQuery (query or table)
- `beam.io.WriteToBigQuery` (or `WriteToBigQuery`) — write to BigQuery
- `beam.io.ReadFromText` — read text/CSV from GCS
- `beam.io.WriteToText` — write text to GCS
- `ReadFromJdbc` (apache_beam.io.jdbc) — read from JDBC source
- `beam.io.ReadFromPubSub` — read from Pub/Sub
- `beam.io.WriteToPubSub` — write to Pub/Sub

## DOES NOT EXIST (known hallucinations)
- ~~`ReadFromPostgres`~~ — use `ReadFromJdbc` instead
- ~~`MessageCallback`~~ — does not exist in apache_beam.io.gcp.pubsub
- ~~`beam.io.ReadFromSQL`~~ — use `ReadFromJdbc` instead

## Required Packages
- apache-beam[gcp]==2.56.0
- google-cloud-bigquery
- google-cloud-storage
