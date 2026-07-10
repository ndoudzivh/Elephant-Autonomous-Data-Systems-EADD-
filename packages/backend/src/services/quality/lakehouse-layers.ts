/**
 * EADD Lakehouse Architecture Module
 * 
 * Implements the Medallion Architecture (Bronze → Silver → Gold)
 * with full educational context for every layer.
 * 
 * WHY MEDALLION:
 * Raw data → Cleaned data → Business-ready data
 * Each layer has a clear purpose, quality gate, and ownership.
 * If something breaks in Gold, you can always reprocess from Bronze.
 * 
 * This module generates layer-specific code templates, quality gates,
 * and explanations that are appended to pipeline solutions.
 */

interface LakehouseContext {
  pipelineName?: string;
  platform?: string;
  dailyVolumeGB?: number;
  frequency?: string;
  userMessage?: string;
}

// ============================================================
// LAYER DEFINITIONS — The DNA of each layer
// ============================================================

interface LayerDefinition {
  name: string;
  emoji: string;
  purpose: string;
  mentorExplanation: string;
  qualityGate: string[];
  storageFormat: string;
  partitionStrategy: string;
  retentionPolicy: string;
  ownerRole: string;
}


const BRONZE_LAYER: LayerDefinition = {
  name: 'Bronze (Raw)',
  emoji: '🥉',
  purpose: 'Land data EXACTLY as received from source. No transformations. Your insurance policy.',
  mentorExplanation: `🎓 **Why Bronze exists**: If your Silver transformation has a bug, you'd lose the original data forever without Bronze. Bronze is your "undo button." It stores the raw payload exactly as the source sent it — schema, nulls, duplicates, and all.

**Rules for Bronze**:
- NEVER modify incoming data (no casts, no filters, no dedup)
- ALWAYS add metadata: ingestion_timestamp, source_file, batch_id
- ALWAYS store in append-only mode (never overwrite)
- Schema enforcement: minimal — just basic typing to land the data

**Think of it like**: A bank vault holding original documents. You make copies (Silver/Gold) for daily work, but the originals stay untouched.`,
  qualityGate: [
    'Row count matches source (±0 tolerance)',
    'No schema drift from expected source schema',
    'Ingestion timestamp is populated on every row',
    'Source file/batch_id is tracked for lineage',
    'No data older than retention policy exists',
  ],
  storageFormat: 'Delta Lake / Parquet (append-only)',
  partitionStrategy: 'Partition by ingestion_date (YYYY/MM/DD)',
  retentionPolicy: '90 days hot → archive to cold storage',
  ownerRole: 'Data Engineering (Ingestion Team)',
};

const SILVER_LAYER: LayerDefinition = {
  name: 'Silver (Cleaned & Conformed)',
  emoji: '🥈',
  purpose: 'Cleaned, deduplicated, type-cast, standardized. Trusted but not business-ready.',
  mentorExplanation: `🎓 **Why Silver exists**: Bronze data is messy — nulls, duplicates, wrong types, inconsistent formats. Silver applies the "single version of truth" rules:

**What happens in Silver**:
1. **Type casting**: Strings → proper types (dates, numbers, booleans)
2. **Deduplication**: Remove exact duplicates, handle late-arriving records
3. **Null handling**: Apply business rules (default values, forward-fill, or reject)
4. **Standardization**: Normalize formats (dates to ISO 8601, currencies to base)
5. **Conformity**: Align naming conventions across all sources (snake_case, consistent prefixes)

**Silver does NOT do**:
- Business aggregations (that's Gold)
- Filtering by business rules (that's Gold)
- Creating derived metrics (that's Gold)

**Think of it like**: A well-organized filing cabinet. Everything is labeled, typed, and findable — but you haven't created any reports yet.`,
  qualityGate: [
    'Zero duplicates on primary key columns',
    'All columns match expected data types',
    'Null percentage below threshold (configurable per column)',
    'Referential integrity with dimension keys',
    'Freshness SLA met (data is within expected latency)',
    'Row count delta vs Bronze is explainable (dedup count logged)',
  ],
  storageFormat: 'Delta Lake / Parquet (merge/upsert mode)',
  partitionStrategy: 'Partition by business_date or source_system',
  retentionPolicy: '12 months (full history for reprocessing)',
  ownerRole: 'Data Engineering (Transformation Team)',
};


