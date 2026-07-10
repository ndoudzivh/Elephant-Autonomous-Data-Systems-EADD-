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

  if (path === "/api/agents") {
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

  if (path === "/api/templates") {
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

  if (path === "/api/chat" && method === "POST") {
    var reqBody = {};
    if (event.body) {
      try { reqBody = JSON.parse(event.body); } catch(e) {}
    }
    var msg = reqBody.message || "";
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        id: "msg_" + Date.now(),
        role: "assistant",
        content: "EADD received: " + msg.substring(0, 100) + " - Multi-agent orchestrator ready.",
        agents_activated: ["planner", "builder"]
      })
    };
  }

  if (path === "/api/conversations") {
    return { statusCode: 200, headers: headers, body: JSON.stringify({ conversations: [] }) };
  }

  if (path === "/api/pipelines") {
    return { statusCode: 200, headers: headers, body: JSON.stringify({ pipelines: [] }) };
  }

  return { statusCode: 404, headers: headers, body: JSON.stringify({ error: "Not found: " + path }) };
};
