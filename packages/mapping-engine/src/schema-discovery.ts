/**
 * Schema Discovery Service
 * Discovers and infers schemas from various source systems.
 * Never accesses row-level data - only metadata/schema information.
 */

import type { SourceColumn, ColumnStatistics } from '@eadpa/shared';

export interface DiscoveredSchema {
  database?: string;
  schema?: string;
  table: string;
  columns: SourceColumn[];
  row_count_estimate?: number;
  size_bytes_estimate?: number;
  last_modified?: string;
}

export interface DiscoveryOptions {
  /** Number of sample values to retrieve per column */
  sampleSize: number;
  /** Whether to compute column statistics */
  computeStatistics: boolean;
  /** Whether to detect PII patterns */
  detectPII: boolean;
  /** Whether to infer relationships/foreign keys */
  inferRelationships: boolean;
}

export class SchemaDiscovery {
  /**
   * Discover schema from a source system
   * NOTE: This only reads metadata (INFORMATION_SCHEMA), never row data
   */
  async discoverSchema(
    sourceType: string,
    connectionRef: string,
    options: Partial<DiscoveryOptions> = {}
  ): Promise<DiscoveredSchema[]> {
    const opts: DiscoveryOptions = {
      sampleSize: 5,
      computeStatistics: true,
      detectPII: true,
      inferRelationships: true,
      ...options,
    };

    // In production, this would connect to the actual source system
    // For now, return a simulated discovery result
    return this.simulateDiscovery(sourceType, opts);
  }

  /**
   * Detect potential PII columns based on name patterns
   * This is rule-based (not ML) for Phase 1
   */
  detectPIIColumns(columns: SourceColumn[]): PIIDetectionResult[] {
    const piiPatterns: Array<{ pattern: RegExp; type: string; confidence: number }> = [
      { pattern: /\b(email|e_mail)\b/i, type: 'email', confidence: 0.95 },
      { pattern: /\b(phone|tel|mobile|cell)\b/i, type: 'phone', confidence: 0.90 },
      { pattern: /\b(ssn|social_security|national_id)\b/i, type: 'national_id', confidence: 0.98 },
      { pattern: /\b(first_?name|last_?name|full_?name|surname)\b/i, type: 'name', confidence: 0.85 },
      { pattern: /\b(address|street|city|zip|postal)\b/i, type: 'address', confidence: 0.80 },
      { pattern: /\b(dob|date_of_birth|birth_?date)\b/i, type: 'date_of_birth', confidence: 0.90 },
      { pattern: /\b(credit_?card|card_?number|pan)\b/i, type: 'payment_card', confidence: 0.95 },
      { pattern: /\b(passport|license|licence)\b/i, type: 'government_id', confidence: 0.85 },
      { pattern: /\b(ip_?address|ip_?addr)\b/i, type: 'ip_address', confidence: 0.80 },
      { pattern: /\b(bank_?account|iban|routing)\b/i, type: 'financial', confidence: 0.90 },
      { pattern: /\b(salary|income|wage|compensation)\b/i, type: 'financial', confidence: 0.75 },
    ];

    const results: PIIDetectionResult[] = [];

    for (const column of columns) {
      for (const { pattern, type, confidence } of piiPatterns) {
        if (pattern.test(column.name)) {
          results.push({
            column: column.name,
            pii_type: type,
            confidence,
            recommended_action: confidence > 0.9 ? 'mask' : 'review',
          });
          break; // First match wins
        }
      }
    }

    return results;
  }

  /**
   * Infer relationships between tables based on naming conventions
   */
  inferRelationships(schemas: DiscoveredSchema[]): InferredRelationship[] {
    const relationships: InferredRelationship[] = [];
    const allTables = new Map(schemas.map(s => [s.table, s]));

    for (const schema of schemas) {
      for (const column of schema.columns) {
        // Pattern: <table_name>_id or <table_name>Id
        const fkMatch = column.name.match(/^(\w+?)_?id$/i);
        if (fkMatch && fkMatch[1]) {
          const referencedTable = fkMatch[1].toLowerCase();
          if (allTables.has(referencedTable) && referencedTable !== schema.table) {
            relationships.push({
              source_table: schema.table,
              source_column: column.name,
              referenced_table: referencedTable,
              referenced_column: 'id',
              confidence: 0.8,
              type: 'many_to_one',
            });
          }
        }
      }
    }

    return relationships;
  }

  private async simulateDiscovery(sourceType: string, options: DiscoveryOptions): Promise<DiscoveredSchema[]> {
    // Simulated schema for development
    return [{
      table: 'customers',
      columns: [
        { name: 'id', data_type: 'bigint', nullable: false, primary_key: true },
        { name: 'email', data_type: 'varchar(255)', nullable: false },
        { name: 'first_name', data_type: 'varchar(100)', nullable: true },
        { name: 'last_name', data_type: 'varchar(100)', nullable: true },
        { name: 'phone', data_type: 'varchar(20)', nullable: true },
        { name: 'address', data_type: 'text', nullable: true },
        { name: 'created_at', data_type: 'timestamp', nullable: false },
        { name: 'updated_at', data_type: 'timestamp', nullable: false },
        { name: 'status', data_type: 'varchar(20)', nullable: false },
      ],
      row_count_estimate: 1500000,
    }];
  }
}

export interface PIIDetectionResult {
  column: string;
  pii_type: string;
  confidence: number;
  recommended_action: 'mask' | 'hash' | 'tokenize' | 'review' | 'encrypt';
}

export interface InferredRelationship {
  source_table: string;
  source_column: string;
  referenced_table: string;
  referenced_column: string;
  confidence: number;
  type: 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many';
}
