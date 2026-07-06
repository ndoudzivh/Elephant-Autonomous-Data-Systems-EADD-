/**
 * AWS Bedrock Client
 * Handles streaming conversations with Claude via AWS Bedrock.
 * Supports tool use, streaming, and conversation management.
 */

import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';

export interface ConversationMessage {
  role: string;
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'tool_use_start'; tool_call_id: string; tool_name: string; input: Record<string, unknown> }
  | { type: 'tool_use_end'; tool_call_id: string; result: unknown }
  | { type: 'usage'; input_tokens: number; output_tokens: number };

export class BedrockClient {
  private client: BedrockRuntimeClient;
  private modelId: string;

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.BEDROCK_REGION || 'us-east-1',
    });
    this.modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-sonnet-4-20250514';
  }

  /**
   * Stream a conversation with Claude via Bedrock's Converse API
   */
  async *streamConverse(
    systemPrompt: string,
    messages: ConversationMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal
  ): AsyncGenerator<StreamChunk> {
    // In development without AWS credentials, simulate streaming
    if (process.env.NODE_ENV === 'development' && !process.env.AWS_ACCESS_KEY_ID) {
      yield* this.simulateStream(messages, tools);
      return;
    }

    const bedrockMessages = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: [{ text: m.content }],
    }));

    const toolConfig = tools.length > 0 ? {
      tools: tools.map(t => ({
        toolSpec: {
          name: t.name,
          description: t.description,
          inputSchema: { json: t.input_schema },
        },
      })),
    } : undefined;

    const command = new ConverseStreamCommand({
      modelId: this.modelId,
      system: [{ text: systemPrompt }],
      messages: bedrockMessages,
      inferenceConfig: {
        maxTokens: 8192,
        temperature: 0.3,
        topP: 0.9,
      },
      toolConfig,
    });

    try {
      const response = await this.client.send(command, {
        abortSignal: signal,
      });

      if (response.stream) {
        let currentToolId = '';
        let currentToolName = '';
        let toolInput = '';

        for await (const event of response.stream) {
          if (signal?.aborted) break;

          if (event.contentBlockDelta) {
            const delta = event.contentBlockDelta.delta;
            if (delta?.text) {
              yield { type: 'text', content: delta.text };
            }
            if (delta?.toolUse) {
              toolInput += delta.toolUse.input || '';
            }
          }

          if (event.contentBlockStart) {
            const start = event.contentBlockStart.start;
            if (start?.toolUse) {
              currentToolId = start.toolUse.toolUseId || '';
              currentToolName = start.toolUse.name || '';
              toolInput = '';
            }
          }

          if (event.contentBlockStop && currentToolId) {
            let parsedInput: Record<string, unknown> = {};
            try {
              parsedInput = JSON.parse(toolInput || '{}');
            } catch {}

            yield {
              type: 'tool_use_start',
              tool_call_id: currentToolId,
              tool_name: currentToolName,
              input: parsedInput,
            };

            // Execute the tool
            const result = await this.executeTool(currentToolName, parsedInput);

            yield {
              type: 'tool_use_end',
              tool_call_id: currentToolId,
              result,
            };

            currentToolId = '';
            currentToolName = '';
            toolInput = '';
          }

          if (event.metadata) {
            const usage = event.metadata.usage;
            if (usage) {
              yield {
                type: 'usage',
                input_tokens: usage.inputTokens || 0,
                output_tokens: usage.outputTokens || 0,
              };
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      throw error;
    }
  }

  /**
   * Execute a tool call and return the result
   */
  private async executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'generate_pipeline_yaml':
        return this.toolGeneratePipelineYAML(input);
      case 'compile_to_target':
        return this.toolCompileToTarget(input);
      case 'generate_quality_checks':
        return this.toolGenerateQualityChecks(input);
      case 'generate_source_mapping':
        return this.toolGenerateSourceMapping(input);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  private async toolGeneratePipelineYAML(input: Record<string, unknown>) {
    const { PipelineYAMLParser } = await import('@eadpa/schema-engine');
    const parser = new PipelineYAMLParser();
    return parser.generateTemplate({
      name: (input.name as string) || 'my-pipeline',
      sourceType: (input.source_type as string) || 'postgres',
      targetCloud: (input.target_cloud as string) || 'aws',
      owner: 'agent',
    });
  }

  private async toolCompileToTarget(input: Record<string, unknown>) {
    // Placeholder - will be implemented by compiler backends
    return { status: 'compiled', target: input.target_cloud, files: ['main.py', 'config.yaml'] };
  }

  private async toolGenerateQualityChecks(input: Record<string, unknown>) {
    return {
      checks: [
        { name: 'schema_valid', type: 'schema', severity: 'error' },
        { name: 'no_nulls', type: 'null', severity: 'error' },
        { name: 'unique_keys', type: 'unique', severity: 'warning' },
      ],
    };
  }

  private async toolGenerateSourceMapping(input: Record<string, unknown>) {
    return { mappings: [], status: 'generated' };
  }

  /**
   * Simulate streaming for development without AWS credentials
   */
  private async *simulateStream(
    messages: ConversationMessage[],
    tools: ToolDefinition[]
  ): AsyncGenerator<StreamChunk> {
    const lastMessage = messages[messages.length - 1]?.content || '';

    // Simulate thinking delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate a contextual response
    const response = this.generateSimulatedResponse(lastMessage);

    // Stream character by character with realistic delays
    for (const char of response) {
      yield { type: 'text', content: char };
      await new Promise(resolve => setTimeout(resolve, 15));
    }

    yield { type: 'usage', input_tokens: 150, output_tokens: response.length };
  }

  private generateSimulatedResponse(userMessage: string): string {
    const lower = userMessage.toLowerCase();

    if (lower.includes('pipeline') || lower.includes('build')) {
      return `I'll help you build a data pipeline. Let me understand your requirements:

1. **Source System**: What's your data source? (e.g., PostgreSQL, MySQL, S3, Kafka, Salesforce)
2. **Target Cloud**: Which cloud platform? (AWS, Azure, GCP, Snowflake, Databricks)
3. **Data Model**: What's your preferred modeling approach? (Star Schema, Data Vault, or flat)
4. **Update Frequency**: How often should data refresh? (Real-time, hourly, daily)

Once I know these, I'll generate a complete pipeline YAML spec with:
- Bronze layer (raw ingestion with schema enforcement)
- Silver layer (cleansed, deduplicated, business rules applied)
- Gold layer (aggregated, business-ready)
- Data quality checks and quarantine rules
- Orchestration and CI/CD configuration

What would you like to start with?`;
    }

    if (lower.includes('hello') || lower.includes('hi')) {
      return `Hello! I'm EADPA, your AI data engineering copilot.

I can help you:
- **Build pipelines** - from source to production in minutes
- **Map data** - column-level source-to-target mappings
- **Generate code** - AWS Glue, dbt, Spark, Airflow, and more
- **Test quality** - automated data quality checks
- **Deploy safely** - with approval gates for production

What would you like to build today?`;
    }

    return `I understand you're asking about: "${userMessage}"

I can help with that. Let me know more details about:
- The source system and data you're working with
- Your target platform (AWS, Azure, Snowflake, etc.)
- Any specific requirements or constraints

I'll generate the pipeline specification and code for you.`;
  }
}
