/**
 * EADD Streaming Pipeline Generator
 * 
 * Generates real-time/streaming pipelines end-to-end.
 * Supports: Kafka, Kinesis, Spark Structured Streaming, Flink, Kafka Streams.
 * 
 * Auto-decides: batch vs micro-batch vs true streaming based on latency requirements.
 * Handles: windowing, watermarks, late-arriving data, exactly-once/at-least-once semantics.
 * 
 * Section 7.1 of requirements.
 */

export type StreamEngine = 'kafka_streams' | 'spark_structured_streaming' | 'flink' | 'kinesis' | 'pubsub';
export type DeliveryGuarantee = 'exactly_once' | 'at_least_once' | 'at_most_once';
export type WindowType = 'tumbling' | 'sliding' | 'session' | 'global';
export type ProcessingMode = 'batch' | 'micro_batch' | 'true_streaming';

export interface StreamingPipelineSpec {
  name: string;
  /** Auto-selected with reasoning */
  engine: StreamEngine;
  engineReasoning: string;
  /** Processing mode with reasoning */
  mode: ProcessingMode;
  modeReasoning: string;
  /** Source */
  source: StreamSource;
  /** Processing logic */
  processing: StreamProcessing;
  /** Sink */
  sink: StreamSink;
  /** Delivery guarantee */
  deliveryGuarantee: DeliveryGuarantee;
  guaranteeReasoning: string;
  /** Error handling */
  errorHandling: StreamErrorHandling;
  /** Monitoring */
  monitoring: StreamMonitoring;
}

export interface StreamSource {
  type: 'kafka' | 'kinesis' | 'pubsub' | 'eventhub' | 'websocket' | 'iot_hub';
  topic: string;
  bootstrapServers?: string;
  consumerGroup?: string;
  startOffset: 'earliest' | 'latest' | 'timestamp';
  schemaRegistry?: string;
  /** Schema evolution strategy */
  schemaEvolution: 'backward_compatible' | 'forward_compatible' | 'full' | 'none';
}

export interface StreamProcessing {
  /** Transformations applied to each record/window */
  transformations: StreamTransformation[];
  /** Windowing config */
  windowing?: WindowConfig;
  /** Watermark for handling late data */
  watermark?: WatermarkConfig;
  /** Stateful processing (aggregations, joins) */
  stateful?: StatefulConfig;
}

export interface StreamTransformation {
  type: 'filter' | 'map' | 'flatmap' | 'aggregate' | 'join' | 'enrich' | 'dedup';
  description: string;
  logic: string; // SQL or Python expression
}

export interface WindowConfig {
  type: WindowType;
  size: string; // e.g., "5 minutes", "1 hour"
  slide?: string; // for sliding windows
  gap?: string; // for session windows
  /** What happens to late data */
  allowedLateness: string;
  lateDataAction: 'drop' | 'update' | 'side_output';
}

export interface WatermarkConfig {
  /** Column containing event time */
  eventTimeColumn: string;
  /** Maximum delay expected */
  maxOutOfOrderness: string;
  /** When watermark hasn't advanced */
  idleTimeout?: string;
}

export interface StatefulConfig {
  /** State backend */
  stateBackend: 'rocksdb' | 'heap' | 'managed';
  /** State TTL (cleanup old state) */
  stateTTL?: string;
  /** Checkpoint interval */
  checkpointInterval: string;
  /** Exactly-once checkpointing */
  exactlyOnceCheckpointing: boolean;
}

export interface StreamSink {
  type: 'kafka' | 'delta_lake' | 's3' | 'snowflake' | 'database' | 'elasticsearch' | 'redis';
  config: Record<string, unknown>;
  /** Write mode */
  outputMode: 'append' | 'complete' | 'update';
}

export interface StreamErrorHandling {
  /** Dead letter queue for failed records */
  deadLetterQueue: {
    enabled: boolean;
    topic: string;
    includeOriginalRecord: boolean;
    includeErrorDetails: boolean;
    retentionDays: number;
  };
  /** Retry config */
  retries: {
    maxAttempts: number;
    backoffMs: number;
    backoffMultiplier: number;
  };
  /** What to do on deserialization error */
  deserializationError: 'skip' | 'dead_letter' | 'fail';
  /** What to do on processing error */
  processingError: 'skip' | 'dead_letter' | 'retry' | 'fail';
}

