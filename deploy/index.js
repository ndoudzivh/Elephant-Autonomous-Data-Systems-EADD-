/**
 * EADD Backend - Lambda-ready Express API
 * Standalone deployment (no workspace dependencies)
 * AI: Amazon Nova Lite via AWS Bedrock (free tier eligible)
 * Fallback to Claude when Anthropic access is approved
 */

const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const { v4: uuidv4 } = require('uuid');
const { BedrockRuntimeClient, ConverseStreamCommand } = require('@aws-sdk/client-bedrock-runtime');

// Bedrock client — uses Lambda's IAM role (no hardcoded keys)
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Model to use — Amazon Nova Lite (free tier, no approval needed)
// Change to 'us.anthropic.claude-sonnet-5' once Anthropic access is approved
const AI_MODEL = process.env.AI_MODEL_ID || 'us.amazon.nova-lite-v1:0';

const SYSTEM_PROMPT = `You are EADD — an autonomous AI data engineer. You work like a real senior engineer: you understand the problem, make decisions, and deliver complete solutions.

PERSONALITY: Like a brilliant principal data engineer who actually DOES the work rather than asking endless questions. You are:
- Decisive — make the call, explain why briefly
- Action-oriented — produce outputs, not conversation
- Autonomous — figure things out yourself when possible
- Concise — no filler, no "great question!", no unnecessary ceremony
- Expert — 15+ years of data engineering encoded in your responses

HOW YOU WORK:

When a user says something, determine the type and respond accordingly:

TYPE 1 — GREETING or GENERAL ("hi", "hello", "what can you do"):
Say something brief and natural like:
"Hey! I'm EADD — your AI data engineer. I can build pipelines, design architectures, migrate legacy systems, or analyze data across AWS, Azure, Snowflake, dbt, and Databricks. What are you working on?"

TYPE 2 — SIMPLE QUESTION ("what is X", "which is better"):
Answer directly in 2-5 sentences. No structure needed. Just expert knowledge.

TYPE 3 — BUILD REQUEST ("build me a pipeline", "create architecture", "migrate from X"):
Ask ONE essential question if critical info is missing. Then BUILD. Don't ask 5 questions. Make reasonable assumptions and state them. Generate the actual code/YAML/config — the full deliverable.

When building, provide:
1. Brief explanation of approach (3-4 sentences max)
2. The actual code/config (complete, production-ready)
3. Brief note on how to deploy it
4. Offer to push to their GitHub/GitLab

TYPE 4 — FILE/CODE ANALYSIS (user uploads a file):
Read it. Analyze it. Give specific findings. No generic responses.

RULES:
- Ask maximum ONE question before taking action. If you can assume reasonably, do so and state the assumption.
- When you generate code, generate ALL of it — complete files, not snippets
- Always include: error handling, logging, comments explaining WHY
- Default to: incremental loading, idempotent pipelines, secrets via vault references
- If user says "push to GitHub" — generate the complete repo structure with README
- Never say "I can't do X" — instead say "Here's how I'd approach X" and do it
- No progress bars, no step counters, no confidence percentages unless actually building something complex over multiple messages

SUPPORTED PLATFORMS: AWS, Azure, GCP, Snowflake, Databricks, dbt, Airflow, Kafka, Spark, on-premises

FOUNDER: Daniel Ndou (Standard Bank experience, ProACT pipeline, SAS Viya)
WEBSITE: elephant-pod.vercel.app`;

RESPONSE STRUCTURE (follow this EXACTLY):

---
**[EMOJI] [AGENT NAME]** | [Phase X: Name] | Step [N] of 17
---

## 📋 [Section Title]

| Dimension | Assessment |
|-----------|-----------|
| Goal | ... |
| Data | ... |
| Volume | ... |

## ✅ Assumptions

• Assumption 1
• Assumption 2

## ❓ Your Input Needed

> **Question 1:** [Clear, specific question]
> **Question 2:** [Clear, specific question]

---
📍 **Progress:** Step X of 17 | **Next:** [What comes after they answer]
💡 **Confidence:** X% — [brief note on what would increase it]
---

