/**
 * System-wide constants
 */

export const APP_NAME = 'EADPA';
export const APP_FULL_NAME = 'Enterprise Autonomous Data Pipeline Agent';
export const APP_VERSION = '0.1.0';
export const APP_DESCRIPTION = 'AI-powered data engineering copilot that builds, tests, and deploys real data pipelines through conversation.';

/** Supported cloud providers */
export const CLOUD_PROVIDERS = ['aws', 'azure', 'gcp', 'snowflake', 'databricks'] as const;

/** Pipeline layers */
export const PIPELINE_LAYERS = ['bronze', 'silver', 'gold'] as const;

/** Supported source types */
export const SOURCE_TYPES = {
  databases: ['postgres', 'mysql', 'sqlserver', 'oracle', 'mongodb'] as const,
  saas: ['salesforce', 'hubspot', 'rest_api', 'graphql'] as const,
  streaming: ['kafka', 'kinesis', 'pubsub'] as const,
  files: ['s3', 'gcs', 'azure_blob', 'sftp', 'csv', 'parquet', 'json_file'] as const,
} as const;

/** Agent tool categories */
export const AGENT_TOOL_CATEGORIES = {
  discovery: 'Schema discovery and source analysis',
  generation: 'Code and configuration generation',
  execution: 'Pipeline execution in sandbox environments',
  validation: 'Testing and quality validation',
  deployment: 'Production deployment (requires approval)',
} as const;

/** Approval-required actions (Section 9 of requirements) */
export const APPROVAL_REQUIRED_ACTIONS = [
  'production_deploy',
  'real_data_access',
  'credential_storage',
  'iam_modification',
  'infra_creation',
  'merge_to_protected_branch',
] as const;

/** Auto-execute actions (sandbox/dev only) */
export const AUTO_EXECUTE_ACTIONS = [
  'schema_discovery',
  'code_generation',
  'sandbox_execution',
  'test_execution',
  'iteration_on_failure',
  'config_generation',
] as const;

/** Default execution guardrails */
export const DEFAULT_GUARDRAILS = {
  max_cost_per_run_usd: 50,
  max_rows_per_run: 10_000_000,
  max_duration_minutes: 60,
  max_step_function_steps: 100,
  auto_cancel_on_breach: true,
  notify_at_percentage: 80,
} as const;

/** Quality scoring defaults */
export const DEFAULT_QUALITY_THRESHOLDS = {
  excellent: 95,
  good: 85,
  acceptable: 70,
  poor: 50,
} as const;

/** Bedrock model configuration */
export const BEDROCK_CONFIG = {
  default_model: 'anthropic.claude-sonnet-4-20250514',
  max_tokens: 8192,
  temperature: 0.3, // Lower for more deterministic code generation
  top_p: 0.9,
  region: 'us-east-1',
} as const;

/** Rate limiting */
export const RATE_LIMITS = {
  free: {
    messages_per_hour: 20,
    pipelines_per_day: 5,
    max_tokens_per_message: 4096,
  },
  professional: {
    messages_per_hour: 100,
    pipelines_per_day: 50,
    max_tokens_per_message: 8192,
  },
  enterprise: {
    messages_per_hour: 1000,
    pipelines_per_day: 500,
    max_tokens_per_message: 16384,
  },
} as const;

/** Keyboard shortcuts */
export const KEYBOARD_SHORTCUTS = {
  send_message: 'Enter',
  new_line: 'Shift+Enter',
  new_conversation: 'Ctrl+Shift+N',
  search_conversations: 'Ctrl+K',
  toggle_sidebar: 'Ctrl+B',
  toggle_theme: 'Ctrl+Shift+D',
  copy_last_code: 'Ctrl+Shift+C',
  regenerate: 'Ctrl+Shift+R',
  focus_input: '/',
} as const;
