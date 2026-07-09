/**
 * Agent Knowledge Memory
 * 
 * Learns from previous pipeline builds. Stores:
 * - Patterns that worked well
 * - Common mistakes to avoid
 * - Platform-specific best practices
 * - Cost benchmarks
 * 
 * This is what makes EADD get BETTER over time.
 */

export interface KnowledgeEntry {
  id: string;
  category: 'pattern' | 'anti_pattern' | 'cost_benchmark' | 'best_practice' | 'lesson_learned';
  platform: string;
  context: string;
  knowledge: string;
  confidence: number;
  usageCount: number;
  lastUsed: string;
  createdAt: string;
}

/**
 * Pre-loaded knowledge base - Senior Data Engineer experience encoded
 * These represent 10+ years of data engineering experience
 */
export const INITIAL_KNOWLEDGE: KnowledgeEntry[] = [
  // ─── Platform Selection Patterns ────────────────────────
  {
    id: 'k001',
    category: 'pattern',
    platform: 'snowflake',
    context: 'SQL-heavy analytics workload, < 10TB, multiple teams',
    knowledge: 'Use Snowflake + dbt for separation of compute/storage, pay-per-query economics, and multi-cluster warehouses for team isolation. Cost-effective at this scale vs running dedicated Spark clusters.',
    confidence: 0.95,
    usageCount: 0,
    lastUsed: '',
    createdAt: '2026-01-01',
  },
  {
    id: 'k002',
    category: 'pattern',
    platform: 'databricks',
    context: 'ML/AI workloads, streaming data, large-scale ETL > 10TB',
    knowledge: 'Databricks excels when you need unified batch+streaming (Delta Live Tables), ML model training alongside ETL, or processing > 10TB. Unity Catalog provides governance. Cost: use auto-scaling clusters with spot instances.',
    confidence: 0.92,
    usageCount: 0,
    lastUsed: '',
    createdAt: '2026-01-01',
  },
  {
    id: 'k003',
    category: 'pattern',
    platform: 'aws',
    context: 'Serverless, event-driven, cost-sensitive, < 5TB',
    knowledge: 'AWS Glue + S3 + Athena for serverless ETL. No infrastructure management. Pay only for compute time. Best for scheduled batch jobs < 5TB. Add Step Functions for orchestration. Lambda for lightweight triggers.',
    confidence: 0.90,
    usageCount: 0,
    lastUsed: '',
    createdAt: '2026-01-01',
  },
  {
    id: 'k004',
    category: 'pattern',
    platform: 'azure',
    context: 'Microsoft ecosystem, Power BI, Office 365 integration',
    knowledge: 'Azure Data Factory + Synapse when organization is Microsoft-heavy. Native integration with Power BI, Teams, and Active Directory. Use Synapse Spark for big data, Dedicated SQL for DWH workloads.',
    confidence: 0.88,
    usageCount: 0,
    lastUsed: '',
    createdAt: '2026-01-01',
  },

  // ─── Anti-Patterns ──────────────────────────────────────
  {
    id: 'k010',
    category: 'anti_pattern',
    platform: 'all',
    context: 'Pipeline design',
    knowledge: 'NEVER do full table refresh on large tables when incremental is possible. A daily full refresh of 100M+ rows wastes compute, increases latency, and risks data loss if interrupted. Always use watermark-based incremental unless business logic requires full refresh.',
    confidence: 0.98,
    usageCount: 0,
    lastUsed: '',
    createdAt: '2026-01-01',
  },
  {
    id: 'k011',
    category: 'anti_pattern',
    platform: 'all',
    context: 'Security',
    knowledge: 'NEVER store credentials in code, config files, or environment variables that are committed to git. Always use a secrets manager (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault). Reference secrets at runtime, never at build time.',
    confidence: 0.99,
    usageCount: 0,
    lastUsed: '',
    createdAt: '2026-01-01',
  },
  {
    id: 'k012',
    category: 'anti_pattern',
    platform: 'snowflake',
    context: 'Cost management',
    knowledge: 'NEVER use an XL warehouse for simple SELECT queries. Start with X-Small, let auto-suspend handle idle time (60s minimum). A misconfigured warehouse can cost $1000+/day. Always set RESOURCE_MONITOR alerts.',
    confidence: 0.95,
    usageCount: 0,
    lastUsed: '',
    createdAt: '2026-01-01',
  },

  // ─── Cost Benchmarks ────────────────────────────────────
  {
    id: 'k020',
    category: 'cost_benchmark',
    platform: 'snowflake',
    context: 'Standard analytics pipeline, daily batch, < 1TB',
    knowledge: 'Typical cost: $500-1500/month. Breakdown: Warehouse compute (60%), Storage (20%), Data transfer (10%), Other (10%). Optimize by: auto-suspend at 60s, use X-Small for simple queries, cluster keys for large tables.',
    confidence: 0.85,
    usageCount: 0,
    lastUsed: '',
    createdAt: '2026-01-01',
  },
  {
    id: 'k021',
    category: 'cost_benchmark',
    platform: 'aws',
    context: 'Serverless ETL pipeline, daily, < 500GB',
    knowledge: 'Typical cost: $200-800/month. Breakdown: Glue ETL (40%), S3 storage (15%), Lambda (5%), Step Functions (5%), Other (35%). Optimize by: right-size Glue workers, use S3 Intelligent-Tiering, avoid running full-refresh.',
    confidence: 0.82,
    usageCount: 0,
    lastUsed: '',
    createdAt: '2026-01-01',
  },

  // ─── Best Practices ─────────────────────────────────────
  {
    id: 'k030',
    category: 'best_practice',
    platform: 'dbt',
    context: 'Project structure and modeling',
    knowledge: 'Use the staging → intermediate → marts pattern. Staging = 1:1 source mirrors (renamed, typed). Intermediate = business logic joins. Marts = final business-ready tables. This provides clear lineage, testability, and modularity. Always add schema tests on marts.',
    confidence: 0.95,
    usageCount: 0,
    lastUsed: '',
    createdAt: '2026-01-01',
  },
  {
    id: 'k031',
    category: 'best_practice',
    platform: 'all',
    context: 'Data quality',
    knowledge: 'Implement quality checks at EVERY layer boundary: after ingestion (Bronze), after transformation (Silver), and before serving (Gold). Minimum checks: not_null on keys, unique on primary keys, freshness < SLA. Quarantine bad records, never drop them silently.',
    confidence: 0.97,
    usageCount: 0,
    lastUsed: '',
    createdAt: '2026-01-01',
  },
  {
    id: 'k032',
    category: 'best_practice',
    platform: 'all',
    context: 'Pipeline resilience',
    knowledge: 'Every pipeline must be: 1) Idempotent (safe to re-run), 2) Incremental (avoid full refresh), 3) Observable (logging + metrics), 4) Recoverable (retry + dead letter queue). These are non-negotiable for production.',
    confidence: 0.98,
    usageCount: 0,
    lastUsed: '',
    createdAt: '2026-01-01',
  },
];
