/**
 * EADD Enterprise Pricing & Billing Engine — Type Definitions
 * 
 * Three simultaneous revenue models:
 * 1. Platform Subscription (recurring, metered)
 * 2. Migration Project (fixed-fee, milestone-based)
 * 3. Gain-Share (outcome-based, capped)
 * 
 * Base currency: ZAR. Multi-currency support for international clients.
 * All prices are admin-configurable, NOT hardcoded constants.
 */

// ============================================================
// CURRENCY & FX
// ============================================================

export type Currency = 'ZAR' | 'USD' | 'EUR' | 'GBP';

export interface FXRate {
  baseCurrency: 'ZAR';
  targetCurrency: Currency;
  rate: number;
  source: string; // e.g., "ECB", "OpenExchangeRates"
  timestamp: string;
  expiresAt: string;
}

export interface MoneyAmount {
  amount: number;
  currency: Currency;
  /** ZAR equivalent at time of calculation */
  zarEquivalent: number;
  /** FX rate used (null if already ZAR) */
  fxRateUsed?: FXRate;
}

// ============================================================
// TIER 1: PLATFORM SUBSCRIPTION
// ============================================================

export type SubscriptionPlan = 'starter' | 'growth' | 'enterprise';
export type MeteringModel = 'per_pipeline' | 'per_data_volume' | 'per_agent_execution';
export type BillingCycle = 'monthly' | 'quarterly' | 'annual';

export interface SubscriptionTier {
  id: string;
  plan: SubscriptionPlan;
  name: string;
  description: string;
  /** Price range in ZAR (configurable, not hardcoded) */
  priceRange: {
    minMonthlyZAR: number;
    maxMonthlyZAR: number;
  };
  /** Features included */
  features: string[];
  /** Metering model chosen by client */
  meteringModel: MeteringModel;
  /** Metering rates (configurable per client) */
  meteringRates: MeteringRates;
  /** Hard tier ceiling — NEVER silently bill overage */
  tierCeiling: TierCeiling;
  /** Annual prepayment discount percentage (configurable, typically 10-20%) */
  annualDiscountPercent: number;
}

export interface MeteringRates {
  /** Per-pipeline: flat rate per active pipeline per billing cycle */
  perPipelineRateZAR?: number;
  /** Per-volume: rate per TB processed */
  perTBRateZAR?: number;
  /** Per-volume: rate per million rows */
  perMillionRowsRateZAR?: number;
  /** Per-agent: rate per invocation, broken down by agent */
  perAgentRates?: Record<string, number>;
}

export interface TierCeiling {
  enabled: boolean;
  /** Maximum usage before warning (percentage of tier limit) */
  warningThresholdPercent: number; // e.g., 80
  /** Hard maximum — system warns client AND account owner, blocks further billing */
  hardLimitZAR: number;
  /** What happens at ceiling: 'warn_and_block' | 'warn_and_continue' */
  ceilingBehavior: 'warn_and_block' | 'warn_and_continue';
}

// ============================================================
// TIER 2: MIGRATION PROJECT (FIXED-FEE)
// ============================================================

export type ProjectSize = 'small' | 'mid' | 'large';
export type MilestoneStatus = 'not_started' | 'in_progress' | 'validation_pending' | 'validated' | 'invoiced' | 'paid';

export interface MigrationProject {
  id: string;
  clientId: string;
  name: string;
  size: ProjectSize;
  /** From rapid inventory/triage — REQUIRED before quote */
  triageResults: TriageResults;
  /** Fixed-fee quote (only valid after triage) */
  quotedFeeZAR: number;
  /** Assumptions the quote is based on */
  quoteAssumptions: QuoteAssumptions;
  /** Milestones with payment gates */
  milestones: ProjectMilestone[];
  /** Status */
  status: 'quoting' | 'active' | 'completed' | 'disputed';
  createdAt: string;
  approvedBy?: string;
}

export interface TriageResults {
  /** Pattern inventory from Section 18.3 */
  totalPipelines: number;
  patternCount: number;
  complexityDistribution: {
    simple: number;
    medium: number;
    complex: number;
  };
  /** Estimated effort hours */
  estimatedEffortHours: number;
  /** Confidence score */
  confidenceScore: number;
  triageCompletedAt: string;
}

export interface QuoteAssumptions {
  pipelineCount: number;
  patternCount: number;
  complexityScores: Record<string, number>;
  estimatedDurationWeeks: number;
  platformTarget: string;
  /** If estate turns out larger, this documents basis for change order */
  scopeNotes: string;
}

export interface ProjectMilestone {
  id: string;
  name: string;
  description: string;
  /** Percentage of total fee payable at this milestone */
  feePercentage: number;
  /** Amount in ZAR */
  amountZAR: number;
  /** Validation gate that must pass before payment is releasable */
  validationGate: ValidationGate;
  status: MilestoneStatus;
  validatedAt?: string;
  invoicedAt?: string;
  paidAt?: string;
}

