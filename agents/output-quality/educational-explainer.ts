/**
 * EADD Educational Explanation Engine
 * 
 * Every decision, every code block, every architecture choice gets a
 * "WHY" explanation — like having a patient senior mentor sitting next to you.
 * 
 * Levels:
 * - BEGINNER: Explains everything, assumes no prior knowledge
 * - INTERMEDIATE: Explains decisions and trade-offs, assumes basic knowledge
 * - EXPERT: Brief justifications only, focuses on non-obvious insights
 * 
 * The system learns the user's level from their questions and adjusts.
 */

export type ExplanationLevel = 'beginner' | 'intermediate' | 'expert';
export type ExplanationCategory = 
  | 'architecture_decision'
  | 'platform_choice'
  | 'code_pattern'
  | 'data_modeling'
  | 'performance_choice'
  | 'security_decision'
  | 'cost_trade_off'
  | 'operational_choice'
  | 'quality_rule'
  | 'deployment_strategy';

export interface Explanation {
  id: string;
  category: ExplanationCategory;
  /** The decision/code being explained */
  subject: string;
  /** One-line summary */
  headline: string;
  /** Full explanation (WHY) */
  why: string;
  /** What would happen without this */
  withoutThis: string;
  /** Alternative approaches considered */
  alternatives: AlternativeExplanation[];
  /** When this might NOT be the right choice */
  caveats: string[];
  /** Links to learn more */
  learnMore: string[];
  /** Difficulty level of the concept */
  conceptLevel: ExplanationLevel;
}

export interface AlternativeExplanation {
  name: string;
  whyNot: string;
  whenToUse: string;
}

// ============================================================
// EXPLANATION TEMPLATES
// ============================================================

