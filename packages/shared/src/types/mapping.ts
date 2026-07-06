/**
 * Source-to-Target Mapping Types
 * Column-level mapping with transformation rules
 */

export type MappingStatus = 'draft' | 'validated' | 'approved' | 'deployed';
export type TransformationType = 'direct' | 'rename' | 'cast' | 'derive' | 'lookup' | 'concatenate' | 'split' | 'conditional' | 'aggregate' | 'hash' | 'mask' | 'default';

export interface SourceToTargetMapping {
  id: string;
  name: string;
  description?: string;
  status: MappingStatus;
  source: MappingSource;
  target: MappingTarget;
  column_mappings: ColumnMapping[];
  business_rules?: BusinessRule[];
  schema_drift_policy?: SchemaDriftPolicy;
  version: number;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface MappingSource {
  system: string;
  type: string;
  database?: string;
  schema?: string;
  table?: string;
  columns: SourceColumn[];
}

export interface SourceColumn {
  name: string;
  data_type: string;
  nullable: boolean;
  primary_key?: boolean;
  description?: string;
  sample_values?: string[];
  statistics?: ColumnStatistics;
}

export interface ColumnStatistics {
  distinct_count?: number;
  null_count?: number;
  null_percentage?: number;
  min_value?: string;
  max_value?: string;
  avg_length?: number;
  pattern?: string; // detected pattern (e.g., email, phone, date)
}

export interface MappingTarget {
  model_style: 'star_schema' | 'data_vault' | 'flat' | 'scd2' | 'scd1';
  database?: string;
  schema?: string;
  tables: TargetTable[];
}

export interface TargetTable {
  name: string;
  type: 'fact' | 'dimension' | 'hub' | 'satellite' | 'link' | 'staging' | 'intermediate' | 'mart';
  columns: TargetColumn[];
  primary_key: string[];
  foreign_keys?: ForeignKey[];
  indexes?: Index[];
}

export interface TargetColumn {
  name: string;
  data_type: string;
  nullable: boolean;
  default_value?: string;
  description?: string;
  is_surrogate_key?: boolean;
  is_business_key?: boolean;
  scd_type?: 1 | 2;
}

export interface ForeignKey {
  columns: string[];
  references_table: string;
  references_columns: string[];
}

export interface Index {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface ColumnMapping {
  id: string;
  source_column: string;
  source_table?: string;
  target_column: string;
  target_table: string;
  transformation: TransformationSpec;
  validation_rules?: ValidationRule[];
  notes?: string;
}

export interface TransformationSpec {
  type: TransformationType;
  /** For rename */
  new_name?: string;
  /** For cast */
  target_type?: string;
  /** For derive */
  expression?: string;
  /** For lookup */
  lookup_table?: string;
  lookup_key?: string;
  lookup_value?: string;
  /** For conditional */
  conditions?: ConditionalRule[];
  /** For hash/mask */
  algorithm?: string;
  /** For default */
  default_value?: unknown;
  /** For concatenate */
  separator?: string;
  source_columns?: string[];
}

export interface ConditionalRule {
  condition: string;
  then_value: string;
  else_value?: string;
}

export interface ValidationRule {
  type: 'not_null' | 'unique' | 'range' | 'pattern' | 'reference' | 'custom';
  config: Record<string, unknown>;
  error_message: string;
}

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  type: 'filter' | 'transform' | 'validation' | 'derived_field';
  expression: string;
  priority: number;
}

export interface SchemaDriftPolicy {
  detection_enabled: boolean;
  action_on_new_column: 'ignore' | 'add_nullable' | 'quarantine' | 'halt';
  action_on_removed_column: 'ignore' | 'null_fill' | 'quarantine' | 'halt';
  action_on_type_change: 'coerce' | 'quarantine' | 'halt';
  notification_enabled: boolean;
}
