/**
 * EADD Agent v2 — Minimal, guaranteed-to-work Lambda handler
 * 
 * No Express. No serverless-http. No SSE. Just raw Lambda.
 * Returns JSON directly from the Lambda handler.
 */

const { BedrockRuntimeClient, ConverseStreamCommand } = require('@aws-sdk/client-bedrock-runtime');

const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
const MODEL = process.env.AI_MODEL_ID || 'us.amazon.nova-lite-v1:0';

const SYSTEM_PROMPT = `You are EADD — Elephant Autonomous Data Systems. An enterprise-grade AI data engineering platform.

You generate production-ready data pipelines. When asked to build something, provide:
1. Brief approach (2-3 sentences)
2. Complete executable code with imports, error handling, logging
3. Cost estimate table
4. Deployment command

Supported: AWS, Azure, GCP, Snowflake, Databricks, dbt, Airflow, Kafka, Spark.
Default to: Medallion architecture (Bronze/Silver/Gold), incremental loading, idempotent pipelines.
Never hardcode credentials. Always use secret references.`;

// ============================================================
// MAIN HANDLER — Raw Lambda, no frameworks
// ============================================================
exports.handler = async (event) => {
  // Parse the request
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    body = {};
  }

  const path = event.path || event.rawPath || '';
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';

  // CORS headers for all responses
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };

  // Handle OPTIONS (CORS preflight)
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Route: GET /api/health
  if (path.includes('/health')) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'healthy',
        version: '2.0.0',
        product: 'EADD - Elephant Autonomous Data Systems',
        timestamp: new Date().toISOString(),
        capabilities: ['code_generation', 'code_validation', 'auto_fix', 'schema_intelligence', 'tool_calling', 'pipeline_testing', 'security_gate', 'memory', 'orchestration', 'output_standardization'],
      }),
    };
  }

  // ============================================================
  // ENGINE API — Core Capabilities (10 modules)
  // ============================================================

  // POST /api/engine/generate — Full orchestration pipeline
  if (path.includes('/engine/generate') && method === 'POST') {
    try {
      const engine = require('./engine');
      const { validatePipelineCode } = require('./validation');
      const { routeToSkill } = require('./skills/router');

      // Req 1: Check for verified skill before generating
      const skillCheck = routeToSkill(body.description || '', body.engine);
      if (!skillCheck.allowed) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: false,
            error: skillCheck.message,
            stackId: skillCheck.stackId,
            availableSkills: ['airflow-aws', 'dbt-snowflake', 'adf-azure'],
          }),
        };
      }

      // Pass skill context to orchestrator
      if (skillCheck.skill) {
        body._skillContext = skillCheck.skill;
        body._stackId = skillCheck.stackId;
      }

      const result = await engine.orchestrate(body);
      result.skill = { stackId: skillCheck.stackId, message: skillCheck.message };

      // Req 2: Run validation gate on generated code
      if (result.success && result.pipeline && result.pipeline.code) {
        const validation = validatePipelineCode(result.pipeline.code, {
          engine: result.pipeline.engine || 'python',
          targetCloud: body.target_cloud || 'aws',
          pipelineName: result.pipeline.pipeline_name,
        });

        result.validation = {
          passed: validation.passed,
          checks: validation.checks,
          attempts: validation.attempts,
        };

        if (validation.correctedCode) {
          result.pipeline.code = validation.correctedCode;
          result.pipeline.auto_corrected = true;
        }

        if (!validation.passed) {
          result.validation.failureMessage = validation.failureMessage;
        }
      }

      return { statusCode: 200, headers, body: JSON.stringify(result) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // POST /api/engine/validate — Code validation
  if (path.includes('/engine/validate') && method === 'POST') {
    try {
      const engine = require('./engine');
      const result = engine.validateCode(body.code || '', body.language || 'python');
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // POST /api/engine/fix — Auto-fix loop
  if (path.includes('/engine/fix') && method === 'POST') {
    try {
      const engine = require('./engine');
      const result = engine.autoFixLoop(body.code || '', body.language || 'python');
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // POST /api/engine/schema/validate — Schema compatibility
  if (path.includes('/engine/schema') && method === 'POST') {
    try {
      const engine = require('./engine');
      const result = engine.validateSchemaCompatibility(body.source_schema, body.target_schema);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // POST /api/engine/test — Pipeline testing
  if (path.includes('/engine/test') && method === 'POST') {
    try {
      const engine = require('./engine');
      const result = engine.testPipeline(body.pipeline || body);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // GET /api/engine/memory — Memory stats
  if (path.includes('/engine/memory')) {
    try {
      const engine = require('./engine');
      return { statusCode: 200, headers, body: JSON.stringify(engine.getMemoryStats()) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // GET /api/engine/audit — Security audit trail
  if (path.includes('/engine/audit')) {
    try {
      const engine = require('./engine');
      return { statusCode: 200, headers, body: JSON.stringify({ log: engine.getAuditLog(50) }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // GET /api/skills — List available verified skills
  if (path.includes('/skills')) {
    try {
      const { listAvailableSkills } = require('./skills/router');
      return { statusCode: 200, headers, body: JSON.stringify({ skills: listAvailableSkills(), message: 'Only these stacks have verified patterns. Others will use generic generation.' }) };
    } catch (err) {
      return { statusCode: 200, headers, body: JSON.stringify({ skills: ['airflow-aws', 'dbt-snowflake', 'adf-azure'] }) };
    }
  }

  // Route: POST /api/agent/chat OR /api/chat
  if (path.includes('/chat') && method === 'POST') {
    const { message, history } = body;

    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'message is required' }),
      };
    }

    let content = '';

    try {
      // Build messages for Bedrock
      const msgs = [];
      if (history && Array.isArray(history)) {
        for (const h of history.slice(-10)) {
          msgs.push({
            role: h.role === 'assistant' ? 'assistant' : 'user',
            content: [{ text: h.content }],
          });
        }
      }
      msgs.push({ role: 'user', content: [{ text: message }] });

      const command = new ConverseStreamCommand({
        modelId: MODEL,
        system: [{ text: SYSTEM_PROMPT }],
        messages: msgs,
        inferenceConfig: { maxTokens: 2048, temperature: 0.3 },
      });

      const response = await bedrock.send(command);
      for await (const event of response.stream) {
        if (event.contentBlockDelta?.delta?.text) {
          content += event.contentBlockDelta.delta.text;
        }
      }
    } catch (err) {
      console.error('[Bedrock Error]', err.message);
      content = generateFallback(message);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        content,
        model: MODEL,
      }),
    };
  }

  // Default: 404
  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ error: 'Not found', path }),
  };
};

// ============================================================
// FALLBACK — When Bedrock is unavailable
// ============================================================
function generateFallback(message) {
  const lower = message.toLowerCase();

  if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey')) {
    return `Welcome to **EADD** — Elephant Autonomous Data Systems.

I design, build, and deploy production-ready data pipelines.

| Capability | Description |
|-----------|-------------|
| Pipeline Design | Architecture with cost optimization |
| Code Generation | PySpark, SQL, dbt, Airflow, Terraform |
| Data Quality | Validation, profiling, testing |
| Migration | SAS, SSIS, Informatica modernization |
| Cost Analysis | Cloud cost projection |
| Deployment | CI/CD with rollback |

Describe your pipeline requirement and I will generate the complete solution.`;
  }

  if (lower.includes('pipeline') || lower.includes('build') || lower.includes('etl')) {
    return `**Pipeline Solution**

\`\`\`python
import sys
import logging
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, current_timestamp, lit

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("eadd_pipeline")

spark = SparkSession.builder.appName("eadd_pipeline").getOrCreate()

try:
    # Bronze: Raw ingestion
    df = spark.read.format("parquet").load("s3://source-bucket/raw/")
    logger.info(f"Read {df.count()} rows")
    
    # Silver: Clean and deduplicate
    silver = (
        df
        .dropDuplicates(["id"])
        .withColumn("_processed_at", current_timestamp())
        .filter(col("id").isNotNull())
    )
    
    # Gold: Write
    silver.write.format("delta").mode("append").save("s3://target-bucket/silver/")
    logger.info("Pipeline completed successfully")
except Exception as e:
    logger.error(f"Pipeline failed: {e}")
    sys.exit(1)
finally:
    spark.stop()
\`\`\`

**Cost Estimate (10GB/day):**

| Service | Monthly |
|---------|---------|
| AWS Glue | $13 |
| S3 Storage | $7 |
| CloudWatch | $3 |
| **Total** | **$23** |

**Deploy:**
\`\`\`bash
aws glue create-job --name eadd-pipeline --role GlueRole --command Name=glueetl,ScriptLocation=s3://scripts/pipeline.py
\`\`\``;
  }

  return `I can assist with: pipeline design, code generation, data quality, migration, cost analysis, and deployment.

Provide a specific request (e.g., "Build a pipeline from PostgreSQL to S3") and I will generate the complete solution with executable code, cost estimates, and deployment instructions.`;
}
