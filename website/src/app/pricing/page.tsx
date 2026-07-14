import Link from 'next/link';

const plans = [
  {
    name: 'Free',
    price: 'R0',
    interval: 'forever',
    description: 'Get started with AI-powered pipelines',
    features: [
      '20 messages per day',
      '3 pipeline generations',
      'AWS platform only',
      '100K tokens/month',
      'Community support',
      'Basic templates',
    ],
    cta: 'Start Free',
    href: '/chat',
    highlight: false,
  },
  {
    name: 'Pro',
    price: 'R899',
    interval: '/month',
    description: 'For professional data engineers',
    features: [
      '500 messages per day',
      '50 pipeline generations',
      'All 5 cloud platforms',
      '2M tokens/month',
      'Priority support',
      'Custom templates',
      'Pipeline history',
      'File upload & analysis',
      'Repo connection',
    ],
    cta: 'Start Pro Trial',
    href: '/signup?plan=pro',
    highlight: true,
    badge: 'Most Popular',
  },
  {
    name: 'Team',
    price: 'R699',
    interval: '/user/month',
    description: 'Collaborate with your data team',
    features: [
      'Everything in Pro',
      'Shared workspaces',
      'Team pipeline library',
      'SSO authentication',
      'Audit logs',
      'Role-based access',
      'Slack integration',
      'Priority queue',
    ],
    cta: 'Contact Sales',
    href: '/signup?plan=team',
    highlight: false,
  },
  {
    name: 'Enterprise',
    price: 'R9,000',
    interval: '/month',
    description: 'For large-scale data operations',
    features: [
      'Everything in Team',
      'Unlimited messages',
      'VPC deployment',
      'Custom AI model fine-tuning',
      'Dedicated support engineer',
      '99.9% SLA',
      'On-premises option',
      'Custom integrations',
      'Training & onboarding',
    ],
    cta: 'Contact Sales',
    href: '/signup?plan=enterprise',
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen px-6 py-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Simple, transparent pricing</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Start free. Scale as your data engineering needs grow. No hidden fees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-6 flex flex-col ${
                plan.highlight
                  ? 'bg-blue-600/10 border-2 border-blue-500'
                  : 'bg-[#0d1520] border border-gray-800'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                  {plan.badge}
                </div>
              )}
              <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
              <p className="text-sm text-gray-400 mb-4">{plan.description}</p>
              <div className="mb-6">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-gray-400 text-sm"> {plan.interval}</span>
              </div>
              <ul className="space-y-2 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-300">
                    <svg className="w-4 h-4 text-green-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`block text-center py-3 rounded-xl font-medium transition ${
                  plan.highlight
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <h2 className="text-2xl font-bold mb-8">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto grid gap-6 text-left">
            {[
              { q: 'What counts as a message?', a: 'Each message you send to the EADD agent counts as one message. Agent responses do not count against your limit.' },
              { q: 'Can I switch plans?', a: 'Yes. Upgrade or downgrade at any time. Changes take effect immediately with prorated billing.' },
              { q: 'What payment methods do you accept?', a: 'We accept all major credit/debit cards via Paystack. EFT available for Enterprise plans.' },
              { q: 'Is there a free trial for Pro?', a: 'Yes. Pro comes with a 14-day free trial. No credit card required to start.' },
              { q: 'What happens if I exceed my message limit?', a: 'You will be prompted to upgrade. No charges are applied without your consent.' },
            ].map((faq) => (
              <div key={faq.q} className="bg-[#0d1520] border border-gray-800 rounded-xl p-5">
                <h3 className="font-medium mb-2">{faq.q}</h3>
                <p className="text-sm text-gray-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-white transition">← Back to home</Link>
        </div>
      </div>
    </main>
  );
}