export const ARCHITECTURE_EXPLANATIONS: Record<string, Explanation> = {
  medallion_architecture: {
    id: 'exp_medallion',
    category: 'architecture_decision',
    subject: 'Medallion Architecture (Bronze → Silver → Gold)',
    headline: 'We organize data in 3 layers to separate concerns: raw ingestion, cleaning, and business logic.',
    why: `The Medallion architecture (coined by Databricks) separates your data pipeline into 3 zones:

**Bronze (Raw)**: Land data exactly as received from the source. No transformations. This is your "insurance policy" — if anything goes wrong downstream, you can always replay from Bronze.

**Silver (Cleaned)**: Apply data quality rules, deduplication, type casting, and standardization. This layer is "trusted but not business-ready."

**Gold (Business)**: Aggregated, enriched, business-logic-applied data. This is what dashboards and ML models consume.

WHY THIS MATTERS: Without these layers, a bug in your transformation logic could corrupt your only copy of the data. With Bronze, you can always reprocess. It also lets different teams work independently — the ingestion team owns Bronze, the data engineering team owns Silver, and analytics owns Gold.`,
    withoutThis: 'Without layered architecture, a single bug in transformation could corrupt your only data copy. Debugging becomes impossible because you lose the original state. Teams step on each other because everyone writes to the same tables.',
    alternatives: [
      { name: 'Direct Load (single layer)', whyNot: 'No recovery point if transformations fail. Cannot audit what the source sent.', whenToUse: 'Only for throwaway analytics or very simple, low-risk pipelines.' },
      { name: 'Lambda Architecture', whyNot: 'Maintains two code paths (batch + speed layer). Double the maintenance, double the bugs.', whenToUse: 'When you need both real-time AND accurate historical — but modern streaming (Delta/Iceberg) makes this unnecessary.' },
      { name: 'Kappa Architecture', whyNot: 'Everything through a stream — but reprocessing history is expensive and complex.', whenToUse: 'When your primary access pattern is event-driven and you rarely need full historical reprocessing.' },
    ],
    caveats: [
      'Adds storage cost (3 copies of data). Mitigate with lifecycle policies on Bronze.',
      'Adds latency (3 processing steps). Not ideal if you need sub-second end-to-end.',
      'Can be overkill for very simple, non-critical data flows.',
    ],
    learnMore: [
      'https://www.databricks.com/glossary/medallion-architecture',
      'https://learn.microsoft.com/en-us/azure/databricks/lakehouse/medallion',
    ],
    conceptLevel: 'beginner',
  },

  star_schema: {
    id: 'exp_star_schema',
    category: 'data_modeling',
    subject: 'Star Schema (Kimball Dimensional Modeling)',
    headline: 'We organize data into Facts (events/transactions) and Dimensions (context) for fast analytics.',
    why: `Star schema puts your measurable events (sales, clicks, transactions) in FACT tables and the context around them (customer info, product details, dates) in DIMENSION tables.

WHY: Analytics queries are almost always "give me [measure] by [dimension]" — e.g., "total revenue by region by quarter." Star schema is physically optimized for this pattern. The database can scan the small dimension tables quickly, then join to the fact table with minimal I/O.

The alternative (fully normalized 3NF) requires many JOINs which kill query performance at scale. Star schema trades some storage redundancy for 10-100x faster queries.`,
    withoutThis: 'Without dimensional modeling, your analysts write complex multi-join queries that are slow, error-prone, and inconsistent. Each person may calculate "revenue" differently.',
    alternatives: [
      { name: 'Snowflake Schema', whyNot: 'Normalizes dimensions into sub-dimensions. Saves some storage but adds JOINs. Usually not worth the complexity.', whenToUse: 'When dimension tables are very large (>100M rows) and you need to save storage.' },
      { name: 'Data Vault', whyNot: 'More complex, designed for auditability over query performance. Requires a presentation layer on top.', whenToUse: 'Heavily regulated environments (banking, healthcare) where full audit trail is mandatory.' },
      { name: 'One Big Table (OBT)', whyNot: 'Single denormalized table. Simple but wasteful and inflexible.', whenToUse: 'Small datasets (<1M rows) or throwaway analysis.' },
    ],
    caveats: [
      'Requires upfront design effort — you must identify facts vs dimensions before loading.',
      'Schema changes (new dimensions) can be painful — plan for SCD Type 2 from the start.',
      'Not ideal for operational/transactional systems — use for analytics only.',
    ],
    learnMore: [
      'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/',
    ],
    conceptLevel: 'beginner',
  },

  incremental_loading: {
    id: 'exp_incremental',
    category: 'code_pattern',
    subject: 'Incremental Loading (vs Full Refresh)',
    headline: 'We only process NEW or CHANGED records each run, not the entire dataset.',
    why: `Incremental loading uses a "watermark" (usually a timestamp column like updated_at or an auto-incrementing ID) to track where the last run left off. Each new run only processes records after that watermark.

WHY: If your source has 100M records but only 10K changed since yesterday, why process all 100M? Incremental loading reduces:
- **Compute cost**: Process 10K rows instead of 100M (99.99% reduction)
- **Runtime**: Minutes instead of hours
- **Source load**: Less strain on the operational database
- **Target writes**: Only touch changed records

The trade-off is complexity: you must handle deletes separately (soft deletes or CDC), and you need a reliable watermark column.`,
    withoutThis: 'Full refresh every time means: higher cloud costs (processing ALL data), longer runtimes (hours instead of minutes), more strain on source databases, and unnecessary writes to your target.',
    alternatives: [
      { name: 'Full Refresh', whyNot: 'Processes everything every run. Simple but expensive and slow at scale.', whenToUse: 'Small tables (<1M rows), reference data that changes rarely, or when you cannot trust a watermark column.' },
      { name: 'CDC (Change Data Capture)', whyNot: 'More complex to set up (requires Debezium/DMS/log-based replication).', whenToUse: 'When you need real-time sync, must capture deletes, or the source has no reliable watermark.' },
      { name: 'Partition Overwrite', whyNot: 'Rewrites entire partitions. More data than pure incremental but handles late-arriving data well.', whenToUse: 'Date-partitioned data where late arrivals are common (event data, logs).' },
    ],
    caveats: [
      'Requires a reliable watermark column (updated_at MUST be set on every change).',
      'Does not capture hard deletes — use soft deletes or CDC for that.',
      'First run must be a full load (backfill), then switch to incremental.',
      'Late-arriving data may be missed if watermark has already advanced.',
    ],
    learnMore: [
      'https://docs.getdbt.com/docs/build/incremental-models',
    ],
    conceptLevel: 'intermediate',
  },

  exactly_once_semantics: {
    id: 'exp_exactly_once',
    category: 'code_pattern',
    subject: 'Exactly-Once Delivery Semantics',
    headline: 'We guarantee each record is processed exactly once — no duplicates, no data loss.',
    why: `In distributed systems, messages can be: lost (at-most-once), duplicated (at-least-once), or processed exactly once. "Exactly once" is the gold standard but the hardest to achieve.

HOW IT WORKS: Spark Structured Streaming achieves exactly-once by:
1. **Checkpointing**: Recording the exact offset (position) in Kafka after each micro-batch
2. **Idempotent writes**: Using Delta Lake's ACID transactions to ensure partial writes are rolled back
3. **WAL (Write-Ahead Log)**: Recording intent before execution

If the job crashes mid-batch, on restart it reads the checkpoint, finds the last successful offset, and replays from there. Delta Lake ensures the partial write from the crash is not visible.

WHY THIS MATTERS: In financial/payment systems, a duplicate message could charge a customer twice. A lost message could mean money disappears. Exactly-once prevents both.`,
    withoutThis: 'Without exactly-once: at-least-once gives duplicates (double-charging customers, inflated metrics). At-most-once loses data (missing transactions, undercounting).',
    alternatives: [
      { name: 'At-least-once + Dedup', whyNot: 'Simpler to implement but adds complexity at the consumer. Must maintain a dedup store.', whenToUse: 'When the sink cannot support transactions (e.g., HTTP APIs, email systems).' },
      { name: 'At-most-once', whyNot: 'Loses data. Unacceptable for financial, healthcare, or any critical system.', whenToUse: 'Only for non-critical, best-effort scenarios like click analytics where a few lost events are acceptable.' },
    ],
    caveats: [
      'Exactly-once adds latency (transaction overhead).',
      'Only works end-to-end if BOTH source and sink support it (Kafka + Delta = yes, Kafka + HTTP = no).',
      'Checkpoints must be stored durably (S3, HDFS) — local disk risks data loss.',
    ],
    learnMore: [
      'https://spark.apache.org/docs/latest/structured-streaming-programming-guide.html#fault-tolerance-semantics',
    ],
    conceptLevel: 'expert',
  },
};

