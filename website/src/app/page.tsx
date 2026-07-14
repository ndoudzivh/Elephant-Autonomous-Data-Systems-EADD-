import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1a]/90 backdrop-blur-md border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg text-blue-400">EADD</Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <a href="#services" className="hover:text-white transition">Services</a>
            <a href="#why-us" className="hover:text-white transition">Why Us</a>
            <a href="#how-it-works" className="hover:text-white transition">How It Works</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition">Log in</Link>
            <Link href="/chat" className="text-sm bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg transition">Try Free</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-8">
            Now in Public Beta
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            AI that builds your{' '}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-green-400 bg-clip-text text-transparent">
              data pipelines
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Describe what you need in plain English. Get production-ready pipelines for
            AWS, Azure, GCP, Snowflake, dbt, Databricks — in minutes, not weeks.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/chat" className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-medium transition">
              Start Building Free →
            </Link>
            <a href="#how-it-works" className="text-gray-400 hover:text-white px-6 py-4 transition">
              See how it works ↓
            </a>
          </div>
          <p className="text-sm text-gray-500 mt-4">No credit card required. 20 messages/day free forever.</p>
        </div>
      </section>

      {/* Platforms Bar */}
      <section className="py-8 border-y border-gray-800/50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-sm text-gray-500 mb-4">Generates production code for:</p>
          <div className="flex flex-wrap justify-center gap-4">
            {['AWS', 'Azure', 'GCP', 'Snowflake', 'Databricks', 'dbt', 'Airflow'].map(p => (
              <span key={p} className="px-3 py-1 bg-gray-800/50 rounded-md text-sm text-gray-300">{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Services</h2>
            <p className="text-gray-400 max-w-xl mx-auto">End-to-end data engineering powered by AI. From design to deployment.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '⚙️', title: 'Pipeline Generation', desc: 'Production-ready PySpark, SQL, dbt, and Airflow code generated from natural language descriptions.' },
              { icon: '🏛️', title: 'Architecture Design', desc: 'Lakehouse (Bronze/Silver/Gold), Star Schema, Data Vault — designed with cost optimization.' },
              { icon: '🔁', title: 'Legacy Migration', desc: 'Convert SAS, SSIS, Informatica, Talend to modern cloud platforms with confidence scoring.' },
              { icon: '✅', title: 'Data Quality', desc: 'Automated validation rules, profiling, schema drift detection, and quarantine workflows.' },
              { icon: '💰', title: 'Cost Estimation', desc: 'Cloud cost projections in ZAR and USD before deployment. Optimization recommendations included.' },
              { icon: '🚀', title: 'CI/CD & Deployment', desc: 'GitHub Actions, Terraform, Docker configs with rollback strategies and environment promotion.' },
            ].map(s => (
              <div key={s.title} className="bg-[#0d1520] border border-gray-800 rounded-xl p-6 hover:border-blue-500/50 transition">
                <div className="text-3xl mb-3">{s.icon}</div>
                <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section id="why-us" className="py-20 px-6 bg-[#060a12]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose EADD?</h2>
            <p className="text-gray-400 max-w-xl mx-auto">Built by data engineers, for data engineers.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              { title: 'Production-Ready Code', desc: 'Not snippets — complete files with imports, error handling, logging, and documentation.' },
              { title: 'Cost-Aware by Default', desc: 'Every solution includes cloud cost estimates. No surprise bills. Optimization built in.' },
              { title: 'Multi-Cloud Support', desc: 'AWS, Azure, GCP, Snowflake, Databricks — same quality output across all platforms.' },
              { title: 'Enterprise Security', desc: 'No data leaves your environment. AI sees only schemas and metadata, never row-level data.' },
              { title: 'Validated & Tested', desc: 'Code passes 50+ validation rules. Auto-fixes common mistakes before you see them.' },
              { title: 'South African Built', desc: 'Pricing in ZAR. Local support. Built with African enterprise needs in mind.' },
            ].map(item => (
              <div key={item.title} className="flex gap-4">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0"></div>
                <div>
                  <h3 className="font-bold mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-400">Three steps to production-ready pipelines.</p>
          </div>
          <div className="space-y-8">
            {[
              { step: '1', title: 'Describe', desc: 'Tell the agent what you need in plain English. "Build a pipeline from PostgreSQL to S3 with daily incremental loads."' },
              { step: '2', title: 'Generate', desc: 'EADD designs the architecture, generates all code (ETL, orchestration, infrastructure), validates it, and estimates costs.' },
              { step: '3', title: 'Deploy', desc: 'Get step-by-step deployment instructions with rollback plans. Push to GitHub with one click.' },
            ].map(item => (
              <div key={item.step} className="flex gap-6 items-start">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-lg font-bold shrink-0">{item.step}</div>
                <div>
                  <h3 className="text-xl font-bold mb-1">{item.title}</h3>
                  <p className="text-gray-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6 bg-[#060a12]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple Pricing</h2>
            <p className="text-gray-400">Start free. Scale as you grow. No hidden fees.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: 'Free', price: 'R0', interval: 'forever', highlight: false,
                features: ['20 messages/day', '3 pipeline generations', 'AWS only', 'Community support'],
                cta: 'Start Free', href: '/chat',
              },
              {
                name: 'Pro', price: 'R899', interval: '/month', highlight: true, badge: 'Popular',
                features: ['500 messages/day', '50 pipelines', 'All 5 clouds', '2M tokens/month', 'Priority support', 'File upload', 'Repo connection'],
                cta: 'Start Pro', href: '/signup?plan=pro',
              },
              {
                name: 'Enterprise', price: 'R9,000', interval: '/month', highlight: false,
                features: ['Unlimited messages', 'VPC deployment', 'Custom AI tuning', 'Dedicated engineer', '99.9% SLA', 'On-premises option'],
                cta: 'Contact Sales', href: '/signup?plan=enterprise',
              },
            ].map(plan => (
              <div key={plan.name} className={`relative rounded-2xl p-6 flex flex-col ${plan.highlight ? 'bg-blue-600/10 border-2 border-blue-500' : 'bg-[#0d1520] border border-gray-800'}`}>
                {plan.badge && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">{plan.badge}</div>}
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="my-4"><span className="text-3xl font-bold">{plan.price}</span><span className="text-gray-400 text-sm"> {plan.interval}</span></div>
                <ul className="space-y-2 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href} className={`block text-center py-3 rounded-xl font-medium transition ${plan.highlight ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-200'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to build your next pipeline?</h2>
        <p className="text-gray-400 mb-8">Join data engineers using EADD to ship faster.</p>
        <Link href="/chat" className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-medium transition">
          Start Building Free →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-sm text-gray-500">&copy; 2026 EADD — Elephant Autonomous Data Systems</div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <a href="#services" className="hover:text-white transition">Services</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <Link href="/about" className="hover:text-white transition">About</Link>
            <a href="https://www.linkedin.com/company/elephant-autonomous-data-systems-eadd-ai-/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition">LinkedIn</a>
            <a href="https://github.com/ndoudzivh/Elephant-Autonomous-Data-Systems-EADD-" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">GitHub</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
