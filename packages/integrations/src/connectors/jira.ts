/**
 * Jira Integration
 * 
 * Reads Jira tickets assigned to data engineers, extracts:
 * - Source system details
 * - Business requirements
 * - Target system expectations
 * - Acceptance criteria
 * 
 * Then feeds this into the EADPA agent to auto-generate
 * the pipeline, mapping, and data model.
 */

export interface JiraConfig {
  /** Jira instance URL (e.g., https://company.atlassian.net) */
  baseUrl: string;
  /** API token or OAuth credentials */
  auth: {
    type: 'basic' | 'oauth2' | 'pat';
    /** For basic: email:api_token. For PAT: token. For OAuth: access_token */
    credentials_ref: string; // Reference to secrets manager - never raw
  };
  /** Project key to monitor */
  projectKey: string;
  /** JQL filter for data engineering tickets */
  jqlFilter?: string;
  /** Labels that identify pipeline tasks */
  pipelineLabels?: string[];
}

export interface JiraTicket {
  key: string;           // e.g., "DATA-1234"
  summary: string;
  description: string;
  status: string;
  assignee: string;
  priority: string;
  labels: string[];
  /** Custom fields for data engineering context */
  sourceSystem?: string;
  targetSystem?: string;
  dataModel?: string;
  acceptanceCriteria?: string[];
  attachments?: string[];
  comments?: JiraComment[];
  created: string;
  updated: string;
}

export interface JiraComment {
  author: string;
  body: string;
  created: string;
}

export interface ParsedPipelineRequest {
  /** Original ticket reference */
  ticketKey: string;
  ticketUrl: string;
  /** Extracted requirements */
  sourceSystem: ExtractedSource;
  targetRequirements: ExtractedTarget;
  businessRules: string[];
  acceptanceCriteria: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Confidence in extraction */
  confidence: number;
  /** What couldn't be auto-extracted (needs human clarification) */
  missingInfo: string[];
}

export interface ExtractedSource {
  type: string;          // postgres, mysql, salesforce, api, etc.
  database?: string;
  schema?: string;
  tables?: string[];
  connectionHint?: string; // "production CRM database", "Salesforce API"
}

export interface ExtractedTarget {
  cloud?: string;        // aws, azure, snowflake, databricks
  model?: string;        // star_schema, data_vault, flat
  warehouse?: string;    // "Snowflake", "Redshift", "BigQuery"
  refreshFrequency?: string; // "daily", "hourly", "real-time"
}

export class JiraConnector {
  private config: JiraConfig;

  constructor(config: JiraConfig) {
    this.config = config;
  }

  /**
   * Fetch data engineering tickets ready for pipeline generation
   */
  async fetchPipelineTickets(): Promise<JiraTicket[]> {
    const jql = this.config.jqlFilter ||
      `project = ${this.config.projectKey} AND labels in ("data-pipeline", "etl", "data-engineering") AND status = "To Do" ORDER BY priority DESC`;

    // In production: call Jira REST API
    // GET /rest/api/3/search?jql={jql}
    const response = await this.callJiraAPI('/rest/api/3/search', { jql, maxResults: 50 });

    return response.issues.map((issue: any) => this.mapToTicket(issue));
  }

  /**
   * Fetch a specific ticket by key
   */
  async fetchTicket(ticketKey: string): Promise<JiraTicket> {
    const response = await this.callJiraAPI(`/rest/api/3/issue/${ticketKey}`);
    return this.mapToTicket(response);
  }

