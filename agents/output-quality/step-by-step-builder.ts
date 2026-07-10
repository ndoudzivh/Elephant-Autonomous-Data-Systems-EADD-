/**
 * EADD Step-by-Step Builder
 * 
 * Complex pipeline builds are broken into digestible LAYERS.
 * Each layer is delivered one at a time, with explanation and confirmation.
 * 
 * Instead of dumping 500 lines of code at once, we:
 * 1. Deliver Layer 1 (foundation) → explain → confirm
 * 2. Deliver Layer 2 (core logic) → explain → confirm
 * 3. Deliver Layer 3 (quality) → explain → confirm
 * 4. Deliver Layer 4 (deployment) → explain → confirm
 * 
 * This mimics how a senior engineer would mentor a junior:
 * "First, let's set up the foundation. Here's why..."
 * "Good? Now let's add the business logic..."
 * 
 * Section 23.1 — Progressive Delivery
 */

export type BuildLayer = 
  | 'foundation'      // Project structure, configs, connections
  | 'ingestion'       // Source connectivity, raw data extraction
  | 'transformation'  // Business logic, data modeling
  | 'quality'         // Testing, validation, data quality
  | 'orchestration'   // Scheduling, dependencies, retry logic
  | 'deployment'      // CI/CD, infrastructure, environments
  | 'monitoring'      // Alerts, dashboards, observability
  | 'optimization';   // Cost, performance, self-healing

export type BuildStatus = 'pending' | 'in_progress' | 'delivered' | 'confirmed' | 'revision_requested';

export interface BuildStep {
  id: string;
  layer: BuildLayer;
  title: string;
  description: string;
  /** WHY this layer exists and what it enables */
  explanation: string;
  /** What this layer depends on */
  prerequisites: BuildLayer[];
  /** Artifacts produced by this step */
  artifacts: StepArtifact[];
  /** Questions to ask before proceeding */
  confirmationPrompt: string;
  /** Estimated time to implement */
  estimatedMinutes: number;
  /** Status tracking */
  status: BuildStatus;
  /** User's response */
  userConfirmation?: string;
}

export interface StepArtifact {
  filename: string;
  language: string;
  description: string;
  content: string;
  /** Why this file is needed */
  purpose: string;
}

export interface BuildPlan {
  id: string;
  pipelineName: string;
  totalSteps: number;
  currentStep: number;
  steps: BuildStep[];
  /** Overall progress */
  progress: number;
  /** Estimated total time */
  estimatedTotalMinutes: number;
  createdAt: string;
}

// ============================================================
// LAYER DEFINITIONS
// ============================================================

