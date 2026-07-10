/**
 * EADD Semantic Layer / Metrics Store
 * 
 * ONE definition of "revenue", "active customer", "churn rate" etc.
 * No conflicting versions across the business.
 * 
 * This is what makes executives pay — consistent business language.
 */

export interface MetricDefinition {
  id: string;
  name: string;
  displayName: string;
  description: string;
  /** The ONE formula — single source of truth */
  formula: string;
  /** SQL implementation */
  sql: string;
  /** Which tables/columns feed this metric */
  sourceTables: string[];
  sourceColumns: string[];
  /** Business context */
  owner: string;
  domain: string; // e.g., 'finance', 'marketing', 'operations'
  granularity: string[]; // e.g., ['daily', 'monthly', 'by_region']
  /** Dimensions this metric can be sliced by */
  dimensions: string[];
  /** Data type */
  type: 'currency' | 'percentage' | 'count' | 'ratio' | 'duration';
  /** Formatting */
  format: string; // e.g., 'R#,##0', '#,##0', '0.0%'
  /** Thresholds for alerting */
  thresholds?: { warning: number; critical: number; direction: 'above' | 'below' };
  /** Version (for change tracking) */
  version: number;
  lastModifiedBy: string;
  lastModifiedAt: string;
  /** Status */
  status: 'draft' | 'approved' | 'deprecated';
}

export interface DimensionDefinition {
  id: string;
  name: string;
  displayName: string;
  description: string;
  /** Source table and column */
  sourceTable: string;
  sourceColumn: string;
  /** Possible values (for categorical) */
  possibleValues?: string[];
  /** Hierarchy (e.g., country → region → city) */
  hierarchy?: string[];
}

/**
 * Pre-defined common business metrics
 * These serve as templates — clients customize for their domain
 */
export const COMMON_METRICS: Partial<MetricDefinition>[] = [
  {
    name: 'revenue',
    displayName: 'Total Revenue',
    description: 'Total revenue from all sources, net of returns and discounts',
    formula: 'SUM(order_amount) - SUM(returns) - SUM(discounts)',
    sql: 'SELECT SUM(amount) - SUM(returns) - SUM(discounts) AS revenue FROM fact_orders WHERE status = \'completed\'',
    type: 'currency',
    format: 'R#,##0',
    domain: 'finance',
    dimensions: ['date', 'region', 'product', 'channel', 'customer_segment'],
    granularity: ['daily', 'weekly', 'monthly', 'quarterly', 'annually'],
  },
  {
    name: 'active_customers',
    displayName: 'Active Customers',
    description: 'Customers with at least one transaction in the last 90 days',
    formula: 'COUNT(DISTINCT customer_id) WHERE last_transaction_date >= CURRENT_DATE - 90',
    sql: 'SELECT COUNT(DISTINCT customer_id) FROM fact_orders WHERE order_date >= CURRENT_DATE - INTERVAL \'90 days\'',
    type: 'count',
    format: '#,##0',
    domain: 'marketing',
    dimensions: ['date', 'region', 'segment', 'acquisition_channel'],
    granularity: ['daily', 'weekly', 'monthly'],
  },
  {
    name: 'churn_rate',
    displayName: 'Customer Churn Rate',
    description: 'Percentage of customers lost in the period (no activity in 90+ days)',
    formula: '(customers_lost / customers_start_of_period) * 100',
    sql: 'SELECT (COUNT(CASE WHEN last_activity < CURRENT_DATE - 90 THEN 1 END)::FLOAT / COUNT(*)) * 100 FROM dim_customers WHERE was_active_last_period = true',
    type: 'percentage',
    format: '0.0%',
    domain: 'marketing',
    dimensions: ['date', 'segment', 'product', 'region'],
    granularity: ['monthly', 'quarterly'],
    thresholds: { warning: 5, critical: 10, direction: 'above' },
  },
  {
    name: 'pipeline_success_rate',
    displayName: 'Pipeline Success Rate',
    description: 'Percentage of pipeline runs that completed successfully',
    formula: '(successful_runs / total_runs) * 100',
    type: 'percentage',
    format: '0.0%',
    domain: 'operations',
    dimensions: ['date', 'pipeline_name', 'platform'],
    granularity: ['daily', 'weekly'],
    thresholds: { warning: 95, critical: 90, direction: 'below' },
  },
];

export class SemanticLayerService {
  private metrics: Map<string, MetricDefinition> = new Map();
  private dimensions: Map<string, DimensionDefinition> = new Map();

  /** Register a metric definition (single source of truth) */
  defineMetric(metric: MetricDefinition): void {
    if (this.metrics.has(metric.name)) {
      const existing = this.metrics.get(metric.name)!;
      if (existing.status === 'approved' && metric.version <= existing.version) {
        throw new Error(`Metric "${metric.name}" already has an approved v${existing.version}. Create a new version to modify.`);
      }
    }
    this.metrics.set(metric.name, metric);
  }

  /** Get the ONE definition of a metric */
  getMetric(name: string): MetricDefinition | undefined {
    return this.metrics.get(name.toLowerCase());
  }

  /** Resolve a natural language term to a metric */
  resolveBusinessTerm(term: string): MetricDefinition | undefined {
    const lower = term.toLowerCase();
    // Direct match
    if (this.metrics.has(lower)) return this.metrics.get(lower);
    // Fuzzy match on display name or description
    for (const metric of this.metrics.values()) {
      if (metric.displayName.toLowerCase().includes(lower) || metric.description.toLowerCase().includes(lower)) {
        return metric;
      }
    }
    return undefined;
  }

  /** Get all metrics for a domain */
  getMetricsByDomain(domain: string): MetricDefinition[] {
    return Array.from(this.metrics.values()).filter(m => m.domain === domain);
  }

  /** Generate SQL for a metric query (used by NLQ engine) */
  generateMetricSQL(metricName: string, dimensions?: string[], filters?: Record<string, string>): string {
    const metric = this.getMetric(metricName);
    if (!metric) throw new Error(`Unknown metric: "${metricName}". Available: ${Array.from(this.metrics.keys()).join(', ')}`);
    return metric.sql;
  }
}
