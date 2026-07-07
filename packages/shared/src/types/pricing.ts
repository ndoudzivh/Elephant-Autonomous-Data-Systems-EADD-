/**
 * Pricing Configuration
 * 
 * The actual plan definitions and limits.
 * This is the single source of truth for what each tier gets.
 */

import type { SubscriptionPlan } from './billing';

// ============================================================
// PLAN DEFINITIONS
// ============================================================

export const PRICING_PLANS: Record<string, SubscriptionPlan> = {
  free: {
    id: 'plan_free',
    tier: 'free',
    name: 'Free',
    description: 'Get started with AI-powered pipeline building. Perfect for learning and personal projects.',
    price_monthly_usd: 0,
    price_annual_usd: 0,
    features: {
      cloud_backends: ['aws'],
      model_styles: ['star_schema', 'flat'],
      quality_checks: true,
      quality_scoring: false,
      quarantine: false,
      orchestration_engines: ['airflow'],
      cicd_generators: ['github_actions'],
      drift_detection: false,
      mapping_engine: true,
      auto_mapping: false,
      custom_domain: false,
      sso: false,
      api_access: false,
      priority_support: false,
      audit_logs: false,
      vpc_deployment: false,
      compliance: [],
      code_export: true,
      git_integration: false,
    },
    limits: {
      messages_per_day: 20,
      messages_per_month: 200,
      max_pipelines: 3,
      executions_per_day: 5,
      max_team_members: 1,
      max_workspaces: 1,
      max_upload_mb: 10,
      history_retention_days: 7,
      max_concurrent_runs: 1,
    },
    token_allowance: {
      included_tokens_monthly: 100_000,      // 100K tokens/month
      overage_input_per_million_usd: 0,       // No overage - hard stop
      overage_output_per_million_usd: 0,
      hard_cap_tokens_monthly: 100_000,
      overage_behavior: 'stop_and_notify',
    },
  },

  pro: {
    id: 'plan_pro',
    tier: 'pro',
    name: 'Pro',
    description: 'For professional data engineers. Unlimited pipelines, all cloud backends, full features.',
    price_monthly_usd: 49,
    price_annual_usd: 470,  // ~$39/month billed annually (20% discount)
    features: {
      cloud_backends: ['aws', 'azure', 'gcp', 'snowflake', 'databricks'],
      model_styles: ['star_schema', 'data_vault', 'scd2', 'flat'],
      quality_checks: true,
      quality_scoring: true,
      quarantine: true,
      orchestration_engines: ['airflow', 'dagster', 'step_functions', 'databricks_workflows', 'adf', 'cloud_composer'],
      cicd_generators: ['github_actions', 'gitlab_ci', 'azure_devops'],
      drift_detection: true,
      mapping_engine: true,
      auto_mapping: true,
      custom_domain: false,
      sso: false,
      api_access: true,
      priority_support: false,
      audit_logs: false,
      vpc_deployment: false,
      compliance: [],
      code_export: true,
      git_integration: true,
    },
    limits: {
      messages_per_day: 500,
      messages_per_month: 10_000,
      max_pipelines: 50,
      executions_per_day: 100,
      max_team_members: 1,
      max_workspaces: 5,
      max_upload_mb: 100,
      history_retention_days: 90,
      max_concurrent_runs: 5,
    },
    token_allowance: {
      included_tokens_monthly: 2_000_000,     // 2M tokens/month included
      overage_input_per_million_usd: 3.0,     // $3 per 1M additional input tokens
      overage_output_per_million_usd: 15.0,   // $15 per 1M additional output tokens
      hard_cap_tokens_monthly: 20_000_000,    // 20M hard cap (safety net)
      overage_behavior: 'auto_charge',
    },
  },

  team: {
    id: 'plan_team',
    tier: 'team',
    name: 'Team',
    description: 'For data engineering teams. Shared workspaces, collaboration, SSO, and team management.',
    price_monthly_usd: 29,  // per user/month
    price_annual_usd: 278,  // per user/year (~$23/month, 20% discount)
    features: {
      cloud_backends: ['aws', 'azure', 'gcp', 'snowflake', 'databricks'],
      model_styles: ['star_schema', 'data_vault', 'scd2', 'flat'],
      quality_checks: true,
      quality_scoring: true,
      quarantine: true,
      orchestration_engines: ['airflow', 'dagster', 'step_functions', 'databricks_workflows', 'adf', 'cloud_composer'],
      cicd_generators: ['github_actions', 'gitlab_ci', 'azure_devops'],
      drift_detection: true,
      mapping_engine: true,
      auto_mapping: true,
      custom_domain: true,
      sso: true,
      api_access: true,
      priority_support: true,
      audit_logs: true,
      vpc_deployment: false,
      compliance: ['GDPR'],
      code_export: true,
      git_integration: true,
    },
    limits: {
      messages_per_day: 1000,
      messages_per_month: 20_000,
      max_pipelines: 200,
      executions_per_day: 500,
      max_team_members: 25,
      max_workspaces: 20,
      max_upload_mb: 500,
      history_retention_days: 365,
      max_concurrent_runs: 10,
    },
    token_allowance: {
      included_tokens_monthly: 5_000_000,     // 5M tokens/month per team
      overage_input_per_million_usd: 2.5,     // Slight discount on overage
      overage_output_per_million_usd: 12.0,
      hard_cap_tokens_monthly: 50_000_000,
      overage_behavior: 'auto_charge',
    },
  },

  enterprise: {
    id: 'plan_enterprise',
    tier: 'enterprise',
    name: 'Enterprise',
    description: 'For organizations with compliance, security, and scale requirements. VPC deployment, SLA, dedicated support.',
    price_monthly_usd: 0,  // Custom pricing (starts ~$500/month)
    price_annual_usd: 0,   // Custom
    features: {
      cloud_backends: ['aws', 'azure', 'gcp', 'snowflake', 'databricks'],
      model_styles: ['star_schema', 'data_vault', 'scd2', 'flat'],
      quality_checks: true,
      quality_scoring: true,
      quarantine: true,
      orchestration_engines: ['airflow', 'dagster', 'step_functions', 'databricks_workflows', 'adf', 'cloud_composer'],
      cicd_generators: ['github_actions', 'gitlab_ci', 'azure_devops'],
      drift_detection: true,
      mapping_engine: true,
      auto_mapping: true,
      custom_domain: true,
      sso: true,
      api_access: true,
      priority_support: true,
      audit_logs: true,
      vpc_deployment: true,
      compliance: ['GDPR', 'POPIA', 'CCPA', 'SOX', 'PCI-DSS'],
      code_export: true,
      git_integration: true,
    },
    limits: {
      messages_per_day: -1,       // Unlimited
      messages_per_month: -1,     // Unlimited
      max_pipelines: -1,          // Unlimited
      executions_per_day: -1,     // Unlimited
      max_team_members: -1,       // Unlimited
      max_workspaces: -1,         // Unlimited
      max_upload_mb: 5000,
      history_retention_days: -1, // Forever
      max_concurrent_runs: 50,
    },
    token_allowance: {
      included_tokens_monthly: 50_000_000,    // 50M tokens/month
      overage_input_per_million_usd: 2.0,     // Volume discount
      overage_output_per_million_usd: 10.0,
      hard_cap_tokens_monthly: -1,            // No cap (enterprise responsibility)
      overage_behavior: 'auto_charge',
    },
  },
};

