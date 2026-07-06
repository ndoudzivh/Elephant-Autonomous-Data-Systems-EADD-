/**
 * Core Pipeline Types - Cloud-Agnostic
 * These types represent the internal structure of a pipeline
 * as parsed from the YAML schema definition.
 */

export type CloudProvider = 'aws' | 'azure' | 'gcp' | 'snowflake' | 'databricks';
export type PipelineLayer = 'bronze' | 'silver' | 'gold';
export type LoadMode = 'append' | 'overwrite' | 'merge' | 'scd1' | 'scd2';
export type DataFormat = 'parquet' | 'delta' | 'iceberg' | 'avro' | 'json' | 'csv';
export type ModelStyle = 'star_schema' | 'data_vault' | 'flat' | 'scd2';

export interface PipelineSpec {
  id: string;
  name: string;
  version: string;
  description?: string;
  metadata: PipelineMetadata;
  source: SourceConfig;
  layers: LayerConfig[];
  quality: QualityConfig;
  orchestration: OrchestrationConfig;
  target: TargetConfig;
  cloud_overrides?: CloudOverrides;
}

export interface PipelineMetadata {
  owner: string;
  team?: string;
  domain?: string;
  tags?: Record<string, string>;
  schedule?: string; // cron expression
  sla_minutes?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SourceConfig {
  type: SourceType;
  connection: ConnectionConfig;
  schema_discovery?: SchemaDiscoveryConfig;
  incremental?: IncrementalConfig;
}

export type SourceType =
  | 'postgres'
  | 'mysql'
  | 'sqlserver'
  | 'oracle'
  | 'mongodb'
  | 'salesforce'
  | 'hubspot'
  | 'rest_api'
  | 'graphql'
  | 'kafka'
  | 'kinesis'
  | 'pubsub'
  | 's3'
  | 'gcs'
  | 'azure_blob'
  | 'sftp'
  | 'csv'
  | 'parquet'
  | 'json_file';

export interface ConnectionConfig {
  /** Reference to a secret in the cloud-native secrets manager - NEVER a raw credential */
  secret_ref: string;
  host?: string;
  port?: number;
  database?: string;
  schema?: string;
  table?: string;
  query?: string;
  /** For APIs */
  endpoint?: string;
  /** For file sources */
  path?: string;
  file_pattern?: string;
}

export interface SchemaDiscoveryConfig {
  enabled: boolean;
  sample_size?: number;
  infer_types?: boolean;
}

export interface IncrementalConfig {
  enabled: boolean;
  strategy: 'timestamp' | 'id' | 'cdc' | 'full_refresh';
  watermark_column?: string;
  lookback_window?: string; // ISO 8601 duration
}

export interface LayerConfig {
  layer: PipelineLayer;
  enabled: boolean;
  format: DataFormat;
  load_mode: LoadMode;
  partitioning?: PartitionConfig;
  transformations?: TransformationRule[];
  dedup?: DedupConfig;
  schema_enforcement?: SchemaEnforcementConfig;
}

export interface PartitionConfig {
  columns: string[];
  type: 'date' | 'hash' | 'range' | 'list';
  granularity?: 'year' | 'month' | 'day' | 'hour';
}

export interface TransformationRule {
  type: 'rename' | 'cast' | 'derive' | 'filter' | 'aggregate' | 'join' | 'pivot' | 'unpivot' | 'mask' | 'hash';
  config: Record<string, unknown>;
}

export interface DedupConfig {
  enabled: boolean;
  columns: string[];
  strategy: 'first' | 'last' | 'max' | 'min';
  order_by?: string;
}

export interface SchemaEnforcementConfig {
  mode: 'strict' | 'permissive' | 'evolve';
  null_rejection?: NullRejectionConfig;
  type_coercion?: boolean;
}

export interface NullRejectionConfig {
  columns: string[];
  action: 'reject' | 'quarantine' | 'default_value';
  default_values?: Record<string, unknown>;
}

export interface QualityConfig {
  enabled: boolean;
  checks: QualityCheck[];
  quarantine: QuarantineConfig;
  scoring?: QualityScoringConfig;
}

export interface QualityCheck {
  name: string;
  type: 'schema' | 'null' | 'unique' | 'referential' | 'range' | 'pattern' | 'custom_sql' | 'freshness';
  config: Record<string, unknown>;
  severity: 'error' | 'warning' | 'info';
  action_on_fail: 'halt' | 'quarantine' | 'warn' | 'skip_record';
}

export interface QuarantineConfig {
  enabled: boolean;
  destination: string;
  retention_days: number;
  include_metadata: boolean;
  replay_enabled: boolean;
}

export interface QualityScoringConfig {
  enabled: boolean;
  thresholds: {
    critical: number; // 0-100
    warning: number;
  };
}

export interface OrchestrationConfig {
  engine: 'airflow' | 'dagster' | 'step_functions' | 'databricks_workflows' | 'adf' | 'cloud_composer';
  schedule: string;
  retries: number;
  retry_delay_seconds: number;
  timeout_minutes: number;
  dependencies?: string[];
  backfill?: BackfillConfig;
  notifications?: NotificationConfig;
}

export interface BackfillConfig {
  enabled: boolean;
  max_parallel: number;
  start_date?: string;
}

export interface NotificationConfig {
  on_success?: NotificationTarget[];
  on_failure?: NotificationTarget[];
  on_sla_breach?: NotificationTarget[];
}

export interface NotificationTarget {
  type: 'email' | 'slack' | 'pagerduty' | 'teams';
  target: string;
}

export interface TargetConfig {
  cloud: CloudProvider;
  region?: string;
  service_overrides?: Record<string, unknown>;
}

export interface CloudOverrides {
  aws?: AWSOverrides;
  azure?: AzureOverrides;
  snowflake?: SnowflakeOverrides;
  databricks?: DatabricksOverrides;
}

export interface AWSOverrides {
  glue_version?: string;
  glue_workers?: number;
  s3_bucket?: string;
  redshift_cluster?: string;
  iam_role?: string;
}

export interface AzureOverrides {
  resource_group?: string;
  data_factory_name?: string;
  synapse_pool?: string;
  storage_account?: string;
}

export interface SnowflakeOverrides {
  warehouse?: string;
  database?: string;
  schema?: string;
  clustering_keys?: string[];
  dynamic_table_lag?: string;
}

export interface DatabricksOverrides {
  workspace_url?: string;
  cluster_id?: string;
  catalog?: string;
  liquid_clustering_columns?: string[];
}