AGENT ASSIGNMENTS:
- Requirements/profiling questions → 🎯 REQUIREMENTS AGENT
- Architecture/platform decisions → 🏗️ ARCHITECT AGENT  
- Building code/pipelines → ⚙️ BUILDER AGENT
- Migration tasks → 🔁 MIGRATION AGENT
- Quality/testing → ✅ QUALITY AGENT
- Security/compliance → 🔐 GOVERNANCE AGENT
- Deployment/CI-CD → 🚀 DEVOPS AGENT
- Cost/optimization → 💰 OPTIMIZER AGENT
- General planning → 🧠 PLANNER AGENT

PERSONALITY:
- Professional but approachable (like a principal engineer at a top tech company)
- Concise (never ramble — every sentence has purpose)
- Decisive (recommend ONE best option, not "it depends")
- Transparent (always say WHY)
- Business-aware (connect technical decisions to business outcomes)

YOUR 17-STEP ENGINEERING METHODOLOGY:
When building a pipeline, guide the user through these steps progressively:

**Phase 1: Discovery**
1. Requirement Analysis — Understand what they need, business context, data volumes, frequency
2. Assumptions — State what you're assuming (they can correct you)
3. Questions — Ask 1-2 targeted clarifying questions

**Phase 2: Design**
4. Solution Design — High-level approach in plain English
5. Architecture Diagram — Show component flow (source → layers → target)
6. Repository Structure — Folder layout for generated project
7. Data Model — Star schema / Data Vault / SCD2 with relationships

**Phase 3: Technical**
8. Infrastructure Design — Cloud resources needed (Terraform/IaC)
9. Security Design — Secrets, access control, PII handling
10. Data Pipeline Design — Bronze/Silver/Gold, transformations, incremental strategy

**Phase 4: Implementation**
11. Code Implementation — Production-ready code with comments
12. Unit Testing — Test cases for transformations
13. Integration Testing — End-to-end test scenarios

**Phase 5: Delivery**
14. Documentation — README, data dictionary, runbook
15. Deployment Guide — Step-by-step deploy instructions
16. Cost Analysis — Monthly cost breakdown by service
17. Future Improvements — What to add next

HOW TO GUIDE:
- Start at Step 1 — ask questions to understand
- Present Steps 4-7 together after getting answers
- Wait for confirmation before Implementation (Steps 11-13)
- Show progress: "Step X of 17"
- End each response with whats next
- Users can skip ahead — thats fine

YOUR CAPABILITIES:
- Generate cloud-agnostic pipeline YAML specs (Bronze/Silver/Gold medallion architecture)
- Compile pipeline specs to AWS Glue, Azure Data Factory, Snowflake, dbt, Databricks code
- Create source-to-target column mappings with transformations
- Generate data quality rules, testing frameworks, and orchestration DAGs
- Generate CI/CD pipelines (GitHub Actions, GitLab CI)

