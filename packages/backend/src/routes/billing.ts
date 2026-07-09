/**
 * Billing Routes
 * Handles subscription creation, webhooks, and billing management.
 */

import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { PaystackService } from '../services/paystack';
import { PAYSTACK_CONFIG } from '../config/paystack';
import crypto from 'crypto';

export const billingRouter = Router();
const paystack = new PaystackService();

/** Get available plans */
billingRouter.get('/plans', (req: Request, res: Response) => {
  res.json({
    plans: [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        currency: 'ZAR',
        interval: 'forever',
        features: ['20 messages/day', '3 pipelines', 'AWS only', '100K tokens/month'],
      },
      {
        id: 'pro_monthly',
        name: 'Pro',
        price: 899,
        currency: 'ZAR',
        interval: 'monthly',
        plan_code: PAYSTACK_CONFIG.plans.pro_monthly.code,
        features: ['500 messages/day', '50 pipelines', 'All 5 clouds', '2M tokens/month', 'Git integration'],
      },
      {
        id: 'pro_annual',
        name: 'Pro (Annual)',
        price: 8499,
        currency: 'ZAR',
        interval: 'annually',
        plan_code: PAYSTACK_CONFIG.plans.pro_annual.code,
        features: ['Same as Pro Monthly', 'Save 20%'],
        badge: 'Best Value',
      },
      {
        id: 'team',
        name: 'Team',
        price: 699,
        currency: 'ZAR',
        interval: 'monthly',
        per_user: true,
        plan_code: PAYSTACK_CONFIG.plans.team.code,
        features: ['Everything in Pro', 'Shared workspaces', 'SSO', 'Audit logs', 'Priority support'],
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 9000,
        currency: 'ZAR',
        interval: 'monthly',
        plan_code: PAYSTACK_CONFIG.plans.enterprise.code,
        features: ['VPC deployment', 'Unlimited', 'SLA', 'POPIA/GDPR', 'Dedicated support'],
      },
    ],
  });
});

/** Start subscription checkout → redirects to Paystack */
billingRouter.post('/subscribe', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { plan_id } = req.body;

  const planConfig = (PAYSTACK_CONFIG.plans as any)[plan_id];
  if (!planConfig) {
    res.status(400).json({ error: 'Invalid plan' });
    return;
  }

  try {
    const result = await paystack.initializeSubscription({
      email: authReq.user!.email,
      planCode: planConfig.code,
      userId: authReq.user!.id,
    });

    res.json({
      checkout_url: result.authorization_url,
      reference: result.reference,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Payment callback (user returns from Paystack) */
billingRouter.get('/callback', async (req: Request, res: Response) => {
  const { reference } = req.query;

  if (!reference) {
    res.redirect('/billing?status=failed');
    return;
  }

  try {
    const transaction = await paystack.verifyTransaction(reference as string);

    if (transaction.status === 'success') {
      // Activate subscription in our database
      // This is also handled by webhooks (belt + suspenders)
      res.redirect('/billing?status=success');
    } else {
      res.redirect('/billing?status=failed');
    }
  } catch {
    res.redirect('/billing?status=error');
  }
});

/** Paystack webhook endpoint */
billingRouter.post('/webhook', (req: Request, res: Response) => {
  // Verify webhook signature
  const hash = crypto
    .createHmac('sha512', PAYSTACK_CONFIG.webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  // Process the event
  const action = paystack.handleWebhook(req.body);
  console.log('[Paystack Webhook]', action);

  // TODO: Update user subscription in DynamoDB based on action
  // e.g., activate_subscription → set user.tier = 'pro'
  //       cancel_subscription → set user.tier = 'free'
  //       payment_failed → send warning email, grace period

  res.json({ received: true });
});

/** Get current user's subscription status */
billingRouter.get('/status', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  // TODO: Read from DynamoDB
  res.json({
    tier: 'free',
    plan: 'Free',
    tokens_used: 0,
    tokens_limit: 100000,
    messages_today: 0,
    messages_limit: 20,
    pipelines: 0,
    pipelines_limit: 3,
  });
});

/** Cancel subscription */
billingRouter.post('/cancel', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { subscription_code, email_token } = req.body;

  try {
    await paystack.cancelSubscription(subscription_code, email_token);
    res.json({ status: 'cancelled', message: 'Your subscription will end at the current billing period.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
