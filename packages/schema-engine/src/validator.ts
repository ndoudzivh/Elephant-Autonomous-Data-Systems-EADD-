/**
 * Pipeline Schema Validator
 * Validates pipeline YAML/JSON against the canonical schema
 */

import Ajv from 'ajv';
import { PIPELINE_JSON_SCHEMA } from './schema';
import { ValidationResult, ValidationError, ValidationWarning, ValidationSuggestion } from './types';
import { SchemaValidationError } from './errors';
import type { PipelineSpec } from '@eadpa/shared';

export class PipelineSchemaValidator {
  private ajv: Ajv;
  private validate: ReturnType<Ajv['compile']>;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
    });
    this.validate = this.ajv.compile(PIPELINE_JSON_SCHEMA);
  }

  /**
   * Validate a pipeline spec object against the schema
   */
  validateSpec(spec: unknown): ValidationResult {
    const valid = this.validate(spec);
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    if (!valid && this.validate.errors) {
      for (const error of this.validate.errors) {
        errors.push({
          path: error.instancePath || '/',
          message: error.message || 'Unknown validation error',
          code: error.keyword || 'unknown',
          severity: 'error',
        });
      }
    }

    // Additional semantic validations beyond JSON Schema
    if (valid || errors.length === 0) {
      const semanticResult = this.runSemanticValidations(spec as PipelineSpec);
      warnings.push(...semanticResult.warnings);
      suggestions.push(...semanticResult.suggestions);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Validate and throw on error (convenience method)
   */
  validateOrThrow(spec: unknown): PipelineSpec {
    const result = this.validateSpec(spec);
    if (!result.valid) {
      throw new SchemaValidationError(
        `Pipeline schema validation failed with ${result.errors.length} error(s)`,
        result.errors.map(e => ({ path: e.path, message: e.message, code: e.code }))
      );
    }
    return spec as PipelineSpec;
  }

  /**
   * Run semantic validations that go beyond structural JSON Schema checks
   */
  private runSemanticValidations(spec: PipelineSpec): {
    warnings: ValidationWarning[];
    suggestions: ValidationSuggestion[];
  } {
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    // Check layer ordering
    const layers = spec.layers?.map(l => l.layer) || [];
    const expectedOrder = ['bronze', 'silver', 'gold'];
    const layerIndices = layers.map(l => expectedOrder.indexOf(l));
    for (let i = 1; i < layerIndices.length; i++) {
      if (layerIndices[i]! <= layerIndices[i - 1]!) {
        warnings.push({
          path: '/layers',
          message: 'Layers should be ordered bronze → silver → gold',
          code: 'layer_ordering',
          severity: 'warning',
          suggestion: 'Reorder layers to follow the medallion architecture convention',
        });
        break;
      }
    }

    // Check incremental config completeness
    if (spec.source?.incremental?.enabled && !spec.source.incremental.watermark_column) {
      if (spec.source.incremental.strategy !== 'full_refresh') {
        warnings.push({
          path: '/source/incremental/watermark_column',
          message: 'Incremental ingestion enabled without watermark_column specified',
          code: 'missing_watermark',
          severity: 'warning',
          suggestion: 'Specify a timestamp or ID column as the watermark for incremental loads',
        });
      }
    }

    // Suggest SCD2 for gold layer without explicit load mode
    const goldLayer = spec.layers?.find(l => l.layer === 'gold');
    if (goldLayer && goldLayer.load_mode === 'append') {
      suggestions.push({
        path: '/layers/gold/load_mode',
        message: 'Gold layer using append mode - consider merge or SCD2 for dimensional data',
        suggested_value: 'merge',
        reason: 'Gold layer typically represents curated business data that benefits from merge/upsert semantics',
      });
    }

    // Check quality config presence
    if (!spec.quality || !spec.quality.enabled) {
      suggestions.push({
        path: '/quality',
        message: 'No data quality checks configured',
        suggested_value: { enabled: true },
        reason: 'Production pipelines should have at minimum schema and null checks to catch data issues early',
      });
    }

    // Warn about missing partitioning on large tables
    for (const layer of spec.layers || []) {
      if (!layer.partitioning && layer.format !== 'csv') {
        suggestions.push({
          path: `/layers/${layer.layer}/partitioning`,
          message: `Consider adding partitioning to the ${layer.layer} layer`,
          reason: 'Partitioning improves query performance and reduces scan costs on cloud storage',
        });
      }
    }

    // Check for dangerous full_refresh on large datasets
    if (spec.source?.incremental?.strategy === 'full_refresh') {
      warnings.push({
        path: '/source/incremental/strategy',
        message: 'Full refresh strategy will reload all data on every run',
        code: 'full_refresh_warning',
        severity: 'warning',
        suggestion: 'Consider timestamp or CDC strategy for large datasets to reduce cost and execution time',
      });
    }

    return { warnings, suggestions };
  }
}