export const LAYER_DEFINITIONS: Record<BuildLayer, {
  title: string;
  emoji: string;
  description: string;
  explanation: string;
  typicalArtifacts: string[];
  confirmationTemplate: string;
}> = {
  foundation: {
    title: 'Foundation & Structure',
    emoji: '🏗️',
    description: 'Project layout, configuration, connection definitions, and basic scaffolding.',
    explanation: `We start with the foundation because everything else builds on it. Like constructing a building — you don't start with the roof.

This layer establishes:
- **Project structure**: Where files live, how they're organized
- **Configuration**: Environment variables, connection strings (as references, never plain text)
- **Dependencies**: What libraries/packages are needed
- **Base infrastructure**: The "skeleton" that all pipeline code plugs into

WHY FIRST: If the foundation is wrong, every layer above it is wrong too. Getting this right means less rework later.`,
    typicalArtifacts: ['project.yaml', 'requirements.txt / pyproject.toml', '.env.example', 'config/', 'README.md'],
    confirmationTemplate: `✅ **Layer 1 Complete: Foundation**

I've set up the project structure, configuration, and connections.

**Before I continue to Layer 2 (Ingestion), please confirm:**
1. Does the project structure look right?
2. Are the connection definitions correct?
3. Any additional config needed?

Reply **"continue"** to proceed, or tell me what to adjust.`,
  },

  ingestion: {
    title: 'Data Ingestion',
    emoji: '📥',
    description: 'Source connectivity, extraction logic, raw data landing.',
    explanation: `Now we connect to the source and pull data into our Bronze layer.

This layer handles:
- **Source connectivity**: Connecting to databases, APIs, file systems, streams
- **Extraction strategy**: Full load vs incremental vs CDC
- **Raw landing**: Writing data as-is to the Bronze zone
- **Schema capture**: Recording what we received (for auditing)

WHY THIS APPROACH: We never transform data during ingestion. Raw data goes straight to Bronze. This means:
- If transformation logic has a bug, we can reprocess from Bronze
- We have a complete audit trail of exactly what the source sent
- Ingestion and transformation can be developed/debugged independently`,
    typicalArtifacts: ['ingestion/extract.py', 'ingestion/source_schema.json', 'ingestion/incremental_config.yaml'],
    confirmationTemplate: `✅ **Layer 2 Complete: Ingestion**

I've built the extraction logic to pull data from your source into the Bronze layer.

**Key decisions made:**
- Extraction method: {method}
- Incremental strategy: {strategy}
- Landing format: {format}

**Before I continue to Layer 3 (Transformations), please confirm:**
1. Is the extraction approach correct?
2. Are there additional source tables to include?
3. Any concerns about source system load?

Reply **"continue"** to proceed, or tell me what to adjust.`,
  },

  transformation: {
    title: 'Transformations & Business Logic',
    emoji: '⚙️',
    description: 'Data cleaning, modeling, business rules, aggregations.',
    explanation: `This is the heart of the pipeline — where raw data becomes business value.

We apply:
- **Cleaning**: Fix nulls, standardize formats, cast types
- **Deduplication**: Remove exact and fuzzy duplicates
- **Business logic**: Calculate metrics, apply rules, create derived columns
- **Modeling**: Structure into star schema / medallion layers
- **Enrichment**: Join with reference data, lookup tables

WHY SEPARATE FROM INGESTION: By keeping transformation logic separate from extraction:
- You can change business rules without re-ingesting data
- Multiple transformations can consume the same Bronze data
- Easier to test (mock the Bronze layer, test transformations in isolation)`,
    typicalArtifacts: ['transformations/silver.py', 'transformations/gold.py', 'models/schema.sql', 'dbt/models/'],
    confirmationTemplate: `✅ **Layer 3 Complete: Transformations**

I've built the Silver → Gold transformation pipeline with your business logic.

**What was built:**
- Silver layer: Cleaning, dedup, standardization
- Gold layer: Business metrics, aggregations, final models

**Before I continue to Layer 4 (Quality Checks), please confirm:**
1. Does the business logic look correct?
2. Any additional calculations or rules needed?
3. Is the data model (star/medallion) appropriate?

Reply **"continue"** to proceed, or tell me what to adjust.`,
  },

  quality: {
    title: 'Data Quality & Testing',
    emoji: '✅',
    description: 'Validation rules, tests, quarantine, quality scoring.',
    explanation: `Data pipelines fail SILENTLY — they produce wrong data without throwing errors. Quality checks are how we catch these silent failures.

We add:
- **Schema tests**: Are columns the right type? Are keys unique? Are required fields present?
- **Business rules**: Is revenue positive? Are dates logical? Are amounts within range?
- **Cross-table validation**: Do foreign keys resolve? Do totals reconcile?
- **Freshness checks**: Is the data recent enough?
- **Anomaly detection**: Did row count change by more than 20%?

WHY NOT OPTIONAL: Without quality checks, you discover data problems when:
- The CFO sees wrong numbers in a board meeting
- A customer gets double-charged
- A regulatory report is filed with errors

All of these are much more expensive to fix than catching them in the pipeline.`,
    typicalArtifacts: ['quality/rules.yml', 'quality/great_expectations_suite.json', 'tests/test_transformations.py', 'dbt/tests/'],
    confirmationTemplate: `✅ **Layer 4 Complete: Quality Checks**

I've added comprehensive data quality rules.

**Quality framework:**
- {check_count} validation rules added
- Quarantine table for failed records
- Quality score tracking
- Alert thresholds: warn at {warn}%, halt at {halt}%

**Before I continue to Layer 5 (Orchestration), please confirm:**
1. Are the quality thresholds appropriate?
2. Any additional business rules to validate?
3. Should quality failures halt the pipeline or just alert?

Reply **"continue"** to proceed, or tell me what to adjust.`,
  },

  orchestration: {
    title: 'Orchestration & Scheduling',
    emoji: '🔄',
    description: 'DAGs, scheduling, dependencies, retry logic, alerting.',
    explanation: `Now we automate the pipeline — it should run on schedule without human intervention.

We define:
- **Schedule**: When and how often the pipeline runs
- **Dependencies**: Which steps must complete before others start
- **Retry logic**: What happens when a step fails (retry 3x with backoff)
- **Alerting**: Who gets notified on failure
- **Timeouts**: How long to wait before declaring failure
- **SLAs**: "This must complete by 6am" with alerts if breached

WHY: A pipeline that only runs when you manually trigger it isn't a pipeline — it's a script. Production data engineering requires automation with robust failure handling.`,
    typicalArtifacts: ['orchestration/dag.py', 'orchestration/schedule.yaml', 'orchestration/alerts.yaml'],
    confirmationTemplate: `✅ **Layer 5 Complete: Orchestration**

I've built the scheduling and dependency management.

**Configuration:**
- Schedule: {schedule}
- Retry policy: {retries}x with exponential backoff
- SLA: Must complete by {sla}
- Alerts: {alert_channel}

**Before I continue to Layer 6 (Deployment), please confirm:**
1. Is the schedule correct?
2. Who should receive failure alerts?
3. Any dependencies on other pipelines?

Reply **"continue"** to proceed, or tell me what to adjust.`,
  },

  deployment: {
    title: 'CI/CD & Deployment',
    emoji: '🚀',
    description: 'Build pipeline, test automation, environment promotion, infrastructure.',
    explanation: `Now we make this deployable — code that only runs on your laptop isn't production-ready.

We add:
- **CI/CD Pipeline**: Automated lint → test → build → deploy on every code push
- **Environment promotion**: dev → staging → production (with gates)
- **Infrastructure as Code**: Terraform/CloudFormation for repeatable deployments
- **Secrets management**: Secure credential handling
- **Rollback**: How to undo a bad deployment

WHY: Manual deployments are:
- Error-prone (forgetting a step, wrong environment)
- Non-reproducible (works on my machine!)
- Slow (waiting for someone to run commands)
- Risky (no automated tests before production)

CI/CD eliminates all of these.`,
    typicalArtifacts: ['.github/workflows/ci.yml', '.github/workflows/cd.yml', 'terraform/main.tf', 'Dockerfile', 'deploy.sh'],
    confirmationTemplate: `✅ **Layer 6 Complete: Deployment**

I've built the full CI/CD pipeline and infrastructure code.

**Deployment strategy:**
- CI: Lint + test on every PR
- CD: Auto-deploy to dev, manual gate for staging/production
- Rollback: {rollback_strategy}
- Infrastructure: {infra_tool}

**Before I continue to Layer 7 (Monitoring), please confirm:**
1. Is the deployment strategy appropriate?
2. Which environments do you need (dev/staging/prod)?
3. Any specific approval requirements?

Reply **"continue"** to proceed, or tell me what to adjust.`,
  },

  monitoring: {
    title: 'Monitoring & Observability',
    emoji: '📊',
    description: 'Dashboards, alerting, anomaly detection, operational visibility.',
    explanation: `A deployed pipeline without monitoring is a ticking time bomb. You need to know:

- **Is it running?** (execution monitoring)
- **Is the data fresh?** (freshness SLA)
- **Is the data correct?** (quality score trend)
- **Is it getting expensive?** (cost anomaly detection)
- **Is something breaking?** (error rate, latency P99)

We add:
- Operational dashboard (pipeline runs, durations, failures)
- Data quality dashboard (scores, trends, violations)
- Cost dashboard (daily/monthly spend, forecast)
- Alerts (PagerDuty/Slack/Email for SLA breaches)

WHY: The difference between "enterprise-grade" and "hobby project" is monitoring. Production pipelines MUST have visibility into health, freshness, and cost.`,
    typicalArtifacts: ['monitoring/dashboard.json', 'monitoring/alerts.yaml', 'monitoring/runbook.md'],
    confirmationTemplate: `✅ **Layer 7 Complete: Monitoring**

I've set up full operational visibility.

**Monitoring includes:**
- Pipeline execution dashboard
- Data freshness tracking
- Quality score trends
- Cost monitoring
- Alert rules: {alert_rules}

**Before I continue to Layer 8 (Optimization), please confirm:**
1. Are the alert thresholds appropriate?
2. Which notification channels (Slack, email, PagerDuty)?
3. Who is on the on-call rotation?

Reply **"continue"** to proceed, or tell me what to adjust.`,
  },

  optimization: {
    title: 'Cost & Performance Optimization',
    emoji: '💰',
    description: 'Cost reduction, performance tuning, self-healing, future improvements.',
    explanation: `The final polish — making the pipeline not just correct, but EFFICIENT.

We review:
- **Cost**: Are we over-provisioned? Can we use spot instances? Right-size warehouses?
- **Performance**: Are there slow queries? Missing partitions? Unnecessary shuffles?
- **Self-healing**: Can the pipeline auto-recover from transient failures?
- **Scaling**: Will this handle 10x growth without manual intervention?

WHY LAST: Optimization is meaningless if the pipeline is incorrect. First make it work, then make it fast, then make it cheap. Premature optimization is the root of all evil (Knuth).`,
    typicalArtifacts: ['optimization/cost_analysis.md', 'optimization/performance_tuning.sql', 'optimization/auto_scaling.yaml'],
    confirmationTemplate: `✅ **Layer 8 Complete: Optimization**

I've analyzed and optimized the pipeline for cost and performance.

**Improvements:**
- Cost savings: ~{cost_savings}% reduction
- Performance: ~{perf_improvement}% faster
- Self-healing: {healing_features}

**🎉 Pipeline build complete!**

You now have a production-ready, monitored, optimized data pipeline.
See the deployment instructions below for next steps.`,
  },
};

