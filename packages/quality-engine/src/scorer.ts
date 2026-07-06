/**
 * Quality Scorer
 * Calculates data quality scores with weighted check types
 * and trend detection.
 */

import type { QualityRunResult, ScoringConfig } from '@eadpa/shared';

export interface QualityScore {
  overall: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: ScoreBreakdown[];
  trend: 'improving' | 'stable' | 'degrading';
  recommendation: string;
}

export interface ScoreBreakdown {
  category: string;
  score: number;
  weight: number;
  weighted_score: number;
  checks_passed: number;
  checks_total: number;
}

export class QualityScorer {
  private history: QualityRunResult[] = [];
  private config: ScoringConfig;

  constructor(config?: Partial<ScoringConfig>) {
    this.config = {
      enabled: true,
      weights: {
        schema: 25,
        null: 20,
        unique: 20,
        referential: 15,
        range: 5,
        pattern: 5,
        custom_sql: 5,
        freshness: 3,
        volume: 1,
        statistical: 1,
      },
      thresholds: {
        excellent: 95,
        good: 85,
        acceptable: 70,
        poor: 50,
      },
      ...config,
    };
  }

  /**
   * Calculate quality score from run results
   */
  score(result: QualityRunResult): QualityScore {
    const breakdown = this.calculateBreakdown(result);
    const overall = this.calculateOverall(breakdown);
    const grade = this.getGrade(overall);
    const trend = this.calculateTrend(overall);

    // Add to history for trend detection
    this.history.push(result);
    if (this.history.length > 30) this.history.shift();

    return {
      overall,
      grade,
      breakdown,
      trend,
      recommendation: this.getRecommendation(grade, breakdown),
    };
  }

  private calculateBreakdown(result: QualityRunResult): ScoreBreakdown[] {
    const categories = new Map<string, { passed: number; total: number }>();

    for (const check of result.check_results) {
      const category = check.check_name.split('_')[0] || 'other';
      const existing = categories.get(category) || { passed: 0, total: 0 };
      existing.total++;
      if (check.status === 'passed') existing.passed++;
      categories.set(category, existing);
    }

    const breakdown: ScoreBreakdown[] = [];
    const weights = this.config.weights as Record<string, number>;
    const totalWeight = Object.values(weights).reduce((sum: number, w: number) => sum + w, 0);

    for (const [category, { passed, total }] of categories) {
      const score = total > 0 ? (passed / total) * 100 : 100;
      const weight = (weights[category] || 1) / totalWeight;
      breakdown.push({
        category,
        score: Math.round(score),
        weight: Math.round(weight * 100),
        weighted_score: Math.round(score * weight),
        checks_passed: passed,
        checks_total: total,
      });
    }

    return breakdown.sort((a, b) => b.weight - a.weight);
  }

  private calculateOverall(breakdown: ScoreBreakdown[]): number {
    if (breakdown.length === 0) return 100;
    const totalWeightedScore = breakdown.reduce((sum, b) => sum + b.weighted_score, 0);
    const totalWeight = breakdown.reduce((sum, b) => sum + b.weight, 0);
    return Math.round((totalWeightedScore / totalWeight) * 100);
  }

  private getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= this.config.thresholds.excellent) return 'A';
    if (score >= this.config.thresholds.good) return 'B';
    if (score >= this.config.thresholds.acceptable) return 'C';
    if (score >= this.config.thresholds.poor) return 'D';
    return 'F';
  }

  private calculateTrend(currentScore: number): 'improving' | 'stable' | 'degrading' {
    if (this.history.length < 3) return 'stable';

    const recentScores = this.history.slice(-5).map(r => r.overall_score);
    const avgRecent = recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length;

    if (currentScore > avgRecent + 5) return 'improving';
    if (currentScore < avgRecent - 5) return 'degrading';
    return 'stable';
  }

  private getRecommendation(grade: string, breakdown: ScoreBreakdown[]): string {
    if (grade === 'A') return 'Excellent data quality. All checks passing consistently.';
    if (grade === 'B') return 'Good data quality with minor issues. Review warning-level checks.';

    // Find weakest category
    const weakest = breakdown.sort((a, b) => a.score - b.score)[0];
    if (weakest) {
      return `Focus on improving ${weakest.category} checks (currently ${weakest.score}%). ` +
        `${weakest.checks_total - weakest.checks_passed} of ${weakest.checks_total} checks failing.`;
    }

    return 'Review failing quality checks and address root causes.';
  }
}
