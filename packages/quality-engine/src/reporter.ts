/**
 * Quality Reporter
 * Generates human-readable quality reports in various formats.
 */

import type { QualityRunResult } from '@eadpa/shared';
import type { QualityScore } from './scorer';

export class QualityReporter {
  /**
   * Generate a markdown report
   */
  generateMarkdownReport(result: QualityRunResult, score: QualityScore): string {
    const lines: string[] = [
      `# Data Quality Report`,
      '',
      `**Pipeline:** ${result.pipeline_id}`,
      `**Execution:** ${result.execution_id}`,
      `**Date:** ${result.completed_at}`,
      `**Overall Score:** ${score.overall}/100 (Grade: ${score.grade})`,
      `**Trend:** ${score.trend}`,
      '',
      '## Summary',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Total Checks | ${result.summary.total_checks} |`,
      `| Passed | ${result.summary.passed} |`,
      `| Failed | ${result.summary.failed} |`,
      `| Warnings | ${result.summary.warnings} |`,
      `| Records Processed | ${result.summary.total_records.toLocaleString()} |`,
      `| Records Quarantined | ${result.summary.quarantined_records.toLocaleString()} |`,
      '',
      '## Check Results',
      '',
      '| Check | Status | Records Failed | Duration |',
      '|-------|--------|---------------|----------|',
    ];

    for (const check of result.check_results) {
      const statusIcon = check.status === 'passed' ? 'PASS' : check.status === 'failed' ? 'FAIL' : 'SKIP';
      lines.push(
        `| ${check.check_name} | ${statusIcon} | ${check.records_failed.toLocaleString()} (${check.failure_percentage.toFixed(1)}%) | ${check.duration_ms}ms |`
      );
    }

    if (score.breakdown.length > 0) {
      lines.push('', '## Score Breakdown', '');
      lines.push('| Category | Score | Weight |');
      lines.push('|----------|-------|--------|');
      for (const b of score.breakdown) {
        lines.push(`| ${b.category} | ${b.score}/100 | ${b.weight}% |`);
      }
    }

    lines.push('', '## Recommendation', '', score.recommendation);

    return lines.join('\n');
  }

  /**
   * Generate a JSON report for programmatic consumption
   */
  generateJsonReport(result: QualityRunResult, score: QualityScore): string {
    return JSON.stringify({
      report_type: 'data_quality',
      generated_at: new Date().toISOString(),
      generated_by: 'eadpa-quality-engine',
      pipeline_id: result.pipeline_id,
      execution_id: result.execution_id,
      score: {
        overall: score.overall,
        grade: score.grade,
        trend: score.trend,
      },
      summary: result.summary,
      check_results: result.check_results,
      recommendation: score.recommendation,
    }, null, 2);
  }
}
