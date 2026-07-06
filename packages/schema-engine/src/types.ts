/**
 * Schema Engine specific types
 */

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions?: ValidationSuggestion[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
  severity: 'error';
  line?: number;
  column?: number;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
  severity: 'warning';
  suggestion?: string;
}

export interface ValidationSuggestion {
  path: string;
  message: string;
  suggested_value?: unknown;
  reason: string;
}

export interface SchemaVersion {
  version: string;
  released_at: string;
  changes: string[];
  backwards_compatible: boolean;
}

export interface ParsedPipeline {
  spec: import('@eadpa/shared').PipelineSpec;
  raw_yaml: string;
  validation: ValidationResult;
  metadata: {
    parse_duration_ms: number;
    schema_version: string;
    line_count: number;
  };
}