// ============================================================
// THE BUILD PLANNER
// ============================================================

export class StepByStepBuilder {
  private activePlans: Map<string, BuildPlan> = new Map();

  /**
   * Create a build plan for a new pipeline
   */
  createBuildPlan(pipelineName: string, complexity: 'simple' | 'medium' | 'complex'): BuildPlan {
    const layers = this.getLayersForComplexity(complexity);
    
    const steps: BuildStep[] = layers.map((layer, idx) => ({
      id: `step_${idx + 1}`,
      layer,
      title: LAYER_DEFINITIONS[layer].title,
      description: LAYER_DEFINITIONS[layer].description,
      explanation: LAYER_DEFINITIONS[layer].explanation,
      prerequisites: this.getPrerequisites(layer),
      artifacts: [],
      confirmationPrompt: LAYER_DEFINITIONS[layer].confirmationTemplate,
      estimatedMinutes: this.estimateLayerTime(layer, complexity),
      status: idx === 0 ? 'in_progress' : 'pending',
    }));

    const plan: BuildPlan = {
      id: `plan_${Date.now()}`,
      pipelineName,
      totalSteps: steps.length,
      currentStep: 1,
      steps,
      progress: 0,
      estimatedTotalMinutes: steps.reduce((sum, s) => sum + s.estimatedMinutes, 0),
      createdAt: new Date().toISOString(),
    };

    this.activePlans.set(plan.id, plan);
    return plan;
  }

