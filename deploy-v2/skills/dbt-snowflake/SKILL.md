# Skill: dbt + Snowflake

## Stack ID: dbt-snowflake
## Version: 1.0.0
## Last Verified: 2026-07-14

## Overview
Transform data in Snowflake using dbt Core. Medallion layers
implemented as dbt models with incremental materialization.

---

## Bronze: Source definition (raw data already in Snowflake)

```yaml
# models/staging/src_raw.yml
version: 2
sources:
  - name: raw
    database: "{{ env_var('SNOWFLAKE_DATABASE') }}"
    schema: bronze
    tables:
      - name: "{{ source_table }}"
        loaded_at_field: _loaded_at
        freshness:
          warn_after: {count: 24, period: hour}
          error_after: {count: 48, period: hour}
```

## Silver: Staging model (clean + deduplicate)

```sql
-- models/staging/stg_{{ source_table }}.sql
{{ config(
    materialized='incremental',
    unique_key='id',
    on_schema_change='sync_all_columns'
) }}

WITH source AS (
    SELECT * FROM {{ source('raw', '{{ source_table }}') }}
    {% if is_incremental() %}
    WHERE updated_at > (SELECT MAX(updated_at) FROM {{ this }})
    {% endif %}
),

deduplicated AS (
    SELECT *,
        ROW_NUMBER() OVER (
            PARTITION BY id
            ORDER BY updated_at DESC
        ) AS _row_num
    FROM source
)

SELECT
    {{ dbt_utils.star(from=source('raw', '{{ source_table }}')) }}
FROM deduplicated
WHERE _row_num = 1
```

## Gold: Business model (aggregate)

```sql
-- models/marts/fct_{{ source_table }}_daily.sql
{{ config(
    materialized='table',
    cluster_by=['business_date']
) }}

SELECT
    DATE(created_at) AS business_date,
    COUNT(*) AS total_records,
    SUM(amount) AS total_amount,
    AVG(amount) AS avg_amount
FROM {{ ref('stg_{{ source_table }}') }}
GROUP BY 1
```

## Incremental Load Pattern

The `is_incremental()` macro handles watermark logic:
```sql
{% if is_incremental() %}
WHERE updated_at > (SELECT MAX(updated_at) FROM {{ this }})
{% endif %}
```

For MERGE (upsert) behavior, set `unique_key`:
```sql
{{ config(materialized='incremental', unique_key='id') }}
```

## Schema Tests

```yaml
# models/staging/stg_{{ source_table }}.yml
version: 2
models:
  - name: stg_{{ source_table }}
    columns:
      - name: id
        tests:
          - not_null
          - unique
      - name: updated_at
        tests:
          - not_null
```

## dbt_project.yml

```yaml
name: '{{ pipeline_name }}'
version: '1.0.0'
profile: 'snowflake'

models:
  {{ pipeline_name }}:
    staging:
      +materialized: incremental
      +schema: silver
    marts:
      +materialized: table
      +schema: gold
```

## profiles.yml (connection)

```yaml
snowflake:
  target: prod
  outputs:
    prod:
      type: snowflake
      account: "{{ env_var('SNOWFLAKE_ACCOUNT') }}"
      user: "{{ env_var('SNOWFLAKE_USER') }}"
      password: "{{ env_var('SNOWFLAKE_PASSWORD') }}"
      role: TRANSFORMER
      database: ANALYTICS
      warehouse: TRANSFORM_WH
      schema: silver
      threads: 4
```

## Verified dbt Functions (use ONLY these)
- `{{ ref('model_name') }}` — reference another model
- `{{ source('source_name', 'table_name') }}` — reference raw source
- `{{ config(...) }}` — model configuration
- `{{ is_incremental() }}` — check if incremental run
- `{{ this }}` — reference current model's table
- `{{ dbt_utils.star() }}` — select all columns
- `{{ dbt_utils.generate_surrogate_key() }}` — create SK
- `{{ env_var('VAR_NAME') }}` — environment variable