const GOLD_LAYER: LayerDefinition = {
  name: 'Gold (Business-Ready)',
  emoji: '🥇',
  purpose: 'Aggregated, enriched, modeled for specific business use cases. Dashboard/ML ready.',
  mentorExplanation: `🎓 **Why Gold exists**: This is where data becomes business VALUE. Gold tables are designed for consumption — they answer specific business questions directly.

**What happens in Gold**:
1. **Business logic**: Calculate KPIs, metrics, scores, segments
2. **Aggregation**: Summarize to the grain needed (daily, weekly, by region)
3. **Enrichment**: Join with dimension tables, lookup tables, ML scores
4. **Modeling**: Star schema (facts + dimensions) for fast BI queries
5. **Access control**: Apply row-level security, column masking for PII

**Gold IS**:
- Optimized for READ performance (pre-aggregated, materialized)
- Business-language column names ("total_revenue" not "trx_amt_sum")
- Documented with business definitions
- The ONLY layer dashboards/reports should query

**Think of it like**: The executive summary. You've done all the research (Bronze), organized it (Silver), and now you present the insights (Gold) in a format stakeholders can act on.`,
  qualityGate: [
    'Business KPIs match known reference values (reconciliation)',
    'All dimension keys resolve (no orphan fact records)',
    'Aggregations reconcile with Silver totals (sum checks)',
    'No future dates in time-based metrics',
    'Dashboard refresh SLA met',
    'Data freshness indicator is green',
  ],
  storageFormat: 'Delta Lake / Parquet (overwrite partition or merge)',
  partitionStrategy: 'Partition by business use case (report_date, region)',
  retentionPolicy: '24+ months (business history)',
  ownerRole: 'Analytics Engineering / BI Team',
};


// ============================================================
// CODE TEMPLATES — Per-layer code generation
// ============================================================

function getBronzeTemplate(platform: string, name: string): string {
  if (platform === 'databricks' || platform === 'pyspark') {
    return `\`\`\`python
# ═══════════════════════════════════════════════════════════════
# 🥉 BRONZE LAYER — Raw Ingestion (${name})
# ═══════════════════════════════════════════════════════════════
# WHY: Land data exactly as-is from source. This is your "undo button."
# If Silver/Gold transformations have bugs, you can always reprocess from here.

from pyspark.sql import SparkSession
from pyspark.sql.functions import current_timestamp, input_file_name, lit
from pyspark.sql.types import StructType, StructField, StringType, IntegerType

spark = SparkSession.builder.appName("${name}_bronze").getOrCreate()

# 🎓 Mentor Note: We define schema explicitly rather than inferring it.
# Schema inference reads ALL data (slow + impossible for streaming).
# Explicit schema also catches source schema drift immediately.
source_schema = StructType([
    # TODO: Define your source schema here
    StructField("id", StringType(), nullable=False),
    StructField("created_at", StringType(), nullable=True),
    # Add remaining columns...
])

# Read from source (example: S3/ADLS files)
raw_df = (
    spark.read
    .format("parquet")  # or "csv", "json", "jdbc"
    .schema(source_schema)
    .load("s3://${name}-landing/incoming/")
)

# 🎓 Mentor Note: We add metadata columns for lineage tracking.
# When debugging, you'll want to know: "Which file brought this row?"
bronze_df = (
    raw_df
    .withColumn("_ingestion_timestamp", current_timestamp())
    .withColumn("_source_file", input_file_name())
    .withColumn("_batch_id", lit("batch_001"))
)

# Write to Bronze (append-only — NEVER overwrite Bronze!)
(
    bronze_df.write
    .format("delta")
    .mode("append")
    .partitionBy("_ingestion_date")
    .save("s3://${name}-lakehouse/bronze/${name}/")
)

print(f"✅ Bronze: {bronze_df.count()} rows landed successfully")
\`\`\``;
  }

  // Snowflake/SQL version
  return `\`\`\`sql
-- ═══════════════════════════════════════════════════════════════
-- 🥉 BRONZE LAYER — Raw Ingestion (${name})
-- ═══════════════════════════════════════════════════════════════
-- WHY: Land data exactly as-is. No transformations. Insurance policy.

CREATE SCHEMA IF NOT EXISTS ${name}_db.bronze;

CREATE TABLE IF NOT EXISTS ${name}_db.bronze.raw_${name} (
    -- Source columns (match source schema exactly)
    raw_payload VARIANT,  -- Store entire record as semi-structured
    
    -- Metadata for lineage
    _ingestion_timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    _source_file VARCHAR,
    _batch_id VARCHAR
)
CLUSTER BY (_ingestion_timestamp::DATE);

-- Create Snowpipe for auto-ingestion from S3/Azure
CREATE OR REPLACE PIPE ${name}_db.bronze.${name}_pipe
    AUTO_INGEST = TRUE
    AS
    COPY INTO ${name}_db.bronze.raw_${name}
    FROM @${name}_db.bronze.landing_stage
    FILE_FORMAT = (TYPE = 'JSON');
\`\`\``;
}


