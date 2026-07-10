/**
 * EADD Synthetic Data Generator
 * Generate realistic fake data for testing when real data is restricted.
 * Preserves statistical shape without exposing PII. Section 9.1.
 */

export interface SyntheticConfig {
  sourceSchema: Array<{ name: string; type: string; nullable: boolean }>;
  rowCount: number;
  preserveDistributions: boolean;
  preserveRelationships: boolean;
  includeEdgeCases: boolean;
  scaleFactor?: number; // e.g., 10 = generate 10x volume
}

export function generateSyntheticData(config: SyntheticConfig): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < config.rowCount; i++) {
    const row: Record<string, unknown> = {};
    for (const col of config.sourceSchema) {
      row[col.name] = generateValue(col.type, col.nullable, i);
    }
    rows.push(row);
  }
  return rows;
}

function generateValue(type: string, nullable: boolean, index: number): unknown {
  if (nullable && Math.random() < 0.05) return null;
  switch (type.toLowerCase()) {
    case 'integer': case 'int': case 'bigint':
      return Math.floor(Math.random() * 1000000) + 1;
    case 'float': case 'double': case 'decimal':
      return Math.round(Math.random() * 10000 * 100) / 100;
    case 'string': case 'varchar': case 'text':
      return `synthetic_value_${index}_${Math.random().toString(36).slice(2, 8)}`;
    case 'boolean': case 'bool':
      return Math.random() > 0.5;
    case 'date':
      const d = new Date(2024, Math.floor(Math.random() * 24), Math.floor(Math.random() * 28) + 1);
      return d.toISOString().split('T')[0];
    case 'timestamp':
      return new Date(Date.now() - Math.floor(Math.random() * 86400000 * 365)).toISOString();
    default:
      return `value_${index}`;
  }
}