export const CODE_PATTERN_EXPLANATIONS: Record<string, string> = {
  // PySpark patterns
  'withColumn': '# WHY .withColumn(): Adds or replaces a column in the DataFrame.\n# It returns a NEW DataFrame (DataFrames are immutable in Spark).\n# Chain multiple .withColumn() calls for multiple new columns.',
  
  'withWatermark': '# WHY .withWatermark(): Tells Spark "how late can data arrive?"\n# Without this, Spark keeps ALL state forever (memory grows unbounded).\n# With watermark, Spark drops state older than the threshold, preventing OOM.',
  
  'checkpointLocation': '# WHY checkpointLocation: Streaming jobs MUST have this.\n# If the job crashes, it restarts from the last checkpoint (not from zero).\n# Store on durable storage (S3/HDFS), never local disk.',
  
  'window_function': '# WHY window(): Groups streaming data into time buckets.\n# "Tumbling" = non-overlapping fixed windows (e.g., every 5 min)\n# "Sliding" = overlapping windows (e.g., 10-min window, sliding every 5 min)',
  
  'schema_definition': '# WHY explicit schema: Spark\'s schema inference reads ALL data to guess types.\n# For streaming, inference is impossible (infinite data). Define schema upfront.\n# For batch, inference is slow and may guess wrong (int vs long, string vs date).',
  
  'partition_by': '# WHY partitionBy(): Physically organizes data files by column value.\n# Queries filtering on partition columns skip entire folders (partition pruning).\n# Choose columns with LOW cardinality that you frequently filter on (date, region).',
  
  'repartition': '# WHY repartition(): Controls the number of output files.\n# Too few files = large files, slow reads, no parallelism.\n# Too many files = "small file problem", metadata overhead.\n# Rule of thumb: target 128MB-256MB per file for Parquet.',
  
  'broadcast_join': '# WHY broadcast(): For joining a LARGE table with a SMALL table (<100MB).\n# Sends the small table to all executors (avoids expensive shuffle).\n# Result: 10-100x faster joins when dimension table is small.',
  
  'cache': '# WHY .cache(): Keeps DataFrame in memory for reuse.\n# Use when the SAME DataFrame is used multiple times downstream.\n# Do NOT cache if used only once (wastes memory).\n# Call .unpersist() when done to free memory.',
  
  // Airflow patterns
  'catchup_false': '# WHY catchup=False: Without this, Airflow runs ALL missed intervals on first deploy.\n# If your DAG has daily schedule and start_date=2020-01-01, it would try to run\n# 1500+ historical DAG runs on first trigger. Usually not what you want.',
  
  'max_active_runs': '# WHY max_active_runs=1: Prevents parallel DAG runs that could cause data conflicts.\n# For ETL pipelines, you typically want sequential execution to maintain ordering.\n# Set higher only if your pipeline handles concurrent runs safely.',
  
  // dbt patterns
  'ref_function': "-- WHY {{ ref('model') }}: Creates a dependency in dbt's DAG.\n-- dbt knows to run the referenced model FIRST, then this one.\n-- Also handles schema/database name resolution across environments.",
  
  'source_freshness': "-- WHY source freshness: Alerts you when upstream data stops flowing.\n-- If your source hasn't updated in > expected interval, something is broken upstream.\n-- Better to catch this EARLY than discover stale dashboards days later.",
  
  'incremental_strategy': "-- WHY is_incremental(): Only processes new rows on subsequent runs.\n-- First run: full table load. After that: only rows since last run.\n-- Reduces cost by 90%+ for append-heavy tables.",
};

