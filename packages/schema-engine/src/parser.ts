/**
 * Pipeline YAML Parser
 * Parses YAML pipeline definitions into validated PipelineSpec objects
 */

import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';
import { PipelineSchemaValidator } from './validator';
import { SchemaParseError } from './errors';
import { ParsedPipeline } from './types';
import type { PipelineSpec } from '@eadpa/shared';

export class PipelineYAMLParser {
  private validator: PipelineSchemaValidator;

  constructor() {
    this.validator = new PipelineSchemaValidator();
  }

  /**
   * Parse a YAML string into a validated PipelineSpec
   */
  parse(yamlContent: string): ParsedPipeline {
    const startTime = Date.now();

    // Parse YAML to object
    let rawObject: unknown;
    try {
      rawObject = parseYAML(yamlContent, {
        strict: true,
        uniqueKeys: true,
      });
    } catch (error: unknown) {
      const yamlError = error as { message?: string; linePos?: Array<{ line: number; col: number }> };
      throw new SchemaParseError(
        `YAML parse error: ${yamlError.message || 'Unknown error'}`,
        yamlError.linePos?.[0]?.line,
        yamlError.linePos?.[0]?.col
      );
    }

    if (!rawObject || typeof rawObject !== 'object') {
      throw new SchemaParseError('YAML content must be a valid object');
    }

    // Validate against schema
    const validation = this.validator.validateSpec(rawObject);

    return {
      spec: rawObject as PipelineSpec,
      raw_yaml: yamlContent,
      validation,
      metadata: {
        parse_duration_ms: Date.now() - startTime,
        schema_version: '1.0.0',
        line_count: yamlContent.split('\n').length,
      },
    };
  }

  /**
   * Convert a PipelineSpec back to YAML
   */
  toYAML(spec: PipelineSpec): string {
    return stringifyYAML(spec, {
      indent: 2,
      lineWidth: 120,
      defaultKeyType: 'PLAIN',
      defaultStringType: 'QUOTE_DOUBLE',
    });
  }

  /**
   * Generate a minimal valid pipeline YAML template
   */
  generateTemplate(options: {
    name: string;
    sourceType: string;
    targetCloud: string;
    owner: string;
    includeQuality?: boolean;
    includeOrchestration?: boolean;
  }): string {
    const template: Record<string, unknown> = {
      name: options.name,
      version: '1.0.0',
      description: `Data pipeline for ${options.name}`,
      metadata: {
        owner: options.owner,
        tags: {
          environment: 'dev',
          generated_by: 'eadpa',
        },
      },
      source: {
        type: options.sourceType,
        connection: {
          secret_ref: `secrets/${options.name}/source-credentials`,
        },
        incremental: {
          enabled: true,
          strategy: 'timestamp',
          watermark_column: 'updated_at',
        },
      },
      layers: [
        {
          layer: 'bronze',
          format: 'delta',
          load_mode: 'append',
          schema_enforcement: {
            mode: 'permissive',
            type_coercion: false,
          },
        },
        {
          layer: 'silver',
          format: 'delta',
          load_mode: 'merge',
          dedup: {
            enabled: true,
            columns: ['id'],
            strategy: 'last',
            order_by: 'updated_at',
          },
          schema_enforcement: {
            mode: 'strict',
            null_rejection: {
              columns: ['id'],
              action: 'quarantine',
            },
          },
        },
        {
          layer: 'gold',
          format: 'delta',
          load_mode: 'merge',
          partitioning: {
            columns: ['date'],
            type: 'date',
            granularity: 'day',
          },
        },
      ],
      target: {
        cloud: options.targetCloud,
      },
    };

    if (options.includeQuality !== false) {
      template.quality = {
        enabled: true,
        checks: [
          {
            name: 'schema_valid',
            type: 'schema',
            severity: 'error',
            action_on_fail: 'halt',
          },
          {
            name: 'no_null_ids',
            type: 'null',
            config: { columns: ['id'] },
            severity: 'error',
            action_on_fail: 'quarantine',
          },
          {
            name: 'unique_ids',
            type: 'unique',
            config: { columns: ['id'] },
            severity: 'warning',
            action_on_fail: 'warn',
          },
        ],
        quarantine: {
          enabled: true,
          retention_days: 30,
          replay_enabled: true,
        },
      };
    }

    if (options.includeOrchestration !== false) {
      template.orchestration = {
        engine: options.targetCloud === 'aws' ? 'step_functions' : 'airflow',
        schedule: '0 6 * * *',
        retries: 3,
        retry_delay_seconds: 300,
        timeout_minutes: 60,
      };
    }

    return stringifyYAML(template, {
      indent: 2,
      lineWidth: 120,
    });
  }
}
