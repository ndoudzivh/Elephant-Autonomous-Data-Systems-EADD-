/**
 * Quality Runner
 * Executes quality checks and produces results.
 * In production, runs against actual data; in sandbox, against samples.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  QualityCheckDefinition,
  QualityRunResult,
  QualityCheckResult,
  QualityRunSummary,
  QualityStatus,
} from '@eadpa/shared';

export class QualityRunner {
  /**
   * Run all configured quality checks
   */
  async runChecks(
    checks: QualityCheckDefinition[],
    pipelineId: string,
    executionId: string
  ): Promise<QualityRunResult> {
    const startTime = new Date();
    const results: QualityCheckResult[] = [];
    let overallStatus: QualityStatus = 'passed';

    for (const check of checks) {
      if (!check.enabled) {
        results.push(this.createSkippedResult(check));
        continue;
      }

      const result = await this.executeCheck(check);
      results.push(result);

      // Determine if overall status should change
      if (result.status === 'failed') {
        if (check.severity === 'critical') {
          overallStatus = 'failed';
        } else if (overallStatus !== 'failed') {
          overallStatus = 'warning';
        }
      }
    }

    const summary = this.calculateSummary(results);

    return {
      id: uuidv4(),
      profile_id: '',
      execution_id: executionId,
      pipeline_id: pipelineId,
      overall_status: overallStatus,
      overall_score: this.calculateScore(results, checks),
      check_results: results,
      summary,
      started_at: startTime.toISOString(),
      completed_at: new Date().toISOString(),
    };
  }

  private async executeCheck(check: QualityCheckDefinition): Promise<QualityCheckResult> {
    const startTime = Date.now();

    // In production, this would execute actual SQL/Spark queries
    // For development, simulate results
    const simulated = this.simulateCheckResult(check);

    return {
      check_id: check.id,
      check_name: check.name,
      status: simulated.passed ? 'passed' : 'failed',
      records_checked: simulated.totalRecords,
      records_passed: simulated.passedRecords,
      records_failed: simulated.failedRecords,
      failure_percentage: (simulated.failedRecords / simulated.totalRecords) * 100,
      sample_failures: simulated.sampleFailures,
      duration_ms: Date.now() - startTime,
    };
  }

  private createSkippedResult(check: QualityCheckDefinition): QualityCheckResult {
    return {
      check_id: check.id,
      check_name: check.name,
      status: 'skipped',
      records_checked: 0,
      records_passed: 0,
      records_failed: 0,
      failure_percentage: 0,
      duration_ms: 0,
    };
  }

  private simulateCheckResult(check: QualityCheckDefinition) {
    // Simulate realistic check results for development
    const totalRecords = 10000;
    const failureRate = Math.random() * 0.05; // 0-5% failure rate
    const failedRecords = Math.floor(totalRecords * failureRate);

    return {
      passed: failedRecords === 0 || check.severity === 'info',
      totalRecords,
      passedRecords: totalRecords - failedRecords,
      failedRecords,
      sampleFailures: failedRecords > 0 ? [
        { record_id: '1001', reason: `${check.name} check failed` },
        { record_id: '1042', reason: `${check.name} check failed` },
      ] : undefined,
    };
  }

  private calculateSummary(results: QualityCheckResult[]): QualityRunSummary {
    const totalRecords = results.reduce((sum, r) => sum + r.records_checked, 0);
    const quarantinedRecords = results.reduce((sum, r) => sum + r.records_failed, 0);

    return {
      total_checks: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      warnings: results.filter(r => r.status === 'warning').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      total_records: totalRecords,
      quarantined_records: quarantinedRecords,
      score: this.calculateScore(results, []),
    };
  }

  private calculateScore(results: QualityCheckResult[], checks: QualityCheckDefinition[]): number {
    if (results.length === 0) return 100;
    const passedCount = results.filter(r => r.status === 'passed').length;
    return Math.round((passedCount / results.length) * 100);
  }
}
