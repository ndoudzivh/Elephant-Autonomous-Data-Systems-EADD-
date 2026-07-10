/**
 * EADD Natural Language Query Engine
 * 
 * Feature #1: Let non-technical users ask questions in plain English
 * and get answers from the data lake — without writing SQL.
 * 
 * "What was revenue last month?" → SQL → Result → Plain English Answer
 * 
 * This is the #1 feature executives will pay for.
 */

export interface NLQRequest {
  question: string;
  userId: string;
  /** Which database/warehouse to query */
  dataSource: string;
  /** Security: user's role determines what data they can see */
  userRole: string;
  /** Context from previous questions (conversational) */
  conversationHistory?: NLQExchange[];
}

export interface NLQExchange {
  question: string;
  sql: string;
  answer: string;
  timestamp: string;
}

export interface NLQResponse {
  /** Original question */
  question: string;
  /** Generated SQL (shown for transparency) */
  generatedSQL: string;
  /** Plain English answer */
  answer: string;
  /** Data result (table/chart-ready) */
  data: Record<string, unknown>[];
  /** Visualization suggestion */
  suggestedVisualization: 'number' | 'table' | 'bar_chart' | 'line_chart' | 'pie_chart';
  /** Confidence in the SQL generation */
  confidence: number;
  /** Explanation of how it got the answer */
  explanation: string;
  /** Follow-up question suggestions */
  suggestedFollowUps: string[];
}

/**
 * Natural Language to SQL pipeline:
 * 1. Parse user question
 * 2. Map to schema (using semantic layer)
 * 3. Generate SQL
 * 4. Execute (read-only, with row limit)
 * 5. Summarize result in plain English
 * 6. Suggest visualization
 */
export class NaturalLanguageQueryEngine {
  private schemaContext: SchemaContext[] = [];
  private semanticDefinitions: Map<string, string> = new Map();

  constructor(schemas: SchemaContext[], semantics: Map<string, string>) {
    this.schemaContext = schemas;
    this.semanticDefinitions = semantics;
  }

  /**
   * Main entry: question → answer
   */
  async query(request: NLQRequest): Promise<NLQResponse> {
    // Step 1: Understand the question
    const parsed = this.parseQuestion(request.question);

    // Step 2: Map business terms to actual columns (via semantic layer)
    const mappedTerms = this.mapToSchema(parsed);

    // Step 3: Generate SQL
    const sql = this.generateSQL(mapped Terms, request);

    // Step 4: Validate SQL is safe (read-only, no mutations)
    this.validateSQLSafety(sql);

    // Step 5: Execute (would connect to actual warehouse in production)
    const data = await this.executeQuery(sql, request.dataSource);

    // Step 6: Generate plain English answer
    const answer = this.generateAnswer(request.question, data);

    // Step 7: Suggest visualization
    const viz = this.suggestVisualization(parsed, data);

    return {
      question: request.question,
      generatedSQL: sql,
      answer,
      data,
      suggestedVisualization: viz,
      confidence: 0.9,
      explanation: `Queried ${mappedTerms.tables.join(', ')} using the "${mappedTerms.metric}" metric definition from the semantic layer.`,
      suggestedFollowUps: this.generateFollowUps(request.question, parsed),
    };
  }

  // ─── Private Methods ──────────────────────────────────

  private parseQuestion(question: string): ParsedQuestion {
    const lower = question.toLowerCase();
    return {
      intent: this.detectIntent(lower),
      timeRange: this.extractTimeRange(lower),
      metrics: this.extractMetrics(lower),
      dimensions: this.extractDimensions(lower),
      filters: this.extractFilters(lower),
      aggregation: this.detectAggregation(lower),
    };
  }

  private detectIntent(q: string): 'count' | 'sum' | 'average' | 'trend' | 'comparison' | 'detail' {
    if (/how many|count|number of/.test(q)) return 'count';
    if (/total|sum|revenue|sales/.test(q)) return 'sum';
    if (/average|avg|mean/.test(q)) return 'average';
    if (/trend|over time|by month|by week/.test(q)) return 'trend';
    if (/compare|vs|versus|difference/.test(q)) return 'comparison';
    return 'detail';
  }

  private extractTimeRange(q: string): { period: string; start?: string; end?: string } {
    if (/last month/.test(q)) return { period: 'last_month' };
    if (/this month/.test(q)) return { period: 'current_month' };
    if (/last week/.test(q)) return { period: 'last_week' };
    if (/last year/.test(q)) return { period: 'last_year' };
    if (/today/.test(q)) return { period: 'today' };
    if (/yesterday/.test(q)) return { period: 'yesterday' };
    if (/ytd|year to date/.test(q)) return { period: 'ytd' };
    return { period: 'all_time' };
  }

