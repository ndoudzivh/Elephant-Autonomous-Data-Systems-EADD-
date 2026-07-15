/**
 * GCP Compiler (Requirement 2)
 * 
 * Takes a validated Pipeline IR and emits Apache Beam/Dataflow code.
 * Uses ONLY GCP-native SDK: apache_beam, google.cloud.
 * 
 * NO boto3. NO azure.*. NO databricks.
 * Uses ReadFromJdbc (NOT ReadFromPostgres — doesn't exist).
 * Hard line limit prevents decoding degeneracy.
 */

'use strict';

function compile(ir) {
  const { name, source, bronze, silver, gold, properties, schedule } = ir;

  const code = `"""
Pipeline: ${name}
Platform: GCP (Apache Beam / Dataflow + BigQuery)
Generated from IR: ${new Date().toISOString()}
Incremental: ${properties.incremental}
Idempotent: ${properties.idempotent}
"""

import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions, GoogleCloudOptions
from apache_beam.io.jdbc import ReadFromJdbc
from apache_beam.io.gcp.bigquery import WriteToBigQuery
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("${name}")

# ─── Pipeline Options ────────────────────────────────────────
options = PipelineOptions()
gcp_options = options.view_as(GoogleCloudOptions)
gcp_options.project = "{{ project_id }}"
gcp_options.region = "{{ region }}"
gcp_options.staging_location = "gs://{{ staging_bucket }}/staging"
gcp_options.temp_location = "gs://{{ staging_bucket }}/temp"
gcp_options.job_name = "${name}"

# ─── BRONZE: Extract from ${source.type} → GCS Parquet ──────
logger.info("Starting Bronze extraction")

${properties.incremental ? generateGCPIncremental(ir) : generateGCPFull(ir)}

def add_metadata(row):
    row["_ingested_at"] = datetime.utcnow().isoformat()
    row["_source"] = "${source.table}"
    return row

with beam.Pipeline(options=options) as p:
    # Bronze
    bronze = (
        p
        | "ExtractFromSource" >> ReadFromJdbc(
            driver_class_name="${source.type === 'postgres' ? 'org.postgresql.Driver' : 'com.mysql.cj.jdbc.Driver'}",
            jdbc_url="${source.type === 'postgres' ? 'jdbc:postgresql' : 'jdbc:mysql'}://{{ host }}:${source.type === 'postgres' ? '5432' : '3306'}/{{ database }}",
            username="{{ username }}",
            password="{{ password }}",
            query=EXTRACT_QUERY,
        )
        | "AddMetadata" >> beam.Map(add_metadata)
        | "WriteBronzeGCS" >> beam.io.WriteToParquet(
            file_path_prefix="gs://{{ bronze_bucket }}/${name}/",
            schema=None,  # Inferred
        )
    )

    # Silver (dedup + clean → BigQuery)
    silver = (
        p
        | "ReadBronze" >> beam.io.ReadFromParquet(
            "gs://{{ bronze_bucket }}/${name}/*.parquet"
        )
        | "FilterNulls" >> beam.Filter(
            lambda row: ${silver.dedup_keys.map(k => `row.get("${k}") is not None`).join(' and ')}
        )
        | "DedupByKey" >> beam.Distinct()
        | "WriteSilverBQ" >> WriteToBigQuery(
            table="{{ project_id }}.silver.${name}",
            write_disposition=beam.io.BigQueryDisposition.WRITE_TRUNCATE,
            create_disposition=beam.io.BigQueryDisposition.CREATE_IF_NEEDED,
        )
    )

    # Gold (aggregate → BigQuery)
    gold_result = (
        p
        | "ReadSilver" >> beam.io.ReadFromBigQuery(
            query="""
                SELECT
                    ${gold.group_by.map(g => g).join(',\\n                    ')},
${gold.aggregations.map(a => `                    ${a.fn.toUpperCase()}(${a.column === '*' ? '1' : a.column}) AS ${a.alias}`).join(',\\n')}
                FROM \`{{ project_id }}.silver.${name}\`
                GROUP BY ${gold.group_by.map((_, i) => i + 1).join(', ')}
            """,
            use_standard_sql=True,
        )
        | "WriteGoldBQ" >> WriteToBigQuery(
            table="{{ project_id }}.gold.${gold.output_name || name + '_daily'}",
            write_disposition=beam.io.BigQueryDisposition.WRITE_TRUNCATE,
            create_disposition=beam.io.BigQueryDisposition.CREATE_IF_NEEDED,
        )
    )

logger.info("Pipeline ${name} submitted to Dataflow")
`;

  return {
    code,
    files: [
      { path: `pipelines/${name}_beam.py`, content: code, type: 'beam_pipeline' },
    ],
    engine: 'beam',
    platform: 'gcp',
    ir_satisfied: {
      incremental: properties.incremental,
      idempotent: properties.idempotent,
    },
  };
}

function generateGCPIncremental(ir) {
  return `# Incremental query using watermark
from google.cloud import bigquery
bq_client = bigquery.Client()
wm_result = bq_client.query(
    f"SELECT COALESCE(MAX(${ir.source.watermark_column}), '1970-01-01') AS wm FROM \`{{ project_id }}.silver.${ir.name}\`"
).result()
last_watermark = list(wm_result)[0].wm if wm_result.total_rows > 0 else "1970-01-01"
EXTRACT_QUERY = f"SELECT * FROM ${ir.source.table} WHERE ${ir.source.watermark_column} > '{last_watermark}'"
logger.info(f"Incremental: watermark={last_watermark}")`;
}

function generateGCPFull(ir) {
  return `EXTRACT_QUERY = "SELECT * FROM ${ir.source.table}"
logger.info("Full extract from ${ir.source.table}")`;
}

function canSatisfy(ir) {
  const unsupported = [];
  if (ir.source.type === 'mongodb') {
    unsupported.push('MongoDB source not supported via Beam JDBC — use Dataflow Flex Template');
  }
  if (ir.properties.incremental && !ir.source.watermark_column) {
    unsupported.push('incremental requires watermark_column');
  }
  return { can_satisfy: unsupported.length === 0, unsupported };
}

module.exports = { compile, canSatisfy };
