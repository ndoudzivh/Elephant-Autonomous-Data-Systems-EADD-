/**
 * EADD Feedback Loop Engine
 * 
 * "Was this correct?" on every decision.
 * Corrections feed back into pattern templates.
 * System gets SMARTER with every interaction.
 * 
 * Section 17 of requirements.
 */

export type FeedbackRating = 'correct' | 'partially_correct' | 'incorrect';
export type FeedbackCategory = 'architecture' | 'code' | 'model' | 'platform_choice' | 'quality_rule' | 'cost_estimate' | 'migration';

export interface FeedbackEntry {
  id: string;
  /** What was the agent's output */
  agentOutput: string;
  agentName: string;
  /** User's rating */
  rating: FeedbackRating;
  /** What was wrong (if not correct) */
  correction?: string;
  /** What should it have been */
  expectedOutput?: string;
  /** Category for pattern learning */
  category: FeedbackCategory;
  /** Context (what was the request) */
  originalRequest: string;
  /** Domain context */
  domain?: string;
  /** Timestamp */
  timestamp: string;
  userId: string;
  /** Applied to pattern? */
  appliedToPattern: boolean;
}

export interface LearningPattern {
  id: string;
  category: FeedbackCategory;
  /** The pattern: when X context → do Y instead of Z */
  trigger: string;
  incorrectBehavior: string;
  correctBehavior: string;
  /** How many times this pattern was confirmed */
  confirmations: number;
  /** Confidence (increases with confirmations) */
  confidence: number;
  domain?: string;
  createdAt: string;
  lastUsed?: string;
}

export class FeedbackEngine {
  private feedback: FeedbackEntry[] = [];
  private patterns: LearningPattern[] = [];

  /** Record feedback on an agent decision */
  recordFeedback(entry: FeedbackEntry): void {
    this.feedback.push(entry);
    if (entry.rating !== 'correct' && entry.correction) {
      this.learnFromCorrection(entry);
    }
  }

  /** Learn from a correction — create or strengthen a pattern */
  private learnFromCorrection(entry: FeedbackEntry): void {
    const existing = this.patterns.find(p =>
      p.category === entry.category &&
      p.incorrectBehavior === entry.agentOutput.slice(0, 100)
    );

    if (existing) {
      existing.confirmations++;
      existing.confidence = Math.min(0.99, existing.confidence + 0.05);
      existing.lastUsed = new Date().toISOString();
    } else {
      this.patterns.push({
        id: `pat_${Date.now()}`,
        category: entry.category,
        trigger: entry.originalRequest.slice(0, 200),
        incorrectBehavior: entry.agentOutput.slice(0, 200),
        correctBehavior: entry.correction || entry.expectedOutput || '',
        confirmations: 1,
        confidence: 0.6,
        domain: entry.domain,
        createdAt: new Date().toISOString(),
      });
    }
  }

  /** Check if we have a learned pattern for this context */
  checkForPattern(category: FeedbackCategory, context: string, domain?: string): LearningPattern | null {
    return this.patterns.find(p =>
      p.category === category &&
      p.confidence >= 0.7 &&
      context.toLowerCase().includes(p.trigger.toLowerCase().slice(0, 50)) &&
      (!domain || !p.domain || p.domain === domain)
    ) || null;
  }

  /** Get accuracy stats */
  getAccuracyStats(): { total: number; correct: number; rate: number } {
    const total = this.feedback.length;
    const correct = this.feedback.filter(f => f.rating === 'correct').length;
    return { total, correct, rate: total > 0 ? Math.round((correct / total) * 100) : 100 };
  }

  /** Get all learned patterns */
  getPatterns(): LearningPattern[] {
    return this.patterns.sort((a, b) => b.confidence - a.confidence);
  }
}