// ============================================================
// REVENUE PROJECTIONS (for business planning)
// ============================================================

/**
 * Revenue model assumptions:
 * 
 * Year 1 targets:
 *   Free users:       1,000 (funnel)
 *   Pro subscribers:    100 × $49/month  = $4,900/month
 *   Team seats:         50 × $29/month   = $1,450/month  
 *   Enterprise:          2 × $500/month  = $1,000/month
 *   Token overage:     ~$500/month (Pro users who exceed 2M)
 * 
 *   Total MRR target: ~$7,850/month = ~$94K/year ARR
 * 
 * Year 2 (with multi-cloud and enterprise):
 *   Pro: 500 × $49    = $24,500/month
 *   Team: 200 × $29   = $5,800/month
 *   Enterprise: 10 × $1,500 = $15,000/month
 *   Token overage:     $3,000/month
 * 
 *   Total MRR target: ~$48,300/month = ~$580K/year ARR
 * 
 * Key metrics to track:
 *   - Free → Pro conversion rate (target: 10%)
 *   - Pro → Team upgrade rate (target: 20%)
 *   - Monthly token usage per user (affects margin)
 *   - Churn rate (target: <5% monthly for Pro)
 *   - Net Revenue Retention (target: 120%+ from upsells)
 */

export const REVENUE_CONFIG = {
  /** Stripe product/price IDs (set these in production) */
  stripe: {
    pro_monthly: 'price_pro_monthly',
    pro_annual: 'price_pro_annual',
    team_monthly: 'price_team_monthly',
    team_annual: 'price_team_annual',
  },

  /** Trial configuration */
  trial: {
    enabled: true,
    duration_days: 14,
    tier_during_trial: 'pro' as const,
    require_payment_method: false, // Don't require card for trial
  },

  /** Token pricing (our cost vs what we charge) */
  token_economics: {
    // What we pay Bedrock (Claude Sonnet)
    our_cost_input_per_million: 3.0,
    our_cost_output_per_million: 15.0,
    // What we charge users (at cost for Pro, margin on lower tiers)
    // Free tier: subsidized from Pro/Enterprise revenue
    // Pro tier: at cost (tokens are the hook, not the profit center)
    // Enterprise: volume discount (negotiated, typically 30-40% off list)
    margin_percentage: 0, // 0% margin on Pro (subscription is the revenue)
  },

  /** Usage alerts */
  alerts: {
    warn_at_percentage: 80,    // Warn user at 80% of token allowance
    throttle_at_percentage: 95, // Throttle (slower responses) at 95%
    stop_at_percentage: 100,   // Stop (free tier) or charge overage (paid)
  },
};
