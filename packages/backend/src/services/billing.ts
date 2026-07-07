/**
 * Billing Service
 * Handles subscription management, token usage tracking,
 * plan enforcement, and Stripe integration.
 */

import { PRICING_PLANS, REVENUE_CONFIG } from '@eadpa/shared';

export class BillingService {
  /**
   * Check if user action is allowed by their plan
   */
  async checkLimit(workspaceId: string, action: string): Promise<LimitCheckResult> {
    const subscription = await this.getSubscription(workspaceId);
    const plan = PRICING_PLANS[subscription.tier];
    const usage = await this.getMonthlyUsage(workspaceId);

    // Check message limits
    if (action === 'send_message') {
      if (plan.limits.messages_per_day !== -1) {
        const todayMessages = await this.getTodayMessageCount(workspaceId);
        if (todayMessages >= plan.limits.messages_per_day) {
          return {
            allowed: false,
            reason: 'daily_message_limit',
            message: `You've reached your daily limit of ${plan.limits.messages_per_day} messages. Upgrade to Pro for 500/day.`,
            upgrade_cta: true,
          };
        }
      }
    }

    // Check token limits
    if (action === 'use_tokens') {
      const tokenUsage = usage.tokens;
      const percentage = (tokenUsage.total_used / plan.token_allowance.included_tokens_monthly) * 100;

      if (percentage >= 100 && plan.token_allowance.overage_behavior === 'stop_and_notify') {
        return {
          allowed: false,
          reason: 'token_limit_reached',
          message: `You've used all ${this.formatTokens(plan.token_allowance.included_tokens_monthly)} tokens this month. Upgrade to Pro for 2M tokens/month.`,
          upgrade_cta: true,
        };
      }

      if (percentage >= REVENUE_CONFIG.alerts.warn_at_percentage) {
        return {
          allowed: true,
          warning: `You've used ${Math.round(percentage)}% of your monthly token allowance (${this.formatTokens(tokenUsage.remaining)} remaining).`,
        };
      }
    }

    // Check pipeline limits
    if (action === 'create_pipeline') {
      if (plan.limits.max_pipelines !== -1) {
        const pipelineCount = await this.getPipelineCount(workspaceId);
        if (pipelineCount >= plan.limits.max_pipelines) {
          return {
            allowed: false,
            reason: 'pipeline_limit',
            message: `You've reached your limit of ${plan.limits.max_pipelines} pipelines. Upgrade to Pro for 50 pipelines.`,
            upgrade_cta: true,
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Record token usage for billing
   */
  async recordTokenUsage(params: {
    workspaceId: string;
    userId: string;
    conversationId: string;
    messageId: string;
    inputTokens: number;
    outputTokens: number;
    purpose: string;
    modelId: string;
  }): Promise<void> {
    const subscription = await this.getSubscription(params.workspaceId);
    const plan = PRICING_PLANS[subscription.tier];

    const totalTokens = params.inputTokens + params.outputTokens;
    const costUsd = this.calculateTokenCost(params.inputTokens, params.outputTokens, plan);

    // Store usage record (DynamoDB in production)
    console.log(`[Billing] ${params.workspaceId}: ${totalTokens} tokens ($${costUsd.toFixed(4)}) - ${params.purpose}`);

    // Check if overage billing is needed
    const monthlyUsage = await this.getMonthlyTokens(params.workspaceId);
    if (monthlyUsage > plan.token_allowance.included_tokens_monthly) {
      const overageTokens = monthlyUsage - plan.token_allowance.included_tokens_monthly;
      console.log(`[Billing] Overage: ${this.formatTokens(overageTokens)} tokens beyond allowance`);
      // In production: create Stripe usage record for metered billing
    }
  }

  /**
   * Check if a feature is available on the user's plan
   */
  async checkFeature(workspaceId: string, feature: string): Promise<boolean> {
    const subscription = await this.getSubscription(workspaceId);
    const plan = PRICING_PLANS[subscription.tier];

    switch (feature) {
      case 'multi_cloud':
        return plan.features.cloud_backends.length > 1;
      case 'data_vault':
        return plan.features.model_styles.includes('data_vault');
      case 'scd2':
        return plan.features.model_styles.includes('scd2');
      case 'auto_mapping':
        return plan.features.auto_mapping;
      case 'drift_detection':
        return plan.features.drift_detection;
      case 'quality_scoring':
        return plan.features.quality_scoring;
      case 'quarantine':
        return plan.features.quarantine;
      case 'sso':
        return plan.features.sso;
      case 'api_access':
        return plan.features.api_access;
      case 'git_integration':
        return plan.features.git_integration;
      default:
        return false;
    }
  }

  /**
   * Get usage dashboard data
   */
  async getUsageDashboard(workspaceId: string) {
    const subscription = await this.getSubscription(workspaceId);
    const plan = PRICING_PLANS[subscription.tier];
    const usage = await this.getMonthlyUsage(workspaceId);

    return {
      plan: {
        tier: subscription.tier,
        name: plan.name,
        price: plan.price_monthly_usd,
      },
      tokens: {
        used: usage.tokens.total_used,
        allowance: plan.token_allowance.included_tokens_monthly,
        remaining: Math.max(0, plan.token_allowance.included_tokens_monthly - usage.tokens.total_used),
        percentage: Math.round((usage.tokens.total_used / plan.token_allowance.included_tokens_monthly) * 100),
        overage_cost: usage.cost.token_overage_usd,
      },
      messages: {
        today: await this.getTodayMessageCount(workspaceId),
        limit_today: plan.limits.messages_per_day,
        this_month: usage.tokens.total_used, // approximate
      },
      pipelines: {
        count: await this.getPipelineCount(workspaceId),
        limit: plan.limits.max_pipelines,
      },
      billing: {
        current_month_cost: usage.cost.total_usd,
        next_invoice_date: subscription.current_period_end,
      },
    };
  }

  // --- Helper methods ---

  private calculateTokenCost(inputTokens: number, outputTokens: number, plan: any): number {
    const inputCost = (inputTokens / 1_000_000) * plan.token_allowance.overage_input_per_million_usd;
    const outputCost = (outputTokens / 1_000_000) * plan.token_allowance.overage_output_per_million_usd;
    return inputCost + outputCost;
  }

  private formatTokens(count: number): string {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`;
    return count.toString();
  }

  // Placeholder methods (implement with DynamoDB in production)
  private async getSubscription(workspaceId: string): Promise<any> {
    return { tier: 'free', current_period_end: '2026-08-06' };
  }
  private async getMonthlyUsage(workspaceId: string): Promise<any> {
    return { tokens: { total_used: 0, remaining: 100000 }, cost: { total_usd: 0, token_overage_usd: 0 } };
  }
  private async getTodayMessageCount(workspaceId: string): Promise<number> { return 0; }
  private async getMonthlyTokens(workspaceId: string): Promise<number> { return 0; }
  private async getPipelineCount(workspaceId: string): Promise<number> { return 0; }
}

interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  message?: string;
  warning?: string;
  upgrade_cta?: boolean;
}
