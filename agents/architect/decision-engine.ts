/**
 * EADD Decision Intelligence Engine (Section 6.1)
 * 
 * Every non-trivial decision must go through a formal scoring process:
 * 1. State alternatives considered
 * 2. Score each against defined criteria
 * 3. Produce justification derived from scores
 * 4. Store in Knowledge Graph for future review
 * 
 * This is the "why" engine — makes decisions inspectable and challengeable.
 */

export interface DecisionCriteria {
  name: string;
  weight: number; // 0-1, must sum to 1
  description: string;
}

export interface AlternativeScore {
  alternative: string;
  scores: Record<string, number>; // criterion name → score (1-10)
  weightedTotal: number;
  pros: string[];
  cons: string[];
}

export interface DecisionRecord {
  id: string;
  question: string;
  context: string;
  criteria: DecisionCriteria[];
  alternatives: AlternativeScore[];
  winner: string;
  justification: string;
  decidedAt: string;
  decidedBy: string; // which agent
  /** Can be challenged later */
  challengeable: boolean;
}

// Standard criteria for platform decisions
export const PLATFORM_CRITERIA: DecisionCriteria[] = [
  { name: 'cost', weight: 0.25, description: 'Total cost of ownership (compute + storage + licensing)' },
  { name: 'latency', weight: 0.20, description: 'Processing latency / time to insight' },
  { name: 'complexity', weight: 0.15, description: 'Operational complexity to maintain' },
  { name: 'scalability', weight: 0.15, description: 'Ability to handle 10x-100x growth' },
  { name: 'risk', weight: 0.15, description: 'Vendor lock-in, maturity, community support' },
  { name: 'fit', weight: 0.10, description: 'How well it matches the specific workload pattern' },
];

/**
 * Score alternatives and produce a decision with full justification
 */
export function makeDecision(
  question: string,
  context: string,
  alternatives: string[],
  criteria: DecisionCriteria[],
  scoreMatrix: Record<string, Record<string, number>>, // alternative → criterion → score
  decidedBy: string
): DecisionRecord {
  // Calculate weighted totals
  const scored: AlternativeScore[] = alternatives.map(alt => {
    const scores = scoreMatrix[alt] || {};
    const weightedTotal = criteria.reduce((sum, c) => {
      return sum + (scores[c.name] || 5) * c.weight;
    }, 0);

    return {
      alternative: alt,
      scores,
      weightedTotal: Math.round(weightedTotal * 100) / 100,
      pros: Object.entries(scores).filter(([_, s]) => s >= 8).map(([c]) => `Strong on ${c}`),
      cons: Object.entries(scores).filter(([_, s]) => s <= 4).map(([c]) => `Weak on ${c}`),
    };
  });

  // Sort by weighted total (highest wins)
  scored.sort((a, b) => b.weightedTotal - a.weightedTotal);
  const winner = scored[0];
  const runnerUp = scored[1];

  // Generate justification from scores
  const justification = generateJustification(winner, runnerUp, criteria);

  return {
    id: `dec_${Date.now()}`,
    question,
    context,
    criteria,
    alternatives: scored,
    winner: winner.alternative,
    justification,
    decidedAt: new Date().toISOString(),
    decidedBy,
    challengeable: true,
  };
}

function generateJustification(winner: AlternativeScore, runnerUp: AlternativeScore | undefined, criteria: DecisionCriteria[]): string {
  let text = `Chose **${winner.alternative}** (score: ${winner.weightedTotal}/10)`;
  if (runnerUp) {
    text += ` over ${runnerUp.alternative} (score: ${runnerUp.weightedTotal}/10)`;
  }
  text += '. ';

  // Top strengths
  const topCriteria = Object.entries(winner.scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  text += 'Key strengths: ';
  text += topCriteria.map(([c, s]) => `${c} (${s}/10)`).join(', ');
  text += '. ';

  // Trade-offs acknowledged
  if (winner.cons.length > 0) {
    text += `Trade-offs accepted: ${winner.cons.join(', ')}.`;
  }

  return text;
}

// ============================================================
// EXECUTION MODES (Section 21)
// ============================================================

export type ExecutionMode = 'safe' | 'assisted' | 'auto' | 'full_autonomous';

export interface ExecutionModeConfig {
  mode: ExecutionMode;
  description: string;
  /** What the system can do without asking */
  autoActions: string[];
  /** What requires human approval */
  approvalRequired: string[];
  /** What is completely blocked */
  blocked: string[];
}

export const EXECUTION_MODES: Record<ExecutionMode, ExecutionModeConfig> = {
  safe: {
    mode: 'safe',
    description: 'Read-only. Analysis, profiling, and recommendations only. No changes made.',
    autoActions: ['read_data', 'profile_data', 'analyze_schema', 'generate_recommendations', 'estimate_cost'],
    approvalRequired: [],
    blocked: ['write_data', 'modify_schema', 'deploy_infrastructure', 'execute_pipeline', 'create_resources'],
  },
  assisted: {
    mode: 'assisted',
    description: 'System proposes changes. Waits for human approval before applying ANY of them.',
    autoActions: ['read_data', 'profile_data', 'analyze_schema', 'generate_code', 'generate_recommendations', 'estimate_cost', 'run_tests_sandbox'],
    approvalRequired: ['write_data', 'modify_schema', 'deploy_infrastructure', 'execute_pipeline', 'create_resources', 'modify_permissions'],
    blocked: [],
  },
  auto: {
    mode: 'auto',
    description: 'System executes safe operations automatically. Gates anything that mutates data/schema/infra.',
    autoActions: ['read_data', 'profile_data', 'analyze_schema', 'generate_code', 'run_tests_sandbox', 'retry_transient_failure', 'scale_compute', 'send_notifications', 'create_incident_ticket'],
    approvalRequired: ['write_production_data', 'modify_schema', 'deploy_to_production', 'modify_permissions', 'decommission_system'],
    blocked: [],
  },
  full_autonomous: {
    mode: 'full_autonomous',
    description: 'System executes end-to-end within defined guardrails. For trusted, validated pipelines only.',
    autoActions: ['read_data', 'profile_data', 'generate_code', 'run_tests', 'deploy_to_dev', 'deploy_to_staging', 'retry_failures', 'scale_compute', 'execute_pipeline', 'create_resources_within_budget'],
    approvalRequired: ['deploy_to_production', 'modify_schema_breaking', 'decommission_system', 'exceed_budget_threshold'],
    blocked: ['delete_production_data', 'remove_security_controls', 'disable_audit_logging'],
  },
};

/**
 * Check if an action is permitted under the current execution mode
 */
export function checkPermission(mode: ExecutionMode, action: string): 'allowed' | 'requires_approval' | 'blocked' {
  const config = EXECUTION_MODES[mode];

  if (config.blocked.some(b => action.includes(b))) return 'blocked';
  if (config.approvalRequired.some(a => action.includes(a))) return 'requires_approval';
  if (config.autoActions.some(a => action.includes(a))) return 'allowed';

  // Default: require approval for unknown actions
  return 'requires_approval';
}
