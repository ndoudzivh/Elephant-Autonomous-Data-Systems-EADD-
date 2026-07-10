/**
 * EADD Dynamic Agent Router
 * 
 * NOT every request needs all 12 agents.
 * This router analyzes what the user needs and activates ONLY the relevant agents.
 * 
 * Examples:
 * - "Migrate my SAS pipelines to Snowflake" → Migration + Architect + DevOps + Quality
 * - "Build a pipeline from PostgreSQL to S3" → Planner + Builder + Quality + DevOps
 * - "Profile this dataset" → Quality (profiling only)
 * - "Build me a dashboard for churn" → Visualization + Lineage
 * - "Full platform build for our data lake" → ALL agents
 * 
 * The router is the FIRST thing that runs. It decides the execution plan.
 */

// ============================================================
// AGENT DEFINITIONS (12 specialized agents)
// ============================================================

export type AgentId =
  | 'requirements'    // 🎯 Clarify the ask, capture constraints
  | 'planner'         // 🧠 Sequence work, orchestrate
  | 'architect'       // 🏗️ Design solution, choose platform
  | 'builder'         // ⚙️ Write pipeline code
  | 'migration'       // 🔁 Legacy parsing, pattern conversion
  | 'quality'         // 🔍 Profiling, data quality, testing
  | 'governance'      // 🔐 Lineage, security, compliance, catalog
  | 'visualization'   // 📊 Dashboards, BI, charts
  | 'observability'   // 🩺 Monitoring, alerting, incident response
  | 'devops'          // 🚀 CI/CD, IaC, deployment
  | 'optimizer'       // 💰 Cost, performance, self-healing
  | 'reviewer';       // 🔍 Code review, security review

export interface AgentDefinition {
  id: AgentId;
  name: string;
  emoji: string;
  description: string;
  /** What keywords/intents trigger this agent */
  triggers: string[];
  /** Which other agents this one commonly works with */
  collaboratesWith: AgentId[];
  /** Priority (lower = activates first in the pipeline) */
  priority: number;
}

