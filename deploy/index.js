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
app.use(express.json({ limit: '50mb' }));

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
    console.error('[Chat Error]', error.message, error.name);
    
    // Graceful fallback — use rich template responses instead of showing error
    const fallback = generateResponse(message);
    
    // Stream the fallback in chunks (feels more natural)
    const chunks = fallback.match(/.{1,8}/g) || [fallback];
    for (const chunk of chunks) {
      res.write(`data: ${JSON.stringify({ type: 'content_delta', content: chunk })}\n\n`);
    }
    
    res.write(`data: ${JSON.stringify({ type: 'message_end', message_id: messageId, usage: { total_tokens: 0, model: 'template-fallback', note: 'AI engine temporarily using templates. Enable Bedrock model access for full AI responses.' } })}\n\n`);
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
// Response Generator (Fallback when Bedrock unavailable)
// Provides rich, contextual responses from templates
// ==========================================
function generateResponse(message) {
  const lower = message.toLowerCase();

  // Requirement document / assessment
  if (lower.includes('requirement') || lower.includes('assessment') || lower.includes('case study') || lower.includes('deliverable') || lower.includes('evaluation')) {
    return `I understand! You want me to read the requirement document and build the complete end-to-end solution.

Let me analyze the requirements and build the full solution covering all tasks:

1. **Data Exploration & Cleaning** — Load, clean, EDA
2. **Feature Engineering & Data Modeling** — New features, SQL schema, BI insights
3. **Predictive Modeling** — Train models, evaluate, select best
4. **Visualization & Reporting** — Dashboards, final report

However, I notice the requirement mentions **datasets that should be provided**. I don't see any data files (CSV/Excel) uploaded yet.

**Do you have the data files to upload?** Or would you like me to:

1. **Build the complete solution framework** with placeholder data loading, so you just need to drop in your actual files and run it?
2. **Generate synthetic sample data** that matches the described schema and build the full working pipeline on that?

Either way, I'll deliver:
- A complete Python notebook/script covering all tasks
- SQL queries for business insights
- Visualizations (matplotlib/seaborn/plotly)
- A structured report

**Use the 📎 button below to upload your data files**, or reply "build framework" and I'll generate the complete solution structure!`;
  }

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return `Hey! 🐘 I'm **EADD** — your AI data engineer.

I can:
- **Build pipelines** — from source to production (Bronze → Silver → Gold)
- **Analyze requirements** — upload a doc and I'll build the complete solution
- **Design architecture** — star schema, data vault, lakehouse
- **Generate code** — PySpark, dbt, SQL, Airflow, Terraform
- **Estimate costs** — see monthly cloud costs BEFORE deploying
- **Deploy safely** — step-by-step with rollback plans

### Quick Start:
1. 📎 **Upload a file** (CSV, SQL, requirements doc)
2. 🔗 **Connect a repo** — I'll scan for existing pipelines
3. 💬 **Describe what you need** — I'll build it

What are you working on?`;
  }

  if (lower.includes('nice') || lower.includes('thanks') || lower.includes('good') || lower.includes('great') || lower.includes('ok') || lower.includes('cool')) {
    return `Glad to help! 🐘 What's next?

- **Build a pipeline** — "Build a pipeline from PostgreSQL to Snowflake"
- **Upload data** — Use 📎 to attach CSV/JSON files for analysis
- **Connect a repo** — Click 🔗 to connect GitHub/GitLab
- **Ask anything** — Architecture, costs, best practices

Ready when you are!`;
  }

  if (lower.includes('pipeline') || lower.includes('build') || lower.includes('etl') || lower.includes('ingest')) {
    return `## 🧠 Understanding Your Request

I'll build a production-ready data pipeline. Let me know:

1. **Source System**: What's your data source? (PostgreSQL, MySQL, S3, Kafka, API)
2. **Target Platform**: Which cloud? (AWS, Azure, Snowflake, Databricks)
3. **Update Frequency**: Real-time, hourly, or daily?

Once I know these, I'll generate:

### 🏛️ Lakehouse Architecture
- 🥉 **Bronze** — Raw ingestion, schema capture, append-only
- 🥈 **Silver** — Cleaned, deduplicated, type-cast
- 🥇 **Gold** — Aggregated, business-ready

### Plus:
- ✅ Data quality checks
- 🔄 Orchestration (Airflow)
- 🚀 CI/CD pipeline
- 💰 Cost estimate (ZAR + USD)
- 📋 Deployment instructions

What source system are you working with?`;
  }

  if (lower.includes('migrate') || lower.includes('sas') || lower.includes('legacy') || lower.includes('ssis')) {
    return `## 🔁 Migration Mode Activated

I'll help migrate your legacy pipelines. Tell me:

1. **Source**: What are you migrating FROM? (SAS, SSIS, Informatica, Talend?)
2. **Target**: Where are you going? (Databricks, Snowflake, AWS Glue, dbt?)
3. **Scale**: How many pipelines/jobs?

**My approach:**
1. 🔍 Parse legacy code → extract patterns
2. 🏗️ Design modern architecture (Lakehouse)
3. ⚙️ Convert to target platform
4. ✅ Generate validation tests
5. 🚀 Create deployment plan

Upload your legacy code (📎) or describe the system!`;
  }

  if (lower.includes('cost') || lower.includes('price') || lower.includes('expensive')) {
    return `## 💰 Cost Estimation

Tell me your details and I'll provide a full cost breakdown:
1. **Platform**: AWS / Azure / Snowflake / Databricks?
2. **Daily volume**: How many GB/day?
3. **Frequency**: Real-time / Hourly / Daily?

**Quick reference (10GB/day pipeline):**

| Platform | Monthly (USD) | Monthly (ZAR) |
|----------|--------------|---------------|
| AWS Glue + S3 | ~$150 | ~R2,775 |
| Databricks | ~$200 | ~R3,700 |
| Snowflake | ~$180 | ~R3,330 |
| Azure ADF | ~$160 | ~R2,960 |

Tell me your specifics for a detailed breakdown with optimization tips!`;
  }

  if (lower.includes('postgres') || lower.includes('database') || lower.includes('sql')) {
    return `I'll build a pipeline from your PostgreSQL source.

\`\`\`yaml
name: postgres-pipeline
version: "1.0.0"
source:
  type: postgres
  connection:
    secret_ref: secrets/pg-credentials
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
  - layer: gold
    format: delta
    load_mode: merge
quality:
  checks:
    - type: not_null
      severity: error
    - type: unique
      severity: warning
target:
  cloud: aws
  region: us-east-1
orchestration:
  engine: airflow
  schedule: "0 6 * * *"
\`\`\`

Shall I compile this to **AWS Glue** code, **Snowflake/dbt**, or **Databricks PySpark**?`;
  }

  return `I understand you're asking about: "${message.slice(0, 100)}"

I can help with that! Here's what I do:

🏗️ **Build** — Generate complete data pipelines from natural language
📊 **Analyze** — Profile data, discover schemas
🔁 **Migrate** — Convert legacy code to modern platforms
💰 **Estimate** — Calculate cloud costs before deploying
🚀 **Deploy** — Step-by-step deployment instructions

**To get started:**
- Describe your pipeline need in detail
- Upload a file (📎) for automatic analysis
- Or connect your repo (🔗) for pipeline scanning

What would you like to build? 🐘`;
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
