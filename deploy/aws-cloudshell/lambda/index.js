exports.handler = async function(event) {
  var path = event.rawPath || event.path || "/";
  var method = "GET";
  if (event.requestContext && event.requestContext.http) {
    method = event.requestContext.http.method;
  } else if (event.httpMethod) {
    method = event.httpMethod;
  }

  var headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
  };

  if (method === "OPTIONS") {
    return { statusCode: 200, headers: headers, body: "" };
  }

  if (path === "/health" || path === "/") {
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        status: "healthy",
        service: "eadd-backend-api",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        agents: 12,
        capabilities: [
          "pipeline_generation",
          "schema_discovery",
          "quality_checks",
          "deployment",
          "cost_estimation"
        ]
      })
    };
  }

  // SSE Chat endpoint - the main AI endpoint
  if ((path === "/api/agent/chat" || path === "/agent/chat") && method === "POST") {
    return handleChat(event);
  }

  if (path === "/api/agents" || path === "/agents") {
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        agents: [
          { id: "planner", name: "Planner Agent", status: "active" },
          { id: "builder", name: "Pipeline Builder", status: "active" },
          { id: "reviewer", name: "Code Reviewer", status: "active" },
          { id: "quality", name: "Data Quality", status: "active" },
          { id: "devops", name: "DevOps Agent", status: "active" },
          { id: "optimizer", name: "Cost Optimizer", status: "active" },
          { id: "migration", name: "Migration Agent", status: "active" },
          { id: "governance", name: "Governance", status: "active" },
          { id: "observability", name: "Observability", status: "active" },
          { id: "visualization", name: "Visualization", status: "active" },
          { id: "nlq", name: "Natural Language Query", status: "active" },
          { id: "marketplace", name: "Pipeline Marketplace", status: "active" }
        ]
      })
    };
  }

  if (path === "/api/templates" || path === "/templates") {
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        templates: [
          { id: "salesforce_snowflake", name: "Salesforce to Snowflake", cost: "800-3000 ZAR/mo" },
          { id: "postgres_s3", name: "PostgreSQL to S3 Data Lake", cost: "500-2000 ZAR/mo" },
          { id: "kafka_delta", name: "Kafka to Delta Lake", cost: "2000-8000 ZAR/mo" },
          { id: "sap_databricks", name: "SAP to Databricks", cost: "3000-12000 ZAR/mo" },
          { id: "api_bigquery", name: "REST API to BigQuery", cost: "300-1500 ZAR/mo" },
          { id: "hubspot_snowflake", name: "HubSpot to Snowflake", cost: "600-2500 ZAR/mo" }
        ]
      })
    };
  }

  if (path === "/api/conversations" || path === "/conversations") {
    return { statusCode: 200, headers: headers, body: JSON.stringify({ conversations: [] }) };
  }

  if (path === "/api/pipelines" || path === "/pipelines") {
    return { statusCode: 200, headers: headers, body: JSON.stringify({ pipelines: [] }) };
  }

  // Stop/regenerate endpoints
  if (path === "/api/agent/stop" || path === "/api/agent/regenerate") {
    return { statusCode: 200, headers: headers, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 404, headers: headers, body: JSON.stringify({ error: "Not found: " + path }) };
};

function handleChat(event) {
  var reqBody = {};
  if (event.body) {
    try { reqBody = JSON.parse(event.body); } catch(e) {}
  }
  var message = reqBody.message || "";
  var msgLower = message.toLowerCase();
  var msgId = "msg_" + Date.now();

  // Generate a helpful response based on user intent
  var response = generateResponse(msgLower, message);

  // Format as SSE stream (what the frontend expects)
  var sseBody = "";
  sseBody += "data: " + JSON.stringify({ type: "message_start", message_id: msgId }) + "\n\n";

  // Send content in chunks (simulates streaming)
  var chunks = splitIntoChunks(response, 20);
  for (var i = 0; i < chunks.length; i++) {
    sseBody += "data: " + JSON.stringify({ type: "content_delta", content: chunks[i] }) + "\n\n";
  }

  // End message
  sseBody += "data: " + JSON.stringify({
    type: "message_end",
    message_id: msgId,
    usage: { input_tokens: message.length, output_tokens: response.length, total_tokens: message.length + response.length }
  }) + "\n\n";
  sseBody += "data: [DONE]\n\n";

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*"
    },
    body: sseBody
  };
}