export const AGENTS: Record<AgentId, AgentDefinition> = {
  requirements: {
    id: 'requirements',
    name: 'Requirements Agent',
    emoji: '🎯',
    description: 'Clarifies the ask. Captures functional and non-functional constraints (budget, compliance, latency, data residency) before any design begins.',
    triggers: ['what do you need', 'requirements', 'constraints', 'budget', 'compliance', 'help me define'],
    collaboratesWith: ['planner', 'architect'],
    priority: 1,
  },
  planner: {
    id: 'planner',
    name: 'Planner Agent',
    emoji: '🧠',
    description: 'Understands the problem holistically. Sequences work across all other agents. Owns overall orchestration and conflict resolution.',
    triggers: ['plan', 'design', 'how should', 'what approach', 'strategy'],
    collaboratesWith: ['architect', 'builder', 'devops'],
    priority: 2,
  },
  architect: {
    id: 'architect',
    name: 'Architect Agent',
    emoji: '🏗️',
    description: 'Designs the solution. Chooses modeling approach (Kimball/Medallion/Data Vault/3NF), target platform(s), and justifies every decision with scoring.',
    triggers: ['architecture', 'design', 'platform', 'snowflake', 'databricks', 'aws', 'azure', 'model', 'star schema', 'data vault', 'medallion'],
    collaboratesWith: ['planner', 'builder', 'optimizer'],
    priority: 3,
  },
  builder: {
    id: 'builder',
    name: 'Pipeline Builder Agent',
    emoji: '⚙️',
    description: 'Builds pipelines — batch, streaming, and Python-native — across all platforms. Source connectivity, transformation code, orchestration.',
    triggers: ['build', 'pipeline', 'create', 'generate', 'code', 'etl', 'elt', 'transform', 'ingest', 'airflow', 'dbt', 'spark', 'glue', 'kafka'],
    collaboratesWith: ['architect', 'quality', 'devops', 'reviewer'],
    priority: 4,
  },
  migration: {
    id: 'migration',
    name: 'Migration Agent',
    emoji: '🔁',
    description: 'Legacy pipeline parsing, pattern learning, conversion, parallel-run validation, database modernization. SSIS, SAS, Informatica, stored procedures.',
    triggers: ['migrate', 'migration', 'legacy', 'modernize', 'ssis', 'sas', 'informatica', 'talend', 'datastage', 'stored procedure', 'convert', 'move from'],
    collaboratesWith: ['architect', 'quality', 'devops', 'reviewer'],
    priority: 4,
  },
  quality: {
    id: 'quality',
    name: 'Data Quality Agent',
    emoji: '✅',
    description: 'Profiling, data quality detection/fix proposals, testing (unit/validation/regression/performance). Schema validation, quarantine.',
    triggers: ['quality', 'profile', 'test', 'validate', 'check', 'null', 'duplicate', 'data quality', 'great expectations', 'dbt test'],
    collaboratesWith: ['builder', 'governance'],
    priority: 5,
  },
  governance: {
    id: 'governance',
    name: 'Governance & Compliance Agent',
    emoji: '🔐',
    description: 'End-to-end lineage (table/column-level), data catalog, impact analysis. PII detection, masking, encryption. RBAC, secrets. Data residency. Pre-execution policy gate. Audit logging.',
    triggers: ['governance', 'compliance', 'lineage', 'pii', 'security', 'gdpr', 'popia', 'hipaa', 'encrypt', 'mask', 'audit', 'catalog', 'who owns', 'where did this come from', 'impact'],
    collaboratesWith: ['quality', 'architect', 'devops'],
    priority: 5,
  },
  visualization: {
    id: 'visualization',
    name: 'Visualization Agent',
    emoji: '📊',
    description: 'Interactive BI dashboards, natural-language dashboard requests, semantic-layer-aligned charts. Power BI, Tableau, Looker, Superset.',
    triggers: ['dashboard', 'visualization', 'chart', 'report', 'bi', 'power bi', 'tableau', 'looker', 'show me', 'graph'],
    collaboratesWith: ['governance', 'builder'],
    priority: 6,
  },
  observability: {
    id: 'observability',
    name: 'Observability Agent',
    emoji: '🩺',
    description: 'Post-deploy monitoring, anomaly detection, root-cause analysis, incident creation, on-call notification and escalation. Self-healing.',
    triggers: ['monitor', 'alert', 'observability', 'failure', 'incident', 'why did', 'what broke', 'anomaly', 'sla', 'freshness', 'self-healing'],
    collaboratesWith: ['devops', 'quality'],
    priority: 7,
  },
  devops: {
    id: 'devops',
    name: 'DevOps Agent',
    emoji: '🚀',
    description: 'CI/CD pipelines, infrastructure as code (Terraform), environment promotion (dev→staging→prod), deployment strategies, rollback.',
    triggers: ['deploy', 'ci/cd', 'cicd', 'terraform', 'infrastructure', 'github actions', 'gitlab', 'docker', 'kubernetes', 'rollback'],
    collaboratesWith: ['builder', 'migration', 'governance'],
    priority: 8,
  },
  optimizer: {
    id: 'optimizer',
    name: 'Optimization Agent',
    emoji: '💰',
    description: 'Cost estimation before deployment, cost monitoring and optimization after. Performance tuning. FinOps.',
    triggers: ['cost', 'optimize', 'expensive', 'cheaper', 'performance', 'slow', 'speed up', 'save money', 'finops', 'budget'],
    collaboratesWith: ['architect', 'builder', 'devops'],
    priority: 9,
  },
  reviewer: {
    id: 'reviewer',
    name: 'Code Reviewer Agent',
    emoji: '🔍',
    description: 'Reviews code for security, performance, reliability, scalability, compliance. Approves or requests changes. Strict but fair.',
    triggers: ['review', 'check my code', 'is this good', 'security review', 'best practice'],
    collaboratesWith: ['builder', 'migration', 'governance'],
    priority: 10,
  },
};

// ============================================================
// INTENT CLASSIFICATION (what does the user want?)
// ============================================================

export type UserIntent =
  | 'build_pipeline'          // Build a new data pipeline
  | 'migrate_legacy'          // Migrate/modernize legacy systems
  | 'profile_data'            // Analyze/profile a dataset
  | 'design_architecture'     // Design a data architecture
  | 'create_dashboard'        // Build BI/visualization
  | 'fix_issue'               // Debug/fix a pipeline problem
  | 'optimize_cost'           // Reduce cost or improve performance
  | 'setup_governance'        // Lineage, compliance, security
  | 'deploy_infrastructure'   // CI/CD, Terraform, deployment
  | 'full_platform_build'     // Everything — complete data platform
  | 'ask_question'            // General question/advice
  | 'unknown';                // Can't determine — ask Requirements Agent

// ============================================================
// ROUTING RULES — Which agents for which intent
// ============================================================

export const ROUTING_RULES: Record<UserIntent, AgentId[]> = {
  build_pipeline: ['requirements', 'architect', 'builder', 'quality', 'devops', 'reviewer'],
  migrate_legacy: ['requirements', 'migration', 'architect', 'quality', 'devops', 'reviewer'],
  profile_data: ['quality'],
  design_architecture: ['requirements', 'planner', 'architect', 'optimizer'],
  create_dashboard: ['visualization', 'governance'],
  fix_issue: ['observability', 'builder'],
  optimize_cost: ['optimizer', 'architect'],
  setup_governance: ['governance', 'devops'],
  deploy_infrastructure: ['devops', 'optimizer'],
  full_platform_build: ['requirements', 'planner', 'architect', 'builder', 'quality', 'governance', 'devops', 'optimizer', 'reviewer', 'observability'],
  ask_question: ['planner'],
  unknown: ['requirements'],
};