  /**
   * Parse a Jira ticket into structured pipeline requirements
   * Uses NLP/pattern matching to extract source, target, and rules
   */
  parseTicketForPipeline(ticket: JiraTicket): ParsedPipelineRequest {
    const description = `${ticket.summary}\n${ticket.description}`;
    const missingInfo: string[] = [];

    // Extract source system
    const sourceSystem = this.extractSource(description);
    if (!sourceSystem.type) {
      missingInfo.push('Source system type not specified (PostgreSQL? MySQL? API? Files?)');
    }

    // Extract target requirements
    const targetRequirements = this.extractTarget(description);
    if (!targetRequirements.cloud) {
      missingInfo.push('Target cloud/platform not specified (AWS? Snowflake? Databricks?)');
    }

    // Extract business rules from description and acceptance criteria
    const businessRules = this.extractBusinessRules(description);

    // Extract acceptance criteria
    const acceptanceCriteria = this.extractAcceptanceCriteria(ticket);

    // Calculate confidence based on how much we could extract
    const totalFields = 6;
    const extractedFields = [
      sourceSystem.type,
      sourceSystem.tables?.length,
      targetRequirements.cloud,
      targetRequirements.model,
      businessRules.length > 0,
      acceptanceCriteria.length > 0,
    ].filter(Boolean).length;
    const confidence = extractedFields / totalFields;

    return {
      ticketKey: ticket.key,
      ticketUrl: `${this.config.baseUrl}/browse/${ticket.key}`,
      sourceSystem,
      targetRequirements,
      businessRules,
      acceptanceCriteria,
      priority: this.mapPriority(ticket.priority),
      confidence,
      missingInfo,
    };
  }

