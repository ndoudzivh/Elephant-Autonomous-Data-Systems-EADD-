/**
 * Data Quality Types
 * Schema validation, null checks, uniqueness, referential integrity,
 * quarantine system, and quality scoring.
 */

export type QualityCheckType = 'schema' | 'null' | 'unique' | 'referential' | 'range' | 'pattern' | 'custom_sql' | 'freshness' | 'volume' | 'statistical';
export type QualityStatus = 'passed' | 'failed' | 'warning' | 'skipped' | 'error';

export interface QualityProfile {
  id: string;
  name: string;
  description?: string;
  pipeline_id: string;
  checks: QualityCheckDefinition[];
  scoring: ScoringConfig;
  quarantine: QuarantineSettings;
  created_at: string;
  updated_at: string;
}

export interface QualityCheckDefinition {
  id: string;
  name: string;
  description?: string;
  type: QualityCheckType;
  layer: 'bronze' | 'silver' | 'gold' | 'all';
  severity: 'critical' | 'major' | 'minor' | 'info';
  action_on_fail: 'halt_pipeline' | 'quarantine_record' | 'quarantine_batch' | 'warn_continue' | 'skip_record';
  config: QualityCheckConfig;
  enabled: boolean;
}

export type QualityCheckConfig =
  | SchemaCheckConfig
  | NullCheckConfig
  | UniqueCheckConfig
  | ReferentialCheckConfig
  | RangeCheckConfig
  | PatternCheckConfig
  | CustomSqlCheckConfig
  | FreshnessCheckConfig
  | VolumeCheckConfig
  | StatisticalCheckConfig;

export interface SchemaCheckConfig {
  type: 'schema';
  expected_columns: ExpectedColumn[];
  allow_extra_columns: boolean;
  strict_types: boolean;
}

export interface ExpectedColumn {
  name: string;
  data_type: string;
  nullable: boolean;
}

export interface NullCheckConfig {
  type: 'null';
  columns: string[];
  max_null_percentage?: number;
  max_null_count?: number;
}

export interface UniqueCheckConfig {
  type: 'unique';
  columns: string[];
  allow_nulls: boolean;
}

export interface ReferentialCheckConfig {
  type: 'referential';
  source_column: string;
  reference_table: string;
  reference_column: string;
  allow_null: boolean;
}

export interface RangeCheckConfig {
  type: 'range';
  column: string;
  min?: number | string;
  max?: number | string;
  inclusive: boolean;
}

export interface PatternCheckConfig {
  type: 'pattern';
  column: string;
  pattern: string; // regex
  match_type: 'full' | 'partial';
}

export interface CustomSqlCheckConfig {
  type: 'custom_sql';
  query: string;
  expected_result: 'no_rows' | 'single_value';
  expected_value?: unknown;
}

export interface FreshnessCheckConfig {
  type: 'freshness';
  timestamp_column: string;
  max_delay_minutes: number;
}

export interface VolumeCheckConfig {
  type: 'volume';
  min_rows?: number;
  max_rows?: number;
  expected_growth_rate?: number; // percentage
  tolerance_percentage?: number;
}

export interface StatisticalCheckConfig {
  type: 'statistical';
  column: string;
  check: 'mean' | 'stddev' | 'percentile' | 'distribution';
  expected_value?: number;
  tolerance?: number;
}

/** Results from a quality check run */
export interface QualityRunResult {
  id: string;
  profile_id: string;
  execution_id: string;
  pipeline_id: string;
  overall_status: QualityStatus;
  overall_score: number; // 0-100
  check_results: QualityCheckResult[];
  summary: QualityRunSummary;
  started_at: string;
  completed_at: string;
}

export interface QualityCheckResult {
  check_id: string;
  check_name: string;
  status: QualityStatus;
  records_checked: number;
  records_passed: number;
  records_failed: number;
  failure_percentage: number;
  sample_failures?: Record<string, unknown>[];
  duration_ms: number;
  error_message?: string;
}

export interface QualityRunSummary {
  total_checks: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  total_records: number;
  quarantined_records: number;
  score: number;
  trend?: 'improving' | 'stable' | 'degrading';
}

export interface ScoringConfig {
  enabled: boolean;
  weights: Record<QualityCheckType, number>;
  thresholds: {
    excellent: number; // e.g. 95
    good: number; // e.g. 85
    acceptable: number; // e.g. 70
    poor: number; // below this = critical
  };
}

export interface QuarantineSettings {
  enabled: boolean;
  storage_location: string;
  retention_days: number;
  include_original_record: boolean;
  include_failure_reason: boolean;
  include_check_metadata: boolean;
  replay_enabled: boolean;
  max_quarantine_percentage: number; // halt pipeline if exceeded
}

export interface QuarantinedRecord {
  id: string;
  execution_id: string;
  check_id: string;
  original_record: Record<string, unknown>;
  failure_reasons: string[];
  quarantined_at: string;
  replayed: boolean;
  replayed_at?: string;
}