// ============================================================
// DYNAMIC ROUTER — Classifies intent and returns execution plan
// ============================================================

export interface ExecutionPlan {
  intent: UserIntent;
  confidence: number;
  agents: AgentId[];
  executionOrder: Array<{ agent: AgentId; stage: string }>;
  reasoning: string;
}

/**
 * Classify user intent and build an execution plan.
 * This is the FIRST function called for every user request.
 */
export function routeRequest(userMessage: string): ExecutionPlan {
  const lower = userMessage.toLowerCase();

  // Classify intent based on keywords
  const intent = classifyIntent(lower);

  // Get the agent list for this intent
  const agents = ROUTING_RULES[intent];

  // Build execution order (agents run in priority order)
  const executionOrder = agents
    .map(agentId => AGENTS[agentId])
    .sort((a, b) => a.priority - b.priority)
    .map(agent => ({
      agent: agent.id,
      stage: getStageForAgent(agent.id, intent),
    }));

  return {
    intent,
    confidence: calculateConfidence(lower, intent),
    agents,
    executionOrder,
    reasoning: generateRoutingReasoning(intent, agents),
  };
}

function classifyIntent(text: string): UserIntent {
  // Migration indicators
  if (/migrat|legacy|moderniz|ssis|sas\b|informatica|talend|datastage|convert from|move from/.test(text)) {
    return 'migrate_legacy';
  }
  // Pipeline building
  if (/build.*pipeline|create.*pipeline|pipeline from|ingest.*from|etl|elt/.test(text)) {
    return 'build_pipeline';
  }
  // Data profiling
  if (/profile|analyz.*data|data quality report|check.*data/.test(text)) {
    return 'profile_data';
  }
  // Architecture design
  if (/design|architect|platform.*choice|which.*cloud|data lake|data warehouse|data mesh/.test(text)) {
    return 'design_architecture';
  }
  // Dashboard/BI
  if (/dashboard|visualization|chart|report|power bi|tableau|looker|show me.*data/.test(text)) {
    return 'create_dashboard';
  }
  // Fix issues
  if (/fix|broken|failed|error|why did|debug|not working|issue/.test(text)) {
    return 'fix_issue';
  }
  // Cost optimization
  if (/cost|expensive|cheaper|optimize|budget|too much|save money|finops/.test(text)) {
    return 'optimize_cost';
  }
  // Governance
  if (/governance|compliance|lineage|pii|gdpr|popia|security|audit|who owns/.test(text)) {
    return 'setup_governance';
  }
  // Infrastructure/DevOps
  if (/deploy|ci\/cd|terraform|infrastructure|github actions|docker/.test(text)) {
    return 'deploy_infrastructure';
  }
  // Full platform
  if (/full.*platform|entire.*data|complete.*solution|end.to.end|everything/.test(text)) {
    return 'full_platform_build';
  }
  // General question
  if (/what is|how do|can you explain|tell me about|difference between/.test(text)) {
    return 'ask_question';
  }

  return 'unknown';
}

function calculateConfidence(text: string, intent: UserIntent): number {
  const agentIds = ROUTING_RULES[intent];
  let matchCount = 0;

  for (const agentId of agentIds) {
    const agent = AGENTS[agentId];
    for (const trigger of agent.triggers) {
      if (text.includes(trigger.toLowerCase())) {
        matchCount++;
      }
    }
  }

  return Math.min(0.95, 0.5 + matchCount * 0.1);
}

function getStageForAgent(agentId: AgentId, intent: UserIntent): string {
  const stageMap: Record<AgentId, string> = {
    requirements: 'gather_requirements',
    planner: 'plan_execution',
    architect: 'design_solution',
    builder: 'generate_code',
    migration: 'parse_and_convert',
    quality: intent === 'profile_data' ? 'profile_dataset' : 'add_quality_checks',
    governance: 'apply_governance',
    visualization: 'build_dashboard',
    observability: 'setup_monitoring',
    devops: 'configure_deployment',
    optimizer: 'optimize_solution',
    reviewer: 'review_output',
  };
  return stageMap[agentId] || 'execute';
}

