/**
 * Pipeline JSON Schema Definition
 * This is the canonical schema that defines what a valid pipeline YAML looks like.
 * All compiler backends validate against this schema.
 */

export const PIPELINE_JSON_SCHEMA = {
  type: 'object',
  required: ['name', 'version', 'source', 'layers', 'target'],
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
      pattern: '^[a-z][a-z0-9_-]*$',
      description: 'Pipeline identifier (lowercase, alphanumeric, hyphens, underscores)',
    },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+$',
      description: 'Semantic version of this pipeline definition',
    },
    description: {
      type: 'string',
      maxLength: 1000,
    },
    metadata: {
      type: 'object',
      required: ['owner'],
      properties: {
        owner: { type: 'string' },
        team: { type: 'string' },
        domain: { type: 'string' },
        tags: {
          type: 'object',
          additionalProperties: { type: 'string' },
        },
        schedule: {
          type: 'string',
          description: 'Cron expression for scheduling',
        },
        sla_minutes: {
          type: 'integer',
          minimum: 1,
        },
      },
    },
    source: {
      type: 'object',
      required: ['type', 'connection'],
      properties: {
        type: {
          type: 'string',
          enum: [
            'postgres', 'mysql', 'sqlserver', 'oracle', 'mongodb',
            'salesforce', 'hubspot', 'rest_api', 'graphql',
            'kafka', 'kinesis', 'pubsub',
            's3', 'gcs', 'azure_blob', 'sftp', 'csv', 'parquet', 'json_file',
          ],
        },
        connection: {
          type: 'object',
          required: ['secret_ref'],
          properties: {
            secret_ref: {
              type: 'string',
              description: 'Reference to secret in cloud secrets manager (NEVER a raw credential)',
            },
            host: { type: 'string' },
            port: { type: 'integer' },
            database: { type: 'string' },
            schema: { type: 'string' },
            table: { type: 'string' },
            query: { type: 'string' },
            endpoint: { type: 'string' },
            path: { type: 'string' },
            file_pattern: { type: 'string' },
          },
        },
        schema_discovery: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: true },
            sample_size: { type: 'integer', minimum: 1, default: 1000 },
            infer_types: { type: 'boolean', default: true },
          },
        },
        incremental: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: true },
            strategy: {
              type: 'string',
              enum: ['timestamp', 'id', 'cdc', 'full_refresh'],
              default: 'timestamp',
            },
            watermark_column: { type: 'string' },
            lookback_window: {
              type: 'string',
              description: 'ISO 8601 duration (e.g., PT1H, P1D)',
            },
          },
        },
      },
    },
    layers: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        required: ['layer', 'format', 'load_mode'],
        properties: {
          layer: {
            type: 'string',
            enum: ['bronze', 'silver', 'gold'],
          },
          enabled: { type: 'boolean', default: true },
          format: {
            type: 'string',
            enum: ['parquet', 'delta', 'iceberg', 'avro', 'json', 'csv'],
            default: 'delta',
          },
          load_mode: {
            type: 'string',
            enum: ['append', 'overwrite', 'merge', 'scd1', 'scd2'],
            default: 'append',
          },
          partitioning: {
            type: 'object',
            properties: {
              columns: {
                type: 'array',
                items: { type: 'string' },
              },
              type: {
                type: 'string',
                enum: ['date', 'hash', 'range', 'list'],
              },
              granularity: {
                type: 'string',
                enum: ['year', 'month', 'day', 'hour'],
              },
            },
          },
          transformations: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type', 'config'],
              properties: {
                type: {
                  type: 'string',
                  enum: ['rename', 'cast', 'derive', 'filter', 'aggregate', 'join', 'pivot', 'unpivot', 'mask', 'hash'],
                },
                config: { type: 'object' },
              },
            },
          },
          dedup: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              columns: {
                type: 'array',
                items: { type: 'string' },
              },
              strategy: {
                type: 'string',
                enum: ['first', 'last', 'max', 'min'],
              },
              order_by: { type: 'string' },
            },
          },
          schema_enforcement: {
            type: 'object',
            properties: {
              mode: {
                type: 'string',
                enum: ['strict', 'permissive', 'evolve'],
                default: 'strict',
              },
              null_rejection: {
                type: 'object',
                properties: {
                  columns: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  action: {
                    type: 'string',
                    enum: ['reject', 'quarantine', 'default_value'],
                  },
                  default_values: { type: 'object' },
                },
              },
              type_coercion: { type: 'boolean', default: false },
            },
          },
        },
      },
    },
    quality: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', default: true },
        checks: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'type', 'severity'],
            properties: {
              name: { type: 'string' },
              type: {
                type: 'string',
                enum: ['schema', 'null', 'unique', 'referential', 'range', 'pattern', 'custom_sql', 'freshness'],
              },
              config: { type: 'object' },
              severity: {
                type: 'string',
                enum: ['error', 'warning', 'info'],
              },
              action_on_fail: {
                type: 'string',
                enum: ['halt', 'quarantine', 'warn', 'skip_record'],
                default: 'quarantine',
              },
            },
          },
        },
        quarantine: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: true },
            destination: { type: 'string' },
            retention_days: { type: 'integer', default: 30 },
            include_metadata: { type: 'boolean', default: true },
            replay_enabled: { type: 'boolean', default: true },
          },
        },
        scoring: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: true },
            thresholds: {
              type: 'object',
              properties: {
                critical: { type: 'number', default: 70 },
                warning: { type: 'number', default: 85 },
              },
            },
          },
        },
      },
    },
    orchestration: {
      type: 'object',
      required: ['engine', 'schedule'],
      properties: {
        engine: {
          type: 'string',
          enum: ['airflow', 'dagster', 'step_functions', 'databricks_workflows', 'adf', 'cloud_composer'],
        },
        schedule: { type: 'string' },
        retries: { type: 'integer', default: 3 },
        retry_delay_seconds: { type: 'integer', default: 300 },
        timeout_minutes: { type: 'integer', default: 60 },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
        },
        backfill: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: false },
            max_parallel: { type: 'integer', default: 3 },
            start_date: { type: 'string' },
          },
        },
      },
    },
    target: {
      type: 'object',
      required: ['cloud'],
      properties: {
        cloud: {
          type: 'string',
          enum: ['aws', 'azure', 'gcp', 'snowflake', 'databricks'],
        },
        region: { type: 'string' },
        service_overrides: { type: 'object' },
      },
    },
    cloud_overrides: {
      type: 'object',
      description: 'Cloud-specific overrides that extend the base spec without breaking agnosticism',
      properties: {
        aws: { type: 'object' },
        azure: { type: 'object' },
        snowflake: { type: 'object' },
        databricks: { type: 'object' },
      },
    },
  },
  additionalProperties: false,
} as const;
