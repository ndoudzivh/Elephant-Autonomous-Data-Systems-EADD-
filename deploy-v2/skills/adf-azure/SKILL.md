# Skill: Azure Data Factory + Azure Data Lake

## Stack ID: adf-azure
## Version: 1.0.0
## Last Verified: 2026-07-14

## Overview
Orchestrate Bronze/Silver/Gold pipelines using Azure Data Factory
with ADLS Gen2 storage and Synapse/Databricks for transforms.

---

## Bronze: Copy from source → ADLS raw

```json
{
  "name": "CopyToBronze",
  "type": "Copy",
  "inputs": [{"referenceName": "SourceDataset", "type": "DatasetReference"}],
  "outputs": [{"referenceName": "BronzeDataset", "type": "DatasetReference"}],
  "typeProperties": {
    "source": {
      "type": "SqlSource",
      "sqlReaderQuery": "SELECT * FROM {{ source_table }} WHERE updated_at > '@{pipeline().parameters.watermark}'"
    },
    "sink": {
      "type": "ParquetSink",
      "storeSettings": {"type": "AzureBlobFSWriteSettings"},
      "formatSettings": {"type": "ParquetWriteSettings"}
    }
  }
}
```

## Silver: Dataflow transform

```json
{
  "name": "TransformToSilver",
  "type": "ExecuteDataFlow",
  "typeProperties": {
    "dataflow": {"referenceName": "SilverTransform", "type": "DataFlowReference"},
    "compute": {
      "coreCount": 8,
      "computeType": "General"
    }
  }
}
```

Dataflow script:
```
source(output(
    id as string,
    name as string,
    amount as decimal(18,2),
    updated_at as timestamp
), allowSchemaDrift: true) ~> SourceBronze

SourceBronze filter(not(isNull(id))) ~> FilterNulls
FilterNulls deduplicate(id, sort(updated_at, desc())) ~> Deduplicate
Deduplicate derive(
    _processed_at = currentTimestamp(),
    _source = 'bronze'
) ~> AddMetadata
AddMetadata sink(
    allowSchemaDrift: true,
    format: 'parquet',
    partitionBy: ['business_date']
) ~> SilverSink
```

## Gold: Synapse SQL aggregate

```sql
-- Synapse Serverless SQL
CREATE OR ALTER VIEW gold.daily_summary AS
SELECT
    CAST(created_at AS DATE) AS business_date,
    COUNT(*) AS total_records,
    SUM(amount) AS total_amount,
    AVG(amount) AS avg_amount
FROM silver.{{ source_table }}
GROUP BY CAST(created_at AS DATE);
```

## Incremental Load Pattern

ADF uses Lookup + watermark:
```json
{
  "name": "GetWatermark",
  "type": "Lookup",
  "typeProperties": {
    "source": {
      "type": "SqlSource",
      "sqlReaderQuery": "SELECT MAX(updated_at) AS watermark FROM silver.{{ source_table }}"
    }
  }
}
```

## Pipeline Template (ARM)

```json
{
  "name": "{{ pipeline_name }}",
  "properties": {
    "activities": [
      {"name": "GetWatermark", "type": "Lookup"},
      {"name": "CopyToBronze", "type": "Copy", "dependsOn": [{"activity": "GetWatermark", "dependencyConditions": ["Succeeded"]}]},
      {"name": "TransformToSilver", "type": "ExecuteDataFlow", "dependsOn": [{"activity": "CopyToBronze", "dependencyConditions": ["Succeeded"]}]}
    ],
    "parameters": {
      "source_table": {"type": "String"},
      "watermark": {"type": "String", "defaultValue": "1970-01-01"}
    }
  }
}
```

## Verified ADF Activity Types (use ONLY these)
- `Copy` — data movement
- `ExecuteDataFlow` — mapping dataflow
- `Lookup` — single-row query
- `GetMetadata` — file/folder metadata
- `IfCondition` — branching
- `ForEach` — looping
- `Wait` — delay
- `SetVariable` — set variable
- `ExecutePipeline` — call child pipeline
- `WebActivity` — HTTP call
- `DatabricksNotebook` — run Databricks notebook

## Required Linked Services
- Source database (SQL Server, PostgreSQL, etc.)
- ADLS Gen2 (Azure Data Lake Storage)
- Synapse Analytics (optional, for Gold)
