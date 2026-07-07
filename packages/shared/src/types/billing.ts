/**
 * Billing & Monetization Types
 * 
 * Revenue model: Freemium SaaS + Token-based usage
 * - Free tier attracts users (capped usage)
 * - Pro/Team subscription unlocks full capabilities
 * - Enterprise = custom contracts + VPC deployment
 * - Token credits for AI usage (like OpenAI/Anthropic pricing)
 */

// ============================================================
// SUBSCRIPTION TIERS
// ============================================================

export type SubscriptionTier = 'free' | 'pro' | 'team' | 'enterprise';
export type BillingCycle = 'monthly' | 'annual';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired';

export interface SubscriptionPlan {
  id: string;
  tier: SubscriptionTier;
  name: string;
  description: string;
  price_monthly_usd: number;
  price_annual_usd: number; // per year (discounted)
  features: PlanFeatures;
  limits: PlanLimits;
  token_allowance: TokenAllowance;
}

export interface PlanFeatures {
  /** Number of cloud backends available */
  cloud_backends: string[]; // e.g. ['aws'] for free, ['aws','azure','snowflake','dbt','databricks'] for pro
  /** Data modeling styles available */
  model_styles: string[];
  /** Quality engine features */
  quality_checks: boolean;
  quality_scoring: boolean;
  quarantine: boolean;
  /** Orchestration generators available */
  orchestration_engines: string[];
  /** CI/CD generators */
  cicd_generators: string[];
  /** Schema drift detection */
  drift_detection: boolean;
  /** Source-to-target mapping */
  mapping_engine: boolean;
  /** Auto-mapping suggestions */
  auto_mapping: boolean;
  /** Custom domain */
  custom_domain: boolean;
  /** SSO/SAML */
  sso: boolean;
  /** API access */
  api_access: boolean;
  /** Priority support */
  priority_support: boolean;
  /** Audit logs */
  audit_logs: boolean;
  /** VPC deployment option */
  vpc_deployment: boolean;
  /** Compliance certifications */
  compliance: string[];
  /** Export generated code */
  code_export: boolean;
  /** Git integration (push to user's repo) */
  git_integration: boolean;
}

export interface PlanLimits {
  /** Max messages per day */
  messages_per_day: number;
  /** Max messages per month */
  messages_per_month: number;
  /** Max pipelines (total stored) */
  max_pipelines: number;
  /** Max pipeline executions per day */
  executions_per_day: number;
  /** Max team members (Team/Enterprise) */
  max_team_members: number;
  /** Max workspaces */
  max_workspaces: number;
  /** Max file upload size (MB) */
  max_upload_mb: number;
  /** Conversation history retention (days) */
  history_retention_days: number;
  /** Max concurrent pipeline runs */
  max_concurrent_runs: number;
}

export interface TokenAllowance {
  /** Included tokens per month */
  included_tokens_monthly: number;
  /** Overage price per 1M input tokens (USD) */
  overage_input_per_million_usd: number;
  /** Overage price per 1M output tokens (USD) */
  overage_output_per_million_usd: number;
  /** Hard cap (stop service at this point, don't just charge) */
  hard_cap_tokens_monthly: number;
  /** Whether to auto-charge overage or stop */
  overage_behavior: 'auto_charge' | 'stop_and_notify' | 'throttle';
}

// ============================================================
// TOKEN USAGE TRACKING
// ============================================================

export interface TokenUsageRecord {
  id: string;
  workspace_id: string;
  user_id: string;
  conversation_id: string;
  message_id: string;
  /** Timestamp of usage */
  timestamp: string;
  /** Input tokens consumed */
  input_tokens: number;
  /** Output tokens consumed */
  output_tokens: number;
  /** Total tokens */
  total_tokens: number;
  /** Cost in USD for this request */
  cost_usd: number;
  /** Model used */
  model_id: string;
  /** What the tokens were used for */
  purpose: 'chat' | 'pipeline_generation' | 'code_compilation' | 'quality_check' | 'mapping' | 'schema_discovery';
}

export interface UsageSummary {
  workspace_id: string;
  period_start: string;
  period_end: string;
  /** Token usage */
  tokens: {
    input_used: number;
    output_used: number;
    total_used: number;
    included_allowance: number;
    overage_tokens: number;
    remaining: number;
    percentage_used: number;
  };
  /** Cost breakdown */
  cost: {
    subscription_usd: number;
    token_overage_usd: number;
    total_usd: number;
  };
  /** Usage by category */
  by_category: Record<string, { tokens: number; cost_usd: number; count: number }>;
  /** Daily breakdown */
  daily: Array<{ date: string; tokens: number; cost_usd: number; messages: number }>;
}

// ============================================================
// BILLING & INVOICING
// ============================================================

export interface Subscription {
  id: string;
  workspace_id: string;
  plan_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  /** Current period */
  current_period_start: string;
  current_period_end: string;
  /** Payment info */
  payment_method_id?: string;
  /** Trial */
  trial_end?: string;
  /** Cancellation */
  cancel_at_period_end?: boolean;
  cancelled_at?: string;
  /** Stripe/payment IDs */
  external_subscription_id?: string;
  external_customer_id?: string;
  /** Created */
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  workspace_id: string;
  subscription_id: string;
  /** Period */
  period_start: string;
  period_end: string;
  /** Line items */
  line_items: InvoiceLineItem[];
  /** Totals */
  subtotal_usd: number;
  tax_usd: number;
  total_usd: number;
  /** Status */
  status: 'draft' | 'open' | 'paid' | 'void' | 'overdue';
  paid_at?: string;
  due_date: string;
  /** External */
  external_invoice_id?: string;
  pdf_url?: string;
  created_at: string;
}

export interface InvoiceLineItem {
  description: string;
  type: 'subscription' | 'token_overage' | 'addon' | 'credit';
  quantity: number;
  unit_price_usd: number;
  total_usd: number;
}

// ============================================================
// LICENSE KEYS (for Enterprise/On-Premise)
// ============================================================

export interface LicenseKey {
  id: string;
  key: string; // encrypted license key
  workspace_id: string;
  tier: 'enterprise';
  /** What the license enables */
  features: string[];
  /** Max users */
  max_users: number;
  /** Max token usage per month */
  max_tokens_monthly: number;
  /** Validity */
  issued_at: string;
  expires_at: string;
  /** Status */
  status: 'active' | 'expired' | 'revoked';
  /** Hardware binding (for on-premise) */
  hardware_fingerprint?: string;
  /** Metadata */
  customer_name: string;
  customer_email: string;
  notes?: string;
}