export interface ValidationGate {
  type: 'pattern_templates_built' | 'pilot_migration_validated' | 'full_estate_migrated';
  /** Specific criteria that must be met */
  criteria: string[];
  /** Whether the gate has passed */
  passed: boolean;
  /** Evidence/proof */
  evidence?: string;
}

// ============================================================
// TIER 3: GAIN-SHARE (OUTCOME-BASED)
// ============================================================

export interface GainShareContract {
  id: string;
  clientId: string;
  /** Percentage of documented savings (10-20%, configurable) */
  sharePercentage: number;
  /** Hard cap — stop billing once reached */
  annualCapZAR: number;
  /** Current accrued amount this period */
  accruedAmountZAR: number;
  /** Time-bound: start and end dates */
  startDate: string;
  endDate: string;
  /** After end date, reverts to Tier 1/2 only */
  postExpiryBehavior: 'revert_to_subscription' | 'renegotiate';
  /** Savings must come from Business Outcome Tracker (Section 15.1) */
  /** NEVER accept manually entered savings without tracked calculation */
  trackedSavings: TrackedSaving[];
  status: 'active' | 'capped' | 'expired' | 'disputed';
}

export interface TrackedSaving {
  id: string;
  /** Source: must reference Business Outcome Tracker calculation */
  outcomeTrackerId: string;
  description: string;
  /** Validated annual saving amount */
  annualSavingZAR: number;
  /** Calculation method (must be auditable) */
  calculationMethod: string;
  /** Before vs after evidence */
  beforeMetric: string;
  afterMetric: string;
  validatedAt: string;
  validatedBy: string;
}

// ============================================================
// USAGE TRACKING
// ============================================================

export interface UsageRecord {
  id: string;
  clientId: string;
  subscriptionId: string;
  timestamp: string;
  /** Which agent was invoked */
  agentName: string;
  /** What was done */
  action: string;
  /** Metering dimensions */
  metrics: {
    pipelinesActive?: number;
    dataVolumeBytes?: number;
    rowsProcessed?: number;
    agentInvocations?: number;
    computeSeconds?: number;
  };
  /** Cost calculated for this usage event */
  calculatedCostZAR: number;
  /** Billing period this belongs to */
  billingPeriod: string;
}

// ============================================================
// INVOICING
// ============================================================

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'disputed' | 'void';

export interface Invoice {
  id: string;
  clientId: string;
  invoiceNumber: string;
  /** Which tier(s) this covers */
  tiers: Array<'subscription' | 'project' | 'gain_share'>;
  /** Billing period */
  periodStart: string;
  periodEnd: string;
  /** Line items */
  lineItems: InvoiceLineItem[];
  /** Totals */
  subtotalZAR: number;
  vatAmount: number;
  vatRate: number; // e.g., 0.15 for 15% SA VAT
  totalZAR: number;
  /** If invoiced in foreign currency */
  foreignCurrency?: Currency;
  foreignCurrencyTotal?: number;
  fxRateAtInvoice?: FXRate;
  /** Tax handling */
  taxTreatment: 'standard_vat' | 'zero_rated_export' | 'reverse_charge';
  /** Status */
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
  paidAt?: string;
  /** Immutable audit trail */
  auditLog: AuditEntry[];
}

export interface InvoiceLineItem {
  description: string;
  tier: 'subscription' | 'project_milestone' | 'gain_share' | 'adjustment';
  quantity: number;
  unitDescription: string;
  unitPriceZAR: number;
  totalZAR: number;
  /** Reference to underlying usage records or milestone */
  referenceId?: string;
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor: string;
  details: string;
}

// ============================================================
// CLIENT CONFIGURATION
// ============================================================

export interface ClientBillingConfig {
  clientId: string;
  clientName: string;
  /** Billing currency (ZAR default, configurable) */
  billingCurrency: Currency;
  /** Tax jurisdiction */
  jurisdiction: 'south_africa' | 'eu' | 'us' | 'uk' | 'other';
  taxExempt: boolean;
  /** Which metering model they chose */
  meteringModel: MeteringModel;
  /** Subscription tier */
  subscriptionTier: SubscriptionPlan;
  /** Billing cycle */
  billingCycle: BillingCycle;
  /** Whether annual prepayment is active */
  annualPrepaid: boolean;
  /** Discount percentage applied */
  discountPercent: number;
  /** Active gain-share contract (if any) */
  gainShareContractId?: string;
  /** Active migration project (if any) */
  migrationProjectId?: string;
  /** Hard spending limit per month */
  monthlySpendLimitZAR?: number;
  /** Contact for billing alerts */
  billingContactEmail: string;
  accountOwnerEmail: string;
}
