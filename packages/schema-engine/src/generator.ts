/**
 * Pipeline Schema Generator
 * Generates pipeline YAML from natural language descriptions
 * using the agent's understanding of the user's intent.
 */

import type { PipelineSpec, SourceType, CloudProvider } from '@eadpa/shared';
import { PipelineYAMLParser } from './parser';

export interface GenerationContext {
  user_intent: string;
  source_type?: SourceType;
  target_cloud?: CloudProvider;
  owner: string;
  existing_schema?: Record<string, unknown>;
  preferences?: GenerationPreferences;
}

export interface GenerationPreferences {
  default_format: string;
  default_load_mode: string;
  include_quality: boolean;
  include_orchestration: boolean;
  model_style: string;
}

export class PipelineSchemaGenerator {
  private parser: PipelineYAMLParser;

  constructor() {
    this.parser = new PipelineYAMLParser();
  }

  /**
   * Generate a pipeline spec from structured context
   * (The actual NLP → spec conversion happens in the AI layer;
   * this handles the structured generation after intent is parsed)
   */
  generateFromContext(context: GenerationContext): string {
    return this.parser.generateTemplate({
      name: this.slugify(context.user_intent),
      sourceType: context.source_type || 'postgres',
      targetCloud: context.target_cloud || 'aws',
      owner: context.owner,
      includeQuality: context.preferences?.include_quality ?? true,
      includeOrchestration: context.preferences?.include_orchestration ?? true,
    });
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 64);
  }
}
