/**
 * Execution Types - Pipeline execution, approval gates, and monitoring
 */

export type ExecutionStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'awaiting_approval' | 'approved' | 'rejected';
export type ExecutionEnvironment = 'sandbox' | 'dev' | 'staging' | 'production';

export interface PipelineExecution {
  id: string;
  pipeline_id: string;
  pipeline_name: string;
  environment: ExecutionEnvironment;
  status: ExecutionStatus;
  triggered_by: string; // user_id or 'agent'
  approval?: ApprovalRecord;
  stages: ExecutionStage[];
  metrics?: ExecutionMetrics;
  logs_url?: string;
  artifacts_url?: string;
  cost_estimate?: CostEstimate;
  started_at?: string;
  completed_at?: string;
  error?: ExecutionError;
}

export interface ExecutionStage {
  name: string;
  status: ExecutionStatus;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  outputs?: Record<string, unknown>;
  logs?: string[];
}

export interface ApprovalRecord {
  required: boolean;
  reason: string;
  requested_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  decision?: 'approved' | 'rejected';
  comment?: string;
  /** What specifically needs approval */
  scope: ApprovalScope[];
}

export interface ApprovalScope {
  type: 'production_deploy' | 'real_data_access' | 'credential_use' | 'infra_change' | 'iam_modification';
  resource: string;
  action: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

export interface ExecutionMetrics {
  rows_processed: number;
  rows_accepted: number;
  rows_quarantined: number;
  bytes_read: number;
  bytes_written: number;
  duration_seconds: number;
  cost_usd: number;
  quality_score?: number;
}

export interface CostEstimate {
  compute_usd: number;
  storage_usd: number;
  network_usd: number;
  ai_inference_usd: number;
  total_usd: number;
  confidence: 'low' | 'medium' | 'high';
  breakdown?: CostBreakdownItem[];
}

export interface CostBreakdownItem {
  service: string;
  operation: string;
  quantity: number;
  unit: string;
  unit_cost_usd: number;
  total_usd: number;
}

export interface ExecutionError {
  code: string;
  message: string;
  stage: string;
  recoverable: boolean;
  suggested_fix?: string;
  stack_trace?: string;
}

/** Real-time execution timeline events for the UI */
export interface TimelineEvent {
  id: string;
  execution_id: string;
  timestamp: string;
  type: 'stage_start' | 'stage_end' | 'log' | 'metric' | 'error' | 'approval_request' | 'approval_response';
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  severity?: 'info' | 'warning' | 'error';
}

/** Budget/guardrail configuration */
export interface ExecutionGuardrails {
  max_cost_per_run_usd: number;
  max_rows_per_run: number;
  max_duration_minutes: number;
  max_step_function_steps: number;
  auto_cancel_on_breach: boolean;
  notify_at_percentage: number; // e.g. 80 = notify at 80% of budget
}
