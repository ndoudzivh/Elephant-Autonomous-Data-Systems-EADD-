# Skill: Databricks + Azure Data Lake Storage (ADLS Gen2)

## Stack ID: databricks-adls
## Version: 1.0.0
## Last Verified: 2026-07-15

## Overview
Bronze/Silver/Gold using Databricks notebooks/jobs with Delta Lake
on Azure Data Lake Storage Gen2. No boto3 — uses Azure-native auth.

---

## Bronze: Read from source → write raw Delta to ADLS

```python
from pyspark.sql import SparkSession
from pyspark.sql.functions import current_timestamp, lit, input_file_name

spark = SparkSession.builder.appName("{{ pipeline_name }}_bronze").getOrCreate()

# Read from source (JDBC to PostgreSQL/SQL Server)
bronze_df = (
    spark.read
    .format("jdbc")
    .option("url", "jdbc:postgresql://{{ host }}:5432/{{ database }}")
    .option("dbtable", "{{ source_table }}")
    .option("user", dbutils.secrets.get(scope="{{ secret_scope }}", key="db_user"))
    .option("password", dbutils.secrets.get(scope="{{ secret_scope }}", key="db_password"))
    .load()
)

# Add metadata
bronze_df = (
    bronze_df
    .withColumn("_ingested_at", current_timestamp())
    .withColumn("_source", lit("{{ source_table }}"))
)

# Write to Bronze (ADLS via abfss://)
(
    bronze_df.write
    .format("delta")
    .mode("append")
    .save("abfss://bronze@{{ storage_account }}.dfs.core.windows.net/{{ source_table }}/")
)
```

## Silver: Read Bronze → clean → merge to Silver

```python
from delta.tables import DeltaTable
from pyspark.sql.functions import col, row_number
from pyspark.sql.window import Window

# Read from Bronze
bronze_path = "abfss://bronze@{{ storage_account }}.dfs.core.windows.net/{{ source_table }}/"
df = spark.read.format("delta").load(bronze_path)

# Deduplicate (keep latest per key)
window = Window.partitionBy("id").orderBy(col("_ingested_at").desc())
silver_df = (
    df
    .withColumn("_rn", row_number().over(window))
    .filter(col("_rn") == 1)
    .drop("_rn")
    .filter(col("id").isNotNull())
)

# Merge into Silver (UPSERT for idempotency)
silver_path = "abfss://silver@{{ storage_account }}.dfs.core.windows.net/{{ source_table }}/"

if DeltaTable.isDeltaTable(spark, silver_path):
    silver_table = DeltaTable.forPath(spark, silver_path)
    (
        silver_table.alias("target")
        .merge(silver_df.alias("source"), "target.id = source.id")
        .whenMatchedUpdateAll()
        .whenNotMatchedInsertAll()
        .execute()
    )
else:
    silver_df.write.format("delta").mode("overwrite").save(silver_path)
```

## Gold: Read Silver → aggregate → write Gold

```python
from pyspark.sql.functions import sum as _sum, count, avg, max as _max

silver_path = "abfss://silver@{{ storage_account }}.dfs.core.windows.net/{{ source_table }}/"
silver_df = spark.read.format("delta").load(silver_path)

# Daily aggregation
gold_df = (
    silver_df
    .groupBy("business_date")
    .agg(
        count("id").alias("total_records"),
        _sum("amount").alias("total_amount"),
        avg("amount").alias("avg_amount"),
        _max("amount").alias("max_amount"),
    )
)

gold_path = "abfss://gold@{{ storage_account }}.dfs.core.windows.net/{{ source_table }}_daily/"
gold_df.write.format("delta").mode("overwrite").save(gold_path)
```

## Incremental Load Pattern

```python
# Get watermark from Silver table
silver_path = "abfss://silver@{{ storage_account }}.dfs.core.windows.net/{{ source_table }}/"
if DeltaTable.isDeltaTable(spark, silver_path):
    watermark = spark.read.format("delta").load(silver_path) \
        .agg({"updated_at": "max"}).collect()[0][0]
else:
    watermark = "1970-01-01"

# Incremental extract
bronze_df = (
    spark.read.format("jdbc")
    .option("url", jdbc_url)
    .option("dbtable", f"(SELECT * FROM {source_table} WHERE updated_at > '{watermark}') AS inc")
    .load()
)
```

## Authentication (Azure-native, NO boto3)

```python
# Option 1: Service Principal (recommended for jobs)
spark.conf.set(
    f"fs.azure.account.key.{{ storage_account }}.dfs.core.windows.net",
    dbutils.secrets.get(scope="{{ secret_scope }}", key="storage_key")
)

# Option 2: Azure AD passthrough (interactive)
# Configured at cluster level — no code needed
```

## DOES NOT USE (prevents cross-platform confusion)
- ~~`boto3`~~ — this is Azure, not AWS. Use `abfss://` paths.
- ~~`s3://`~~ — use `abfss://container@account.dfs.core.windows.net/`
- ~~`awsglue`~~ — use Databricks native Spark
- ~~`airflow.providers.amazon`~~ — use `airflow.providers.databricks`

## Databricks Job Config (JSON)

```json
{
  "name": "{{ pipeline_name }}",
  "tasks": [
    {"task_key": "bronze", "notebook_task": {"notebook_path": "/Shared/{{ pipeline_name }}/bronze"}},
    {"task_key": "silver", "notebook_task": {"notebook_path": "/Shared/{{ pipeline_name }}/silver"}, "depends_on": [{"task_key": "bronze"}]},
    {"task_key": "gold", "notebook_task": {"notebook_path": "/Shared/{{ pipeline_name }}/gold"}, "depends_on": [{"task_key": "silver"}]}
  ],
  "job_clusters": [{"job_cluster_key": "shared", "new_cluster": {"spark_version": "14.3.x-scala2.12", "node_type_id": "Standard_DS3_v2", "num_workers": 2}}]
}
```

## Required Packages
- pyspark (included in Databricks Runtime)
- delta-spark (included in Databricks Runtime)
- databricks-sdk (for API calls)
