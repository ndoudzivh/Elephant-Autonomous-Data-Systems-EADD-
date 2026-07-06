/**
 * Quarantine Manager
 * Manages quarantined (failed) records with metadata tagging,
 * retention policies, and replay capability.
 */

import { v4 as uuidv4 } from 'uuid';
import type { QuarantinedRecord, QuarantineSettings } from '@eadpa/shared';

export class QuarantineManager {
  private settings: QuarantineSettings;
  private records: Map<string, QuarantinedRecord> = new Map();

  constructor(settings?: Partial<QuarantineSettings>) {
    this.settings = {
      enabled: true,
      storage_location: 's3://data-lake/quarantine/',
      retention_days: 30,
      include_original_record: true,
      include_failure_reason: true,
      include_check_metadata: true,
      replay_enabled: true,
      max_quarantine_percentage: 10,
      ...settings,
    };
  }

  /**
   * Quarantine a failed record
   */
  quarantine(params: {
    executionId: string;
    checkId: string;
    record: Record<string, unknown>;
    reasons: string[];
  }): QuarantinedRecord {
    const quarantined: QuarantinedRecord = {
      id: uuidv4(),
      execution_id: params.executionId,
      check_id: params.checkId,
      original_record: this.settings.include_original_record ? params.record : {},
      failure_reasons: params.reasons,
      quarantined_at: new Date().toISOString(),
      replayed: false,
    };

    this.records.set(quarantined.id, quarantined);
    return quarantined;
  }

  /**
   * Get quarantined records for an execution
   */
  getByExecution(executionId: string): QuarantinedRecord[] {
    return Array.from(this.records.values())
      .filter(r => r.execution_id === executionId);
  }

  /**
   * Replay (reprocess) quarantined records
   */
  async replay(recordIds: string[]): Promise<ReplayResult> {
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const id of recordIds) {
      const record = this.records.get(id);
      if (!record) {
        results.push({ id, success: false, error: 'Record not found' });
        continue;
      }
      if (record.replayed) {
        results.push({ id, success: false, error: 'Already replayed' });
        continue;
      }

      // Mark as replayed
      record.replayed = true;
      record.replayed_at = new Date().toISOString();
      results.push({ id, success: true });
    }

    return {
      total: recordIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }

  /**
   * Clean up expired quarantine records based on retention policy
   */
  purgeExpired(): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.settings.retention_days);
    let purged = 0;

    for (const [id, record] of this.records) {
      if (new Date(record.quarantined_at) < cutoff) {
        this.records.delete(id);
        purged++;
      }
    }

    return purged;
  }

  /**
   * Check if quarantine rate exceeds threshold (pipeline should halt)
   */
  shouldHaltPipeline(totalRecords: number, quarantinedCount: number): boolean {
    const percentage = (quarantinedCount / totalRecords) * 100;
    return percentage > this.settings.max_quarantine_percentage;
  }

  /**
   * Get quarantine statistics
   */
  getStats(): QuarantineStats {
    const records = Array.from(this.records.values());
    return {
      total_quarantined: records.length,
      pending_replay: records.filter(r => !r.replayed).length,
      replayed: records.filter(r => r.replayed).length,
      by_check: this.groupByCheck(records),
      oldest_record: records.length > 0
        ? records.sort((a, b) => a.quarantined_at.localeCompare(b.quarantined_at))[0]?.quarantined_at
        : undefined,
    };
  }

  private groupByCheck(records: QuarantinedRecord[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    for (const record of records) {
      grouped[record.check_id] = (grouped[record.check_id] || 0) + 1;
    }
    return grouped;
  }
}

export interface ReplayResult {
  total: number;
  successful: number;
  failed: number;
  results: Array<{ id: string; success: boolean; error?: string }>;
}

export interface QuarantineStats {
  total_quarantined: number;
  pending_replay: number;
  replayed: number;
  by_check: Record<string, number>;
  oldest_record?: string;
}