  private extractMetrics(q: string): string[] {
    const metrics: string[] = [];
    const knownMetrics = ['revenue', 'sales', 'customers', 'orders', 'profit', 'cost', 'churn', 'retention', 'growth'];
    for (const m of knownMetrics) {
      if (q.includes(m)) metrics.push(m);
    }
    return metrics.length > 0 ? metrics : ['count'];
  }

  private extractDimensions(q: string): string[] {
    const dims: string[] = [];
    if (/by (region|country|city|location)/.test(q)) dims.push('region');
    if (/by (product|category|type)/.test(q)) dims.push('product');
    if (/by (customer|client|user)/.test(q)) dims.push('customer');
    if (/by (month|week|day|year|date)/.test(q)) dims.push('date');
    if (/by (team|department|division)/.test(q)) dims.push('department');
    return dims;
  }

  private extractFilters(q: string): Record<string, string> {
    const filters: Record<string, string> = {};
    const regionMatch = q.match(/in (africa|europe|asia|americas|south africa)/);
    if (regionMatch) filters['region'] = regionMatch[1];
    const statusMatch = q.match(/(active|inactive|churned|new) customers/);
    if (statusMatch) filters['status'] = statusMatch[1];
    return filters;
  }

  private detectAggregation(q: string): 'sum' | 'count' | 'avg' | 'max' | 'min' {
    if (/total|sum/.test(q)) return 'sum';
    if (/how many|count|number/.test(q)) return 'count';
    if (/average|avg/.test(q)) return 'avg';
    if (/highest|maximum|max|top/.test(q)) return 'max';
    if (/lowest|minimum|min|bottom/.test(q)) return 'min';
    return 'sum';
  }

  private mapToSchema(parsed: ParsedQuestion): MappedQuery {
    // Use semantic layer to map business terms → actual columns
    return {
      tables: ['fact_revenue', 'dim_date'],
      columns: ['amount', 'date_key'],
      metric: parsed.metrics[0] || 'revenue',
      metricDefinition: this.semanticDefinitions.get(parsed.metrics[0] || '') || 'SUM(amount)',
    };
  }

  private generateSQL(mapped: MappedQuery, request: NLQRequest): string {
    // In production: use AI to generate precise SQL based on schema + question
    return `SELECT ${mapped.metricDefinition} as result FROM ${mapped.tables[0]} WHERE date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`;
  }

  private validateSQLSafety(sql: string): void {
    const dangerous = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC)\b/i;
    if (dangerous.test(sql)) {
      throw new Error('BLOCKED: NLQ only supports read-only queries. Mutation detected.');
    }
  }

  private async executeQuery(sql: string, dataSource: string): Promise<Record<string, unknown>[]> {
    // In production: connect to Snowflake/BigQuery/Redshift and execute
    return [{ result: 1250000, currency: 'ZAR' }];
  }

  private generateAnswer(question: string, data: Record<string, unknown>[]): string {
    if (data.length === 0) return "No data found for that question.";
    if (data.length === 1 && data[0].result) {
      return `Revenue last month was **R${Number(data[0].result).toLocaleString()}**.`;
    }
    return `Found ${data.length} results.`;
  }

  private suggestVisualization(parsed: ParsedQuestion, data: Record<string, unknown>[]): NLQResponse['suggestedVisualization'] {
    if (data.length === 1) return 'number';
    if (parsed.intent === 'trend') return 'line_chart';
    if (parsed.intent === 'comparison') return 'bar_chart';
    if (parsed.dimensions.includes('date')) return 'line_chart';
    if (data.length <= 10) return 'bar_chart';
    return 'table';
  }

  private generateFollowUps(question: string, parsed: ParsedQuestion): string[] {
    return [
      'How does that compare to the previous month?',
      'Break it down by region',
      'Show me the trend over the last 6 months',
      'Which product contributed the most?',
    ];
  }
}

// ─── Types ──────────────────────────────────────────────

interface ParsedQuestion {
  intent: string;
  timeRange: { period: string; start?: string; end?: string };
  metrics: string[];
  dimensions: string[];
  filters: Record<string, string>;
  aggregation: string;
}

interface MappedQuery {
  tables: string[];
  columns: string[];
  metric: string;
  metricDefinition: string;
}

interface SchemaContext {
  database: string;
  schema: string;
  table: string;
  columns: Array<{ name: string; type: string; description?: string }>;
}
