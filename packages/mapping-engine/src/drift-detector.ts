/**
 * Schema Drift Detector
 * Detects and reports schema changes between mapping versions.
 * Surfaces changes without silently applying them.
 */

import type { SourceColumn, SchemaDriftPolicy } from '@eadpa/shared';

export type DriftChangeType = 'column_added' | 'column_removed' | 'type_changed' | 'nullable_changed' | 'column_renamed';

export interface DriftChange {
  type: DriftChangeType;
  column: string;
  details: string;
  previousValue?: string;
  currentValue?: string;
  severity: 'info' | 'warning' | 'critical';
  suggestedAction: string;
}

export interface DriftReport {
  detected: boolean;
  timestamp: string;
  changes: DriftChange[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    total: number;
  };
  impact: 'none' | 'low' | 'medium' | 'high';
  recommendation: string;
}

export class DriftDetector {
  /**
   * Compare current schema against the baseline and detect drift
   */
  detect(
    baseline: SourceColumn[],
    current: SourceColumn[],
    policy?: SchemaDriftPolicy
  ): DriftReport {
    const changes: DriftChange[] = [];

    const baselineMap = new Map(baseline.map(c => [c.name, c]));
    const currentMap = new Map(current.map(c => [c.name, c]));

    // Detect added columns
    for (const [name, col] of currentMap) {
      if (!baselineMap.has(name)) {
        changes.push({
          type: 'column_added',
          column: name,
          details: `New column '${name}' (${col.data_type}) detected in source`,
          currentValue: col.data_type,
          severity: 'info',
          suggestedAction: policy?.action_on_new_column === 'add_nullable'
            ? 'Add to target as nullable column'
            : 'Review and decide whether to include in mapping',
        });
      }
    }

    // Detect removed columns
    for (const [name, col] of baselineMap) {
      if (!currentMap.has(name)) {
        changes.push({
          type: 'column_removed',
          column: name,
          details: `Column '${name}' no longer exists in source`,
          previousValue: col.data_type,
          severity: col.nullable ? 'warning' : 'critical',
          suggestedAction: col.nullable
            ? 'Fill with NULL in target or remove from mapping'
            : 'CRITICAL: Non-nullable column removed. Pipeline will fail without intervention.',
        });
      }
    }

    // Detect type/property changes
    for (const [name, currentCol] of currentMap) {
      const baselineCol = baselineMap.get(name);
      if (!baselineCol) continue;

      if (baselineCol.data_type !== currentCol.data_type) {
        changes.push({
          type: 'type_changed',
          column: name,
          details: `Type changed from '${baselineCol.data_type}' to '${currentCol.data_type}'`,
          previousValue: baselineCol.data_type,
          currentValue: currentCol.data_type,
          severity: this.isBreakingTypeChange(baselineCol.data_type, currentCol.data_type) ? 'critical' : 'warning',
          suggestedAction: 'Review type cast compatibility and update mapping transformation',
        });
      }

      if (baselineCol.nullable !== currentCol.nullable) {
        changes.push({
          type: 'nullable_changed',
          column: name,
          details: `Nullability changed from ${baselineCol.nullable} to ${currentCol.nullable}`,
          previousValue: String(baselineCol.nullable),
          currentValue: String(currentCol.nullable),
          severity: currentCol.nullable && !baselineCol.nullable ? 'warning' : 'info',
          suggestedAction: currentCol.nullable
            ? 'Source now allows NULL - ensure target handles this'
            : 'Source no longer allows NULL - safe, no action needed',
        });
      }
    }

    const summary = {
      added: changes.filter(c => c.type === 'column_added').length,
      removed: changes.filter(c => c.type === 'column_removed').length,
      modified: changes.filter(c => c.type === 'type_changed' || c.type === 'nullable_changed').length,
      total: changes.length,
    };

    const impact = this.assessImpact(changes);

    return {
      detected: changes.length > 0,
      timestamp: new Date().toISOString(),
      changes,
      summary,
      impact,
      recommendation: this.getRecommendation(impact, changes),
    };
  }

  private isBreakingTypeChange(from: string, to: string): boolean {
    // Narrowing changes are breaking (e.g., varchar(255) -> varchar(50))
    // Widening changes are usually safe (e.g., int -> bigint)
    const fromSize = this.getTypeSize(from);
    const toSize = this.getTypeSize(to);
    if (fromSize > 0 && toSize > 0 && toSize < fromSize) return true;

    // Cross-type-family changes are breaking
    const fromFamily = this.getTypeFamily(from);
    const toFamily = this.getTypeFamily(to);
    return fromFamily !== toFamily;
  }

  private getTypeSize(type: string): number {
    const match = type.match(/\((\d+)/);
    return match ? parseInt(match[1]) : -1;
  }

  private getTypeFamily(type: string): string {
    const lower = type.toLowerCase();
    if (/int|bigint|smallint/.test(lower)) return 'integer';
    if (/decimal|numeric|float|double/.test(lower)) return 'decimal';
    if (/varchar|char|text|string/.test(lower)) return 'string';
    if (/date|time|timestamp/.test(lower)) return 'temporal';
    if (/bool/.test(lower)) return 'boolean';
    return 'other';
  }

  private assessImpact(changes: DriftChange[]): 'none' | 'low' | 'medium' | 'high' {
    if (changes.length === 0) return 'none';
    if (changes.some(c => c.severity === 'critical')) return 'high';
    if (changes.some(c => c.severity === 'warning')) return 'medium';
    return 'low';
  }

  private getRecommendation(impact: string, changes: DriftChange[]): string {
    switch (impact) {
      case 'high':
        return 'CRITICAL: Schema drift detected that will break the pipeline. Manual review required before next run.';
      case 'medium':
        return 'Schema drift detected with potential impact. Review changes and update mappings before production deployment.';
      case 'low':
        return 'Minor schema changes detected. Pipeline should continue to function. Review at your convenience.';
      default:
        return 'No schema drift detected. Schema matches baseline.';
    }
  }
}
