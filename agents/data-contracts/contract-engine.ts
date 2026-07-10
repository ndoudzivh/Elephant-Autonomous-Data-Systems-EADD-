/**
 * EADD Data Contracts Engine
 * 
 * Enforce explicit contracts between producers and consumers.
 * Block breaking changes BEFORE they hit production.
 * Version schemas. Distinguish breaking vs non-breaking.
 * 
 * Section 10 of requirements.
 */

export type ChangeType = 'breaking' | 'non_breaking' | 'additive';
export type ContractStatus = 'draft' | 'active' | 'deprecated' | 'violated';

export interface DataContract {
  id: string;
  name: string;
  version: string;
  /** Who produces this data */
  producer: { team: string; system: string; owner: string };
  /** Who consumes this data */
  consumers: Array<{ team: string; system: string; usage: string }>;
  /** The schema contract */
  schema: SchemaContract;
  /** Quality guarantees */
  quality: QualityContract;
  /** SLA guarantees */
  sla: SLAContract;
  /** Status */
  status: ContractStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SchemaContract {
  /** Table/dataset name */
  tableName: string;
  /** Column definitions (the contract) */
  columns: ColumnContract[];
  /** Primary key */
  primaryKey: string[];
  /** Partition scheme */
  partitionBy?: string[];
}

export interface ColumnContract {
  name: string;
  type: string;
  nullable: boolean;
  description: string;
  /** PII classification */
  piiClassification?: 'none' | 'direct' | 'indirect' | 'sensitive';
  /** Validation rules */
  validations?: string[];
}

export interface QualityContract {
  /** Maximum allowed null percentage per column */
  maxNullPercentage: Record<string, number>;
  /** Uniqueness constraints */
  uniqueColumns: string[];
  /** Minimum row count per load */
  minRowCount?: number;
  /** Freshness SLA */
  maxStalenessMinutes: number;
}

export interface SLAContract {
  /** Update frequency */
  updateFrequency: string;
  /** Maximum acceptable latency */
  maxLatencyMinutes: number;
  /** Availability target */
  availabilityPercent: number;
  /** Support hours */
  supportHours: string;
}

export interface SchemaChange {
  changeId: string;
  contractId: string;
  timestamp: string;
  proposedBy: string;
  /** Type of change */
  changeType: ChangeType;
  /** What changed */
  changes: ColumnChange[];
  /** Impact analysis */
  impactedConsumers: string[];
  /** Status */
  status: 'proposed' | 'approved' | 'rejected' | 'applied';
  /** Reasoning */
  reasoning: string;
}

export interface ColumnChange {
  column: string;
  action: 'add' | 'remove' | 'modify_type' | 'modify_nullable' | 'rename';
  oldValue?: string;
  newValue?: string;
  breaking: boolean;
  reason: string;
}

export class DataContractEngine {
  private contracts: Map<string, DataContract> = new Map();
  private changeHistory: SchemaChange[] = [];

  /** Register a new data contract */
  registerContract(contract: DataContract): void {
    this.contracts.set(contract.id, contract);
  }

  /** Propose a schema change — evaluates if breaking */
  proposeChange(contractId: string, changes: ColumnChange[], proposedBy: string): SchemaChange {
    const contract = this.contracts.get(contractId);
    if (!contract) throw new Error(`Contract ${contractId} not found`);

    // Classify each change
    const hasBreaking = changes.some(c => c.breaking);
    const changeType: ChangeType = hasBreaking ? 'breaking' : changes.every(c => c.action === 'add') ? 'additive' : 'non_breaking';

    const schemaChange: SchemaChange = {
      changeId: `chg_${Date.now()}`,
      contractId,
      timestamp: new Date().toISOString(),
      proposedBy,
      changeType,
      changes,
      impactedConsumers: contract.consumers.map(c => `${c.team}/${c.system}`),
      status: hasBreaking ? 'proposed' : 'approved', // Non-breaking auto-approved
      reasoning: hasBreaking
        ? `BLOCKED: Breaking change detected. ${contract.consumers.length} consumer(s) will be impacted. Requires approval from: ${contract.consumers.map(c => c.team).join(', ')}`
        : `Auto-approved: Non-breaking ${changeType} change. No consumer impact.`,
    };

    this.changeHistory.push(schemaChange);
    return schemaChange;
  }

  /** Classify if a change is breaking */
  classifyChange(action: string, column: ColumnContract): boolean {
    switch (action) {
      case 'remove': return true; // Always breaking
      case 'rename': return true; // Always breaking
      case 'modify_type': return true; // Could break parsers
      case 'modify_nullable': return !column.nullable; // Making non-null → null is safe; null → non-null is breaking
      case 'add': return false; // Never breaking (additive)
      default: return true; // Unknown = assume breaking
    }
  }

  /** Validate a dataset against its contract */
  validateAgainstContract(contractId: string, data: { columns: string[]; rowCount: number; nullCounts: Record<string, number> }): ContractValidationResult {
    const contract = this.contracts.get(contractId);
    if (!contract) throw new Error(`Contract ${contractId} not found`);

    const violations: string[] = [];

    // Check all required columns exist
    for (const col of contract.schema.columns) {
      if (!data.columns.includes(col.name)) {
        violations.push(`Missing column: ${col.name}`);
      }
    }

    // Check null percentages
    for (const [col, maxNull] of Object.entries(contract.quality.maxNullPercentage)) {
      const nullCount = data.nullCounts[col] || 0;
      const nullPct = (nullCount / data.rowCount) * 100;
      if (nullPct > maxNull) {
        violations.push(`Column ${col}: ${nullPct.toFixed(1)}% nulls exceeds contract limit of ${maxNull}%`);
      }
    }

    // Check minimum row count
    if (contract.quality.minRowCount && data.rowCount < contract.quality.minRowCount) {
      violations.push(`Row count ${data.rowCount} below minimum ${contract.quality.minRowCount}`);
    }

    return {
      contractId,
      valid: violations.length === 0,
      violations,
      checkedAt: new Date().toISOString(),
    };
  }
}

interface ContractValidationResult {
  contractId: string;
  valid: boolean;
  violations: string[];
  checkedAt: string;
}
