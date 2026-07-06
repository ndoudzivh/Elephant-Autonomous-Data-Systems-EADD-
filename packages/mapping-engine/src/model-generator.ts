/**
 * Data Model Generator
 * Generates target data models (Star Schema, SCD2, Data Vault)
 * from discovered source schemas.
 */

import type { MappingTarget, TargetTable, TargetColumn } from '@eadpa/shared';
import type { DiscoveredSchema } from './schema-discovery';

export type ModelStyle = 'star_schema' | 'data_vault' | 'flat' | 'scd2';

export interface ModelGenerationOptions {
  style: ModelStyle;
  /** Include surrogate keys */
  surrogateKeys: boolean;
  /** Include audit columns */
  auditColumns: boolean;
  /** Grain of the fact table */
  factGrain?: string;
  /** Business keys for dimensions */
  businessKeys?: Record<string, string[]>;
}

export class ModelGenerator {
  /**
   * Generate a target data model from source schemas
   */
  generate(
    sources: DiscoveredSchema[],
    options: ModelGenerationOptions
  ): MappingTarget {
    switch (options.style) {
      case 'star_schema':
        return this.generateStarSchema(sources, options);
      case 'data_vault':
        return this.generateDataVault(sources, options);
      case 'scd2':
        return this.generateSCD2(sources, options);
      case 'flat':
      default:
        return this.generateFlatModel(sources, options);
    }
  }

  private generateStarSchema(sources: DiscoveredSchema[], options: ModelGenerationOptions): MappingTarget {
    const tables: TargetTable[] = [];

    for (const source of sources) {
      // Determine if this source is a fact or dimension
      const isFact = this.isLikelyFact(source);

      if (isFact) {
        tables.push(this.createFactTable(source, options));
      } else {
        tables.push(this.createDimensionTable(source, options));
      }
    }

    return {
      model_style: 'star_schema',
      tables,
    };
  }

  private generateDataVault(sources: DiscoveredSchema[], options: ModelGenerationOptions): MappingTarget {
    const tables: TargetTable[] = [];

    for (const source of sources) {
      // Hub (business keys)
      const hub = this.createHubTable(source, options);
      tables.push(hub);

      // Satellite (descriptive attributes)
      const satellite = this.createSatelliteTable(source, options);
      tables.push(satellite);
    }

    return {
      model_style: 'data_vault',
      tables,
    };
  }

  private generateSCD2(sources: DiscoveredSchema[], options: ModelGenerationOptions): MappingTarget {
    const tables: TargetTable[] = sources.map(source => this.createSCD2Table(source, options));
    return { model_style: 'scd2', tables };
  }

  private generateFlatModel(sources: DiscoveredSchema[], options: ModelGenerationOptions): MappingTarget {
    const tables: TargetTable[] = sources.map(source => ({
      name: `stg_${source.table}`,
      type: 'staging' as const,
      columns: source.columns.map(col => ({
        name: col.name,
        data_type: col.data_type,
        nullable: col.nullable,
      })),
      primary_key: source.columns.filter(c => c.primary_key).map(c => c.name),
    }));

    return { model_style: 'flat', tables };
  }

  private createFactTable(source: DiscoveredSchema, options: ModelGenerationOptions): TargetTable {
    const columns: TargetColumn[] = [];

    if (options.surrogateKeys) {
      columns.push({ name: `${source.table}_sk`, data_type: 'bigint', nullable: false, is_surrogate_key: true });
    }

    // Foreign keys to dimensions
    for (const col of source.columns) {
      if (col.name.endsWith('_id') && !col.primary_key) {
        columns.push({
          name: col.name.replace('_id', '_sk'),
          data_type: 'bigint',
          nullable: true,
          description: `Surrogate key to ${col.name.replace('_id', '')} dimension`,
        });
      }
    }

    // Measures (numeric columns that aren't IDs)
    for (const col of source.columns) {
      if (this.isNumericType(col.data_type) && !col.name.endsWith('_id')) {
        columns.push({ name: col.name, data_type: col.data_type, nullable: col.nullable });
      }
    }

    // Date keys
    for (const col of source.columns) {
      if (this.isDateType(col.data_type)) {
        columns.push({ name: `${col.name}_key`, data_type: 'integer', nullable: true, description: 'Date dimension key' });
      }
    }

    if (options.auditColumns) {
      columns.push(...this.getAuditColumns());
    }

    return {
      name: `fact_${source.table}`,
      type: 'fact',
      columns,
      primary_key: [options.surrogateKeys ? `${source.table}_sk` : 'id'],
    };
  }

