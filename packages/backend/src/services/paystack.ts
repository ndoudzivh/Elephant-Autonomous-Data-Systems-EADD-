/**
 * Paystack Payment Service
 * Handles subscriptions, plan management, and webhooks.
 */

import { PAYSTACK_CONFIG } from '../config/paystack';

export class PaystackService {
  private baseUrl = PAYSTACK_CONFIG.baseUrl;
  private secretKey = PAYSTACK_CONFIG.secretKey;

  /**
   * Initialize a subscription checkout for a user
   * Returns a Paystack payment URL to redirect the user to
   */
  async initializeSubscription(params: {
    email: string;
    planCode: string;
    userId: string;
    callbackUrl?: string;
  }): Promise<{ authorization_url: string; reference: string }> {
    const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: params.email,
        plan: params.planCode,
        callback_url: params.callbackUrl || PAYSTACK_CONFIG.callbackUrl,
        metadata: {
          user_id: params.userId,
          custom_fields: [
            { display_name: 'User ID', variable_name: 'user_id', value: params.userId },
          ],
        },
      }),
    });

    const data = await response.json();
    if (!data.status) throw new Error(data.message || 'Paystack initialization failed');

    return {
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
    };
  }

  /**
   * Verify a transaction after payment
   */
  async verifyTransaction(reference: string): Promise<PaystackTransaction> {
    const response = await fetch(`${this.baseUrl}/transaction/verify/${reference}`, {
      headers: { 'Authorization': `Bearer ${this.secretKey}` },
    });

    const data = await response.json();
    if (!data.status) throw new Error(data.message || 'Verification failed');

    return data.data;
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionCode: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/subscription/${subscriptionCode}`, {
      headers: { 'Authorization': `Bearer ${this.secretKey}` },
    });

    const data = await response.json();
    return data.data;
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionCode: string, emailToken: string): Promise<void> {
    await fetch(`${this.baseUrl}/subscription/disable`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: subscriptionCode,
        token: emailToken,
      }),
    });
  }

  /**
   * Get customer's active subscriptions
   */
  async getCustomerSubscriptions(email: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/customer/${email}`, {
      headers: { 'Authorization': `Bearer ${this.secretKey}` },
    });

    const data = await response.json();
    return data.data?.subscriptions || [];
  }

  /**
   * Handle Paystack webhook events
   */
  handleWebhook(event: PaystackWebhookEvent): WebhookAction {
    switch (event.event) {
      case 'subscription.create':
        return {
          action: 'activate_subscription',
          userId: event.data.metadata?.user_id,
          plan: this.getPlanTierFromCode(event.data.plan?.plan_code),
          subscriptionCode: event.data.subscription_code,
        };

      case 'charge.success':
        return {
          action: 'payment_received',
          userId: event.data.metadata?.user_id,
          amount: event.data.amount / 100, // Paystack uses kobo/cents
          reference: event.data.reference,
        };

      case 'subscription.disable':
        return {
          action: 'cancel_subscription',
          userId: event.data.metadata?.user_id,
          subscriptionCode: event.data.subscription_code,
        };

      case 'invoice.payment_failed':
        return {
          action: 'payment_failed',
          userId: event.data.metadata?.user_id,
          subscriptionCode: event.data.subscription_code,
        };

      default:
        return { action: 'ignore' };
    }
  }

  /**
   * Map plan code to tier name
   */
  private getPlanTierFromCode(planCode: string): string {
    const plans = PAYSTACK_CONFIG.plans;
    if (planCode === plans.pro_monthly.code) return 'pro';
    if (planCode === plans.pro_annual.code) return 'pro';
    if (planCode === plans.team.code) return 'team';
    if (planCode === plans.enterprise.code) return 'enterprise';
    return 'free';
  }
}

// Types
interface PaystackTransaction {
  reference: string;
  status: 'success' | 'failed' | 'abandoned';
  amount: number;
  currency: string;
  customer: { email: string };
  plan?: { plan_code: string };
  metadata?: { user_id?: string };
}

interface PaystackWebhookEvent {
  event: string;
  data: any;
}

interface WebhookAction {
  action: string;
  userId?: string;
  plan?: string;
  amount?: number;
  reference?: string;
  subscriptionCode?: string;
}
