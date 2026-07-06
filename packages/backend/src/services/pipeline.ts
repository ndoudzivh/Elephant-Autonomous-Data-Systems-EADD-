/**
 * Pipeline Service
 * Manages pipeline lifecycle: creation, validation, code generation
 */

import { v4 as uuidv4 } from 'uuid';
import { PipelineYAMLParser } from '@eadpa/schema-engine';
import type { PipelineSpec } from '@eadpa/shared';

interface StoredPipeline {
  id: string;
  workspace_id: string;
  name: string;
  spec: PipelineSpec;
  yaml_content: string;
  status: 'draft' | 'validated' | 'compiled' | 'deployed';
  generated_code?: Record<string, string>;
  created_at: string;
  updated_at: string;
  created_by: string;
}

const pipelineStore: Map<string, StoredPipeline> = new Map();
const parser = new PipelineYAMLParser();

export class PipelineService {
  async listPipelines(params: {
    workspaceId: string;
    status?: string;
    cloud?: string;
    page: number;
    limit: number;
  }) {
    let pipelines = Array.from(pipelineStore.values())
      .filter(p => p.workspace_id === params.workspaceId);

    if (params.status) {
      pipelines = pipelines.filter(p => p.status === params.status);
    }
    if (params.cloud) {
      pipelines = pipelines.filter(p => p.spec.target.cloud === params.cloud);
    }

    pipelines.sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    const total = pipelines.length;
    const offset = (params.page - 1) * params.limit;

    return {
      items: pipelines.slice(offset, offset + params.limit),
      total,
      page: params.page,
      has_more: offset + params.limit < total,
    };
  }

  async getPipeline(id: string, workspaceId: string) {
    const pipeline = pipelineStore.get(id);
    if (!pipeline || pipeline.workspace_id !== workspaceId) return null;
    return pipeline;
  }

  async getPipelineSpec(id: string, workspaceId: string) {
    const pipeline = pipelineStore.get(id);
    if (!pipeline || pipeline.workspace_id !== workspaceId) return null;
    return pipeline.yaml_content;
  }

  validatePipelineYAML(yamlContent: string) {
    try {
      const result = parser.parse(yamlContent);
      return {
        valid: result.validation.valid,
        errors: result.validation.errors,
        warnings: result.validation.warnings,
        suggestions: result.validation.suggestions,
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [{ path: '/', message: error.message, code: 'PARSE_ERROR' }],
        warnings: [],
        suggestions: [],
      };
    }
  }

  async createPipeline(params: {
    workspaceId: string;
    userId: string;
    yamlContent: string;
  }): Promise<StoredPipeline> {
    const parsed = parser.parse(params.yamlContent);
    if (!parsed.validation.valid) {
      throw new Error(`Invalid pipeline: ${parsed.validation.errors.map(e => e.message).join(', ')}`);
    }

    const pipeline: StoredPipeline = {
      id: uuidv4(),
      workspace_id: params.workspaceId,
      name: parsed.spec.name,
      spec: parsed.spec,
      yaml_content: params.yamlContent,
      status: 'validated',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: params.userId,
    };

    pipelineStore.set(pipeline.id, pipeline);
    return pipeline;
  }

  async getGeneratedCode(id: string, workspaceId: string, format: string) {
    const pipeline = pipelineStore.get(id);
    if (!pipeline || pipeline.workspace_id !== workspaceId) return null;
    return pipeline.generated_code || {};
  }

  async getPipelineLineage(id: string, workspaceId: string) {
    const pipeline = pipelineStore.get(id);
    if (!pipeline || pipeline.workspace_id !== workspaceId) return null;

    // Generate lineage graph structure
    return {
      nodes: [
        { id: 'source', type: 'source', label: pipeline.spec.source.type },
        { id: 'bronze', type: 'layer', label: 'Bronze' },
        { id: 'silver', type: 'layer', label: 'Silver' },
        { id: 'gold', type: 'layer', label: 'Gold' },
        { id: 'target', type: 'target', label: pipeline.spec.target.cloud },
      ],
      edges: [
        { from: 'source', to: 'bronze' },
        { from: 'bronze', to: 'silver' },
        { from: 'silver', to: 'gold' },
        { from: 'gold', to: 'target' },
      ],
    };
  }
}
