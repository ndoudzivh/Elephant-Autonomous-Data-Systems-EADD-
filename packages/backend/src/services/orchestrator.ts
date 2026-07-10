/**
 * Agent Orchestrator
 * The "brain" - coordinates LLM reasoning with tool execution
 * to build data pipelines through conversation.
 *
 * This is the core service that makes EADPA feel like ChatGPT/Claude
 * but specialized for data engineering.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Message,
  StreamEvent,
  ToolCall,
  Artifact,
  ThinkingStep,
  TokenUsage,
  AgentCapability,
  ContentBlock,
} from '@eadpa/shared';
import { ConversationService } from './conversation';
import { PipelineService } from './pipeline';
import { BedrockClient } from './bedrock-client';

interface ProcessMessageParams {
  conversationId: string;
  userId: string;
  workspaceId: string;
  message: string;
  attachments?: unknown[];
  modelPreferences?: Record<string, unknown>;
}

interface RegenerateParams {
  conversationId: string;
  messageId: string;
  userId: string;
  workspaceId: string;
}

export class AgentOrchestrator {
  private conversationService: ConversationService;
  private pipelineService: PipelineService;
  private bedrockClient: BedrockClient;
  private activeGenerations: Map<string, AbortController> = new Map();

  constructor() {
    this.conversationService = new ConversationService();
    this.pipelineService = new PipelineService();
    this.bedrockClient = new BedrockClient();
  }

  /**
   * Process a user message and stream the response
   * This is an async generator that yields StreamEvents
   */
  async *processMessage(params: ProcessMessageParams): AsyncGenerator<StreamEvent> {
    const messageId = uuidv4();
    const abortController = new AbortController();
    const generationKey = `${params.conversationId}:${messageId}`;
    this.activeGenerations.set(generationKey, abortController);

    try {
      // Signal message start
      yield { type: 'message_start', message_id: messageId };

      // Save user message
      const userMessage: Message = {
        id: uuidv4(),
        conversation_id: params.conversationId,
        role: 'user',
        content: params.message,
        status: 'complete',
        created_at: new Date().toISOString(),
      };
      await this.conversationService.addMessage(params.conversationId, userMessage);

      // Determine intent and plan actions
      const thinkingStep: ThinkingStep = {
        id: uuidv4(),
        title: 'Analyzing request',
        content: 'Understanding intent and planning pipeline actions...',
        status: 'in_progress',
      };
      yield { type: 'thinking_start', step: thinkingStep };

      // Get conversation context for the LLM
      const conversation = await this.conversationService.getConversation(
        params.conversationId,
        params.userId
      );

      const systemPrompt = this.buildSystemPrompt(conversation?.pipeline_context);
      const messages = this.buildMessageHistory(conversation?.messages || []);
      messages.push({ role: 'user', content: params.message });

      yield { type: 'thinking_end', step_id: thinkingStep.id };

      // Stream response from Bedrock/Claude
      const stream = this.bedrockClient.streamConverse(
        systemPrompt,
        messages,
        this.getTools(),
        abortController.signal
      );

      let fullContent = '';
      const toolCalls: ToolCall[] = [];
      const artifacts: Artifact[] = [];
      let usage: TokenUsage | undefined;

      for await (const chunk of stream) {
        if (abortController.signal.aborted) break;

        switch (chunk.type) {
          case 'text':
            fullContent += chunk.content;
            yield { type: 'content_delta', content: chunk.content };
            break;

          case 'tool_use_start':
            const toolCall: ToolCall = {
              id: chunk.tool_call_id,
              name: chunk.tool_name,
              description: this.getToolDescription(chunk.tool_name),
              input: chunk.input,
              status: 'running',
              started_at: new Date().toISOString(),
            };
            toolCalls.push(toolCall);
            yield { type: 'tool_call_start', tool_call: toolCall };
            break;

          case 'tool_use_end':
            const completedTool = toolCalls.find(t => t.id === chunk.tool_call_id);
            if (completedTool) {
              completedTool.status = 'success';
              completedTool.output = chunk.result as Record<string, unknown>;
              completedTool.completed_at = new Date().toISOString();
            }
            yield { type: 'tool_call_end', tool_call_id: chunk.tool_call_id, result: chunk.result };

            // Check if tool produced an artifact
            const artifact = this.extractArtifact(chunk.tool_name, chunk.result);
            if (artifact) {
              artifacts.push(artifact);
              yield { type: 'artifact_created', artifact };
            }
            break;

          case 'usage':
            usage = {
              input_tokens: chunk.input_tokens,
              output_tokens: chunk.output_tokens,
              total_tokens: chunk.input_tokens + chunk.output_tokens,
              estimated_cost_usd: this.estimateCost(chunk.input_tokens, chunk.output_tokens),
            };
            break;
        }
      }

      // Save assistant message
      const assistantMessage: Message = {
        id: messageId,
        conversation_id: params.conversationId,
        role: 'assistant',
        content: fullContent,
        status: 'complete',
        blocks: this.parseContentBlocks(fullContent),
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        artifacts: artifacts.length > 0 ? artifacts : undefined,
        usage,
        created_at: new Date().toISOString(),
      };
      await this.conversationService.addMessage(params.conversationId, assistantMessage);

      // Signal message end
      yield {
        type: 'message_end',
        message_id: messageId,
        usage: usage || { input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 },
      };
    } catch (error: any) {
      yield {
        type: 'error',
        code: error.code || 'GENERATION_ERROR',
        message: error.message || 'Failed to generate response',
      };
    } finally {
      this.activeGenerations.delete(generationKey);
    }
  }

  async *regenerateResponse(params: RegenerateParams): AsyncGenerator<StreamEvent> {
    // Remove the last assistant message and regenerate
    yield* this.processMessage({
      conversationId: params.conversationId,
      userId: params.userId,
      workspaceId: params.workspaceId,
      message: '__REGENERATE__',
    });
  }

  async cancelGeneration(conversationId: string, messageId: string, userId: string) {
    const key = `${conversationId}:${messageId}`;
    const controller = this.activeGenerations.get(key);
    if (controller) {
      controller.abort();
      this.activeGenerations.delete(key);
    }
  }

  async recordFeedback(params: {
    messageId: string;
    userId: string;
    rating: 'positive' | 'negative';
    comment?: string;
    categories?: string[];
  }) {
    // Store feedback for model improvement
    // In production, this goes to a feedback table
    console.log('Feedback recorded:', params);
  }

  getCapabilities(): AgentCapability[] {
    return [
      {
        name: 'discover_schema',
        description: 'Discover and analyze source database schemas',
        category: 'discovery',
        requires_approval: false,
        input_schema: { source_type: 'string', connection_ref: 'string' },
      },
      {
        name: 'generate_pipeline',
        description: 'Generate a complete data pipeline from specifications',
        category: 'generation',
        requires_approval: false,
        input_schema: { pipeline_spec: 'object' },
      },
      {
        name: 'generate_mapping',
        description: 'Generate source-to-target column mappings',
        category: 'generation',
        requires_approval: false,
        input_schema: { source_schema: 'object', target_model: 'string' },
      },
      {
        name: 'run_sandbox',
        description: 'Execute pipeline in sandbox with sample data',
        category: 'execution',
        requires_approval: false,
        input_schema: { pipeline_id: 'string' },
      },
      {
        name: 'run_tests',
        description: 'Run data quality tests on pipeline output',
        category: 'validation',
        requires_approval: false,
        input_schema: { pipeline_id: 'string', test_suite: 'string' },
      },
      {
        name: 'deploy_production',
        description: 'Deploy pipeline to production (requires approval)',
        category: 'deployment',
        requires_approval: true,
        input_schema: { pipeline_id: 'string', environment: 'string' },
      },
    ];
  }

  private buildSystemPrompt(context?: unknown): string {
    return `You are EADPA, an expert AI data engineering copilot. You build production-ready data pipelines through conversation.

YOUR CAPABILITIES:
- Discover source schemas and infer data structures
- Generate cloud-agnostic pipeline YAML specs (Bronze/Silver/Gold medallion architecture)
- Compile pipeline specs to cloud-specific code (AWS Glue, Azure Data Factory, Snowflake/dbt, Databricks)
- Generate source-to-target column mappings with transformations
- Create data quality rules and testing frameworks
- Generate orchestration DAGs (Airflow, Dagster, Step Functions)
- Generate CI/CD pipelines (GitHub Actions, GitLab CI)
- Execute and test pipelines in sandboxed environments

YOUR APPROACH:
1. Ask clarifying questions when needed (source system, target cloud, data model preference)
2. Generate pipeline specs as YAML first, then compile to target platform
3. Always include data quality checks
4. Default to incremental/idempotent patterns unless told otherwise
5. Never include raw credentials - always use secret references
6. For code output, use proper markdown code blocks with language tags

OUTPUT QUALITY STANDARDS (MANDATORY):

📝 CODE ACCURACY — Every code block must be syntactically valid:
- PySpark: .withColumn() not .with(), col("x") in expressions, .groupBy() not .groupby()
- Streaming: format("delta") not format("delta_lake"), "subscribe" not "topic" for Kafka
- Pandas: pd.concat() not .append() (removed in 2.0), avoid inplace=True
- Airflow: Fixed start_date (never datetime.now()), catchup=False for new DAGs
- dbt: {{ ref() }} and {{ source() }} always, never hardcode schema names
- Terraform: var.x for credentials, never inline secrets
- All: Complete and correct imports, no typos in method names

🎓 EDUCATIONAL EXPLANATIONS — Explain like a patient senior mentor:
- Before architecture decisions: "We chose X because Y. The alternative Z was considered but..."
- Before code sections: explain WHAT it does and WHY this pattern
- Add 🎓 Mentor Notes for non-obvious concepts (watermarks, checkpoints, idempotency)
- Acknowledge trade-offs honestly: "The downside is..."
- Adapt depth to user level (detect from their questions)

📊 STEP-BY-STEP DELIVERY — For complex builds (>3 files):
- Break into layers: Foundation → Ingestion → Transform → Quality → Orchestration → Deploy
- Deliver one layer at a time with explanation
- After each layer: confirm before continuing
- Show progress indicator

💰 COST ESTIMATE — Every pipeline solution includes:
- Monthly cost in ZAR and USD (compute + storage + network)
- Scaling projection (at 2x, 5x, 10x data growth)
- Optimization recommendations with savings percentages
- Alternative platform comparison

🚀 DEPLOYMENT INSTRUCTIONS — Every solution ends with:
- Prerequisites (tools, accounts, permissions)
- Step-by-step deployment commands
- Verification steps (how to confirm success)
- Rollback plan (how to undo)
- Common issues + troubleshooting

SAFETY RULES:
- You NEVER see or process actual row-level data
- You work only with schemas, metadata, and structural information
- Production deployments always require explicit human approval
- You flag cost implications before expensive operations
- You default to the most secure configuration

When generating pipeline YAML, use this structure:
- name, version, description
- metadata (owner, tags, schedule)
- source (type, connection with secret_ref, incremental strategy)
- layers (bronze/silver/gold with format, load_mode, transformations)
- quality (checks, quarantine, scoring)
- orchestration (engine, schedule, retries)
- target (cloud, region)

${context ? `\nCURRENT CONTEXT:\n${JSON.stringify(context)}` : ''}`;
  }

  private buildMessageHistory(messages: Message[]): Array<{ role: string; content: string }> {
    return messages.slice(-20).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));
  }

  private getTools() {
    return [
      {
        name: 'generate_pipeline_yaml',
        description: 'Generate a pipeline YAML spec based on user requirements',
        input_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            source_type: { type: 'string' },
            target_cloud: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['name', 'source_type', 'target_cloud'],
        },
      },
      {
        name: 'compile_to_target',
        description: 'Compile a pipeline YAML to cloud-specific code',
        input_schema: {
          type: 'object',
          properties: {
            pipeline_yaml: { type: 'string' },
            target_cloud: { type: 'string' },
          },
          required: ['pipeline_yaml', 'target_cloud'],
        },
      },
      {
        name: 'generate_quality_checks',
        description: 'Generate data quality check definitions',
        input_schema: {
          type: 'object',
          properties: {
            schema: { type: 'object' },
            check_types: { type: 'array', items: { type: 'string' } },
          },
          required: ['schema'],
        },
      },
      {
        name: 'generate_source_mapping',
        description: 'Generate source-to-target column mappings',
        input_schema: {
          type: 'object',
          properties: {
            source_columns: { type: 'array' },
            target_model: { type: 'string' },
          },
          required: ['source_columns'],
        },
      },
    ];
  }

  private getToolDescription(toolName: string): string {
    const descriptions: Record<string, string> = {
      generate_pipeline_yaml: 'Generating pipeline specification...',
      compile_to_target: 'Compiling to target platform code...',
      generate_quality_checks: 'Creating data quality rules...',
      generate_source_mapping: 'Building source-to-target mappings...',
    };
    return descriptions[toolName] || `Executing ${toolName}...`;
  }

  private extractArtifact(toolName: string, result: unknown): Artifact | null {
    if (toolName === 'generate_pipeline_yaml' && result) {
      return {
        id: uuidv4(),
        type: 'pipeline_yaml',
        title: 'Pipeline Specification',
        content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        language: 'yaml',
        version: 1,
      };
    }
    if (toolName === 'compile_to_target' && result) {
      return {
        id: uuidv4(),
        type: 'generated_code',
        title: 'Generated Pipeline Code',
        content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        language: 'python',
        version: 1,
      };
    }
    return null;
  }

  private parseContentBlocks(content: string): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Text before code block
      if (match.index > lastIndex) {
        const text = content.substring(lastIndex, match.index).trim();
        if (text) {
          blocks.push({ type: 'text', content: text });
        }
      }

      // Code block
      const language = match[1] || 'text';
      const blockType = language === 'yaml' ? 'yaml'
        : language === 'sql' ? 'sql'
        : language === 'python' ? 'python'
        : 'code';

      blocks.push({
        type: blockType as ContentBlock['type'],
        content: match[2],
        language,
        copyable: true,
        line_numbers: true,
      });

      lastIndex = match.index + match[0].length;
    }

    // Remaining text
    if (lastIndex < content.length) {
      const text = content.substring(lastIndex).trim();
      if (text) {
        blocks.push({ type: 'text', content: text });
      }
    }

    return blocks.length > 0 ? blocks : [{ type: 'text', content }];
  }

  private estimateCost(inputTokens: number, outputTokens: number): number {
    // Claude Sonnet pricing via Bedrock (approx mid-2026)
    const inputCostPer1K = 0.003;
    const outputCostPer1K = 0.015;
    return (inputTokens / 1000) * inputCostPer1K + (outputTokens / 1000) * outputCostPer1K;
  }
}