function generateResponse(msgLower, message) {
  // Who are you
  if (msgLower.includes("who are you") || msgLower.includes("what are you")) {
    return "I am EADD (Elephant Autonomous Data Systems) - your AI-powered data engineering team.\n\nI have 12 specialized agents that work together like a senior data engineering team:\n\n- Planner: Designs architecture and chooses platforms\n- Builder: Writes production pipeline code (PySpark, dbt, SQL, Airflow)\n- Reviewer: Reviews code for security, performance, and quality\n- Quality: Adds data quality tests and validation\n- DevOps: Generates CI/CD pipelines and infrastructure\n- Optimizer: Reduces cost and improves performance\n- Migration: Converts legacy pipelines (SAS, SSIS, Informatica)\n- Governance: Lineage tracking, PII detection, compliance\n- Observability: Monitoring, alerting, self-healing\n- Visualization: Dashboards and BI\n- NLQ: Natural language to SQL\n- Marketplace: Pre-built pipeline templates\n\nTell me what you want to build and I will deliver a complete, production-ready solution with cost estimates and deployment instructions.";
  }

  // Pipeline building
  if (msgLower.includes("pipeline") || msgLower.includes("build") || msgLower.includes("etl") || msgLower.includes("elt")) {
    return "## Pipeline Builder Activated\n\nI will help you build a cost-effective data pipeline on AWS. Let me gather your requirements:\n\n**Questions:**\n1. What is your data source? (PostgreSQL, MySQL, API, S3 files, Kafka, Salesforce, SAP)\n2. What is your target? (S3 Data Lake, Redshift, Athena, Snowflake)\n3. How much data per day? (MB/GB/TB)\n4. How often should it run? (Real-time, hourly, daily)\n5. Any compliance requirements? (GDPR, POPIA, PCI-DSS)\n\n**Cost-Effective AWS Architecture (typical):**\n- Ingestion: AWS Glue or Lambda (serverless, pay-per-use)\n- Storage: S3 with Parquet format (cheapest at scale)\n- Transform: Glue ETL or Athena SQL\n- Orchestration: Step Functions or EventBridge\n- Estimated cost: R500-R3,000/month for 10GB/day\n\nTell me your source and target, and I will generate the complete pipeline with code, quality checks, CI/CD, and deployment instructions.";
  }

  // Cost questions
  if (msgLower.includes("cost") || msgLower.includes("expensive") || msgLower.includes("cheap") || msgLower.includes("price")) {
    return "## Cost Optimization Agent\n\nHere are cost-effective options on AWS:\n\n**Serverless (lowest cost for intermittent workloads):**\n- Lambda: R0.37 per 1M requests (free tier: 1M/month)\n- Glue: R8.14/DPU-hour (only pay while running)\n- Athena: R92.50/TB scanned (use partitioning!)\n- S3: R0.43/GB/month\n\n**Key cost-saving strategies:**\n1. Use Parquet format (70% less storage, 90% less scan cost)\n2. Partition by date (Athena skips irrelevant data)\n3. Use Glue bookmarks (process only new data)\n4. Set S3 lifecycle rules (archive old data to Glacier)\n5. Use spot instances for batch jobs (70% savings)\n\n**Example: 10GB/day pipeline**\n- S3 storage: ~R130/month\n- Glue ETL (30 min/day): ~R240/month\n- Athena queries: ~R50/month\n- Total: ~R420/month (~$23 USD)\n\nWant me to estimate costs for your specific pipeline?";
  }

  // Data engineering learning
  if (msgLower.includes("learn") || msgLower.includes("junior") || msgLower.includes("beginner") || msgLower.includes("start")) {
    return "## Welcome, Data Engineer!\n\nGreat that you want to learn! Here is your learning path:\n\n**Week 1-2: Foundations**\n- SQL (the most important skill)\n- Python basics for data\n- Understanding data warehouses vs data lakes\n\n**Week 3-4: AWS Data Stack**\n- S3 (storage layer - learn Parquet format)\n- Glue (serverless ETL)\n- Athena (query S3 with SQL)\n- IAM (permissions - critical for security)\n\n**Week 5-6: Pipeline Patterns**\n- Medallion architecture (Bronze/Silver/Gold)\n- Incremental loading (don't reprocess everything)\n- Idempotency (safe to re-run without duplicates)\n\n**Week 7-8: Production Readiness**\n- Data quality testing (Great Expectations, dbt tests)\n- CI/CD (GitHub Actions for pipelines)\n- Monitoring and alerting\n\n**Key principle:** Start simple. A Lambda + S3 + Athena pipeline is 90% of what most companies need.\n\nWant me to build a starter pipeline you can learn from? Tell me your source data and I will generate it step by step with explanations.";
  }

  // Migration
  if (msgLower.includes("migrat") || msgLower.includes("sas") || msgLower.includes("legacy") || msgLower.includes("ssis")) {
    return "## Migration Agent Activated\n\nI specialize in converting legacy pipelines to modern cloud-native solutions.\n\n**Supported migrations:**\n- SAS to PySpark/dbt\n- SSIS to AWS Glue/Airflow\n- Informatica to dbt/Spark\n- Stored Procedures to dbt models\n- On-prem to Cloud\n\n**My approach:**\n1. Parse your legacy code (paste it or describe it)\n2. Identify patterns and business logic\n3. Generate equivalent modern code\n4. Add quality tests to verify correctness\n5. Parallel-run plan (old + new side by side)\n\nPaste your legacy code or describe what it does, and I will convert it with full explanations.";
  }

  // Default helpful response
  return "## EADD Ready\n\nI can help you with:\n\n- **Build a pipeline** - Tell me source and target (e.g., 'PostgreSQL to S3')\n- **Estimate costs** - I will calculate cloud costs in ZAR and USD\n- **Migrate legacy code** - Paste SAS/SSIS/SQL and I will modernize it\n- **Learn data engineering** - I will teach step by step\n- **Design architecture** - I will recommend the best platform for your needs\n- **Add quality checks** - I will generate dbt tests and validations\n\n**Example requests:**\n- 'Build a pipeline from PostgreSQL to S3 with daily refresh'\n- 'How much would a Kafka streaming pipeline cost?'\n- 'Convert this SAS code to PySpark'\n- 'Design a data lake architecture for retail analytics'\n\nWhat would you like to do?";
}

function splitIntoChunks(text, chunkSize) {
  var chunks = [];
  var words = text.split(" ");
  var current = "";
  for (var i = 0; i < words.length; i++) {
    current += (current ? " " : "") + words[i];
    if (current.length >= chunkSize) {
      chunks.push(current);
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
