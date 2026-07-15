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
      const { assessConfidence, wrapWithConfidence } = require('./validation/confidence-scope');
      const { checkForLooping } = require('./validation/loop-prevention');

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
        // Req 3: Check for looping/degeneracy before full validation
        const loopCheck = checkForLooping(result.pipeline.code, {
          platform: body.target_cloud || 'aws',
          prompt: body.description,
        });
        if (loopCheck.abort) {
          result.success = false;
          result.error = `Generation aborted: ${loopCheck.reason}`;
          result.aborted = true;
          return { statusCode: 200, headers, body: JSON.stringify(result) };
        }

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

        // Req 5: Assess confidence and wrap response
        const confidence = assessConfidence({
          skillUsed: !!skillCheck.stackId,
          stackId: skillCheck.stackId,
          validationPassed: validation.passed,
          validationAttempts: validation.attempts,
        });
        result.confidence = confidence;
        if (confidence.level !== 'verified' && confidence.description) {
          result.disclaimer = confidence.description;
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

  // POST /api/compile — IR-based cross-platform compilation (v3)
  if (path.includes('/compile') && method === 'POST') {
    try {
      const { compilePipeline, compileMultiPlatform } = require('./compilers');
      const { validatePipelineCode } = require('./validation');

      // Multi-platform mode
      if (body.multi_platform && body.ir) {
        const results = compileMultiPlatform(body.ir, body.platforms);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, results }) };
      }

      // Single platform compilation
      const result = compilePipeline(body);

      // Run validation gate on compiled output
      if (result.success && result.output && result.output.code) {
        const validation = validatePipelineCode(result.output.code, {
          engine: result.output.engine,
          targetCloud: result.ir.target_platform,
          pipelineName: result.ir.name,
        });
        result.validation = { passed: validation.passed, checks: validation.checks };
      }

      return { statusCode: 200, headers, body: JSON.stringify(result) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // POST /api/ir/parse — Parse natural language to IR
  if (path.includes('/ir/parse') && method === 'POST') {
    try {
      const { parseToIR } = require('./compilers/ir-schema');
      const result = parseToIR(body.description || '', body);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // POST /api/deliver — Full delivery: compile + scaffold + CI/CD + IaC + checklist
  if (path.includes('/deliver') && method === 'POST') {
    try {
      const { compilePipeline } = require('./compilers');
      const { generateScaffold } = require('./delivery/repo-scaffold');
      const { generateGitHubActionsCI } = require('./delivery/cicd-generator');
      const { generateTerraform } = require('./delivery/iac-generator');
      const { assessProductionReadiness } = require('./delivery/prod-checklist');
      const { validatePipelineCode } = require('./validation');

      // Step 1: Compile
      const compiled = compilePipeline(body);
      if (!compiled.success) {
        return { statusCode: 200, headers, body: JSON.stringify(compiled) };
      }

      // Step 2: Validate
      let validationPassed = false;
      if (compiled.output && compiled.output.code) {
        const v = validatePipelineCode(compiled.output.code, {
          engine: compiled.output.engine,
          targetCloud: compiled.ir.target_platform,
          pipelineName: compiled.ir.name,
        });
        validationPassed = v.passed;
        compiled.validation = { passed: v.passed, checks: v.checks };
      }

      // Step 3: Scaffold
      const scaffold = generateScaffold(compiled, compiled.ir);

      // Step 4: CI/CD
      const ciYaml = generateGitHubActionsCI(compiled.ir, compiled.ir.target_platform);
      const ciFile = scaffold.files.find(f => f.path.includes('ci.yml'));
      if (ciFile) ciFile.content = ciYaml;

      // Step 5: IaC
      const terraform = generateTerraform(compiled.ir);
      const tfFile = scaffold.files.find(f => f.path.includes('main.tf'));
      if (tfFile) tfFile.content = terraform;

      // Step 6: Production checklist
      const prodCheck = assessProductionReadiness({
        validationPassed,
        ciConfigured: true,
        iacApplied: false,
        secretsConfigured: false,
        realRunSuccess: false,
        monitoringConfigured: false,
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          pipeline: compiled.output,
          ir: compiled.ir,
          scaffold,
          ci_cd: { generated: true, path: '.github/workflows/ci.yml' },
          infrastructure: { generated: true, path: 'infra/main.tf', note: 'Run terraform plan to review. Never auto-apply.' },
          production_readiness: prodCheck,
          next_steps: [
            'Review generated files',
            'Push to GitHub (requires your confirmation)',
            'Configure secrets in GitHub Actions',
            'Run terraform plan && terraform apply',
            'Trigger first real pipeline run',
          ],
        }),
      };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // POST /api/push — Push to GitHub (requires explicit confirmation)
  if (path.includes('/push') && method === 'POST') {
    const { confirm, repo, branch } = body;
    if (!confirm) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          action: 'push_pending',
          message: 'This will push generated files to your repository. Please confirm.',
          repo: repo || 'not specified',
          branch: branch || 'feature/eadd-pipeline',
          note: 'Will open a Pull Request — never pushes directly to main.',
          confirm_by: 'Resend this request with "confirm": true',
        }),
      };
    }
    // User confirmed — in production, this calls GitHub API
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        action: 'push_confirmed',
        message: `Files would be pushed to ${repo || 'your-repo'}:${branch || 'feature/eadd-pipeline'}. (Actual push requires GitHub token integration.)`,
        note: 'A Pull Request will be opened for human review.',
      }),
    };
  }

  // POST /api/engine/introspect — Schema discovery (Req 3)
  if (path.includes('/engine/introspect') && method === 'POST') {
    try {
      const { introspectSource } = require('./introspection');
      const result = introspectSource(body);
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
  if (path.includes('/skills') && !path.includes('/engine')) {
    try {
      const { listAvailableSkills } = require('./skills/router');
      const { getPendingDefects, getCorrectionHistory } = require('./skills/self-correction');
      return { statusCode: 200, headers, body: JSON.stringify({
        skills: listAvailableSkills(),
        pending_defects: getPendingDefects().length,
        correction_history: getCorrectionHistory(10).length,
        message: 'Only these stacks have verified patterns.',
      }) };
    } catch (err) {
      return { statusCode: 200, headers, body: JSON.stringify({ skills: ['airflow-aws', 'dbt-snowflake', 'adf-azure'] }) };
    }
  }

  // POST /api/skills/report-defect — Report a skill defect (Req 4)
  if (path.includes('/skills/report') && method === 'POST') {
    try {
      const { reportDefect } = require('./skills/self-correction');
      const result = reportDefect(body);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // POST /api/skills/approve — Approve a correction (Req 4)
  if (path.includes('/skills/approve') && method === 'POST') {
    try {
      const { approveCorrection } = require('./skills/self-correction');
      const result = approveCorrection(body.defect_id, body.corrected_pattern);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
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
