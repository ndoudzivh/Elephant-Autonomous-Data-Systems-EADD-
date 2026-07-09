/**
 * Paystack Configuration
 * Plan codes from: https://dashboard.paystack.com
 * 
 * LIVE plan codes — connected to real billing.
 */

export const PAYSTACK_CONFIG = {
  /** API keys (set these in environment variables, NEVER hardcode secrets) */
  publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
  secretKey: process.env.PAYSTACK_SECRET_KEY || '',
  baseUrl: 'https://api.paystack.co',

  /** Plan codes from Paystack dashboard */
  plans: {
    pro_monthly: {
      code: 'PLN_66us2k8tsfj1opj',
      name: 'EADD Pro Monthly',
      amount_zar: 899,
      interval: 'monthly',
    },
    pro_annual: {
      code: 'PLN_8cpcldlg3t2ivtw',
      name: 'EADD Pro Annual',
      amount_zar: 8499,
      interval: 'annually',
    },
    team: {
      code: 'PLN_56db7nif43wuhfc',
      name: 'EADD Team',
      amount_zar: 699,
      interval: 'monthly',
    },
    enterprise: {
      code: 'PLN_y2co9ue7w6vkh26',
      name: 'EADD Enterprise',
      amount_zar: 9000,
      interval: 'monthly',
    },
  },

  /** Webhook secret for verifying Paystack events */
  webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || '',

  /** Callback URLs */
  callbackUrl: process.env.PAYSTACK_CALLBACK_URL || 'https://eadd.ai/billing/callback',
  cancelUrl: process.env.PAYSTACK_CANCEL_URL || 'https://eadd.ai/billing/cancelled',
};
