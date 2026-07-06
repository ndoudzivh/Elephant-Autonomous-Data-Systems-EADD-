/**
 * Mapping Service
 * Core service for creating and managing source-to-target mappings.
 * Supports column-level transformations, auto-mapping suggestions,
 * and validation of mapping completeness.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  SourceToTargetMapping,
  ColumnMapping,
  MappingSource,
  MappingTarget,
  SourceColumn,
  TransformationSpec,
  SchemaDriftPolicy,
} from '@eadpa/shared';

export interface AutoMapOptions {
  /** Use fuzzy name matching */
  fuzzyMatch: boolean;
  /** Confidence threshold (0-1) for auto-mapping */
  confidenceThreshold: number;
  /** Generate type casts automatically */
  autoCast: boolean;
  /** Suggest common transformations */
  suggestTransforms: boolean;
}

export interface MappingSuggestion {
  sourceColumn: string;
  targetColumn: string;
  confidence: number;
  reason: string;
  transformation?: TransformationSpec;
}

export class MappingService {
  /**
   * Create a new empty mapping
   */
  createMapping(params: {
    name: string;
    source: MappingSource;
    target: MappingTarget;
    userId: string;
  }): SourceToTargetMapping {
    return {
      id: uuidv4(),
      name: params.name,
      status: 'draft',
      source: params.source,
      target: params.target,
      column_mappings: [],
      schema_drift_policy: this.getDefaultDriftPolicy(),
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: params.userId,
    };
  }