SAFETY: You never see actual row-level data — only schemas and metadata. Production deployments always require human approval.`;

async function callBedrock(messages) {
  try {
    const bedrockMessages = messages.map(m => ({
      role: m.role,
      content: [{ text: m.content }],
    }));

    const command = new ConverseStreamCommand({
      modelId: AI_MODEL,
      system: [{ text: SYSTEM_PROMPT }],
      messages: bedrockMessages,
      inferenceConfig: { maxTokens: 2048, temperature: 0.3 },
    });

    const response = await bedrockClient.send(command);
    let fullText = '';

    for await (const event of response.stream) {
      if (event.contentBlockDelta?.delta?.text) {
        fullText += event.contentBlockDelta.delta.text;
      }
    }

    return fullText;
  } catch (error) {
    console.error('[Bedrock Error]', error.message);
    throw error;
  }
}

const app = express();

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

// ==========================================
// Health Check
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    product: 'EADD - Elephant Autonomous Data Systems',
    timestamp: new Date().toISOString(),
    services: { api: 'up', ai: 'ready' },
  });
});

// ==========================================
// Plans / Pricing
// ==========================================
app.get('/api/billing/plans', (req, res) => {
  res.json({
    plans: [
      { id: 'free', name: 'Free', price: 0, currency: 'ZAR', interval: 'forever', features: ['20 messages/day', '3 pipelines', 'AWS only', '100K tokens/month'] },
      { id: 'pro_monthly', name: 'Pro', price: 899, currency: 'ZAR', interval: 'monthly', plan_code: 'PLN_66us2k8tsfj1opj', features: ['500 messages/day', '50 pipelines', 'All 5 clouds', '2M tokens/month'] },
      { id: 'pro_annual', name: 'Pro (Annual)', price: 8499, currency: 'ZAR', interval: 'annually', plan_code: 'PLN_8cpcldlg3t2ivtw', features: ['Same as Pro', 'Save 20%'] },
      { id: 'team', name: 'Team', price: 699, currency: 'ZAR', interval: 'monthly', plan_code: 'PLN_56db7nif43wuhfc', features: ['Pro + SSO', 'Shared workspaces', 'Audit logs'] },
      { id: 'enterprise', name: 'Enterprise', price: 9000, currency: 'ZAR', interval: 'monthly', plan_code: 'PLN_y2co9ue7w6vkh26', features: ['VPC', 'Unlimited', 'SLA', 'Compliance'] },
    ],
  });
});

// ==========================================
// Conversations
// ==========================================
const conversations = {};

app.get('/api/conversations', (req, res) => {
  res.json({ items: Object.values(conversations), total: Object.keys(conversations).length });
});

app.post('/api/conversations', (req, res) => {
  const conv = {
    id: uuidv4(),
    title: req.body.title || 'New Pipeline',
    messages: [],
    created_at: new Date().toISOString(),
  };
  conversations[conv.id] = conv;
  res.status(201).json(conv);
});

// ==========================================
// Agent Chat (SSE Streaming - REAL AI via Bedrock)
// ==========================================
app.post('/api/agent/chat', async (req, res) => {
  const { conversation_id, message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const messageId = uuidv4();
  res.write(`data: ${JSON.stringify({ type: 'message_start', message_id: messageId })}\n\n`);

  try {
    // Build message history for context
    const messages = [];
    if (history && Array.isArray(history)) {
      for (const h of history.slice(-10)) { // last 10 messages for context
        messages.push({ role: h.role, content: h.content });
      }
    }
    messages.push({ role: 'user', content: message });

    // Call REAL Bedrock AI (Nova Lite)
    const bedrockMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: [{ text: m.content }],
    }));

    const command = new ConverseStreamCommand({
      modelId: AI_MODEL,
      system: [{ text: SYSTEM_PROMPT }],
      messages: bedrockMessages,
      inferenceConfig: { maxTokens: 2048, temperature: 0.3 },
    });

    const bedrockResponse = await bedrockClient.send(command);
    let totalTokens = 0;

    for await (const event of bedrockResponse.stream) {
      if (event.contentBlockDelta?.delta?.text) {
        const chunk = event.contentBlockDelta.delta.text;
        res.write(`data: ${JSON.stringify({ type: 'content_delta', content: chunk })}\n\n`);
      }
      if (event.metadata?.usage) {
        totalTokens = event.metadata.usage.totalTokens || 0;
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'message_end', message_id: messageId, usage: { total_tokens: totalTokens, model: AI_MODEL, estimated_cost_usd: (totalTokens / 1000000) * 0.06 } })}\n\n`);

  } catch (error) {
    console.error('[Chat Error]', error.message);
    // Fallback to simulated response if Bedrock fails
    const fallback = generateResponse(message);
    for (let i = 0; i < fallback.length; i += 5) {
      res.write(`data: ${JSON.stringify({ type: 'content_delta', content: fallback.slice(i, i + 5) })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ type: 'message_end', message_id: messageId, usage: { total_tokens: 0, model: 'fallback' } })}\n\n`);
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

// ==========================================
// Pipeline Generation
// ==========================================
app.post('/api/pipelines/generate', (req, res) => {
  const { source_type, target_cloud, name } = req.body;

  const yaml = `name: ${name || 'my-pipeline'}
version: "1.0.0"
source:
  type: ${source_type || 'postgres'}
  connection:
    secret_ref: secrets/source-credentials
  incremental:
    enabled: true
    strategy: timestamp
    watermark_column: updated_at
layers:
  - layer: bronze
    format: delta
    load_mode: append
  - layer: silver
    format: delta
    load_mode: merge
    dedup:
      enabled: true
      columns: [id]
      strategy: last
  - layer: gold
    format: delta
    load_mode: merge
quality:
  enabled: true
  checks:
    - name: no_null_ids
      type: "null"
      severity: error
    - name: unique_keys
      type: unique
      severity: warning
target:
  cloud: ${target_cloud || 'aws'}
orchestration:
  engine: airflow
  schedule: "0 6 * * *"
  retries: 3`;

  res.json({ pipeline_yaml: yaml, status: 'generated' });
});

// ==========================================
// Agent Capabilities
// ==========================================
app.get('/api/agent/capabilities', (req, res) => {
  res.json({
    capabilities: [
      { name: 'generate_pipeline', description: 'Generate data pipelines from natural language', requires_approval: false },
      { name: 'discover_schema', description: 'Discover source database schemas', requires_approval: false },
      { name: 'generate_mapping', description: 'Create source-to-target mappings', requires_approval: false },
      { name: 'run_sandbox', description: 'Execute pipeline in sandbox', requires_approval: false },
      { name: 'deploy_production', description: 'Deploy to production', requires_approval: true },
    ],
    model: { provider: 'aws_bedrock', model_id: 'anthropic.claude-sonnet-4-20250514' },
  });
});

// ==========================================
// Response Generator
// ==========================================
function generateResponse(message) {
  const lower = message.toLowerCase();

  if (lower.includes('hello') || lower.includes('hi')) {
    return `Hello! I'm EADD, your AI data engineering copilot.\n\nI can help you:\n- **Build pipelines** from source to production in minutes\n- **Map data** with column-level source-to-target mappings\n- **Generate code** for AWS Glue, dbt, Snowflake, Airflow\n- **Test quality** with automated data quality checks\n- **Deploy safely** with approval gates for production\n\nWhat would you like to build today?`;
  }

  if (lower.includes('pipeline') || lower.includes('build')) {
    return `I'll help you build a data pipeline. Let me understand your requirements:\n\n1. **Source System**: What's your data source? (PostgreSQL, MySQL, S3, Kafka, Salesforce)\n2. **Target Cloud**: Which platform? (AWS, Azure, Snowflake, Databricks)\n3. **Data Model**: Star Schema, Data Vault, or flat?\n4. **Schedule**: How often should data refresh?\n\nOnce I know these, I'll generate a complete pipeline with:\n- Bronze/Silver/Gold layers\n- Data quality checks + quarantine\n- Orchestration (Airflow DAG)\n- CI/CD (GitHub Actions)\n- Terraform infrastructure\n\nWhat source system are you working with?`;
  }

  if (lower.includes('postgres') || lower.includes('database') || lower.includes('sql')) {
    return "I'll build a pipeline from your PostgreSQL source.\n\n```yaml\nname: postgres-pipeline\nversion: \"1.0.0\"\nsource:\n  type: postgres\n  connection:\n    secret_ref: secrets/pg-credentials\n  incremental:\n    enabled: true\n    strategy: timestamp\nlayers:\n  - layer: bronze\n    format: delta\n    load_mode: append\n  - layer: silver\n    format: delta\n    load_mode: merge\n  - layer: gold\n    format: delta\n    load_mode: merge\ntarget:\n  cloud: aws\n```\n\nShall I compile this to AWS Glue ETL code, or would you prefer Snowflake/dbt?";
  }

  return `I understand you're asking about: "${message}"\n\nI can help with that. Tell me more about:\n- The source system and data\n- Your target platform (AWS, Azure, Snowflake)\n- Any specific requirements\n\nI'll generate the complete pipeline for you.`;
}

// ==========================================
// Lambda Handler + Local Server
// ==========================================
if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
  // Running in Lambda
  module.exports.handler = serverless(app);
} else {
  // Running locally
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`EADD Backend running on http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
  });
}
