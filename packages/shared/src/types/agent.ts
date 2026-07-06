/**
 * Agent Types - Conversational AI Interface
 * Modeled after world-class chat interfaces (ChatGPT, Claude)
 * with data-engineering-specific capabilities.
 */

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error' | 'cancelled';
export type ConversationStatus = 'active' | 'archived' | 'deleted';

export interface Conversation {
  id: string;
  title: string;
  user_id: string;
  workspace_id: string;
  status: ConversationStatus;
  messages: Message[];
  pipeline_context?: PipelineContext;
  created_at: string;
  updated_at: string;
  pinned?: boolean;
  starred?: boolean;
  tags?: string[];
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  /** Rich content blocks for structured output (code, diagrams, YAML, etc.) */
  blocks?: ContentBlock[];
  /** Tool calls made during this message */
  tool_calls?: ToolCall[];
  /** Artifacts generated (pipeline code, configs, diagrams) */
  artifacts?: Artifact[];
  /** Thinking/reasoning steps (shown in expandable panel) */
  thinking?: ThinkingStep[];
  /** Token usage for this message */
  usage?: TokenUsage;
  /** Feedback from user */
  feedback?: MessageFeedback;
  created_at: string;
  duration_ms?: number;
}

export interface ContentBlock {
  type: 'text' | 'code' | 'yaml' | 'sql' | 'python' | 'markdown' | 'diagram' | 'table' | 'error' | 'warning' | 'success' | 'pipeline_preview';
  content: string;
  language?: string;
  title?: string;
  /** Whether this block can be copied independently */
  copyable?: boolean;
  /** Whether this block can be edited by the user */
  editable?: boolean;
  /** Line numbers for code blocks */
  line_numbers?: boolean;
  /** Highlighted lines */
  highlights?: number[];
}

export interface ToolCall {
  id: string;
  name: string;
  description: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'error';
  duration_ms?: number;
  started_at?: string;
  completed_at?: string;
}

export interface Artifact {
  id: string;
  type: 'pipeline_yaml' | 'generated_code' | 'diagram' | 'test_results' | 'deployment_plan' | 'cost_estimate' | 'lineage_graph' | 'schema_diff';
  title: string;
  content: string;
  language?: string;
  /** Whether this artifact requires approval before execution */
  requires_approval?: boolean;
  /** Version history for iterative refinement */
  version: number;
  previous_versions?: ArtifactVersion[];
  metadata?: Record<string, unknown>;
}

export interface ArtifactVersion {
  version: number;
  content: string;
  created_at: string;
  change_summary?: string;
}

export interface ThinkingStep {
  id: string;
  title: string;
  content: string;
  status: 'in_progress' | 'complete' | 'skipped';
  duration_ms?: number;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
}

export interface MessageFeedback {
  rating: 'positive' | 'negative';
  comment?: string;
  categories?: string[];
}

export interface PipelineContext {
  /** Current pipeline being worked on */
  pipeline_id?: string;
  pipeline_name?: string;
  /** Target cloud for this conversation */
  target_cloud?: string;
  /** Source systems referenced */
  sources?: string[];
  /** Current stage in the pipeline build process */
  stage?: PipelineBuildStage;
  /** Generated artifacts so far */
  artifact_ids?: string[];
}

export type PipelineBuildStage =
  | 'discovery'
  | 'source_connection'
  | 'mapping'
  | 'pipeline_generation'
  | 'quality_rules'
  | 'testing'
  | 'orchestration'
  | 'ci_cd'
  | 'deployment'
  | 'monitoring';

/** Agent capabilities - tools the agent can use */
export interface AgentCapability {
  name: string;
  description: string;
  category: 'discovery' | 'generation' | 'execution' | 'validation' | 'deployment';
  /** Whether this capability requires human approval */
  requires_approval: boolean;
  /** Input schema for this capability */
  input_schema: Record<string, unknown>;
}

/** Streaming event types for real-time UI updates */
export type StreamEvent =
  | { type: 'message_start'; message_id: string }
  | { type: 'content_delta'; content: string }
  | { type: 'content_block_start'; block: ContentBlock }
  | { type: 'content_block_delta'; block_index: number; content: string }
  | { type: 'content_block_end'; block_index: number }
  | { type: 'tool_call_start'; tool_call: ToolCall }
  | { type: 'tool_call_end'; tool_call_id: string; result: unknown }
  | { type: 'thinking_start'; step: ThinkingStep }
  | { type: 'thinking_end'; step_id: string }
  | { type: 'artifact_created'; artifact: Artifact }
  | { type: 'artifact_updated'; artifact: Artifact }
  | { type: 'approval_required'; action: string; details: Record<string, unknown> }
  | { type: 'message_end'; message_id: string; usage: TokenUsage }
  | { type: 'error'; code: string; message: string };

/** User preferences for the chat interface */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  font_size: 'small' | 'medium' | 'large';
  code_theme: string;
  show_thinking: boolean;
  show_token_usage: boolean;
  auto_scroll: boolean;
  keyboard_shortcuts: boolean;
  default_cloud: CloudProviderPreference;
  default_model_style: string;
  notifications_enabled: boolean;
  sound_enabled: boolean;
}

export type CloudProviderPreference = 'aws' | 'azure' | 'gcp' | 'snowflake' | 'databricks' | 'ask_every_time';