// ============================================================
// THE EXPLAINER ENGINE
// ============================================================

export class EducationalExplainer {
  private userLevel: ExplanationLevel = 'intermediate';
  private explanationsUsed: Set<string> = new Set();

  /**
   * Set the explanation detail level
   */
  setLevel(level: ExplanationLevel): void {
    this.userLevel = level;
  }

  /**
   * Auto-detect user level from their message
   */
  detectLevel(userMessage: string): ExplanationLevel {
    const lower = userMessage.toLowerCase();
    
    // Expert indicators
    if (/partition prun|predicate pushdown|catalyst|execution plan|broadcast threshold|shuffle partition|skew join/i.test(lower)) {
      return 'expert';
    }
    
    // Beginner indicators
    if (/what is|how do i|i'm new|beginner|first time|never used|explain|teach me/i.test(lower)) {
      return 'beginner';
    }
    
    return 'intermediate';
  }

  /**
   * Generate inline code explanation comments
   */
  explainCode(code: string, framework: string): string {
    if (this.userLevel === 'expert') return code; // Experts don't need hand-holding

    let explained = code;
    
    for (const [pattern, explanation] of Object.entries(CODE_PATTERN_EXPLANATIONS)) {
      if (code.includes(pattern) && !this.explanationsUsed.has(pattern)) {
        // Add explanation comment before the first occurrence
        const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^.*${escapedPattern}.*)`, 'm');
        const match = explained.match(regex);
        if (match) {
          const indent = match[1].match(/^(\s*)/)?.[1] || '';
          const commentedExplanation = explanation.split('\n').map(line => indent + line).join('\n');
          explained = explained.replace(regex, commentedExplanation + '\n$1');
        }
        this.explanationsUsed.add(pattern);
      }
    }

    return explained;
  }

  /**
   * Generate a full decision explanation
   */
  explainDecision(decisionId: string): Explanation | null {
    return ARCHITECTURE_EXPLANATIONS[decisionId] || null;
  }

  /**
   * Format an explanation for the user's level
   */
  formatExplanation(explanation: Explanation): string {
    switch (this.userLevel) {
      case 'beginner':
        return this.formatBeginner(explanation);
      case 'intermediate':
        return this.formatIntermediate(explanation);
      case 'expert':
        return this.formatExpert(explanation);
    }
  }

  private formatBeginner(exp: Explanation): string {
    return `
### 💡 Why: ${exp.subject}

**In simple terms:** ${exp.headline}

**The full story:**
${exp.why}

**What happens if we skip this?**
${exp.withoutThis}

**Other approaches we considered:**
${exp.alternatives.map(a => `- **${a.name}**: ${a.whyNot}\n  → Use when: ${a.whenToUse}`).join('\n')}

**Watch out for:**
${exp.caveats.map(c => `- ⚠️ ${c}`).join('\n')}

**Learn more:** ${exp.learnMore.map(l => `[Link](${l})`).join(', ')}
`;
  }

  private formatIntermediate(exp: Explanation): string {
    return `
### 💡 ${exp.headline}

${exp.why.split('\n').slice(0, 5).join('\n')}

**Trade-offs:** ${exp.caveats.slice(0, 2).join(' | ')}
**Alternatives:** ${exp.alternatives.map(a => `${a.name} (${a.whyNot.slice(0, 50)}...)`).join(', ')}
`;
  }

  private formatExpert(exp: Explanation): string {
    return `> 💡 ${exp.headline} | Trade-offs: ${exp.caveats[0] || 'none'}\n`;
  }

  /**
   * Generate a "mentor note" for a specific code section
   */
  mentorNote(topic: string, context: string): string {
    const notes: Record<string, string> = {
      'checkpoint': '🎓 **Mentor Note**: Checkpoints are your streaming job\'s "save game." If the cluster dies mid-batch, the job resumes from the last checkpoint — not from the beginning. Always store checkpoints on durable storage (S3, ADLS, GCS), never on local disk which is ephemeral.',
      
      'watermark': '🎓 **Mentor Note**: Watermarks solve the "how long do we wait?" problem. In real-world systems, events arrive out of order (network delays, retries). The watermark says "we\'ve seen everything up to time T minus our allowed lateness." Anything arriving after that window closes is either dropped or sent to a late-data side output.',
      
      'idempotent': '🎓 **Mentor Note**: Idempotent means "running it twice gives the same result as running it once." This is CRITICAL for production pipelines because things WILL fail and WILL be retried. Use MERGE/UPSERT instead of INSERT, use IF NOT EXISTS for DDL, and use deterministic IDs instead of auto-increment.',
      
      'scd2': '🎓 **Mentor Note**: SCD Type 2 (Slowly Changing Dimension) keeps history. When a customer changes address, instead of overwriting, we close the old record (set end_date) and insert a new one. This lets analysts ask "what was the customer\'s address when they made this purchase?" — crucial for accurate historical reporting.',
      
      'partitioning': '🎓 **Mentor Note**: Think of partitioning like organizing files into folders. If you partition by date, queries filtering on date only open the relevant folders — skipping 99% of the data. Choose partition columns carefully: they should have moderate cardinality (100-10,000 values), be frequently filtered, and grow over time.',
      
      'cost_awareness': '🎓 **Mentor Note**: Every cloud resource has a meter running. Snowflake charges per-second of compute. Databricks charges per-DBU. AWS Glue charges per-DPU-hour. Always ask: "Do I need this resource running 24/7, or can it be on-demand?" Auto-suspend warehouses, use spot/preemptible instances for non-critical jobs, and set billing alerts.',
      
      'testing': '🎓 **Mentor Note**: Data pipelines fail silently — they produce wrong data without errors. Unlike application bugs that crash, a bad JOIN silently duplicates rows. This is why data quality tests (row counts, null checks, uniqueness) are not optional — they\'re the only way to catch silent failures.',
    };

    return notes[topic] || `🎓 **Mentor Note**: ${context}`;
  }

  /**
   * Reset explanations tracking (for new conversation)
   */
  reset(): void {
    this.explanationsUsed.clear();
  }
}