function generateRoutingReasoning(intent: UserIntent, agents: AgentId[]): string {
  const qualityNote = '\n\n📋 Output Quality Pipeline active: Code validation ✓ | Educational explanations ✓ | Cost estimate ✓ | Deploy instructions ✓';
  const stepNote = OUTPUT_QUALITY_CONFIG.stepByStepIntents.includes(intent) ? ' | Step-by-step delivery ✓' : '';
  
  const reasonMap: Record<UserIntent, string> = {
    build_pipeline: `Detected pipeline build request. Activating ${agents.length} agents: Requirements → Architect → Builder → Quality → DevOps → Reviewer. This ensures the pipeline is properly designed, built, tested, and deployable.`,
    migrate_legacy: `Detected legacy migration request. Activating ${agents.length} agents: Requirements → Migration → Architect → Quality → DevOps → Reviewer. The Migration Agent will parse legacy code, extract patterns, and convert with confidence scoring.`,
    profile_data: `Detected data profiling request. Activating Quality Agent only — lightweight, fast analysis without full pipeline build.`,
    design_architecture: `Detected architecture design request. Activating ${agents.length} agents: Requirements → Planner → Architect → Optimizer. Will produce a scored platform recommendation with cost estimate.`,
    create_dashboard: `Detected visualization request. Activating Visualization + Governance agents to build a dashboard aligned to the semantic layer with proper access controls.`,
    fix_issue: `Detected troubleshooting request. Activating Observability + Builder agents for root-cause analysis and fix generation.`,
    optimize_cost: `Detected cost optimization request. Activating Optimizer + Architect to analyze current spend and recommend cheaper alternatives.`,
    setup_governance: `Detected governance/compliance request. Activating Governance + DevOps for lineage, security, and policy enforcement.`,
    deploy_infrastructure: `Detected deployment request. Activating DevOps + Optimizer for CI/CD and infrastructure provisioning with cost awareness.`,
    full_platform_build: `Detected full platform build request. Activating ALL agents (${agents.length}). This is a comprehensive engagement covering architecture through deployment.`,
    ask_question: `General question detected. Routing to Planner Agent for expert guidance.`,
    unknown: `Intent unclear. Routing to Requirements Agent to clarify what's needed before activating other agents.`,
  };
  return reasonMap[intent] + qualityNote + stepNote;
}

// ============================================================
// CONFLICT RESOLUTION (Section 20.1)
// Priority: Security/Governance > Compliance > Cost > Performance
// ============================================================

/**
 * OUTPUT QUALITY ENHANCEMENT (Section 23 — integrated into every route)
 * 
 * Regardless of which agents are activated, every response passes through:
 * 1. Code Accuracy Validator — catches .with() vs .withColumn(), typos, wrong APIs
 * 2. Educational Explainer — adds WHY explanations and mentor notes
 * 3. Cost Estimator — appends cost projection to every pipeline solution
 * 4. Deployment Instructions — appends deployment steps to every solution
 * 
 * For complex builds (full_platform_build, build_pipeline with >3 sources):
 * 5. Step-by-Step Builder — breaks output into confirmable layers
 */
export const OUTPUT_QUALITY_CONFIG = {
  /** Always validate generated code for accuracy */
  validateCode: true,
  /** Always explain WHY decisions are made */
  addExplanations: true,
  /** Default explanation level (auto-adjusts based on user messages) */
  defaultExplanationLevel: 'intermediate' as const,
  /** Break complex builds into steps */
  stepByStepThreshold: 'medium' as 'simple' | 'medium' | 'complex',
  /** Always include cost estimate */
  includeCostEstimate: true,
  /** Always include deployment instructions */
  includeDeploymentInstructions: true,
  /** Intents that trigger step-by-step delivery */
  stepByStepIntents: ['build_pipeline', 'migrate_legacy', 'full_platform_build'] as UserIntent[],
};

export interface ConflictResolution {
  conflictDescription: string;
  winningAgent: AgentId;
  losingAgent: AgentId;
  resolution: string;
  priorityRule: string;
}

export const CONFLICT_PRIORITY = [
  'governance',    // Security/Governance = highest priority
  'quality',       // Compliance/quality
  'optimizer',     // Cost
  'architect',     // Performance/design
  'builder',       // Implementation
] as const;

export function resolveConflict(
  agentA: AgentId,
  agentB: AgentId,
  conflictDescription: string
): ConflictResolution {
  const priorityA = CONFLICT_PRIORITY.indexOf(agentA as any);
  const priorityB = CONFLICT_PRIORITY.indexOf(agentB as any);

  const winner = priorityA <= priorityB ? agentA : agentB;
  const loser = winner === agentA ? agentB : agentA;

  return {
    conflictDescription,
    winningAgent: winner,
    losingAgent: loser,
    resolution: `${AGENTS[winner].emoji} ${AGENTS[winner].name} takes priority over ${AGENTS[loser].emoji} ${AGENTS[loser].name}`,
    priorityRule: 'Security/Governance > Compliance > Cost > Performance',
  };
}