  /**
   * Get the current step to deliver
   */
  getCurrentStep(planId: string): BuildStep | null {
    const plan = this.activePlans.get(planId);
    if (!plan) return null;
    return plan.steps[plan.currentStep - 1] || null;
  }

  /**
   * Confirm current step and advance to next
   */
  confirmStep(planId: string, userResponse?: string): BuildStep | null {
    const plan = this.activePlans.get(planId);
    if (!plan) return null;

    const current = plan.steps[plan.currentStep - 1];
    if (current) {
      current.status = 'confirmed';
      current.userConfirmation = userResponse;
    }

    plan.currentStep++;
    plan.progress = Math.round((plan.currentStep - 1) / plan.totalSteps * 100);

    const next = plan.steps[plan.currentStep - 1];
    if (next) {
      next.status = 'in_progress';
    }

    return next;
  }

  /**
   * Request revision of current step
   */
  requestRevision(planId: string, feedback: string): BuildStep | null {
    const plan = this.activePlans.get(planId);
    if (!plan) return null;

    const current = plan.steps[plan.currentStep - 1];
    if (current) {
      current.status = 'revision_requested';
      current.userConfirmation = feedback;
    }

    return current;
  }

  /**
   * Generate the progress header shown before each layer
   */
  generateProgressHeader(plan: BuildPlan): string {
    const current = plan.steps[plan.currentStep - 1];
    if (!current) return '';

    const layerDef = LAYER_DEFINITIONS[current.layer];
    const progressBar = this.generateProgressBar(plan.progress);

    return `
---
## ${layerDef.emoji} Layer ${plan.currentStep}/${plan.totalSteps}: ${layerDef.title}

${progressBar}

**Pipeline**: ${plan.pipelineName}
**Progress**: Step ${plan.currentStep} of ${plan.totalSteps} (${plan.progress}%)
**Estimated remaining**: ~${this.calculateRemainingTime(plan)} minutes

---

### Why this layer?

${current.explanation}

---
`;
  }

