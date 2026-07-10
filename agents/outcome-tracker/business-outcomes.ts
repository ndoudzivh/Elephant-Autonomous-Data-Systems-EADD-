/**
 * EADD Business Outcome Tracker
 * 
 * Tracks before-vs-after metrics to PROVE the value EADD delivers.
 * Reports in executive language. Ties to gain-share billing.
 * 
 * Section 15.1 of requirements.
 */

export interface BusinessOutcome {
  id: string;
  clientId: string;
  pipelineId: string;
  name: string;
  description: string;
  /** Before metrics (baseline) */
  before: OutcomeMetric;
  /** After metrics (current) */
  after: OutcomeMetric;
  /** Calculated savings/improvement */
  improvement: ImprovementCalculation;
  /** Executive summary (plain language) */
  executiveSummary: string;
  /** Validated by */
  validatedBy?: string;
  validatedAt?: string;
  /** Period */
  measurementStart: string;
  measurementEnd: string;
  status: 'measuring' | 'validated' | 'reported' | 'billed';
}

export interface OutcomeMetric {
  costPerMonthZAR: number;
  processingTimeMinutes: number;
  errorRate: number;
  manualEffortHours: number;
  pipelineCount: number;
  dataFreshnessMinutes: number;
  /** Custom metrics */
  custom?: Record<string, number>;
}

export interface ImprovementCalculation {
  costSavingZAR: number;
  costSavingPercent: number;
  timeSavingMinutes: number;
  timeSavingPercent: number;
  errorReduction: number;
  manualEffortSaved: number;
  annualSavingZAR: number;
}

export class BusinessOutcomeTracker {
  private outcomes: Map<string, BusinessOutcome> = new Map();

  /** Record a baseline (before EADD) */
  recordBaseline(clientId: string, pipelineId: string, metrics: OutcomeMetric): string {
    const id = `outcome_${Date.now()}`;
    const outcome: BusinessOutcome = {
      id,
      clientId,
      pipelineId,
      name: '',
      description: '',
      before: metrics,
      after: metrics, // Same until measured
      improvement: this.calculateImprovement(metrics, metrics),
      executiveSummary: 'Baseline recorded. Measuring improvement...',
      measurementStart: new Date().toISOString(),
      measurementEnd: '',
      status: 'measuring',
    };
    this.outcomes.set(id, outcome);
    return id;
  }

  /** Record current state (after EADD) and calculate improvement */
  recordCurrentState(outcomeId: string, currentMetrics: OutcomeMetric): BusinessOutcome {
    const outcome = this.outcomes.get(outcomeId);
    if (!outcome) throw new Error(`Outcome ${outcomeId} not found`);

    outcome.after = currentMetrics;
    outcome.improvement = this.calculateImprovement(outcome.before, currentMetrics);
    outcome.executiveSummary = this.generateExecutiveSummary(outcome);
    outcome.measurementEnd = new Date().toISOString();
    outcome.status = 'validated';

    return outcome;
  }

  /** Generate executive-language report */
  generateReport(clientId: string): string {
    const clientOutcomes = Array.from(this.outcomes.values()).filter(o => o.clientId === clientId);
    if (clientOutcomes.length === 0) return 'No outcomes tracked yet.';

    const totalSaving = clientOutcomes.reduce((sum, o) => sum + o.improvement.annualSavingZAR, 0);

    let report = `## 📈 Business Outcome Report\n\n`;
    report += `**Total Annual Value Delivered: R${totalSaving.toLocaleString()}**\n\n`;

    for (const outcome of clientOutcomes) {
      report += `### ${outcome.name || outcome.pipelineId}\n`;
      report += outcome.executiveSummary + '\n\n';
    }

    return report;
  }

  private calculateImprovement(before: OutcomeMetric, after: OutcomeMetric): ImprovementCalculation {
    return {
      costSavingZAR: before.costPerMonthZAR - after.costPerMonthZAR,
      costSavingPercent: before.costPerMonthZAR > 0 ? Math.round(((before.costPerMonthZAR - after.costPerMonthZAR) / before.costPerMonthZAR) * 100) : 0,
      timeSavingMinutes: before.processingTimeMinutes - after.processingTimeMinutes,
      timeSavingPercent: before.processingTimeMinutes > 0 ? Math.round(((before.processingTimeMinutes - after.processingTimeMinutes) / before.processingTimeMinutes) * 100) : 0,
      errorReduction: before.errorRate - after.errorRate,
      manualEffortSaved: before.manualEffortHours - after.manualEffortHours,
      annualSavingZAR: (before.costPerMonthZAR - after.costPerMonthZAR) * 12,
    };
  }

  private generateExecutiveSummary(outcome: BusinessOutcome): string {
    const i = outcome.improvement;
    const parts: string[] = [];

    if (i.costSavingPercent > 0) parts.push(`Reduced monthly cost by **${i.costSavingPercent}%** (R${i.costSavingZAR.toLocaleString()}/month saved)`);
    if (i.timeSavingPercent > 0) parts.push(`Reduced processing time by **${i.timeSavingPercent}%** (${i.timeSavingMinutes} minutes faster)`);
    if (i.manualEffortSaved > 0) parts.push(`Eliminated **${i.manualEffortSaved} hours/month** of manual work`);
    if (i.errorReduction > 0) parts.push(`Reduced error rate by **${(i.errorReduction * 100).toFixed(1)}%**`);

    if (parts.length === 0) return 'Improvement measurement in progress.';

    return parts.join('. ') + `. **Annual value: R${i.annualSavingZAR.toLocaleString()}**.`;
  }
}
