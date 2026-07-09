/**
 * EADD Backend - Lambda-ready Express API
 * Standalone deployment (no workspace dependencies)
 */

const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const { v4: uuidv4 } = require('uuid');

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
// Agent Chat (SSE Streaming)
// ==========================================
app.post('/api/agent/chat', async (req, res) => {
  const { conversation_id, message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const messageId = uuidv4();
  res.write(`data: ${JSON.stringify({ type: 'message_start', message_id: messageId })}\n\n`);

  // Generate response based on user input
  const response = generateResponse(message);

  // Stream the response character by character (simulated)
  for (let i = 0; i < response.length; i += 3) {
    const chunk = response.slice(i, i + 3);
    res.write(`data: ${JSON.stringify({ type: 'content_delta', content: chunk })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ type: 'message_end', message_id: messageId, usage: { input_tokens: 150, output_tokens: response.length, estimated_cost_usd: 0.002 } })}\n\n`);
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