  /**
   * Generate a visual progress bar
   */
  private generateProgressBar(progress: number): string {
    const total = 20;
    const filled = Math.round(progress / 100 * total);
    const empty = total - filled;
    return `\`[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${progress}%\``;
  }

  private calculateRemainingTime(plan: BuildPlan): number {
    return plan.steps
      .filter(s => s.status === 'pending' || s.status === 'in_progress')
      .reduce((sum, s) => sum + s.estimatedMinutes, 0);
  }

  private getLayersForComplexity(complexity: 'simple' | 'medium' | 'complex'): BuildLayer[] {
    switch (complexity) {
      case 'simple':
        return ['foundation', 'ingestion', 'transformation', 'quality', 'deployment'];
      case 'medium':
        return ['foundation', 'ingestion', 'transformation', 'quality', 'orchestration', 'deployment', 'monitoring'];
      case 'complex':
        return ['foundation', 'ingestion', 'transformation', 'quality', 'orchestration', 'deployment', 'monitoring', 'optimization'];
    }
  }

  private getPrerequisites(layer: BuildLayer): BuildLayer[] {
    const prereqs: Record<BuildLayer, BuildLayer[]> = {
      foundation: [],
      ingestion: ['foundation'],
      transformation: ['ingestion'],
      quality: ['transformation'],
      orchestration: ['quality'],
      deployment: ['orchestration'],
      monitoring: ['deployment'],
      optimization: ['monitoring'],
    };
    return prereqs[layer];
  }

  private estimateLayerTime(layer: BuildLayer, complexity: 'simple' | 'medium' | 'complex'): number {
    const baseMinutes: Record<BuildLayer, number> = {
      foundation: 3,
      ingestion: 5,
      transformation: 8,
      quality: 4,
      orchestration: 4,
      deployment: 6,
      monitoring: 4,
      optimization: 5,
    };

    const multiplier = complexity === 'simple' ? 0.7 : complexity === 'medium' ? 1.0 : 1.5;
    return Math.round(baseMinutes[layer] * multiplier);
  }
}