  /**
   * Post the generated pipeline back to Jira as a comment
   */
  async postPipelineResult(ticketKey: string, result: {
    pipelineYaml: string;
    generatedFiles: string[];
    mappingSummary: string;
    qualityChecks: string[];
  }): Promise<void> {
    const comment = `
🤖 *EADPA Pipeline Generated*

The AI agent has analyzed this ticket and generated a complete data pipeline:

*Pipeline Specification:*
{code:yaml}
${result.pipelineYaml.substring(0, 500)}...
{code}

*Generated Files:*
${result.generatedFiles.map(f => `• ${f}`).join('\n')}

*Source-to-Target Mapping:*
${result.mappingSummary}

*Data Quality Checks:*
${result.qualityChecks.map(c => `• ${c}`).join('\n')}

---
⚠️ *Awaiting human review before production deployment.*
Click [here|${this.config.baseUrl}/eadpa/review/${ticketKey}] to review and approve.
    `.trim();

    await this.callJiraAPI(`/rest/api/3/issue/${ticketKey}/comment`, {
      body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }] },
    }, 'POST');
  }

  /**
   * Update ticket status after pipeline is generated
   */
  async updateTicketStatus(ticketKey: string, status: 'In Review' | 'Done'): Promise<void> {
    // In production: transition the ticket
    // POST /rest/api/3/issue/{ticketKey}/transitions
    console.log(`[Jira] Updating ${ticketKey} to status: ${status}`);
  }

  // ---- Private extraction methods ----

  private extractSource(text: string): ExtractedSource {
    const result: ExtractedSource = { type: '' };

    // Pattern matching for source systems
    const sourcePatterns: Record<string, RegExp> = {
      postgres: /\b(postgres|postgresql|pg)\b/i,
      mysql: /\b(mysql|maria)\b/i,
      sqlserver: /\b(sql\s*server|mssql|tsql)\b/i,
      oracle: /\b(oracle|ora)\b/i,
      mongodb: /\b(mongo|mongodb)\b/i,
      salesforce: /\b(salesforce|sfdc|sf)\b/i,
      hubspot: /\b(hubspot)\b/i,
      rest_api: /\b(rest\s*api|api\s*endpoint|http)\b/i,
      kafka: /\b(kafka|confluent|streaming)\b/i,
      s3: /\b(s3|aws\s*bucket|csv\s*files?|parquet\s*files?)\b/i,
      snowflake: /\b(snowflake)\b/i,
    };

    for (const [type, pattern] of Object.entries(sourcePatterns)) {
      if (pattern.test(text)) {
        result.type = type;
        break;
      }
    }

    // Extract table names (patterns like "users table", "orders", "schema.table")
    const tableMatch = text.match(/\b(?:table|entity|from)\s+["`']?(\w+(?:\.\w+)?)["`']?/gi);
    if (tableMatch) {
      result.tables = tableMatch.map(m => m.replace(/^(?:table|entity|from)\s+/i, '').replace(/["`']/g, ''));
    }

    // Extract database name
    const dbMatch = text.match(/\b(?:database|db)\s*[:\s]+["`']?(\w+)["`']?/i);
    if (dbMatch) result.database = dbMatch[1];

    // Extract schema
    const schemaMatch = text.match(/\b(?:schema)\s*[:\s]+["`']?(\w+)["`']?/i);
    if (schemaMatch) result.schema = schemaMatch[1];

    return result;
  }

  private extractTarget(text: string): ExtractedTarget {
    const result: ExtractedTarget = {};

    // Cloud platform detection
    if (/\b(aws|amazon|glue|redshift|athena|s3)\b/i.test(text)) result.cloud = 'aws';
    else if (/\b(azure|synapse|fabric|adf|data\s*factory)\b/i.test(text)) result.cloud = 'azure';
    else if (/\b(snowflake)\b/i.test(text)) result.cloud = 'snowflake';
    else if (/\b(databricks|delta|unity\s*catalog)\b/i.test(text)) result.cloud = 'databricks';
    else if (/\b(bigquery|gcp|google\s*cloud)\b/i.test(text)) result.cloud = 'gcp';

    // Data model detection
    if (/\b(star\s*schema|dimensional|fact.+dim|kimball)\b/i.test(text)) result.model = 'star_schema';
    else if (/\b(data\s*vault|hub.+sat|hub.+link)\b/i.test(text)) result.model = 'data_vault';
    else if (/\b(scd\s*2|slowly\s*changing|historical)\b/i.test(text)) result.model = 'scd2';

    // Refresh frequency
    if (/\b(real[\s-]*time|streaming|continuous)\b/i.test(text)) result.refreshFrequency = 'real-time';
    else if (/\b(hourly|every\s*hour)\b/i.test(text)) result.refreshFrequency = 'hourly';
    else if (/\b(daily|nightly|overnight|end[\s-]*of[\s-]*day)\b/i.test(text)) result.refreshFrequency = 'daily';
    else if (/\b(weekly)\b/i.test(text)) result.refreshFrequency = 'weekly';

    return result;
  }

  private extractBusinessRules(text: string): string[] {
    const rules: string[] = [];

    // Look for patterns that indicate business rules
    const rulePatterns = [
      /must\s+(.+?)(?:\.|$)/gi,
      /should\s+(.+?)(?:\.|$)/gi,
      /filter\s+(?:out|by)\s+(.+?)(?:\.|$)/gi,
      /exclude\s+(.+?)(?:\.|$)/gi,
      /only\s+include\s+(.+?)(?:\.|$)/gi,
      /deduplicate?\s+(?:on|by)\s+(.+?)(?:\.|$)/gi,
      /aggregate\s+(.+?)(?:\.|$)/gi,
      /join\s+(.+?)(?:\.|$)/gi,
      /transform\s+(.+?)(?:\.|$)/gi,
    ];

    for (const pattern of rulePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && match[1].length > 5 && match[1].length < 200) {
          rules.push(match[1].trim());
        }
      }
    }

    return [...new Set(rules)]; // deduplicate
  }

  private extractAcceptanceCriteria(ticket: JiraTicket): string[] {
    if (ticket.acceptanceCriteria) return ticket.acceptanceCriteria;

    // Try to extract from description (common Jira format)
    const description = ticket.description || '';
    const acSection = description.match(/acceptance\s*criteria[:\s]*\n([\s\S]*?)(?:\n\n|$)/i);
    if (acSection) {
      return acSection[1]
        .split('\n')
        .map(l => l.replace(/^[-*•]\s*/, '').trim())
        .filter(l => l.length > 3);
    }

    return [];
  }

  private mapPriority(priority: string): 'low' | 'medium' | 'high' | 'critical' {
    const p = priority.toLowerCase();
    if (p.includes('critical') || p.includes('blocker')) return 'critical';
    if (p.includes('high')) return 'high';
    if (p.includes('medium') || p.includes('normal')) return 'medium';
    return 'low';
  }

  private mapToTicket(issue: any): JiraTicket {
    return {
      key: issue.key,
      summary: issue.fields?.summary || '',
      description: issue.fields?.description || '',
      status: issue.fields?.status?.name || '',
      assignee: issue.fields?.assignee?.displayName || '',
      priority: issue.fields?.priority?.name || 'Medium',
      labels: issue.fields?.labels || [],
      created: issue.fields?.created || '',
      updated: issue.fields?.updated || '',
    };
  }

  private async callJiraAPI(path: string, body?: any, method: string = 'GET'): Promise<any> {
    // In production: make actual HTTP request to Jira API
    // Uses credentials from secrets manager (never hardcoded)
    console.log(`[Jira API] ${method} ${this.config.baseUrl}${path}`);
    return { issues: [] };
  }
}
