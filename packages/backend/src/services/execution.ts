/**
 * Execution Service
 * Manages pipeline executions, approval gates, and monitoring
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  PipelineExecution,
  ExecutionStatus,
  ExecutionEnvironment,
  TimelineEvent,
  ExecutionGuardrails,
} from '@eadpa/shared';
import { DEFAULT_GUARDRAILS } from '@eadpa/shared';

const executionStore: Map<string, PipelineExecution> = new Map();
const timelineStore: Map<string, TimelineEvent[]> = new Map();

export class ExecutionService {
  private guardrails: ExecutionGuardrails = DEFAULT_GUARDRAILS as unknown as ExecutionGuardrails;

  async listExecutions(params: {
    workspaceId: string;
    pipelineId?: string;
    status?: string;
    environment?: string;
  }) {
    let executions = Array.from(executionStore.values());

    if (params.pipelineId) {
      executions = executions.filter(e => e.pipeline_id === params.pipelineId);
    }
    if (params.status) {
      executions = executions.filter(e => e.status === params.status);
    }
    if (params.environment) {
      executions = executions.filter(e => e.environment === params.environment);
    }

    return { items: executions };
  }

  async getExecution(id: string, workspaceId: string) {
    return executionStore.get(id) || null;
  }

  async executeSandbox(params: {
    pipelineId: string;
    userId: string;
    workspaceId: string;
    sampleData?: unknown;
  }): Promise<PipelineExecution> {
    const execution: PipelineExecution = {
      id: uuidv4(),
      pipeline_id: params.pipelineId,
      pipeline_name: 'Pipeline',
      environment: 'sandbox',
      status: 'running',
      triggered_by: params.userId,
      stages: [
        { name: 'Initialize', status: 'success' },
        { name: 'Ingest (Bronze)', status: 'running' },
        { name: 'Transform (Silver)', status: 'queued' },
        { name: 'Aggregate (Gold)', status: 'queued' },
        { name: 'Quality Checks', status: 'queued' },
      ],
      started_at: new Date().toISOString(),
    };

    executionStore.set(execution.id, execution);
    this.addTimelineEvent(execution.id, {
      type: 'stage_start',
      title: 'Sandbox execution started',
      description: 'Running pipeline against sample data',
    });

    return execution;
  }

  async requestProductionExecution(params: {
    pipelineId: string;
    userId: string;
    workspaceId: string;
    environment: string;
    reason?: string;
  }): Promise<PipelineExecution> {
    const execution: PipelineExecution = {
      id: uuidv4(),
      pipeline_id: params.pipelineId,
      pipeline_name: 'Pipeline',
      environment: params.environment as ExecutionEnvironment,
      status: 'awaiting_approval',
      triggered_by: params.userId,
      approval: {
        required: true,
        reason: params.reason || 'Production deployment requires approval',
        requested_at: new Date().toISOString(),
        scope: [
          {
            type: 'production_deploy',
            resource: params.pipelineId,
            action: 'execute',
            risk_level: 'high',
          },
          {
            type: 'real_data_access',
            resource: 'source_database',
            action: 'read',
            risk_level: 'high',
          },
        ],
      },
      stages: [],
      cost_estimate: {
        compute_usd: 2.50,
        storage_usd: 0.15,
        network_usd: 0.05,
        ai_inference_usd: 0,
        total_usd: 2.70,
        confidence: 'medium',
      },
    };

    executionStore.set(execution.id, execution);
    this.addTimelineEvent(execution.id, {
      type: 'approval_request',
      title: 'Approval required',
      description: `Production execution requested. Estimated cost: $${execution.cost_estimate!.total_usd}`,
      severity: 'warning',
    });

    return execution;
  }

  async approveExecution(id: string, approvedBy: string, comment?: string) {
    const execution = executionStore.get(id);
    if (!execution) throw new Error('Execution not found');
    if (execution.status !== 'awaiting_approval') {
      throw new Error('Execution is not awaiting approval');
    }

    execution.status = 'running';
    execution.approval!.reviewed_by = approvedBy;
    execution.approval!.reviewed_at = new Date().toISOString();
    execution.approval!.decision = 'approved';
    execution.approval!.comment = comment;
    execution.started_at = new Date().toISOString();

    this.addTimelineEvent(id, {
      type: 'approval_response',
      title: 'Execution approved',
      description: comment || 'Approved by reviewer',
    });

    return execution;
  }

  async rejectExecution(id: string, rejectedBy: string, reason?: string) {
    const execution = executionStore.get(id);
    if (!execution) throw new Error('Execution not found');

    execution.status = 'rejected' as ExecutionStatus;
    execution.approval!.reviewed_by = rejectedBy;
    execution.approval!.reviewed_at = new Date().toISOString();
    execution.approval!.decision = 'rejected';
    execution.approval!.comment = reason;

    this.addTimelineEvent(id, {
      type: 'approval_response',
      title: 'Execution rejected',
      description: reason || 'Rejected by reviewer',
      severity: 'error',
    });

    return execution;
  }

  async cancelExecution(id: string, cancelledBy: string) {
    const execution = executionStore.get(id);
    if (!execution) throw new Error('Execution not found');

    execution.status = 'cancelled';
    execution.completed_at = new Date().toISOString();

    this.addTimelineEvent(id, {
      type: 'stage_end',
      title: 'Execution cancelled',
      description: `Cancelled by user`,
    });
  }

  async getTimeline(id: string, workspaceId: string) {
    return timelineStore.get(id) || [];
  }

  private addTimelineEvent(
    executionId: string,
    event: Omit<TimelineEvent, 'id' | 'execution_id' | 'timestamp'>
  ) {
    const timeline = timelineStore.get(executionId) || [];
    timeline.push({
      id: uuidv4(),
      execution_id: executionId,
      timestamp: new Date().toISOString(),
      ...event,
    });
    timelineStore.set(executionId, timeline);
  }
}