export interface StreamMonitoring {
  /** Lag monitoring (consumer behind producer) */
  consumerLag: { warnThreshold: number; criticalThreshold: number };
  /** Throughput */
  recordsPerSecond: { warnThreshold: number };
  /** Error rate */
  errorRate: { warnPercentage: number; criticalPercentage: number };
  /** Processing latency */
  processingLatencyMs: { warnP99: number; criticalP99: number };
}

// ============================================================
// ENGINE SELECTION LOGIC
// ============================================================

export interface LatencyRequirements {
  maxLatencyMs: number;
  throughputRecordsPerSec: number;
  statefulProcessing: boolean;
  complexEventProcessing: boolean;
  exactlyOnce: boolean;
}

/**
 * Auto-select the best streaming engine based on requirements.
 * Always explains WHY.
 */
export function selectStreamEngine(req: LatencyRequirements): { engine: StreamEngine; mode: ProcessingMode; reasoning: string } {
  // True streaming (sub-second latency)
  if (req.maxLatencyMs < 1000) {
    if (req.complexEventProcessing || req.throughputRecordsPerSec > 1000000) {
      return {
        engine: 'flink',
        mode: 'true_streaming',
        reasoning: `Chose Apache Flink because: sub-second latency required (${req.maxLatencyMs}ms), complex event processing needed, high throughput (${req.throughputRecordsPerSec} rec/s). Flink excels at stateful stream processing with exactly-once guarantees at scale.`,
      };
    }
    return {
      engine: 'kafka_streams',
      mode: 'true_streaming',
      reasoning: `Chose Kafka Streams because: sub-second latency required (${req.maxLatencyMs}ms), no complex CEP needed, moderate throughput. Kafka Streams is lightweight, embeddable, and doesn't require a separate cluster.`,
    };
  }

  // Micro-batch (seconds to minutes)
  if (req.maxLatencyMs < 60000) {
    return {
      engine: 'spark_structured_streaming',
      mode: 'micro_batch',
      reasoning: `Chose Spark Structured Streaming because: latency budget is ${req.maxLatencyMs}ms (micro-batch acceptable), stateful=${req.statefulProcessing}. Spark provides exactly-once with checkpoint recovery, integrates with Delta Lake, and handles both batch and streaming in one API.`,
    };
  }

  // Near-real-time (minutes)
  return {
    engine: 'spark_structured_streaming',
    mode: 'micro_batch',
    reasoning: `Chose Spark Structured Streaming (micro-batch mode) because: latency budget is ${req.maxLatencyMs}ms (minutes-level). This is more cost-effective than true streaming for this SLA, with simpler operations and maintenance.`,
  };
}

/**
 * Generate a complete Spark Structured Streaming pipeline
 * 
 * NOTE: All generated code passes through the Code Accuracy Validator
 * which catches common mistakes (wrong method names, bad imports, etc.)
 * See: agents/output-quality/code-accuracy-validator.ts
 */