function getSilverTemplate(platform: string, name: string): string {
  if (platform === 'databricks' || platform === 'pyspark') {
    return `\`\`\`python
# ═══════════════════════════════════════════════════════════════
# 🥈 SILVER LAYER — Cleaning & Conforming (${name})
# ═══════════════════════════════════════════════════════════════
# WHY: Transform raw Bronze data into a "trusted" state.
# Dedup, type-cast, standardize, validate — but NO business logic yet.

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, to_timestamp, trim, lower, row_number
from pyspark.sql.window import Window
from delta.tables import DeltaTable

spark = SparkSession.builder.appName("${name}_silver").getOrCreate()

# Read from Bronze
bronze_df = spark.read.format("delta").load(
    "s3://${name}-lakehouse/bronze/${name}/"
)

# ─── Step 1: Type Casting ───────────────────────────────────
# 🎓 Mentor Note: Cast strings to proper types early.
# This catches data issues immediately (invalid dates throw errors here,
# not 3 layers later when the CFO asks why revenue is NULL).
silver_df = (
    bronze_df
    .withColumn("created_at", to_timestamp(col("created_at"), "yyyy-MM-dd HH:mm:ss"))
    .withColumn("email", lower(trim(col("email"))))
    .withColumn("amount", col("amount").cast("decimal(18,2)"))
)

# ─── Step 2: Deduplication ──────────────────────────────────
# 🎓 Mentor Note: Use window function to keep the LATEST record per key.
# This handles both exact dupes and late-arriving updates.
window_spec = Window.partitionBy("id").orderBy(col("_ingestion_timestamp").desc())

silver_df = (
    silver_df
    .withColumn("_row_num", row_number().over(window_spec))
    .filter(col("_row_num") == 1)
    .drop("_row_num")
)

# ─── Step 3: Null Handling ──────────────────────────────────
# Apply business rules for nulls (reject, default, or forward-fill)
silver_df = silver_df.filter(col("id").isNotNull())

# ─── Step 4: Write to Silver (MERGE for idempotency) ───────
# 🎓 Mentor Note: MERGE (upsert) instead of INSERT ensures idempotency.
# If this job runs twice by accident, you get the same result — not duplicates.
silver_path = f"s3://${name}-lakehouse/silver/${name}/"

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
    # First run — create the table
    silver_df.write.format("delta").mode("overwrite").save(silver_path)

print(f"✅ Silver: {silver_df.count()} rows cleaned and merged")
\`\`\``;
  }

  return `\`\`\`sql
-- ═══════════════════════════════════════════════════════════════
-- 🥈 SILVER LAYER — Cleaning & Conforming (${name})
-- ═══════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS ${name}_db.silver;

CREATE TABLE IF NOT EXISTS ${name}_db.silver.${name} AS
SELECT
    id,
    TRY_TO_TIMESTAMP(created_at) AS created_at,
    LOWER(TRIM(email)) AS email,
    TRY_TO_DECIMAL(amount, 18, 2) AS amount,
    CURRENT_TIMESTAMP() AS _processed_at
FROM ${name}_db.bronze.raw_${name}
QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY _ingestion_timestamp DESC) = 1
WHERE id IS NOT NULL;
\`\`\``;
}