  /**
   * Auto-generate mapping suggestions based on column names and types
   */
  generateSuggestions(
    sourceColumns: SourceColumn[],
    targetColumns: { name: string; data_type: string }[],
    options: Partial<AutoMapOptions> = {}
  ): MappingSuggestion[] {
    const opts: AutoMapOptions = {
      fuzzyMatch: true,
      confidenceThreshold: 0.6,
      autoCast: true,
      suggestTransforms: true,
      ...options,
    };

    const suggestions: MappingSuggestion[] = [];

    for (const source of sourceColumns) {
      let bestMatch: MappingSuggestion | null = null;

      for (const target of targetColumns) {
        const confidence = this.calculateMatchConfidence(source, target, opts);

        if (confidence >= opts.confidenceThreshold) {
          const suggestion: MappingSuggestion = {
            sourceColumn: source.name,
            targetColumn: target.name,
            confidence,
            reason: this.getMatchReason(source, target, confidence),
            transformation: this.suggestTransformation(source, target, opts),
          };

          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = suggestion;
          }
        }
      }

      if (bestMatch) {
        suggestions.push(bestMatch);
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Apply mapping suggestions to create column mappings
   */
  applySuggestions(
    mapping: SourceToTargetMapping,
    suggestions: MappingSuggestion[],
    targetTable: string
  ): SourceToTargetMapping {
    const newMappings: ColumnMapping[] = suggestions.map(s => ({
      id: uuidv4(),
      source_column: s.sourceColumn,
      target_column: s.targetColumn,
      target_table: targetTable,
      transformation: s.transformation || { type: 'direct' },
    }));

    return {
      ...mapping,
      column_mappings: [...mapping.column_mappings, ...newMappings],
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Validate mapping completeness and correctness
   */
  validateMapping(mapping: SourceToTargetMapping): MappingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check all target required columns are mapped
    for (const table of mapping.target.tables) {
      for (const col of table.columns) {
        if (!col.nullable && !col.is_surrogate_key) {
          const isMapped = mapping.column_mappings.some(
            m => m.target_table === table.name && m.target_column === col.name
          );
          if (!isMapped) {
            errors.push(`Required column '${table.name}.${col.name}' has no source mapping`);
          }
        }
      }
    }

    // Check for unmapped source columns
    const mappedSources = new Set(mapping.column_mappings.map(m => m.source_column));
    for (const col of mapping.source.columns) {
      if (!mappedSources.has(col.name)) {
        warnings.push(`Source column '${col.name}' is not mapped to any target`);
      }
    }

    // Check for duplicate target mappings
    const targetMappings = new Map<string, string[]>();
    for (const m of mapping.column_mappings) {
      const key = `${m.target_table}.${m.target_column}`;
      const sources = targetMappings.get(key) || [];
      sources.push(m.source_column);
      targetMappings.set(key, sources);
    }
    for (const [target, sources] of targetMappings) {
      if (sources.length > 1) {
        warnings.push(`Target '${target}' has multiple source mappings: ${sources.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      coverage: {
        source_mapped: mappedSources.size,
        source_total: mapping.source.columns.length,
        source_percentage: Math.round((mappedSources.size / mapping.source.columns.length) * 100),
      },
    };
  }

  /**
   * Calculate confidence score for a source-target column match
   */
  private calculateMatchConfidence(
    source: SourceColumn,
    target: { name: string; data_type: string },
    options: AutoMapOptions
  ): number {
    let score = 0;

    // Exact name match
    if (source.name.toLowerCase() === target.name.toLowerCase()) {
      score = 1.0;
    }
    // Fuzzy matching
    else if (options.fuzzyMatch) {
      const sourceName = this.normalizeName(source.name);
      const targetName = this.normalizeName(target.name);

      // Check if one contains the other
      if (sourceName.includes(targetName) || targetName.includes(sourceName)) {
        score = 0.85;
      }
      // Common abbreviation patterns
      else if (this.isCommonAbbreviation(sourceName, targetName)) {
        score = 0.8;
      }
      // Levenshtein similarity
      else {
        const similarity = this.stringSimilarity(sourceName, targetName);
        score = similarity * 0.7;
      }
    }

    // Boost for matching types
    if (this.typesCompatible(source.data_type, target.data_type)) {
      score = Math.min(score + 0.1, 1.0);
    }

    return score;
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[_\-\s]+/g, '')
      .replace(/^(src|source|tgt|target|dim|fact|fk|pk)_?/, '')
      .replace(/_?(id|key|code|num|no|number)$/, '');
  }

  private isCommonAbbreviation(a: string, b: string): boolean {
    const abbreviations: Record<string, string[]> = {
      'id': ['identifier', 'key'],
      'desc': ['description'],
      'amt': ['amount'],
      'qty': ['quantity'],
      'dt': ['date'],
      'ts': ['timestamp'],
      'nm': ['name'],
      'addr': ['address'],
      'num': ['number'],
      'tel': ['telephone', 'phone'],
      'org': ['organization'],
      'dept': ['department'],
      'cat': ['category'],
      'txn': ['transaction'],
    };

    for (const [abbr, fulls] of Object.entries(abbreviations)) {
      if ((a === abbr && fulls.some(f => b.includes(f))) ||
          (b === abbr && fulls.some(f => a.includes(f)))) {
        return true;
      }
    }
    return false;
  }

  private stringSimilarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;
    const editDistance = this.levenshtein(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0]![j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = b[i - 1] === a[j - 1] ? 0 : 1;
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j - 1]! + cost
        );
      }
    }
    return matrix[b.length]![a.length]!;
  }

  private typesCompatible(sourceType: string, targetType: string): boolean {
    const typeGroups: Record<string, string[]> = {
      numeric: ['int', 'integer', 'bigint', 'smallint', 'decimal', 'numeric', 'float', 'double', 'number'],
      string: ['varchar', 'char', 'text', 'string', 'nvarchar'],
      datetime: ['date', 'datetime', 'timestamp', 'timestamptz'],
      boolean: ['boolean', 'bool', 'bit'],
    };

    const sType = sourceType.toLowerCase();
    const tType = targetType.toLowerCase();

    for (const group of Object.values(typeGroups)) {
      if (group.some(t => sType.includes(t)) && group.some(t => tType.includes(t))) {
        return true;
      }
    }
    return false;
  }

  private suggestTransformation(
    source: SourceColumn,
    target: { name: string; data_type: string },
    options: AutoMapOptions
  ): TransformationSpec | undefined {
    // Direct mapping if names and types match
    if (source.name === target.name && source.data_type === target.data_type) {
      return { type: 'direct' };
    }

    // Rename if names differ
    if (source.name !== target.name && source.data_type === target.data_type) {
      return { type: 'rename', new_name: target.name };
    }

    // Cast if types differ
    if (source.data_type !== target.data_type && options.autoCast) {
      return { type: 'cast', target_type: target.data_type };
    }

    return { type: 'direct' };
  }

  private getMatchReason(source: SourceColumn, target: { name: string; data_type: string }, confidence: number): string {
    if (confidence >= 0.95) return 'Exact name match';
    if (confidence >= 0.85) return 'Name containment match';
    if (confidence >= 0.75) return 'Fuzzy name similarity';
    return 'Partial match based on name and type';
  }

  private getDefaultDriftPolicy(): SchemaDriftPolicy {
    return {
      detection_enabled: true,
      action_on_new_column: 'add_nullable',
      action_on_removed_column: 'null_fill',
      action_on_type_change: 'quarantine',
      notification_enabled: true,
    };
  }
}

export interface MappingValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  coverage: {
    source_mapped: number;
    source_total: number;
    source_percentage: number;
  };
}