  private createDimensionTable(source: DiscoveredSchema, options: ModelGenerationOptions): TargetTable {
    const columns: TargetColumn[] = [];

    if (options.surrogateKeys) {
      columns.push({ name: `${source.table}_sk`, data_type: 'bigint', nullable: false, is_surrogate_key: true });
    }

    // Business key
    const pk = source.columns.find(c => c.primary_key);
    if (pk) {
      columns.push({ name: pk.name, data_type: pk.data_type, nullable: false, is_business_key: true });
    }

    // Descriptive attributes
    for (const col of source.columns) {
      if (!col.primary_key) {
        columns.push({ name: col.name, data_type: col.data_type, nullable: col.nullable });
      }
    }

    if (options.auditColumns) {
      columns.push(...this.getAuditColumns());
    }

    return {
      name: `dim_${source.table}`,
      type: 'dimension',
      columns,
      primary_key: [options.surrogateKeys ? `${source.table}_sk` : (pk?.name || 'id')],
    };
  }

  private createHubTable(source: DiscoveredSchema, options: ModelGenerationOptions): TargetTable {
    const pk = source.columns.find(c => c.primary_key);
    return {
      name: `hub_${source.table}`,
      type: 'hub',
      columns: [
        { name: `${source.table}_hk`, data_type: 'binary(32)', nullable: false, description: 'Hash key' },
        { name: pk?.name || 'business_key', data_type: pk?.data_type || 'varchar', nullable: false, is_business_key: true },
        { name: 'load_date', data_type: 'timestamp', nullable: false },
        { name: 'record_source', data_type: 'varchar(100)', nullable: false },
      ],
      primary_key: [`${source.table}_hk`],
    };
  }

  private createSatelliteTable(source: DiscoveredSchema, options: ModelGenerationOptions): TargetTable {
    const descriptiveColumns = source.columns.filter(c => !c.primary_key);
    return {
      name: `sat_${source.table}`,
      type: 'satellite',
      columns: [
        { name: `${source.table}_hk`, data_type: 'binary(32)', nullable: false },
        { name: 'load_date', data_type: 'timestamp', nullable: false },
        { name: 'load_end_date', data_type: 'timestamp', nullable: true },
        { name: 'hash_diff', data_type: 'binary(32)', nullable: false },
        { name: 'record_source', data_type: 'varchar(100)', nullable: false },
        ...descriptiveColumns.map(col => ({
          name: col.name,
          data_type: col.data_type,
          nullable: col.nullable,
        })),
      ],
      primary_key: [`${source.table}_hk`, 'load_date'],
    };
  }

  private createSCD2Table(source: DiscoveredSchema, options: ModelGenerationOptions): TargetTable {
    const columns: TargetColumn[] = [];

    if (options.surrogateKeys) {
      columns.push({ name: `${source.table}_sk`, data_type: 'bigint', nullable: false, is_surrogate_key: true });
    }

    for (const col of source.columns) {
      columns.push({
        name: col.name,
        data_type: col.data_type,
        nullable: col.nullable,
        is_business_key: col.primary_key,
        scd_type: col.primary_key ? undefined : 2,
      });
    }

    // SCD2 tracking columns
    columns.push(
      { name: 'effective_from', data_type: 'timestamp', nullable: false },
      { name: 'effective_to', data_type: 'timestamp', nullable: true },
      { name: 'is_current', data_type: 'boolean', nullable: false, default_value: 'true' },
    );

    if (options.auditColumns) {
      columns.push(...this.getAuditColumns());
    }

    return {
      name: `dim_${source.table}`,
      type: 'dimension',
      columns,
      primary_key: [options.surrogateKeys ? `${source.table}_sk` : 'id'],
    };
  }

  private isLikelyFact(schema: DiscoveredSchema): boolean {
    const fkCount = schema.columns.filter(c => c.name.endsWith('_id') && !c.primary_key).length;
    const numericCount = schema.columns.filter(c => this.isNumericType(c.data_type) && !c.name.endsWith('_id')).length;
    return fkCount >= 2 || (numericCount >= 3 && fkCount >= 1);
  }

  private isNumericType(type: string): boolean {
    return /\b(int|bigint|decimal|numeric|float|double|number|money)\b/i.test(type);
  }

  private isDateType(type: string): boolean {
    return /\b(date|datetime|timestamp)\b/i.test(type);
  }

  private getAuditColumns(): TargetColumn[] {
    return [
      { name: '_loaded_at', data_type: 'timestamp', nullable: false },
      { name: '_updated_at', data_type: 'timestamp', nullable: false },
      { name: '_source_system', data_type: 'varchar(50)', nullable: false },
      { name: '_pipeline_run_id', data_type: 'varchar(36)', nullable: false },
    ];
  }
}