function getGoldTemplate(platform: string, name: string): string {
  if (platform === 'databricks' || platform === 'pyspark') {
    return `\`\`\`python
# ═══════════════════════════════════════════════════════════════
# 🥇 GOLD LAYER — Business-Ready Aggregations (${name})
# ═══════════════════════════════════════════════════════════════
# WHY: This is what dashboards and ML models consume.
# Pre-aggregated, enriched, business-language column names.
# Optimized for READ performance (analysts shouldn't wait).

from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    col, sum as _sum, count, avg, max as _max,
    current_date, datediff, when, round as _round
)

spark = SparkSession.builder.appName("${name}_gold").getOrCreate()

# Read from Silver (trusted, clean data)
silver_df = spark.read.format("delta").load(
    "s3://${name}-lakehouse/silver/${name}/"
)

# ─── Gold Model: Daily Summary ──────────────────────────────
# 🎓 Mentor Note: Gold tables answer specific business questions.
# This one answers: "What's our daily performance by segment?"
# Name columns in BUSINESS language, not technical abbreviations.
daily_summary = (
    silver_df
    .groupBy("business_date", "customer_segment")
    .agg(
        count("id").alias("total_transactions"),
        _sum("amount").alias("total_revenue"),
        avg("amount").alias("average_order_value"),
        _max("amount").alias("largest_transaction"),
        count(when(col("status") == "completed", 1)).alias("completed_count"),
    )
    .withColumn("completion_rate",
        _round(col("completed_count") / col("total_transactions") * 100, 2))
)

# ─── Gold Model: Customer 360 ───────────────────────────────
# 🎓 Mentor Note: "Customer 360" = single view of everything about a customer.
# Joins multiple Silver tables into one denormalized, queryable view.
customer_360 = (
    silver_df
    .groupBy("customer_id")
    .agg(
        count("id").alias("lifetime_transactions"),
        _sum("amount").alias("lifetime_value"),
        _max("created_at").alias("last_transaction_date"),
        avg("amount").alias("avg_transaction_value"),
    )
    .withColumn("days_since_last_purchase",
        datediff(current_date(), col("last_transaction_date")))
    .withColumn("customer_tier",
        when(col("lifetime_value") > 10000, "platinum")
        .when(col("lifetime_value") > 5000, "gold")
        .when(col("lifetime_value") > 1000, "silver")
        .otherwise("bronze")
    )
)

# Write Gold tables (overwrite by partition for freshness)
daily_summary.write.format("delta").mode("overwrite") \\
    .partitionBy("business_date") \\
    .save("s3://${name}-lakehouse/gold/daily_summary/")

customer_360.write.format("delta").mode("overwrite") \\
    .save("s3://${name}-lakehouse/gold/customer_360/")

print(f"✅ Gold: Daily summary ({daily_summary.count()} rows), Customer 360 ({customer_360.count()} rows)")
\`\`\``;
  }

  return `\`\`\`sql
-- ═══════════════════════════════════════════════════════════════
-- 🥇 GOLD LAYER — Business Aggregations (${name})
-- ═══════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS ${name}_db.gold;

-- Daily Summary (answers: "How did we perform today?")
CREATE OR REPLACE TABLE ${name}_db.gold.daily_summary AS
SELECT
    DATE(created_at) AS business_date,
    customer_segment,
    COUNT(*) AS total_transactions,
    SUM(amount) AS total_revenue,
    AVG(amount) AS average_order_value,
    MAX(amount) AS largest_transaction,
    ROUND(COUNT_IF(status = 'completed') / COUNT(*) * 100, 2) AS completion_rate_pct
FROM ${name}_db.silver.${name}
GROUP BY 1, 2;

-- Customer 360 (single view of each customer)
CREATE OR REPLACE TABLE ${name}_db.gold.customer_360 AS
SELECT
    customer_id,
    COUNT(*) AS lifetime_transactions,
    SUM(amount) AS lifetime_value,
    MAX(created_at) AS last_transaction_date,
    AVG(amount) AS avg_transaction_value,
    DATEDIFF(day, MAX(created_at), CURRENT_DATE()) AS days_since_last_purchase,
    CASE
        WHEN SUM(amount) > 10000 THEN 'platinum'
        WHEN SUM(amount) > 5000 THEN 'gold'
        WHEN SUM(amount) > 1000 THEN 'silver'
        ELSE 'bronze'
    END AS customer_tier
FROM ${name}_db.silver.${name}
GROUP BY customer_id;
\`\`\``;
}