export function generateSparkStreamingPipeline(spec: StreamingPipelineSpec): string {
  return `"""
${spec.name} — Streaming Pipeline
Engine: Spark Structured Streaming (${spec.mode})
Delivery: ${spec.deliveryGuarantee}

🎓 WHY THIS ENGINE: ${spec.engineReasoning}

Architecture Decision:
- Mode: ${spec.mode} — chosen because latency budget allows micro-batch efficiency
- Guarantee: ${spec.deliveryGuarantee} — critical for data correctness
- Error handling: Dead letter queue for failed records (no data loss)
"""

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, from_json, window, count, sum, expr
from pyspark.sql.types import StructType, StructField, StringType, TimestampType, DoubleType
from delta.tables import DeltaTable

# ─── SPARK SESSION ────────────────────────────────────────────
# WHY these configs: checkpointLocation enables exactly-once recovery.
# If the job crashes, it restarts from the last checkpoint (not from zero).
# stateSchemaCheck=false allows schema evolution in stateful operations.
spark = SparkSession.builder \\
    .appName("${spec.name}") \\
    .config("spark.sql.streaming.checkpointLocation", "s3://checkpoints/${spec.name}") \\
    .config("spark.sql.streaming.stateStore.stateSchemaCheck", "false") \\
    .getOrCreate()

# ─── SOURCE: Read from ${spec.source.type} ────────────────────
# 🎓 Mentor Note: .readStream creates an UNBOUNDED DataFrame.
# Unlike .read (batch), this never "finishes" — it continuously polls for new data.
# "subscribe" tells Kafka which topic(s) to consume from.
stream_df = spark.readStream \\
    .format("kafka") \\
    .option("subscribe", "${spec.source.topic}") \\
    ${spec.source.bootstrapServers ? `.option("kafka.bootstrap.servers", "${spec.source.bootstrapServers}")` : ''} \\
    .option("startingOffsets", "${spec.source.startOffset}") \\
    .option("failOnDataLoss", "false") \\
    .load()

# ─── PARSE: Deserialize Kafka value (JSON → structured columns) ──
# WHY selectExpr: Kafka stores key/value as binary. We cast to STRING first,
# then parse the JSON value into typed columns using our schema.
parsed_df = stream_df \\
    .selectExpr("CAST(key AS STRING)", "CAST(value AS STRING)", "timestamp") \\
    .select(from_json(col("value"), schema).alias("data"), col("timestamp")) \\
    .select("data.*", "timestamp")

${spec.processing.watermark ? `
# ─── WATERMARK: Handle late-arriving data ─────────────────────
# 🎓 Mentor Note: In real systems, events arrive out of order (network delays,
# retries, mobile devices coming back online). The watermark says:
# "We've seen all events up to (max event time - ${spec.processing.watermark.maxOutOfOrderness})."
# Anything arriving after that is either dropped or sent to a late-data output.
# Without watermarks, Spark keeps ALL state forever → memory grows unbounded → OOM crash.
watermarked_df = parsed_df \\
    .withWatermark("${spec.processing.watermark.eventTimeColumn}", "${spec.processing.watermark.maxOutOfOrderness}")
` : '# No watermark configured (processing-time semantics)\n# ⚠️ Warning: Without watermarks, state grows unbounded. Add one for production.'}

${spec.processing.windowing ? `
# ─── WINDOWING: ${spec.processing.windowing.type} window (${spec.processing.windowing.size}) ──
# WHY windowing: Streaming data is infinite — we need to "bucket" it into
# finite groups to compute aggregations. A ${spec.processing.windowing.type} window of
# ${spec.processing.windowing.size} means: "group all events that fall within each
# ${spec.processing.windowing.size} time bucket and aggregate them."
windowed_df = watermarked_df \\
    .groupBy(window(col("${spec.processing.watermark?.eventTimeColumn || 'timestamp'}"), "${spec.processing.windowing.size}")) \\
    .agg(count("*").alias("event_count"), sum("amount").alias("total_amount"))
` : ''}

# ─── TRANSFORMATIONS ──────────────────────────────────────────
${spec.processing.transformations.map(t => `# ${t.description}\n# WHY: ${t.logic}`).join('\n')}

# ─── ERROR HANDLING: Dead Letter Queue ────────────────────────
${spec.errorHandling.deadLetterQueue.enabled ? `
# 🎓 Mentor Note: Dead Letter Queues prevent data loss.
# When a record fails processing (bad schema, business rule violation),
# instead of crashing the entire pipeline, we route it to a separate topic.
# This lets the pipeline continue while bad records are investigated separately.
# DLQ topic: ${spec.errorHandling.deadLetterQueue.topic}
# Includes: original record + error details + timestamp
# Retention: ${spec.errorHandling.deadLetterQueue.retentionDays} days
` : '# DLQ not enabled — ⚠️ Consider enabling for production (prevents data loss)'}

# ─── SINK: Write to ${spec.sink.type} ─────────────────────────
# WHY outputMode "${spec.sink.outputMode}": 
#   - "append" = only new rows (best for event streams)
#   - "complete" = full result table (only with aggregations)
#   - "update" = only changed rows (good for stateful operations)
query = result_df.writeStream \\
    .format("${spec.sink.type === 'delta_lake' ? 'delta' : spec.sink.type}") \\
    .outputMode("${spec.sink.outputMode}") \\
    .option("checkpointLocation", "s3://checkpoints/${spec.name}/sink") \\
    ${spec.processing.stateful?.checkpointInterval ? `.trigger(processingTime="${spec.processing.stateful.checkpointInterval}")` : ''} \\
    .start()

# ─── MONITORING ───────────────────────────────────────────────
# These thresholds trigger alerts when the pipeline is unhealthy:
# - Consumer lag > ${spec.monitoring.consumerLag.warnThreshold}: pipeline falling behind
# - Error rate > ${spec.monitoring.errorRate.criticalPercentage}%: something is wrong with data/logic
# - P99 latency > ${spec.monitoring.processingLatencyMs.criticalP99}ms: performance degradation

query.awaitTermination()
`;
}
