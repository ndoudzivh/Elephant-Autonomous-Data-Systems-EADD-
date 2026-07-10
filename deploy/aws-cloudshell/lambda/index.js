var { BedrockRuntimeClient, ConverseStreamCommand } = require("@aws-sdk/client-bedrock-runtime");

var bedrockClient = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || "us-east-1" });
var MODEL_ID = process.env.BEDROCK_MODEL_ID || "anthropic.claude-sonnet-4-20250514";

var SYSTEM_PROMPT = `You are EADD (Elephant Autonomous Data Systems) - a Senior Data Engineering AI that acts as a patient, knowledgeable mentor.

YOUR PERSONALITY:
- You are a Staff/Principal Data Engineer with 15+ years experience
- You explain WHY before WHAT - help users understand the reasoning
- You provide VALIDATED, PRODUCTION-READY code - no pseudocode, no placeholders
- You break complex builds into steps and ask before continuing
- You always include cost estimates (in ZAR and USD)
- You end solutions with deployment instructions

WHEN ASKED "WHO ARE YOU":
Introduce yourself warmly as a senior data engineering mentor. Explain you can build complete pipelines, review code, estimate costs, and teach concepts. Ask what they need help with.

WHEN BUILDING PIPELINES:
1. First ask clarifying questions (source, target, volume, frequency)
2. Design the architecture with justification
3. Generate COMPLETE, RUNNABLE code (PySpark, dbt, SQL, Terraform, Airflow)
4. Add data quality checks
5. Provide cost estimate
6. Give deployment instructions

CODE ACCURACY RULES:
- PySpark: Use .withColumn() not .with(), col("x") in expressions, .groupBy() not .groupby()
- Streaming: format("delta") not "delta_lake", "subscribe" not "topic" for Kafka
- Pandas: pd.concat() not .append() (removed in 2.0)
- Airflow: Fixed start_date, catchup=False
- dbt: Always use ref() and source(), never hardcode schemas
- Terraform: Never hardcode credentials

EDUCATIONAL APPROACH:
- Add comments explaining WHY each pattern is used
- Include "Mentor Note" sections for non-obvious concepts
- Acknowledge trade-offs honestly
- Adapt to user level (detect from their questions)

COST ESTIMATION (always include):
- Show monthly cost in ZAR and USD (1 USD = ~R18.50)
- Break down: Compute, Storage, Network
- Compare alternatives

FORMAT: Use markdown with headers, code blocks, and bullet points.`;

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
        version: "2.0.0",
        ai: "bedrock-claude",
        timestamp: new Date().toISOString()
      })
    };
  }

  if ((path === "/api/agent/chat" || path === "/agent/chat") && method === "POST") {
    return handleChat(event);
  }

  if (path === "/api/agents" || path === "/agents") {
    return { statusCode: 200, headers: headers, body: JSON.stringify({ agents: [
      { id: "planner", name: "Planner Agent", status: "active" },
      { id: "builder", name: "Pipeline Builder", status: "active" },
      { id: "reviewer", name: "Code Reviewer", status: "active" },
      { id: "quality", name: "Data Quality", status: "active" },
      { id: "devops", name: "DevOps Agent", status: "active" },
      { id: "optimizer", name: "Cost Optimizer", status: "active" }
    ]})};
  }

  if (path === "/api/agent/stop" || path === "/api/agent/regenerate") {
    return { statusCode: 200, headers: headers, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 404, headers: headers, body: JSON.stringify({ error: "Not found: " + path }) };
};

async function handleChat(event) {
  var reqBody = {};
  if (event.body) {
    try { reqBody = JSON.parse(event.body); } catch(e) {}
  }
  var message = reqBody.message || "hello";
  var msgId = "msg_" + Date.now();

  try {
    var response = await callBedrock(message);

    var sseBody = "";
    sseBody += "data: " + JSON.stringify({ type: "message_start", message_id: msgId }) + "\n\n";

    var chunks = splitIntoChunks(response, 30);
    for (var i = 0; i < chunks.length; i++) {
      sseBody += "data: " + JSON.stringify({ type: "content_delta", content: chunks[i] }) + "\n\n";
    }

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
  } catch (err) {
    var fallback = generateFallback(message);
    var sseBody2 = "";
    sseBody2 += "data: " + JSON.stringify({ type: "message_start", message_id: msgId }) + "\n\n";
    var chunks2 = splitIntoChunks(fallback, 30);
    for (var j = 0; j < chunks2.length; j++) {
      sseBody2 += "data: " + JSON.stringify({ type: "content_delta", content: chunks2[j] }) + "\n\n";
    }
    sseBody2 += "data: " + JSON.stringify({ type: "message_end", message_id: msgId, usage: {} }) + "\n\n";
    sseBody2 += "data: [DONE]\n\n";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      },
      body: sseBody2
    };
  }
}

async function callBedrock(userMessage) {
  var command = new ConverseStreamCommand({
    modelId: MODEL_ID,
    system: [{ text: SYSTEM_PROMPT }],
    messages: [{ role: "user", content: [{ text: userMessage }] }],
    inferenceConfig: { maxTokens: 4096, temperature: 0.3, topP: 0.9 }
  });

  var response = await bedrockClient.send(command);
  var fullText = "";

  if (response.stream) {
    for await (var event of response.stream) {
      if (event.contentBlockDelta && event.contentBlockDelta.delta && event.contentBlockDelta.delta.text) {
        fullText += event.contentBlockDelta.delta.text;
      }
    }
  }

  return fullText || "I apologize, I could not generate a response. Please try again.";
}

function generateFallback(message) {
  return "I apologize - I am currently unable to connect to my AI engine (AWS Bedrock). This is likely a permissions issue.\n\n**To fix this:**\n1. Go to AWS Console > Bedrock > Model Access\n2. Ensure Claude Sonnet is enabled\n3. Check the Lambda role has `bedrock:InvokeModel` permission\n\nIn the meantime, I can still help with pre-built templates. What would you like to build?";
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