// ============================================================
// MAIN EXPORT — Generate Lakehouse context section
// ============================================================

/**
 * Generates a Lakehouse Bronze/Silver/Gold architecture section
 * with layer explanations, code templates, and quality gates.
 */
export function generateLakehouseContext(context: LakehouseContext): string | null {
  const name = context.pipelineName || 'pipeline';
  const platform = (context.platform || 'pyspark').toLowerCase();

  // Build the architecture overview
  const header = `---

## 🏛️ Lakehouse Architecture: ${name}

> **Medallion Architecture** — Data flows through 3 layers, each with a clear purpose and quality gate.
> If Gold has a bug, you reprocess from Silver. If Silver has a bug, you reprocess from Bronze.
> Bronze is your "undo button."

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                        DATA FLOW                                 │
│                                                                  │
│  Source → 🥉 BRONZE (Raw) → 🥈 SILVER (Clean) → 🥇 GOLD (BI)  │
│           │                  │                    │               │
│           │ No transforms    │ Dedup, cast,      │ Aggregate,    │
│           │ Append-only      │ standardize       │ enrich, model │
│           │ Schema capture   │ MERGE/upsert      │ Star schema   │
│                                                                  │
│  Quality Gate ──────── Quality Gate ──────── Quality Gate        │
│  (row count match)    (zero dupes)          (reconciliation)    │
└─────────────────────────────────────────────────────────────────┘
\`\`\`
`;

  // Layer details
  const layers = [
    { def: BRONZE_LAYER, template: getBronzeTemplate(platform, name) },
    { def: SILVER_LAYER, template: getSilverTemplate(platform, name) },
    { def: GOLD_LAYER, template: getGoldTemplate(platform, name) },
  ];

  let output = header;

  for (const layer of layers) {
    output += `
### ${layer.def.emoji} ${layer.def.name}

**Purpose**: ${layer.def.purpose}

${layer.def.mentorExplanation}

**Quality Gate** (must pass before data moves to next layer):
${layer.def.qualityGate.map(g => `- ✅ ${g}`).join('\n')}

**Storage**: ${layer.def.storageFormat} | **Partition**: ${layer.def.partitionStrategy}
**Retention**: ${layer.def.retentionPolicy} | **Owner**: ${layer.def.ownerRole}

${layer.template}

---
`;
  }

  // Summary table
  output += `
### 📊 Layer Comparison

| Aspect | 🥉 Bronze | 🥈 Silver | 🥇 Gold |
|--------|-----------|-----------|---------|
| **Purpose** | Raw landing | Cleaned & conformed | Business-ready |
| **Transforms** | None (as-is) | Dedup, cast, standardize | Aggregate, enrich, model |
| **Write mode** | Append only | Merge/Upsert | Overwrite partition |
| **Schema** | Source schema | Enforced types | Star schema / dimensional |
| **Quality** | Row count check | Zero dupes + types valid | KPI reconciliation |
| **Consumers** | Silver layer only | Gold layer + data scientists | Dashboards + ML + APIs |
| **Retention** | 90 days → cold | 12 months | 24+ months |
| **Owner** | Ingestion team | Data engineering | Analytics engineering |
`;

  return output;
}
